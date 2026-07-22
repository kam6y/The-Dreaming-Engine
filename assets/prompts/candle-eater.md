# candle-eater

- Asset: `assets/enemies/candle-eater.png`
- Kind: enemy battle graphic
- Enemy: 蝋燭喰らい(ろうそくくらい)
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool + chroma-key removal

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 溶けた蝋のような体に、小さな火を宿す

## 特徴記述

消えかけた燭台の灯を喰らって命を保つ小さな悪夢。溶けた蝋の塊のような体に、小さな琥珀色の火を宿す。灯を守る者を敵と見誤る存在なので、悪意よりも怯えた本能の印象を優先する。燭台・武器・骨・血・過度な異形化は加えない。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: enemy battle cutout for The Dreaming Engine, target square 512x512 PNG
Style reference: match the already visible project assets: dark fantasy painterly illustration, muted desaturated colors, dim candlelight accents, blue-grey mist, subtle amber rim light, low contrast, melancholic dreamlike mood, transparent-character-cutout composition.
Primary request: create the enemy "Candle Eater" (蝋燭喰らい / rousoku-kurai).
Lore source: a shallow-dungeon enemy from 夢喰いの裂け目; its appearance is only "a body like melted wax, carrying a small flame" and it is a small nightmare that survives by eating the light of fading candlesticks, mistaking those who protect light for enemies.
Subject: a single small nightmare creature made of melted candle wax, squat and hunched but not humanoid; body is dripping, pooled, and softened like old wax; one small candle-like amber flame burns inside or atop the wax body. Do not add invented armor, bones, teeth, limbs beyond simple waxy protrusions, or extra props.
Composition/framing: centered full-body three-quarter view, compact enemy silhouette, fits entirely within a square game-asset frame with generous padding; no ground plane; suitable to overlay on battle backgrounds.
Lighting/mood: dim blue-grey ambient darkness with the small internal amber flame softly lighting nearby wax folds; eerie but quiet, more mistaken and needy than malicious.
Color palette: desaturated ivory wax, greyed beige, ash grey, blue-grey shadows, one small muted amber flame; avoid green in the subject.
Materials/textures: painterly melted wax, soft drips, candle soot marks, slight translucency near the flame; readable silhouette.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow the lore appearance exactly; do not add a lantern, candlestick, weapon, clothing, skulls, blood, gore, symbols, runes, text, watermark, logo, frame, or UI. No excessive grotesque detail.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、`assets/enemies/candle-eater.png` に保存。
- 最終PNGは512x512 RGBA。
