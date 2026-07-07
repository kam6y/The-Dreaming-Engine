# sprite-innkeeper

- Asset: `assets/sprites/sprite-innkeeper.png`
- Kind: map sprite
- Character: 宿屋の主人 — オルガ
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3aa1-0db3-7650-bfb2-91137552725d/ig_0650d8e3acb209ae016a4c73c6b478819a877f28ee00d638b0.png`

## 外見典拠

`docs/spec/world-lore.md` 3.2:

> 恰幅のよい初老の女性。灰の混じった三つ編み、火傷の跡が残る太い手、いつも羊毛の肩掛け

## 立ち絵からの同一人物性

`assets/portraits/npc-innkeeper.png` の恰幅のよい体格、灰混じりの長い三つ編み、太い手と古い火傷跡、厚い羊毛の肩掛け、実用的な宿屋の衣服を保持した。マップ上では丸い肩掛けと三つ編みの大きな形を優先し、火傷跡は256px原寸で読める程度に簡略化した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine", final target 256x256 transparent PNG after chroma-key removal.
Primary request: Create the map sprite for sprite-innkeeper: Olga, the innkeeper, same identity as the visible existing portrait assets/portraits/npc-innkeeper.png.
Identity reference: preserve the same person and outfit from the visible Olga portrait: stout elderly woman, warm sturdy presence, grey-streaked long braid, thick hands and forearms with old healed burn scars, always wearing a heavy wool shoulder shawl over humble innkeeper clothing, practical layered dress or apron, dark boots. Do not make her thin, young, aristocratic, or magical.
Style reference: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, no text, no watermark. Match the existing project portraits but simplify details for tiny map readability.
Composition/framing: one full-body character standing pose, front-facing, top-down-leaning 3/4 overhead view like a 2D RPG map sprite, centered in a square frame with generous padding. The head may be slightly larger than realistic, about 3.5 to 4 heads tall, with a compact readable silhouette. Feet visible. No crop. No frame. No UI. No ground plane.
Sprite readability: designed to be displayed at 32px on a map. Use a broad rounded shawl-and-dress silhouette, visible grey braid falling to one side, large shawl mass, sturdy stance, and slightly stronger value separation than the portrait. Burn scars can be simplified but the scarred thick hands should remain visible. Avoid tiny intricate ornamentation that would blur when downscaled.
Lighting/mood: cool blue-grey body tones with restrained amber rim highlights on the shawl edge and face; comforting but melancholic.
Color palette: charcoal, soot brown, faded blue-grey dress, grey wool shawl, grey-streaked hair, muted amber accents; avoid any #00ff00 in the subject.
Materials/textures: simplified painterly wool, worn cloth, practical leather boots; not pixel art.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 3.2 exactly; do not invent new jewelry, weapons, staff, lantern, apron logos, text, watermark, logo, frame, UI, extra characters, monsters, gore, or sexualization. No cast shadow.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、Pillowで256x256へリサイズして `assets/sprites/sprite-innkeeper.png` に保存。
- 最終PNGは256x256 RGBA。32px表示では丸い羊毛肩掛け、灰混じりの三つ編み、広い体格が判別できることを確認。

## 再生成メモ — M13-1差し戻し対応

- Date: 2026-07-07
- Human review feedback: 前回納品は「3/4のほぼ正面向き立ち絵」で、マップの見下ろし視点と合わなかった。
- Regeneration mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ab7-1ca1-7d50-88b7-ea09b360d479/ig_07a0327dfc0412f8016a4c792942108191be194558ac597dab.png`

### 再生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is 256x256 transparent PNG, displayed at 32px over dark 16px Kenney Roguelike-style map tiles.
Primary request: Regenerate sprite-innkeeper, Olga the innkeeper. Preserve the identity from the visible reference contact sheet and world-lore: stout elderly woman, warm sturdy presence, grey-streaked braid, thick hands with old healed burn scars, always wearing a heavy wool shoulder shawl over humble innkeeper clothing, practical layered dress/apron, dark boots.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait. The character is standing upright on the ground but seen from a high camera looking down, like a classic JRPG field character. South-facing/front map orientation, yet the camera angle shows mostly the top of the head/braid, rounded shoulders, shawl mass, and compressed torso; face is small, legs and feet are small near the bottom. 2.5 to 3 heads tall, compact chibi/deformed proportions. Do not make an eye-level 3/4 standing illustration.
Map readability: bold simplified silhouette for 32px display. Broad rounded shoulder-shawl shape, stout compact body, visible grey braid as one simple large shape, thick scarred hands simplified, tiny boots. Painterly but simple broad shapes, low detail, no intricate fabric folds, no tiny ornaments. Strong clear outline/value separation so she reads on dark tiles.
Style: dark fantasy illustration, muted desaturated colors, cool blue-grey mist, melancholic dreamlike atmosphere, painterly game asset style, no text, no watermark. Harmonize with dark 16px tile map art rather than detailed portrait art.
Palette: charcoal, soot brown, faded blue-grey dress, grey wool shawl, grey-streaked hair, very small muted amber warmth on shawl/face; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single full-body standing sprite centered in a square frame with generous padding. No crop. No frame. No UI. No ground plane. No cast shadow. No contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding.
Constraints: follow docs/spec/world-lore.md 3.2 exactly. Do not invent magic, weapons, staff, lantern, aristocratic clothes, extra jewelry, text, watermark, logo, frame, or UI. Not lying down. Not side-view. Not isometric 3/4 portrait. Not young or thin. Not realistic tall body proportions.
```

### 再生成後処理・検収メモ

- `remove_chroma_key.py` で緑背景を除去し、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(52, 21, 203, 231)`。四隅alphaは0、緑フリンジ検出0。
- 前回より肩掛けと頭部を上から見下ろす塊として強調し、足元を小さくしてマップ俯瞰に寄せた。
