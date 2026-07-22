# sprite-priest

- Asset: `assets/sprites/sprite-priest.png`
- Kind: map sprite
- Character: 謎の司祭 — フィオル
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3aa1-0db3-7650-bfb2-91137552725d/ig_0650d8e3acb209ae016a4c74b3576c819a9edd81ad28851a12.png`

## 外見典拠

`docs/spec/world-lore.md` 3.5:

> 痩せて背の高い、年齢不詳の人物。灰色がかった法衣、灯芯を象った杖、常に伏し目がち

## 立ち絵からの同一人物性

`assets/portraits/npc-priest.png` の痩せて背の高い体格、長い灰白の髪、伏し目がちな顔、灰色がかった法衣、灯芯を象った杖を保持した。マップ上では縦長の白灰の法衣と杖のシルエットを最優先し、悪役・黒幕風の装飾や強い聖光は加えていない。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine", final target 256x256 transparent PNG after chroma-key removal.
Primary request: Create the map sprite for sprite-priest: Fior, the mysterious priest, same identity as the visible existing portrait assets/portraits/npc-priest.png.
Identity reference: preserve the same person and outfit from the visible Fior portrait: thin tall age-ambiguous person, long pale grey hair, downcast eyes and slightly bowed head, greyish priestly robes, worn layered ceremonial cloth, and a staff shaped like a lamp wick held upright. Quiet, tired, solemn, not villainous.
Style reference: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, no text, no watermark. Match the existing project portraits but simplify details for tiny map readability.
Composition/framing: one full-body character standing pose, front-facing, top-down-leaning 3/4 overhead view like a 2D RPG map sprite, centered in a square frame with generous padding. The head may be slightly larger than realistic, about 3.5 to 4 heads tall, with a compact readable silhouette. Feet visible. The full lamp-wick-shaped staff must be visible inside the square frame. No crop. No frame. No UI. No ground plane.
Sprite readability: designed to be displayed at 32px on a map. Use a tall narrow robe silhouette, pale hair mass, bowed head, a clear vertical staff silhouette with a small wick-shaped top, and slightly stronger value separation than the portrait. Simplify robe detail so the staff and grey vestment read at small size.
Lighting/mood: cool blue-grey and grey body tones with restrained amber light only at the staff wick and robe edge; solemn melancholic mood, no bright holy glow.
Color palette: ash grey, cool blue-grey, soot black, worn off-white robe layers, muted brown staff, tiny subdued amber wick light; avoid any #00ff00 in the subject.
Materials/textures: simplified painterly worn ceremonial cloth, weathered wooden staff shaped like a lamp wick, faint soot and wax-like stains; not pixel art.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 3.5 exactly; do not invent skull motifs, evil cultist symbols, golden bishop costume, halo, wings, monsters, extra characters, weapons, text, watermark, logo, frame, UI, gore, blood, or sexualization. No cast shadow.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、Pillowで256x256へリサイズして `assets/sprites/sprite-priest.png` に保存。
- 最終PNGは256x256 RGBA。32px表示では白灰の長衣、伏せた頭部、灯芯型の杖が判別できることを確認。

## 再生成メモ — M13-1差し戻し対応

- Date: 2026-07-07
- Human review feedback: 前回納品は「3/4のほぼ正面向き立ち絵」で、マップの見下ろし視点と合わなかった。
- Regeneration mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Rejected source generation: `/Users/goodapple/.codex/generated_images/019f3ab7-1ca1-7d50-88b7-ea09b360d479/ig_07a0327dfc0412f8016a4c79f5fe948191ba3434f6a73d5fb5.png` (胸元に十字風の記号が出たため不採用)
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f3ab7-1ca1-7d50-88b7-ea09b360d479/ig_07a0327dfc0412f8016a4c7a449b0c8191802a2f4b72e24ed3.png`

### 再生成プロンプト全文(採用版)

```text
Use case: stylized-concept
Asset type: top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is 256x256 transparent PNG, displayed at 32px over dark 16px Kenney Roguelike-style map tiles.
Primary request: Regenerate sprite-priest, Fior the priest. Preserve the identity from the visible reference contact sheet and world-lore: thin tall age-ambiguous person, long pale grey hair, downcast eyes, slightly bowed head, plain greyish/off-white priestly robes, worn layered ceremonial cloth, staff shaped like a lamp wick held upright, quiet tired solemn mood.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait. The character is standing upright on the ground but seen from a high camera looking down, like a classic JRPG field character. South-facing/front map orientation, yet the camera angle shows mostly the top of pale hair/head, shoulders, upper robe, and compressed torso; face is small and downcast, legs and feet are small near the bottom. 2.5 to 3 heads tall, compact deformed overworld proportions while still reading as a tall narrow person. Do not make an eye-level 3/4 standing illustration.
Map readability: bold simplified silhouette for 32px display. Tall narrow robe mass but compact top-down body, pale hair shape, bowed head, clear vertical staff silhouette with a small lamp-wick-shaped top, tiny subdued amber wick light. Painterly but simple broad shapes, low detail, no robe embroidery, no pendant, no chest symbol, no tiny ornaments. Strong clear outline/value separation so Fior reads on dark tiles.
Style: dark fantasy illustration, muted desaturated colors, cool blue-grey mist, melancholic dreamlike atmosphere, painterly game asset style, no text, no watermark. Harmonize with dark 16px tile map art rather than detailed portrait art.
Palette: ash grey, cool blue-grey, soot black, worn off-white robe layers, muted brown staff, tiny subdued amber wick light; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single full-body standing sprite centered in a square frame with generous padding. The full lamp-wick staff must fit inside the square. No crop. No frame. No UI. No ground plane. No cast shadow. No contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding.
Constraints: follow docs/spec/world-lore.md 3.5 exactly. Absolutely no cross, no crucifix, no pendant, no necklace symbol, no church symbol, no skull motifs, no evil cultist symbols, no golden bishop costume, no halo, no wings, no monsters, no extra characters, no weapons other than the lamp-wick staff, no text, no watermark, no logo, no frame, no UI. Not lying down. Not side-view. Not isometric 3/4 portrait. No bright holy glow. Not realistic tall body proportions.
```

### 再生成後処理・検収メモ

- `remove_chroma_key.py` で緑背景を除去し、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(63, 21, 192, 231)`。四隅alphaは0、緑フリンジ検出0。
- 初回候補は余計な宗教記号が出たため破棄。採用版は灯芯型の杖と白灰の法衣に情報を絞った。
