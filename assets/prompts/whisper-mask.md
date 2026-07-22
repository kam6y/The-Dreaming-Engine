# whisper-mask

- Asset: `assets/enemies/whisper-mask.png`
- Kind: enemy battle graphic
- Enemy: 囁き仮面(ささやきかめん)
- Record created: 2026-07-06
- Generation mode: Image Gen built-in tool + chroma-key removal

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 罅(ひび)の入った白い面(おもて)が宙に浮かぶ。裏は空洞で、口許から薄い靄がこぼれ、聞き取れない声で囁き続ける

> かつて誰かがつけていた表情を真似ようとして、顔だけが夢に取り残された残響

## 特徴記述

罅の入った白い面が宙に浮く敵。裏側は黒く空洞で、口許から薄い青灰の靄がこぼれる。生身の顔や身体は作らず、仮面の表面だけが表情を真似ようとしている残響として扱う。装飾・角・冠・ルーンなどは加えない。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: enemy battle cutout for The Dreaming Engine, target square 512x512 PNG
Style reference: match the already visible project enemy assets: dark fantasy painterly illustration, muted desaturated colors, dim candlelight accents, blue-grey mist, subtle amber rim light, low contrast, melancholic dreamlike mood, transparent-character-cutout composition.
Primary request: create the enemy "Whisper Mask" (囁き仮面 / sasayaki-kamen).
Lore source: a shallow-dungeon enemy; its appearance is "a cracked white mask floating in the air. The back is hollow, thin mist spills from the mouth, and it keeps whispering in an inaudible voice." It is an echo of a face left behind in dream, calling a name it cannot remember, not a curse.
Subject: a single cracked white theatrical face mask floating alone, not worn by anyone; the back edge reveals it is hollow and empty. The mask has simple human-face-like features only as a mask surface, with fine cracks across the white face. Thin blue-grey mist leaks gently from the mouth area. No full head, no body, no hands, no hair, no horns, no ornate crown or runes.
Composition/framing: centered three-quarter view, front of the mask visible with a slight angle showing hollow interior along one side; fits entirely within a square game-asset frame with generous padding; no ground plane; suitable to overlay on battle backgrounds.
Lighting/mood: dim cool blue-grey shadows on the white mask, restrained amber edge highlight like distant candlelight; wistful, hollow, and mournful rather than aggressive.
Color palette: bone white and ash white mask, charcoal cracks and hollow back, blue-grey mist, tiny muted amber rim light; avoid green in the subject.
Materials/textures: matte cracked mask surface, dark empty interior, thin painterly mist from the mouth; readable silhouette.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The actual image background must be pure bright green (#00ff00), one uniform flat color, not black and not transparent. No shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow the lore appearance exactly; do not add a body, face behind the mask, eyes as living eyeballs, horns, hair, crown, weapon, armor, runes, symbols, blood, gore, text, watermark, logo, frame, or UI. No excessive grotesque detail.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、512x512へリサイズして `assets/enemies/whisper-mask.png` に保存。
- 最終PNGは512x512 RGBA。透明コーナー、キー色残留なしを確認。
