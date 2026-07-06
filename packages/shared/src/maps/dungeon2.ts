import { mapDefinitionSchema } from "../map.js";
import type { MapDefinition } from "../map.js";
import { GridBuilder } from "./builder.js";

// ダンジョン「夢喰いの裂け目」二層 — 建材や通路の理屈が歪み始める層。
const WIDTH = 24;
const HEIGHT = 16;

const grid = new GridBuilder(WIDTH, HEIGHT, ".");
grid.border("#");
// 縦断する回廊(北の階段↔南の階段)
grid.vLine(11, 1, 14, "=");
grid.set(11, 0, "="); // 北の階段(一層へ)
grid.set(11, 15, "="); // 南の階段(三層へ)
// 歪んだ隔壁(回廊col11は塞がない)
grid.rect(3, 2, 3, 7, "#");
grid.rect(3, 7, 8, 7, "#");
grid.rect(15, 3, 20, 3, "#");
grid.rect(20, 3, 20, 9, "#");
grid.rect(5, 11, 9, 11, "#");
grid.rect(14, 11, 18, 11, "#");
grid.rect(14, 12, 14, 14, "#");

export const dungeon2Map: MapDefinition = mapDefinitionSchema.parse({
  id: "dungeon-2",
  displayName: "夢喰いの裂け目 二層",
  width: WIDTH,
  height: HEIGHT,
  rows: grid.rows(),
  safe: false,
  transitions: [
    // 北の階段 → 一層
    {
      position: { x: 11, y: 0 },
      to: { mapId: "dungeon-1", position: { x: 11, y: 13 }, facing: "up" }
    },
    // 南の階段 → 三層(最深部)
    {
      position: { x: 11, y: 15 },
      to: { mapId: "dungeon-3", position: { x: 11, y: 1 }, facing: "down" }
    }
  ],
  npcs: [],
  objects: [
    { id: "d2-sign", kind: "sign", position: { x: 6, y: 4 }, message: "同じ扉が二度現れる。夢が夢であることを、もう隠さない。" },
    { id: "d2-chest", kind: "chest", position: { x: 17, y: 6 }, message: "天井のはずの場所に、なぜか小箱が伏せて置かれている。" }
  ],
  // 蝋燭喰らい/軋み人形 + 囁き仮面/錆喰い(M10。浅層と深層をつなぐ移行帯。レンジ2-6は不変)
  enemySymbols: { min: 2, max: 6, species: ["candle-eater", "creaking-doll", "whisper-mask", "rust-eater"] },
  // 中ボス「紡ぎ損ない」(M10)。背骨道 x=11 を外れた右側の側室 (17,8) に固定配置(占有マーカー)。
  // 撃破状態はセーブ gimmicks に記録し、リスポーンしない(game-design.md「敵バリエーション(拡張: M10)」)。
  midBoss: { position: { x: 17, y: 8 }, enemyId: "failing-spinner" }
});
