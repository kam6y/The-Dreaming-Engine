import { describe, expect, it } from "vitest";

import {
  battleItemToConsume,
  clampResistance,
  createBattle,
  DAZZLE_DURATION,
  DREAD_DURATION,
  effectiveInflictChance,
  effectiveStatusResistances,
  ENEMY_MOVES,
  POISON_DURATION,
  resolveTurn,
  rngFromState
} from "../src/index.js";
import type { BattleCommand, BattleEvent, BattleState, Equipment, PlayerProgress, StatusState } from "../src/index.js";
import { statsForLevel } from "../src/index.js";

function lv(level: number, gold = 0): PlayerProgress {
  const s = statsForLevel(level);
  return { level, xp: 0, hp: s.maxHP, mp: s.maxMP, gold };
}

/** プレイヤーへ直接状態異常を付与した状態を作る(付与元の技を介さず挙動を観測する) */
function withPlayerStatuses(state: BattleState, statuses: StatusState[]): BattleState {
  return { ...state, player: { ...state.player, statuses } };
}

/** 敵の次の行動が指定インデックスの技になるようローテーション位置を仕込む */
function withEnemyRotationStep(state: BattleState, step: number): BattleState {
  return { ...state, enemy: { ...state.enemy, rotationStep: step } };
}

const ARMOR_WARDING: Equipment = { weapon: null, armor: "warded-mail" };

// ---------------------------------------------------------------------------
// 実効付与確率・クランプ(耐性の数式。M21-3)
// ---------------------------------------------------------------------------

describe("実効付与確率 = 付与確率 ×(1 − 耐性)(M21-3)", () => {
  it("耐性0で付与確率そのまま・0.5で半減・1.0で0", () => {
    expect(effectiveInflictChance(1.0, 0)).toBe(1.0);
    expect(effectiveInflictChance(1.0, 0.5)).toBe(0.5);
    expect(effectiveInflictChance(0.5, 0.5)).toBe(0.25);
    expect(effectiveInflictChance(1.0, 1.0)).toBe(0);
    expect(effectiveInflictChance(0.4, 0.25)).toBeCloseTo(0.3, 10);
  });

  it("耐性は 0..1 にクランプされる(範囲外の定義値でも安全)", () => {
    expect(clampResistance(-0.5)).toBe(0);
    expect(clampResistance(0.3)).toBe(0.3);
    expect(clampResistance(1.4)).toBe(1);
    // クランプ経由でも実効は 0..付与確率 に収まる
    expect(effectiveInflictChance(1.0, 1.4)).toBe(0);
    expect(effectiveInflictChance(1.0, -0.5)).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// 耐性の由来(プレイヤー=装備 / 敵=敵定義)
// ---------------------------------------------------------------------------

describe("耐性の由来(M21-3)", () => {
  it("プレイヤー耐性は装備由来: 灯守りの帷子で 眩惑/竦み 0.5・空装備は耐性なし", () => {
    expect(effectiveStatusResistances(ARMOR_WARDING)).toEqual({ dazzle: 0.5, dread: 0.5 });
    expect(effectiveStatusResistances({ weapon: null, armor: null })).toEqual({});
    // 毒へは耐性を持たせない(既存の毒挙動を保存)
    expect(effectiveStatusResistances(ARMOR_WARDING).poison ?? 0).toBe(0);
  });

  it("createBattle はプレイヤー耐性を装備から導出する(空装備は空=従来と同一挙動)", () => {
    const equipped = createBattle(lv(6), "mist-wolf", 1, ARMOR_WARDING);
    expect(equipped.player.resistances).toEqual({ dazzle: 0.5, dread: 0.5 });
    const empty = createBattle(lv(6), "mist-wolf", 1);
    expect(empty.player.resistances).toEqual({});
  });

  it("敵耐性は敵定義由来: 蝋燭喰らい=眩惑0.5 / 軋み人形=竦み0.5 / 耐性なしの敵は空", () => {
    expect(createBattle(lv(6), "candle-eater", 1).enemy.resistances).toEqual({ dazzle: 0.5 });
    expect(createBattle(lv(6), "creaking-doll", 1).enemy.resistances).toEqual({ dread: 0.5 });
    expect(createBattle(lv(6), "mist-wolf", 1).enemy.resistances).toEqual({});
    expect(createBattle(lv(6), "dream-eater", 1).enemy.resistances).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 新move(眩惑=蝋燭喰らい / 竦み=軋み人形)の behavioral な付与・上書き
// ---------------------------------------------------------------------------

describe("新move: 蝋燭喰らいの眩惑move(guttering-glare。M21-3)", () => {
  it("付与確率<1(0.5)で、命中時に眩惑を付与しうる(付与・非付与の双方が起こる)", () => {
    expect(ENEMY_MOVES["guttering-glare"].inflicts).toBe("dazzle");
    expect(ENEMY_MOVES["guttering-glare"].inflictChance).toBe(0.5);
    let inflicted = false;
    let notInflicted = false;
    for (let seed = 1; seed <= 80 && !(inflicted && notInflicted); seed += 1) {
      // Lv6(眩惑move=2手目)。プレイヤーは眩惑耐性なし(空装備)。1手目 strike を飛ばして眩惑moveを撃たせる。
      const base = createBattle(lv(6), "candle-eater", seed);
      const state = withEnemyRotationStep(base, 1); // 次の敵行動 = guttering-glare
      const res = resolveTurn(state, { kind: "attack" });
      const got = res.events.some((e) => e.type === "status-inflicted" && e.target === "player" && e.status === "dazzle");
      if (got) {
        inflicted = true;
        expect(res.state.player.statuses.some((s) => s.id === "dazzle")).toBe(true);
      } else {
        notInflicted = true;
        expect(res.state.player.statuses.some((s) => s.id === "dazzle")).toBe(false);
      }
    }
    expect(inflicted).toBe(true);
    expect(notInflicted).toBe(true);
  });

  it("上書き: 既に眩惑中のプレイヤーへ再付与すると残ターンを定義値へ戻し、スタックしない", () => {
    let checked = false;
    for (let seed = 1; seed <= 120 && !checked; seed += 1) {
      // 残1の眩惑を持つプレイヤーへ再付与 → リセット2 → ラウンド終端tickで1(失効しない=上書きされた証拠)
      const base = createBattle(lv(6), "candle-eater", seed);
      const state = withPlayerStatuses(withEnemyRotationStep(base, 1), [{ id: "dazzle", remainingTurns: 1 }]);
      const res = resolveTurn(state, { kind: "attack" });
      const reinflicted = res.events.some(
        (e) => e.type === "status-inflicted" && e.target === "player" && e.status === "dazzle"
      );
      if (reinflicted) {
        checked = true;
        const dazzle = res.state.player.statuses.filter((s) => s.id === "dazzle");
        expect(dazzle).toHaveLength(1); // スタックしない
        expect(dazzle[0]?.remainingTurns).toBe(DAZZLE_DURATION - 1); // 定義値へリセット後、tickで-1
      }
    }
    expect(checked).toBe(true);
  });
});

describe("新move: 軋み人形の竦みmove(creaking-dread。M21-3)", () => {
  it("付与確率<1(0.4)で、命中時に竦みを付与しうる(既存の毒付与技は併存)", () => {
    expect(ENEMY_MOVES["creaking-dread"].inflicts).toBe("dread");
    expect(ENEMY_MOVES["creaking-dread"].inflictChance).toBe(0.4);
    // 既存の毒付与技(poison-bite)がローテーションに併存していること(仕様: 併存)
    expect(createBattle(lv(6), "creaking-doll", 1).enemy.resistances.dread).toBe(0.5);
    let inflicted = false;
    let notInflicted = false;
    for (let seed = 1; seed <= 120 && !(inflicted && notInflicted); seed += 1) {
      const base = createBattle(lv(7), "creaking-doll", seed);
      const state = withEnemyRotationStep(base, 2); // 次の敵行動 = creaking-dread(rotation[2])
      const res = resolveTurn(state, { kind: "attack" });
      const got = res.events.some((e) => e.type === "status-inflicted" && e.target === "player" && e.status === "dread");
      if (got) {
        inflicted = true;
        expect(res.state.player.statuses.some((s) => s.id === "dread")).toBe(true);
      } else {
        notInflicted = true;
      }
    }
    expect(inflicted).toBe(true);
    expect(notInflicted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 装備由来のプレイヤー耐性が付与率を下げる(behavioral・統計)
// ---------------------------------------------------------------------------

describe("装備由来の耐性は被付与を減らす(M21-3)", () => {
  it("灯守りの帷子(眩惑0.5)を装備すると、蝋燭喰らいの眩惑の付与回数が明確に減る", () => {
    const SEEDS = Array.from({ length: 240 }, (_, i) => i + 1);
    const countDazzle = (equipment?: Equipment): number => {
      let n = 0;
      for (const seed of SEEDS) {
        const base = createBattle(lv(8), "candle-eater", seed, equipment);
        const state = withEnemyRotationStep(base, 1); // guttering-glare を撃たせる
        const res = resolveTurn(state, { kind: "attack" });
        if (res.events.some((e) => e.type === "status-inflicted" && e.target === "player" && e.status === "dazzle")) {
          n += 1;
        }
      }
      return n;
    };
    const withoutArmor = countDazzle();
    const withArmor = countDazzle(ARMOR_WARDING);
    // 耐性0.5なので実効付与率は概ね半分。耐性なしは確実に付与が起きる。
    expect(withoutArmor).toBeGreaterThan(0);
    expect(withArmor).toBeLessThan(withoutArmor);
  });
});

// ---------------------------------------------------------------------------
// 解除アイテム(灯明=warding-light。眩惑・竦みを鎮める。毒には効かない)
// ---------------------------------------------------------------------------

describe("解除アイテム: 灯明(warding-light。M21-3)", () => {
  it("眩惑・竦みの双方を鎮める(両方付与→両方 status-cured→状態消失)", () => {
    const base = createBattle(lv(6), "mist-wolf", 1); // 弱敵・プレイヤー先手で安全に観測
    const state = withPlayerStatuses(base, [
      { id: "dazzle", remainingTurns: DAZZLE_DURATION },
      { id: "dread", remainingTurns: DREAD_DURATION }
    ]);
    const res = resolveTurn(state, { kind: "item", itemId: "warding-light" });
    expect(res.events.some((e) => e.type === "item-used" && e.itemId === "warding-light")).toBe(true);
    const cured = res.events.filter((e): e is Extract<BattleEvent, { type: "status-cured" }> => e.type === "status-cured");
    expect(cured.map((e) => e.status).sort()).toEqual(["dazzle", "dread"]);
    expect(res.state.player.statuses.some((s) => s.id === "dazzle" || s.id === "dread")).toBe(false);
  });

  it("毒は鎮めない(眩惑+毒→眩惑のみ解除・毒は残る)。解毒薬の役割は不変", () => {
    const base = createBattle(lv(6), "mist-wolf", 1);
    const state = withPlayerStatuses(base, [
      { id: "poison", remainingTurns: POISON_DURATION },
      { id: "dazzle", remainingTurns: DAZZLE_DURATION }
    ]);
    const res = resolveTurn(state, { kind: "item", itemId: "warding-light" });
    // 眩惑は解除、毒は残る(灯明の statuses に poison は含まれない)
    expect(res.state.player.statuses.some((s) => s.id === "dazzle")).toBe(false);
    expect(res.state.player.statuses.some((s) => s.id === "poison")).toBe(true);
  });

  it("該当状態が無ければ「巣食っていなかった」旨を出す(単一治療と同じ流儀・状態は増えない)", () => {
    const base = createBattle(lv(6), "mist-wolf", 1);
    const res = resolveTurn(base, { kind: "item", itemId: "warding-light" });
    const cured = res.events.filter((e): e is Extract<BattleEvent, { type: "status-cured" }> => e.type === "status-cured");
    // 眩惑・竦みの2件が「非付与」で出る(status-cured を各kind 1件ずつ)
    expect(cured.map((e) => e.status).sort()).toEqual(["dazzle", "dread"]);
    expect(res.state.player.statuses).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// RNG列不変(既存の毒付与=付与確率1.0・耐性0 は乱数を引かない=combat-balance保存の要)
// ---------------------------------------------------------------------------

describe("RNG列不変: 既存の毒付与(chance1・耐性0)は乱数を引かない(M21-3)", () => {
  function stepRef(initial: number, draws: number): number {
    const ref = rngFromState(initial);
    for (let i = 0; i < draws; i += 1) ref.next();
    return ref.state();
  }

  it("敵の毒付与技(poison-bite)命中でも付与ロールをせず、rngStateはダメージ2回分だけ進む", () => {
    // Lv5(素早さ11)vs 軋み人形(素早さ6)=プレイヤー先手(turnOrderは乱数を引かない)。
    // 敵の次行動を poison-bite(rotation[1])へ。プレイヤーたたかう(命中判定なし・variance1消費)、
    // 敵 poison-bite(damage variance1消費 + 毒付与=chance1・耐性0で実効1→ロールなし)。合計2消費。
    const base = createBattle(lv(5), "creaking-doll", 3);
    const state = withEnemyRotationStep(base, 1);
    const init = state.rngState;
    const res = resolveTurn(state, { kind: "attack" });
    expect(res.state.enemy.hp).toBeGreaterThan(0); // 一撃では倒れない(勝利報酬の乱数を引かない)
    expect(res.state.player.hp).toBeGreaterThan(0);
    expect(res.state.player.statuses.some((s) => s.id === "poison")).toBe(true); // 毒は付与されている
    expect(res.state.rngState).toBe(stepRef(init, 2)); // 付与ロール分の乱数は増えていない
    expect(res.events.some((e) => e.type === "attack-missed" || e.type === "action-skipped")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// どうぐ×竦みの層跨ぎ(エンジン契約。JOURNAL[71]申し送り(1))
//  竦みで行動不能=不発のとき、エンジンは applyItem を呼ばない(item-used を出さない)。
//  この「item-used の有無」をサーバー(session.ts)が消費の信号に使う。
// ---------------------------------------------------------------------------

describe("どうぐ×竦み: 行動不能のときエンジンはアイテムを使わない(M21-3)", () => {
  it("行動不能ラウンドは item-used なし・アイテム効果なし / 行動できたラウンドは item-used あり", () => {
    let skipSeen = false;
    let usedSeen = false;
    for (let seed = 1; seed <= 80 && !(skipSeen && usedSeen); seed += 1) {
      // 竦み中のプレイヤーが回復薬(小)を使う。HPを削っておき、使えば回復するようにする。
      const base = createBattle(lv(5), "creaking-doll", seed);
      const wounded: BattleState = { ...base, player: { ...base.player, hp: 1 } };
      const state = withPlayerStatuses(wounded, [{ id: "dread", remainingTurns: 2 }]);
      const res = resolveTurn(state, { kind: "item", itemId: "potion-small" });
      const skipped = res.events.some((e) => e.type === "action-skipped" && e.actor === "player");
      const used = res.events.some((e) => e.type === "item-used" && e.itemId === "potion-small");
      if (skipped) {
        skipSeen = true;
        // 行動不能=不発: item-used が出ない・回復も起きない(HPは敵行動での被弾以外に増えない)
        expect(used).toBe(false);
        expect(res.events.some((e) => e.type === "heal" && e.target === "player")).toBe(false);
        // battleItemToConsume も null(サーバーは減算しない)
        expect(battleItemToConsume({ kind: "item", itemId: "potion-small" }, res.events)).toBeNull();
      } else {
        usedSeen = true;
        expect(used).toBe(true);
        expect(battleItemToConsume({ kind: "item", itemId: "potion-small" }, res.events)).toBe("potion-small");
      }
    }
    expect(skipSeen).toBe(true);
    expect(usedSeen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// サーバー減算ガード判定(battleItemToConsume。どうぐが実際に使われたときだけ消費)
// ---------------------------------------------------------------------------

describe("battleItemToConsume: どうぐ消費のサーバー減算ガード判定(M21-3)", () => {
  const itemCmd: BattleCommand = { kind: "item", itemId: "potion-small" };

  it("item-used(該当ID)があれば消費対象のIDを返す", () => {
    const events: BattleEvent[] = [
      { type: "item-used", itemId: "potion-small", itemName: "回復薬(小)", message: "m" },
      { type: "heal", target: "player", hpRestored: 30, remainingHp: 30, message: "m" }
    ];
    expect(battleItemToConsume(itemCmd, events)).toBe("potion-small");
  });

  it("竦みで行動不能(action-skipped・item-usedなし)なら消費しない(null)", () => {
    const events: BattleEvent[] = [{ type: "action-skipped", actor: "player", status: "dread", message: "m" }];
    expect(battleItemToConsume(itemCmd, events)).toBeNull();
  });

  it("コマンド却下(command-rejected・item-usedなし)なら消費しない(null)", () => {
    const events: BattleEvent[] = [{ type: "command-rejected", reason: "battle-over", message: "m" }];
    expect(battleItemToConsume(itemCmd, events)).toBeNull();
  });

  it("どうぐ以外のコマンド(たたかう)は消費しない(null)", () => {
    const events: BattleEvent[] = [
      { type: "item-used", itemId: "potion-small", itemName: "回復薬(小)", message: "m" }
    ];
    expect(battleItemToConsume({ kind: "attack" }, events)).toBeNull();
  });

  it("別IDの item-used では消費しない(念のための防御。null)", () => {
    const events: BattleEvent[] = [
      { type: "item-used", itemId: "antidote", itemName: "解毒薬", message: "m" }
    ];
    expect(battleItemToConsume(itemCmd, events)).toBeNull();
  });
});
