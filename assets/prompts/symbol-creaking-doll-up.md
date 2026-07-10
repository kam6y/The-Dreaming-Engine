# symbol-creaking-doll-up

- Asset: `assets/sprites/symbol-creaking-doll-up.png`
- Kind: map sprite
- Enemy: 軋み人形(きしみにんぎょう)
- Direction: up(背面・奥向き)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-creaking-doll.png`
- Secondary reference: `assets/enemies/creaking-doll.png`
- Rejected source (trial 1): `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-f617ca3b-1ee0-40ed-890d-8b699b952cde.png`
- Adopted source (trial 2): `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-2b90257d-68b2-41a8-b623-8cd5f4a6fdb7.png`

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 継ぎ接ぎだらけの人形のような姿、関節が軋む

## 同一個体性メモ

既存正面の大きな罅入り球形頭、灰白い継ぎ接ぎ布・木、真鍮の関節歯車を固定。頭頂が胴を大きく隠す高い俯瞰で、顔を見せない背面にした。

## 試行1 生成プロンプト全文(不採用)

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended for a 256x256 transparent sprite displayed at about 34px.
Asset id: symbol-creaking-doll-up.
Input images: Image 1 is the PRIMARY identity, palette, chibi proportions, simplification, true top-down camera, scale, crack pattern family, and painterly map-sprite reference. Image 2 is SECONDARY material/joint identity reference only; preserve Image 1's compact map proportions.
Primary request: Render the exact same individual Creaking Doll as Image 1 facing UP, as a genuine back view.
Lore invariant: a patchwork doll-like figure with creaking joints, made from broken gear fragments trying to imitate a person.
Direction and camera: UP means the doll faces away toward the canvas top. TRUE TOP-DOWN-LEANING OVERWORLD VIEW from a high camera. Show mostly the rounded cracked back/top of its pale doll head, back of shoulders, patched cloth/wood back, rear joint gears, and tiny compressed legs/feet. The head points to the top. Absolutely no facial features, eye holes, nose, mouth, or front chest panel visible.
Identity invariants: same large round cracked pale doll head with small tarnished gear cap, ash-grey/old-linen patched torso, worn wood-brown limbs, tarnished brass circular shoulder/elbow joints, dark blue-grey seams, same compact 2.5-to-3-head-tall proportions, same visual mass and approximate occupied size as Image 1.
Map readability: bold large-head/shoulders silhouette, short limbs and broad circular joints, broad seams only, readable at 34px.
Style: muted desaturated painterly dark fantasy game asset, blue-grey shadows, tiny amber metal glints, melancholic and uncanny but not gory, matching Image 1.
Composition: one centered doll, generous padding; no crop, weapon, ground, floor, cast/contact shadow, reflection, text, watermark, logo, frame, UI.
Background: perfectly flat solid pure #00ff00 chroma-key, uniform corner-to-corner; no gradient, texture, lighting variation, shadow, glow spill, or transparency. Do not use #00ff00 in subject.
Avoid: face/front features, realistic tall anatomy, living corpse, blood, gore, organs, skull motifs, chains, armor, runes, extra objects, eye-level portrait, pixel art.
```

不採用理由: 背面ではあるが視点が水平寄りで、頭による胴体の遮蔽と脚の俯瞰圧縮が不足した。

## 試行2 生成プロンプト全文(採用)

```text
RETRY 2 after rejecting an eye-level rear figure.
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for a 2D RPG map, displayed at about 34px.
Asset id: symbol-creaking-doll-up.
Input images: Image 1 is the PRIMARY and STRICT reference for camera, compact chibi proportions, scale, identity, palette, and simplification. Image 2 is only a SECONDARY material reference.
Primary request: Render the exact same Creaking Doll as Image 1 facing UP, genuine rear view.
NON-NEGOTIABLE CAMERA: VERY HIGH, NEAR-OVERHEAD TOP-DOWN OVERWORLD CAMERA, matching Image 1. The viewer sees the TOP CROWN of the round head first. The huge head strongly overlaps and hides most of the back torso. Shoulders peek out to each side behind the head. Arms are shortened by foreshortening. Only tiny compressed legs/feet appear near the bottom. The whole body is 2.5 heads tall or less in the image. Absolutely not eye-level, chest-level, orthographic character turnaround, full-height standing portrait, or long-legged figure.
Direction: back of head faces camera while the doll walks away toward canvas top. No face, eyes, nose, mouth, or front chest visible.
Identity: same large round cracked pale cloth/wood doll head with one small tarnished gear cap, same old-linen and ash-grey patchwork, worn wood arms, circular tarnished brass shoulder/elbow joints, dark blue-grey seams, same compact visual mass as Image 1.
Map readability: big head-and-shoulders top silhouette, short joint blocks, tiny feet, broad seams only.
Style: muted desaturated painterly dark fantasy map sprite, blue-grey shadows, tiny amber metal glints, melancholic, matching Image 1.
Composition: one centered doll with generous padding; no ground, floor, cast/contact shadow, reflection, weapon, text, watermark, logo, frame, UI.
Background: perfectly flat solid pure #00ff00 chroma-key, uniform corner-to-corner; no gradient, texture, lighting variation, shadow, glow spill, or transparency. No #00ff00 in subject.
Avoid: eye-level rear portrait, visible full torso, long arms/legs, face/front features, realistic anatomy, corpse, blood, skulls, chains, armor, runes, extra objects, pixel art.
```

## 後処理・検収メモ

- 採用版を正面bbox長辺175pxに合わせて透過・中央配置し、256x256 RGBAへ正規化。
- final alpha bbox: `(46, 40, 210, 215)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で頭頂が胴を隠す背面、短い脚を確認。顔面特徴なし。
