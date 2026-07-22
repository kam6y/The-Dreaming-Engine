# symbol-whisper-mask-up

- Asset: `assets/sprites/symbol-whisper-mask-up.png`
- Kind: map sprite
- Enemy: 囁き仮面(ささやきかめん)
- Direction: up(背面・奥向き)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-whisper-mask.png`
- Secondary reference: `assets/enemies/whisper-mask.png`
- Adopted source: `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-88398dbc-15c3-412e-b0d0-8047e6ca14b8.png`

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 罅(ひび)の入った白い面(おもて)が宙に浮かぶ。裏は空洞で、口許から薄い靄がこぼれ、聞き取れない声で囁き続ける

## 同一個体性メモ

既存正面の罅入り白面、黒い空洞、青灰の靄、琥珀の縁を固定。upでは顔面を完全に隠し、白い割れた縁と空洞の裏側だけを描いた。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended for a 256x256 transparent sprite displayed at about 34px.
Asset id: symbol-whisper-mask-up.
Input images: Image 1 is the PRIMARY identity, palette, simplification, top-down camera, scale, cracks, and painterly map-sprite reference (existing down-facing symbol-whisper-mask). Image 2 is SECONDARY material and hollow-shell identity reference only.
Primary request: Render the exact same individual Whisper Mask as Image 1 facing UP, as a genuine rear view.
Lore invariant: one cracked white mask floating in air; its back is empty and hollow; thin blue-grey mist spills from it.
Direction and camera: UP means the mask's face points away toward the top of the canvas. TRUE TOP-DOWN-LEANING OVERWORLD VIEW from high above. Show the BACK of the tilted mask shell: a cracked bone-white oval rim surrounding a deep empty charcoal hollow interior, with a little blue-grey mist trailing toward the bottom. Absolutely none of the facial surface is visible: no eyes, eye openings, nose, lips, mouth, cheeks, or expression.
Identity invariants: same bone/ash white cracked shell, charcoal empty back, blue-grey mist, tiny muted amber rim accent, same low floating oval proportions, visual mass, and approximate occupied size as Image 1.
Map readability: broad pale rim plus dark hollow back, bold oval silhouette, broad cracks only, direction legible at 34px.
Style: dark fantasy painterly game asset, muted desaturated colors, blue-grey mist, dim amber edge, melancholic dreamlike atmosphere, matching Image 1 exactly.
Composition: one single low-floating mask centered with generous padding; no body, face behind it, ground, floor, cast/contact shadow, reflection, text, watermark, logo, frame, or UI.
Background: perfectly flat solid pure #00ff00 chroma-key, uniform corner-to-corner; no gradient, texture, glow spill, shadow, lighting variation, or transparency. Do not use #00ff00 in the subject.
Avoid: any front facial feature, living eyes, hair, horns, crown, weapon, armor, blood, runes, extra objects, eye-level portrait, pixel art.
```

## 後処理・検収メモ

- 正面bbox長辺155pxに合わせて透過・中央配置し、256x256 RGBAへ正規化。
- final alpha bbox: `(75, 50, 180, 205)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で白い縁と黒い背面空洞を確認。顔面特徴なし。
