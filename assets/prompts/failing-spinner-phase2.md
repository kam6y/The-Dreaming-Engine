# failing-spinner-phase2

- Asset: `assets/enemies/failing-spinner-phase2.png`
- Kind: enemy battle graphic
- Enemy: 紡ぎ損ない(つむぎそこない) 第2形態
- Record created: 2026-07-06
- Generation mode: Image Gen built-in tool + chroma-key removal

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 2形態(HP50%以下): 糸が焼け落ち、剥き出しの紡錘が軋みながら逆しまに回りだす

> 2形態は怒りではなく、止まれないことへの疲弊として演出すること

## 特徴記述

第1形態と同じ壊れた織機フレーム、中央の紡錘位置、暗い木金属の巨躯を保つ。第2形態では、長く垂れていた糸の大半が焼け落ち、短い炭化片と灰の繊維だけが残る。中央の紡錘は剥き出しになり、逆しまに回る軌跡を淡く見せる。怒りや炎上ではなく、止まれない機構の疲弊として描く。

## 第1形態との連続性

共有する特徴: 壊れた織機フレーム、中央の紡錘、非人型の四角い巨躯、青灰の霧、鈍い琥珀の微光、暗い木金属の質感。差分: 糸が焼け落ち、中央紡錘が露出し、逆回転の軌跡が見える。

## 生成プロンプト全文

```text
Regenerate Failing Spinner phase 2 by using the earlier Failing Spinner phase 1 image with the rectangular ruined loom frame as the direct reference. Preserve that phase 1 silhouette and layout almost exactly.

Use case: precise-object-edit / stylized-concept
Asset type: mid-boss enemy battle cutout for The Dreaming Engine, target square 512x512 PNG
Primary request: create "Failing Spinner" (紡ぎ損ない / tsumugi-sokonai), phase 2. Same entity as phase 1, not a redesign.
Lore source: phase 2 appearance is only "the threads burn away, and the exposed spindle begins turning backwards with a creak." The emotion is exhaustion from being unable to stop, not rage.
Locked identity from phase 1: keep the same rectangular broken loom frame, same tall central vertical supports, same upper and lower crossbeams, same central spindle location, same three-quarter angle, same wide loom silhouette, and same square game-asset framing. Keep it visibly a ruined loom, not a gear golem and not a new boss.
Do NOT add new major masses: no huge side gear bodies, no arm-like side forms, no claw shapes, no new outer wheel halo, no extra creature anatomy. Existing small wheels or pulleys may remain subdued only if they support the loom mechanism.
Phase 2 changes only: remove most of the long hanging threads from phase 1, leaving short charred stubs, curled ash fibers, and a few scorched strands still attached to the same beams. The central spindle is more exposed and darker, with subtle pale motion arcs indicating reverse spinning. Add faint soot and tiny muted amber embers where threads burned. No large flames, no red fire, no flashy magic.
Subject: a single exhausted non-humanoid broken loom-machine, central exposed spindle focal point, creaking and reverse-spinning because it cannot stop.
Style/medium: dark fantasy painterly illustration, muted desaturated colors, low contrast, melancholic dreamlike mood, consistent with The Dreaming Engine enemy assets.
Composition/framing: centered three-quarter view, entire rectangular loom creature visible with padding on every side; do not crop against image borders. No ground plane, no cast shadow, no floor debris.
Lighting/mood: dim blue-grey shadows, sparse muted amber ember light in spindle and burned thread ends; sad, strained, and depleted.
Color palette: charcoal burned loom frame, ash grey, tarnished brass exposed spindle, soot black, sparse blue-grey mist remnants, muted amber embers. Avoid green in the subject.
Materials/textures: charred thread stubs, cracked old loom beams, corroded spindle metal, soot-dark cavities, faint smoke wisps, painterly texture.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The actual image background must be pure bright green (#00ff00), one uniform flat color, not black and not transparent. No shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Hard constraints: no humanoid face, no eyes, no horns, no wings, no arms, no legs, no claws, no weapons, no armor, no runes, no symbols, no blood, no gore, no wet organic tissue, no lanterns, no lamps, no candles, no title text, no watermark, no frame, no UI.
```

## 生成メモ

- 試行1は歯車塊が増えて第1形態の織機シルエットから離れたため不採用。
- 採用版では、第1形態の矩形フレーム、中央紡錘、上部・下部の横木を固定し、差分を糸の焼失と紡錘の露出に絞った。
- 完全な画像編集一致ではないが、壊れた織機フレームと中央紡錘の同一性を優先して採用した。
- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、512x512へリサイズして `assets/enemies/failing-spinner-phase2.png` に保存。
- 最終PNGは512x512 RGBA。透明コーナー、キー色残留ほぼなしを確認。
