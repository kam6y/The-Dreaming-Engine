# symbol-wisp-flame-right

- Asset: `assets/sprites/symbol-wisp-flame-right.png`
- Kind: map sprite
- Enemy: 迷い火(まよいび)
- Direction: right(右向きの流れ)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-wisp-flame.png`
- Secondary reference: `assets/enemies/wisp-flame.png`
- Adopted source: `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-db7507b4-9426-4052-9ff3-6b94f9268d30.png`

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 芯を失った青白い小さな炎が、忘れ野の霧の中をふらふらと漂う。時折その芯に、消えかけた燈心の影が透ける

## 同一個体性メモ

青白い炎と燈心影、琥珀の芯を固定。leftの鏡像は使用せず、丸い先行部を右、火の尾を左に流す画像を個別生成した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended for a 256x256 transparent sprite displayed at about 34px.
Asset id: symbol-wisp-flame-right.
Input images: Image 1 is the PRIMARY identity, palette, simplification, top-down camera, scale, and painterly map-sprite reference (existing down-facing symbol-wisp-flame). Image 2 is a SECONDARY flame texture/material identity reference only.
Primary request: Render the exact same individual Wisp Flame as Image 1, with only its facing/movement direction changed to RIGHT. Generate a fresh right-facing image independently; do not mirror or flip a left-facing output.
Lore invariant: one small pale blue-white flame that has lost its core, with the shadow of a fading lamp wick sometimes visible; forlorn and drifting; no face or body.
Direction language for an amorphous enemy: RIGHT means the compact rounded leading flame mass and brightest edge point/move toward the canvas right while one broad narrow flame-stream tail and smaller wisps trail unmistakably toward the left. The entire body axis leans right. Not merely a symmetrical upright flame.
Camera: TRUE TOP-DOWN-LEANING OVERWORLD token view. Compact hovering flame footprint seen from high above.
Identity invariants: same pale blue-white rim, blue-grey inner vapor, ash-grey fading wick shadow, one tiny muted amber ember, same compact visual mass and approximate occupied size as Image 1. No face, eyes, mouth, limbs, or creature anatomy.
Map readability: bold simple right-leading bulb and left-trailing tail, readable as right at 34px. Avoid many delicate filaments.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, cool blue-grey vapor, melancholic dreamlike atmosphere, matching Image 1 exactly.
Composition/framing: one single small floating flame centered with generous padding; no crop, frame, UI, ground plane, floor, cast shadow, contact shadow, reflection, text, logo, or watermark.
Background for removal: the actual generated image must use a perfectly flat solid pure #00ff00 chroma-key background, fully uniform corner-to-corner. No gradients, texture, shadows, floor, lighting variation, glow cast onto background, or transparency. Keep crisp separated edges. Do not use #00ff00 anywhere in the subject.
Avoid: mirrored left output, upright directionless flame, face, eyes, skull, horns, hands, wings, body, lantern, candlestick, runes, extra objects, eye-level portrait, pixel art.
```

## 後処理・検収メモ

- 正面bbox長辺155pxに合わせて透過・中央配置し、256x256 RGBAへ正規化。leftとは別生成。
- final alpha bbox: `(50, 84, 205, 171)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で先行部が右、尾が左を確認。
