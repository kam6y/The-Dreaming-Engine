# sprite-merchant-up

- Asset: `assets/sprites/sprite-merchant-up.png`
- Kind: map sprite
- Character: 商人 — レンド
- Direction: 上向き(up / 背面)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-3f94f483-7831-427f-a614-256730727332.png`

## 外見典拠

`docs/spec/world-lore.md` 3.3:

> 痩身で早口な壮年の男性。片眼鏡、色褪せた行商用の外套、指先にいつもインクの染み

## 同一人物性メモ

`assets/sprites/sprite-merchant.png` の痩身、暗い乱れ髪、色褪せた青灰の外套、革鞄とストラップ、インク染みの指を保持。背面なので顔と片眼鏡レンズは見せず、後頭部・外套背面・鞄を主形状にした。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is 256x256 transparent PNG displayed at about 32px on dark map tiles.
Input image: Image 1 is the exact identity, outfit, palette, painterly style, top-down camera, scale and proportion reference: assets/sprites/sprite-merchant.png. Create a new rear orientation drawing.
Primary request: Create sprite-merchant-up, Lendo the merchant facing UP/NORTH, viewed from behind. Preserve the exact same person/outfit as Image 1: slim middle-aged man, sharp narrow silhouette, dark tousled hair, faded blue-grey traveling merchant cloak, worn layered clothes, brown leather satchel and crossing straps, ink-stained fingertips, small dark boots. His monocle belongs on only one eye, but in this rear view no eye or monocle lens should be visible; only its subtle side chain may appear if naturally seen.
Orientation definition: UP means true rear view. Body faces the top of canvas and back faces viewer. Show only back of tousled head, rear shoulders, cloak back, rear crossing strap and satchel placement, arms/hands from behind and tiny heels. Absolutely no face, eyes, nose, mouth, monocle lens, chest front, or frontal clothing.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW identical to Image 1. High camera steeply down; crown of dark hair, shoulders, cloak top, satchel top dominate; compressed back torso; tiny legs and feet. Compact 2.5 to 3 heads tall while retaining Lendo's narrow silhouette. Not an eye-level portrait.
Identity and invariants: change only direction. Same dark tousled hair mass, same faded cloak, same leather straps/satchel, same narrow proportions, muted palette, painterly broad shapes, body scale, padding and center. No extra bags or glasses.
Map readability: simplified 32px silhouette: narrow cloak, visible diagonal rear strap, solid satchel block at the correct hip, tousled hair crown, ink-dark hands and separated tiny heels. Rear-facing outline unmistakable.
Style: dark fantasy painterly illustration, muted desaturated charcoal, faded blue-grey, grey-brown leather, ink-black fingertips, tiny subdued amber metal accents, melancholic dreamlike tone; match reference and tiles.
Composition: one single full-body standing sprite centered with generous padding. No crop, ground, shadow, reflection, frame, UI, or props.
Background for removal: perfectly flat solid #00ff00 chroma-key background, uniform edge-to-edge, no gradients, texture, floor, lighting variation, reflection or shadow. Crisp edges. No #00ff00 in subject.
Constraints: follow docs/spec/world-lore.md 3.3 exactly. Exactly one monocle total, never spectacles or two lenses; no weapons, staff, signs, coins, bright colors, extra characters, text, watermark, logo, frame or UI. Not front, side, 3/4, isometric, eye-level, stout, young, or realistic tall proportions.
```

## 後処理・検収メモ

- `remove_chroma_key.py` を `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で実行。
- 非透明被写体を縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- 正規化時の補間で生じたalpha 1〜32の緑優勢画素を完全透明化し、低alphaのクロマキー残留も除去。
- final alpha bbox: `(62, 21, 193, 231)`。四隅alpha: `[0, 0, 0, 0]`。
- 鮮緑フリンジ検出0。暗色背景上の32px縮小表示で背面と人物シルエットを確認。
