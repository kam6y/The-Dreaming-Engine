# sprite-informant

- Asset: `assets/sprites/sprite-informant.png`
- Kind: map sprite
- Character: 情報屋 — カイ
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3aa1-0db3-7650-bfb2-91137552725d/ig_0650d8e3acb209ae016a4c746719a4819a9593369b2e602ffb.png`

## 外見典拠

`docs/spec/world-lore.md` 3.4:

> 若く痩せた中性的な人物。フードを浅く被り、片方の目元に古い傷。指先で常にコインを弄ぶ癖がある

## 立ち絵からの同一人物性

`assets/portraits/npc-informant.png` の若く痩せた中性的な顔立ち、浅いフード、片方の目元の古傷、指先で持つ小さなコイン、青灰のフード付き外套を保持した。32px表示では主人公と混同しないよう、より細身で、片手を上げてコインを持つ形を強調した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine", final target 256x256 transparent PNG after chroma-key removal.
Primary request: Create the map sprite for sprite-informant: Kai, the informant, same identity as the visible existing portrait assets/portraits/npc-informant.png.
Identity reference: preserve the same person and outfit from the visible Kai portrait: young thin androgynous person, shallow hood that does not hide the face, one old healed scar near one eye, small tarnished coin held and toyed with between fingertips, worn hooded cloak and layered tavern-street clothes, slim agile stance, not overtly sinister. Do not make Kai strongly masculine or strongly feminine.
Style reference: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, no text, no watermark. Match the existing project portraits but simplify details for tiny map readability.
Composition/framing: one full-body character standing pose, front-facing, top-down-leaning 3/4 overhead view like a 2D RPG map sprite, centered in a square frame with generous padding. The head may be slightly larger than realistic, about 3.5 to 4 heads tall, with a compact readable silhouette. Feet visible. No crop. No frame. No UI. No ground plane.
Sprite readability: designed to be displayed at 32px on a map. Use a slim hooded silhouette, visible face under a shallow hood, one raised hand with a small muted coin, narrow cloak edges, dark boots, and slightly stronger value separation than the portrait. The eye scar and coin can be simplified but should remain visible in the 256px source.
Lighting/mood: cool blue-grey body tones with restrained amber highlights on the coin, cheekbone, and cloak trim; elusive but not villainous.
Color palette: charcoal, smoke-brown, faded black, dull blue-grey hooded cloak, small tarnished muted metal coin, tiny muted amber accents; avoid any #00ff00 in the subject.
Materials/textures: simplified painterly worn cloth, light leather straps, small tarnished coin; not pixel art.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 3.4 exactly; do not invent weapons, daggers, masks, deep hidden hood, extra scars, bright jewelry, extra characters, monsters, text, watermark, logo, frame, UI, gore, blood, or sexualization. No cast shadow.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、Pillowで256x256へリサイズして `assets/sprites/sprite-informant.png` に保存。
- 最終PNGは256x256 RGBA。32px表示では細いフード付き外套とコインを持つ片手が判別できることを確認。

## 再生成メモ — M13-1差し戻し対応

- Date: 2026-07-07
- Human review feedback: 前回納品は「3/4のほぼ正面向き立ち絵」で、マップの見下ろし視点と合わなかった。
- Regeneration mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Rejected source generation: `/Users/goodapple/.codex/generated_images/019f3ab7-1ca1-7d50-88b7-ea09b360d479/ig_07a0327dfc0412f8016a4c79af9d58819193df3775ff105e3e.png` (プレイヤーとフードの塊が近く、コインが読みづらかった)
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f3ab7-1ca1-7d50-88b7-ea09b360d479/ig_0c8cf8204f9f302e016a4c7ab9ebbc8191aaab5ec691c9748d.png`

### 再生成プロンプト全文(採用版)

```text
Use case: stylized-concept
Asset type: top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is 256x256 transparent PNG, displayed at 32px over dark 16px Kenney Roguelike-style map tiles.
Primary request: Regenerate sprite-informant, Kai the informant, with stronger visual separation from the player. Preserve world-lore: young thin androgynous person, shallow hood, one old healed scar near one eye, constantly toys with a small coin between fingertips, worn hooded tavern-street clothes, slim agile stance.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait. Standing upright on the ground but seen from a high camera looking down like a classic JRPG field character. South-facing/front map orientation, camera shows top rim of shallow hood, head/hair, shoulders, raised hand with coin, compressed torso, small legs/feet. 2.5 to 3 heads tall, compact deformed overworld proportions. Do not make an eye-level 3/4 standing illustration.
Make Kai distinct from sprite-player: shallow open hood, smaller cloak mass, slimmer shoulders, more visible face, one raised hand clearly outside the cloak holding a round tarnished coin with a tiny muted amber glint. The coin and hand should form a readable side silhouette. No large enveloping hood, no mist-frayed cloak hem.
Map readability: bold simplified silhouette for 32px display. Slim narrow body, open shallow hood, raised hand/coin, small dark boots, simple cloak edges. Painterly but broad and simple, low detail, no intricate folds. Strong clear outline/value separation on dark tiles.
Style: dark fantasy illustration, muted desaturated colors, cool blue-grey mist, melancholic dreamlike atmosphere, painterly game asset style, no text, no watermark. Harmonize with dark 16px tile map art rather than detailed portrait art.
Palette: charcoal, smoke-brown, faded black, dull blue-grey hooded cloak, tarnished muted metal coin, tiny subdued amber coin accent; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single full-body standing sprite centered in a square frame with generous padding. No crop. No frame. No UI. No ground plane. No cast shadow. No contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding.
Constraints: follow docs/spec/world-lore.md 3.4 exactly. Do not make Kai strongly masculine or strongly feminine. Do not invent weapons, daggers, masks, deep hidden hood, extra scars, bright jewelry, extra characters, text, watermark, logo, frame, or UI. Not lying down. Not side-view. Not isometric 3/4 portrait. Not realistic tall body proportions.
```

### 再生成後処理・検収メモ

- `remove_chroma_key.py` で緑背景を除去し、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(67, 21, 188, 231)`。四隅alphaは0、緑フリンジ検出0。
- カイはプレイヤーとの差別化のため、浅いフードと片手のコインを優先。小さな目元の傷は32pxではほぼ読めないが、256px原寸では残る。
