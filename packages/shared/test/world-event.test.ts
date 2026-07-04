import { describe, expect, it } from "vitest";

import {
  clampDungeonSymbolCount,
  DUNGEON_LAYER_MAP_IDS,
  dungeonSymbolRange,
  initialDungeonSymbolCounts,
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
