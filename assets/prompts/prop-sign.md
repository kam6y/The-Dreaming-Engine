# prop-sign

- Asset: `assets/sprites/prop-sign.png`
- Kind: map sprite
- Prop: 木の立て札
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ac9-38bc-74d3-983c-52e3ec53f309/ig_0f12c91b46099d95016a4c7faee6288191bef4fc9eecb45662.png`

## 仕様典拠

M13-2依頼:

> prop-sign(看板: 木の立て札)

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld prop sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG after chroma-key removal, displayed at 32px over dark map tiles.
Asset id: prop-sign.
Primary request: Create a one-tile map prop: a small wooden signpost / standing signboard for the dark field and town maps.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a front-facing prop portrait. The sign is standing on the ground but seen from a high camera looking down, like a JRPG map object. Show the top edge of the wooden board, short post, and small base from above; compressed height and compact silhouette.
Subject: one simple weathered wooden standing sign: a dark plank board on a short post, no readable writing, no symbols, no arrows, no nails large enough to read as decoration. Slightly worn edges only.
Map readability: bold simplified silhouette for 32px display. One clear plank rectangle, one short post, sturdy outline. Avoid tiny wood grain and ornate carving.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey shadows, tiny amber edge warmth, melancholic dreamlike atmosphere, harmonized with the visible adopted top-down sprite-player and other sprite-* assets.
Palette: dark weathered brown wood, ash grey, blue-grey shadows, tiny muted amber highlight; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single prop centered in a square frame with generous padding. One-tile prop scale, smaller than character sprites; no crop, no frame, no UI, no ground plane, no cast shadow, no contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The actual image background must be pure bright green (#00ff00), one uniform flat color, not black and not transparent. No shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: no letters, numbers, runes, icon marks, arrows, watermark, logo, frame, UI, lanterns, skulls, weapons, or extra scenery. Not pixel art.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過後、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(60, 75, 195, 181)`。四隅alphaは0、可視緑フリンジなし。

