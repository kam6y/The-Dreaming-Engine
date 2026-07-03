# mist-wolf

- Asset: `assets/enemies/mist-wolf.png`
- Kind: enemy battle graphic
- Enemy: 霧狼(きりおおかみ)
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool + chroma-key removal

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 輪郭の滲んだ、灰色の狼のような影

## 特徴記述

忘れ野の小さな綻びが獣の形を取ったもの。灰色の狼のような影として読める輪郭を保ちつつ、背や尾、脚先が青灰の霧へ滲んでほどける。獰猛さよりも寄る辺なく彷徨う印象を優先し、装飾・角・武具・過度な傷や血は加えない。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: enemy battle cutout for The Dreaming Engine, target square 512x512 PNG
Style reference: match the already visible project assets: dark fantasy painterly illustration, muted desaturated colors, dim candlelight accents, blue-grey mist, subtle amber rim light, low contrast, melancholic dreamlike mood, transparent-character-cutout composition.
Primary request: create the enemy "Mist Wolf" (霧狼 / kiri-ookami).
Lore source: a field enemy from 忘れ野; its appearance is only "a grey wolf-like shadow with blurred, bleeding outlines" and its nature is a small tear in the dream that took an animal form, wandering rather than purely savage.
Subject: a single grey wolf-like shadow creature, no invented armor or extra anatomy, wolf silhouette readable but partially dissolved into blue-grey fog; edges smear and fade as if the outline is leaking into mist; posture low and wary, lonely and wandering, not roaring.
Composition/framing: centered full-body three-quarter view, fits entirely within a square game-asset frame with generous padding; no ground plane; suitable to overlay on battle backgrounds.
Lighting/mood: dim cool blue-grey body, very restrained amber edge highlights as if from distant candlelight; melancholic and eerie, not bright.
Color palette: charcoal grey, ash grey, blue-grey fog, tiny muted amber accents only; avoid green in the subject.
Materials/textures: smoky shadow, soft painterly fur suggestion, fog-frayed edges; readable silhouette despite mist.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow the lore appearance exactly; do not add horns, human skulls, chains, wounds, blood, gore, symbols, runes, text, watermark, logo, frame, or UI. No excessive grotesque detail.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、`assets/enemies/mist-wolf.png` に保存。
- 最終PNGは512x512 RGBA。
