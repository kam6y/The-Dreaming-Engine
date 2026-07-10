# sprite-artisan-left

- Asset: `assets/sprites/sprite-artisan-left.png`
- Kind: map sprite
- Character: 職人 — ガロ
- Direction: left / 左プロフィール
- Created: 2026-07-10
- Generation mode: built-in Image Gen + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-a94b4803-70b9-4687-b890-85c0fe3c4ae2.png`

## 外見典拠

`docs/spec/world-lore.md` 3.7:

> 岩のような体つきの中年男性。剃り上げた頭に古い火傷、革の前掛け、琥珀の粉で飴色に染まった太い指

## 立ち絵からの同一人物性

`assets/portraits/npc-artisan.png` をidentity参照として使用。岩のような巨体、剃り上げた頭の古い火傷、革前掛け、琥珀粉で飴色の太い指を固定。立ち絵の体格・頭部・衣服・手の色をidentityアンカーとした。 正面スプライトも追加参照し、向き以外を固定した。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG displayed at about 32px on dark 16px map tiles.
Input images: Image 1 is the exact canonical portrait identity, outfit, materials, and palette reference: assets/portraits/npc-artisan.png. Image 2 is the exact accepted DOWN/front map sprite reference for this same character: preserve its compact proportions, scale, silhouette language, simplified painterly rendering, palette, and camera height while changing direction only. Image 3 is only an existing project reference for the accepted LEFT/WEST orientation, steep overhead camera, square framing, and map-scale density. Do not copy Image 3's person, face, body, clothing, hair, or props.
Primary request: Create sprite-artisan-left, Garo the artisan facing LEFT/WEST. Preserve the same rock-built middle-aged man; massive broad body; shaved head bearing one old healed burn scar; plain worn work clothes; heavy practical leather apron; thick broad fingers stained candy-brown by amber dust; practical dark workshop footwear.
Orientation definition: LEFT means a true left-facing profile. The facial profile, chest, knees, and toes point unmistakably toward the left edge. Do not face the viewer and do not use a 3/4 front pose.
Directional identity details: Show a strong left-facing profile: shaved scarred crown, brow/nose/chest/knees/toes all point left, enormous shoulder and torso compressed from above, leather apron in side profile, one large amber-stained hand, thick compact legs and left-pointing tiny boots.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW identical to Image 2. High camera steeply looking down on a standing map character. The crown/top plane and shoulders dominate; face/profile is small and foreshortened where permitted; torso is compressed; legs and feet are tiny. Compact 2.5 to 3 heads tall. Never make an eye-level standing portrait.
Identity and invariants: change only direction. Preserve the same person, body mass, signature features, clothing, prop if required by lore, muted palette, broad painterly shapes, scale, padding, center placement, and absence of ground shadow from Images 1-2.
Map readability: bold simplified silhouette readable at 32px. Prioritize huge rock-like shoulder block, round shaved scarred head, broad dark leather apron, large amber-brown hands, thick compact legs, tiny boots. Strong large value masses, low tiny detail, clear direction from outline alone, harmonized with dark map tiles.
Style: dark fantasy illustration, muted desaturated colors, dim candlelight and cool blue-grey mist, melancholic dreamlike atmosphere, painterly consistent game asset style, not pixel art, no text, no watermark.
Palette/materials: charcoal, soot brown, faded blue-grey, worn dark leather, subdued candy-brown amber on the fingers, restrained amber edge warmth. Do not use #00ff00 in the subject.
Composition: exactly one full-body standing sprite centered in a square with generous padding. No crop, frame, UI, scenery, ground plane, cast shadow, contact shadow, reflection, mist cloud, or extra object.
Background for removal: perfectly flat solid #00ff00 chroma-key background, uniform edge-to-edge with no gradient, texture, floor, reflection, shadow, or lighting variation. Crisp separated edges and generous padding.
Constraints: follow docs/spec/world-lore.md 3.7 exactly. Do not make Garo slim, young, long-haired, armored, noble, clean-handed, or give him jewelry, weapons, hammer, tools, beard requirement, magic, symbols, or unrelated props. No extra characters, monsters, gore, sexualization, text, watermark, logo, frame, or UI. Not front, rear, right, 3/4, isometric, or eye-level.
```

## 後処理・検収メモ

- `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で緑背景を除去。
- 非透明bboxを縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- リサイズ後のalpha 1〜32かつ緑優勢画素を完全透明化。
- final size / mode: `256x256 RGBA`
- final alpha bbox: `(84, 21, 173, 231)`
- 四隅alpha: `[0, 0, 0, 0]`
- 鮮緑フリンジ検出: `0`、low-alpha緑優勢画素: `0`
- 32px検収: alpha>32の可視画素 `238`、縮小bbox `(8, 0, 24, 31)`。左向きの頭部・鼻先・靴先、巨体、革前掛け、飴色の手が判別可能。
- 視覚検収: 真上寄りの高俯瞰、頭頂・肩上面優位、足元小、接地影なし、文字なし、立ち絵との同一人物性を確認。

