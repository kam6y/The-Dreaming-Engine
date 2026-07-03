# dream-eater-phase2

- Asset: `assets/enemies/dream-eater-phase2.png`
- Kind: boss battle graphic
- Enemy: 夢喰い(ゆめくい) 第2形態
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool + chroma-key removal

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 2形態(HP50%以下): 靄が剥がれ落ち、剥き出しの歯車と、飢えを表すような無数の口に近い裂け目が露出する

`docs/spec/world-lore.md` 1.2:

夢喰いは、機関を構成する歯車のひとつが壊れた成れの果て。第2形態は苦痛の限界を越えた反射的な暴走であり、憎悪ではなく苦しみの発露として描写する。

## 特徴記述

第1形態と同じ中央の割れた巨大歯車、非対称の歯車塊、鈍い琥珀光を保つ。第2形態では靄が剥がれ落ち、剥き出しの歯車・破断した金属輪・飢えを示す無数の口に近い裂け目が露出する。裂け目は肉ではなく、黒い機械的な空洞と琥珀の機関光として扱い、血や湿ったグロテスク表現は避ける。

## 第1形態との連続性

共有する特徴: 中央の割れた巨大歯車、歯車が絡み合う巨躯、青灰の靄、鈍い琥珀の内部光、低彩度の金属質。差分: 靄が薄くなり、歯車の露出と口に近い裂け目が大幅に増える。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: boss battle cutout for The Dreaming Engine, target square 768x768 PNG
Style reference: match the already visible project assets and the immediately previous Dream Eater phase 1 image: dark fantasy painterly illustration, muted desaturated colors, dim candlelight accents, blue-grey mist, subtle amber rim light, low contrast, melancholic dreamlike mood, transparent-character-cutout composition.
Primary request: create the boss "Dream Eater" (夢喰い / yume-kui), phase 2, clearly the same entity transformed from phase 1.
Lore source: phase 2 appears below 50% HP: "the mist peels away, exposing bare gears and countless mouth-like rifts that express hunger." It is a reflexive rampage past the limit of pain, not hatred.
Shared identity from phase 1: preserve the central cracked giant gear core, the hunched asymmetrical mass of interlocked gears, tarnished brass and charcoal metal, blue-grey dream mist remnants, and dim internal amber engine-light. It must read as the same Dream Eater after its protective mist has fallen away.
Phase 2 differences: much less mist than phase 1; more exposed broken gear teeth, cracked metal rings, raw mechanical cavities, and many dark mouth-like slits opened between gears and along the central core. The slits should resemble hungry mouths only in shape, not wet flesh: no lips, no blood, no gums, no gore. Amber light leaks from some slits like starving furnace light.
Subject: a single massive boss entity of bare gears and torn-off mist, twisted in a more unstable posture than phase 1; mechanical pain and hunger made visible, but still mournful rather than gleefully evil.
Composition/framing: centered three-quarter view, full boss silhouette fits inside a square game-asset frame with generous padding; imposing and readable; no ground plane; suitable to overlay on battle backgrounds.
Lighting/mood: darker and harsher than phase 1 but still low contrast; cold blue-grey shadows with restrained amber light leaking from exposed cracks; tragic, exhausted, and violent by reflex.
Color palette: charcoal black metal, tarnished brass, ash grey, sparse blue-grey mist, muted amber furnace glow; avoid green in the subject.
Materials/textures: exposed corroded gears, cracked metal teeth, soot-dark rifts, thin torn fog ribbons, painterly texture; no wet gore.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow the lore appearance exactly; do not add a humanoid face, eyes, horns, wings, weapons, armor, blood, gore, exposed organs, text, watermark, logo, frame, or UI. No excessive grotesque detail. Make this a continuation of phase 1, not a different creature.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、`assets/enemies/dream-eater-phase2.png` に保存。
- 最終PNGは768x768 RGBA。

## 2026-07-03 レビュー対応再生成

人間レビューで「第1形態と大差がなく、ラスボス感が足りない」と指摘されたため上書き再生成。
前回版は、第1形態との連続性は保てていたが、低い塊状のシルエットと均等に散った小裂け目が強く、遠目では「靄の薄い第1形態」に見えやすかった。今回はロアの範囲内で、次の3点を優先した。

- 第1形態のうずくまった塊から、壊れた歯車弧が展開してそびえるシルエットへ変える。
- 中央の割れた巨大歯車を縦に大きく裂き、飢えた炉のような支配的な大裂け目を作る。
- 靄を残滓まで減らし、琥珀の機関光を第1形態より明確に強める。

### 採用プロンプト全文

```text
Use case: stylized-concept
Asset type: boss battle transparent cutout for The Dreaming Engine, target square around 768x768 PNG after background removal
Reference images: use the visible project Dream Eater phase 1 and previous phase 2 only as style and identity context. Keep the same boss identity: central cracked giant gear, tarnished brass and charcoal metal, exposed interlocked gears, painterly dark fantasy, muted low-saturation blue-grey and amber palette.
Primary request: regenerate "Dream Eater" (夢喰い / yume-kui), phase 2. It must read immediately as a stronger final-boss escalation from phase 1 while obeying lore: mist peeled away, bare gears exposed, many mouth-like rifts of hunger, suffering rather than hatred.
Critical silhouette requirement: create a tall, looming, unstable opened posture made ONLY from broken gear rings and gear clusters. The outer silhouette should look like shattered circular gear arcs opening around the core, like a damaged mechanical iris or flowered gear aperture. No limb-like appendages, no claws, no pincers, no scythes, no blade arms, no horns, no wings. Every sharp outer shape must visibly be part of a broken circular gear ring with teeth or metal plates.
Dominant core: a huge central cracked gear dominates the body. It is split vertically into one large mouth-like furnace rift, the clear focal point. The rift is a black dry mechanical void edged by jagged broken gear teeth and cracked metal plates, with intense muted amber engine-light pouring out from deep inside. It should not look like a humanoid face or animal mouth; no eyes, lips, tongue, gums, wet flesh, or blood.
Secondary details: a few smaller mouth-like slits and exposed cavities between surrounding gears, all subordinate to the central vertical rift. Avoid a repeated pattern of many equal round mouths. Show exposed corroded gears, torn metal rings, dry soot-dark cavities, and small gear fragments.
Mist and escalation: compared with phase 1, the blue-grey mist is almost gone. Only thin torn wisps remain around lower edges and in narrow gaps. Bare tarnished brass and charcoal gearwork dominate. Amber glow is clearly much stronger than phase 1: furnace-like amber light, tiny sparks, and subtle heat shimmer near the central rift, but no red flame and no flashy magic.
Mood: tragic, exhausted, reflexive rampage caused by pain and starvation; not gleefully evil. Painterly illustration, dark fantasy, melancholic dreamlike atmosphere, controlled contrast.
Color palette: charcoal black metal, tarnished brass, ash grey, sparse blue-grey mist remnants, muted amber furnace glow. Avoid green in the subject.
Composition/framing: centered three-quarter view, full boss silhouette visible with generous padding, upright looming posture, no ground plane, no cast shadow, game battle cutout.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Hard constraints: no humanoid face, no eyes, no horns, no wings, no weapons, no armor, no claws, no limbs, no blade shapes, no blood, no gore, no exposed organs, no wet organic tissue, no title text, no watermark, no frame, no UI. Same Dream Eater, phase 2 escalation only.
```

### 試行メモ

- 試行1: 中央の縦裂け目と発光は強く出たが、左下の外周破片が爪・肢状に読めたため不採用。ロア外の新要素に見える危険があった。
- 試行2: 「破断した歯車弧・リングのみ」「肢状シルエット禁止」を強めて再生成し採用。中央大裂け目、展開した歯車弧、ほぼ剥がれた靄、強い琥珀光が出た。
- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過後、768x768へリサイズし、`assets/enemies/dream-eater-phase2.png` に上書き保存。
- 最終PNGは768x768 RGBA。透明コーナー、キー色残留なしを確認。
