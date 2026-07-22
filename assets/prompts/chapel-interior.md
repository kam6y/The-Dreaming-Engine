# chapel-interior

- Asset: `assets/backgrounds/chapel-interior.png`
- Kind: conversation background
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool
- Final size: 1920x1080 PNG

## 情景典拠

`docs/spec/world-lore.md` 2.1 / 3.5:

- 教会「灯守堂」は機関に祈りを捧げる小さな聖堂。
- 祭壇には歯車と灯芯を象った紋様があり、司祭フィオルが常駐する。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: conversation scene background for The Dreaming Engine, final target 1920x1080 PNG, wide 16:9 landscape.
Primary request: create `chapel-interior.png`, the interior of the chapel/church Himorido (灯守堂), used for conversations with the priest and main quest scenes.
Style reference: match the existing project assets in `assets/`: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, low contrast, no text, no watermark.
Lore source: docs/spec/world-lore.md section 2.1 and 3.5. Himorido is a small chapel where prayers are offered to the Dreaming Engine. The altar bears a motif shaped like a gear and a lampwick. A priest is stationed there, but no person should appear in this background. The priest knows only part of the truth and the place should feel like quiet witness, not conspiracy.
Scene/backdrop: a modest stone chapel interior in Tomoshimachi at blue-grey night. Narrow pews, damp stone aisle, dark timber rafters, many small candles, and a simple altar with a tarnished brass gear-and-lampwick emblem worked into the altar front or wall relief. A few old pipes and subtle gearwork are embedded in the side walls as sacred machinery. Frosted or misted windows admit cold blue-grey light; amber candlelight pools low around the altar. The room is small, worn, and reverent.
Subject: the chapel interior itself; no priest, no congregation, no traveler, no readable scripture, no text. The Dreaming Engine should be suggested through sacred mechanical forms rather than shown as a huge machine.
Composition/framing: wide cinematic 16:9 conversation background. Keep the lower 30% and central foreground calm and darker for a dialogue window. Leave broad vertical areas left and right for overlaid 1024px-tall character portraits. Place the altar and gear-lampwick motif in the mid-background, softly lit but not overly bright; keep pews and candles as side framing. Avoid a high-contrast central object in the foreground.
Lighting/mood: cool blue-grey chapel gloom with restrained amber candlelight; solemn, tired, compassionate, quietly sacred, melancholic but gentle.
Color palette: charcoal stone, slate blue mist, dark aged wood, muted amber candles, tarnished brass, ash grey cloth; low saturation and controlled contrast.
Materials/textures: damp worn stone, old pew wood, candle wax, soot, tarnished brass gear relief, linen altar cloth without symbols or writing, frosted glass, painterly brush texture.
Text: none.
Constraints: follow the lore exactly; do not invent a huge ornate cathedral, royal throne room, modern church, bright stained glass spectacle, standard real-world religious cross as the main symbol, readable scripture, letters, numbers, title text, watermark, logo, UI frame, characters, enemies, gore, exaggerated horror, or high-contrast foreground clutter. Maintain the established dark fantasy painterly game-asset tone and leave overlay-friendly negative space.
```

## 生成メモ

- Image Gen出力を `assets/backgrounds/chapel-interior.png` にコピー。
- `sips` で1920x1080に正規化。
- 歯車と灯芯の祭壇意匠を画面奥に置き、会話背景として手前の明暗を控えめにした。
