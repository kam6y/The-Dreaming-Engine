# sprite-merchant-right

- Asset: `assets/sprites/sprite-merchant-right.png`
- Kind: map sprite
- Character: 商人 — レンド
- Direction: 右向き(right / 右プロフィール)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-1d31e242-4bfb-4c0a-bd1b-5dccc4903d46.png`

## 外見典拠

`docs/spec/world-lore.md` 3.3:

> 痩身で早口な壮年の男性。片眼鏡、色褪せた行商用の外套、指先にいつもインクの染み

## 同一人物性メモ

`assets/sprites/sprite-merchant.png` の痩身、暗い乱れ髪、片目だけの片眼鏡、色褪せた青灰の外套、革鞄とストラップ、インク染みの指を保持。左向きの鏡像ではなく独立生成し、頭頂・肩を大きく、顔・胴脚を圧縮した。

## 再生成試行

- 初回生成 `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-b5ac0271-9cf7-486f-9a99-baccfd5c6324.png` は約4頭身の目線高寄りプロフィールになったため不採用。
- 2回目は既存主人公右向きを「視点・頭身だけ」の参照に加え、2.5〜3頭身の俯瞰用形状へ再生成した。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving TRUE TOP-DOWN overworld map sprite for "The Dreaming Engine", final 256x256 transparent PNG used at 32px.
Input images: Image 1 (assets/sprites/sprite-merchant.png) is the exact identity, outfit, palette and character-style reference for Lendo. Image 2 (assets/sprites/sprite-player-right.png) is ONLY the required RIGHT-facing high-camera geometry, severe foreshortening, compact 2.5–3-head body ratio, silhouette thickness and map-sprite scale reference; do not copy Image 2's person or clothing.
Primary request: Regenerate sprite-merchant-right. Lendo faces exactly RIGHT/EAST in a strict side profile while seen from the same steep overhead camera and compact proportions as Image 2. Independently draw it; not a mirror of left.
Lendo identity from Image 1: slim middle-aged man, dark tousled hair, exactly one single round monocle lens over only one eye, faded blue-grey traveling merchant cloak, worn layered clothes, brown leather satchel/straps, ink-stained fingertips, small boots. Same person, same outfit, same colors.
Mandatory geometry: head/hair crown plus shoulder plane must occupy roughly the upper 40% of the visible character height. Camera is high above, looking steeply down. Show a large oval crown of hair, large near shoulder/cloak top surface and satchel top; the tiny facial profile is tucked below the crown and points right. Compress torso and shorten legs dramatically. Body only 2.5 to 3 heads tall. Tiny feet cluster near bottom. Field-map token viewed overhead, NOT eye-level standing profile and NOT tall portrait.
Orientation: nose, small face, chest, knees and boot toes all point right. Cloak trails to left. Silhouette alone reads RIGHT at 32px. No turn toward viewer; no 3/4.
Identity invariants: exactly one monocle lens total, hidden if on far eye; a subtle chain may show; never spectacles. Same dark hair, faded cloak, satchel at same physical hip, ink fingers, muted palette. Change only orientation and camera geometry.
Style: broad simplified painterly dark fantasy shapes, muted charcoal, faded blue-grey, grey-brown leather and tiny subdued amber metal accents; strong value separation on dark tiles, no tiny ornamentation.
Composition: one centered full-body standing sprite, generous padding, no crop, ground plane, shadow, reflection, frame or UI.
Background: perfectly flat uniform solid #00ff00 chroma key edge-to-edge; no gradient, texture, floor, lighting variation or shadow; crisp edges; no #00ff00 in subject.
Constraints: world-lore 3.3 exactly. No weapons, staff, signs, coins, bright colors, extra characters, text, watermark or logo. Absolutely not eye-level, not realistic tall proportions, not front/rear/left, not 3/4, not isometric.
```

## 後処理・検収メモ

- `remove_chroma_key.py` を `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で実行。
- 非透明被写体を縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- 正規化時の補間で生じたalpha 1〜32の緑優勢画素を完全透明化し、低alphaのクロマキー残留も除去。
- final alpha bbox: `(66, 21, 189, 231)`。四隅alpha: `[0, 0, 0, 0]`。
- 鮮緑フリンジ検出0。暗色背景上の32px縮小表示で左右方向と人物シルエットを確認。
