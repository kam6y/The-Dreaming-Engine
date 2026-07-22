import { describe, expect, it } from "vitest";

import {
  advanceDay,
  createDefaultAiDailyCounters,
  createDefaultNpcStates,
  createDefaultWorldState,
  createEmptyEquipment,
  createNewGameState,
  DEFAULT_NPC_TOPICS,
  gameStateSchema,
  GAME_STATE_VERSION,
  hasNarratedEnemy,
  INITIAL_AFFINITY,
  INN_COST,
  innFeeFor,
  MAIN_QUEST_INITIAL_STAGE,
  npcDailyAffinityDeltaSchema,
  npcIdSchema,
  recordNarratedEnemy,
  recordVisitedMap,
  SETTLEMENT_INN_COST
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
    expect(s.equipment).toEqual(createEmptyEquipment());
  });

  it("M22: visitedMaps は開始マップ(town)のみで初期化される", () => {
    const s = createNewGameState();
    expect(s.visitedMaps).toEqual(["town"]);
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
        affinityDeltaByNpc: {
          innkeeper: 10,
          merchant: -5,
          informant: 0,
          priest: 3,
          caretaker: 0,
          artisan: 0,
          warden: 0
        }
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
        dungeonSymbolCounts: { 1: 6, 2: 2, 3: 5 },
        // M20: market_shift / npc_absence は翌日限り(日送りでリセット)、dream_erosion は持続
        marketShift: "scarcity",
        absentNpc: "merchant",
        dreamErosion: 2
      },
      // M22: 訪問済みマップは探索進捗=日送りで持続する
      visitedMaps: ["town", "field", "dungeon-1"]
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

  it("M20: market_shift/npc_absence は日送りでリセット、dream_erosion(侵食度)は持続する", () => {
    const next = advanceDay(modified);
    expect(next.world.marketShift).toBeNull();
    expect(next.world.absentNpc).toBeNull();
    expect(next.world.dreamErosion).toBe(2);
  });

  it("M22: visitedMaps(訪問済みマップ)は日送りで持続する", () => {
    const next = advanceDay(modified);
    expect(next.visitedMaps).toEqual(["town", "field", "dungeon-1"]);
  });
});

describe("recordVisitedMap(訪問済みマップ記録)", () => {
  it("未収録なら追記し、重複は追加しない(既収録なら同一参照を返す)", () => {
    const s = createNewGameState();
    expect(s.visitedMaps).toEqual(["town"]);

    const s2 = recordVisitedMap(s, "field");
    expect(s2.visitedMaps).toEqual(["town", "field"]);

    const s3 = recordVisitedMap(s2, "dungeon-1");
    expect(s3.visitedMaps).toEqual(["town", "field", "dungeon-1"]);

    // 既収録(town)は追加せず、同一参照を返す(不要な再生成をしない)
    const s4 = recordVisitedMap(s3, "town");
    expect(s4.visitedMaps).toEqual(["town", "field", "dungeon-1"]);
    expect(s4).toBe(s3);
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
  it("npcs/subQuests/world/narratedEnemies/aiDaily/equipment を持たないセーブをデフォルト補完で読める", () => {
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
      expect(result.data.equipment).toEqual(createEmptyEquipment());
      // M22: visitedMaps 欠落は default([]) で補完(現在地補完は server ロード経路の責務)
      expect(result.data.visitedMaps).toEqual([]);
    }
  });

  it("M20 前の world(marketShift/absentNpc/dreamErosion を持たない)を default 補完で読める", () => {
    const full = createNewGameState();
    // M20 直前形式: world は旧3フィールドのみ(GAME_STATE_VERSION は 1 のまま据え置き)
    const legacySave = {
      ...full,
      world: {
        weather: "fog",
        activeStreetEvents: ["peddler"],
        dungeonSymbolCounts: { 1: 5, 2: 3, 3: 6 }
      }
    };

    const result = gameStateSchema.safeParse(legacySave);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(1);
      // 旧フィールドは保持
      expect(result.data.world.weather).toBe("fog");
      expect(result.data.world.dungeonSymbolCounts).toEqual({ 1: 5, 2: 3, 3: 6 });
      // M20 新フィールドは default 補完(非侵食・変化なし)
      expect(result.data.world.marketShift).toBeNull();
      expect(result.data.world.absentNpc).toBeNull();
      expect(result.data.world.dreamErosion).toBe(0);
    }
  });
});

// ===========================================================================
// 第2エリア(M16。琥珀郷)の宿代と旧セーブ互換
// ===========================================================================

describe("メタ: npcDailyAffinityDeltaSchema のキー集合が npcIdSchema と一致(ドリフト防止)", () => {
  it("adjust_affinity 日次累積のキーが全 NPC を被覆する", () => {
    const schemaKeys = Object.keys(npcDailyAffinityDeltaSchema.shape).sort();
    const enumKeys = [...npcIdSchema.options].sort();
    expect(schemaKeys).toEqual(enumKeys);
  });
});

describe("宿代(M16。灯宿=10G / 寄り屋=5G)", () => {
  it("宿代定数と innFeeFor(宿NPC別)が仕様どおり", () => {
    expect(INN_COST).toBe(10);
    expect(SETTLEMENT_INN_COST).toBe(5);
    expect(innFeeFor("innkeeper")).toBe(10); // 灯宿(オルガ)
    expect(innFeeFor("caretaker")).toBe(5); // 寄り屋(イルマ)
  });
});

describe("第2エリアNPCの旧セーブ互換(M16。新NPCフィールド欠落 → 好感度30で初期化)", () => {
  it("npcs が旧4人分のみのセーブは、新3人が好感度30・既定話題で補完される", () => {
    const full = createNewGameState();
    // 第2エリア追加前(旧4人のみ)の形の npcs を持つセーブ JSON
    const legacyNpcs = {
      innkeeper: { affinity: 55, memory: { summary: "", recentExchanges: [] }, topic: "旧話題" },
      merchant: createDefaultNpcStates().merchant,
      informant: createDefaultNpcStates().informant,
      priest: createDefaultNpcStates().priest
    };
    const legacySave = {
      version: 1,
      player: full.player,
      location: full.location,
      inventory: full.inventory,
      day: full.day,
      playtimeSeconds: full.playtimeSeconds,
      gimmicks: full.gimmicks,
      npcs: legacyNpcs
    };

    const result = gameStateSchema.safeParse(legacySave);
    expect(result.success).toBe(true);
    if (result.success) {
      // 既存NPCは保持
      expect(result.data.npcs.innkeeper.affinity).toBe(55);
      // 新NPC3人は初期好感度30・既定話題で補完される
      for (const id of ["caretaker", "artisan", "warden"] as const) {
        expect(result.data.npcs[id].affinity).toBe(INITIAL_AFFINITY);
        expect(result.data.npcs[id].affinity).toBe(30);
        expect(result.data.npcs[id].topic).toBe(DEFAULT_NPC_TOPICS[id]);
        expect(result.data.npcs[id].memory).toEqual({ summary: "", recentExchanges: [] });
      }
    }
  });

  it("aiDaily.affinityDeltaByNpc が旧4人分のみのセーブは、新3人が delta 0 で補完される", () => {
    const full = createNewGameState();
    const legacySave = {
      version: 1,
      player: full.player,
      location: full.location,
      inventory: full.inventory,
      day: full.day,
      playtimeSeconds: full.playtimeSeconds,
      gimmicks: full.gimmicks,
      aiDaily: {
        giveItemCount: 1,
        proposeQuestCount: 0,
        rewardItemProposalCount: 0,
        affinityDeltaByNpc: { innkeeper: 4, merchant: 0, informant: 0, priest: 0 }
      }
    };

    const result = gameStateSchema.safeParse(legacySave);
    expect(result.success).toBe(true);
    if (result.success) {
      const delta = result.data.aiDaily.affinityDeltaByNpc;
      expect(delta.innkeeper).toBe(4);
      expect(delta.caretaker).toBe(0);
      expect(delta.artisan).toBe(0);
      expect(delta.warden).toBe(0);
    }
  });
});
