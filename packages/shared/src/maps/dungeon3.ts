import { mapDefinitionSchema } from "../map.js";
import type { MapDefinition } from "../map.js";
import { GridBuilder } from "./builder.js";

// ダンジョン「夢喰いの裂け目」三層(最深部)— 壊死がむき出しの、青灰と漆黒の世界。
// 北の階段から回廊を下り、最奥の広間に夢喰いが在る。下り階段はない(最深部)。
const WIDTH = 22;
const HEIGHT = 16;

const grid = new GridBuilder(WIDTH, HEIGHT, ".");
grid.border("#");
// 最奥の広間へ下る回廊
grid.vLine(11, 1, 11, "=");
grid.set(11, 0, "="); // 北の階段(二層へ)
// 回廊脇の壊死した隔壁(col11は塞がない)
grid.rect(4, 3, 4, 8, "#");
grid.rect(4, 8, 8, 8, "#");
grid.rect(17, 3, 17, 8, "#");
grid.rect(13, 8, 17, 8, "#");
// 最奥の広間(床の開けた空間)
grid.rect(5, 11, 16, 14, ".");

export const dungeon3Map: MapDefinition = mapDefinitionSchema.parse({
  id: "dungeon-3",
  displayName: "夢喰いの裂け目 最深部",
  width: WIDTH,
  height: HEIGHT,
  rows: grid.rows(),
  safe: false,
  transitions: [
    // 北の階段 → 二層
    {
      position: { x: 11, y: 0 },
      to: { mapId: "dungeon-2", position: { x: 11, y: 14 }, facing: "up" }
    }
  ],
  npcs: [],
  objects: [
    { id: "d3-sign", kind: "sign", position: { x: 8, y: 12 }, message: "重い唸りのような静寂。奥に、うずくまる巨躯の輪郭が見える。" }
  ],
  boss: { position: { x: 11, y: 13 }, enemyId: "dream-eater" },
  // 軋み人形 + 錆喰い(M10。最深部の壊死帯の雑魚2種。レンジ2-6は不変)
  enemySymbols: { min: 2, max: 6, species: ["creaking-doll", "rust-eater"] }
});
