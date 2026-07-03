# cursor

- Asset: `assets/ui/cursor.png`
- Kind: UI decoration
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool + chroma-key removal
- Final size: 128x128 PNG (RGBA, background transparent)

## 仕様典拠

`docs/spec/asset-pipeline.md`:

- UI装飾はシンプルにする。
- 世界観はダークファンタジー、青灰の霧と琥珀の灯りを基調にする。
- 文字を画像内に焼き込まない。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: game UI selection cursor, final intended size about 128x128, transparent after chroma-key removal
Primary request: a small selection cursor for a dark fantasy RPG menu, shaped like a compact amber lantern flame set into a tiny gear-and-arrow motif; clear silhouette at small size
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal
Subject: a small amber glow cursor with a brass gear crescent and short blue-grey iron pointer/chevron, no text
Style/medium: painterly game UI icon, clean production asset, not a mockup
Composition/framing: centered icon with generous padding, roughly triangular/chevron cursor silhouette pointing right, readable at 128x128, crisp edges
Lighting/mood: dim candlelit amber glow against cool blue-grey metal, melancholic dreamlike dark fantasy
Color palette: muted blue-grey iron, dark slate, aged brass, small warm amber light; do not use green in the subject
Materials/textures: aged brass gear teeth, dark iron bevel, small candle/ember glow
Constraints: no text, no letters, no numbers, no watermark, no logos; background must be one perfectly uniform #00ff00 with no gradients, no shadows, no floor plane, no reflections, no texture; no cast shadow; crisp silhouette and generous padding for alpha extraction; simple and restrained
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、`assets/ui/cursor.png` に保存。
- Pillowで128x128に正規化。
- 選択カーソルとして、右向きの青灰金属ポインタ、歯車、琥珀の灯りを小さくまとめた。
