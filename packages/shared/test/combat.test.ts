import { describe, expect, it } from "vitest";

import {
  computeDamage,
  createBattle,
  fleeChance,
  poisonTickDamage,
  resolveTurn,
  statsForLevel,
  turnOrder
} from "../src/index.js";
import type { BattleCommand, BattleEvent, BattleState, Equipment, PlayerProgress, Rng } from "../src/index.js";

// --- テスト用の決定論的な偽Rng(next()の戻り値を列で制御する) ---
function fakeRng(queue: number[]): Rng {
  let i = 0;
  const next = (): number => {
    const v = queue[i] ?? 0;
    i += 1;
    return v;
  };
  return {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    state: () => 0
  };
}

function lv(level: number, gold = 0): PlayerProgress {
  const s = statsForLevel(level);
  return { level, xp: 0, hp: s.maxHP, mp: s.maxMP, gold };
}

// ---------------------------------------------------------------------------
// ダメージ式(game-design.md「ターン制戦闘」の式を厳守)
// max(1, floor(攻撃力 × rand(0.9..1.1)) - floor(防御力 / 2))
// ---------------------------------------------------------------------------

describe("computeDamage(ダメージ式)", () => {
  it("通常攻撃(multiplier=1)は仕様式と一致する(乱数幅0.9-1.1の全域)", () => {
    const attack = 17;
    const defense = 9;
    for (const u of [0, 0.25, 0.5, 0.75, 0.9999999]) {
      const variance = 0.9 + u * 0.2;
      const expected = Math.max(1, Math.floor(attack * variance) - Math.floor(defense / 2));
      expect(computeDamage(attack, defense, 1, fakeRng([u]))).toBe(expected);
    }
  });

  it("乱数の下端(0.9)と上端(1.1未満)の境界", () => {
    // 下端: floor(10 * 0.9) - floor(4/2) = 9 - 2 = 7
    expect(computeDamage(10, 4, 1, fakeRng([0]))).toBe(7);
    // 上端(1.1直前): floor(10 * ~1.0999998) - 2 = 10 - 2 = 8
    expect(computeDamage(10, 4, 1, fakeRng([0.9999999]))).toBe(8);
  });

  it("防御が高くても最低1ダメージは保証される", () => {
    expect(computeDamage(2, 100, 1, fakeRng([0]))).toBe(1);
    expect(computeDamage(1, 999, 1, fakeRng([0.9999999]))).toBe(1);
  });

  it("スキル倍率は攻撃力に乗る(floor(攻撃力 × 倍率 × 乱数))", () => {
    // floor(18 * 1.8 * 0.9) - floor(9/2) = floor(29.16) - 4 = 29 - 4 = 25
    expect(computeDamage(18, 9, 1.8, fakeRng([0]))).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// 行動順(素早さ降順・同値は乱数)
// ---------------------------------------------------------------------------

describe("turnOrder(行動順)", () => {
  it("素早さが高い側が先手", () => {
    expect(turnOrder(12, 8, fakeRng([0]))).toEqual(["player", "enemy"]);
    expect(turnOrder(8, 12, fakeRng([0]))).toEqual(["enemy", "player"]);
  });

  it("同値は乱数で決まる(両順が起こりうる)", () => {
    expect(turnOrder(10, 10, fakeRng([0.2]))).toEqual(["player", "enemy"]);
    expect(turnOrder(10, 10, fakeRng([0.8]))).toEqual(["enemy", "player"]);
  });
});

// ---------------------------------------------------------------------------
// にげる成功率(50% + (自素早さ - 敵素早さ)×2%、10-90%クランプ)
// ---------------------------------------------------------------------------

describe("fleeChance(逃走率)", () => {
  it("素早さ同値で50%", () => {
    expect(fleeChance(10, 10)).toBeCloseTo(0.5, 10);
  });

  it("速度差に比例(1差で2%)", () => {
    expect(fleeChance(15, 10)).toBeCloseTo(0.6, 10);
    expect(fleeChance(10, 15)).toBeCloseTo(0.4, 10);
  });

  it("上下限は10%-90%にクランプ", () => {
    expect(fleeChance(100, 10)).toBe(0.9);
    expect(fleeChance(10, 100)).toBe(0.1);
  });
});

// ---------------------------------------------------------------------------
// 逃走コマンド(通常戦=可、ボス戦=不可)
// ---------------------------------------------------------------------------

describe("にげるコマンド", () => {
  it("通常戦: 成功すると outcome=fled", () => {
    const state = createBattle(lv(1), "mist-wolf", 1);
    // 乱数を制御するため rngState を上書きせず、成功しやすい高速プレイヤーで多シード試行
    let fled = false;
    for (let seed = 1; seed <= 50 && !fled; seed += 1) {
      const s = createBattle(lv(6), "mist-wolf", seed); // 素早さ差で高確率成功
      const res = resolveTurn(s, { kind: "flee" });
      if (res.state.outcome === "fled") {
        fled = true;
        expect(res.events.some((e) => e.type === "flee" && e.success)).toBe(true);
      }
    }
    expect(fled).toBe(true);
    expect(state.outcome).toBe("ongoing");
  });

  it("ボス戦: にげるは常に拒否(command-rejected, 状態不変)", () => {
    const state = createBattle(lv(6), "dream-eater", 1);
    const res = resolveTurn(state, { kind: "flee" });
    expect(res.events).toHaveLength(1);
    expect(res.events[0]).toMatchObject({ type: "command-rejected", reason: "flee-not-allowed" });
    expect(res.state).toBe(state); // 参照ごと不変(ラウンドは進まない)
    expect(res.state.outcome).toBe("ongoing");
    expect(res.state.turn).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// コマンド拒否(MP不足・戦闘終了後)
// ---------------------------------------------------------------------------

describe("コマンド拒否", () => {
  it("MP不足のスキルは拒否される(状態不変)", () => {
    const state = createBattle(lv(1), "mist-wolf", 1);
    state.player.mp = 0;
    const res = resolveTurn(state, { kind: "skill", skillId: "ember-strike" });
    expect(res.events[0]).toMatchObject({ type: "command-rejected", reason: "not-enough-mp" });
    expect(res.state.turn).toBe(0);
  });

  it("戦闘終了後のコマンドは battle-over で拒否", () => {
    let state = createBattle(lv(10), "mist-wolf", 3);
    // Lv10 なら数ターンで勝利する
    let guard = 0;
    while (state.outcome === "ongoing" && guard < 20) {
      state = resolveTurn(state, { kind: "attack" }).state;
      guard += 1;
    }
    expect(state.outcome).toBe("victory");
    const res = resolveTurn(state, { kind: "attack" });
    expect(res.events[0]).toMatchObject({ type: "command-rejected", reason: "battle-over" });
    expect(res.state).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// 毒(状態異常)
// ---------------------------------------------------------------------------

describe("毒(poison)", () => {
  it("tickダメージ = 最大HPの5%(最低1・切り捨て)", () => {
    expect(poisonTickDamage(20)).toBe(1); // floor(1.0)
    expect(poisonTickDamage(68)).toBe(3); // floor(3.4)
    expect(poisonTickDamage(100)).toBe(5);
    expect(poisonTickDamage(5)).toBe(1); // 最低1保証
  });

  it("毒のプレイヤーはラウンド終端に最大HPの5%を失う", () => {
    const state = createBattle(lv(5), "creaking-doll", 1); // 敵は1ターンで死なないHP
    state.player.statuses.push({ id: "poison", remainingTurns: 3 });
    const hpBefore = state.player.hp;
    const res = resolveTurn(state, { kind: "attack" });
    const tick = res.events.find((e): e is Extract<BattleEvent, { type: "status-tick" }> => e.type === "status-tick" && e.target === "player");
    expect(tick).toBeDefined();
    expect(tick?.amount).toBe(poisonTickDamage(state.player.maxHP));
    // HPは(敵の攻撃 + 毒tick)で減っている
    expect(res.state.player.hp).toBeLessThan(hpBefore);
  });

  it("毒は規定ラウンド後に解除される(status-expired)", () => {
    let state = createBattle(lv(10), "creaking-doll", 2);
    state.player.statuses = [{ id: "poison", remainingTurns: 1 }];
    // 攻撃を1ラウンド。残り1→0で解除イベント
    const res = resolveTurn(state, { kind: "attack" });
    state = res.state;
    expect(res.events.some((e) => e.type === "status-expired" && e.status === "poison")).toBe(true);
    expect(state.player.statuses.some((s) => s.id === "poison")).toBe(false);
  });

  it("解毒薬で毒が治る(status-cured, 毒が消える)", () => {
    const state = createBattle(lv(5), "mist-wolf", 1);
    state.player.statuses = [{ id: "poison", remainingTurns: 3 }];
    const res = resolveTurn(state, { kind: "item", itemId: "antidote" });
    expect(res.events.some((e) => e.type === "status-cured" && e.status === "poison")).toBe(true);
    expect(res.state.player.statuses.some((s) => s.id === "poison")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// どうぐ(回復薬)
// ---------------------------------------------------------------------------

describe("どうぐ", () => {
  it("回復薬(小)でHPが回復する(最大HP超えない)", () => {
    const state = createBattle(lv(5), "mist-wolf", 1);
    state.player.hp = 10;
    const res = resolveTurn(state, { kind: "item", itemId: "potion-small" });
    const heal = res.events.find((e): e is Extract<BattleEvent, { type: "heal" }> => e.type === "heal");
    expect(heal).toBeDefined();
    expect(res.state.player.hp).toBeGreaterThan(10);
    expect(res.state.player.hp).toBeLessThanOrEqual(res.state.player.maxHP);
  });
});

// ---------------------------------------------------------------------------
// ボスの形態変化(HP50%閾値)
// ---------------------------------------------------------------------------

describe("ボス形態変化", () => {
  function fightBoss(seed: number): { events: BattleEvent[]; final: BattleState } {
    let state = createBattle(lv(6), "dream-eater", seed);
    const events: BattleEvent[] = [];
    let guard = 0;
    while (state.outcome === "ongoing" && guard < 100) {
      const cmd: BattleCommand = state.player.mp >= 4 ? { kind: "skill", skillId: "ember-strike" } : { kind: "attack" };
      const res = resolveTurn(state, cmd);
      events.push(...res.events);
      state = res.state;
      guard += 1;
    }
    return { events, final: state };
  }

  it("HP50%以下で形態変化イベントが1回だけ発生し、台詞を持つ", () => {
    const { events } = fightBoss(1);
    const phaseChanges = events.filter((e) => e.type === "phase-change");
    expect(phaseChanges.length).toBe(1);
    const pc = phaseChanges[0];
    expect(pc).toMatchObject({ type: "phase-change", phaseIndex: 1 });
    if (pc && pc.type === "phase-change") {
      expect(pc.message.length).toBeGreaterThan(0);
    }
  });

  it("勝利は敵の行動より前に解決する(撃破ターンに敵行動・形態変化が続かない)", () => {
    // 勝利するシードで、victory 以降に敵の action / phase-change が無いことを確認
    let winSeed = -1;
    for (let seed = 1; seed <= 30; seed += 1) {
      const { final } = fightBoss(seed);
      if (final.outcome === "victory") {
        winSeed = seed;
        break;
      }
    }
    expect(winSeed).toBeGreaterThan(0);
    const { events } = fightBoss(winSeed);
    const victoryIndex = events.findIndex((e) => e.type === "victory");
    expect(victoryIndex).toBeGreaterThanOrEqual(0);
    const after = events.slice(victoryIndex + 1);
    expect(after.some((e) => e.type === "action" && e.actor === "enemy")).toBe(false);
    expect(after.some((e) => e.type === "phase-change")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 勝利報酬(経験値・ゴールド・ドロップ)
// ---------------------------------------------------------------------------

describe("勝利報酬", () => {
  it("勝利で経験値・ゴールドが入る(victoryイベント)", () => {
    let state = createBattle(lv(10), "mist-wolf", 5);
    const events: BattleEvent[] = [];
    let guard = 0;
    while (state.outcome === "ongoing" && guard < 20) {
      const res = resolveTurn(state, { kind: "attack" });
      events.push(...res.events);
      state = res.state;
      guard += 1;
    }
    const victory = events.find((e): e is Extract<BattleEvent, { type: "victory" }> => e.type === "victory");
    expect(victory).toBeDefined();
    expect(victory?.xpGained).toBe(4); // mist-wolf の固定経験値
    expect(victory?.goldGained).toBeGreaterThanOrEqual(3);
    expect(victory?.goldGained).toBeLessThanOrEqual(6);
    expect(state.player.gold).toBe(victory?.goldGained);
  });
});

// ---------------------------------------------------------------------------
// 決定論性(同一シード + 同一コマンド列 → 同一イベント列・同一最終状態)
// ---------------------------------------------------------------------------

describe("決定論性", () => {
  it("同一シード+同一コマンド列で完全再現する", () => {
    const commands: BattleCommand[] = [
      { kind: "skill", skillId: "ember-strike" },
      { kind: "attack" },
      { kind: "item", itemId: "potion-small" },
      { kind: "skill", skillId: "ember-strike" },
      { kind: "attack" }
    ];

    function run(): { events: BattleEvent[]; final: BattleState } {
      let state = createBattle(lv(5), "creaking-doll", 12345);
      const events: BattleEvent[] = [];
      for (const cmd of commands) {
        if (state.outcome !== "ongoing") break;
        const res = resolveTurn(state, cmd);
        events.push(...res.events);
        state = res.state;
      }
      return { events, final: state };
    }

    const a = run();
    const b = run();
    expect(a.events).toEqual(b.events);
    expect(a.final).toEqual(b.final);
  });

  it("元の state を破壊しない(不変更新)", () => {
    const state = createBattle(lv(5), "creaking-doll", 999);
    const snapshot = structuredClone(state);
    resolveTurn(state, { kind: "attack" });
    expect(state).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// createBattle の装備反映(M8-2。ダメージ式の構造は不変・装備なしは従来同値)
// ---------------------------------------------------------------------------

describe("createBattle(装備反映)", () => {
  it("装備省略時は従来どおり statsForLevel と同値(回帰。空装備を保持する)", () => {
    const base = statsForLevel(5);
    const state = createBattle(lv(5), "mist-wolf", 1);
    expect(state.player.attack).toBe(base.attack);
    expect(state.player.defense).toBe(base.defense);
    expect(state.player.maxHP).toBe(base.maxHP);
    expect(state.player.maxMP).toBe(base.maxMP);
    expect(state.player.speed).toBe(base.speed);
    expect(state.equipment).toEqual({ weapon: null, armor: null });
  });

  it("武器の atkBonus・防具の defBonus が attack/defense に乗る(maxHP 等は不変)", () => {
    const base = statsForLevel(5);
    const equipment: Equipment = { weapon: "amber-blade", armor: "warded-mail" };
    const state = createBattle(lv(5), "mist-wolf", 1, equipment);
    expect(state.player.attack).toBe(base.attack + 7); // amber-blade +7
    expect(state.player.defense).toBe(base.defense + 5); // warded-mail +5
    // maxHP/maxMP/speed は装備の影響を受けない
    expect(state.player.maxHP).toBe(base.maxHP);
    expect(state.player.maxMP).toBe(base.maxMP);
    expect(state.player.speed).toBe(base.speed);
    expect(state.equipment).toEqual(equipment);
  });

  it("レベルアップを跨いでも装備ボーナスが attack/defense に維持される", () => {
    const equipment: Equipment = { weapon: "amber-blade", armor: "warded-mail" };
    // Lv1 で次レベルまであと 1XP(必要8・現在7)。1体撃破(mist-wolf XP4)で必ず Lv2 へ上がる
    const progress: PlayerProgress = { level: 1, xp: 7, hp: 30, mp: 10, gold: 0 };
    let state = createBattle(progress, "mist-wolf", 1, equipment);
    let rounds = 0;
    while (state.outcome === "ongoing" && rounds < 20) {
      state = resolveTurn(state, { kind: "attack" }).state;
      rounds += 1;
    }
    expect(state.outcome).toBe("victory");
    expect(state.player.level).toBe(2);
    const base2 = statsForLevel(2);
    // レベルアップ後も装備込みの実効値(基礎値 + ボーナス)を保つ
    expect(state.player.attack).toBe(base2.attack + 7);
    expect(state.player.defense).toBe(base2.defense + 5);
    expect(state.player.maxHP).toBe(base2.maxHP); // 装備は maxHP に影響しない
  });
});
