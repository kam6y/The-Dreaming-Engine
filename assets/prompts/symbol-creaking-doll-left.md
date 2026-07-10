# symbol-creaking-doll-left

- Asset: `assets/sprites/symbol-creaking-doll-left.png`
- Kind: map sprite
- Enemy: 軋み人形(きしみにんぎょう)
- Direction: left(左向き)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-creaking-doll.png`
- Secondary reference: `assets/enemies/creaking-doll.png`
- Adopted source: `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-2d3793a6-7ea5-4619-aca5-cf8f488eb64b.png`

## 外見典拠

`docs/spec/world-lore.md` 4節:

> 継ぎ接ぎだらけの人形のような姿、関節が軋む

## 同一個体性メモ

大きな罅入り球形頭、継ぎ接ぎの布・木、真鍮の関節を固定。頭頂を大きく、脚を小さく圧縮し、頭と肩の非対称で左向きを示した。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for a 2D RPG map, displayed at about 34px.
Asset id: symbol-creaking-doll-left.
Input images: Image 1 is the PRIMARY and STRICT identity, palette, compact chibi proportions, simplification, high top-down camera, scale, and painterly map-sprite reference. Image 2 is SECONDARY material/joint reference only.
Primary request: Render the exact same Creaking Doll as Image 1 facing LEFT. Generate independently.
Camera: VERY HIGH TOP-DOWN-LEANING OVERWORLD VIEW matching Image 1. Show mostly the top crown of the huge round head, one left-facing edge of the cracked doll face, shoulders turned left, upper torso and joint blocks, with tiny compressed legs/feet below. The large head overlaps much of the torso; body is 2.5-to-3 heads tall at most. Absolutely not an eye-level side portrait or full-height character turnaround.
Direction: the doll's head and torso rotate toward the canvas left; the subtle nose/face plane points left, with the back of head toward the right. At 34px the asymmetry of head edge and shoulder turn must read left.
Identity: same cracked pale round doll head with small tarnished gear cap, old-linen beige/ash-grey patched torso, worn wood-brown limbs, dark blue-grey seams, tarnished brass circular shoulder/elbow joints, same compact visual mass and approximate occupied size as Image 1. Uncanny and sad, not a corpse.
Map readability: bold large-head silhouette with a clear leftward front edge, short joint blocks, broad seams only.
Style: muted desaturated painterly dark fantasy map sprite, blue-grey shadows, tiny amber metal glints, matching Image 1.
Composition: one centered doll, generous padding; no ground, floor, cast/contact shadow, reflection, weapon, text, watermark, logo, frame, UI.
Background: perfectly flat solid pure #00ff00 chroma-key, uniform corner-to-corner; no gradient, texture, lighting variation, shadow, glow spill, or transparency. Do not use #00ff00 in subject.
Avoid: eye-level side portrait, realistic tall anatomy, long limbs, living corpse, blood, gore, skulls, chains, armor, runes, extra objects, pixel art.
```

## 後処理・検収メモ

- 正面bbox長辺175pxに合わせて透過・中央配置し、256x256 RGBAへ正規化。
- final alpha bbox: `(88, 40, 168, 215)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で頭・肩が左向き、脚が圧縮された俯瞰を確認。
