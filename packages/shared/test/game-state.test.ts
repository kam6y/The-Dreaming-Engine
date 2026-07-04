import { describe, expect, it } from "vitest";

import {
  advanceDay,
  createDefaultAiDailyCounters,
  createDefaultNpcStates,
  createDefaultWorldState,
  createNewGameState,
  DEFAULT_NPC_TOPICS,
  gameStateSchema,
  GAME_STATE_VERSION,
  hasNarratedEnemy,
  MAIN_QUEST_INITIAL_STAGE,
  recordNarratedEnemy
} from "../src/index.js";
import type { GameState } from "../src/index.js";

describe("createNewGameState(新フィールドの既定値)", () => {
  it("NPC 状態・メインクエスト段階・サブクエスト・世界状態・戦果記録・AI 日次を既定値で持つ", () => {
    const s = createNewGameState();
    expect(s.npcs).toEqual(createDefaultNpcStates());
    expect(s.mainQuestStage).toBe(MAIN_QUEST_INITIAL_STAGE);
    expect(s.subQuests).toEqual([]);
    expect(s.world).toEqual(createDefaultWorldState());
    expect(s.narratedEnemies).toEqual([]);
    expect(s.aiDaily).toEqual(createDefaultAiDailyCounters());
  });
});

describe("advanceDay(日送り)", () => {
  const modified: GameState = (() => {
    const base = createNewGameState();
    return {
      ...base,
      day: 5,
      aiDaily: {
        giveItemCount: 3,
        proposeQuestCount: 2,
        rewardItemProposalCount: 1,
        affinityDeltaByNpc: { innkeeper: 10, merchant: -5, informant: 0, priest: 3 }
      },
      npcs: {
        ...base.npcs,
        innkeeper: {
          affinity: 80,
          memory: { summary: "旅人と親しくなった", recentExchanges: [{ player: "こんばんは", npc: "よく来たね" }] },
          topic: "AI が上書きした噂"
        }
      },
      world: {
        weather: "fog",
        activeStreetEvents: ["peddler"],
        dungeonSymbolCounts: { 1: 6, 2: 2, 3: 5 }
      }
    };
  })();

  it("day+1・aiDaily ゼロリセット・topic を既定へリセット・activeStreetEvents クリア", () => {
    const next = advanceDay(modified);
    expect(next.day).toBe(6);
    expect(next.aiDaily).toEqual(createDefaultAiDailyCounters());
    expect(next.npcs.innkeeper.topic).toBe(DEFAULT_NPC_TOPICS.innkeeper);
    expect(next.world.activeStreetEvents).toEqual([]);
  });

  it("weather・dungeonSymbolCounts・affinity・memory は持続する", () => {
    const next = advanceDay(modified);
    expect(next.world.weather).toBe("fog");
    expect(next.world.dungeonSymbolCounts).toEqual({ 1: 6, 2: 2, 3: 5 });
    expect(next.npcs.innkeeper.affinity).toBe(80);
    expect(next.npcs.innkeeper.memory.summary).toBe("旅人と親しくなった");
    expect(next.npcs.innkeeper.memory.recentExchanges).toHaveLength(1);
  });
});

describe("hasNarratedEnemy / recordNarratedEnemy(戦果描写済み記録)", () => {
  it("記録すると初見判定が真になり、重複追加はしない", () => {
    const s = createNewGameState();
    expect(hasNarratedEnemy(s, "mist-wolf")).toBe(false);

    const s2 = recordNarratedEnemy(s, "mist-wolf");
    expect(hasNarratedEnemy(s2, "mist-wolf")).toBe(true);
    expect(s2.narratedEnemies).toEqual(["mist-wolf"]);

    const s3 = recordNarratedEnemy(s2, "mist-wolf");
    expect(s3.narratedEnemies).toEqual(["mist-wolf"]);
    // 重複時は同一参照を返す(不要な再生成をしない)
    expect(s3).toBe(s2);
  });
});

describe("後方互換(M3 形式セーブの読み込み)", () => {
  it("npcs/subQuests/world/narratedEnemies/aiDaily を持たないセーブをデフォルト補完で読める", () => {
    const full = createNewGameState();
    // M3 形式: version 1 だが M4 追加フィールドを含まない
    const m3Save = {
      version: 1,
      player: full.player,
      location: full.location,
      inventory: full.inventory,
      day: full.day,
      playtimeSeconds: full.playtimeSeconds,
      gimmicks: full.gimmicks
    };

    const result = gameStateSchema.safeParse(m3Save);
    expect(result.success).toBe(true);
    if (result.success) {
      // version は 1 のまま(デフォルト補完で読めるため上げない)
      expect(result.data.version).toBe(GAME_STATE_VERSION);
      expect(result.data.version).toBe(1);
      expect(result.data.npcs).toEqual(createDefaultNpcStates());
      expect(result.data.mainQuestStage).toBe(MAIN_QUEST_INITIAL_STAGE);
      expect(result.data.subQuests).toEqual([]);
      expect(result.data.world).toEqual(createDefaultWorldState());
      expect(result.data.narratedEnemies).toEqual([]);
      expect(result.data.aiDaily).toEqual(createDefaultAiDailyCounters());
    }
  });
});
