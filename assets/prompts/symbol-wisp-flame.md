# symbol-wisp-flame

- Asset: `assets/sprites/symbol-wisp-flame.png`
- Kind: map sprite
- Enemy: 迷い火(まよいび)
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ac9-38bc-74d3-983c-52e3ec53f309/ig_0f12c91b46099d95016a4c7df46ae481918f490b84036f38e8.png`

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 芯を失った青白い小さな炎が、忘れ野の霧の中をふらふらと漂う。時折その芯に、消えかけた燈心の影が透ける

## 戦闘グラフィックとの同一個体性

`assets/enemies/wisp-flame.png` の青白い炎、中心の消えかけた燈心の影、わずかな琥珀の芯を保持した。32px表示で読めるよう炎の細い揺らぎを減らし、縦長すぎない小さな火の塊へ簡略化した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG after chroma-key removal, displayed at 32px over dark map tiles.
Asset id: symbol-wisp-flame.
Primary request: Create a simplified map symbol for Wisp Flame (迷い火), the same entity as the visible reference battle graphic assets/enemies/wisp-flame.png, but redesigned as a tiny top-down overworld marker.
Lore source: a small pale blue-white flame that has lost its core, drifting unsteadily in the mist; the shadow of a fading lamp wick is sometimes visible in the core. It is forlorn and clinging, not savage.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW. Because this is a floating flame, make it read as a small hovering map token seen from above: a compact oval teardrop of pale fire, with the brightest rim forming a clear top-down silhouette and a faint dark wick-shadow visible in the center. Not a tall portrait flame filling the whole canvas.
Map readability: bold simplified flame silhouette for 32px display. One clear pale blue-white flame shape, soft but readable edge, small amber core/wick mark. Avoid delicate filaments that vanish when downscaled.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, cool blue-grey vapor, melancholic dreamlike atmosphere, harmonized with the visible adopted top-down sprite-player and other sprite-* assets.
Palette: pale blue-white fire, blue-grey vapor, ash grey wick shadow, tiny muted amber ember in the core only; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single small floating enemy symbol centered in a square frame with generous padding. Normal enemy symbol scale, smaller presence than sprite-player; no crop, no frame, no UI, no ground plane, no cast shadow, no contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The actual image background must be pure bright green (#00ff00), one uniform flat color, not black, not grey, and not transparent. No shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 4.1 exactly. Do not add a face, eyes, skull, horns, hands, wings, body, lantern, candlestick, runes, symbols, text, watermark, logo, frame, or UI. Not a front-facing battle illustration. Not pixel art.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過後、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(84, 50, 172, 205)`。四隅alphaは0、可視緑フリンジなし。

