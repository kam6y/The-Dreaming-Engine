import { mapDefinitionSchema } from "../map.js";
import type { MapDefinition } from "../map.js";
import { GridBuilder } from "./builder.js";

// ダンジョン「夢喰いの裂け目」一層 — まだ夢の形を保つ、霧に沈んだ回廊。
const WIDTH = 22;
const HEIGHT = 15;

const grid = new GridBuilder(WIDTH, HEIGHT, ".");
grid.border("#");
// 縦断する回廊(北の門↔南の階段)
grid.vLine(11, 1, 13, "=");
grid.set(11, 0, "="); // 北の門(忘れ野へ)
grid.set(11, 14, "="); // 南の階段(二層へ)
// 仕切り壁(小部屋と通路。回廊col11は塞がない)
grid.rect(3, 3, 8, 3, "#");
grid.rect(3, 4, 3, 8, "#");
grid.rect(14, 5, 18, 5, "#");
grid.rect(14, 6, 14, 10, "#");
grid.rect(5, 10, 9, 10, "#");

export const dungeon1Map: MapDefinition = mapDefinitionSchema.parse({
  id: "dungeon-1",
  displayName: "夢喰いの裂け目 一層",
  width: WIDTH,
  height: HEIGHT,
  rows: grid.rows(),
  safe: false,
  transitions: [
    // 北の門 → 忘れ野
    {
      position: { x: 11, y: 0 },
      to: { mapId: "field", position: { x: 11, y: 14 }, facing: "up" }
    },
    // 南の階段 → 二層
    {
      position: { x: 11, y: 14 },
      to: { mapId: "dungeon-2", position: { x: 11, y: 1 }, facing: "down" }
    }
  ],
  npcs: [],
  objects: [
    { id: "d1-chest", kind: "chest", position: { x: 5, y: 5 }, message: "消えかけた燭台の傍に、埃をかぶった小箱がある。" },
    { id: "d1-sign", kind: "sign", position: { x: 16, y: 8 }, message: "壁に刻まれた古い印。『灯を絶やすな』と読める。" }
  ],
  // 蝋燭喰らい + 囁き仮面(M10。浅層帯の雑魚2種。レンジ2-6は不変)
  enemySymbols: { min: 2, max: 6, species: ["candle-eater", "whisper-mask"] }
});
