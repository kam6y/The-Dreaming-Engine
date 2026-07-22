# field

- Asset: `assets/backgrounds/field.png`
- Kind: exploration background
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool
- Final size: 1920x1080 PNG

## 情景典拠

`docs/spec/world-lore.md` 2.2:

- 忘れ野は街とダンジョンを結ぶ荒野。
- かつて何かの集落があった痕跡として、崩れた石垣や朽ちた道標が残る。
- 丈の低い枯れ草が青灰の靄の中で揺れ、遠くにダンジョンの裂け目がぼんやり光る。
- 採取ポイントが点在する。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: exploration background for The Dreaming Engine, final target 1920x1080 PNG, wide 16:9 landscape.
Primary request: create `field.png`, the field outside town: Wasure-no (忘れ野), a misty plain connecting Tomoshimachi to the dungeon.
Style reference: match the existing project assets, especially the title background and enemy cutouts: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, low contrast, no text, no watermark.
Lore source: docs/spec/world-lore.md section 2.2. Wasure-no is a wilderness between the town and the dungeon. It contains traces of a settlement whose name no one remembers: collapsed stone walls and rotting signposts. Low withered grass moves in blue-grey haze, and the distant dungeon fissure glows faintly. Gathering points such as herbs and ore exist in the field.
Scene/backdrop: a broad, quiet, fog-covered plain at dim twilight. Low dead grass, damp earth, broken stone wall fragments, half-buried road stones, and a leaning rotten signpost with no readable letters. Far away, the dungeon fissure is a vague vertical wound of dim cold light on the horizon, partially swallowed by mist.
Subject: the field itself; no characters or enemies as the focus. Include small natural gathering hints, such as a few pale medicinal herbs near stones and dull mineral flecks in a cracked rock, subtle and not game-icon-like.
Composition/framing: wide cinematic 16:9 exploration background; foreground low grasses and stones, midground ruined path and broken walls, background heavy blue-grey fog and distant glowing fissure. The scene should feel navigable but lonely.
Lighting/mood: dim blue-grey mist, very restrained amber glints from far-off town lights behind the viewer or reflected in wet stones; mournful, quiet, dreamlike, not action-heavy.
Color palette: ash grey, slate blue, charcoal earth, dry brown grass kept very muted, tiny amber accents, faint cold glow near the fissure; low saturation and controlled contrast.
Materials/textures: damp soil, brittle grass, crumbling stone, weathered wood, fog-softened distance, painterly brush texture.
Text: none.
Constraints: follow the lore exactly; do not invent a lush green meadow, desert, snowy field, bright sunrise, dense forest, large castle, city skyline, crowds, readable signs, Japanese or English letters, UI markers, title text, watermark, logo, gore, or exaggerated horror. Maintain the established dark fantasy painterly game-asset tone.
```

## 生成メモ

- Image Gen出力を `assets/backgrounds/field.png` にコピー。
- `sips` で1920x1080に正規化。
- 忘れ野の典拠である崩れた石垣、朽ちた道標、低い枯れ草、遠い裂け目を優先。
