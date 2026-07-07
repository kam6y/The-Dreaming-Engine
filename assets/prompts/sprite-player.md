# sprite-player

- Asset: `assets/sprites/sprite-player.png`
- Kind: map sprite
- Character: 主人公 — 名もなき旅人
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3aa1-0db3-7650-bfb2-91137552725d/ig_086238cf496e0275016a4c73587b8c8198a205716e156cfe64.png`

## 外見典拠

`docs/spec/world-lore.md` 3.1:

> 性別を強く特定しない中性的なシルエット、くすんだ旅装(青灰のマント、擦れた革の鞄)、輪郭の一部が霧に溶けるような淡い描写

## 立ち絵からの同一人物性

`assets/portraits/player.png` の大きなフード付き青灰マント、影に隠れた顔、擦れた革の鞄、革ベルトと実用的なブーツ、右側のマントが青灰から青緑の霧へ溶ける特徴を保持した。マップ上で32px表示されるため、細部装飾よりもフードと外套、鞄、霧化した裾のシルエットを優先した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine", final target 256x256 transparent PNG after chroma-key removal.
Primary request: Create the map sprite for sprite-player: the unnamed traveler, same identity as the visible existing portrait assets/portraits/player.png.
Identity reference: preserve the same person and outfit from the visible player portrait: strongly androgynous, age and gender not fixed, large weathered blue-grey hooded cloak, face partly hidden in shadow under the hood, worn traveler clothing, leather belt and straps, scuffed leather shoulder bag, practical boots, and a portion of the cloak edge dissolving subtly into blue-grey mist. Do not make the traveler clearly male or female.
Style reference: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, no text, no watermark. Match the existing project portraits but simplify details for tiny map readability.
Composition/framing: one full-body character standing pose, front-facing, top-down-leaning 3/4 overhead view like a 2D RPG map sprite, centered in a square frame with generous padding. The head may be slightly larger than realistic, about 3.5 to 4 heads tall, with a compact readable silhouette. Feet visible. No crop. No frame. No UI. No ground plane.
Sprite readability: designed to be displayed at 32px on a map. Use a bold cloak silhouette, clear dark boots, readable shoulder bag shape, and slightly stronger value separation than the portrait. Avoid tiny intricate ornamentation that would blur when downscaled.
Lighting/mood: cool blue-grey body tones with restrained amber rim highlights on cloth edges and metal fittings; low contrast overall but enough separation for a small sprite.
Color palette: charcoal, ash grey, weathered blue-grey cloak, worn brown leather, tiny muted amber accents; avoid any #00ff00 in the subject.
Materials/textures: simplified painterly cloth, worn leather, light mist-frayed cloak edge; not pixel art.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 3.1 exactly; do not invent new symbols, weapons, armor, companions, monsters, text, watermark, logo, frame, or UI. No excessive grotesque detail. No cast shadow.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、Pillowで256x256へリサイズして `assets/sprites/sprite-player.png` に保存。
- 最終PNGは256x256 RGBA。32px表示では青灰のフード外套、革鞄、霧化した裾が判別できることを確認。

## 再生成メモ — M13-1差し戻し対応

- Date: 2026-07-07
- Human review feedback: 前回納品は「3/4のほぼ正面向き立ち絵」で、マップの見下ろし視点と合わなかった。
- Regeneration mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ab7-1ca1-7d50-88b7-ea09b360d479/ig_07a0327dfc0412f8016a4c78ea45ac81918da327ecaafe9826.png`

### 再生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is 256x256 transparent PNG, displayed at 32px over dark 16px Kenney Roguelike-style map tiles.
Primary request: Regenerate sprite-player, the unnamed traveler. Preserve the identity from the visible reference contact sheet: androgynous traveler in a large weathered blue-grey hooded cloak, face obscured by hood shadow, worn travel clothes, small scuffed leather shoulder bag, practical boots, cloak edge dissolving subtly into blue-grey mist.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait. The character is standing upright on the ground but seen from a high camera looking down, like a classic JRPG field character. South-facing/front map orientation, yet the camera angle shows mostly the top of the hood, shoulders, upper cloak, and compressed torso; the face is small and partly hidden, legs and feet are small near the bottom. 2.5 to 3 heads tall, compact chibi/deformed proportions. Do not make an eye-level 3/4 standing illustration.
Map readability: bold simplified silhouette for 32px display. Big hood-and-shoulder shape, clear cloak mass, tiny leather bag block, small boots, mist-frayed cloak hem. Painterly but simple broad shapes, low detail, no intricate fabric folds, no tiny ornaments. Strong clear outline/value separation so it reads on dark tiles.
Style: dark fantasy illustration, muted desaturated colors, cool blue-grey mist, melancholic dreamlike atmosphere, painterly game asset style, no text, no watermark. Harmonize with dark 16px tile map art rather than detailed portrait art.
Palette: charcoal, ash grey, weathered blue-grey cloak, worn brown leather, very small muted amber accents; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single full-body standing sprite centered in a square frame with generous padding. No crop. No frame. No UI. No ground plane. No cast shadow. No contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding.
Constraints: follow docs/spec/world-lore.md 3.1 exactly. Do not invent weapons, armor, symbols, companions, monsters, text, watermark, logo, frame, or UI. Not lying down. Not side-view. Not isometric 3/4 portrait. Not realistic tall body proportions.
```

### 再生成後処理・検収メモ

- `remove_chroma_key.py` で緑背景を除去し、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(46, 21, 210, 231)`。四隅alphaは0、緑フリンジ検出0。
- 前回より頭・肩・フードを大きく、胴体と足元を短くし、32px表示でマップ俯瞰キャラとして読めるようにした。
