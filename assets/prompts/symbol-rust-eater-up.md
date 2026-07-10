# symbol-rust-eater-up

- Asset: `assets/sprites/symbol-rust-eater-up.png`
- Kind: map sprite
- Enemy: 錆喰い(さびくい)
- Direction: up(奥向き)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + chroma-key removal
- Primary reference: `assets/sprites/symbol-rust-eater.png`
- Secondary reference: `assets/enemies/rust-eater.png`
- Rejected source (trial 1): `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-5d1fe31f-4011-4fa0-91a0-dbf51b775e46.png`
- Adopted source (trial 2): `/Users/goodapple/.codex/generated_images/019f49df-0b0c-7d73-b326-88c7f5c32e5c/exec-f045b143-4d4f-4fea-b680-06d5ac342370.png`

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 錆びた歯車が幾重にも絡み合った、蛭(ひる)のように平たく長い体。継ぎ目という継ぎ目から黒い靄が漏れ、体を引きずるたびに耳障りな軋みを立てる

## 同一個体性メモ

既存正面の暗い錆色の肋状プレート、黒い靄、細長い蛭状輪郭を固定。広い先端を上、細い尾を下へ向け、顔や脚を追加していない。

## 試行1 生成プロンプト全文(不採用)

```text
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for the Japanese dark fantasy 2D RPG "The Dreaming Engine", intended for a 256x256 transparent sprite displayed at about 34px.
Asset id: symbol-rust-eater-up.
Input images: Image 1 is the PRIMARY identity, palette, simplification, true top-down camera, scale, gear density, and painterly map-sprite reference. Image 2 is SECONDARY material/anatomy reference only.
Primary request: Render the exact same individual Rust Eater as Image 1 traveling/facing UP, as a rear/top view.
Lore invariant: a flat long leech-like body built from several interlocked rusted gears; black mist leaks from seams.
Direction and camera: UP means the broad leading mechanical end points toward the canvas top and the narrower segmented tail tapers toward the bottom. TRUE HIGH TOP-DOWN OVERWORLD VIEW. Show the flat dorsal gear plates and seams from above; no face or underside. The long body axis is vertical and must read upward at 34px.
Identity invariants: same layered dark rust-brown gear plates, tarnished brass teeth, charcoal seams, black/blue-grey mist leakage, tiny muted amber glints, same low flattened leech body, same visual mass and approximate occupied size as Image 1. Use only a few broad gear segments, not many tiny gears.
Map readability: bold blunt-top/tapered-bottom mechanical leech silhouette with clear segment rhythm.
Style: dark fantasy painterly game asset, muted desaturated colors, melancholic dreamlike atmosphere, matching Image 1 exactly.
Composition: one single creature centered with generous padding; no crop, ground, floor, cast/contact shadow, reflection, text, watermark, logo, frame, or UI.
Background: perfectly flat solid pure #00ff00 chroma-key, uniform corner-to-corner; no gradient, texture, shadow, glow spill, lighting variation, or transparency. Do not use #00ff00 in the subject.
Avoid: face, eyes, mouth, teeth, legs, claws, horns, wings, weapon, armor worn by a humanoid, runes, blood, extra objects, side-view battle scene, pixel art.
```

不採用理由: 小歯車が過密で、34px表示時の単純化・明瞭な肋状シルエットを満たさなかった。

## 試行2 生成プロンプト全文(採用)

```text
RETRY 2 after rejecting excessive tiny gears and visual noise.
Use case: stylized-concept
Asset type: top-down overworld enemy symbol direction variant for a dark fantasy 2D RPG map, displayed at about 34px.
Asset id: symbol-rust-eater-up.
Input images: Image 1 is the PRIMARY and STRICT reference for simplified dark ribbed plates, narrow size, top-down camera, palette, and silhouette. Image 2 is only a SECONDARY material reference.
Primary request: Render the exact same Rust Eater as Image 1 traveling UP.
Camera/direction: TRUE HIGH TOP-DOWN VIEW. One flat long mechanical leech, broad blunt leading end at the canvas top, steadily tapering to a narrow tail at the bottom. Only the dorsal plates are seen; no face or underside.
CRITICAL SIMPLIFICATION: match Image 1's dark overlapping rib/carapace bands. Use only 5 or 6 large broad interlocked rusted plate/ring segments TOTAL. No rows of little gear faces, no watchwork, no dense cogs, no bolts, no filigree, no tiny teeth. At 34px it must read as five dark rusty ribs within one bold leech silhouette.
Lore: flat long leech-like body built from tangled rusted gears; black mist leaks from seams.
Identity: same dark rust-brown and charcoal mass, tarnished brass edges, blue-black mist between seams, tiny muted amber edge glints, same narrow compact occupied size as Image 1.
Style: muted desaturated painterly dark fantasy map sprite, low detail, melancholic.
Composition: one centered creature, generous padding; no ground, shadow, reflection, text, watermark, logo, frame, UI.
Background: perfectly flat solid pure #00ff00 chroma-key, uniform corner-to-corner; no gradient, texture, lighting variation, shadow, glow spill, or transparency. Do not use #00ff00 in subject.
Avoid: excessive gears, many small circles, clockwork diagram, face, eyes, mouth, teeth, legs, claws, horns, weapon, runes, blood, extra objects, side-view battle scene, pixel art.
```

## 後処理・検収メモ

- 採用版を正面bbox長辺180pxに合わせて透過・中央配置し、256x256 RGBAへ正規化。
- final alpha bbox: `(96, 38, 159, 218)`。四隅alpha: `[0, 0, 0, 0]`。
- 緑優勢の可視画素0。34px縮小で幅広い上端、下へ細る5-6枚の肋状プレートを確認。
