import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENT_IDS,
  ACHIEVEMENTS,
  SEASONED_DREAMER_LEVEL,
  achievementEventSchema,
  achievementIdSchema,
  advanceDay,
  affinityTier,
  createNewGameState,
  evaluateAchievements,
  gameStateSchema,
  mapIdSchema,
  mergeUnlockedAchievements,
  midBossDefeatFlag
} from "../src/index.js";
import type {
  AchievementEvent,
  AchievementId,
  AchievementInput,
  GameState,
  TimeOfDay
} from "../src/index.js";

/**
 * 実績システム「夢の欠片」(M24)のユニットテスト。
 * 仕様の正: game-design.md「実績システム『夢の欠片』(拡張: M24)」
 * (初期セット12件の表・判定・解除フロー・セーブ互換)。
 */

/** 新規ゲーム状態を必要なら変異させて評価入力を組む(GameState は AchievementStateSlice を構造的に満たす) */
function inputOf(
  mutate?: (state: GameState) => void,
  timeOfDay: TimeOfDay = "day",
  events: readonly AchievementEvent[] = []
): AchievementInput {
  const state = createNewGameState();
  mutate?.(state);
  return { state, timeOfDay, events };
}

describe("登録簿 ACHIEVEMENTS(骨子の表が正)", () => {
  it("初期セットは12件で、id 列挙・スキーマ・登録簿が一致する", () => {
    expect(ACHIEVEMENT_IDS).toHaveLength(12);
    expect([...achievementIdSchema.options]).toEqual([...ACHIEVEMENT_IDS]);
    expect(Object.keys(ACHIEVEMENTS).sort()).toEqual([...ACHIEVEMENT_IDS].sort());
    for (const id of ACHIEVEMENT_IDS) {
      expect(ACHIEVEMENTS[id].id).toBe(id);
      expect(ACHIEVEMENTS[id].name.length).toBeGreaterThan(0);
      expect(ACHIEVEMENTS[id].flavor.length).toBeGreaterThan(0);
    }
  });

  it("表示名は重複しない(一覧表示で区別できる)", () => {
    const names = ACHIEVEMENT_IDS.map((id) => ACHIEVEMENTS[id].name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("イベント列挙は2種のみ(sub-quest-reported / world-event-applied)", () => {
    expect([...achievementEventSchema.options]).toEqual(["sub-quest-reported", "world-event-applied"]);
    expect(() => achievementEventSchema.parse("boss-defeated")).toThrow();
  });

  it("新規ゲーム(昼・イベントなし)は何も満たさない", () => {
    expect(evaluateAchievements(inputOf())).toEqual([]);
  });
});

describe("evaluateAchievements — 12条件それぞれの成立/不成立", () => {
  it("first-mourning: 戦果描写済みの敵種が1件以上で成立", () => {
    const unlocked = evaluateAchievements(inputOf((s) => (s.narratedEnemies = ["mist-wolf"])));
    expect(unlocked).toContain("first-mourning");
    expect(evaluateAchievements(inputOf())).not.toContain("first-mourning");
  });

  it("rift-beheld: rift-revealed 以降で成立(順序判定=後段階でも真)", () => {
    expect(
      evaluateAchievements(inputOf((s) => (s.mainQuestStage = "rift-revealed")))
    ).toContain("rift-beheld");
    expect(evaluateAchievements(inputOf((s) => (s.mainQuestStage = "epilogue")))).toContain(
      "rift-beheld"
    );
    expect(evaluateAchievements(inputOf((s) => (s.mainQuestStage = "arrival")))).not.toContain(
      "rift-beheld"
    );
  });

  it("dream-eater-mourned: dream-eater-defeated 以降で成立", () => {
    expect(
      evaluateAchievements(inputOf((s) => (s.mainQuestStage = "dream-eater-defeated")))
    ).toContain("dream-eater-mourned");
    expect(
      evaluateAchievements(inputOf((s) => (s.mainQuestStage = "ch2-stirring")))
    ).toContain("dream-eater-mourned");
    expect(
      evaluateAchievements(inputOf((s) => (s.mainQuestStage = "rift-revealed")))
    ).not.toContain("dream-eater-mourned");
  });

  it("beyond-the-dream: ch2-beyond(第2章クリア)で成立", () => {
    expect(evaluateAchievements(inputOf((s) => (s.mainQuestStage = "ch2-beyond")))).toContain(
      "beyond-the-dream"
    );
    expect(
      evaluateAchievements(inputOf((s) => (s.mainQuestStage = "ch2-vigil-song")))
    ).not.toContain("beyond-the-dream");
  });

  it("spinner-stilled: gimmicks の中ボス撃破フラグ(紡ぎ損ない)で成立(他のギミックでは不成立)", () => {
    expect(
      evaluateAchievements(inputOf((s) => (s.gimmicks = [midBossDefeatFlag("failing-spinner")])))
    ).toContain("spinner-stilled");
    expect(
      evaluateAchievements(inputOf((s) => (s.gimmicks = ["chest-d1-1", "failing-spinner"])))
    ).not.toContain("spinner-stilled");
  });

  it("seasoned-dreamer: レベル8以上で成立(境界=8。7は不成立)", () => {
    expect(SEASONED_DREAMER_LEVEL).toBe(8);
    expect(
      evaluateAchievements(inputOf((s) => (s.player.level = SEASONED_DREAMER_LEVEL)))
    ).toContain("seasoned-dreamer");
    expect(evaluateAchievements(inputOf((s) => (s.player.level = 10)))).toContain(
      "seasoned-dreamer"
    );
    expect(
      evaluateAchievements(inputOf((s) => (s.player.level = SEASONED_DREAMER_LEVEL - 1)))
    ).not.toContain("seasoned-dreamer");
  });

  it("traveler-outfitted: 武器・防具の両スロットが埋まって成立(片方では不成立)", () => {
    expect(
      evaluateAchievements(
        inputOf((s) => (s.equipment = { weapon: "worn-blade", armor: "worn-cloak" }))
      )
    ).toContain("traveler-outfitted");
    expect(
      evaluateAchievements(inputOf((s) => (s.equipment = { weapon: "worn-blade", armor: null })))
    ).not.toContain("traveler-outfitted");
    expect(
      evaluateAchievements(inputOf((s) => (s.equipment = { weapon: null, armor: "worn-cloak" })))
    ).not.toContain("traveler-outfitted");
  });

  it("first-errand: sub-quest-reported イベントで成立(他イベント・イベント無しでは不成立)", () => {
    expect(evaluateAchievements(inputOf(undefined, "day", ["sub-quest-reported"]))).toContain(
      "first-errand"
    );
    expect(evaluateAchievements(inputOf(undefined, "day", []))).not.toContain("first-errand");
    expect(
      evaluateAchievements(inputOf(undefined, "day", ["world-event-applied"]))
    ).not.toContain("first-errand");
  });

  it("dream-atlas: 全マップ(8枚)を含んで成立(順序は問わない・1枚欠けで不成立)", () => {
    const all = [...mapIdSchema.options];
    expect(all).toHaveLength(8);
    expect(evaluateAchievements(inputOf((s) => (s.visitedMaps = all)))).toContain("dream-atlas");
    expect(
      evaluateAchievements(inputOf((s) => (s.visitedMaps = [...all].reverse())))
    ).toContain("dream-atlas");
    expect(
      evaluateAchievements(inputOf((s) => (s.visitedMaps = all.slice(0, 7))))
    ).not.toContain("dream-atlas");
  });

  it("night-wanderer: 時間帯が夜の評価で成立(昼では不成立)", () => {
    expect(evaluateAchievements(inputOf(undefined, "night"))).toContain("night-wanderer");
    expect(evaluateAchievements(inputOf(undefined, "day"))).not.toContain("night-wanderer");
  });

  it("woven-morning: world-event-applied イベントで成立(他イベントでは不成立)", () => {
    expect(evaluateAchievements(inputOf(undefined, "day", ["world-event-applied"]))).toContain(
      "woven-morning"
    );
    expect(
      evaluateAchievements(inputOf(undefined, "day", ["sub-quest-reported"]))
    ).not.toContain("woven-morning");
  });

  it("trusted-lantern: いずれかの NPC の好感度が「信頼」帯(80以上)で成立(79は不成立)", () => {
    expect(affinityTier(80)).toBe("trusted"); // 境界の正は npc.ts の段階表
    expect(
      evaluateAchievements(inputOf((s) => (s.npcs.merchant.affinity = 80)))
    ).toContain("trusted-lantern");
    expect(
      evaluateAchievements(inputOf((s) => (s.npcs.warden.affinity = 100)))
    ).toContain("trusted-lantern");
    expect(
      evaluateAchievements(inputOf((s) => (s.npcs.merchant.affinity = 79)))
    ).not.toContain("trusted-lantern");
  });

  it("複数同時成立は登録簿の列挙順で返る(決定論)", () => {
    const input = inputOf((s) => (s.player.level = 8), "night", [
      "world-event-applied",
      "sub-quest-reported"
    ]);
    expect(evaluateAchievements(input)).toEqual([
      "seasoned-dreamer",
      "first-errand",
      "night-wanderer",
      "woven-morning"
    ]);
  });
});

describe("mergeUnlockedAchievements — ∪ 単調更新(解除は不可逆)", () => {
  it("追加が無ければ同一参照を返す(呼び出し側の変化なし判定)", () => {
    const unlocked: AchievementId[] = ["first-errand"];
    expect(mergeUnlockedAchievements(unlocked, [])).toBe(unlocked);
    expect(mergeUnlockedAchievements(unlocked, ["first-errand"])).toBe(unlocked);
  });

  it("新規解除は既存の末尾へ追記し、既存の解除順を保つ", () => {
    const merged = mergeUnlockedAchievements(["woven-morning"], ["first-errand", "woven-morning"]);
    expect(merged).toEqual(["woven-morning", "first-errand"]);
  });

  it("解除集合は増えるのみ: 条件が満たされなくなっても取り除かれない(不可逆性)", () => {
    // 装備を外した後の評価結果(traveler-outfitted を含まない)をマージしても解除は残る
    const unlocked: AchievementId[] = ["traveler-outfitted"];
    const satisfied = evaluateAchievements(inputOf()); // 空装備=何も満たさない
    expect(satisfied).not.toContain("traveler-outfitted");
    expect(mergeUnlockedAchievements(unlocked, satisfied)).toBe(unlocked);
  });

  it("冪等: 同じ評価結果を重ねてマージしても増えない", () => {
    const first = mergeUnlockedAchievements([], ["night-wanderer"]);
    const second = mergeUnlockedAchievements(first, ["night-wanderer"]);
    expect(second).toBe(first);
    expect(second).toEqual(["night-wanderer"]);
  });
});

describe("セーブ互換(unlockedAchievements は optional+default([]))", () => {
  it("旧セーブ(unlockedAchievements 欠落)は空配列で読める(GAME_STATE_VERSION 据え置き)", () => {
    const raw: Record<string, unknown> = structuredClone(createNewGameState());
    delete raw.unlockedAchievements;
    const parsed = gameStateSchema.parse(raw);
    expect(parsed.unlockedAchievements).toEqual([]);
  });

  it("未知の実績 id を含むセーブはパース段で拒否する(外部入力の zod 検証)", () => {
    const raw: Record<string, unknown> = structuredClone(createNewGameState());
    raw.unlockedAchievements = ["not-an-achievement"];
    expect(() => gameStateSchema.parse(raw)).toThrow();
  });

  it("新規ゲームは空で始まる", () => {
    expect(createNewGameState().unlockedAchievements).toEqual([]);
  });

  it("advanceDay(日送り)で持続する(日次リセット対象ではない)", () => {
    const state = createNewGameState();
    state.unlockedAchievements = ["first-errand", "night-wanderer"];
    const next = advanceDay(state);
    expect(next.unlockedAchievements).toEqual(["first-errand", "night-wanderer"]);
  });
});
