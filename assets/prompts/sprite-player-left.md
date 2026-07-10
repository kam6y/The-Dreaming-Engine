# sprite-player-left

- Asset: `assets/sprites/sprite-player-left.png`
- Kind: map sprite
- Character: 主人公 — 名もなき旅人
- Direction: 左向き(left / 左プロフィール)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-30d5120f-5ccd-43d3-af1d-a734d92a96ed.png`

## 外見典拠

`docs/spec/world-lore.md` 3.1:

> 性別を強く特定しない中性的なシルエット、くすんだ旅装(青灰のマント、擦れた革の鞄)、輪郭の一部が霧に溶けるような淡い描写

## 同一人物性メモ

`assets/sprites/sprite-player.png` の大きな青灰のフード、擦れた革鞄、霧へ溶ける外套裾、暗い旅装、2.5〜3頭身を保持。フード開口・胸・小さな靴先が画面左を向く独立生成の横姿とした。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG displayed at about 32px over dark 16px Kenney Roguelike-style map tiles.
Input image: Image 1 is the exact identity, costume, palette, proportions, painterly style, camera-height, and scale reference: assets/sprites/sprite-player.png. Create a newly drawn orientation, not a rotated or mirrored copy.
Primary request: Create sprite-player-left, the unnamed traveler facing LEFT/WEST in a true left-facing profile. Preserve the exact same character and outfit as Image 1: androgynous traveler, large weathered blue-grey hooded cloak, face mostly hidden by hood shadow, worn dark travel clothes, small scuffed brown leather shoulder bag, practical boots, cloak hem dissolving subtly into blue-grey mist.
Orientation definition: LEFT means the face, hood opening, chest, knees, and toes point unmistakably toward the left edge of the canvas. Show a compact left-facing side silhouette; only a tiny shadowed facial profile may be visible. Do not face the viewer and do not turn into a 3/4 front pose.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW identical to Image 1, not an eye-level profile portrait. A high camera looks steeply down at the standing character, showing mostly the hood crown, near shoulder, cloak top plane and compressed side torso; legs/feet are tiny below. Compact 2.5 to 3 heads tall deformed proportions matching Image 1.
Identity and invariants: change only the direction. Keep the same hood size and shape, blue-grey cloak cut and mist-frayed hem, brown bag and straps, muted palette, broad painterly rendering, body scale, padding, and centered placement. Place the bag consistently on the same physical shoulder/hip as the reference, as visible from this left profile.
Map readability: bold simplified silhouette readable at 32px. The hood nose/opening, forward-pointing shoulder/chest, staggered tiny boots/toes, rear cloak trail, and satchel must make LEFT immediately readable from outline alone. Strong value separation, no tiny details.
Style: dark fantasy illustration, muted desaturated charcoal, ash grey, weathered blue-grey, worn brown leather, tiny subdued amber accents, painterly broad shapes, melancholic dreamlike atmosphere. Harmonize with the existing reference and dark map tiles.
Composition: one single full-body standing sprite centered in a square with generous padding. No crop, no ground plane, no cast shadow, no contact shadow, no reflection, no frame, no UI.
Background for removal: perfectly flat solid #00ff00 chroma-key background, one uniform color edge-to-edge. No gradients, texture, floor, lighting variation, reflection, or shadow. Crisp subject edges. Do not use #00ff00 anywhere in the subject.
Constraints: follow docs/spec/world-lore.md 3.1 exactly. No invented weapons, armor, symbols, companions, monsters, extra bags, text, watermark, logo, frame, or UI. Not front-facing, not rear-facing, not right-facing, not 3/4, not isometric, not eye-level, not lying down, not realistic tall proportions.
```

## 後処理・検収メモ

- `remove_chroma_key.py` を `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で実行。
- 非透明被写体を縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- 正規化時の補間で生じたalpha 1〜32の緑優勢画素を完全透明化し、低alphaのクロマキー残留も除去。
- final alpha bbox: `(62, 21, 193, 231)`。四隅alpha: `[0, 0, 0, 0]`。
- 鮮緑フリンジ検出0。暗色背景上の32px縮小表示で左右方向と人物シルエットを確認。
