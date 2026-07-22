# symbol-whisper-mask-left

- Asset: `assets/sprites/symbol-whisper-mask-left.png`
- Kind: map sprite
- Enemy: 囁き仮面(ささやきかめん)
- Direction: left(左向き)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-whisper-mask.png`
- Secondary reference: `assets/enemies/whisper-mask.png`
- Rejected source (trial 1): `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-ff62a1f0-fd74-43fa-ba9f-68d1a1930235.png`
- Adopted source (trial 2): `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-3efd137c-fdc8-44b9-951a-e2e0901338ee.png`

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 罅(ひび)の入った白い面(おもて)が宙に浮かぶ。裏は空洞で、口許から薄い靄がこぼれ、聞き取れない声で囁き続ける

## 同一個体性メモ

白い罅面、空の眼孔、黒い裏側、青灰の口許の靄を固定。面を地面とほぼ平行に低く浮かせ、鼻梁を左、裏側を右へ置いた。

## 試行1 生成プロンプト全文(不採用)

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended for a 256x256 transparent sprite displayed at about 34px.
Asset id: symbol-whisper-mask-left.
Input images: Image 1 is the PRIMARY identity, palette, simplification, top-down camera, scale, cracks, and painterly map-sprite reference. Image 2 is SECONDARY material and shell-profile identity reference only.
Primary request: Render the exact same individual Whisper Mask as Image 1 facing LEFT. Generate this left-facing profile independently.
Lore invariant: one cracked white mask floating in air; its back is empty and hollow; thin blue-grey mist spills from the mouth area.
Direction and camera: LEFT means the face surface, nose ridge and mask point toward the canvas left, while the open hollow back faces toward the right. TRUE TOP-DOWN-LEANING OVERWORLD VIEW from high above: show mostly the top cracked shell and a compressed left-facing side profile, with the mask floating low over the map. It must read left at 34px, not down-left and not an eye-level portrait.
Identity invariants: same bone/ash white cracked mask, charcoal hollow back edge visible on the right, blue-grey mist trailing from the mouth area toward the lower-right, tiny muted amber rim accent, same oval visual mass and approximate occupied size as Image 1. The eye slit is an empty mask opening, never a living eye.
Map readability: bold pale left-pointing profile, dark rear hollow edge, broad cracks only.
Style: dark fantasy painterly game asset, muted desaturated colors, blue-grey mist, dim amber edge, melancholic dreamlike atmosphere, matching Image 1 exactly.
Composition: one single low-floating mask centered with generous padding; no body, face behind it, ground, floor, cast/contact shadow, reflection, text, watermark, logo, frame, or UI.
Background: perfectly flat solid pure #00ff00 chroma-key, uniform corner-to-corner; no gradient, texture, glow spill, shadow, lighting variation, or transparency. Do not use #00ff00 in the subject.
Avoid: front-facing portrait, living eyes, hair, horns, crown, weapon, armor, blood, runes, extra objects, eye-level view, pixel art.
```

不採用理由: 縦に立った横顔肖像になり、真上寄りのマップ視点と一致しなかった。

## 試行2 生成プロンプト全文(採用)

```text
RETRY 2 after rejecting a tall eye-level profile portrait.
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for a 2D RPG map, displayed at about 34px.
Asset id: symbol-whisper-mask-left.
Input images: Image 1 is the PRIMARY and STRICT camera, scale, simplification, palette, and identity reference. Image 2 is SECONDARY shell material reference only; do not copy its upright portrait framing.
Primary request: Render the exact same Whisper Mask as Image 1 facing LEFT.
NON-NEGOTIABLE VIEWPOINT: TRUE HIGH TOP-DOWN-LEANING OVERWORLD VIEW. The mask floats very low and nearly PARALLEL TO THE MAP GROUND PLANE, like a small oval faceplate/token seen from above. Show mostly its broad top/front surface and cracked rim, strongly foreshortened. The silhouette must be LOW and COMPACT, its horizontal width greater than its vertical canvas height. Absolutely not a vertical standing mask, eye-level face, tall profile portrait, or bust.
Direction: the foreshortened nose ridge and front tip point clearly toward the canvas left. A narrow dark hollow back edge is visible along the right side. Thin blue-grey mouth mist trails rightward/down-right. The mask's main long axis runs left-to-right.
Identity: same cracked bone/ash white shell, empty charcoal openings and rear hollow, blue-grey mist, tiny muted amber rim, same compact visual mass as Image 1. The slit is an empty mask opening, never a living eye.
Map readability: bold pale left-pointing low oval, dark right rear edge, broad cracks only, readable at 34px.
Style: muted desaturated dark fantasy painterly map sprite matching Image 1.
Composition: one centered mask, generous padding; no body, face behind, ground, shadow, reflection, text, watermark, logo, frame, UI.
Background: perfectly flat solid pure #00ff00 chroma-key, uniform corner-to-corner; no gradient, texture, lighting variation, glow spill, shadow, or transparency. Do not use #00ff00 in subject.
Avoid: vertical mask, portrait orientation, eye-level side profile, living eyes, hair, horns, crown, weapon, blood, runes, extra objects, pixel art.
```

## 後処理・検収メモ

- 採用版を正面bbox長辺155pxに合わせて透過・中央配置し、256x256 RGBAへ正規化。
- final alpha bbox: `(50, 81, 205, 175)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で低い左向き面と右側の黒い裏縁を確認。
