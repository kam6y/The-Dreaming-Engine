# symbol-mist-wolf-right

- Asset: `assets/sprites/symbol-mist-wolf-right.png`
- Kind: map sprite
- Enemy: 霧狼(きりおおかみ)
- Direction: right(右向き)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-mist-wolf.png`
- Secondary reference: `assets/enemies/mist-wolf.png`
- Adopted source: `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-b8de08cf-8202-495c-af08-7a7cd1abd89f.png`

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 輪郭の滲んだ、灰色の狼のような影

## 同一個体性メモ

既存正面の灰青色の狼影、霧状の輪郭、琥珀の微光、低い体格を固定。leftの鏡像処理は使わず、頭と口吻を右、尾を左へ置く右向き横姿を個別生成した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended for a 256x256 transparent sprite displayed at about 34px.
Asset id: symbol-mist-wolf-right.
Input images: Image 1 is the PRIMARY identity, palette, simplification, top-down camera, scale, and painterly map-sprite reference (existing down-facing symbol-mist-wolf). Image 2 is a SECONDARY anatomy/material identity reference only. Preserve Image 1's compact simplified map-symbol treatment.
Primary request: Render the exact same individual Mist Wolf as Image 1, with only its facing direction changed to RIGHT. Generate a fresh right-facing view independently; do not mirror or flip a left-facing image.
Lore invariant: a grey wolf-like shadow with blurred, bleeding outlines, wandering rather than purely savage.
Direction and camera: RIGHT means the entire wolf's head, muzzle, ears, torso, paws and body axis point toward the canvas right; tail trails toward the left. TRUE TOP-DOWN-LEANING OVERWORLD VIEW from a high camera: see mostly the top of the back, head, shoulders and haunches plus a compressed right-facing profile. It must read as right at 34px, not down-right and not an eye-level side-view battle pose. Only a minimal sliver of the near facial plane may appear; no frontal face.
Identity invariants: same charcoal/ash/blue-grey smoky body, subtle pale cyan mist-frayed perimeter, tiny muted amber edge accents, compact low wolf proportions, same visual mass and approximate occupied size as Image 1. Broad readable vapor edges.
Map readability: bold simplified silhouette with unmistakable head-right/tail-left direction at 34px. No tiny fur detail.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey mist, melancholic dreamlike atmosphere, matching Image 1 exactly.
Composition/framing: one single wolf centered with generous padding; no crop, frame, UI, ground plane, floor, cast shadow, contact shadow, reflection, text, logo, or watermark.
Background for removal: the actual generated image must use a perfectly flat solid pure #00ff00 chroma-key background, fully uniform corner-to-corner. No gradients, texture, shadows, floor, lighting variation, or transparency. Keep crisp separated edges. Do not use #00ff00 anywhere in the subject.
Avoid: mirrored left output, front view, rear view, eye-level view, portrait, battle pose, pixel art, horns, chains, wounds, skulls, armor, runes, extra objects.
```

## 後処理・検収メモ

- 正面bbox長辺185pxを基準に透過・中央配置し、256x256 RGBAへ正規化。leftとは別生成。
- final alpha bbox: `(35, 88, 220, 167)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で頭が右・尾が左を確認。
