# dream-eater

- Asset: `assets/enemies/dream-eater.png`
- Kind: boss battle graphic
- Enemy: 夢喰い(ゆめくい) 第1形態
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool + chroma-key removal

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 1形態: 歯車と靄が絡み合った巨躯

`docs/spec/world-lore.md` 1.2:

夢喰いは機関を構成する歯車のひとつが、燃料の枯渇に耐えかねて壊れた成れの果て。悪意ではなく、苦痛と飢えの反射として世界を喰らい続ける。

## 特徴記述

歯車と青灰の靄が絡み合った巨躯。中央の割れた巨大歯車を核に、鈍い金属の輪・小歯車・濃い靄が折り重なる。隙間には失われかけた機関の灯を示す小さな琥珀光がある。第1形態では、口に近い裂け目や露出した飢えの表現は抑え、苦しみを抱えた壊れた機関として見せる。

## 第2形態への連続性メモ

第2形態では、中央の割れた巨大歯車、非対称の歯車塊、青灰の靄、内部の鈍い琥珀光を共有する。差分は、靄が剥がれ落ち、剥き出しの歯車と無数の口に近い裂け目が露出すること。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: boss battle cutout for The Dreaming Engine, target square 768x768 PNG
Style reference: match the already visible project assets: dark fantasy painterly illustration, muted desaturated colors, dim candlelight accents, blue-grey mist, subtle amber rim light, low contrast, melancholic dreamlike mood, transparent-character-cutout composition; echo the distant broken gear machinery mood from the title background.
Primary request: create the boss "Dream Eater" (夢喰い / yume-kui), phase 1.
Lore source: the Dream Eater is the remains of one gear of the Dreaming Engine, broken by starvation; its phase 1 appearance is "a huge body where gears and mist are intertwined." It is not evil by intent; it is pain and hunger made reflexive.
Subject: a single massive boss entity made from interlocked broken gears and thick blue-grey dream mist, a giant hunched mechanical silhouette with no ordinary animal or human body. Large tarnished gears form the core, shoulders, and curved mass; blue-grey fog wraps through and around the gears like torn cloth and breath. Include small dim amber light glows deep within a few gear gaps to suggest failing engine-light. No exposed mouths or mouth-like slits in phase 1.
Composition/framing: centered three-quarter view, full boss silhouette fits inside a square game-asset frame with generous padding; imposing but readable; no ground plane; suitable to overlay on battle backgrounds.
Lighting/mood: dim blue-grey mist and low contrast, faint candlelike amber rim light on gear teeth and inner gaps; mournful, heavy, and dreamlike, more tortured machine than villain.
Color palette: charcoal metal, tarnished brass, ash grey, blue-grey mist, tiny muted amber light; avoid green in the subject.
Materials/textures: corroded gear teeth, cracked metal rims, soft painterly fog, soot-dark cavities, frayed mist edges; no wet gore.
Continuity anchor for phase 2: central cracked gear core, hunched asymmetrical gear mass, blue-grey mist wrapping through the body, muted amber internal light.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow the lore appearance exactly; do not add a humanoid face, eyes, horns, wings, weapons, armor, blood, gore, exposed organs, text, watermark, logo, frame, or UI. No excessive grotesque detail. Phase 1 must not show the many mouth-like exposed slits; reserve that for phase 2.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、`assets/enemies/dream-eater.png` に保存。
- 最終PNGは768x768 RGBA。
