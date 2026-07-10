# sprite-caretaker-left

- Asset: `assets/sprites/sprite-caretaker-left.png`
- Kind: map sprite
- Character: 世話役 — イルマ
- Direction: left / 左プロフィール
- Created: 2026-07-10
- Generation mode: built-in Image Gen + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-ff795cf2-07df-4350-a8a5-490442b41e45.png`

## 外見典拠

`docs/spec/world-lore.md` 3.6:

> 小柄で痩せた老婆。灰白の髪を無造作に束ね、継ぎの多い前掛け、囲炉裏の煤が染みた細い指

## 立ち絵からの同一人物性

`assets/portraits/npc-caretaker.png` をidentity参照として使用。小柄で痩せた老婆、灰白の無造作な束ね髪、継ぎの多い前掛け、煤染みの細い指を固定。立ち絵の顔・髪・衣服・低彩度配色をidentityアンカーとした。 正面スプライトも追加参照し、向き以外を固定した。

## 採用生成プロンプト全文

```text
Use case: identity-preserve
Asset type: correction pass for sprite-caretaker-left, a top-down overworld map sprite for the Japanese dark fantasy 2D RPG "The Dreaming Engine", final 256x256 transparent PNG displayed at about 32px.
Input images: Image 1 is the exact current LEFT/WEST true profile edit target. Image 2 is Irma's canonical portrait identity. Image 3 is Irma's accepted compact steep-overhead DOWN/front sprite and is the required camera-height, foreshortening, body-scale, painterly density, palette, and padding anchor.
Primary request: Change only the camera steepness and compact map proportions of Image 1. Preserve the same LEFT/WEST true profile, exact small thin elderly woman identity, grey-white hair carelessly gathered in a loose untidy bundle, heavily patched apron, worn layered clothing, narrow soot-stained fingers, boots, colors, lighting, and painterly style.
Critical correction: raise the virtual camera much higher to a TRUE TOP-DOWN-LEANING OVERWORLD VIEW matching Image 3. Strongly foreshorten the torso and legs so the full subject is only 2.5 to 3 head diameters tall from crown to boots, with crown/hair top and upper shoulder/apron planes dominant, body compressed, face/profile tiny where permitted, and feet tiny. Keep Irma physically thin; obtain a bolder wider silhouette through overhead foreshortening, loose garment spread, and visible upper planes, not by making her stout. The subject silhouette should be compact enough that its width is roughly 45-55% of its height rather than the current extremely narrow tall shape, so it stays readable at 32px.
Direction invariant: Keep the facial profile, chest, knees, and toes unmistakably pointing left. Preserve the loose hair bundle trailing behind, patched apron edge, soot-dark hand, and left-pointing boots.
Map readability: broad simplified value masses and clear direction from silhouette alone at 32px. Keep the loose grey-white hair bundle and large patched apron blocks as the main identity cues; no tiny ornamental detail.
Style invariant: dark fantasy illustration, muted desaturated ash grey, faded blue-grey, soot brown and charcoal, restrained amber edge warmth, painterly map asset style, not pixel art.
Composition invariant: one full-body standing sprite centered in a square with generous padding, same scale and center as Image 3. No crop, frame, UI, scenery, ground plane, cast/contact shadow, reflection, or extra object.
Background: replace transparency with a perfectly flat solid #00ff00 chroma-key background, uniform edge-to-edge with no gradient, texture, floor, shadow, reflection, or lighting variation. Crisp separated edges. Do not use #00ff00 in the subject.
Constraints: follow docs/spec/world-lore.md 3.6 exactly. Change only camera steepness and compact proportions. Do not rotate toward the viewer, rear, or right. Do not make Irma stout, tall-looking, young, glamorous, richly dressed, neatly coiffed, eye-level, realistically proportioned, or give her props, jewelry, magic, extra characters, text, watermark, logo, frame, or UI.
```

## 試行記録

### 試行1 — 不採用

- Source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-43c05b68-8abf-4d0a-9b96-7d90262ca285.png`
- 不採用理由: 人物・向きは正しいが、縦長比率が強く、32px縮小時の横幅が約8〜10pxとなり、M13/M17の2.5〜3頭身・太いシルエット基準に不足。

#### 試行1プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG displayed at about 32px on dark 16px map tiles.
Input images: Image 1 is the exact canonical portrait identity, outfit, materials, and palette reference: assets/portraits/npc-caretaker.png. Image 2 is the exact accepted DOWN/front map sprite reference for this same character: preserve its compact proportions, scale, silhouette language, simplified painterly rendering, palette, and camera height while changing direction only. Image 3 is only an existing project reference for the accepted LEFT/WEST orientation, steep overhead camera, square framing, and map-scale density. Do not copy Image 3's person, face, body, clothing, hair, or props.
Primary request: Create sprite-caretaker-left, Irma the caretaker facing LEFT/WEST. Preserve the same small thin elderly woman; grey-white hair carelessly gathered in a loose untidy bundle; humble worn layered village clothing; heavily patched apron; narrow slender fingers darkened by hearth soot; practical dark footwear.
Orientation definition: LEFT means a true left-facing profile. The facial profile, chest, knees, and toes point unmistakably toward the left edge. Do not face the viewer and do not use a 3/4 front pose.
Directional identity details: Show one clear elderly left facial profile beneath the large hair crown, narrow shoulder and torso, patched apron seen edge-on, one soot-dark slender hand, and left-pointing tiny boots. The loose hair bundle trails behind the profile.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW identical to Image 2. High camera steeply looking down on a standing map character. The crown/top plane and shoulders dominate; face/profile is small and foreshortened where permitted; torso is compressed; legs and feet are tiny. Compact 2.5 to 3 heads tall. Never make an eye-level standing portrait.
Identity and invariants: change only direction. Preserve the same person, body mass, signature features, clothing, prop if required by lore, muted palette, broad painterly shapes, scale, padding, center placement, and absence of ground shadow from Images 1-2.
Map readability: bold simplified silhouette readable at 32px. Prioritize small narrow body, one large loose grey-white hair-bundle shape, patched apron as simple large value blocks, two thin soot-dark hands, tiny boots. Strong large value masses, low tiny detail, clear direction from outline alone, harmonized with dark map tiles.
Style: dark fantasy illustration, muted desaturated colors, dim candlelight and cool blue-grey mist, melancholic dreamlike atmosphere, painterly consistent game asset style, not pixel art, no text, no watermark.
Palette/materials: ash grey, faded blue-grey, soot brown, charcoal, grey-white hair, restrained muted amber edge warmth. Do not use #00ff00 in the subject.
Composition: exactly one full-body standing sprite centered in a square with generous padding. No crop, frame, UI, scenery, ground plane, cast shadow, contact shadow, reflection, mist cloud, or extra object.
Background for removal: perfectly flat solid #00ff00 chroma-key background, uniform edge-to-edge with no gradient, texture, floor, reflection, shadow, or lighting variation. Crisp separated edges and generous padding.
Constraints: follow docs/spec/world-lore.md 3.6 exactly. Do not make Irma stout, tall, young, glamorous, richly dressed, neatly coiffed, or give her jewelry, weapon, staff, lantern, basket, magic, symbols, or unrelated props. No extra characters, monsters, gore, sexualization, text, watermark, logo, frame, or UI. Not front, rear, right, 3/4, isometric, or eye-level.
```

### 試行2 — 採用

- 変更点: 外見・向き・衣装を固定し、カメラを高くして頭頂・肩上面を強調、胴脚を俯瞰圧縮。
- Source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-ff795cf2-07df-4350-a8a5-490442b41e45.png`

## 後処理・検収メモ

- `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で緑背景を除去。
- 非透明bboxを縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- リサイズ後のalpha 1〜32かつ緑優勢画素を完全透明化。
- final size / mode: `256x256 RGBA`
- final alpha bbox: `(79, 21, 177, 231)`
- 四隅alpha: `[0, 0, 0, 0]`
- 鮮緑フリンジ検出: `0`、low-alpha緑優勢画素: `0`
- 32px検収: alpha>32の可視画素 `263`、縮小bbox `(7, 0, 25, 31)`。灰白髪束と左向きの顔・靴先、前掛けの大きな明暗塊が判別可能。
- 視覚検収: 真上寄りの高俯瞰、頭頂・肩上面優位、足元小、接地影なし、文字なし、立ち絵との同一人物性を確認。

