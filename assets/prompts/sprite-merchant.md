# sprite-merchant

- Asset: `assets/sprites/sprite-merchant.png`
- Kind: map sprite
- Character: 商人 — レンド
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3aa1-0db3-7650-bfb2-91137552725d/ig_0650d8e3acb209ae016a4c741eb338819a96310c891e9a719c.png`

## 外見典拠

`docs/spec/world-lore.md` 3.3:

> 痩身で早口な壮年の男性。片眼鏡、色褪せた行商用の外套、指先にいつもインクの染み

## 立ち絵からの同一人物性

`assets/portraits/npc-merchant.png` の痩身の壮年男性、片眼鏡、色褪せた行商用の外套、革鞄とストラップ、インクで染まった指先を保持した。32px表示では片眼鏡の細部は限界があるため、細い外套シルエット、腰の鞄、暗い指先を優先した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine", final target 256x256 transparent PNG after chroma-key removal.
Primary request: Create the map sprite for sprite-merchant: Lendo, the merchant, same identity as the visible existing portrait assets/portraits/npc-merchant.png.
Identity reference: preserve the same person and outfit from the visible Lendo portrait: slim middle-aged man, sharp narrow silhouette, dark tousled hair, exactly one monocle with one single round lens over only one eye, faded traveling merchant cloak, worn layered travel clothes, leather satchel and straps, ink-stained fingertips. Do not make him stout, young, colorful, aristocratic, or wearing two-lens glasses.
Style reference: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, no text, no watermark. Match the existing project portraits but simplify details for tiny map readability.
Composition/framing: one full-body character standing pose, front-facing, top-down-leaning 3/4 overhead view like a 2D RPG map sprite, centered in a square frame with generous padding. The head may be slightly larger than realistic, about 3.5 to 4 heads tall, with a compact readable silhouette. Feet visible. No crop. No frame. No UI. No ground plane.
Sprite readability: designed to be displayed at 32px on a map. Use a narrow upright cloak silhouette, a clear satchel block at the hip, dark boots, one small bright monocle glint on one eye only, and visible dark-stained fingertips in simplified hands. Slightly stronger value separation than the portrait. Avoid tiny intricate ornamentation that would blur when downscaled.
Lighting/mood: cool blue-grey body tones with restrained amber rim highlights on the monocle rim, cloak edge, and satchel buckle.
Color palette: charcoal, faded blue-grey cloak, grey-brown worn leather, ink-black fingertips, tiny muted amber accents; avoid any #00ff00 in the subject.
Materials/textures: simplified painterly worn cloth, faded cloak, old leather satchel, small metal monocle rim and chain; not pixel art.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 3.3 exactly; exactly one monocle lens over one eye only, no eyeglasses, no spectacles, no two lenses. Do not invent weapons, staff, bright merchant colors, signs, coins, extra characters, monsters, text, watermark, logo, frame, UI, gore, or sexualization. No cast shadow.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、Pillowで256x256へリサイズして `assets/sprites/sprite-merchant.png` に保存。
- 最終PNGは256x256 RGBA。32px表示では細身の外套、革鞄、暗い指先が判別できることを確認。片眼鏡は256px原寸では片側レンズとして見えるが、32pxでは微細表現になる。

## 再生成メモ — M13-1差し戻し対応

- Date: 2026-07-07
- Human review feedback: 前回納品は「3/4のほぼ正面向き立ち絵」で、マップの見下ろし視点と合わなかった。
- Regeneration mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ab7-1ca1-7d50-88b7-ea09b360d479/ig_07a0327dfc0412f8016a4c796b5d4c8191b47e198f6134c60c.png`

### 再生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is 256x256 transparent PNG, displayed at 32px over dark 16px Kenney Roguelike-style map tiles.
Primary request: Regenerate sprite-merchant, Lendo the merchant. Preserve the identity from the visible reference contact sheet and world-lore: slim middle-aged man, sharp narrow silhouette, dark tousled hair, exactly one monocle lens over only one eye, faded traveling merchant cloak, worn layered travel clothes, leather satchel and straps, ink-stained fingertips.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait. The character is standing upright on the ground but seen from a high camera looking down, like a classic JRPG field character. South-facing/front map orientation, yet the camera angle shows mostly the top of dark hair, shoulders, upper cloak, satchel top, and compressed torso; face is small, legs and feet are small near the bottom. 2.5 to 3 heads tall, compact chibi/deformed proportions. Do not make an eye-level 3/4 standing illustration.
Map readability: bold simplified silhouette for 32px display. Narrow cloak shape, clear leather satchel block at one hip, one tiny monocle glint over one eye only, ink-dark fingertips simplified, small boots. Painterly but simple broad shapes, low detail, no intricate fabric folds, no tiny ornaments. Strong clear outline/value separation so he reads on dark tiles.
Style: dark fantasy illustration, muted desaturated colors, cool blue-grey mist, melancholic dreamlike atmosphere, painterly game asset style, no text, no watermark. Harmonize with dark 16px tile map art rather than detailed portrait art.
Palette: charcoal, faded blue-grey cloak, grey-brown worn leather, ink-black fingertips, very small muted amber accents on monocle rim/satchel buckle; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single full-body standing sprite centered in a square frame with generous padding. No crop. No frame. No UI. No ground plane. No cast shadow. No contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding.
Constraints: follow docs/spec/world-lore.md 3.3 exactly. Exactly one monocle lens over one eye only; no two-lens glasses or spectacles. Do not invent weapons, staff, bright merchant colors, signs, coins, extra characters, text, watermark, logo, frame, or UI. Not lying down. Not side-view. Not isometric 3/4 portrait. Not stout or young. Not realistic tall body proportions.
```

### 再生成後処理・検収メモ

- `remove_chroma_key.py` で緑背景を除去し、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(51, 21, 204, 231)`。四隅alphaは0、緑フリンジ検出0。
- 前回より頭頂・肩・鞄上面が見える角度にし、細身の外套シルエットを32pxで読めるよう単純化した。
