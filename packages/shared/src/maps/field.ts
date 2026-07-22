import { mapDefinitionSchema } from "../map.js";
import type { MapDefinition } from "../map.js";
import { GridBuilder } from "./builder.js";

// フィールド「忘れ野(わすれの)」— 街とダンジョンを結ぶ荒野。
// 枯れ草(grass)の原に、崩れた石垣(壁)と小さな水たまり(水)。中央を道が貫く。
const WIDTH = 24;
const HEIGHT = 16;

const grid = new GridBuilder(WIDTH, HEIGHT, ",");
grid.border("#");
// 縦断する道(北の門↔南の門)
grid.vLine(11, 1, 14, "=");
grid.set(11, 0, "="); // 北の門(街へ)
grid.set(11, 15, "="); // 南の門(裂け目一層へ)
// 西の門(第2エリア=沈み野へ。M16)。既存の縦断道 x=11 から y=8 の横枝を1本伸ばす。
// 北門・南門・敵シンボル・既存E2Eの縦断路(x=11)は不変(追加のみ)。
grid.hLine(8, 1, 10, "="); // 縦断道 (11,8) ↔ 西門への横枝
grid.set(0, 8, "="); // 西の門(沈み野へ)
// 崩れた石垣(道col11を避けて配置)
grid.rect(3, 3, 4, 4, "#");
grid.rect(18, 5, 19, 6, "#");
grid.rect(6, 9, 7, 10, "#");
// 水たまり
grid.rect(16, 10, 18, 12, "~");

export const fieldMap: MapDefinition = mapDefinitionSchema.parse({
  id: "field",
  displayName: "忘れ野",
  width: WIDTH,
  height: HEIGHT,
  rows: grid.rows(),
  safe: false,
  transitions: [
    // 北の門 → 灯町
    {
      position: { x: 11, y: 0 },
      to: { mapId: "town", position: { x: 11, y: 13 }, facing: "up" }
    },
    // 南の門 → 夢喰いの裂け目 一層
    {
      position: { x: 11, y: 15 },
      to: { mapId: "dungeon-1", position: { x: 11, y: 1 }, facing: "down" }
    },
    // 西の門 → 沈み野(第2エリア。M16)。到着は沈み野・東門の一つ内側
    {
      position: { x: 0, y: 8 },
      to: { mapId: "field-2", position: { x: 22, y: 8 }, facing: "left" }
    }
  ],
  npcs: [],
  objects: [
    { id: "field-gather-herb", kind: "gather", position: { x: 6, y: 6 }, message: "淡い燐光を帯びた薬草が揺れている。摘めそうだ。" },
    { id: "field-gather-ore", kind: "gather", position: { x: 18, y: 3 }, message: "崩れた岩の間に、鈍く光る鉱石の露頭がある。" },
    { id: "field-sign-post", kind: "sign", position: { x: 5, y: 12 }, message: "朽ちた道標。文字は掠れ、行き先はもう読めない。" }
  ],
  // 霧狼 + 迷い火(M10。序盤帯の雑魚2種。レンジ2-3は不変)
  enemySymbols: { min: 2, max: 3, species: ["mist-wolf", "wisp-flame"] }
});
