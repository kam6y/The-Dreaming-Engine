# battle-dungeon

- Asset: `assets/backgrounds/battle-dungeon.png`
- Kind: battle background
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool
- Final size: 1920x1080 PNG

## 情景典拠

`docs/spec/world-lore.md` 2.3:

- 夢喰いの裂け目は、機関の壊死がもっとも進んだ場所。
- 霧に沈んだ回廊、消えかけた燭台、歪み始める建材や通路がある。
- 深部では青灰と漆黒が支配的になる。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: battle background for The Dreaming Engine, final target 1920x1080 PNG, wide 16:9 landscape.
Primary request: create `battle-dungeon.png`, a dungeon battle background inside the Dream Eater fissure / underground Dreaming Engine, designed for a 512-768px enemy graphic to be overlaid in the center.
Style reference: match the existing project assets, especially the title background and enemy cutouts: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, low contrast, no text, no watermark.
Lore source: docs/spec/world-lore.md section 2.3. The dungeon contains fog-sunken corridors, dying candlesticks, distant bells, warped architecture, repeated doors, ceiling stonework where it should not be, and deeper blue-grey and black tones as the dream breaks down. It is the necrotic inner place of the Dreaming Engine, but the visual tone should avoid gore.
Scene/backdrop: a dim underground battle chamber or widened corridor within the broken dream-machine. Cracked damp stone floor, low blue-grey mist, tarnished gear mechanisms embedded in side walls, fading candelabra at the edges with small amber flames, soot-dark archways, and subtle impossible architecture: a duplicate door receding on one side and a strip of cobblestone bending upward toward the ceiling.
Subject: the empty dungeon battlefield environment only; no characters, no enemies, no boss silhouette. The center must remain a calm readable open space for an overlaid enemy sprite.
Composition/framing: wide 16:9 RPG battle background. Reserve the central area from roughly 35% to 65% of the image width and 24% to 74% of the image height as mostly uncluttered dark stone floor, blue-grey mist, and soft shadow, with no tall objects, no bright focal light, no gear silhouette, and no high-contrast detail. Push gears, candelabra, arches, warped doors, and candles toward the left and right edges and upper background. Keep the floor plane readable for enemy placement.
Lighting/mood: dim blue-grey fog and black recesses, restrained amber candlelight from side candelabra only; tense, mournful, uncanny, not a gore-horror scene.
Color palette: blue-grey, charcoal, soot black, tarnished brass, muted amber candlelight; very low saturation and controlled contrast.
Materials/textures: wet stone, corroded gears, worn brass, soot, wax drips, soft painterly fog, old iron and timber details.
Text: none.
Constraints: follow the lore exactly; do not invent a lava arena, bright crystal cavern, sci-fi neon lab, clean factory, treasure room, throne room, characters, enemies, boss silhouette, readable symbols or letters, title text, watermark, logo, UI, gore, blood, organs, or excessive grotesque detail. Do not place any major object, bright light, or detailed silhouette in the central enemy overlay zone. Maintain the established dark fantasy painterly game-asset tone.
```

## 生成メモ

- Image Gen出力を `assets/backgrounds/battle-dungeon.png` にコピー。
- `sips` で1920x1080に正規化。
- 敵グラフィック重ね合わせ用に、中央部を暗い石床と霧の余白として確保する指定で生成。
