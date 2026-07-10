# symbol-candle-eater-up

- Asset: `assets/sprites/symbol-candle-eater-up.png`
- Kind: map sprite
- Enemy: 蝋燭喰らい(ろうそくくらい)
- Direction: up(奥向き)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-candle-eater.png`
- Secondary reference: `assets/enemies/candle-eater.png`
- Rejected source (trial 1): `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-4d3b5406-a2c2-4f8b-9856-dd177567699c.png`
- Adopted source (trial 2): `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-fc4bb96e-4a56-4f5d-baff-0b66ce8deb37.png`

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 溶けた蝋のような体に、小さな火を宿す

## 同一個体性メモ

既存正面の灰白い蝋だまり、小さな琥珀の火、顔のない低い形を固定。上側に厚い先行縁と火のくぼみ、下側に短い蝋の拖尾を置いた。戦闘画像の顔・腕は取り込んでいない。

## 試行1 生成プロンプト全文(不採用)

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended for a 256x256 transparent sprite displayed at about 34px.
Asset id: symbol-candle-eater-up.
Input images: Image 1 is the PRIMARY identity, palette, simplification, top-down camera, scale, and painterly map-sprite reference (existing down-facing symbol-candle-eater). Image 2 is a SECONDARY wax/flame material reference only; do not import its face or humanoid anatomy.
Primary request: Render the exact same individual Candle Eater as Image 1, with only its travel direction changed to UP.
Lore invariant: a small nightmare whose body is melted wax and carries one small flame.
Direction language for an amorphous wax creature: UP means the thick rounded leading rim and flame depression move away toward the top of the canvas; the wax puddle elongates slightly upward while broad low drips and a short dragged wax trail taper toward the bottom. The direction must read at 34px.
Camera: TRUE TOP-DOWN-LEANING OVERWORLD VIEW. A squat low melted-wax pool seen from high above, no vertical torso. For this rear/up view, show only wax layers and the flame depression; absolutely no face or front anatomy.
Identity invariants: same desaturated ivory/grey-beige wax, blue-grey shadows, one small muted amber flame, same smooth layered broad drips, same visual mass and approximate occupied size as Image 1.
Hard shape constraint: ABSOLUTELY NO FACE, eyes, eye sockets, mouth, nose, skull-like holes, paired dark spots, humanoid head, arms, or hands.
Map readability: bold asymmetrical top-leading/bottom-trailing wax silhouette; one clear amber flame dot; broad shapes only.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, blue-grey shadows, dim candlelight, melancholic dreamlike atmosphere, matching Image 1 exactly.
Composition/framing: one single wax creature centered with generous padding; no crop, frame, UI, ground plane, floor, cast shadow, contact shadow, reflection, text, logo, or watermark.
Background for removal: the actual generated image must use a perfectly flat solid pure #00ff00 chroma-key background, fully uniform corner-to-corner. No gradients, texture, shadows, floor, lighting variation, glow cast onto background, or transparency. Keep crisp separated edges. Do not use #00ff00 anywhere in the subject.
Avoid: face-like holes, lantern, candlestick, weapon, clothing, skulls, blood, gore, runes, extra objects, eye-level portrait, pixel art.
```

不採用理由: 俯瞰の蝋だまりではなく縦に高い蝋塔になり、既存正面の低いサイズ感と一致しなかった。

## 試行2 生成プロンプト全文(採用)

```text
RETRY 2 after rejecting a too-tall wax tower.
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended for a 256x256 transparent sprite displayed at about 34px.
Asset id: symbol-candle-eater-up.
Input images: Image 1 is the PRIMARY and STRICT silhouette/camera/scale reference. Reproduce its shallow wide wax-puddle construction. Image 2 is only a SECONDARY material reference; ignore its upright body, face, and arms.
Primary request: Render the exact same individual Candle Eater as Image 1 facing/moving UP, changing only the direction of its shallow puddle flow.
NON-NEGOTIABLE CAMERA AND SHAPE: TRUE ORTHOGRAPHIC TOP-DOWN-LEANING OVERWORLD VIEW. The entire creature is a VERY LOW, FLATTENED, SQUAT MELTED-WAX PUDDLE. Width must be greater than height/depth. No mound, cone, tower, vertical torso, raised curtain of wax, visible side wall, or upright candle form. It should look like Image 1's broad shallow pool viewed from high above.
Direction: the thicker leading wax rim and small flame depression sit slightly toward the canvas top; a few broad surface ripples and one very short flattened dragged wax lobe taper toward the bottom. Direction must be readable but subtle, while remaining a wide low pool.
Lore invariant: a small nightmare whose body is melted wax and carries one small flame.
Identity invariants: same desaturated ivory/grey-beige wax, blue-grey shadows, one small muted amber flame, same broad rounded drips, same wide compact occupied size as Image 1.
Hard constraint: ABSOLUTELY NO FACE, eyes, sockets, mouth, nose, skull holes, paired dark spots, head, arms, hands, or humanoid anatomy.
Map readability: bold wide puddle silhouette, one amber flame dot, broad shapes only.
Style: dark fantasy painterly game asset, muted desaturated colors, matching Image 1 exactly.
Composition: one centered creature, generous padding; no ground, floor, cast/contact shadow, reflection, text, watermark, logo, frame, UI.
Background: perfectly flat solid pure #00ff00 chroma-key, uniform corner-to-corner, no gradient, texture, glow spill, shadow, or transparency. Do not use #00ff00 in the subject.
Avoid: tall wax tower, candle pillar, vertical drips, face-like holes, lantern, candlestick, clothing, skulls, runes, extra objects, eye-level view, pixel art.
```

## 後処理・検収メモ

- 採用版を正面bbox長辺160pxに合わせて透過・中央配置し、256x256 RGBAへ正規化。
- final alpha bbox: `(48, 64, 208, 191)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で幅広い蝋だまり、上側の火、下側の短い拖尾を確認。
