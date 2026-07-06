import { describe, expect, it } from "vitest";

import {
  applyPartyWipe,
  createBattle,
  isSkillLearned,
  resolveTurn,
  statsForLevel,
  SKILLS,
  XP_TO_NEXT,
  LEVEL_STATS,
  MAX_LEVEL
} from "../src/index.js";
import type { BattleCommand, BattleEvent, BattleOutcome, BattleState, EnemyId, PlayerProgress, SkillId } from "../src/index.js";

// --- シミュレーション基盤(固定シード集合で統計的に検証する) ---

type Policy = (state: BattleState) => BattleCommand;

interface SimResult {
  outcome: BattleOutcome;
  turns: number;
  events: BattleEvent[];
  state: BattleState;
}

function simulate(
  progress: PlayerProgress,
  enemyId: EnemyId,
  seed: number,
  policy: Policy,
  maxTurns = 200
): SimResult {
  let state = createBattle(progress, enemyId, seed);
  const events: BattleEvent[] = [];
  let turns = 0;
  while (state.outcome === "ongoing" && turns < maxTurns) {
    const command = policy(state);
    const res = resolveTurn(state, command);
    // ラウンドが進んだ場合のみ turns を数える(command-rejected は進まない=ポリシー不備)
    const advanced = res.state.turn > state.turn;
    state = res.state;
    events.push(...res.events);
    if (advanced) turns += 1;
    else break; // ポリシーが不正コマンドを出した(テストのバグ)。無限ループ回避
  }
  return { outcome: state.outcome, turns, events, state };
}

/** 常にたたかう(MP不要・最弱雑魚の基準ターン測定用) */
const attackPolicy: Policy = () => ({ kind: "attack" });

/**
 * ボス用ヒューリスティック(competent-but-not-optimal な人間プレイヤーの近似。M9-2で新スキル対応):
 * - 倒しきれるなら、習得済みで最も強い一撃(blaze-ender ×3.0 > ember-strike ×1.8)で決める
 * - HPが4割以下でMPがあれば回復
 * - 灯守りの構え(Lv4習得)は、ボスが第2形態(HP50%以下・攻撃激化)に入りバフが切れているときだけ張り直す
 *   (前半から張ると火力を落として非最適になりすぎるため後半限定の防御的立ち回りに留める)
 * - 主力は習得済み最大powerの攻撃スキル、無ければ通常攻撃
 * 注: murk-cleave(×1.3)は ember-strike(×1.8)にダメージで劣位(dominated)のため主力に選ばない。
 *     これにより Lv3(新スキルは murk-cleave のみ)の挙動は従来と実質同一に保たれる。
 *     方策が返すコマンドは必ず「習得済み かつ MP充足」であること(simulate は command-rejected で
 *     ループを中断するため、未習得/MP不足を返すと勝率計測が壊れる)。
 */
const bossPolicy: Policy = (state) => {
  const p = state.player;
  const heal = SKILLS["soothing-light"];
  const warding = SKILLS["warding-stance"];
  // 使える攻撃スキルを power 降順で(finisher・主力の選定に使う)。blaze-ender は Lv6+ のみ
  const attackIds: SkillId[] = ["blaze-ender", "ember-strike"];
  const usableAttacks = attackIds.filter((id) => isSkillLearned(id, p.level) && p.mp >= SKILLS[id].mpCost);

  // このターンで倒しきれる最強の一撃があれば即決める(最小ダメージ=variance下端0.9で保証)
  for (const id of usableAttacks) {
    const s = SKILLS[id];
    if (s.kind !== "attack") continue;
    const minDmg = Math.max(1, Math.floor(p.attack * s.power * 0.9) - Math.floor(state.enemy.defense / 2));
    if (state.enemy.hp <= minDmg) return { kind: "skill", skillId: id };
  }

  // HPが4割以下でMPがあれば回復
  if (p.hp <= p.maxHP * 0.4 && p.mp >= heal.mpCost) return { kind: "skill", skillId: "soothing-light" };

  // 灯守りの構え: ボスが第2形態へ移る「攻撃が激化する節目」で一度だけ身構える。
  // ただし発動は「攻めの余力がある」= blaze-ender(×3.0の大火力・Lv6習得)を持つときに限る。
  // 火力に余裕のない Lv5 以下では、1ターンでも攻撃を止めると夢喰いの削り合いに負ける(net-negative)ため
  // 身構えず攻め切る。ボスHPは単調減少するので、HP割合が突入直後の狭い窓(0.42〜0.5)のときだけ
  // 発動 → 事実上1回のブレースに留める(competent-but-not-optimal な立ち回り)。
  const buffDown = p.defenseBuff === null || p.defenseBuff.remainingTurns <= 0;
  const bossHpRatio = state.enemy.hp / state.enemy.maxHP;
  const braceMoment = bossHpRatio <= 0.5 && bossHpRatio >= 0.42;
  const hasOffensiveSlack = isSkillLearned("blaze-ender", p.level);
  if (
    braceMoment &&
    buffDown &&
    hasOffensiveSlack &&
    isSkillLearned("warding-stance", p.level) &&
    p.mp >= warding.mpCost
  ) {
    return { kind: "skill", skillId: "warding-stance" };
  }

  // 主力: 使える最大powerの攻撃スキル、無ければ通常攻撃
  const primary = usableAttacks[0];
  if (primary !== undefined) return { kind: "skill", skillId: primary };
  return { kind: "attack" };
};

function fullProgress(level: number, gold = 0): PlayerProgress {
  const s = statsForLevel(level);
  return { level, xp: 0, hp: s.maxHP, mp: s.maxMP, gold };
}

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

// ---------------------------------------------------------------------------
// 成長テーブルの健全性
// ---------------------------------------------------------------------------

describe("成長テーブル", () => {
  it("LEVEL_STATS は Lv1-10 の10件で、各能力値が単調非減少", () => {
    expect(LEVEL_STATS.length).toBe(MAX_LEVEL);
    for (let i = 1; i < LEVEL_STATS.length; i += 1) {
      const prev = LEVEL_STATS[i - 1];
      const cur = LEVEL_STATS[i];
      if (!prev || !cur) throw new Error("欠落");
      expect(cur.maxHP).toBeGreaterThanOrEqual(prev.maxHP);
      expect(cur.maxMP).toBeGreaterThanOrEqual(prev.maxMP);
      expect(cur.attack).toBeGreaterThanOrEqual(prev.attack);
      expect(cur.defense).toBeGreaterThanOrEqual(prev.defense);
      expect(cur.speed).toBeGreaterThanOrEqual(prev.speed);
    }
  });

  it("XP_TO_NEXT は9件で狭義単調増加", () => {
    expect(XP_TO_NEXT.length).toBe(MAX_LEVEL - 1);
    for (let i = 1; i < XP_TO_NEXT.length; i += 1) {
      const prev = XP_TO_NEXT[i - 1];
      const cur = XP_TO_NEXT[i];
      if (prev === undefined || cur === undefined) throw new Error("欠落");
      expect(cur).toBeGreaterThan(prev);
    }
  });
});

// ---------------------------------------------------------------------------
// 条件1: Lv1で最弱雑魚(霧狼)に3-5ターンで勝てる(多数シード)
// ---------------------------------------------------------------------------

describe("バランス条件1: Lv1 vs 霧狼", () => {
  it("全シードで勝利し、決着ターンが3-5に収まる", () => {
    const progress = fullProgress(1);
    let wins = 0;
    let turnSum = 0;
    let minTurns = Infinity;
    let maxTurns = 0;
    for (const seed of SEEDS) {
      const r = simulate(progress, "mist-wolf", seed, attackPolicy);
      if (r.outcome === "victory") wins += 1;
      turnSum += r.turns;
      minTurns = Math.min(minTurns, r.turns);
      maxTurns = Math.max(maxTurns, r.turns);
      expect(r.outcome).toBe("victory");
      expect(r.turns).toBeGreaterThanOrEqual(3);
      expect(r.turns).toBeLessThanOrEqual(5);
    }
    const winRate = wins / SEEDS.length;
    const avgTurns = turnSum / SEEDS.length;
    // 計測値をログ出力(報告用)
    console.log(`[Lv1 vs 霧狼] 勝率=${(winRate * 100).toFixed(1)}% 平均ターン=${avgTurns.toFixed(2)} 範囲=${minTurns}-${maxTurns}`);
    expect(winRate).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 条件2: 推奨Lv(5-6)未満、特にLv3以下でのボス挑戦は高確率で全滅
// ---------------------------------------------------------------------------

describe("バランス条件2: ボス(夢喰い)", () => {
  function runBoss(level: number): { winRate: number; wipeRate: number; avgTurns: number } {
    const progress = fullProgress(level);
    let wins = 0;
    let wipes = 0;
    let turnSum = 0;
    for (const seed of SEEDS) {
      const r = simulate(progress, "dream-eater", seed, bossPolicy);
      if (r.outcome === "victory") wins += 1;
      if (r.outcome === "defeat") wipes += 1;
      turnSum += r.turns;
    }
    return { winRate: wins / SEEDS.length, wipeRate: wipes / SEEDS.length, avgTurns: turnSum / SEEDS.length };
  }

  it("推奨レベル未満(Lv1-4)は高確率で全滅する(目安Lv3以下は特に)", () => {
    for (const level of [1, 2, 3, 4]) {
      const { winRate, wipeRate, avgTurns } = runBoss(level);
      console.log(`[Lv${level} vs 夢喰い] 勝率=${(winRate * 100).toFixed(1)}% 全滅率=${(wipeRate * 100).toFixed(1)}% 平均ターン=${avgTurns.toFixed(2)}`);
      // 目安Lv3以下は >=90%、Lv4(推奨未満)も >=80% で全滅
      expect(wipeRate).toBeGreaterThanOrEqual(level <= 3 ? 0.9 : 0.8);
    }
  });

  it("推奨Lv6では十分な確率(>=70%)で勝てる(ボスが到達可能難易度であること)", () => {
    const { winRate, wipeRate, avgTurns } = runBoss(6);
    console.log(`[Lv6 vs 夢喰い] 勝率=${(winRate * 100).toFixed(1)}% 全滅率=${(wipeRate * 100).toFixed(1)}% 平均ターン=${avgTurns.toFixed(2)}`);
    expect(winRate).toBeGreaterThanOrEqual(0.7);
  });

  it("推奨Lv5でも勝てる(推奨帯の下限が到達可能であること)", () => {
    const { winRate, wipeRate, avgTurns } = runBoss(5);
    console.log(`[Lv5 vs 夢喰い] 勝率=${(winRate * 100).toFixed(1)}% 全滅率=${(wipeRate * 100).toFixed(1)}% 平均ターン=${avgTurns.toFixed(2)}`);
    expect(winRate).toBeGreaterThanOrEqual(0.6);
  });

  it("[診断] Lv1-8 の対ボス勝率スイープ", () => {
    for (const level of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { winRate, wipeRate, avgTurns } = runBoss(level);
      console.log(`[SWEEP Lv${level}] 勝率=${(winRate * 100).toFixed(1)}% 全滅率=${(wipeRate * 100).toFixed(1)}% 平均ターン=${avgTurns.toFixed(2)}`);
    }
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 条件3: 敵バリエーション(M10)の推奨レベル帯検証
//  - 推奨帯で勝てる/推奨未満では危険、を統計検証(既存閾値と同じ 300シード・純関数)。
//  - 雑魚は通常攻撃のみ(attackPolicy)、中ボスはボス用ヒューリスティック(bossPolicy)で測る。
// ---------------------------------------------------------------------------

function winWipeRates(
  enemyId: EnemyId,
  level: number,
  policy: Policy
): { winRate: number; wipeRate: number; avgTurns: number } {
  const progress = fullProgress(level);
  let wins = 0;
  let wipes = 0;
  let turnSum = 0;
  for (const seed of SEEDS) {
    const r = simulate(progress, enemyId, seed, policy);
    if (r.outcome === "victory") wins += 1;
    if (r.outcome === "defeat") wipes += 1;
    turnSum += r.turns;
  }
  return { winRate: wins / SEEDS.length, wipeRate: wipes / SEEDS.length, avgTurns: turnSum / SEEDS.length };
}

describe("バランス条件3: 敵バリエーション(M10)", () => {
  it("迷い火(フィールド。推奨Lv1-2): Lv1 で通常攻撃のみで全シード勝利し、数ターンで決着", () => {
    let wins = 0;
    let minTurns = Infinity;
    let maxTurns = 0;
    for (const seed of SEEDS) {
      const r = simulate(fullProgress(1), "wisp-flame", seed, attackPolicy);
      if (r.outcome === "victory") wins += 1;
      minTurns = Math.min(minTurns, r.turns);
      maxTurns = Math.max(maxTurns, r.turns);
      expect(r.outcome).toBe("victory");
      expect(r.turns).toBeGreaterThanOrEqual(2);
      expect(r.turns).toBeLessThanOrEqual(5);
    }
    console.log(`[Lv1 vs 迷い火] 勝率=${((wins / SEEDS.length) * 100).toFixed(1)}% 範囲=${minTurns}-${maxTurns}`);
    expect(wins).toBe(SEEDS.length);
  });

  it("囁き仮面(浅層。推奨Lv2-3): Lv3 で確実に勝て、Lv1 では高確率で全滅", () => {
    const lv3 = winWipeRates("whisper-mask", 3, attackPolicy);
    const lv1 = winWipeRates("whisper-mask", 1, attackPolicy);
    console.log(`[囁き仮面] Lv3 勝率=${(lv3.winRate * 100).toFixed(1)}% / Lv1 全滅率=${(lv1.wipeRate * 100).toFixed(1)}%`);
    expect(lv3.winRate).toBeGreaterThanOrEqual(0.9);
    expect(lv1.wipeRate).toBeGreaterThanOrEqual(0.9);
  });

  it("錆喰い(深層。推奨Lv3-4): Lv4 で確実に勝て、Lv2 では高確率で全滅", () => {
    const lv4 = winWipeRates("rust-eater", 4, attackPolicy);
    const lv2 = winWipeRates("rust-eater", 2, attackPolicy);
    console.log(`[錆喰い] Lv4 勝率=${(lv4.winRate * 100).toFixed(1)}% / Lv2 全滅率=${(lv2.wipeRate * 100).toFixed(1)}%`);
    expect(lv4.winRate).toBeGreaterThanOrEqual(0.9);
    expect(lv2.wipeRate).toBeGreaterThanOrEqual(0.9);
  });

  describe("紡ぎ損ない(中ボス。推奨Lv4-5。bossPolicy で測る)", () => {
    it("推奨Lv5 では十分な確率(>=85%)で勝てる", () => {
      const { winRate, wipeRate } = winWipeRates("failing-spinner", 5, bossPolicy);
      console.log(`[Lv5 vs 紡ぎ損ない] 勝率=${(winRate * 100).toFixed(1)}% 全滅率=${(wipeRate * 100).toFixed(1)}%`);
      expect(winRate).toBeGreaterThanOrEqual(0.85);
    });

    it("推奨下限 Lv4 でも勝ち越せる(>=70%)", () => {
      const { winRate } = winWipeRates("failing-spinner", 4, bossPolicy);
      console.log(`[Lv4 vs 紡ぎ損ない] 勝率=${(winRate * 100).toFixed(1)}%`);
      expect(winRate).toBeGreaterThanOrEqual(0.7);
    });

    it("推奨未満(Lv2-3)は高確率(>=90%)で全滅する", () => {
      for (const level of [2, 3]) {
        const { wipeRate } = winWipeRates("failing-spinner", level, bossPolicy);
        console.log(`[Lv${level} vs 紡ぎ損ない] 全滅率=${(wipeRate * 100).toFixed(1)}%`);
        expect(wipeRate).toBeGreaterThanOrEqual(0.9);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// レベルアップ(複数レベル一気上がり)
// ---------------------------------------------------------------------------

describe("レベルアップ", () => {
  it("勝利時の経験値で複数レベル一気に上がる", () => {
    // Lv1 で xp を Lv5直前(累積138の手前=135)まで持たせ、霧狼(4xp)を倒すと 139 → Lv5 へ
    const progress: PlayerProgress = { level: 1, xp: 135, hp: statsForLevel(1).maxHP, mp: statsForLevel(1).maxMP, gold: 0 };
    const r = simulate(progress, "mist-wolf", 42, attackPolicy);
    expect(r.outcome).toBe("victory");
    const levelUps = r.events.filter((e) => e.type === "level-up");
    expect(levelUps.length).toBe(4); // Lv1→2→3→4→5
    expect(r.state.player.level).toBe(5);
    // 残り経験値: 139 - (8+20+40+70) = 1
    expect(r.state.player.xp).toBe(1);
    // 現在HP/MPは Lv5 の最大値を超えない
    expect(r.state.player.hp).toBeLessThanOrEqual(statsForLevel(5).maxHP);
    expect(r.state.player.mp).toBeLessThanOrEqual(statsForLevel(5).maxMP);
  });

  it("最大レベルでは経験値を得ても上がらない(超過分は保持)", () => {
    const progress: PlayerProgress = { level: MAX_LEVEL, xp: 0, hp: statsForLevel(MAX_LEVEL).maxHP, mp: statsForLevel(MAX_LEVEL).maxMP, gold: 0 };
    const r = simulate(progress, "mist-wolf", 7, attackPolicy);
    expect(r.outcome).toBe("victory");
    expect(r.state.player.level).toBe(MAX_LEVEL);
    expect(r.events.some((e) => e.type === "level-up")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 全滅処理(純関数)
// ---------------------------------------------------------------------------

describe("applyPartyWipe(全滅処理)", () => {
  it("ゴールド半減(切り捨て)+ HP/MP全回復。レベル・経験値は不変", () => {
    const before: PlayerProgress = { level: 4, xp: 30, hp: 3, mp: 0, gold: 101 };
    const { progress, goldLost } = applyPartyWipe(before);
    const s = statsForLevel(4);
    expect(progress.gold).toBe(50); // floor(101/2)
    expect(goldLost).toBe(51);
    expect(progress.hp).toBe(s.maxHP);
    expect(progress.mp).toBe(s.maxMP);
    expect(progress.level).toBe(4);
    expect(progress.xp).toBe(30);
  });

  it("所持金0でも破綻しない", () => {
    const { progress, goldLost } = applyPartyWipe({ level: 1, xp: 0, hp: 0, mp: 0, gold: 0 });
    expect(progress.gold).toBe(0);
    expect(goldLost).toBe(0);
  });
});
