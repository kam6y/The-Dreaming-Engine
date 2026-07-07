# symbol-candle-eater

- Asset: `assets/sprites/symbol-candle-eater.png`
- Kind: map sprite
- Enemy: 蝋燭喰らい(ろうそくくらい)
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ac9-38bc-74d3-983c-52e3ec53f309/ig_085364d834172264016a4c80aa234481918ba2d7dff1e13b36.png`

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 溶けた蝋のような体に、小さな火を宿す

## 戦闘グラフィックとの同一個体性

`assets/enemies/candle-eater.png` の溶けた蝋の体と小さな琥珀の火を保持した。マップ上では顔や腕に見える要素を避け、真上から見た蝋だまりと中央の芯火へ簡略化した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG after chroma-key removal, displayed at 32px over dark map tiles.
Asset id: symbol-candle-eater.
Primary request: Regenerate a simplified map symbol for Candle Eater (蝋燭喰らい), the same entity as the visible reference battle graphic assets/enemies/candle-eater.png, but redesigned as a small top-down overworld marker.
Lore source: a small nightmare with a body like melted wax, carrying a small flame; it survives by eating the light of fading candlesticks and mistakes light-keepers for enemies.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait, not a side-view battle monster. The creature is a squat melted wax puddle on the ground seen from directly above. Show a smooth rounded wax pool with layered drips around the edge and one tiny central amber flame in a shallow wax depression. Very compressed height, no vertical torso.
Hard shape constraint: ABSOLUTELY NO FACE. No eyes, no eye sockets, no mouth, no nose, no skull-like holes, no dark side cavities, no expression, no humanoid head. Do not place paired dark spots anywhere on the wax. The body must read as melted wax and pooled candle drips only.
Map readability: bold simplified silhouette for 32px display. One clear pale wax puddle/blob, central flame dot, broad rounded drips and puddle edge. Avoid tiny wax strands or elaborate folds that blur when downscaled.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey shadows, dim candlelight, melancholic dreamlike atmosphere, harmonized with the visible adopted top-down sprite-player and other sprite-* assets rather than the detailed battle pose.
Palette: desaturated ivory wax, greyed beige, ash grey and blue-grey shadows, one small muted amber flame; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single enemy symbol centered in a square frame with generous padding. Normal enemy symbol scale, slightly smaller presence than sprite-player; no crop, no frame, no UI, no ground plane, no cast shadow, no contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 4 exactly. Do not add a lantern, candlestick, weapon, clothing, skulls, blood, gore, runes, symbols, text, watermark, logo, frame, or UI. Not an eye-level 3/4 battle illustration. Not pixel art.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- 初回・2回目は蝋のくぼみが顔の目や口に見えやすかったため不採用。採用版では「顔・目・口・暗い対のくぼみなし」を強めた。
- `remove_chroma_key.py` で背景を透過後、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(48, 62, 208, 193)`。四隅alphaは0、可視緑フリンジなし。

