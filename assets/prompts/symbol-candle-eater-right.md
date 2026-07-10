# symbol-candle-eater-right

- Asset: `assets/sprites/symbol-candle-eater-right.png`
- Kind: map sprite
- Enemy: 蝋燭喰らい(ろうそくくらい)
- Direction: right(右向き)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-candle-eater.png`
- Secondary reference: `assets/enemies/candle-eater.png`
- Adopted source: `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-432fab27-5db8-4c86-bddf-61f4fb0db3f9.png`

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 溶けた蝋のような体に、小さな火を宿す

## 同一個体性メモ

顔のない灰白い蝋だまりと琥珀の火を固定。leftの鏡像を使わず、厚い先行部と火を右、拖尾を左へ置く画像を個別生成した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended for a 256x256 transparent sprite displayed at about 34px.
Asset id: symbol-candle-eater-right.
Input images: Image 1 is the PRIMARY and STRICT identity, silhouette, palette, top-down camera, scale, and simplification reference. Image 2 is SECONDARY wax/flame material reference only; ignore its upright body, face, and arms.
Primary request: Render the exact same individual Candle Eater as Image 1 moving/facing RIGHT. Generate a fresh right-facing view independently; do not mirror or flip a left-facing output.
NON-NEGOTIABLE CAMERA AND SHAPE: TRUE ORTHOGRAPHIC TOP-DOWN-LEANING OVERWORLD VIEW. A very low, flattened, squat melted-wax puddle; no vertical torso, mound, tower, cone, raised curtain, side wall, or upright candle form.
Direction for this amorphous creature: the thick rounded leading wax rim and shallow flame depression are offset toward the canvas right; the wide puddle elongates right-to-left and several broad low wax lobes form a short dragged trail tapering toward the left. It must read as right at 34px.
Lore invariant: a small nightmare whose body is melted wax and carries one small flame.
Identity invariants: same desaturated ivory/grey-beige wax, blue-grey shadows, one small muted amber flame, broad rounded surface drips, same compact visual mass and approximate occupied size as Image 1.
Hard constraint: ABSOLUTELY NO FACE, eyes, sockets, mouth, nose, skull holes, paired dark spots, head, arms, hands, or humanoid anatomy.
Map readability: bold right-leading/left-trailing wide puddle silhouette; one amber flame dot; broad shapes only.
Style: dark fantasy painterly game asset, muted desaturated colors, matching Image 1 exactly.
Composition: one centered creature, generous padding; no ground, floor, cast/contact shadow, reflection, text, watermark, logo, frame, UI.
Background: perfectly flat solid pure #00ff00 chroma-key, uniform corner-to-corner, no gradient, texture, glow spill, shadow, or transparency. Do not use #00ff00 in the subject.
Avoid: mirrored left output, directionless circle, tall wax tower, face-like holes, lantern, candlestick, clothing, skulls, runes, extra objects, eye-level view, pixel art.
```

## 後処理・検収メモ

- 正面bbox長辺160pxに合わせて透過・中央配置し、256x256 RGBAへ正規化。leftとは別生成。
- final alpha bbox: `(48, 85, 208, 171)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で火が右、蝋の拖尾が左を確認。
