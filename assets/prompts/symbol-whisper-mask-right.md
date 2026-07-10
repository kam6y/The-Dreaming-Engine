# symbol-whisper-mask-right

- Asset: `assets/sprites/symbol-whisper-mask-right.png`
- Kind: map sprite
- Enemy: 囁き仮面(ささやきかめん)
- Direction: right(右向き)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-whisper-mask.png`
- Secondary reference: `assets/enemies/whisper-mask.png`
- Adopted source: `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-b5b9decc-0962-4e1d-8ec9-2c8a10930759.png`

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 罅(ひび)の入った白い面(おもて)が宙に浮かぶ。裏は空洞で、口許から薄い靄がこぼれ、聞き取れない声で囁き続ける

## 同一個体性メモ

白い罅面、空の眼孔、黒い裏側、青灰の靄を固定。leftの鏡像は使わず、鼻梁を右、裏側を左にした低い俯瞰を個別生成した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for a 2D RPG map, displayed at about 34px.
Asset id: symbol-whisper-mask-right.
Input images: Image 1 is the PRIMARY and STRICT camera, scale, simplification, palette, and identity reference. Image 2 is SECONDARY shell material reference only; do not copy its upright portrait framing.
Primary request: Render the exact same Whisper Mask as Image 1 facing RIGHT. Generate a fresh right-facing view independently; do not mirror or flip a left-facing output.
NON-NEGOTIABLE VIEWPOINT: TRUE HIGH TOP-DOWN-LEANING OVERWORLD VIEW. The mask floats very low and nearly PARALLEL TO THE MAP GROUND PLANE, like a small oval faceplate/token seen from above. Show mostly its broad top/front surface and cracked rim, strongly foreshortened. The silhouette must be LOW and COMPACT, its horizontal width greater than its vertical canvas height. Absolutely not a vertical standing mask, eye-level face, tall profile portrait, or bust.
Direction: the foreshortened nose ridge and front tip point clearly toward the canvas right. A narrow dark hollow back edge is visible along the left side. Thin blue-grey mouth mist trails leftward/down-left. The mask's main long axis runs right-to-left.
Identity: same cracked bone/ash white shell, empty charcoal openings and rear hollow, blue-grey mist, tiny muted amber rim, same compact visual mass as Image 1. The slit is an empty mask opening, never a living eye.
Map readability: bold pale right-pointing low oval, dark left rear edge, broad cracks only, readable at 34px.
Style: muted desaturated dark fantasy painterly map sprite matching Image 1.
Composition: one centered mask, generous padding; no body, face behind, ground, shadow, reflection, text, watermark, logo, frame, UI.
Background: perfectly flat solid pure #00ff00 chroma-key, uniform corner-to-corner; no gradient, texture, lighting variation, glow spill, shadow, or transparency. Do not use #00ff00 in subject.
Avoid: mirrored left output, vertical mask, portrait orientation, eye-level side profile, living eyes, hair, horns, crown, weapon, blood, runes, extra objects, pixel art.
```

## 後処理・検収メモ

- 正面bbox長辺155pxに合わせて透過・中央配置し、256x256 RGBAへ正規化。leftとは別生成。
- final alpha bbox: `(50, 62, 205, 193)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で低い右向き面と左側の黒い裏縁を確認。
