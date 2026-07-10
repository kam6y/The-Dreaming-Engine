import { mapIdSchema, tileTypeSchema } from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import { TILESET_COLUMNS, TILESET_ROWS, tileFrame, tileTint, wallFrame } from "../src/tile-frames.js";

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

describe("wallFrame(壁の向き差分・M14)", () => {
  const dungeonIds = ["dungeon-1", "dungeon-2", "dungeon-3"] as const;

  it("南が非壁なら正面フレーム(=現行の壁フレームと同値=回帰)", () => {
    // wallFrame と tileFrame は正面フレームの出所を共有する(不変条件)
    for (const mapId of mapIdSchema.options) {
      expect(wallFrame(mapId, false)).toBe(tileFrame(mapId, "wall"));
    }
    // 現行フレームの具体値も固定して「同値」を実際に検証する(将来のドリフト検知)
    expect(wallFrame("town", false)).toBe(929);
    expect(wallFrame("field", false)).toBe(933);
    expect(wallFrame("dungeon-1", false)).toBe(940);
  });

  it("南が壁なら上面フレーム(正面とは異なる)", () => {
    expect(wallFrame("town", true)).not.toBe(wallFrame("town", false));
    expect(wallFrame("field", true)).not.toBe(wallFrame("field", false));
    expect(wallFrame("dungeon-1", true)).not.toBe(wallFrame("dungeon-1", false));
  });

  it("3区分すべてで正面≠上面、かつシート範囲内の整数フレーム", () => {
    const totalFrames = TILESET_COLUMNS * TILESET_ROWS;
    for (const mapId of mapIdSchema.options) {
      const front = wallFrame(mapId, false);
      const top = wallFrame(mapId, true);
      expect(front).not.toBe(top);
      for (const frame of [front, top]) {
        expect(Number.isInteger(frame)).toBe(true);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(totalFrames);
      }
    }
  });

  it("ダンジョン3層は正面・上面とも同一区分", () => {
    for (const southIsWall of [false, true]) {
      expect(wallFrame(dungeonIds[0], southIsWall)).toBe(wallFrame(dungeonIds[1], southIsWall));
      expect(wallFrame(dungeonIds[1], southIsWall)).toBe(wallFrame(dungeonIds[2], southIsWall));
    }
  });
});

describe("tileTint", () => {
  it("全マップで有効な24bitカラーを返す", () => {
    for (const mapId of mapIdSchema.options) {
      const tint = tileTint(mapId);
      expect(Number.isInteger(tint)).toBe(true);
      expect(tint).toBeGreaterThanOrEqual(0);
      expect(tint).toBeLessThanOrEqual(0xffffff);
    }
  });

  it("ダンジョンは街より暗い(乗算tintのチャンネル和が小さい)", () => {
    const channelSum = (tint: number): number =>
      ((tint >> 16) & 0xff) + ((tint >> 8) & 0xff) + (tint & 0xff);
    expect(channelSum(tileTint("dungeon-1"))).toBeLessThan(channelSum(tileTint("town")));
  });
});

describe("第2エリアの区分反映(M16-4)", () => {
  it("フレームは流用元区分と一致する(琥珀郷=town系・沈み野=field系・坑=dungeon系)", () => {
    for (const tile of tileTypeSchema.options) {
      expect(tileFrame("settlement", tile)).toBe(tileFrame("town", tile));
      expect(tileFrame("field-2", tile)).toBe(tileFrame("field", tile));
      expect(tileFrame("dungeon-4", tile)).toBe(tileFrame("dungeon-1", tile));
    }
    for (const southIsWall of [false, true]) {
      expect(wallFrame("settlement", southIsWall)).toBe(wallFrame("town", southIsWall));
      expect(wallFrame("field-2", southIsWall)).toBe(wallFrame("field", southIsWall));
      expect(wallFrame("dungeon-4", southIsWall)).toBe(wallFrame("dungeon-1", southIsWall));
    }
  });

  it("tintは流用元区分と異なる(土地の空気の差別化)", () => {
    expect(tileTint("settlement")).not.toBe(tileTint("town"));
    expect(tileTint("field-2")).not.toBe(tileTint("field"));
    expect(tileTint("dungeon-4")).not.toBe(tileTint("dungeon-1"));
  });
});
