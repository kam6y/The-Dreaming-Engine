# battle-field

- Asset: `assets/backgrounds/battle-field.png`
- Kind: battle background
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool
- Final size: 1920x1080 PNG

## 情景典拠

`docs/spec/world-lore.md` 2.2:

- 忘れ野は街とダンジョンを結ぶ荒野。
- 崩れた石垣、朽ちた道標、丈の低い枯れ草が青灰の靄の中にある。
- 遠くにダンジョンの裂け目がぼんやり光る。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: battle background for The Dreaming Engine, final target 1920x1080 PNG, wide 16:9 landscape.
Primary request: create `battle-field.png`, a field battle background set in Wasure-no (忘れ野), designed for a 512-768px enemy graphic to be overlaid in the center.
Style reference: match the existing project assets, especially the title background and enemy cutouts: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, low contrast, no text, no watermark.
Lore source: docs/spec/world-lore.md section 2.2. Wasure-no is the wilderness between town and dungeon, with collapsed stone walls, rotting signposts, low withered grass in blue-grey haze, distant dungeon fissure glow, and subtle gathering points.
Scene/backdrop: a lonely foggy field clearing in Wasure-no at dim twilight. Low dead grass, damp earth, cracked road stones, broken stone walls pushed toward the left and right edges, a ruined signpost off to one side with no readable letters, and the distant dungeon fissure glowing faintly on the horizon through mist.
Subject: the empty battlefield environment only; no characters, no enemies, no silhouettes. The center must remain a calm readable open space for an overlaid enemy sprite.
Composition/framing: wide 16:9 RPG battle background. Reserve the central area from roughly 35% to 65% of the image width and 28% to 72% of the image height as relatively uncluttered blue-grey fog and flat ground, with no tall objects, no bright focal light, and no high-contrast detail. Put environmental detail around the sides, foreground corners, and distant horizon. Keep the horizon low-to-mid so a centered enemy remains readable.
Lighting/mood: dim blue-grey mist, faint cold fissure glow in the far distance, tiny restrained amber reflections in wet stones; sorrowful and tense but not frantic.
Color palette: ash grey, slate blue, charcoal earth, muted dry grass, faint amber, distant cold glow; low saturation and controlled contrast.
Materials/textures: damp soil, brittle grass, crumbling stone, weathered wood, fog-softened distance, painterly brush texture.
Text: none.
Constraints: follow the lore exactly; do not invent a lush green meadow, desert, snowfield, forest, castle, large town, bright sunrise, characters, enemies, readable signs, Japanese or English letters, UI markers, title text, watermark, logo, gore, or exaggerated horror. Do not place any major object, bright light, or detailed silhouette in the central enemy overlay zone. Maintain the established dark fantasy painterly game-asset tone.
```

## 生成メモ

- Image Gen出力を `assets/backgrounds/battle-field.png` にコピー。
- `sips` で1920x1080に正規化。
- 敵グラフィック重ね合わせ用に、中央部を霧と地面の余白として確保する指定で生成。
