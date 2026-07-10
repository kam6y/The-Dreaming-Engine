# sprite-informant-left

- Asset: `assets/sprites/sprite-informant-left.png`
- Kind: map sprite
- Character: 情報屋 — カイ
- Direction: 左向き(left / 左プロフィール)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-30d80350-d028-4150-81e2-00e679244388.png`

## 外見典拠

`docs/spec/world-lore.md` 3.4:

> 若く痩せた中性的な人物。フードを浅く被り、片方の目元に古い傷。指先で常にコインを弄ぶ癖がある

## 同一人物性メモ

`assets/sprites/sprite-informant.png` の若く痩せた中性的体格、浅い青灰フード、細い外套、腰袋、コインを保持。大きいフード頭頂と肩に対して顔・胴脚を圧縮し、顔・コイン・靴先を左へ向けた。

## 再生成試行

- 初回生成 `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-45c8026b-b488-424d-953a-6b910163abf5.png` は横向き自体は成立したが、約4頭身で目線高寄りだったため不採用。
- 2回目生成 `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-4c1204a6-4bb6-4613-a49d-74856dbcb235.png` は短縮したものの、正面版よりまだ縦長で顔の比重が高かったため不採用。
- 3回目は正面画像だけを参照し、頭頂・肩を上位40〜45%、2.5〜3頭身と固定して採用。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving TRUE TOP-DOWN overworld map sprite for "The Dreaming Engine", 256x256 transparent PNG used at 32px.
Input image: Image 1 (assets/sprites/sprite-informant.png) is the exact and only identity, outfit, palette, painterly style and equipment reference for Kai.
Primary request: Create sprite-informant-left. Same young thin androgynous Kai faces exactly LEFT/WEST in true side profile: shallow blue-grey hood worn over head, dark hair, one old eye scar, narrow cloak, layered street clothes, small waist pouch only, tarnished coin between raised fingertips.
Mandatory overhead geometry: camera is almost overhead and steeply down. The large visible hood crown/top rim and narrow shoulder plane occupy upper 40–45% of height. Tiny foreshortened facial profile is tucked under the hood and points left. Short compressed torso, dramatically shortened legs, tiny clustered boots. Overall 2.5 to 3 heads tall. Match the compact top-down geometry of the existing front sprite, not an eye-level standing illustration.
Direction silhouette: hood/nose and coin hand project left, cloak trails right, knees/toes point left. LEFT must read from 32px outline. Face must remain small; crown and shoulders dominate.
Identity invariants: same shallow hood and narrow cloak, slimmer/smaller cloak mass than player, same muted charcoal/dull blue-grey palette, same coin and waist pouch. No shoulder bag, satchel or diagonal strap. Painterly broad simplified forms, no anime portrait detail.
Composition: one centered full-body sprite with generous padding; no crop, ground, cast/contact shadow, reflection, frame or UI.
Background: perfectly flat uniform #00ff00 edge-to-edge; no gradient, texture, floor, variation or shadow; crisp edges; no #00ff00 in subject.
Constraints: world-lore 3.4. No weapons, daggers, mask, lowered/deep hood, extra scars, jewelry, extra characters, text, watermark or logo. Not front/rear/right/3/4/isometric/eye-level/realistic tall.
```

## 後処理・検収メモ

- `remove_chroma_key.py` を `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で実行。
- 非透明被写体を縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- 正規化時の補間で生じたalpha 1〜32の緑優勢画素を完全透明化し、低alphaのクロマキー残留も除去。
- final alpha bbox: `(70, 21, 187, 231)`。四隅alpha: `[0, 0, 0, 0]`。
- 鮮緑フリンジ検出0。暗色背景上の32px縮小表示で左右方向と人物シルエットを確認。
