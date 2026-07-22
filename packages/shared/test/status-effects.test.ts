import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  battleEventSchema,
  createBattle,
  DAZZLE_DURATION,
  DAZZLE_MISS_CHANCE,
  DREAD_DURATION,
  DREAD_SKIP_CHANCE,
  ENEMY_MOVES,
  POISON_DURATION,
  poisonTickDamage,
  resolveTurn,
  rngFromState,
  SKILLS,
  STATUS_DEFS,
  STATUS_DISPLAY_NAMES,
  statsForLevel,
  statusIdSchema
} from "../src/index.js";
import type { BattleEvent, BattleState, PlayerProgress, StatusState } from "../src/index.js";

function lv(level: number, gold = 0): PlayerProgress {
  const s = statsForLevel(level);
  return { level, xp: 0, hp: s.maxHP, mp: s.maxMP, gold };
}

/** 状態異常を戦闘員へ直接付与した状態を作る(M21-2 では敵move/スキルからの付与は未割当のため) */
function withPlayerStatuses(state: BattleState, statuses: StatusState[]): BattleState {
  return { ...state, player: { ...state.player, statuses } };
}

// ---------------------------------------------------------------------------
// 定義(status.ts): 眩惑・竦みの追加と一般形の維持
// ---------------------------------------------------------------------------

describe("状態異常の定義(眩惑・竦みの追加。M21)", () => {
  it("statusIdSchema は poison/dazzle/dread を受理し、未定義値を却下する", () => {
    for (const id of ["poison", "dazzle", "dread"]) {
      expect(statusIdSchema.safeParse(id).success).toBe(true);
    }
    expect(statusIdSchema.safeParse("burn").success).toBe(false);
    expect(statusIdSchema.safeParse("").success).toBe(false);
  });

  it("表示名は 毒/眩惑/竦み", () => {
    expect(STATUS_DISPLAY_NAMES).toEqual({ poison: "毒", dazzle: "眩惑", dread: "竦み" });
  });

  it("眩惑(dazzle): 継続2ラウンド・命中低下効果(accuracy 25%)・継続ダメージなし", () => {
    const def = STATUS_DEFS.dazzle;
    expect(def.duration).toBe(DAZZLE_DURATION);
    expect(DAZZLE_DURATION).toBe(2);
    expect(def.tickDamage(100)).toBe(0); // 継続ダメージなし
    expect(def.actionEffect).toBeDefined();
    expect(def.actionEffect?.kind).toBe("accuracy");
    if (def.actionEffect?.kind === "accuracy") {
      expect(def.actionEffect.missChance).toBe(DAZZLE_MISS_CHANCE);
      expect(DAZZLE_MISS_CHANCE).toBe(0.25);
      expect(def.actionEffect.missMessage("旅人").length).toBeGreaterThan(0);
    }
  });

  it("竦み(dread): 継続2ラウンド・行動不能効果(skip 30%)・継続ダメージなし", () => {
    const def = STATUS_DEFS.dread;
    expect(def.duration).toBe(DREAD_DURATION);
    expect(DREAD_DURATION).toBe(2);
    expect(def.tickDamage(100)).toBe(0);
    expect(def.actionEffect?.kind).toBe("skip");
    if (def.actionEffect?.kind === "skip") {
      expect(def.actionEffect.skipChance).toBe(DREAD_SKIP_CHANCE);
      expect(DREAD_SKIP_CHANCE).toBe(0.3);
      expect(def.actionEffect.skipMessage("旅人").length).toBeGreaterThan(0);
    }
  });

  it("毒(poison)の仕様は不変: 継続3・毎tick最大HP5%・行動時効果なし", () => {
    const def = STATUS_DEFS.poison;
    expect(def.duration).toBe(POISON_DURATION);
    expect(POISON_DURATION).toBe(3);
    expect(def.tickDamage(100)).toBe(poisonTickDamage(100));
    expect(def.tickDamage(100)).toBe(5);
    expect(def.actionEffect).toBeUndefined(); // 毒は行動へ干渉しない
  });
});

// ---------------------------------------------------------------------------
// 付与確率フィールド(既定1.0=既存不変。M21)
// ---------------------------------------------------------------------------

describe("付与確率フィールド(既定1.0。M21)", () => {
  it("既存の毒付与技/スキルは inflictChance 未指定(=1.0扱い=ロールなし)", () => {
    // 既存の付与技は inflictChance を持たない → battle.ts は付与ロールをせず必ず付与する
    expect(ENEMY_MOVES["poison-bite"].inflictChance).toBeUndefined();
    expect(ENEMY_MOVES["nightmare-spew"].inflictChance).toBeUndefined();
    const murk = SKILLS["murk-cleave"];
    expect(murk.kind).toBe("attack");
    if (murk.kind === "attack") {
      expect(murk.inflicts).toBe("poison");
      expect(murk.inflictChance).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// RNG列不変(不活性=既存挙動バイト一致。M21 最重要制約)
//  参照 Rng を手で刻んで、resolveTurn 後の rngState と厳密一致することで
//  「新状態異常が絡まない戦闘は乱数を1つも余分に消費しない」を担保する。
// ---------------------------------------------------------------------------

describe("RNG列不変: 状態異常が絡まない戦闘は乱数消費が一切増えない", () => {
  // Lv5(素早さ11) vs 軋み人形(素早さ6)。素早さが異なるため turnOrder は乱数を引かない。
  // プレイヤー先手→たたかう(命中判定は付与なしでロールなし・ダメージ variance で1消費)、
  // 敵 strike(同様に1消費)。どちらも一撃では倒れない。合計2消費。
  const EXPECTED_DRAWS = 2;

  function stepRef(initial: number, draws: number): number {
    const ref = rngFromState(initial);
    for (let i = 0; i < draws; i += 1) ref.next();
    return ref.state();
  }

  it("状態異常なし: rngState は参照Rngをちょうど2回進めた値と一致する", () => {
    const state = createBattle(lv(5), "creaking-doll", 1);
    const init = state.rngState;
    const res = resolveTurn(state, { kind: "attack" });
    expect(res.state.turn).toBe(1);
    expect(res.state.enemy.hp).toBeGreaterThan(0); // 一撃では倒れない(勝利報酬の乱数を引かない)
    expect(res.state.player.hp).toBeGreaterThan(0);
    expect(res.state.rngState).toBe(stepRef(init, EXPECTED_DRAWS));
    // 新イベントは一切出ない
    expect(res.events.some((e) => e.type === "attack-missed" || e.type === "action-skipped")).toBe(false);
  });

  it("毒付与済み(既存状態)でも乱数消費は増えない(毒tickは乱数を引かない)", () => {
    const base = createBattle(lv(5), "creaking-doll", 1);
    const state = withPlayerStatuses(base, [{ id: "poison", remainingTurns: 3 }]);
    const init = state.rngState;
    const res = resolveTurn(state, { kind: "attack" });
    // 毒tickでプレイヤーHPが追加で減っている(=毒は生きている)が、乱数列は状態異常なしと同一
    const tick = res.events.find(
      (e): e is Extract<BattleEvent, { type: "status-tick" }> => e.type === "status-tick" && e.target === "player"
    );
    expect(tick?.status).toBe("poison");
    expect(res.state.rngState).toBe(stepRef(init, EXPECTED_DRAWS));
    expect(res.events.some((e) => e.type === "attack-missed" || e.type === "action-skipped")).toBe(false);
  });

  it("通常戦闘(Lv1 vs 霧狼)の全経過で新状態異常イベントは一切現れない", () => {
    let state = createBattle(lv(1), "mist-wolf", 7);
    const events: BattleEvent[] = [];
    let guard = 0;
    while (state.outcome === "ongoing" && guard < 30) {
      const res = resolveTurn(state, { kind: "attack" });
      events.push(...res.events);
      state = res.state;
      guard += 1;
    }
    expect(state.outcome).toBe("victory");
    expect(events.some((e) => e.type === "attack-missed" || e.type === "action-skipped")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 眩惑(dazzle): 空振り(命中低下)
//  M21-2 では付与元の技が無いため、状態を直接付与してから挙動を観測する(付与元はM21-3)。
//  乱数の当たり外れは制御できないため、多シードで空振り/命中の双方を引き当てて検証する。
// ---------------------------------------------------------------------------

describe("眩惑(dazzle): 攻撃の空振り", () => {
  it("たたかうが空振りしうる: 空振り時はダメージ0(敵HP不変)・action は出るが敵へのdamageは無い", () => {
    let missSeen = false;
    let hitSeen = false;
    for (let seed = 1; seed <= 60 && !(missSeen && hitSeen); seed += 1) {
      const base = createBattle(lv(5), "creaking-doll", seed);
      const state = withPlayerStatuses(base, [{ id: "dazzle", remainingTurns: 2 }]);
      const enemyHp0 = state.enemy.maxHP;
      const res = resolveTurn(state, { kind: "attack" });
      const missed = res.events.some((e) => e.type === "attack-missed" && e.actor === "player");
      const dealt = res.events.some((e) => e.type === "damage" && e.target === "enemy");
      // プレイヤーは行動している(眩惑は行動不能ではない)
      expect(res.events.some((e) => e.type === "action" && e.actor === "player")).toBe(true);
      if (missed) {
        missSeen = true;
        expect(dealt).toBe(false); // 空振り=敵へダメージなし
        expect(res.state.enemy.hp).toBe(enemyHp0); // 敵HP不変
      } else {
        hitSeen = true;
        expect(dealt).toBe(true);
        expect(res.state.enemy.hp).toBeLessThan(enemyHp0);
      }
    }
    expect(missSeen).toBe(true);
    expect(hitSeen).toBe(true);
  });

  it("スキル攻撃(murk-cleave)が空振りすると付随の毒も付与されない(付随状態異常も不発)", () => {
    let checked = false;
    for (let seed = 1; seed <= 80 && !checked; seed += 1) {
      // Lv3 で murk-cleave 習得済み・MP十分。creaking-doll は一撃で倒れない。
      const base = createBattle(lv(3), "creaking-doll", seed);
      const state = withPlayerStatuses(base, [{ id: "dazzle", remainingTurns: 2 }]);
      const enemyHp0 = state.enemy.maxHP;
      const res = resolveTurn(state, { kind: "skill", skillId: "murk-cleave" });
      if (res.events.some((e) => e.type === "attack-missed" && e.actor === "player")) {
        checked = true;
        // 空振り: 敵へダメージなし・敵へ毒付与なし
        expect(res.state.enemy.hp).toBe(enemyHp0);
        expect(res.events.some((e) => e.type === "status-inflicted" && e.target === "enemy")).toBe(false);
        expect(res.state.enemy.statuses.some((s) => s.id === "poison")).toBe(false);
        // MPは消費済み(空振りでも術は放っている)
        expect(res.state.player.mp).toBe(state.player.mp - SKILLS["murk-cleave"].mpCost);
      }
    }
    expect(checked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 竦み(dread): 行動不能
// ---------------------------------------------------------------------------

describe("竦み(dread): 行動不能", () => {
  it("行動不能時: 選択スキルが不発(MP消費なし・敵HP不変)、action-skipped が出る", () => {
    let skipSeen = false;
    for (let seed = 1; seed <= 60 && !skipSeen; seed += 1) {
      const base = createBattle(lv(5), "creaking-doll", seed);
      const state = withPlayerStatuses(base, [{ id: "dread", remainingTurns: 2 }]);
      const mp0 = state.player.mp;
      const enemyHp0 = state.enemy.maxHP;
      const res = resolveTurn(state, { kind: "skill", skillId: "ember-strike" });
      if (res.events.some((e) => e.type === "action-skipped" && e.actor === "player")) {
        skipSeen = true;
        // プレイヤーの選択コマンドは不発(MP消費なし・敵は無傷)
        expect(res.state.player.mp).toBe(mp0);
        expect(res.state.enemy.hp).toBe(enemyHp0);
        // プレイヤーの行動(action)は出ない(不発)
        expect(res.events.some((e) => e.type === "action" && e.actor === "player")).toBe(false);
      }
    }
    expect(skipSeen).toBe(true);
  });

  it("行動不能でないラウンドは通常どおり行動する(MP消費・敵へダメージ)", () => {
    let actedSeen = false;
    for (let seed = 1; seed <= 60 && !actedSeen; seed += 1) {
      const base = createBattle(lv(5), "creaking-doll", seed);
      const state = withPlayerStatuses(base, [{ id: "dread", remainingTurns: 2 }]);
      const mp0 = state.player.mp;
      const res = resolveTurn(state, { kind: "skill", skillId: "ember-strike" });
      if (!res.events.some((e) => e.type === "action-skipped" && e.actor === "player")) {
        actedSeen = true;
        expect(res.events.some((e) => e.type === "action" && e.actor === "player")).toBe(true);
        expect(res.state.player.mp).toBe(mp0 - SKILLS["ember-strike"].mpCost);
        expect(res.events.some((e) => e.type === "damage" && e.target === "enemy")).toBe(true);
      }
    }
    expect(actedSeen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 持続・失効(眩惑・竦み。毒と同じ流儀=ラウンド終端に残ターン-1・0で失効)
// ---------------------------------------------------------------------------

describe("持続・失効(眩惑・竦み)", () => {
  function runRound(state: BattleState): { state: BattleState; events: BattleEvent[] } {
    const res = resolveTurn(state, { kind: "attack" });
    return { state: res.state, events: res.events };
  }

  it("眩惑は2ラウンドで失効する(残2→1→0/status-expired)", () => {
    // Lv6 vs 夢喰い(HP150・ボス)。2ラウンドでは決着せず、序盤2手は毒を伴わない(gear-grind→devour)
    const base = createBattle(lv(6), "dream-eater", 1);
    let state = withPlayerStatuses(base, [{ id: "dazzle", remainingTurns: DAZZLE_DURATION }]);

    let r = runRound(state);
    state = r.state;
    // 1ラウンド目終端: 残2→1(まだ失効しない)
    expect(state.player.statuses.find((s) => s.id === "dazzle")?.remainingTurns).toBe(1);
    expect(r.events.some((e) => e.type === "status-expired" && e.status === "dazzle")).toBe(false);

    r = runRound(state);
    state = r.state;
    // 2ラウンド目終端: 残1→0で失効
    expect(r.events.some((e) => e.type === "status-expired" && e.status === "dazzle")).toBe(true);
    expect(state.player.statuses.some((s) => s.id === "dazzle")).toBe(false);
  });

  it("竦みは2ラウンドで失効する(行動不能で行動を失っても持続は減る)", () => {
    const base = createBattle(lv(6), "dream-eater", 1);
    let state = withPlayerStatuses(base, [{ id: "dread", remainingTurns: DREAD_DURATION }]);

    let r = runRound(state);
    state = r.state;
    expect(state.player.statuses.find((s) => s.id === "dread")?.remainingTurns).toBe(1);
    expect(r.events.some((e) => e.type === "status-expired" && e.status === "dread")).toBe(false);

    r = runRound(state);
    state = r.state;
    expect(r.events.some((e) => e.type === "status-expired" && e.status === "dread")).toBe(true);
    expect(state.player.statuses.some((s) => s.id === "dread")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 上書き(重複規則): 再付与は残ターンを定義値へリセット・スタックしない。
//  付与・上書きは全状態異常で共通の inflictStatus 経由。M21-2 で唯一エンジンから
//  付与可能な毒(murk-cleave)で汎用機構を検証する(眩惑/竦みは同一コードを共有)。
// ---------------------------------------------------------------------------

describe("上書き(重複規則): 再付与は残ターンを定義値へリセット・スタックしない", () => {
  it("毒の再付与は remainingTurns を定義値へ戻し、複数エントリを作らない", () => {
    // Lv3 murk-cleave を2連続。creaking-doll は2発では倒れない。
    let state = createBattle(lv(3), "creaking-doll", 1);
    let res = resolveTurn(state, { kind: "skill", skillId: "murk-cleave" });
    state = res.state;
    // 付与3→終端tickで2
    const after1 = state.enemy.statuses.filter((s) => s.id === "poison");
    expect(after1).toHaveLength(1);
    expect(after1[0]?.remainingTurns).toBe(POISON_DURATION - 1);

    res = resolveTurn(state, { kind: "skill", skillId: "murk-cleave" });
    state = res.state;
    // 再付与で3へリセット→終端tickで2。エントリは依然1つ(スタックしない)
    const after2 = state.enemy.statuses.filter((s) => s.id === "poison");
    expect(after2).toHaveLength(1);
    expect(after2[0]?.remainingTurns).toBe(POISON_DURATION - 1);
    expect(state.enemy.hp).toBeGreaterThan(0);
  });

  it("眩惑・竦みも同じ duration へリセットする定義(汎用 inflictStatus が参照する値)", () => {
    // 上書き機構は状態異常非依存(inflictStatus は def.duration へリセットする)。
    // 新2種がその機構へ正しく差さることを duration 定義で担保する。
    expect(STATUS_DEFS.dazzle.duration).toBe(DAZZLE_DURATION);
    expect(STATUS_DEFS.dread.duration).toBe(DREAD_DURATION);
  });
});

// ---------------------------------------------------------------------------
// BattleEvent 型 ⟷ zod スキーマの整合(新イベント: attack-missed / action-skipped)
// ---------------------------------------------------------------------------

describe("BattleEvent と battleEventSchema の整合(新イベント。M21)", () => {
  // 手書き union の全変種を1件ずつ構築(型注釈で「型→スキーマ」の前方向を保証)。
  const samples: BattleEvent[] = [
    { type: "action", actor: "player", actionKind: "skill", actionName: "焔の一閃", mpCost: 4, message: "m" },
    { type: "action", actor: "enemy", actionKind: "attack", actionName: "strike", message: "m" },
    { type: "item-used", itemId: "potion-small", itemName: "回復薬(小)", message: "m" },
    { type: "damage", target: "enemy", amount: 5, remainingHp: 10, message: "m" },
    { type: "heal", target: "player", hpRestored: 5, remainingHp: 30, message: "m" },
    { type: "status-inflicted", target: "player", status: "poison", message: "m" },
    { type: "status-tick", target: "player", status: "poison", amount: 3, remainingHp: 27, message: "m" },
    { type: "status-cured", target: "player", status: "poison", message: "m" },
    { type: "status-expired", target: "player", status: "dazzle", message: "m" },
    { type: "attack-missed", actor: "player", status: "dazzle", message: "m" },
    { type: "action-skipped", actor: "enemy", status: "dread", message: "m" },
    { type: "buff-applied", target: "player", buff: "defense", amount: 8, remainingTurns: 3, message: "m" },
    { type: "buff-expired", target: "player", buff: "defense", message: "m" },
    { type: "phase-change", enemyId: "dream-eater", phaseIndex: 1, message: "m" },
    { type: "flee", success: true, message: "m" },
    { type: "victory", xpGained: 4, goldGained: 5, drops: [], message: "m" },
    { type: "level-up", fromLevel: 1, toLevel: 2, message: "m" },
    { type: "defeat", message: "m" },
    { type: "command-rejected", reason: "not-enough-mp", message: "m" }
  ];

  it("手書き BattleEvent の全変種が battleEventSchema を通り、往復で一致する(型→スキーマ)", () => {
    for (const ev of samples) {
      const parsed = battleEventSchema.parse(ev);
      expect(parsed).toEqual(ev);
    }
  });

  it("新イベント(attack-missed/action-skipped)はスキーマ出力を手書き型へ代入できる(スキーマ→型)", () => {
    const missed = battleEventSchema.parse({ type: "attack-missed", actor: "player", status: "dazzle", message: "m" });
    const skipped = battleEventSchema.parse({ type: "action-skipped", actor: "enemy", status: "dread", message: "m" });
    // narrow して手書き Extract 型へ代入(コンパイル時に双方向整合を担保。必須フィールドのみで mpCost 系の曖昧さを回避)
    if (missed.type === "attack-missed") {
      const back: Extract<BattleEvent, { type: "attack-missed" }> = missed;
      expect(back.status).toBe("dazzle");
    }
    if (skipped.type === "action-skipped") {
      const back: Extract<BattleEvent, { type: "action-skipped" }> = skipped;
      expect(back.status).toBe("dread");
    }
  });

  it("新イベントの必須フィールド欠落・不正値を却下する", () => {
    // actor 欠落
    expect(battleEventSchema.safeParse({ type: "attack-missed", status: "dazzle", message: "m" }).success).toBe(false);
    // status 欠落
    expect(battleEventSchema.safeParse({ type: "action-skipped", actor: "player", message: "m" }).success).toBe(false);
    // 不正な actor / status
    expect(
      battleEventSchema.safeParse({ type: "attack-missed", actor: "monster", status: "dazzle", message: "m" }).success
    ).toBe(false);
    expect(
      battleEventSchema.safeParse({ type: "action-skipped", actor: "player", status: "sleep", message: "m" }).success
    ).toBe(false);
  });

  // z.infer と手書き型の全体一致を軽く確認(discriminated union のキー集合)
  it("battleEventSchema の type 集合が手書き BattleEvent の type 集合と一致する", () => {
    type SchemaEvent = z.infer<typeof battleEventSchema>;
    const schemaTypes = new Set(battleEventSchema.options.map((o) => o.shape.type.value));
    const handTypes = new Set(samples.map((e) => e.type));
    expect(schemaTypes).toEqual(handTypes);
    // SchemaEvent を参照して未使用 import を避けつつ型の存在を明示
    const _witness: SchemaEvent["type"] = "attack-missed";
    expect(schemaTypes.has(_witness)).toBe(true);
  });
});
