# npc-artisan

- Asset: `assets/portraits/npc-artisan.png`
- Kind: NPC portrait
- Character: 職人 — ガロ
- Created: 2026-07-10
- Generation mode: built-in Image Gen + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-840cfb80-4121-4747-ad2e-ebb7695f61c8.png`

## 外見典拠

`docs/spec/world-lore.md` 3.7:

> 岩のような体つきの中年男性。剃り上げた頭に古い火傷、革の前掛け、琥珀の粉で飴色に染まった太い指

## 同一人物性メモ

初出で既存identity画像はないため、既存4人の立ち絵はスタイル・全身構図・素材密度のみを参照し、顔・体格・衣装・小物は流用していない。本採用画像を以後のマップスプライト4方向のcanonical identityアンカーとした。岩のような巨体、剃り上げた頭の古い火傷、革前掛け、琥珀粉で飴色の太い指を固定。立ち絵の体格・頭部・衣服・手の色をidentityアンカーとした。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: full-body NPC portrait for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended final output 1024x1536 transparent PNG after chroma-key removal.
Input images: Images 1-4 are existing project portrait style and framing references only. Match their painterly rendering, full-body VN-side portrait composition, illustration density, worn material treatment, muted blue-grey/soot palette, and restrained amber edge light. Do not copy any reference character's identity, body, face, hair, outfit, props, or distinctive accessories.
Primary request: Create npc-artisan, Garo, artisan of the Amber Workshop. This is his first canonical portrait and will become the identity anchor for later map sprites.
Subject / fixed features from docs/spec/world-lore.md 3.7: a middle-aged man with a massive rock-like build; shaved head bearing one old healed burn scar; a practical leather apron; thick broad fingers stained candy-brown by amber dust. Preserve every listed feature and do not invent contradictory appearance.
Composition/framing: one single standing character, full body from shaved head to practical workshop footwear visible, centered vertical VN-style portrait, solid grounded artisan posture, generous transparent-safe padding, no crop, no frame, no UI. The old healed burn on the shaved head, leather apron, and both thick amber-dust-stained fingers must be clearly visible.
Clothing/materials: plain worn work clothing beneath a heavy scuffed leather apron, workshop wear and subtle amber powder on the hands only. No jewelry, weapons, magic, ornate armor, or unrelated tools/props.
Style/medium: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, detailed but not photorealistic, no text, no watermark.
Lighting/mood: subdued cool blue-grey ambient tone with restrained amber highlights catching the apron edges and amber-stained fingers; low saturation, restrained contrast, blunt and dependable mood.
Color palette: charcoal, soot brown, faded blue-grey, worn dark leather, subdued candy-brown amber dust on fingers. Do not use #00ff00 in the subject.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal. One uniform color edge-to-edge with no shadows, gradients, texture, floor plane, reflections, scenery, mist, or lighting variation. Crisp separated silhouette, generous padding. No cast shadow, contact shadow, or reflection.
Constraints: follow world-lore 3.7 exactly. No extra characters, monsters, gore, sexualization, text, watermark, logo, title, frame, UI, glowing magic, background objects, beard requirement, invented jewelry, weapons, hammer, or tool belt. Do not make him slim, young, long-haired, armored, noble, or clean-handed.
```

## 後処理・検収メモ

- `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で背景除去。
- 元生成が1024x1536のため縦横リサイズは行わずRGBAを保持。
- final size / mode: `1024x1536 RGBA`
- final alpha bbox: `(193, 54, 832, 1496)`
- 四隅alpha: `[0, 0, 0, 0]`
- 鮮緑フリンジ検出: `0`、low-alpha緑優勢画素: `0`
- 視覚検収: 全身、VN横置き向けの余白、低彩度の絵画調、典拠の固定特徴、接地影なし、文字なしを原寸で確認。

