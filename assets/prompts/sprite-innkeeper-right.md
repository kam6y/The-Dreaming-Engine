# sprite-innkeeper-right

- Asset: `assets/sprites/sprite-innkeeper-right.png`
- Kind: map sprite
- Character: 宿屋の主人 — オルガ
- Direction: 右向き(right / 右プロフィール)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-60295d78-2772-4790-9c14-3b0484368f7b.png`

## 外見典拠

`docs/spec/world-lore.md` 3.2:

> 恰幅のよい初老の女性。灰の混じった三つ編み、火傷の跡が残る太い手、いつも羊毛の肩掛け

## 同一人物性メモ

`assets/sprites/sprite-innkeeper.png` の恰幅のよい体格、灰混じりの太い三つ編み、厚い羊毛肩掛け、火傷跡のある太い腕、実用的な衣服を保持。左向きの鏡像ではなく、三つ編み・腕・肩掛けの重なりを右向き用に個別生成した。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG displayed at about 32px on dark map tiles.
Input image: Image 1 is the exact identity, costume, palette, proportions, painterly style, camera-height, and scale reference: assets/sprites/sprite-innkeeper.png. Create a new side orientation drawing, not a mirrored image.
Primary request: Create sprite-innkeeper-right, Olga the innkeeper facing RIGHT/EAST in a true right-facing profile. Preserve the same stout elderly woman and exact outfit from Image 1: grey-streaked long braid, heavy brown-grey wool shoulder shawl, humble faded blue-grey layered dress/apron, thick scarred forearms and hands, dark practical boots.
Orientation definition: RIGHT means her face profile, chest, belly, knees, and toes point unmistakably toward the right edge. Show one clear elderly facial profile, the heavy shawl and rounded belly from the side, her grey braid trailing down/back, and staggered tiny right-pointing boots. Do not face the viewer and do not use a 3/4 front pose. Independently draw this orientation; it must not be a simple mirror of the left version.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW identical to Image 1. High camera steeply looking down, showing crown/hair, upper shawl plane and near shoulder more than the face; side torso compressed; feet tiny below. Compact 2.5 to 3 heads tall matching Image 1, not an eye-level portrait.
Identity and invariants: change only direction. Keep Olga stout, same rounded shawl mass, same braid thickness and grey streaking, same wide layered dress/apron, same muted palette and broad painterly style, same scale/padding/center. Old healed burn scarring may remain simplified on visible thick hand. No new accessories.
Map readability: strong simple 32px silhouette. A forward facial/forehead bump, rounded shawl and belly, rear braid, and right-pointing boots must make RIGHT obvious from outline alone. Preserve large value blocks.
Style: dark fantasy painterly illustration, muted desaturated charcoal, soot brown, faded blue-grey, grey wool and hair, tiny subdued amber warmth; melancholic but warm; match Image 1 and map tiles.
Composition: one single full-body standing sprite centered with generous padding. No crop, ground plane, cast shadow, contact shadow, reflection, frame, UI, or props.
Background for removal: perfectly flat solid #00ff00 chroma-key background, one uniform edge-to-edge color, no gradients, texture, floor, lighting variation, reflection, or shadow. Crisp edges. Do not use #00ff00 in the subject.
Constraints: follow docs/spec/world-lore.md 3.2 exactly. No magic, weapons, staff, lantern, aristocratic clothing, jewelry, extra characters, text, watermark, logo, frame, or UI. Not front, rear, left, 3/4, isometric, eye-level, thin, young, or realistically tall.
```

## 後処理・検収メモ

- `remove_chroma_key.py` を `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で実行。
- 非透明被写体を縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- 正規化時の補間で生じたalpha 1〜32の緑優勢画素を完全透明化し、低alphaのクロマキー残留も除去。
- final alpha bbox: `(72, 21, 183, 231)`。四隅alpha: `[0, 0, 0, 0]`。
- 鮮緑フリンジ検出0。暗色背景上の32px縮小表示で左右方向と人物シルエットを確認。
