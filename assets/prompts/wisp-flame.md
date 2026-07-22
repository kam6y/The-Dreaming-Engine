# wisp-flame

- Asset: `assets/enemies/wisp-flame.png`
- Kind: enemy battle graphic
- Enemy: 迷い火(まよいび)
- Record created: 2026-07-06
- Generation mode: Image Gen built-in tool + chroma-key removal

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 芯を失った青白い小さな炎が、忘れ野の霧の中をふらふらと漂う。時折その芯に、消えかけた燈心の影が透ける

> 獰猛ではなく、ただ近づいた者に縋りつくように燃える

## 特徴記述

忘れ野で消えた灯の名残。芯を失った青白い小さな炎として描き、中心には消えかけた燈心の影だけを透かす。顔・目・手足・燭台・ランタンなどは加えず、獰猛さよりも寄る辺なく縋りつくような弱い温もりを優先する。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: enemy battle cutout for The Dreaming Engine, target square 512x512 PNG
Style reference: match the already visible project enemy assets: dark fantasy painterly illustration, muted desaturated colors, dim candlelight accents, blue-grey mist, subtle amber rim light, low contrast, melancholic dreamlike mood, transparent-character-cutout composition.
Primary request: create the enemy "Wisp Flame" (迷い火 / mayoibi).
Lore source: its appearance is "a small pale blue-white flame that has lost its core, drifting unsteadily in the mist; at times the shadow of a fading lamp wick is visible in its core." It is a remnant of a vanished light in 忘れ野, forlorn and clinging rather than savage.
Subject: a single small pale blue-white flame, fragile and wavering, no face, no eyes, no limbs, no body, no lantern, no candlestick. The flame has a translucent hollow center where the faint dark silhouette of a nearly extinguished wick can be seen. It should feel needy and forlorn rather than predatory.
Composition/framing: centered full-body cutout, compact flame silhouette, entire flame visible with generous green padding on every side; no ground plane; suitable to overlay on battle backgrounds.
Lighting/mood: dim cool blue-white glow with extremely restrained amber warmth near the fading wick shadow; melancholic, lonely, and dreamlike.
Color palette: pale blue-white fire, blue-grey vapor, ash grey wick shadow, tiny muted amber ember at the core only; avoid green in the subject.
Materials/textures: painterly translucent flame, soft smoke-like edges, wavering vapor, readable silhouette despite delicate edges.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The actual image background must be pure bright green (#00ff00), one uniform flat color, not black, not grey, and not transparent. No shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow the lore appearance exactly; do not add a face, eyes, skull, horns, hands, wings, weapon, lantern, candlestick, runes, symbols, blood, gore, text, watermark, logo, frame, or UI. No excessive grotesque detail.
```

## 生成メモ

- 試行1は造形は良かったが、プレビュー上で背景が黒または透過に見えたため、クロマキー指定を強めて再生成した。
- 採用版は芯の消えかけた燈心が読め、青白い炎と弱い琥珀の芯が出た。
- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、512x512へリサイズして `assets/enemies/wisp-flame.png` に保存。
- 最終PNGは512x512 RGBA。透明コーナー、キー色残留なしを確認。
