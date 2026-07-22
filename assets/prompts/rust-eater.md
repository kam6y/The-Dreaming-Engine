# rust-eater

- Asset: `assets/enemies/rust-eater.png`
- Kind: enemy battle graphic
- Enemy: 錆喰い(さびくい)
- Record created: 2026-07-06
- Generation mode: Image Gen built-in tool + chroma-key removal

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 錆びた歯車が幾重にも絡み合った、蛭(ひる)のように平たく長い体。継ぎ目という継ぎ目から黒い靄が漏れ、体を引きずるたびに耳障りな軋みを立てる

> 壊死した機関の破片が、朽ちた鉄を喰らって己を継ぎ足し続ける悪夢

## 特徴記述

錆びた歯車と破断した歯車輪が幾重にも絡み、蛭のように平たく長い体を作る。継ぎ目から黒い靄が漏れるが、顔・目・口・脚・爪などの生物的な部位は加えない。深層の壊死した機関片として、錆と軋みだけが増え続ける印象を優先する。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: enemy battle cutout for The Dreaming Engine, target square 512x512 PNG
Style reference: match the visible project enemy assets: dark fantasy painterly illustration, muted desaturated colors, dim candlelight accents, blue-grey mist, subtle amber rim light, low contrast, melancholic dreamlike mood, transparent-character-cutout composition.
Primary request: create the enemy "Rust Eater" (錆喰い / sabi-kui).
Lore source: its appearance is "a flat, long, leech-like body made from many layers of rusted gears tangled together; black mist leaks from every seam." It is a nightmare of necrotic engine fragments that drags itself and adds rust and creaking to itself.
Subject: a single flat elongated leech-like creature, low and long, made only of many interlocked rusted gears and broken gear rings. The body is broad and flattened like a metal leech or mechanical slug, with overlapping corroded gears forming its segments. Black mist leaks from seams between the gears. No face, no eyes, no teeth, no legs, no claws, no weapon, no armor.
Critical framing: make the creature noticeably smaller in the canvas, occupying about 65 percent of the image width and 35 percent of the image height. Place it fully centered with a large empty pure-green margin around it. The entire silhouette, including ragged mist and tail, must be visible. Nothing may touch or be cropped by the left, right, top, or bottom edge. No ground plane, no cast shadow, no floor debris.
Composition/framing: centered full-body three-quarter view, slightly diagonal horizontal elongated silhouette, suitable to overlay on battle backgrounds.
Lighting/mood: dim blue-grey ambient haze with restrained amber glints along a few rusted gear teeth; necrotic, exhausted, and mechanical rather than bloody.
Color palette: rust brown, tarnished brass, charcoal black, ash grey, blue-grey haze, very small muted amber highlights; avoid green in the subject.
Materials/textures: corroded metal, rust flakes, cracked gear teeth, dry soot-dark seams, black mist leaking between joints; painterly texture, readable silhouette.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The actual image background must be pure bright green (#00ff00), one uniform flat color, not black and not transparent. No shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow the lore appearance exactly; do not add a face, eyes, mouth, limbs, horns, wings, weapon, armor, runes, symbols, blood, gore, text, watermark, logo, frame, or UI. No excessive grotesque detail.
```

## 生成メモ

- 試行1・2は歯車蛭としては良かったが、左下が画面端に寄り、カットアウトとして余白不足だったため不採用。
- 採用版は「キャンバス中央に小さめ」「端に触れない」を強めて再生成した。
- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、512x512へリサイズして `assets/enemies/rust-eater.png` に保存。
- 最終PNGは512x512 RGBA。透明コーナー、キー色残留ほぼなしを確認。
