# sprite-innkeeper-up

- Asset: `assets/sprites/sprite-innkeeper-up.png`
- Kind: map sprite
- Character: 宿屋の主人 — オルガ
- Direction: 上向き(up / 背面)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-868366fc-1aec-4ad4-8052-f31b9f1e14fb.png`

## 外見典拠

`docs/spec/world-lore.md` 3.2:

> 恰幅のよい初老の女性。灰の混じった三つ編み、火傷の跡が残る太い手、いつも羊毛の肩掛け

## 同一人物性メモ

`assets/sprites/sprite-innkeeper.png` の恰幅のよい体格、灰混じりの太い三つ編み、厚い羊毛肩掛け、火傷跡のある太い腕、実用的な衣服を保持。背面では顔を出さず、三つ編みと丸い肩掛けを主シルエットにした。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG displayed at about 32px on dark map tiles.
Input image: Image 1 is the exact identity, costume, palette, proportions, painterly style, camera-height, and scale reference: assets/sprites/sprite-innkeeper.png. Create a new rear orientation drawing.
Primary request: Create sprite-innkeeper-up, Olga the innkeeper facing UP/NORTH, viewed from behind. Preserve the exact same woman and same outfit as Image 1: stout elderly woman with warm sturdy presence, grey-streaked long braid, heavy brown-grey wool shoulder shawl, humble faded blue-grey layered dress/apron, thick forearms and hands with old healed burn scars, dark practical boots.
Orientation definition: UP means true rear view. Her body faces the top of the canvas and her back faces the viewer. Show the back/crown of her grey-streaked hair, full rear braid, rounded rear shawl, back of dress/apron, thick arms from behind, and tiny heels. Absolutely no face, eyes, nose, mouth, chest front, or frontal apron panel visible.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW identical to Image 1. High camera steeply looking down, with the crown, braid root and broad rounded shoulders dominant; back torso compressed; legs and feet tiny. Compact 2.5 to 3 heads tall proportions matching Image 1, not an eye-level standing portrait.
Identity and invariants: change only direction. Keep Olga stout and broad, same shawl volume and coarse wool texture, same braid thickness and grey streaking, same practical layered garment colors, same broad painterly shapes, scale, padding, and center placement. Do not make her thin or young.
Map readability: bold rounded silhouette readable at 32px. The broad shawl, stout body and one large clear braid down the back must remain distinctive; rear-facing heels and back seam reinforce direction. Strong value separation and simple forms.
Style: dark fantasy painterly illustration, muted desaturated charcoal, soot brown, faded blue-grey, grey wool, grey-streaked hair, tiny subdued amber warmth; melancholic dreamlike atmosphere; match Image 1 and map tiles.
Composition: one single full-body standing sprite centered with generous padding. No crop, ground plane, cast shadow, contact shadow, reflection, frame, UI, or props.
Background for removal: perfectly flat solid #00ff00 chroma-key background, one uniform color edge-to-edge, with no gradients, texture, floor, lighting variation, reflection, or shadow. Crisp edges. Do not use #00ff00 in the subject.
Constraints: follow docs/spec/world-lore.md 3.2 exactly. No magic, weapons, staff, lantern, aristocratic clothing, jewelry, extra characters, text, watermark, logo, frame, or UI. Not front, not side, not 3/4, not isometric, not eye-level, not realistic tall proportions.
```

## 後処理・検収メモ

- `remove_chroma_key.py` を `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で実行。
- 非透明被写体を縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- 正規化時の補間で生じたalpha 1〜32の緑優勢画素を完全透明化し、低alphaのクロマキー残留も除去。
- final alpha bbox: `(49, 21, 207, 231)`。四隅alpha: `[0, 0, 0, 0]`。
- 鮮緑フリンジ検出0。暗色背景上の32px縮小表示で背面と人物シルエットを確認。
