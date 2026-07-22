# symbol-rust-eater

- Asset: `assets/sprites/symbol-rust-eater.png`
- Kind: map sprite
- Enemy: 錆喰い(さびくい)
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ac9-38bc-74d3-983c-52e3ec53f309/ig_0f12c91b46099d95016a4c7e956f808191b30788a913a78690.png`

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 錆びた歯車が幾重にも絡み合った、蛭(ひる)のように平たく長い体。継ぎ目という継ぎ目から黒い靄が漏れ、体を引きずるたびに耳障りな軋みを立てる

## 戦闘グラフィックとの同一個体性

`assets/enemies/rust-eater.png` の錆歯車の層、蛭状の細長い体、黒い靄の漏れを保持した。マップ上では歯車密度を落とし、真上から見た平たい錆の虫のような輪郭を優先した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG after chroma-key removal, displayed at 32px over dark map tiles.
Asset id: symbol-rust-eater.
Primary request: Create a simplified map symbol for Rust Eater (錆喰い), the same entity as the visible reference battle graphic assets/enemies/rust-eater.png, but redesigned as a small top-down overworld marker.
Lore source: a flat, long, leech-like body made from many layers of rusted gears tangled together; black mist leaks from every seam. It is a nightmare of necrotic engine fragments adding rust and creaking to itself.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a side-view battle monster. The creature lies flat on the ground and is seen from a high camera looking down. Show an elongated flattened mechanical leech silhouette from above: tapered head end, segmented rusted gear plates along the spine, small tail end, black mist seeping from seams. No tall vertical body.
Map readability: bold simplified silhouette for 32px display. Low horizontal slug/leech shape, broad rusted gear segments, a few large tooth-ring shapes only. Avoid many tiny gears that become visual noise.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey haze, dim amber glints, melancholic dreamlike atmosphere, harmonized with the visible adopted top-down sprite-player and other sprite-* assets rather than the detailed battle pose.
Palette: rust brown, tarnished brass, charcoal black, ash grey, blue-grey haze, very small muted amber glints; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single enemy symbol centered in a square frame with generous padding. Normal enemy symbol scale, slightly smaller presence than sprite-player; no crop, no frame, no UI, no ground plane, no cast shadow, no contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The actual image background must be pure bright green (#00ff00), one uniform flat color, not black and not transparent. No shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 4.1 exactly. Do not add a face, eyes, mouth, teeth, legs, claws, horns, wings, weapon, armor, runes, symbols, blood, gore, text, watermark, logo, frame, or UI. Not an eye-level 3/4 battle illustration. Not pixel art.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過後、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(95, 38, 161, 218)`。四隅alphaは0、可視緑フリンジなし。

