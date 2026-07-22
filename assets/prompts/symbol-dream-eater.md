# symbol-dream-eater

- Asset: `assets/sprites/symbol-dream-eater.png`
- Kind: map sprite
- Enemy: 夢喰い(ゆめくい) 第1形態
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ac9-38bc-74d3-983c-52e3ec53f309/ig_0f12c91b46099d95016a4c7f03f6308191b2f4859285d3d1e9.png`

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 1形態: 歯車と靄が絡み合った巨躯

`docs/spec/world-lore.md` 1.2:

夢喰いは機関を構成する歯車のひとつが燃料の枯渇に耐えかねて壊れた成れの果て。悪意ではなく苦痛と飢えの反射として描く。

## 戦闘グラフィックとの同一個体性

`assets/enemies/dream-eater.png` の中央の割れた巨大歯車、非対称の歯車塊、青灰の靄、鈍い琥珀の内部光を保持した。マップ上のボスマーカーとして通常敵より大きく、上から見た歯車と靄の塊へ単純化した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld boss marker sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG after chroma-key removal, displayed at 32px over dark map tiles.
Asset id: symbol-dream-eater.
Primary request: Create a simplified map boss marker for Dream Eater (夢喰い), the same entity as the visible reference battle graphic assets/enemies/dream-eater.png phase 1, but redesigned as a top-down overworld symbol with a larger presence than normal enemy symbols.
Lore source: phase 1 is a huge body where gears and blue-grey mist are intertwined; the remains of one gear of the Dreaming Engine, broken by starvation, not evil by intent.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait and not an eye-level battle boss. The boss marker is a hulking gear-and-mist mass on the map seen from a high camera looking down. Show the top surfaces of a central cracked giant gear core, surrounding smaller interlocked gears, and blue-grey mist wrapping around the mass like a low storm. It should read as a compact overhead marker, not a side-facing monster.
Identity reference: preserve the visible battle graphic's central cracked gear, hunched asymmetrical gear mass, tarnished brass/charcoal metal, blue-grey mist, and small muted amber internal engine light. Phase 1 only: no many mouth-like rifts.
Map readability: bold simplified silhouette for 32px display. Large round/irregular gear-mist mass, one clear central cracked gear, a few large gear teeth, broad mist outline, small amber core glints. Avoid dense tiny machinery.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey mist, dim candlelight accents, melancholic dreamlike atmosphere, harmonized with the visible adopted top-down sprite-player and other sprite-* assets rather than the detailed battle pose.
Palette: charcoal metal, tarnished brass, ash grey, blue-grey mist, tiny muted amber internal light; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single boss marker centered in a square frame with generous padding. Larger presence than normal enemy symbols and slightly larger than the player sprite when displayed; no crop, no frame, no UI, no ground plane, no cast shadow, no contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 4 and 1.2 exactly. Do not add a humanoid face, eyes, horns, wings, weapons, armor, blood, gore, exposed organs, mouth-like phase-2 rifts, text, watermark, logo, frame, or UI. Not an eye-level 3/4 battle illustration. Not pixel art.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過後、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(26, 19, 230, 238)`。通常敵より大きいボスマーカーとして調整。四隅alphaは0、可視緑フリンジなし。

