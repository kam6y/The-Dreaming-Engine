# npc-warden

- Asset: `assets/portraits/npc-warden.png`
- Kind: NPC portrait
- Character: 番人 — トワ
- Created: 2026-07-10
- Generation mode: built-in Image Gen + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-9ba1c994-2996-43aa-a082-f6e75b8c4a0d.png`

## 外見典拠

`docs/spec/world-lore.md` 3.8:

> 年齢の読めない小柄な人物。大人の外套を子供のように着込み、坑口の縁に腰掛けて糸繰りの独楽を回している

## 同一人物性メモ

初出で既存identity画像はないため、既存4人の立ち絵はスタイル・全身構図・素材密度のみを参照し、顔・体格・衣装・小物は流用していない。本採用画像を以後のマップスプライト4方向のcanonical identityアンカーとした。小柄で年齢・性別の読めない人物、大人用の大外套、深いフード影、木製の糸繰り独楽と糸を固定。採用立ち絵の外套形状・配色・独楽をidentityアンカーとした。

## 採用生成プロンプト全文

```text
Use case: identity-preserve
Asset type: correction pass for the canonical full-body NPC portrait npc-warden in the Japanese dark fantasy 2D RPG "The Dreaming Engine", final 1024x1536 transparent PNG after chroma-key removal.
Input image: Image 1 is the exact edit target and identity anchor candidate. Preserve its entire body, pose, oversized worn adult cloak, cloak folds and colors, small stature, hands, thread-spinning top and clearly visible cord, boots, proportions, composition, painterly style, lighting, silhouette, and flat chroma-key background.
Primary request: Change only the age readability of the visible face so Towa no longer reads clearly as a child. Pull the existing hood slightly lower/deeper and place the face in soft opaque shadow, leaving only a limited neutral age-indeterminate glimpse with no round child cheeks, no youthful doll-like proportions, no wrinkles, no beard, and no strongly adult or elderly cues. The result must read as a small person whose age cannot be determined, not as a child.
Identity / world-lore invariant from docs/spec/world-lore.md 3.8: a small age-unreadable person wearing an adult-sized cloak the way a child would be swallowed by it, holding a thread-spinning top. Do not define gender. The phrase "like a child" describes how the oversized adult cloak fits, not the person's biological age.
Style invariant: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly consistent game asset style, no text, no watermark.
Background invariant: keep the perfectly flat solid #00ff00 chroma-key background uniform edge-to-edge; no shadows, gradients, texture, floor, reflections, scenery, or lighting variation. No cast/contact shadow. Do not use #00ff00 in the subject.
Constraints: change only the hood depth and facial age ambiguity. Preserve the wooden thread-spinning top and cord exactly. Do not add a mask, facial hair, wrinkles, symbols, jewelry, magic, props, extra characters, text, watermark, logo, frame, UI, monsters, or background objects. Do not make Towa clearly a child, adult, elderly person, or gender-specific.
```

## 試行記録

### 試行1 — 不採用

- Source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-7846502e-f10f-428b-a6c5-4c9358ce163c.png`
- 不採用理由: フード・大外套・糸繰り独楽は適合したが、顔が明確な子供に読め、world-lore 3.8の「年齢の読めない」を満たさなかった。

#### 試行1プロンプト全文

```text
Use case: stylized-concept
Asset type: full-body NPC portrait for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended final output 1024x1536 transparent PNG after chroma-key removal.
Input images: Images 1-4 are existing project portrait style and framing references only. Match their painterly rendering, full-body VN-side portrait composition, illustration density, worn material treatment, muted blue-grey/soot palette, and restrained amber edge light. Do not copy any reference character's identity, body, face, hair, outfit, props, or distinctive accessories.
Primary request: Create npc-warden, Towa, warden and storyteller of the sealed mine entrance. This is their first canonical portrait and will become the identity anchor for later map sprites.
Subject / fixed features from docs/spec/world-lore.md 3.8: a small person whose age cannot be read; wearing an adult-sized cloak the way a child would be swallowed by it; holding a traditional thread-spinning top, with its string clearly visible. Preserve age ambiguity and small stature. Do not define gender and do not invent contradictory appearance.
Composition/framing: one single standing character, full body visible, centered vertical VN-style portrait, quiet enigmatic posture, generous transparent-safe padding, no crop, no frame, no UI. The oversized adult cloak must visibly engulf the small body, with sleeves/hem too large in a childlike fit. One hand holds the thread and spinning top so the object is clearly recognizable, while the other remains natural. Practical footwear may just peek beneath the oversized cloak.
Clothing/materials: one worn adult-sized village cloak in faded dark cloth, much too large for the wearer; simple clothing mostly hidden beneath it; a small wooden thread-spinning top and cord. No jewelry, weapons, magic, crown, armor, or unrelated props.
Style/medium: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, detailed but not photorealistic, no text, no watermark.
Lighting/mood: subdued cool blue-grey ambient tone with restrained amber glints on the thread-spinning top and cloak edge; low saturation, restrained contrast, age-ambiguous, quiet, uncanny but not monstrous.
Color palette: charcoal, faded blue-grey, soot brown, worn grey cloth, tiny muted amber on the wooden top. Do not use #00ff00 in the subject.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal. One uniform color edge-to-edge with no shadows, gradients, texture, floor plane, reflections, scenery, mist, or lighting variation. Crisp separated silhouette, generous padding. No cast shadow, contact shadow, or reflection.
Constraints: follow world-lore 3.8 exactly. No extra characters, monsters, gore, sexualization, text, watermark, logo, title, frame, UI, glowing magic, background objects, mine scenery, invented symbols, or modern toy. Do not make Towa clearly a child, clearly an adult, clearly elderly, tall, gender-specific, aristocratic, armored, or transparently supernatural.
```

### 試行2 — 採用

- 変更点: 外套・独楽・構図・配色を固定し、フードを深くして年齢手掛かりだけを除去。
- Source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-9ba1c994-2996-43aa-a082-f6e75b8c4a0d.png`

## 後処理・検収メモ

- `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で背景除去。
- 元生成が1024x1536のため縦横リサイズは行わずRGBAを保持。
- final size / mode: `1024x1536 RGBA`
- final alpha bbox: `(234, 157, 798, 1439)`
- 四隅alpha: `[0, 0, 0, 0]`
- 鮮緑フリンジ検出: `0`、low-alpha緑優勢画素: `0`
- 視覚検収: 全身、VN横置き向けの余白、低彩度の絵画調、典拠の固定特徴、接地影なし、文字なしを原寸で確認。

