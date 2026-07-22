# symbol-whisper-mask

- Asset: `assets/sprites/symbol-whisper-mask.png`
- Kind: map sprite
- Enemy: 囁き仮面(ささやきかめん)
- Record created: 2026-07-07
- Generation mode: Image Gen built-in tool + chroma-key removal
- Source generation: `/Users/goodapple/.codex/generated_images/019f3ac9-38bc-74d3-983c-52e3ec53f309/ig_0f12c91b46099d95016a4c7e73e1b0819181c21dd938c3bc22.png`

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 罅(ひび)の入った白い面(おもて)が宙に浮かぶ。裏は空洞で、口許から薄い靄がこぼれ、聞き取れない声で囁き続ける

## 戦闘グラフィックとの同一個体性

`assets/enemies/whisper-mask.png` の罅入りの白い面、黒い空洞の裏側、口許からこぼれる青灰の靄を保持した。正面肖像にならないよう、低く浮いた面を上から斜めに見るマップ記号へ寄せた。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use is a 256x256 transparent PNG after chroma-key removal, displayed at 32px over dark map tiles.
Asset id: symbol-whisper-mask.
Primary request: Create a simplified map symbol for Whisper Mask (囁き仮面), the same entity as the visible reference battle graphic assets/enemies/whisper-mask.png, but redesigned as a small top-down overworld marker.
Lore source: a cracked white mask floating in the air; the back is hollow, thin mist spills from the mouth, and it whispers inaudibly. It is an echo of a forgotten face, not a curse.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW, not a portrait. The mask floats low over the map but is seen from a high camera looking down. Show the mask as a small oval faceplate tilted upward on the ground plane: mostly the top/front surface and cracked rim are visible, with a narrow dark hollow underside along one edge. Do not use an eye-level vertical face portrait.
Map readability: bold simplified silhouette for 32px display. One clear pale cracked mask shape, dark hollow back edge, small blue-grey mist curl from the mouth area. Use broad cracks, not many tiny lines.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey mist, dim candlelight, melancholic dreamlike atmosphere, harmonized with the visible adopted top-down sprite-player and other sprite-* assets rather than the detailed battle pose.
Palette: bone white and ash white mask, charcoal crack lines and hollow back, blue-grey mist, tiny muted amber edge accent only; avoid saturated colors and avoid any #00ff00 in the subject.
Composition/framing: one single enemy symbol centered in a square frame with generous padding. Normal enemy symbol scale, slightly smaller presence than sprite-player; no crop, no frame, no UI, no ground plane, no cast shadow, no contact shadow.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The actual image background must be pure bright green (#00ff00), one uniform flat color, not black and not transparent. No shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow docs/spec/world-lore.md 4.1 exactly. Do not add a body, face behind the mask, living eyes, hair, horns, crown, weapon, armor, runes, symbols, blood, gore, text, watermark, logo, frame, or UI. Not an eye-level portrait. Not pixel art.
```

## 生成メモ

- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過後、非透明部分を中央配置して256x256 RGBAに正規化。
- final alpha bbox: `(57, 50, 199, 205)`。四隅alphaは0、可視緑フリンジなし。

