# prop-gather

- Asset: `assets/sprites/prop-gather.png`
- Kind: map sprite
- Prop: 採取ポイント
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ac9-38bc-74d3-983c-52e3ec53f309/ig_0f12c91b46099d95016a4c80062b2481919f5e14ea7eb76063.png`

## 仕様典拠

M13-2依頼:

> prop-gather(採取ポイント: 淡く灯る夢の草花の群生)

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld prop sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG after chroma-key removal, displayed at 32px over dark map tiles.
Asset id: prop-gather.
Primary request: Create a one-tile map prop: a gathering point, a small cluster of softly glowing dream grass and flowers for the field map.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a front-facing plant portrait. The plant cluster grows on the ground and is seen from a high camera looking down, like a JRPG map object. Show a compact circular tuft of short grass blades and tiny flowers from above, with a low mound silhouette.
Subject: one small cluster of dreamlike grasses and flowers, pale blue-grey leaves, tiny ivory flower buds, and a faint muted amber glow at a few centers. It should read as an interactable gathering point, but without symbols or UI marks.
Map readability: bold simplified silhouette for 32px display. Compact tuft, 5 to 7 broad leaf shapes, 3 tiny glow points, clear outline. Avoid many thin blades that disappear when downscaled.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey mist, tiny amber dreamlight, melancholic atmosphere, harmonized with the visible adopted top-down sprite-player and other sprite-* assets.
Palette: blue-grey leaves, ash grey stems, pale ivory buds, tiny muted amber glow; avoid saturated colors, avoid bright natural green, and avoid any #00ff00 in the subject.
Composition/framing: one single prop centered in a square frame with generous padding. One-tile prop scale, smaller than character sprites; no crop, no frame, no UI, no ground plane, no cast shadow, no contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The actual image background must be pure bright green (#00ff00), one uniform flat color, not black and not transparent. No shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: no letters, numbers, runes, icon marks, exclamation marks, sparkly UI symbols, watermark, logo, frame, UI, mushrooms, skulls, weapons, or extra scenery. Not pixel art.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過後、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(58, 55, 198, 200)`。四隅alphaは0、可視緑フリンジなし。

