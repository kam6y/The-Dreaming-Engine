# creaking-doll

- Asset: `assets/enemies/creaking-doll.png`
- Kind: enemy battle graphic
- Enemy: 軋み人形(きしみにんぎょう)
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool + chroma-key removal

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 継ぎ接ぎだらけの人形のような姿、関節が軋む

## 特徴記述

壊死した歯車の欠片が、かつて機関が紡いだ「誰か」の形を真似ようとして留まった残骸。継ぎ接ぎの人形として読める体に、鈍い木・布・古びた人形素材・小さな歯車片が混じる。関節は不自然に軋む印象で、死体や血肉ではなく、壊れた人形と機構の残骸として扱う。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: enemy battle cutout for The Dreaming Engine, target square 512x512 PNG
Style reference: match the already visible project assets: dark fantasy painterly illustration, muted desaturated colors, dim candlelight accents, blue-grey mist, subtle amber rim light, low contrast, melancholic dreamlike mood, transparent-character-cutout composition.
Primary request: create the enemy "Creaking Doll" (軋み人形 / kishimi-ningyou).
Lore source: a deep-dungeon enemy from 夢喰いの裂け目; its appearance is only "a doll-like figure covered in patchwork, with creaking joints" and it is a remnant of broken gear fragments trying to imitate the shape of someone once spun by the engine.
Subject: a single patchwork doll-like figure, eerie but not gory; body assembled from worn cloth, dull wood, cracked porcelain-like pieces, and small broken gear fragments at the joints; joints visibly awkward and creaking; posture slightly bent as if trying to stand like a person but failing. Do not make it a living human corpse.
Composition/framing: centered full-body three-quarter view, fits entirely within a square game-asset frame with generous padding; no ground plane; suitable to overlay on battle backgrounds.
Lighting/mood: dim blue-grey shadows with faint amber rim highlights along worn seams and metal gear edges; sad, abandoned, and uncanny rather than aggressively evil.
Color palette: ash grey, charcoal, old linen beige, muted blue-grey shadows, tarnished brass gear fragments, tiny amber highlights; avoid green in the subject.
Materials/textures: patched cloth seams, scuffed wood, cracked doll surface, tarnished tiny gears at elbows, shoulders, knees, and neck; painterly texture, readable silhouette.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow the lore appearance exactly; do not add weapons, armor, blood, gore, exposed organs, skull motifs, chains, runes, text, watermark, logo, frame, or UI. No excessive grotesque detail.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、`assets/enemies/creaking-doll.png` に保存。
- 最終PNGは512x512 RGBA。
