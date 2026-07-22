# prop-chest

- Asset: `assets/sprites/prop-chest.png`
- Kind: map sprite
- Prop: 宝箱
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ac9-38bc-74d3-983c-52e3ec53f309/ig_0f12c91b46099d95016a4c7fd9ec0881919ee4a1834d57c2d9.png`

## 仕様典拠

M13-2依頼:

> prop-chest(宝箱: 鉄枠の木箱・閉じた状態)

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld prop sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG after chroma-key removal, displayed at 32px over dark map tiles.
Asset id: prop-chest.
Primary request: Create a one-tile map prop: a closed treasure chest, an iron-framed wooden box for dark field/dungeon maps.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a front-facing prop portrait. The chest sits on the ground and is seen from a high camera looking down, like a JRPG map object. Show mostly the lid top plane, iron bands, side edges, and small front latch compressed below. Closed state only.
Subject: one closed wooden treasure chest with dark weathered planks and simple iron frame/bands. No open lid, no treasure, no glow, no coins, no key, no lock symbol beyond a plain small latch.
Map readability: bold simplified silhouette for 32px display. Clear rectangular box, rounded lid edge, two or three iron bands, simple latch. Avoid tiny rivets and ornate decorations.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey shadows, tiny amber edge warmth, melancholic dreamlike atmosphere, harmonized with the visible adopted top-down sprite-player and other sprite-* assets.
Palette: dark weathered brown wood, charcoal iron, ash grey, blue-grey shadows, tiny muted amber highlights; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single prop centered in a square frame with generous padding. One-tile prop scale, smaller than character sprites; no crop, no frame, no UI, no ground plane, no cast shadow, no contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The actual image background must be pure bright green (#00ff00), one uniform flat color, not black and not transparent. No shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: closed chest only. No letters, numbers, runes, icon marks, watermark, logo, frame, UI, skulls, weapons, extra scenery, coins, gems, or contents. Not pixel art.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過後、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(55, 70, 200, 186)`。四隅alphaは0、可視緑フリンジなし。

