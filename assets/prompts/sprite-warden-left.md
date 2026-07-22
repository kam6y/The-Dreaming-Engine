# sprite-warden-left

- Asset: `assets/sprites/sprite-warden-left.png`
- Kind: map sprite
- Character: 番人 — トワ
- Direction: left / 左プロフィール
- Created: 2026-07-10
- Generation mode: built-in Image Gen + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-baf19ce3-309f-4a20-b137-bcdcd66c5055.png`

## 外見典拠

`docs/spec/world-lore.md` 3.8:

> 年齢の読めない小柄な人物。大人の外套を子供のように着込み、坑口の縁に腰掛けて糸繰りの独楽を回している

## 立ち絵からの同一人物性

`assets/portraits/npc-warden.png` をidentity参照として使用。小柄で年齢・性別の読めない人物、大人用の大外套、深いフード影、木製の糸繰り独楽と糸を固定。採用立ち絵の外套形状・配色・独楽をidentityアンカーとした。 正面スプライトも追加参照し、向き以外を固定した。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG displayed at about 32px on dark 16px map tiles.
Input images: Image 1 is the exact canonical portrait identity, outfit, materials, and palette reference: assets/portraits/npc-warden.png. Image 2 is the exact accepted DOWN/front map sprite reference for this same character: preserve its compact proportions, scale, silhouette language, simplified painterly rendering, palette, and camera height while changing direction only. Image 3 is only an existing project reference for the accepted LEFT/WEST orientation, steep overhead camera, square framing, and map-scale density. Do not copy Image 3's person, face, body, clothing, hair, or props.
Primary request: Create sprite-warden-left, Towa the warden facing LEFT/WEST. Preserve the same small age-unreadable and gender-unreadable person; swallowed by a worn adult-sized hooded cloak that fits like a child's borrowed garment; deep hood shadow hiding age cues; holding one simple wooden thread-spinning top with its cord; tiny practical footwear.
Orientation definition: LEFT means a true left-facing profile. The facial profile, chest, knees, and toes point unmistakably toward the left edge. Do not face the viewer and do not use a 3/4 front pose.
Directional identity details: Show a true left profile: deep hood opening and only a tiny shadowed age-indeterminate left profile, the whole engulfing cloak mass and hem flow oriented left, hand and wooden thread-spinning top held in a clear side silhouette with its cord, and left-pointing tiny boots. The top must not look like a coin.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW identical to Image 2. High camera steeply looking down on a standing map character. The crown/top plane and shoulders dominate; face/profile is small and foreshortened where permitted; torso is compressed; legs and feet are tiny. Compact 2.5 to 3 heads tall. Never make an eye-level standing portrait.
Identity and invariants: change only direction. Preserve the same person, body mass, signature features, clothing, prop if required by lore, muted palette, broad painterly shapes, scale, padding, center placement, and absence of ground shadow from Images 1-2.
Map readability: bold simplified silhouette readable at 32px. Prioritize one large engulfing hood-and-cloak mass around a small body, deep face shadow, one clear wooden spinning-top shape with cord, tiny boots. Strong large value masses, low tiny detail, clear direction from outline alone, harmonized with dark map tiles.
Style: dark fantasy illustration, muted desaturated colors, dim candlelight and cool blue-grey mist, melancholic dreamlike atmosphere, painterly consistent game asset style, not pixel art, no text, no watermark.
Palette/materials: charcoal, faded blue-grey, soot brown, worn grey cloth, tiny muted amber on the wooden top and cloak edge. Do not use #00ff00 in the subject.
Composition: exactly one full-body standing sprite centered in a square with generous padding. No crop, frame, UI, scenery, ground plane, cast shadow, contact shadow, reflection, mist cloud, or extra object.
Background for removal: perfectly flat solid #00ff00 chroma-key background, uniform edge-to-edge with no gradient, texture, floor, reflection, shadow, or lighting variation. Crisp separated edges and generous padding.
Constraints: follow docs/spec/world-lore.md 3.8 exactly. Do not define gender or age. Do not make Towa clearly a child, adult, elderly, tall, gender-specific, or give them a mask, jewelry, weapon, magic, symbols, extra props, or a coin. The object must remain a thread-spinning top. No extra characters, monsters, gore, sexualization, text, watermark, logo, frame, or UI. Not front, rear, right, 3/4, isometric, or eye-level.
```

## 後処理・検収メモ

- `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で緑背景を除去。
- 非透明bboxを縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- リサイズ後のalpha 1〜32かつ緑優勢画素を完全透明化。
- final size / mode: `256x256 RGBA`
- final alpha bbox: `(77, 21, 180, 231)`
- 四隅alpha: `[0, 0, 0, 0]`
- 鮮緑フリンジ検出: `0`、low-alpha緑優勢画素: `0`
- 32px検収: alpha>32の可視画素 `277`、縮小bbox `(7, 0, 25, 31)`。左向きのフード開口・靴先、大外套、木製独楽と糸が判別可能。
- 視覚検収: 真上寄りの高俯瞰、頭頂・肩上面優位、足元小、接地影なし、文字なし、立ち絵との同一人物性を確認。

