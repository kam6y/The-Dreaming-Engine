# symbol-mist-wolf-up

- Asset: `assets/sprites/symbol-mist-wolf-up.png`
- Kind: map sprite
- Enemy: 霧狼(きりおおかみ)
- Direction: up(背面・画面奥向き)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-mist-wolf.png`
- Secondary reference: `assets/enemies/mist-wolf.png`
- Adopted source: `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-99df119d-8ba1-419c-8f3a-b5bb62b046b8.png`

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 輪郭の滲んだ、灰色の狼のような影

## 同一個体性メモ

既存正面シンボルの灰青色の狼影、青灰の霧へほどける輪郭、わずかな琥珀の縁光、低い獣の体格を固定。背面では顔・目・口吻を見せず、頭頂・背・腰・尾だけで同じ個体のup方向を表現した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended for a 256x256 transparent sprite displayed at about 34px.
Asset id: symbol-mist-wolf-up.
Input images: Image 1 is the PRIMARY identity, palette, simplification, top-down camera, scale, and painterly map-sprite reference (existing down-facing symbol-mist-wolf). Image 2 is a SECONDARY anatomy/material identity reference only (battle graphic). Preserve Image 1's compact simplified map-symbol treatment.
Primary request: Render the exact same individual Mist Wolf as Image 1, with only its facing direction changed to UP. This is a newly rendered rear view, not a rotation or flip.
Lore invariant: a grey wolf-like shadow with blurred, bleeding outlines; a small tear in the dream that took animal form, wandering rather than purely savage.
Direction and camera: UP means the wolf is moving away toward the top of the canvas. TRUE TOP-DOWN-LEANING OVERWORLD VIEW from a high camera. Show the smoky back, spine, back of head, ears, shoulders, haunches and tail from above. The head points toward the canvas top and the tail trails toward the bottom. Absolutely no face, eyes, muzzle, nose, mouth, or frontal chest visible.
Identity invariants: same charcoal/ash/blue-grey smoky body, same subtle pale cyan mist-frayed perimeter, same tiny muted amber edge accents, same compact low wolf proportions, same visual mass and approximate occupied size as Image 1. Broad readable vapor edges, not delicate wisps.
Map readability: bold simplified silhouette and clear head/back/tail direction at 34px. Strong value separation for dark tiles; no tiny fur detail.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey mist, melancholic dreamlike atmosphere, matching Image 1 exactly.
Composition/framing: one single wolf centered with generous padding; no crop, frame, UI, ground plane, floor, cast shadow, contact shadow, reflection, text, logo, or watermark.
Background for removal: the actual generated image must use a perfectly flat solid pure #00ff00 chroma-key background, fully uniform corner-to-corner. No gradients, texture, shadows, floor, lighting variation, or transparency. Keep crisp separated edges. Do not use #00ff00 anywhere in the subject.
Avoid: side view, front view, eye-level view, portrait, battle pose, pixel art, horns, chains, wounds, skulls, armor, runes, extra objects.
```

## 後処理・検収メモ

- `remove_chroma_key.py`(border自動採色、soft matte、despill)で透過後、既存正面のalpha bbox長辺185pxに合わせて中央配置し、256x256 RGBAへ正規化。
- final alpha bbox: `(89, 35, 167, 220)`。四隅alpha: `[0, 0, 0, 0]`(左上・右上・左下・右下)。
- 緑優勢の可視画素0。34px縮小で背面、頭が上・尾が下へ向くシルエットを確認。
