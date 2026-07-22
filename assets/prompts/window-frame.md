# window-frame

- Asset: `assets/ui/window-frame.png`
- Kind: UI decoration
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool + chroma-key removal
- Final size: 1024x512 PNG (RGBA, background transparent)

## 仕様典拠

`docs/spec/asset-pipeline.md`:

- UI装飾はシンプルにする。
- 世界観はダークファンタジー、青灰の霧と琥珀の灯りを基調にする。
- 文字を画像内に焼き込まない。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: game UI window frame, final intended size about 1024x512
Primary request: a simple conversation/menu window frame for a dark fantasy RPG, with the entire center empty for transparency after chroma-key removal; decoration only on the four corners and thin edges, understated and usable in-game
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background filling the outside and the empty center for local background removal
Subject: a rectangular blue-grey wrought metal and aged stone frame, subtle engraved gear teeth and candlelit amber accents at the corners, thin bevels, quiet gothic-mechanical details
Style/medium: painterly game UI ornament, clean production asset, not a mockup, no scene behind it
Composition/framing: landscape 2:1 frame, centered, generous margin, hollow rectangular center left as pure #ff00ff, crisp continuous silhouette
Lighting/mood: dim candlelight, blue-grey mist tone, melancholic dreamlike dark fantasy
Color palette: muted blue-grey metal/stone with small amber glow accents; do not use green; do not use magenta in the subject
Materials/textures: aged iron, dark slate, restrained brass/amber inlays, slightly worn edges
Constraints: no text, no letters, no numbers, no watermark, no logos; background must be one perfectly uniform #ff00ff with no gradients, no shadows, no floor plane, no reflections, no texture; keep the center and all non-frame areas flat #ff00ff only; crisp edges for alpha extraction; simple and restrained, not ornate or busy
```

## 生成メモ

- Image Gen出力をフラットなマゼンタクロマキー背景で生成。
- `remove_chroma_key.py` で背景と中央部を透過し、`assets/ui/window-frame.png` に保存。
- Pillowで1024x512に正規化。
- 会話・メニュー用に中央を透過、四隅と縁だけに青灰の金属装飾と琥珀の灯りを残した。
