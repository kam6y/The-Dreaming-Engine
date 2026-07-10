# symbol-wisp-flame-left

- Asset: `assets/sprites/symbol-wisp-flame-left.png`
- Kind: map sprite
- Enemy: 迷い火(まよいび)
- Direction: left(左向きの流れ)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-wisp-flame.png`
- Secondary reference: `assets/enemies/wisp-flame.png`
- Adopted source: `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-9e785baa-55b0-4088-a0cf-09a2db01fa24.png`

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 芯を失った青白い小さな炎が、忘れ野の霧の中をふらふらと漂う。時折その芯に、消えかけた燈心の影が透ける

## 同一個体性メモ

青白い炎と燈心影、琥珀の芯を固定。丸い先行部を左、火の尾を右に流し、身体や顔を追加せず方向を示した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended for a 256x256 transparent sprite displayed at about 34px.
Asset id: symbol-wisp-flame-left.
Input images: Image 1 is the PRIMARY identity, palette, simplification, top-down camera, scale, and painterly map-sprite reference (existing down-facing symbol-wisp-flame). Image 2 is a SECONDARY flame texture/material identity reference only.
Primary request: Render the exact same individual Wisp Flame as Image 1, with only its facing/movement direction changed to LEFT. Generate this left variant independently.
Lore invariant: one small pale blue-white flame that has lost its core, with the shadow of a fading lamp wick sometimes visible; forlorn and drifting; no face or body.
Direction language for an amorphous enemy: LEFT means the compact rounded leading flame mass and brightest edge point/move toward the canvas left while one broad narrow flame-stream tail and smaller wisps trail unmistakably toward the right. The entire body axis leans left. Not merely a symmetrical upright flame.
Camera: TRUE TOP-DOWN-LEANING OVERWORLD token view. Compact hovering flame footprint seen from high above.
Identity invariants: same pale blue-white rim, blue-grey inner vapor, ash-grey fading wick shadow, one tiny muted amber ember, same compact visual mass and approximate occupied size as Image 1. No face, eyes, mouth, limbs, or creature anatomy.
Map readability: bold simple left-leading bulb and right-trailing tail, readable as left at 34px. Avoid many delicate filaments.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, cool blue-grey vapor, melancholic dreamlike atmosphere, matching Image 1 exactly.
Composition/framing: one single small floating flame centered with generous padding; no crop, frame, UI, ground plane, floor, cast shadow, contact shadow, reflection, text, logo, or watermark.
Background for removal: the actual generated image must use a perfectly flat solid pure #00ff00 chroma-key background, fully uniform corner-to-corner. No gradients, texture, shadows, floor, lighting variation, glow cast onto background, or transparency. Keep crisp separated edges. Do not use #00ff00 anywhere in the subject.
Avoid: upright directionless flame, face, eyes, skull, horns, hands, wings, body, lantern, candlestick, runes, extra objects, eye-level portrait, pixel art.
```

## 後処理・検収メモ

- 正面bbox長辺155pxに合わせて透過・中央配置し、256x256 RGBAへ正規化。
- final alpha bbox: `(50, 65, 205, 190)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で先行部が左、尾が右を確認。
