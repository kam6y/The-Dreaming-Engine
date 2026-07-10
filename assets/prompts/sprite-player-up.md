# sprite-player-up

- Asset: `assets/sprites/sprite-player-up.png`
- Kind: map sprite
- Character: 主人公 — 名もなき旅人
- Direction: 上向き(up / 背面)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-b489ad59-e1e3-4b6d-b72f-3a73edc7976a.png`

## 外見典拠

`docs/spec/world-lore.md` 3.1:

> 性別を強く特定しない中性的なシルエット、くすんだ旅装(青灰のマント、擦れた革の鞄)、輪郭の一部が霧に溶けるような淡い描写

## 同一人物性メモ

`assets/sprites/sprite-player.png` の大きな青灰のフード、擦れた革鞄、霧へ溶ける外套裾、暗い旅装、2.5〜3頭身を保持。背面では顔を完全に隠し、後頭部・背中・鞄の背面だけを見せた。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG displayed at about 32px over dark 16px Kenney Roguelike-style map tiles.
Input image: Image 1 is the exact identity, costume, palette, proportions, painterly style, camera-height, and scale reference: assets/sprites/sprite-player.png. Create a new orientation drawing, not a rotated or mirrored copy.
Primary request: Create sprite-player-up, the unnamed traveler facing UP/NORTH, viewed from behind. Preserve the exact same character and exact same outfit as Image 1: androgynous traveler, large weathered blue-grey hooded cloak, face obscured by the hood, worn dark travel clothes, small scuffed brown leather shoulder bag, practical boots, cloak hem dissolving subtly into blue-grey mist.
Orientation definition: UP means a true rear view. The character's back points toward the viewer and the body faces the top of the canvas. Show the back of the hood/head, rear shoulders, back of cloak, rear strap and satchel placement, and small heels. Absolutely no face, eyes, nose, mouth, or frontal chest visible.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW identical to Image 1, not an eye-level portrait. A high camera looks steeply down at a standing character, so the hood crown and shoulders dominate, the compressed back torso is smaller, and legs/feet are tiny near the bottom. Compact 2.5 to 3 heads tall deformed proportions, matching Image 1.
Identity and invariants: change only the direction from down/front to up/rear. Keep the same hood size and shape, same blue-grey cloak cut and mist-frayed hem, same brown bag and straps, same muted palette, same broad painterly rendering, same body scale, same padding and centered placement.
Map readability: bold simplified silhouette readable at 32px. A broad hood-and-shoulder mass, clear cloak back, visible bag block/strap, tiny separated heels, and unmistakable rear-facing outline. Strong value separation without tiny fabric details.
Style: dark fantasy illustration, muted desaturated charcoal, ash grey, weathered blue-grey, worn brown leather, tiny subdued amber accents, painterly broad shapes, melancholic dreamlike atmosphere. Harmonize with the existing reference and dark map tiles. Avoid saturated colors.
Composition: one single full-body standing sprite centered in a square with generous transparent-removal padding. No crop, no ground plane, no cast shadow, no contact shadow, no reflection, no frame, no UI.
Background for removal: perfectly flat solid #00ff00 chroma-key background, one uniform color edge-to-edge. No gradients, texture, floor, lighting variation, reflection, or shadow. Crisp subject edges. Do not use #00ff00 anywhere in the subject.
Constraints: follow docs/spec/world-lore.md 3.1 exactly. No invented weapons, armor, symbols, companions, monsters, extra bags, text, watermark, logo, frame, or UI. Not front-facing, not side-facing, not 3/4, not isometric, not eye-level, not lying down, not realistic tall proportions.
```

## 後処理・検収メモ

- `remove_chroma_key.py` を `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で実行。
- 非透明被写体を縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- 正規化時の補間で生じたalpha 1〜32の緑優勢画素を完全透明化し、低alphaのクロマキー残留も除去。
- final alpha bbox: `(57, 21, 199, 231)`。四隅alpha: `[0, 0, 0, 0]`。
- 鮮緑フリンジ検出0。暗色背景上の32px縮小表示で背面と人物シルエットを確認。
