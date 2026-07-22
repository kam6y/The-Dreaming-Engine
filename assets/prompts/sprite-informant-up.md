# sprite-informant-up

- Asset: `assets/sprites/sprite-informant-up.png`
- Kind: map sprite
- Character: 情報屋 — カイ
- Direction: 上向き(up / 背面)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-44c9beda-0fce-4e8b-aa02-667acc6f7ea2.png`

## 外見典拠

`docs/spec/world-lore.md` 3.4:

> 若く痩せた中性的な人物。フードを浅く被り、片方の目元に古い傷。指先で常にコインを弄ぶ癖がある

## 同一人物性メモ

`assets/sprites/sprite-informant.png` の若く痩せた中性的体格、頭に被った浅い青灰フード、細い外套、小さな腰袋、指先のコインを保持。背面なので顔と目元の傷は隠し、フード後頭部・細い背中・片手のコインで人物性を出した。

## 再生成試行

- 初回生成 `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-8e8f214f-99ce-460d-94cb-2f841dc87435.png` は浅いフードが頭から外れ、後頭部の髪が全面に出たため不採用。
- 2回目生成 `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-4d2e3190-e00b-478c-98ac-391c4552781f.png` はフードと俯瞰は改善したが、視点参照の主人公から肩掛け鞄と斜めストラップを取り込んだため不採用。
- 3回目はカイの正面画像だけを参照し、フード着用・腰袋のみ・肩掛け鞄禁止を固定して採用。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving TRUE TOP-DOWN overworld map sprite for "The Dreaming Engine", final 256x256 transparent PNG displayed at 32px.
Input image: Image 1 (assets/sprites/sprite-informant.png) is the exact and only identity, outfit, palette, painterly style, body shape and equipment reference for Kai.
Primary request: Create sprite-informant-up, Kai facing UP/NORTH in true rear view. Same young thin androgynous person, same SHALLOW open blue-grey hood WORN OVER THE HEAD, same narrow worn cloak, same dark hair only partly visible below hood, same layered street clothes and small waist pouch, same tarnished coin held in one raised hand.
Mandatory rear view: show the back crown panel of the shallow hood, rear hood rim, narrow shoulders and cloak back. Face entirely invisible—no eye, scar, nose or mouth. Body faces top of canvas, back faces viewer, heels at bottom.
Mandatory top-down map geometry: camera is almost overhead, steeply looking down. The hood crown is the largest top shape and together with shoulders occupies the upper 40–45% of character height. Torso is severely compressed and legs/heels tiny. Body is 2.5 to 3 heads tall. This is a compact overworld field token, not an eye-level rear portrait.
Distinct from player: Kai is slimmer and narrower, shallow hood smaller, cloak mass narrower, raised coin hand projects clearly at one side. Absolutely no shoulder bag, no satchel, no diagonal shoulder strap, no large mist-frayed player cloak.
Identity invariants: same coin, small waist pouch only, slim androgynous silhouette, muted charcoal/dull blue-grey colors, simplified painterly broad shapes. Do not invent equipment.
Map readability: at 32px rear-facing narrow hood/cloak plus side coin glint clearly distinguish Kai and direction. Strong value blocks, minimal detail.
Composition: one centered full-body sprite, generous padding; no crop, ground, cast/contact shadow, reflection, frame or UI.
Background: perfectly flat uniform solid #00ff00 chroma key edge-to-edge; no gradient, texture, floor, variation or shadow; crisp edge; no #00ff00 in subject.
Constraints: world-lore 3.4 exactly. No shoulder bag/satchel/diagonal strap, weapons, daggers, masks, lowered or removed hood, deep player-like hood, extra scars, jewelry, extra character, text, watermark or logo. Not front/side/3/4/isometric/eye-level/realistic tall.
```

## 後処理・検収メモ

- `remove_chroma_key.py` を `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で実行。
- 非透明被写体を縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- 正規化時の補間で生じたalpha 1〜32の緑優勢画素を完全透明化し、低alphaのクロマキー残留も除去。
- final alpha bbox: `(72, 21, 185, 231)`。四隅alpha: `[0, 0, 0, 0]`。
- 鮮緑フリンジ検出0。暗色背景上の32px縮小表示で背面と人物シルエットを確認。
