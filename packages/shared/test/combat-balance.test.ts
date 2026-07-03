import { describe, expect, it } from "vitest";

import {
  applyPartyWipe,
  createBattle,
  resolveTurn,
  statsForLevel,
  SKILLS,
  XP_TO_NEXT,
  LEVEL_STATS,
  MAX_LEVEL
} from "../src/index.js";
import type { BattleCommand, BattleEvent, BattleOutcome, BattleState, PlayerProgress } from "../src/index.js";

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
  enemyId: "mist-wolf" | "candle-eater" | "creaking-doll" | "dream-eater",
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
 * ボス用ヒューリスティック(competent-but-not-optimal な人間プレイヤーの近似):
 * - このターンの攻撃スキルで倒しきれるなら、回復せず攻撃で決める
 * - HPが4割以下でMPがあれば回復
 * - MPがあれば攻撃スキル、なければ通常攻撃
 */
const bossPolicy: Policy = (state) => {
  const p = state.player;
  const heal = SKILLS["soothing-light"];
  const ember = SKILLS["ember-strike"];
  // 攻撃スキルの概算ダメージ(下限側): floor(atk*power*0.9) - floor(def/2)
  const emberMin = Math.max(1, Math.floor(p.attack * ember.power * 0.9) - Math.floor(state.enemy.defense / 2));
  const canFinish = p.mp >= ember.mpCost && state.enemy.hp <= emberMin;
  if (canFinish) return { kind: "skill", skillId: "ember-strike" };
  if (p.hp <= p.maxHP * 0.4 && p.mp >= heal.mpCost) return { kind: "skill", skillId: "soothing-light" };
  if (p.mp >= ember.mpCost) return { kind: "skill", skillId: "ember-strike" };
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
