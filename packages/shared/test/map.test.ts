import { describe, expect, it } from "vitest";

import {
  dungeon3Map,
  interactionTarget,
  isSolidTileType,
  isWalkable,
  isWallLike,
  mapDefinitionSchema,
  tileTypeAt,
  transitionAt,
  tryMove
} from "../src/index.js";
import type { MapDefinition } from "../src/index.js";

// ロジック検証用の小さなマップ(5x5)。
//   #####
//   #...#   (2,1)にNPC / (1,3)に看板 / (3,3)に遷移
//   #.#.#   (2,2)は壁
//   #...#
//   #####
const sampleRaw = {
  id: "town",
  displayName: "テスト街",
  width: 5,
  height: 5,
  rows: ["#####", "#...#", "#.#.#", "#...#", "#####"],
  safe: true,
  transitions: [
    { position: { x: 3, y: 3 }, to: { mapId: "field", position: { x: 1, y: 1 }, facing: "down" } }
  ],
  npcs: [{ id: "innkeeper", position: { x: 2, y: 1 }, facing: "down" }],
  objects: [{ id: "sign-1", kind: "sign", position: { x: 1, y: 3 }, message: "看板だ。" }]
} as const;

const sampleMap: MapDefinition = mapDefinitionSchema.parse(sampleRaw);

describe("tileTypeAt / 衝突", () => {
  it("種別ごとのsolid判定", () => {
    expect(isSolidTileType("wall")).toBe(true);
    expect(isSolidTileType("water")).toBe(true);
    expect(isSolidTileType("floor")).toBe(false);
    expect(isSolidTileType("road")).toBe(false);
    expect(isSolidTileType("grass")).toBe(false);
  });

  it("座標からタイル種別を取得(範囲外はundefined)", () => {
    expect(tileTypeAt(sampleMap, { x: 1, y: 1 })).toBe("floor");
    expect(tileTypeAt(sampleMap, { x: 0, y: 0 })).toBe("wall");
    expect(tileTypeAt(sampleMap, { x: 2, y: 2 })).toBe("wall");
    expect(tileTypeAt(sampleMap, { x: 5, y: 5 })).toBeUndefined();
  });
});

describe("isWallLike(壁の向き差分・M14)", () => {
  it("壁マスは true", () => {
    expect(isWallLike(sampleMap, { x: 0, y: 0 })).toBe(true); // 外周壁
    expect(isWallLike(sampleMap, { x: 2, y: 2 })).toBe(true); // 内部の壁
  });

  it("床マスは false", () => {
    expect(isWallLike(sampleMap, { x: 1, y: 1 })).toBe(false);
  });

  it("範囲外は壁扱いで true(境界を壁の続きとして描く)", () => {
    expect(isWallLike(sampleMap, { x: 5, y: 5 })).toBe(true);
    expect(isWallLike(sampleMap, { x: -1, y: 2 })).toBe(true);
    expect(isWallLike(sampleMap, { x: 2, y: 5 })).toBe(true); // 南端の外側
  });
});

describe("mapDefinitionSchema パース", () => {
  it("正常なマップを受理する", () => {
    expect(() => mapDefinitionSchema.parse(sampleRaw)).not.toThrow();
  });

  it("行数がheightと一致しないと失敗", () => {
    expect(() => mapDefinitionSchema.parse({ ...sampleRaw, height: 4 })).toThrow();
  });

  it("行幅がwidthと一致しないと失敗", () => {
    expect(() =>
      mapDefinitionSchema.parse({ ...sampleRaw, rows: ["#####", "#..#", "#.#.#", "#...#", "#####"] })
    ).toThrow();
  });

  it("未知のタイル文字は失敗", () => {
    expect(() =>
      mapDefinitionSchema.parse({ ...sampleRaw, rows: ["#####", "#.X.#", "#.#.#", "#...#", "#####"] })
    ).toThrow();
  });

  it("範囲外のNPC配置は失敗", () => {
    expect(() =>
      mapDefinitionSchema.parse({
        ...sampleRaw,
        npcs: [{ id: "innkeeper", position: { x: 9, y: 9 }, facing: "down" }]
      })
    ).toThrow();
  });

  it("通行不能タイル上のNPC配置は失敗", () => {
    expect(() =>
      mapDefinitionSchema.parse({
        ...sampleRaw,
        npcs: [{ id: "innkeeper", position: { x: 2, y: 2 }, facing: "down" }]
      })
    ).toThrow();
  });

  it("占有マスの重複(NPCとオブジェクトが同一マス)は失敗", () => {
    expect(() =>
      mapDefinitionSchema.parse({
        ...sampleRaw,
        objects: [{ id: "sign-1", kind: "sign", position: { x: 2, y: 1 }, message: "被り" }]
      })
    ).toThrow();
  });

  it("安全地帯に敵シンボル(max>0)を置くと失敗", () => {
    expect(() =>
      mapDefinitionSchema.parse({
        ...sampleRaw,
        enemySymbols: { min: 2, max: 3, species: ["mist-wolf"] }
      })
    ).toThrow();
  });
});

describe("isWalkable", () => {
  it("床は通行可、壁・境界・範囲外は不可", () => {
    expect(isWalkable(sampleMap, { x: 1, y: 1 })).toBe(true);
    expect(isWalkable(sampleMap, { x: 2, y: 2 })).toBe(false); // 壁
    expect(isWalkable(sampleMap, { x: 0, y: 0 })).toBe(false); // 境界壁
    expect(isWalkable(sampleMap, { x: 5, y: 5 })).toBe(false); // 範囲外
  });

  it("NPC占有マスは通行不可", () => {
    expect(isWalkable(sampleMap, { x: 2, y: 1 })).toBe(false);
  });

  it("オブジェクト占有マスは通行不可", () => {
    expect(isWalkable(sampleMap, { x: 1, y: 3 })).toBe(false);
  });
});

describe("tryMove", () => {
  it("空きマスへは移動できる", () => {
    expect(tryMove(sampleMap, { x: 1, y: 1 }, "down")).toEqual({
      moved: true,
      position: { x: 1, y: 2 }
    });
  });

  it("壁へは移動できず位置が据え置かれる", () => {
    expect(tryMove(sampleMap, { x: 1, y: 1 }, "up")).toEqual({
      moved: false,
      position: { x: 1, y: 1 }
    });
    expect(tryMove(sampleMap, { x: 1, y: 2 }, "right")).toEqual({
      moved: false,
      position: { x: 1, y: 2 }
    });
  });

  it("NPCのいるマスへは移動できない", () => {
    expect(tryMove(sampleMap, { x: 3, y: 1 }, "left")).toEqual({
      moved: false,
      position: { x: 3, y: 1 }
    });
  });
});

describe("transitionAt", () => {
  it("遷移マス上では遷移情報を返す", () => {
    const t = transitionAt(sampleMap, { x: 3, y: 3 });
    expect(t?.to.mapId).toBe("field");
    expect(t?.to.position).toEqual({ x: 1, y: 1 });
    expect(t?.to.facing).toBe("down");
  });

  it("遷移マス以外ではnull", () => {
    expect(transitionAt(sampleMap, { x: 1, y: 1 })).toBeNull();
  });
});

describe("interactionTarget(向きごと)", () => {
  it("正面のNPCを返す", () => {
    const target = interactionTarget(sampleMap, { x: 1, y: 1 }, "right");
    expect(target).not.toBeNull();
    expect(target?.kind).toBe("npc");
    if (target?.kind === "npc") expect(target.npc.id).toBe("innkeeper");
  });

  it("正面のオブジェクトを返す", () => {
    const target = interactionTarget(sampleMap, { x: 1, y: 2 }, "down");
    expect(target?.kind).toBe("object");
    if (target?.kind === "object") expect(target.object.id).toBe("sign-1");
  });

  it("正面が壁や空きマスならnull", () => {
    expect(interactionTarget(sampleMap, { x: 2, y: 3 }, "up")).toBeNull(); // 前は壁(2,2)
    expect(interactionTarget(sampleMap, { x: 1, y: 1 }, "down")).toBeNull(); // 前は空き床
  });

  it("正面のボスを返す(三層マップ)", () => {
    const target = interactionTarget(dungeon3Map, { x: 11, y: 12 }, "down");
    expect(target?.kind).toBe("boss");
    if (target?.kind === "boss") expect(target.boss.enemyId).toBe("dream-eater");
  });
});
