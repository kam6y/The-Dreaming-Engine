# sprite-artisan

- Asset: `assets/sprites/sprite-artisan.png`
- Kind: map sprite
- Character: 職人 — ガロ
- Direction: down / 正面
- Created: 2026-07-10
- Generation mode: built-in Image Gen + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-d6106049-249a-4ae3-a38c-af553c375b7a.png`

## 外見典拠

`docs/spec/world-lore.md` 3.7:

> 岩のような体つきの中年男性。剃り上げた頭に古い火傷、革の前掛け、琥珀の粉で飴色に染まった太い指

## 立ち絵からの同一人物性

`assets/portraits/npc-artisan.png` をidentity参照として使用。岩のような巨体、剃り上げた頭の古い火傷、革前掛け、琥珀粉で飴色の太い指を固定。立ち絵の体格・頭部・衣服・手の色をidentityアンカーとした。 本画像を残り3方向の追加スプライト参照にも使用した。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG displayed at about 32px on dark 16px map tiles.
Input images: Image 1 is the exact identity, body, face, shaved head and burn, outfit, material, and palette reference: assets/portraits/npc-artisan.png. Image 2 is only a project reference for the accepted steep overhead camera, compact 2.5-to-3-head proportions, square framing, simplified painterly rendering, and map-scale density. Do not copy Image 2's woman, braid, shawl, face, clothing, or identity.
Primary request: Create sprite-artisan, Garo facing DOWN/SOUTH in the front map orientation. Preserve the same rock-built middle-aged man from Image 1: massive broad body, shaved head with one old healed burn scar, heavy practical leather apron, plain worn work clothes, thick broad fingers stained candy-brown by amber dust, practical dark workshop footwear. No unrelated tool or prop.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait. High camera steeply looking down on a standing character like a classic JRPG field sprite. The top of the shaved scarred head and enormous shoulders dominate; face is small and foreshortened; torso and apron compress downward; legs and feet are tiny. Compact 2.5 to 3 heads tall despite his massive build. South-facing front is visible, never eye-level or portrait-like.
Map readability: very bold simplified 32px silhouette. Prioritize the huge rock-like shoulder block, round shaved head with one readable scar mark, broad dark leather apron, two large amber-brown hands, thick compact legs and tiny boots. Broad painterly value shapes, low detail, strong separation on dark tiles.
Style: dark fantasy illustration, muted desaturated colors, dim candlelight and cool blue-grey mist, melancholic dreamlike atmosphere, painterly consistent game asset style, harmonized with project map tiles, not pixel art, no text, no watermark.
Palette/materials: charcoal, soot brown, faded blue-grey, worn dark leather, restrained candy-brown amber dust on thick fingers, very small muted amber edge warmth. Do not use #00ff00 in the subject.
Composition: exactly one full-body standing sprite, centered in a square with generous padding. No crop, frame, UI, scenery, ground plane, cast shadow, contact shadow, reflection, mist cloud, or extra object.
Background for removal: perfectly flat solid #00ff00 chroma-key background, uniform edge-to-edge with no gradient, texture, floor, reflection, shadow, or lighting variation. Crisp separated edges and generous padding.
Constraints: follow docs/spec/world-lore.md 3.7 exactly. Do not invent jewelry, weapons, hammer, tools, armor, beard, magic, symbols, extra characters, monsters, text, watermark, logo, frame, or UI. Do not make Garo slim, young, long-haired, armored, noble, clean-handed, 3/4 eye-level, side-facing, rear-facing, isometric, or realistically tall.
```

## 後処理・検収メモ

- `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で緑背景を除去。
- 非透明bboxを縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- リサイズ後のalpha 1〜32かつ緑優勢画素を完全透明化。
- final size / mode: `256x256 RGBA`
- final alpha bbox: `(45, 21, 211, 231)`
- 四隅alpha: `[0, 0, 0, 0]`
- 鮮緑フリンジ検出: `0`、low-alpha緑優勢画素: `0`
- 32px検収: alpha>32の可視画素 `411`、縮小bbox `(3, 0, 29, 31)`。幅広い肩、剃髪頭部、革前掛け、左右の飴色の大きな手が判別可能。
- 視覚検収: 真上寄りの高俯瞰、頭頂・肩上面優位、足元小、接地影なし、文字なし、立ち絵との同一人物性を確認。

