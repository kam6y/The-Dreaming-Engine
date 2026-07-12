import { describe, expect, it } from "vitest";

import {
  advanceDay,
  createBattle,
  createNewGameState,
  DEFAULT_DIFFICULTY,
  DIFFICULTY_COEFFICIENTS,
  DIFFICULTY_DISPLAY_NAMES,
  DIFFICULTY_ORDER,
  difficultySchema,
  gameStateSchema,
  resolveTurn,
  statsForLevel
} from "../src/index.js";
import type { BattleEvent, BattleState, DifficultyId, Equipment, PlayerProgress } from "../src/index.js";

// ---------------------------------------------------------------------------
// 難易度設定(M25)。プレイヤー被ダメージ倍率のみを動かすランタイム乗算層。
// ふつう=恒等(combat-balance.test のバイト一致保存は combat-balance.test 自身が担保する)。
// ここでは方向性(easy<normal<hard)・恒等・最低1ダメージ・セーブ互換・持続・zod 拒否を確認する。
// ---------------------------------------------------------------------------

function lv(level: number, gold = 0): PlayerProgress {
  const s = statsForLevel(level);
  return { level, xp: 0, hp: s.maxHP, mp: s.maxMP, gold };
}

const NO_EQUIPMENT: Equipment = { weapon: null, armor: null };

/** 1ラウンド(attack)を解決し、プレイヤーが受けたダメージ量の並びを返す */
function playerDamageAmounts(events: BattleEvent[]): number[] {
  return events
    .filter((e): e is Extract<BattleEvent, { type: "damage" }> => e.type === "damage" && e.target === "player")
    .map((e) => e.amount);
}

/** 敵が受けたダメージ量の並びを返す(難易度非依存であることの確認用) */
function enemyDamageAmounts(events: BattleEvent[]): number[] {
  return events
    .filter((e): e is Extract<BattleEvent, { type: "damage" }> => e.type === "damage" && e.target === "enemy")
    .map((e) => e.amount);
}

/** 同一シード・同一装備で難易度だけ変えて1ラウンド解決し、最初のプレイヤー被弾量を返す */
function firstPlayerDamage(difficulty: DifficultyId, seed: number): number {
  // dream-eater(高攻撃)× Lv1(低防御)= 被ダメが十分大きく、easy<normal<hard が厳密に立つ
  const battle = createBattle(lv(1), "dream-eater", seed, NO_EQUIPMENT, difficulty);
  const { events } = resolveTurn(battle, { kind: "attack" });
  const amounts = playerDamageAmounts(events);
  expect(amounts.length).toBeGreaterThan(0);
  return amounts[0]!;
}

describe("難易度モジュール(定義)", () => {
  it("difficultySchema は easy/normal/hard を受理し、未知値を拒否する", () => {
    expect(difficultySchema.parse("easy")).toBe("easy");
    expect(difficultySchema.parse("normal")).toBe("normal");
    expect(difficultySchema.parse("hard")).toBe("hard");
    expect(difficultySchema.safeParse("insane").success).toBe(false);
    expect(difficultySchema.safeParse("").success).toBe(false);
    expect(difficultySchema.safeParse(1).success).toBe(false);
  });

  it("係数は 0.75 / 1.0(固定)/ 1.4。normal は厳密に 1.0(恒等元)", () => {
    expect(DIFFICULTY_COEFFICIENTS.easy).toBe(0.75);
    expect(DIFFICULTY_COEFFICIENTS.normal).toBe(1.0);
    expect(DIFFICULTY_COEFFICIENTS.hard).toBe(1.4);
    // easy < normal < hard(方向性の根拠)
    expect(DIFFICULTY_COEFFICIENTS.easy).toBeLessThan(DIFFICULTY_COEFFICIENTS.normal);
    expect(DIFFICULTY_COEFFICIENTS.normal).toBeLessThan(DIFFICULTY_COEFFICIENTS.hard);
  });

  it("表示名・並び・既定が仕様どおり", () => {
    expect(DIFFICULTY_DISPLAY_NAMES).toEqual({ easy: "やさしい", normal: "ふつう", hard: "むずかしい" });
    expect(DIFFICULTY_ORDER).toEqual(["easy", "normal", "hard"]);
    expect(DEFAULT_DIFFICULTY).toBe("normal");
  });
});

describe("createBattle(難易度→incomingDamageMultiplier)", () => {
  it("第5引数省略(3〜4引数呼び)は normal=1.0=恒等に解決される", () => {
    expect(createBattle(lv(3), "mist-wolf", 1).incomingDamageMultiplier).toBe(1.0);
    expect(createBattle(lv(3), "mist-wolf", 1, NO_EQUIPMENT).incomingDamageMultiplier).toBe(1.0);
  });

  it("難易度ごとに incomingDamageMultiplier を開始時へ固定する", () => {
    expect(createBattle(lv(3), "mist-wolf", 1, NO_EQUIPMENT, "easy").incomingDamageMultiplier).toBe(0.75);
    expect(createBattle(lv(3), "mist-wolf", 1, NO_EQUIPMENT, "normal").incomingDamageMultiplier).toBe(1.0);
    expect(createBattle(lv(3), "mist-wolf", 1, NO_EQUIPMENT, "hard").incomingDamageMultiplier).toBe(1.4);
  });

  it("省略(3引数)と明示 normal は完全一致(BattleState が同値=旧挙動の恒等)", () => {
    const omitted = createBattle(lv(5), "creaking-doll", 42);
    const explicit = createBattle(lv(5), "creaking-doll", 42, NO_EQUIPMENT, "normal");
    expect(omitted).toEqual(explicit);
  });
});

describe("被ダメージ倍率の適用(dealDamage のプレイヤー被弾のみ)", () => {
  it("同一シードで easy < normal < hard(被ダメの増減方向)", () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      const easy = firstPlayerDamage("easy", seed);
      const normal = firstPlayerDamage("normal", seed);
      const hard = firstPlayerDamage("hard", seed);
      // dream-eater × Lv1 は基準ダメが十分大きく、係数で厳密に増減する
      expect(easy).toBeLessThan(normal);
      expect(normal).toBeLessThan(hard);
      // 係数の適用式そのもの: max(1, floor(base × 係数))。base=normal(=恒等)を正とする
      expect(easy).toBe(Math.max(1, Math.floor(normal * 0.75)));
      expect(hard).toBe(Math.max(1, Math.floor(normal * 1.4)));
    }
  });

  it("normal は係数なし旧挙動と一致(同一シードで event 列・最終状態がバイト一致)", () => {
    const drive = (difficulty?: DifficultyId): { state: BattleState; events: BattleEvent[] } => {
      let state = difficulty
        ? createBattle(lv(6), "dream-eater", 7, NO_EQUIPMENT, difficulty)
        : createBattle(lv(6), "dream-eater", 7);
      const all: BattleEvent[] = [];
      for (let i = 0; i < 4 && state.outcome === "ongoing"; i += 1) {
        const res = resolveTurn(state, { kind: "attack" });
        state = res.state;
        all.push(...res.events);
      }
      return { state, events: all };
    };
    const baseline = drive(); // 係数なし旧挙動(第5引数省略)
    const normal = drive("normal");
    expect(normal.events).toEqual(baseline.events);
    expect(normal.state).toEqual(baseline.state);
  });

  it("敵の被ダメージ(与ダメージ)は難易度で変わらない(係数はプレイヤー被弾のみ)", () => {
    const enemyDmg = (difficulty: DifficultyId): number[] => {
      const battle = createBattle(lv(3), "creaking-doll", 5, NO_EQUIPMENT, difficulty);
      const { events } = resolveTurn(battle, { kind: "attack" });
      return enemyDamageAmounts(events);
    };
    const base = enemyDmg("normal");
    expect(base.length).toBeGreaterThan(0);
    expect(enemyDmg("easy")).toEqual(base);
    expect(enemyDmg("hard")).toEqual(base);
  });

  it("最低1ダメージ保証: 基準ダメ1のとき easy でも 1 を下回らない(floor→0 のクランプ)", () => {
    // Lv1 + 灯守りの帷子(防御+5)で実効防御10。mist-wolf strike(攻撃6)の基準ダメは常に1。
    // (floor(6×0.9)=5 〜 floor(6×1.099)=6、−floor(10/2)=5 → 0 or 1 → max(1,·)=1)
    const armored: Equipment = { weapon: null, armor: "warded-mail" };
    for (let seed = 1; seed <= 4; seed += 1) {
      const normalBattle = createBattle(lv(1), "mist-wolf", seed, armored, "normal");
      const normalDmg = playerDamageAmounts(resolveTurn(normalBattle, { kind: "attack" }).events);
      // この構成では基準ダメが 1(=クランプ域)であることを確認してから easy を見る
      expect(normalDmg[0]).toBe(1);

      const easyBattle = createBattle(lv(1), "mist-wolf", seed, armored, "easy");
      const easyDmg = playerDamageAmounts(resolveTurn(easyBattle, { kind: "attack" }).events);
      // floor(1 × 0.75)=0 だが max(1, 0)=1 で最低1ダメージを再保証する
      expect(easyDmg[0]).toBe(1);
    }
  });
});

describe("GameState.difficulty(セーブ互換・持続)", () => {
  it("新規ゲームは既定「ふつう」で始まる", () => {
    expect(createNewGameState().difficulty).toBe("normal");
  });

  it("旧セーブ(difficulty 欠落)は default で normal 補完(GAME_STATE_VERSION 据え置き)", () => {
    const full = createNewGameState();
    // difficulty を持たない旧形式のセーブ JSON(欠落を明示的に作る)
    const legacy: Record<string, unknown> = { ...full };
    delete legacy.difficulty;
    const result = gameStateSchema.safeParse(legacy);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.difficulty).toBe("normal");
      expect(result.data.version).toBe(full.version);
    }
  });

  it("難易度は日送り(advanceDay)で持続する(日次状態ではない)", () => {
    const easy = { ...createNewGameState(), difficulty: "hard" as const };
    expect(advanceDay(easy).difficulty).toBe("hard");
  });

  it("未知の難易度値は gameStateSchema が拒否する", () => {
    const full = createNewGameState();
    const result = gameStateSchema.safeParse({ ...full, difficulty: "insane" });
    expect(result.success).toBe(false);
  });
});
