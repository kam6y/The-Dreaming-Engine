# npc-caretaker

- Asset: `assets/portraits/npc-caretaker.png`
- Kind: NPC portrait
- Character: 世話役 — イルマ
- Created: 2026-07-10
- Generation mode: built-in Image Gen + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-fe1b7755-b5ff-4bff-8454-6d9976aae1e0.png`

## 外見典拠

`docs/spec/world-lore.md` 3.6:

> 小柄で痩せた老婆。灰白の髪を無造作に束ね、継ぎの多い前掛け、囲炉裏の煤が染みた細い指

## 同一人物性メモ

初出で既存identity画像はないため、既存4人の立ち絵はスタイル・全身構図・素材密度のみを参照し、顔・体格・衣装・小物は流用していない。本採用画像を以後のマップスプライト4方向のcanonical identityアンカーとした。小柄で痩せた老婆、灰白の無造作な束ね髪、継ぎの多い前掛け、煤染みの細い指を固定。立ち絵の顔・髪・衣服・低彩度配色をidentityアンカーとした。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: full-body NPC portrait for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended final output 1024x1536 transparent PNG after chroma-key removal.
Input images: Images 1-4 are existing project portrait style and framing references only. Match their painterly rendering, full-body VN-side portrait composition, illustration density, worn material treatment, muted blue-grey/soot palette, and restrained amber edge light. Do not copy any reference character's identity, body, face, hair, outfit, props, or distinctive accessories.
Primary request: Create npc-caretaker, Irma, caretaker of the Amber Hamlet. This is her first canonical portrait and will become the identity anchor for later map sprites.
Subject / fixed features from docs/spec/world-lore.md 3.6: a small, thin elderly woman; grey-white hair gathered carelessly into a loose untidy bundle; an apron with many visible patches; narrow slender fingers visibly stained by hearth soot. Preserve every listed feature and do not invent contradictory appearance.
Composition/framing: one single standing character, full body from head to practical footwear visible, centered vertical VN-style portrait, relaxed quiet caretaker posture, generous transparent-safe padding, no crop, no frame, no UI. Both slender soot-stained hands must be visible enough to identify. The patched apron and loose grey-white hair bundle must read clearly.
Clothing/materials: humble worn layered village clothing beneath the heavily mended apron; rough faded cloth, many practical patch repairs, soot-darkened apron edges. No jewelry, weapons, magic, aristocratic decoration, or unrelated props.
Style/medium: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, detailed but not photorealistic, no text, no watermark.
Lighting/mood: subdued cool blue-grey ambient tone with restrained amber hearth-like rim light; low saturation, restrained contrast, quiet and welcoming without smiling caricature.
Color palette: ash grey, faded blue-grey, soot brown, charcoal, grey-white hair, very small muted amber highlights. Do not use #00ff00 in the subject.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal. One uniform color edge-to-edge with no shadows, gradients, texture, floor plane, reflections, scenery, mist, or lighting variation. Crisp separated silhouette, generous padding. No cast shadow, contact shadow, or reflection.
Constraints: follow world-lore 3.6 exactly. No extra characters, monsters, gore, sexualization, text, watermark, logo, title, frame, UI, halo, smoke, translucent body, background objects, or invented personal ornament. Do not make her stout, tall, young, glamorous, richly dressed, or neatly coiffed.
```

## 後処理・検収メモ

- `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で背景除去。
- 元生成が1024x1536のため縦横リサイズは行わずRGBAを保持。
- final size / mode: `1024x1536 RGBA`
- final alpha bbox: `(289, 47, 734, 1490)`
- 四隅alpha: `[0, 0, 0, 0]`
- 鮮緑フリンジ検出: `0`、low-alpha緑優勢画素: `0`
- 視覚検収: 全身、VN横置き向けの余白、低彩度の絵画調、典拠の固定特徴、接地影なし、文字なしを原寸で確認。

