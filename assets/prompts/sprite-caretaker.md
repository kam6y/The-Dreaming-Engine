# sprite-caretaker

- Asset: `assets/sprites/sprite-caretaker.png`
- Kind: map sprite
- Character: 世話役 — イルマ
- Direction: down / 正面
- Created: 2026-07-10
- Generation mode: built-in Image Gen + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-396c0678-26d1-41d4-b6e6-d3c3abdc2c83.png`

## 外見典拠

`docs/spec/world-lore.md` 3.6:

> 小柄で痩せた老婆。灰白の髪を無造作に束ね、継ぎの多い前掛け、囲炉裏の煤が染みた細い指

## 立ち絵からの同一人物性

`assets/portraits/npc-caretaker.png` をidentity参照として使用。小柄で痩せた老婆、灰白の無造作な束ね髪、継ぎの多い前掛け、煤染みの細い指を固定。立ち絵の顔・髪・衣服・低彩度配色をidentityアンカーとした。 本画像を残り3方向の追加スプライト参照にも使用した。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG displayed at about 32px on dark 16px map tiles.
Input images: Image 1 is the exact identity, body, face, hair, outfit, material, and palette reference: assets/portraits/npc-caretaker.png. Image 2 is only a project reference for the accepted steep overhead camera, compact 2.5-to-3-head proportions, square framing, simplified painterly rendering, and map-scale density. Do not copy Image 2's stout body, braid, shawl, face, clothing, or identity.
Primary request: Create sprite-caretaker, Irma facing DOWN/SOUTH in the front map orientation. Preserve the same small thin elderly woman from Image 1: grey-white hair carelessly gathered in a loose untidy bundle, heavily patched apron, humble worn layered clothing, narrow slender fingers darkened by hearth soot, practical dark footwear. No unrelated prop.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait. High camera steeply looking down on a standing character like a classic JRPG field sprite. The top/crown of the loose grey-white hair bundle and narrow shoulders dominate; face is small and foreshortened; torso is compressed; legs and feet are tiny at the bottom. Compact 2.5 to 3 heads tall. South-facing front is visible, but never eye-level or portrait-like.
Map readability: bold simplified silhouette readable at 32px. Prioritize the small narrow body, one large loose grey-white hair-bundle shape, patched apron as clear large value blocks, two thin soot-dark hands, and tiny boots. Broad painterly shapes with minimal tiny detail and strong separation on dark tiles.
Style: dark fantasy illustration, muted desaturated colors, dim candlelight and cool blue-grey mist, melancholic dreamlike atmosphere, painterly consistent game asset style, harmonized with the project map tiles, not pixel art, no text, no watermark.
Palette/materials: ash grey, faded blue-grey, soot brown, charcoal, grey-white hair, restrained muted amber edge warmth; rough repaired cloth and patchwork apron. Do not use #00ff00 in the subject.
Composition: exactly one full-body standing sprite, centered in a square with generous padding. No crop, frame, UI, scenery, ground plane, cast shadow, contact shadow, reflection, mist cloud, or extra object.
Background for removal: perfectly flat solid #00ff00 chroma-key background, uniform edge-to-edge with no gradient, texture, floor, reflection, shadow, or lighting variation. Crisp separated edges and generous padding.
Constraints: follow docs/spec/world-lore.md 3.6 exactly. Do not invent jewelry, weapon, staff, lantern, basket, magic, symbols, extra characters, monsters, text, watermark, logo, frame, or UI. Do not make Irma stout, tall, young, glamorous, richly dressed, neatly coiffed, 3/4 eye-level, side-facing, rear-facing, isometric, or realistically proportioned.
```

## 後処理・検収メモ

- `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で緑背景を除去。
- 非透明bboxを縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- リサイズ後のalpha 1〜32かつ緑優勢画素を完全透明化。
- final size / mode: `256x256 RGBA`
- final alpha bbox: `(81, 21, 175, 231)`
- 四隅alpha: `[0, 0, 0, 0]`
- 鮮緑フリンジ検出: `0`、low-alpha緑優勢画素: `0`
- 32px検収: alpha>32の可視画素 `251`、縮小bbox `(8, 0, 24, 31)`。灰白の大きな髪束、細い体、継ぎ前掛け、細い暗色の手が判別可能。
- 視覚検収: 真上寄りの高俯瞰、頭頂・肩上面優位、足元小、接地影なし、文字なし、立ち絵との同一人物性を確認。

