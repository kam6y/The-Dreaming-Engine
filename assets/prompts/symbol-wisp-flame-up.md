# symbol-wisp-flame-up

- Asset: `assets/sprites/symbol-wisp-flame-up.png`
- Kind: map sprite
- Enemy: 迷い火(まよいび)
- Direction: up(奥へ流れる)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-wisp-flame.png`
- Secondary reference: `assets/enemies/wisp-flame.png`
- Adopted source: `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-e9bac0a1-6e50-4429-8aa5-eaf2187ec8c5.png`

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 芯を失った青白い小さな炎が、忘れ野の霧の中をふらふらと漂う。時折その芯に、消えかけた燈心の影が透ける

## 同一個体性メモ

既存正面の青白い炎、灰色の燈心影、微かな琥珀の芯を固定。上側を丸い先行部、下側を細い拖尾として、顔を発明せずup方向を表現した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended for a 256x256 transparent sprite displayed at about 34px.
Asset id: symbol-wisp-flame-up.
Input images: Image 1 is the PRIMARY identity, palette, simplification, top-down camera, scale, and painterly map-sprite reference (existing down-facing symbol-wisp-flame). Image 2 is a SECONDARY flame texture/material identity reference only. Preserve Image 1's tiny compact simplified map-symbol treatment.
Primary request: Render the exact same individual Wisp Flame as Image 1, with only its facing/movement direction changed to UP.
Lore invariant: one small pale blue-white flame that has lost its core, with the shadow of a fading lamp wick sometimes visible; forlorn and drifting, no face or body.
Direction language for an amorphous enemy: UP means the compact rounded leading flame mass moves away toward the top of the canvas while the long narrow flame-stream tail and wisps trail unmistakably toward the bottom. The whole silhouette should lean along a vertical topward path. This is not a rotation of the original.
Camera: TRUE TOP-DOWN-LEANING OVERWORLD token view. Keep a compact oval hovering flame footprint; no tall eye-level portrait.
Identity invariants: same pale blue-white rim, blue-grey inner vapor, ash-grey fading wick shadow, one tiny muted amber ember, same compact visual mass and approximate occupied size as Image 1. No face, eyes, mouth, limbs, or creature anatomy.
Map readability: a bold simple leading bulb plus one broad trailing tail, readable as moving up at 34px. Avoid many delicate filaments.
Style/medium: dark fantasy painterly game asset, muted desaturated colors, cool blue-grey vapor, melancholic dreamlike atmosphere, matching Image 1 exactly.
Composition/framing: one single small floating flame centered with generous padding; no crop, frame, UI, ground plane, floor, cast shadow, contact shadow, reflection, text, logo, or watermark.
Background for removal: the actual generated image must use a perfectly flat solid pure #00ff00 chroma-key background, fully uniform corner-to-corner. No gradients, texture, shadows, floor, lighting variation, glow cast onto background, or transparency. Keep crisp separated edges. Do not use #00ff00 anywhere in the subject.
Avoid: face, eyes, skull, horns, hands, wings, body, lantern, candlestick, runes, extra objects, eye-level portrait, pixel art.
```

## 後処理・検収メモ

- 正面bbox長辺155pxに合わせて透過・中央配置し、256x256 RGBAへ正規化。
- final alpha bbox: `(94, 50, 161, 205)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で丸い先行部が上、尾が下へ流れることを確認。
