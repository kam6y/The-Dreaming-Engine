# symbol-failing-spinner

- Asset: `assets/sprites/symbol-failing-spinner.png`
- Kind: map sprite
- Enemy: 紡ぎ損ない(つむぎそこない) 第1形態
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ac9-38bc-74d3-983c-52e3ec53f309/ig_0f12c91b46099d95016a4c7f56829c8191a5710a3acec5acc0.png`

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 1形態: 崩れかけた織機のような巨躯。四方へ垂れた無数の解れた糸(消えかけた灯の名残)の中心で、翳(かす)んだ紡錘がゆっくりと空回りしている。

## 戦闘グラフィックとの同一個体性

`assets/enemies/failing-spinner.png` の壊れた織機フレーム、中央の紡錘、四方へ垂れる解れ糸、青灰の靄と微かな琥珀光を保持した。マップ上では中ボスマーカーとして通常敵より大きく、真上から見た矩形の織機へ単純化した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld mid-boss marker sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG after chroma-key removal, displayed at 32px over dark map tiles.
Asset id: symbol-failing-spinner.
Primary request: Create a simplified map mid-boss marker for Failing Spinner (紡ぎ損ない), the same entity as the visible reference battle graphic assets/enemies/failing-spinner.png phase 1, but redesigned as a top-down overworld symbol with stronger presence than normal enemies.
Lore source: phase 1 is a huge body like a collapsing loom; countless frayed threads hang in every direction around a dim spindle idly turning. It is a broken dream-spinning mechanism, exhausted rather than angry.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait and not an eye-level battle graphic. The ruined loom-machine is on the map seen from a high camera looking down. Show the top surfaces of a collapsed rectangular loom frame, crossed beams, a central dim spindle, and frayed threads spilling outward across the top-down silhouette. It should read as a low overhead marker, not an upright wall of threads.
Identity reference: preserve the visible battle graphic's broken loom frame, central spindle, non-humanoid square/rectangular machine body, dark worn wood-or-metal, blue-grey mist, and tiny muted amber light caught in a few thread fibers.
Map readability: bold simplified silhouette for 32px display. One clear broken loom rectangle, central spindle oval, several broad frayed thread clusters. Avoid dense hairlike threads that become noise.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey mist, dim candlelight accents, melancholic dreamlike atmosphere, harmonized with the visible adopted top-down sprite-player and other sprite-* assets rather than the detailed battle pose.
Palette: charcoal worn wood-or-metal loom frame, ash grey, tarnished brass spindle, blue-grey mist, extremely subtle muted amber thread embers; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single mid-boss marker centered in a square frame with generous padding. Bigger than normal enemy symbols but smaller than symbol-dream-eater; no crop, no frame, no UI, no ground plane, no cast shadow, no contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The actual image background must be pure bright green (#00ff00), one uniform flat color, not black and not transparent. No shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 4.1 exactly. Do not add a humanoid face, eyes, horns, wings, arms, legs, claws, weapon, armor, runes, symbols, blood, gore, lanterns, lamps, candles, text, watermark, logo, frame, or UI. Not an eye-level 3/4 battle illustration. Not pixel art.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過後、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(25, 42, 230, 213)`。通常敵より大きく、夢喰いより少し小さい中ボスマーカーとして調整。四隅alphaは0、可視緑フリンジなし。

