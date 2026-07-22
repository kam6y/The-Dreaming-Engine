# symbol-rust-eater-left

- Asset: `assets/sprites/symbol-rust-eater-left.png`
- Kind: map sprite
- Enemy: 錆喰い(さびくい)
- Direction: left(左向き)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-rust-eater.png`
- Secondary reference: `assets/enemies/rust-eater.png`
- Adopted source: `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-3ddfa537-e5d8-40b1-8859-719cf90222f0.png`

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 錆びた歯車が幾重にも絡み合った、蛭(ひる)のように平たく長い体。継ぎ目という継ぎ目から黒い靄が漏れ、体を引きずるたびに耳障りな軋みを立てる

## 同一個体性メモ

暗い錆色の肋状プレート、黒い靄、低い蛭状体を固定。幅広い先端を左、細い尾を右へ向けた。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for a dark fantasy 2D RPG map, displayed at about 34px.
Asset id: symbol-rust-eater-left.
Input images: Image 1 is the PRIMARY and STRICT identity, simplified dark ribbed plate design, narrow scale, top-down camera, and palette reference. Image 2 is only a SECONDARY material reference.
Primary request: Render the exact same Rust Eater as Image 1 traveling/facing LEFT. Generate independently.
Camera/direction: TRUE HIGH TOP-DOWN VIEW. One flat long mechanical leech lies horizontally. Its broad blunt leading end points clearly toward the canvas left, and its narrower segmented tail tapers toward the right. Show only dorsal plates and seams, no face or underside.
CRITICAL SIMPLIFICATION: match Image 1's dark overlapping rib/carapace bands. Use only 5 or 6 large broad interlocked rusted plate/ring segments total. No rows of tiny gear faces, watchwork, dense cogs, bolts, filigree, or tiny teeth.
Lore: flat long leech-like body built from tangled rusted gears; black mist leaks from seams.
Identity: same dark rust-brown and charcoal mass, tarnished brass edges, blue-black mist between seams, tiny muted amber glints, same low compact visual mass and approximate occupied size as Image 1.
Map readability: bold blunt-left/tapered-right silhouette, five broad segments, direction clear at 34px.
Style: muted desaturated painterly dark fantasy map sprite, melancholic.
Composition: one centered creature, generous padding; no ground, shadow, reflection, text, watermark, logo, frame, UI.
Background: perfectly flat solid pure #00ff00 chroma-key, uniform corner-to-corner; no gradient, texture, lighting variation, shadow, glow spill, or transparency. Do not use #00ff00 in subject.
Avoid: excessive small gears, face, eyes, mouth, teeth, legs, claws, horns, weapon, runes, blood, extra objects, eye-level side-view battle scene, pixel art.
```

## 後処理・検収メモ

- 正面bbox長辺180pxに合わせて透過・中央配置し、256x256 RGBAへ正規化。
- final alpha bbox: `(38, 92, 218, 164)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で幅広い左端、右へ細る尾を確認。
