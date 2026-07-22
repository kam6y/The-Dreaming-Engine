# sprite-warden

- Asset: `assets/sprites/sprite-warden.png`
- Kind: map sprite
- Character: 番人 — トワ
- Direction: down / 正面
- Created: 2026-07-10
- Generation mode: built-in Image Gen + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f4aa7-5a5e-7702-bfdb-470f5bb6a38e/exec-6a6f5f1e-9188-43f6-a283-a3148168386b.png`

## 外見典拠

`docs/spec/world-lore.md` 3.8:

> 年齢の読めない小柄な人物。大人の外套を子供のように着込み、坑口の縁に腰掛けて糸繰りの独楽を回している

## 立ち絵からの同一人物性

`assets/portraits/npc-warden.png` をidentity参照として使用。小柄で年齢・性別の読めない人物、大人用の大外套、深いフード影、木製の糸繰り独楽と糸を固定。採用立ち絵の外套形状・配色・独楽をidentityアンカーとした。 本画像を残り3方向の追加スプライト参照にも使用した。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG displayed at about 32px on dark 16px map tiles.
Input images: Image 1 is the exact identity, small stature, deeply shadowed age-unreadable face, oversized adult cloak, thread-spinning top, outfit, material, and palette reference: assets/portraits/npc-warden.png. Image 2 is only a project reference for the accepted steep overhead camera, compact 2.5-to-3-head proportions, square framing, simplified painterly rendering, and map-scale density. Do not copy Image 2's face, coin, satchel, costume, or identity.
Primary request: Create sprite-warden, Towa facing DOWN/SOUTH in the front map orientation. Preserve the same small age-unreadable and gender-unreadable person from Image 1, swallowed by a worn adult-sized hooded cloak that fits like a child's borrowed garment, holding the same simple wooden thread-spinning top with its cord. The deep hood shadow must keep age unreadable.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait. High camera steeply looking down on a standing character like a classic JRPG field sprite. The huge hood crown and upper cloak plane dominate; the face is tiny, deeply shadowed, and age-indeterminate; cloak-covered torso compresses; feet are tiny below the oversized hem. Compact 2.5 to 3 heads tall. South-facing front is visible, never eye-level or portrait-like.
Map readability: bold simplified 32px silhouette. Prioritize one large engulfing hood-and-cloak shape around the small body, deep shadow where the face is, one clear wooden top shape and cord in hand, and tiny boots. Use broad painterly value masses; the toy must not resemble a coin.
Style: dark fantasy illustration, muted desaturated colors, dim candlelight and cool blue-grey mist, melancholic dreamlike atmosphere, painterly consistent game asset style, harmonized with project map tiles, not pixel art, no text, no watermark.
Palette/materials: charcoal, faded blue-grey, soot brown, worn grey cloth, tiny muted amber on the wooden top and cloak edge. Do not use #00ff00 in the subject.
Composition: exactly one full-body standing sprite, centered in a square with generous padding. No crop, frame, UI, scenery, mine entrance, ground plane, cast shadow, contact shadow, reflection, mist cloud, or extra object.
Background for removal: perfectly flat solid #00ff00 chroma-key background, uniform edge-to-edge with no gradient, texture, floor, reflection, shadow, or lighting variation. Crisp separated edges and generous padding.
Constraints: follow docs/spec/world-lore.md 3.8 exactly. Do not define gender. Do not invent mask, jewelry, weapon, magic, symbols, extra characters, monsters, text, watermark, logo, frame, or UI. Do not make Towa clearly a child, adult, elderly, tall, gender-specific, 3/4 eye-level, side-facing, rear-facing, isometric, or realistically proportioned.
```

## 後処理・検収メモ

- `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で緑背景を除去。
- 非透明bboxを縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- リサイズ後のalpha 1〜32かつ緑優勢画素を完全透明化。
- final size / mode: `256x256 RGBA`
- final alpha bbox: `(60, 21, 197, 231)`
- 四隅alpha: `[0, 0, 0, 0]`
- 鮮緑フリンジ検出: `0`、low-alpha緑優勢画素: `0`
- 32px検収: alpha>32の可視画素 `332`、縮小bbox `(5, 0, 27, 31)`。大きなフード外套、深い顔影、左手側の木製独楽の琥珀色点、細い糸が判別可能。
- 視覚検収: 真上寄りの高俯瞰、頭頂・肩上面優位、足元小、接地影なし、文字なし、立ち絵との同一人物性を確認。

