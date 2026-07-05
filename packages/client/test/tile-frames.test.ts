import { mapIdSchema, tileTypeSchema } from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import { TILESET_COLUMNS, TILESET_ROWS, tileFrame } from "../src/tile-frames.js";

describe("tileFrame", () => {
  it("全マップx全タイル種別で、シート範囲内の整数フレームを返す", () => {
    const totalFrames = TILESET_COLUMNS * TILESET_ROWS;
    for (const mapId of mapIdSchema.options) {
      for (const tile of tileTypeSchema.options) {
        const frame = tileFrame(mapId, tile);
        expect(Number.isInteger(frame)).toBe(true);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(totalFrames);
      }
    }
  });

  it("ダンジョン3層は同一の見た目区分になる", () => {
    for (const tile of tileTypeSchema.options) {
      expect(tileFrame("dungeon-1", tile)).toBe(tileFrame("dungeon-2", tile));
      expect(tileFrame("dungeon-2", tile)).toBe(tileFrame("dungeon-3", tile));
    }
  });

  it("街・フィールド・ダンジョンで床と壁の見た目が区別される", () => {
    expect(tileFrame("town", "floor")).not.toBe(tileFrame("field", "floor"));
    expect(tileFrame("field", "floor")).not.toBe(tileFrame("dungeon-1", "floor"));
    expect(tileFrame("town", "wall")).not.toBe(tileFrame("field", "wall"));
    expect(tileFrame("field", "wall")).not.toBe(tileFrame("dungeon-1", "wall"));
  });
});
