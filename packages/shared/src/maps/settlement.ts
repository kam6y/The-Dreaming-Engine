import { mapDefinitionSchema } from "../map.js";
import type { MapDefinition } from "../map.js";
import { GridBuilder } from "./builder.js";

// 集落「琥珀郷(こはくごう)」— 消えた灯(琥珀=灯の亡骸)で生きてきた寂れた郷(world-lore.md 2.4)。
// 安全地帯(エンカウントなし)。南門で沈み野へ、東縁の封じられた坑口で灯還りの坑へ。
// NPC(世話役イルマ・職人ガロ・番人トワ)は M16-3 で配置する(ここでは空)。
const WIDTH = 16;
const HEIGHT = 12;

const grid = new GridBuilder(WIDTH, HEIGHT, ".");
grid.border("#");
// 施設(壁ブロック)。寄り屋(左上)・琥珀工房(右上)
grid.rect(2, 2, 5, 3, "#"); // 寄り屋(世話役イルマの寄り合い所兼宿)
grid.rect(10, 2, 12, 3, "#"); // 琥珀工房(職人ガロの店)
// 目抜き通り(南門 ↔ 郷の中)と、坑口へ折れる東の道
grid.vLine(8, 1, 10, "=");
grid.hLine(6, 9, 15, "=");
grid.set(8, 11, "="); // 南の門(沈み野へ)
grid.set(15, 6, "="); // 坑口(郷はずれの封じられた採掘坑。灯還りの坑へ)

export const settlementMap: MapDefinition = mapDefinitionSchema.parse({
  id: "settlement",
  displayName: "琥珀郷",
  width: WIDTH,
  height: HEIGHT,
  rows: grid.rows(),
  safe: true,
  transitions: [
    // 南の門 → 沈み野(北門の一つ内側へ着地)
    {
      position: { x: 8, y: 11 },
      to: { mapId: "field-2", position: { x: 11, y: 1 }, facing: "down" }
    },
    // 坑口 → 灯還りの坑(入口の一つ内側へ着地)
    {
      position: { x: 15, y: 6 },
      to: { mapId: "dungeon-4", position: { x: 11, y: 1 }, facing: "down" }
    }
  ],
  npcs: [],
  objects: [
    { id: "settlement-sign-inn", kind: "sign", position: { x: 3, y: 4 }, message: "寄り屋。大きな囲炉裏と、壁際に並ぶ空の寝台。旅人はここで一夜を借りられる。" },
    { id: "settlement-sign-shop", kind: "sign", position: { x: 10, y: 4 }, message: "琥珀工房。研ぎ台の上で灯の亡骸が鈍く光る。旅の道具と薬、細工が少し並ぶ。" },
    { id: "settlement-sign-mine", kind: "sign", position: { x: 14, y: 5 }, message: "坑口。板と鎖で幾重にも封じられている。かつて灯の亡骸を採った坑だという。" }
  ]
  // 安全地帯のため enemySymbols は持たない(mapDefinitionSchema の safe 検証と整合)
});
