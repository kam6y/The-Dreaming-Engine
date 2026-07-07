# symbol-creaking-doll

- Asset: `assets/sprites/symbol-creaking-doll.png`
- Kind: map sprite
- Enemy: 軋み人形(きしみにんぎょう)
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ac9-38bc-74d3-983c-52e3ec53f309/ig_0f12c91b46099d95016a4c7ec14f4081918883d1746f69fb74.png`

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 継ぎ接ぎだらけの人形のような姿、関節が軋む

## 戦闘グラフィックとの同一個体性

`assets/enemies/creaking-doll.png` の罅入りの丸い人形頭、継ぎ接ぎの布・木・人形素材、関節の小歯車を保持した。戦闘用の背の高い人形ではなく、頭と肩を大きくした俯瞰デフォルメへ変換した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG after chroma-key removal, displayed at 32px over dark map tiles.
Asset id: symbol-creaking-doll.
Primary request: Create a simplified map symbol for Creaking Doll (軋み人形), the same entity as the visible reference battle graphic assets/enemies/creaking-doll.png, but redesigned as a small top-down overworld marker.
Lore source: a patchwork doll-like figure with creaking joints, a remnant of broken gear fragments trying to imitate the shape of someone once spun by the engine.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait and not an eye-level battle figure. The doll is standing upright on the map but seen from a high camera looking down, like a JRPG enemy symbol. Show mostly the round cracked doll head top, shoulders, upper torso, and joint blocks; legs and feet compressed small near the bottom. 2.5 to 3 heads tall, compact deformed proportions.
Identity reference: preserve the battle graphic's patched cloth/wood/doll body, cracked pale doll head, awkward creaking joints, and small tarnished gear fragments at the joints. Keep it uncanny and sad, not a living corpse.
Map readability: bold simplified silhouette for 32px display. Large head-and-shoulder shape, simple joint circles, short limbs, a few visible patch seams and gear bits. Avoid thin fingers, tiny stitch detail, or tall realistic anatomy.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey shadows, dim amber rim accents, melancholic dreamlike atmosphere, harmonized with the visible adopted top-down sprite-player and other sprite-* assets rather than the detailed battle pose.
Palette: ash grey, charcoal, old linen beige, worn wood brown, tarnished brass gear fragments, tiny muted amber highlights; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single enemy symbol centered in a square frame with generous padding. Normal enemy symbol scale, slightly smaller presence than sprite-player; no crop, no frame, no UI, no ground plane, no cast shadow, no contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The background must be one uniform color with no shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 4 exactly. Do not add weapons, armor, blood, gore, organs, skull motifs, chains, runes, symbols, text, watermark, logo, frame, or UI. Not a front-facing tall portrait. Not pixel art.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過後、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(72, 40, 183, 215)`。四隅alphaは0、可視緑フリンジなし。

