# symbol-mist-wolf

- Asset: `assets/sprites/symbol-mist-wolf.png`
- Kind: map sprite
- Enemy: 霧狼(きりおおかみ)
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ac9-38bc-74d3-983c-52e3ec53f309/ig_05b7e3d14ebafb0f016a4c7daebf708191b804493c0fe41c51.png`

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 輪郭の滲んだ、灰色の狼のような影

## 戦闘グラフィックとの同一個体性

`assets/enemies/mist-wolf.png` の灰色の狼影、青灰の霧へほどける輪郭、わずかな琥珀の縁光を保持した。戦闘用の横向き獣シルエットではなく、背中・頭・尾を上から読むマップシンボルに単純化した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG after chroma-key removal, displayed at 32px over dark map tiles.
Asset id: symbol-mist-wolf.
Primary request: Create a simplified map symbol for Mist Wolf (霧狼), the same entity as the visible reference battle graphic assets/enemies/mist-wolf.png, but redesigned as a small top-down overworld marker.
Lore source: a grey wolf-like shadow with blurred, bleeding outlines; a small tear in the dream that took an animal form, wandering rather than purely savage.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait, not a side-view battle monster. The wolf is on the ground seen from a high camera looking down, like a JRPG map enemy symbol. Show mostly the smoky back, head and shoulders from above, with small legs and paws tucked underneath. The head and spine silhouette should read clearly from overhead.
Map readability: bold simplified silhouette for 32px display. Compact low wolf shape, clear head/back/tail mass, mist-frayed edges kept broad rather than wispy. Strong readable outline/value separation on dark tiles. No tiny fur detail.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey mist, melancholic dreamlike atmosphere, harmonized with the visible adopted top-down sprite-player and other sprite-* assets rather than the detailed battle pose.
Palette: charcoal grey, ash grey, blue-grey vapor, tiny muted amber edge accents only; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single enemy symbol centered in a square frame with generous padding. Normal enemy symbol scale, slightly smaller presence than sprite-player; no crop, no frame, no UI, no ground plane, no cast shadow, no contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 4 exactly. Do not invent horns, chains, wounds, skulls, armor, symbols, runes, text, watermark, logo, frame, or UI. Not an eye-level 3/4 battle illustration. Not pixel art.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過後、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(87, 36, 174, 220)`。四隅alphaは0、可視緑フリンジなし。

