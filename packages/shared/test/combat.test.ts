import { describe, expect, it } from "vitest";

import {
  computeDamage,
  createBattle,
  fleeChance,
  MAX_LEVEL,
  poisonTickDamage,
  resolveTurn,
  SKILLS,
  skillsForLevel,
  statsForLevel,
  turnOrder
} from "../src/index.js";
import type { BattleCommand, BattleEvent, BattleState, Equipment, PlayerProgress, Rng, SkillId } from "../src/index.js";

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
// スキル習得の導出(skillsForLevel。M9: レベルから純粋に導出。習得状態は非保存)
// ---------------------------------------------------------------------------

describe("skillsForLevel(習得スキル導出)", () => {
  const allSkillIds = Object.keys(SKILLS) as SkillId[];

  it("Lv1で既存2種を習得している(定義順)", () => {
    expect(skillsForLevel(1)).toEqual(["ember-strike", "soothing-light"]);
  });

  it("境界: learnLevel-1では含まれず、learnLevelちょうどで含まれる(全スキル)", () => {
    for (const id of allSkillIds) {
      const learnLevel = SKILLS[id].learnLevel;
      expect(skillsForLevel(learnLevel)).toContain(id);
      // Lv1習得スキルなら skillsForLevel(0)=空 で「含まれない」を満たす
      expect(skillsForLevel(learnLevel - 1)).not.toContain(id);
    }
  });

  it("MAX_LEVELで全種を習得している", () => {
    const learned = skillsForLevel(MAX_LEVEL);
    expect(new Set(learned)).toEqual(new Set(allSkillIds));
    expect(learned).toHaveLength(allSkillIds.length);
  });

  it("習得済み一覧はレベルに対し単調(下位レベルの集合は上位レベルの部分集合)", () => {
    for (let level = 0; level < MAX_LEVEL; level += 1) {
      const lower = skillsForLevel(level);
      const higher = skillsForLevel(level + 1);
      for (const id of lower) expect(higher).toContain(id);
    }
  });

  it("習得レベル昇順にソートされる(同レベルは定義順)", () => {
    const learned = skillsForLevel(MAX_LEVEL);
    const levels = learned.map((id) => SKILLS[id].learnLevel);
    const sorted = [...levels].sort((a, b) => a - b);
    expect(levels).toEqual(sorted);
  });

  it("レベル0以下でも例外を投げず空配列を返す(範囲外に寛容)", () => {
    expect(skillsForLevel(0)).toEqual([]);
    expect(skillsForLevel(-5)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// コマンド拒否(未習得スキル: skill-not-learned。M9)
// ---------------------------------------------------------------------------

describe("コマンド拒否(未習得スキル)", () => {
  it("習得レベル未満のスキルは skill-not-learned で拒否され、ラウンドが進まない(状態不変)", () => {
    const state = createBattle(lv(1), "mist-wolf", 1);
    state.player.level = 0; // ember-strike(learnLevel 1)を未習得の状態へ落とす
    const res = resolveTurn(state, { kind: "skill", skillId: "ember-strike" });
    expect(res.events).toHaveLength(1);
    expect(res.events[0]).toMatchObject({ type: "command-rejected", reason: "skill-not-learned" });
    expect(res.state).toBe(state); // 参照ごと不変(ラウンドは進まない)
    expect(res.state.turn).toBe(0);
  });

  it("習得済みスキルは従来どおり実行される(未習得拒否されない)", () => {
    const state = createBattle(lv(1), "mist-wolf", 1); // Lv1で ember-strike 習得済み・MP十分
    const res = resolveTurn(state, { kind: "skill", skillId: "ember-strike" });
    expect(res.state.turn).toBe(1);
    expect(res.events.some((e) => e.type === "command-rejected")).toBe(false);
    expect(
      res.events.some((e) => e.type === "action" && e.actor === "player" && e.actionKind === "skill")
    ).toBe(true);
  });

  it("未習得かつMP不足でも未習得(skill-not-learned)を優先して拒否する", () => {
    const state = createBattle(lv(1), "mist-wolf", 1);
    state.player.level = 0;
    state.player.mp = 0;
    const res = resolveTurn(state, { kind: "skill", skillId: "ember-strike" });
    expect(res.events[0]).toMatchObject({ type: "command-rejected", reason: "skill-not-learned" });
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

// ---------------------------------------------------------------------------
// M9-2 新スキル(澱み斬り=毒付与つき攻撃 / 灯守りの構え=防御バフ / 焔尽くし=強撃)
// ---------------------------------------------------------------------------

/** イベント列から特定 type の1件を取り出すヘルパー(見つからなければ undefined) */
function findEvent<T extends BattleEvent["type"]>(
  events: BattleEvent[],
  type: T
): Extract<BattleEvent, { type: T }> | undefined {
  return events.find((e): e is Extract<BattleEvent, { type: T }> => e.type === type);
}

describe("澱み斬り(murk-cleave: 攻撃+毒付与)", () => {
  it("生存している敵にダメージ+毒を付与し、同ラウンド終端に毒がtickする", () => {
    // Lv3 で murk-cleave 習得済み・MP十分。creaking-doll(HP48)は一撃で倒れず、プレイヤーが先手(速9>6)
    const state = createBattle(lv(3), "creaking-doll", 1);
    const hpBefore = state.enemy.hp;
    const res = resolveTurn(state, { kind: "skill", skillId: "murk-cleave" });
    // ダメージが入っている
    const dmg = findEvent(res.events, "damage");
    expect(dmg).toBeDefined();
    expect(res.state.enemy.hp).toBeLessThan(hpBefore);
    // 毒が敵へ付与された
    const inflicted = findEvent(res.events, "status-inflicted");
    expect(inflicted).toMatchObject({ type: "status-inflicted", target: "enemy", status: "poison" });
    // 付与ラウンドの終端で毒がtickする(敵の毒付与技と同じ扱い)
    const tick = res.events.find(
      (e): e is Extract<BattleEvent, { type: "status-tick" }> => e.type === "status-tick" && e.target === "enemy"
    );
    expect(tick).toBeDefined();
    expect(tick?.status).toBe("poison");
    expect(res.state.enemy.statuses.some((s) => s.id === "poison")).toBe(true);
  });

  it("この一撃で敵を倒しきった場合は毒を付与しない(status-inflicted なし・勝利)", () => {
    const state = createBattle(lv(3), "mist-wolf", 1);
    state.enemy.hp = 1; // 確実に倒しきる
    const res = resolveTurn(state, { kind: "skill", skillId: "murk-cleave" });
    expect(res.state.enemy.hp).toBe(0);
    expect(findEvent(res.events, "status-inflicted")).toBeUndefined();
    expect(findEvent(res.events, "victory")).toBeDefined();
  });
});

describe("灯守りの構え(warding-stance: 防御バフ)", () => {
  it("バフ中は被ダメージが実効防御+8分だけ軽減される(同seed・同行動で比較)", () => {
    // 同一シード・同一行動(たたかう)で、バフ有無のみを変えて被ダメージを比較する。
    // 乱数消費は両者同一のため、敵→旅人の raw ダメージは等しく、差は防御+8(floor(8/2)=4)ぶんになる。
    const buffed = createBattle(lv(4), "dream-eater", 77);
    const plain = createBattle(lv(4), "dream-eater", 77);
    buffed.player.defenseBuff = { amount: 8, remainingTurns: 3 };
    const rBuffed = resolveTurn(buffed, { kind: "attack" });
    const rPlain = resolveTurn(plain, { kind: "attack" });
    const dmgBuffed = rBuffed.events.find(
      (e): e is Extract<BattleEvent, { type: "damage" }> => e.type === "damage" && e.target === "player"
    );
    const dmgPlain = rPlain.events.find(
      (e): e is Extract<BattleEvent, { type: "damage" }> => e.type === "damage" && e.target === "player"
    );
    expect(dmgBuffed).toBeDefined();
    expect(dmgPlain).toBeDefined();
    // 防御+8 → floor(実効防御/2) が4増える。最低1保証込みで厳密一致する
    expect(dmgBuffed?.amount).toBe(Math.max(1, (dmgPlain?.amount ?? 0) - 4));
    expect(dmgBuffed?.amount).toBeLessThan(dmgPlain?.amount ?? 0);
  });

  it("付与ラウンドを1ターン目として数え、3ラウンド目終端で失効する(buff-applied→…→buff-expired)", () => {
    // Lv6 vs 夢喰い(HP150・ボス)。プレイヤー先手・双方3ラウンドは生存する組み合わせ
    let state = createBattle(lv(6), "dream-eater", 3);
    // 1ラウンド目: 構えを張る
    let res = resolveTurn(state, { kind: "skill", skillId: "warding-stance" });
    state = res.state;
    expect(findEvent(res.events, "buff-applied")).toMatchObject({ type: "buff-applied", target: "player", buff: "defense", amount: 8 });
    expect(state.player.defenseBuff?.remainingTurns).toBe(2); // 付与時3 → 終端で2
    // 2ラウンド目: まだ有効(残1へ)
    res = resolveTurn(state, { kind: "attack" });
    state = res.state;
    expect(findEvent(res.events, "buff-expired")).toBeUndefined();
    expect(state.player.defenseBuff?.remainingTurns).toBe(1);
    // 3ラウンド目終端で失効
    res = resolveTurn(state, { kind: "attack" });
    state = res.state;
    expect(findEvent(res.events, "buff-expired")).toMatchObject({ type: "buff-expired", target: "player", buff: "defense" });
    expect(state.player.defenseBuff).toBeNull();
  });

  it("重ねがけは失敗せず、量は加算されず定義値へリセットされる(スタックしない)", () => {
    let state = createBattle(lv(6), "dream-eater", 5);
    // 1回目
    let res = resolveTurn(state, { kind: "skill", skillId: "warding-stance" });
    state = res.state;
    expect(state.player.defenseBuff?.remainingTurns).toBe(2);
    // 2回目(再付与): 拒否されず、量は8のまま・残ターンは定義値3へリセット→終端で2
    res = resolveTurn(state, { kind: "skill", skillId: "warding-stance" });
    state = res.state;
    expect(res.events.some((e) => e.type === "command-rejected")).toBe(false);
    expect(findEvent(res.events, "buff-applied")).toBeDefined();
    expect(state.player.defenseBuff?.amount).toBe(8); // 16 に加算されない
    expect(state.player.defenseBuff?.remainingTurns).toBe(2);
  });
});

describe("焔尽くし(blaze-ender: 高倍率の強撃)", () => {
  it("同seed・同条件で ember-strike(×1.8)より大きいダメージを与える(×3.0)", () => {
    const blaze = createBattle(lv(6), "dream-eater", 9);
    const ember = createBattle(lv(6), "dream-eater", 9);
    const rBlaze = resolveTurn(blaze, { kind: "skill", skillId: "blaze-ender" });
    const rEmber = resolveTurn(ember, { kind: "skill", skillId: "ember-strike" });
    const dmgBlaze = rBlaze.events.find(
      (e): e is Extract<BattleEvent, { type: "damage" }> => e.type === "damage" && e.target === "enemy"
    );
    const dmgEmber = rEmber.events.find(
      (e): e is Extract<BattleEvent, { type: "damage" }> => e.type === "damage" && e.target === "enemy"
    );
    expect(dmgBlaze?.amount).toBeGreaterThan(dmgEmber?.amount ?? 0);
  });

  it("MP不足なら not-enough-mp で拒否される(状態不変)", () => {
    const state = createBattle(lv(6), "dream-eater", 1);
    state.player.mp = SKILLS["blaze-ender"].mpCost - 1; // 11(12未満)
    const res = resolveTurn(state, { kind: "skill", skillId: "blaze-ender" });
    expect(res.events[0]).toMatchObject({ type: "command-rejected", reason: "not-enough-mp" });
    expect(res.state.turn).toBe(0);
  });
});

describe("未習得レベルでの新スキル拒否(skill-not-learned)", () => {
  it("murk-cleave(Lv3習得)は Lv2 で拒否される", () => {
    const state = createBattle(lv(2), "mist-wolf", 1);
    const res = resolveTurn(state, { kind: "skill", skillId: "murk-cleave" });
    expect(res.events[0]).toMatchObject({ type: "command-rejected", reason: "skill-not-learned" });
    expect(res.state.turn).toBe(0);
  });

  it("warding-stance(Lv4習得)は Lv3 で拒否される", () => {
    const state = createBattle(lv(3), "mist-wolf", 1);
    const res = resolveTurn(state, { kind: "skill", skillId: "warding-stance" });
    expect(res.events[0]).toMatchObject({ type: "command-rejected", reason: "skill-not-learned" });
  });

  it("blaze-ender(Lv6習得)は Lv5 で拒否される", () => {
    const state = createBattle(lv(5), "mist-wolf", 1);
    const res = resolveTurn(state, { kind: "skill", skillId: "blaze-ender" });
    expect(res.events[0]).toMatchObject({ type: "command-rejected", reason: "skill-not-learned" });
  });
});

describe("決定論性(新スキル込み)", () => {
  it("murk-cleave/warding-stance/blaze-ender を含む列でも同一再現する", () => {
    const commands: BattleCommand[] = [
      { kind: "skill", skillId: "murk-cleave" },
      { kind: "skill", skillId: "warding-stance" },
      { kind: "skill", skillId: "blaze-ender" },
      { kind: "attack" }
    ];
    function run(): { events: BattleEvent[]; final: BattleState } {
      let state = createBattle(lv(6), "dream-eater", 24680); // Lv6 maxMP26 ≥ 5+6+12
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
});
