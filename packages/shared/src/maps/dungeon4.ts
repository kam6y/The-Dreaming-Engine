import { mapDefinitionSchema } from "../map.js";
import type { MapDefinition } from "../map.js";
import { GridBuilder } from "./builder.js";

// 第2ダンジョン「灯還りの坑(ひがえりのこう)」— 琥珀郷の封じられた採掘坑(world-lore.md 2.6)。
// 層分割なしの1マップ。木組みの支保が続く坑道を下り、最奥「導管の間」に至る。
// 最奥は調べられるオブジェクト(まだ温かい導管)。ボス・中ボスは置かない(第2章の余地)。
const WIDTH = 24;
const HEIGHT = 20;

const grid = new GridBuilder(WIDTH, HEIGHT, ".");
grid.border("#");
// 主坑(縦に下る坑道)。col11 は塞がない
grid.vLine(11, 1, 18, "=");
grid.set(11, 0, "="); // 坑口(入口。琥珀郷へ)
// 木組みの支保・放棄された側室(col11 を避けて配置)
grid.rect(3, 3, 8, 3, "#");
grid.rect(3, 4, 3, 9, "#");
grid.rect(15, 4, 20, 4, "#");
grid.rect(20, 5, 20, 10, "#");
grid.rect(4, 11, 9, 11, "#");
grid.rect(14, 12, 19, 12, "#");
// 最奥「導管の間」(開けた広間。既定床だが意図を明示して床で開ける)
grid.rect(5, 15, 18, 18, ".");

export const dungeon4Map: MapDefinition = mapDefinitionSchema.parse({
  id: "dungeon-4",
  displayName: "灯還りの坑",
  width: WIDTH,
  height: HEIGHT,
  rows: grid.rows(),
  safe: false,
  transitions: [
    // 坑口 → 琥珀郷(坑口ゲートの一つ内側へ着地)
    {
      position: { x: 11, y: 0 },
      to: { mapId: "settlement", position: { x: 14, y: 6 }, facing: "left" }
    }
  ],
  npcs: [],
  objects: [
    { id: "d4-sign-adit", kind: "sign", position: { x: 6, y: 5 }, message: "木組みの支保が奥へ続く。壁に埋まった灯の亡骸が、掲げる火に応えて琥珀色に明滅する。" },
    { id: "d4-chest", kind: "chest", position: { x: 17, y: 7 }, message: "放棄された手押し車。底に灯の亡骸の細片がわずかに残っている。" },
    // 最奥「導管の間」。1.5「機関の全体像」の兆候(行き先は語らない)
    { id: "d4-conduit", kind: "sign", position: { x: 11, y: 17 }, message: "壁から無数の導管が闇の彼方へ伸びている。そのほとんどは冷えて久しいが、幾本かは今もかすかに温かい。" }
  ],
  // 蝋燭喰らい・軋み人形・錆喰い(M16。浅所に深層帯の悪夢が滲む。レンジ2-6はダンジョン標準)
  enemySymbols: { min: 2, max: 6, species: ["candle-eater", "creaking-doll", "rust-eater"] }
});
