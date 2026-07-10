import { mapDefinitionSchema } from "../map.js";
import type { MapDefinition } from "../map.js";
import { GridBuilder } from "./builder.js";

// 街「灯町(ともしまち)」— 拠点。安全地帯(エンカウントなし)。
// 中央に十字の道、四隅寄りに宿屋・商店・酒場・教会。南の門からフィールドへ。
const WIDTH = 22;
const HEIGHT = 15;

const grid = new GridBuilder(WIDTH, HEIGHT, ".");
grid.border("#");
// 中央の十字路
grid.vLine(11, 1, 13, "=");
grid.hLine(7, 1, 20, "=");
// 南の門(フィールドへ)
grid.set(11, 14, "=");
// 四施設(壁ブロック)。宿屋(左上)・商店(右上)・酒場(左下)・教会(右下)
grid.rect(3, 2, 6, 3, "#"); // 灯宿
grid.rect(15, 2, 18, 3, "#"); // 渡り物屋
grid.rect(3, 11, 6, 12, "#"); // 霧笛亭
grid.rect(15, 11, 18, 12, "#"); // 灯守堂

export const townMap: MapDefinition = mapDefinitionSchema.parse({
  id: "town",
  displayName: "灯町",
  width: WIDTH,
  height: HEIGHT,
  rows: grid.rows(),
  safe: true,
  playerStart: { position: { x: 10, y: 10 }, facing: "up" },
  transitions: [
    // 南の門 → 忘れ野
    {
      position: { x: 11, y: 14 },
      to: { mapId: "field", position: { x: 11, y: 1 }, facing: "down" }
    }
  ],
  // facing は「建物を背にした向き」(M17。BACKLOG指示)。北側に建物がある者は南(down)、
  // 南側に建物がある者は北(up)を向いて通りに立つ
  npcs: [
    { id: "innkeeper", position: { x: 4, y: 4 }, facing: "down" }, // 灯宿(北)を背に
    { id: "merchant", position: { x: 16, y: 4 }, facing: "down" }, // 渡り物屋(北)を背に
    { id: "informant", position: { x: 4, y: 10 }, facing: "up" }, // 霧笛亭(南)を背に
    { id: "priest", position: { x: 16, y: 10 }, facing: "up" } // 灯守堂(南)を背に
  ],
  objects: [
    { id: "town-sign-inn", kind: "sign", position: { x: 2, y: 4 }, message: "宿屋『灯宿』。暖炉の火と、階段のきしみが迎えてくれる。" },
    { id: "town-sign-shop", kind: "sign", position: { x: 14, y: 4 }, message: "商店『渡り物屋』。旅装・薬・雑貨。産地の知れぬ品も混じる。" },
    { id: "town-sign-tavern", kind: "sign", position: { x: 2, y: 10 }, message: "酒場『霧笛亭』。噂と依頼が交わる、火の絶えぬ一角。" },
    { id: "town-sign-chapel", kind: "sign", position: { x: 14, y: 10 }, message: "教会『灯守堂』。祭壇には歯車と灯芯の紋様。" }
  ]
});
