import { mapDefinitionSchema } from "../map.js";
import type { MapDefinition } from "../map.js";
import { GridBuilder } from "./builder.js";

// 第2フィールド「沈み野(しずみの)」— 忘れ野の西に続く低地の荒野(world-lore.md 2.5)。
// 霧が野の底へ沈み溜まる湿地。忘れ野より綻びが濃く、裂け目の悪夢が地表に滲む。
// 東縁の門で忘れ野へ、北縁の門で琥珀郷へつながる中継地。
const WIDTH = 24;
const HEIGHT = 16;

const grid = new GridBuilder(WIDTH, HEIGHT, ",");
grid.border("#");
// L字の踏み分け道: 東門(忘れ野側)から西進し、x=11 で北門(琥珀郷側)へ折れる
grid.hLine(8, 11, 22, "="); // 東西の道(東門手前 (22,8) ↔ 縦道 x=11)
grid.vLine(11, 1, 8, "="); // 縦の道(北門手前 (11,1) ↔ 横道 y=8)
grid.set(23, 8, "="); // 東の門(忘れ野へ)
grid.set(11, 0, "="); // 北の門(琥珀郷へ)
// 崩れた石積み(道 y=8 / x=1..8 と col11 を避けて配置)
grid.rect(3, 3, 5, 4, "#");
grid.rect(16, 3, 18, 4, "#");
grid.rect(4, 11, 6, 12, "#");
// 霧の沈む水たまり(低地の情景)
grid.rect(6, 6, 8, 7, "~");
grid.rect(14, 11, 17, 13, "~");

export const field2Map: MapDefinition = mapDefinitionSchema.parse({
  id: "field-2",
  displayName: "沈み野",
  width: WIDTH,
  height: HEIGHT,
  rows: grid.rows(),
  safe: false,
  transitions: [
    // 東の門 → 忘れ野(西縁の門 (0,8) の一つ内側へ着地)
    {
      position: { x: 23, y: 8 },
      to: { mapId: "field", position: { x: 1, y: 8 }, facing: "right" }
    },
    // 北の門 → 琥珀郷(南門の一つ内側へ着地)
    {
      position: { x: 11, y: 0 },
      to: { mapId: "settlement", position: { x: 8, y: 10 }, facing: "up" }
    }
  ],
  npcs: [],
  objects: [
    // 採取ポイント(採れる物は忘れ野と同種。灯の亡骸の細片が枯れ草に混じる)
    { id: "field2-gather-herb", kind: "gather", position: { x: 4, y: 6 }, message: "白く煙る草の間に、燐光を帯びた薬草が沈むように生えている。" },
    { id: "field2-gather-ore", kind: "gather", position: { x: 19, y: 11 }, message: "枯れ草に灯の亡骸の細片が混じり、琥珀色に瞬いている。拾えそうだ。" }
  ],
  // 迷い火・囁き仮面・軋み人形(M16。深層帯の悪夢が地表に滲む構成。レンジ2-3は忘れ野と同じ)
  enemySymbols: { min: 2, max: 3, species: ["wisp-flame", "whisper-mask", "creaking-doll"] }
});
