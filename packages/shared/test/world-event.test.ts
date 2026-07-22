import { describe, expect, it } from "vitest";

import {
  ABSENT_NPC_IDS,
  absentNpcIdSchema,
  clampDreamErosion,
  clampDungeonSymbolCount,
  DREAM_EROSION_MAX,
  DREAM_EROSION_MIN,
  DUNGEON_LAYER_MAP_IDS,
  dungeonSymbolRange,
  initialDungeonSymbolCounts,
  isAbsentNpc,
  isMarketShiftMode,
  MARKET_SHIFT_MODES,
  marketShiftModeSchema,
  npcIdSchema,
  WEATHERS,
  weatherSchema,
  worldEventSchema
} from "../src/index.js";

describe("worldEventSchema(世界変化イベントの受理/却下)", () => {
  it("定義済み kind と有効値を受理する", () => {
    expect(worldEventSchema.safeParse({ kind: "weather", value: "fog" }).success).toBe(true);
    expect(worldEventSchema.safeParse({ kind: "npc_rumor", npcId: "priest", rumor: "灯守堂の噂" }).success).toBe(true);
    expect(worldEventSchema.safeParse({ kind: "street_event", eventId: "peddler" }).success).toBe(true);
    expect(worldEventSchema.safeParse({ kind: "dungeon_shift", layer: 2, symbolCountDelta: 1 }).success).toBe(true);
    expect(worldEventSchema.safeParse({ kind: "dungeon_shift", layer: 3, symbolCountDelta: -1 }).success).toBe(true);
    // M20 追加の3種
    expect(worldEventSchema.safeParse({ kind: "market_shift", mode: "scarcity" }).success).toBe(true);
    expect(worldEventSchema.safeParse({ kind: "market_shift", mode: "surplus" }).success).toBe(true);
    expect(worldEventSchema.safeParse({ kind: "npc_absence", npcId: "merchant" }).success).toBe(true);
    expect(worldEventSchema.safeParse({ kind: "dream_erosion", delta: 1 }).success).toBe(true);
    expect(worldEventSchema.safeParse({ kind: "dream_erosion", delta: 0 }).success).toBe(true);
    expect(worldEventSchema.safeParse({ kind: "dream_erosion", delta: -1 }).success).toBe(true);
  });

  it("未定義 kind・無効値を却下する", () => {
    // 未定義 kind
    expect(worldEventSchema.safeParse({ kind: "earthquake" }).success).toBe(false);
    // 無効な天候
    expect(worldEventSchema.safeParse({ kind: "weather", value: "sunny" }).success).toBe(false);
    // 無効な npcId
    expect(worldEventSchema.safeParse({ kind: "npc_rumor", npcId: "stranger", rumor: "x" }).success).toBe(false);
    // 無効な street_event
    expect(worldEventSchema.safeParse({ kind: "street_event", eventId: "dragon" }).success).toBe(false);
    // 範囲外の層
    expect(worldEventSchema.safeParse({ kind: "dungeon_shift", layer: 4, symbolCountDelta: 1 }).success).toBe(false);
    // 範囲外の delta(-1/0/+1 のみ)
    expect(worldEventSchema.safeParse({ kind: "dungeon_shift", layer: 2, symbolCountDelta: 2 }).success).toBe(false);
    // M20: enum 外 mode / ホワイトリスト外 npcId(進行役 priest・窓口 informant・番人 warden)/ レンジ外 delta
    expect(worldEventSchema.safeParse({ kind: "market_shift", mode: "windfall" }).success).toBe(false);
    expect(worldEventSchema.safeParse({ kind: "npc_absence", npcId: "priest" }).success).toBe(false);
    expect(worldEventSchema.safeParse({ kind: "npc_absence", npcId: "informant" }).success).toBe(false);
    expect(worldEventSchema.safeParse({ kind: "npc_absence", npcId: "warden" }).success).toBe(false);
    expect(worldEventSchema.safeParse({ kind: "dream_erosion", delta: 2 }).success).toBe(false);
    expect(worldEventSchema.safeParse({ kind: "dream_erosion", delta: -2 }).success).toBe(false);
  });
});

describe("MarketShiftMode(市場モード。M20)", () => {
  it("scarcity/surplus の2種で、enum 外は却下する", () => {
    expect([...MARKET_SHIFT_MODES]).toEqual(["scarcity", "surplus"]);
    for (const mode of MARKET_SHIFT_MODES) {
      expect(marketShiftModeSchema.safeParse(mode).success).toBe(true);
      expect(isMarketShiftMode(mode)).toBe(true);
    }
    expect(isMarketShiftMode("windfall")).toBe(false);
    expect(marketShiftModeSchema.safeParse("windfall").success).toBe(false);
  });
});

describe("AbsentNpcId(不在NPCホワイトリスト。M20)", () => {
  it("すべて実在 NpcId で、進行役 priest・窓口 informant・番人 warden を含まない", () => {
    for (const id of ABSENT_NPC_IDS) {
      expect(npcIdSchema.safeParse(id).success).toBe(true);
    }
    for (const excluded of ["priest", "informant", "warden"]) {
      expect(ABSENT_NPC_IDS as readonly string[]).not.toContain(excluded);
      expect(absentNpcIdSchema.safeParse(excluded).success).toBe(false);
      expect(isAbsentNpc(excluded)).toBe(false);
    }
  });

  it("初期ホワイトリストは innkeeper/merchant/caretaker/artisan(宿・店が同時全滅しない構成)", () => {
    expect([...ABSENT_NPC_IDS].sort()).toEqual(["artisan", "caretaker", "innkeeper", "merchant"]);
    // 宿(innkeeper/caretaker)・店(merchant/artisan)が各1軒は必ず残る=どれも含まれる
    expect(isAbsentNpc("innkeeper")).toBe(true);
    expect(isAbsentNpc("merchant")).toBe(true);
    expect(isAbsentNpc("dragon")).toBe(false);
  });
});

describe("dream_erosion 侵食度(0-3 の絶対クランプ。M20)", () => {
  it("clampDreamErosion は 0-3 でクランプする", () => {
    expect(DREAM_EROSION_MIN).toBe(0);
    expect(DREAM_EROSION_MAX).toBe(3);
    expect(clampDreamErosion(-5)).toBe(0);
    expect(clampDreamErosion(-1)).toBe(0);
    expect(clampDreamErosion(0)).toBe(0);
    expect(clampDreamErosion(2)).toBe(2);
    expect(clampDreamErosion(3)).toBe(3);
    expect(clampDreamErosion(4)).toBe(3);
    expect(clampDreamErosion(99)).toBe(3);
  });
});

describe("天候", () => {
  it("WEATHERS と weatherSchema が一致する", () => {
    expect(WEATHERS).toContain("clear");
    for (const w of WEATHERS) {
      expect(weatherSchema.safeParse(w).success).toBe(true);
    }
    expect(weatherSchema.safeParse("sunny").success).toBe(false);
  });
});

describe("ダンジョン敵シンボル数(レンジ・クランプ・初期値)", () => {
  it("dungeonSymbolRange はマップ定義のレンジを返す(各層 2-6)", () => {
    expect(dungeonSymbolRange(1)).toEqual({ min: 2, max: 6 });
    expect(dungeonSymbolRange(2)).toEqual({ min: 2, max: 6 });
    expect(dungeonSymbolRange(3)).toEqual({ min: 2, max: 6 });
  });

  it("clampDungeonSymbolCount は両端でクランプする", () => {
    expect(clampDungeonSymbolCount(1, 0)).toBe(2); // 下限
    expect(clampDungeonSymbolCount(1, 100)).toBe(6); // 上限
    expect(clampDungeonSymbolCount(1, 4)).toBe(4); // レンジ内は素通し
  });

  it("initialDungeonSymbolCounts は各層レンジの中央値(2-6 → 4)", () => {
    expect(initialDungeonSymbolCounts()).toEqual({ 1: 4, 2: 4, 3: 4 });
  });

  it("DUNGEON_LAYER_MAP_IDS は層 → マップ ID の対応を持つ", () => {
    expect(DUNGEON_LAYER_MAP_IDS).toEqual({ 1: "dungeon-1", 2: "dungeon-2", 3: "dungeon-3" });
  });
});
