# tavern-interior

- Asset: `assets/backgrounds/tavern-interior.png`
- Kind: conversation background
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool
- Final size: 1920x1080 PNG

## 情景典拠

`docs/spec/world-lore.md` 2.1 / 3.4:

- 酒場「霧笛亭」は情報屋が根城にする一角があり、噂と依頼が交わる場所。
- 客はまばらだが火は絶やさない。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: conversation scene background for The Dreaming Engine, final target 1920x1080 PNG, wide 16:9 landscape.
Primary request: create `tavern-interior.png`, the interior of the tavern Mutekitei (霧笛亭), used for conversations with the informant and receiving side quests.
Style reference: match the existing project assets in `assets/`: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, low contrast, no text, no watermark.
Lore source: docs/spec/world-lore.md section 2.1 and 3.4. Mutekitei is the tavern where the informant keeps a corner. Rumors and requests pass through this place. Customers are sparse, but the fire is never allowed to go out. The informant handles quests and rumors, but no person should appear in this background.
Scene/backdrop: a small, worn tavern interior in Tomoshimachi at blue-grey night. Rough stone floor, dark timber beams, low ceiling, a subdued hearth or iron stove still glowing, a few empty tables and benches, stacked cups, barrels, rain-damp cloaks on pegs, and an empty shadowed corner booth that suggests the informant's seat. On the booth table: a small coin, a closed pouch, and folded scraps of parchment with no readable marks. Blue-grey fog presses at the windows while amber firelight and candles pool softly.
Subject: the tavern interior itself; no informant, no patrons, no bartender, no readable posters, no menu text. It should feel like a place where quiet rumors are traded, not a lively feast hall.
Composition/framing: wide cinematic 16:9 conversation background. Keep the lower 30% and central foreground calm, dark, and lower-detail for a dialogue window. Leave broad portrait overlay zones left and right for 1024px-tall character art. Frame the scene with tables, booth, hearth, barrels, and rafters around the sides and background. Avoid a bright central focal object and avoid crowded silhouettes.
Lighting/mood: dim blue-grey tavern air, restrained amber candlelight and hearth glow, lonely but hospitable, secretive, gently melancholy, safe but full of unspoken stories.
Color palette: charcoal stone, dark weathered wood, slate-blue smoke and mist, muted amber firelight, dull pewter cups, faded brown leather, tarnished brass accents; low saturation and controlled contrast.
Materials/textures: wet stone floor, worn wood tabletops, soot-dark hearth, iron stove, wax drips, smoky rafters, old barrels, damp wool cloaks, parchment without legible writing, painterly brush texture.
Text: none.
Constraints: follow the lore exactly; do not invent a bright crowded tavern, banquet hall, modern bar, cheerful festival, stage performance, readable notice board, menu, letters, numbers, title text, watermark, logo, UI frame, visible characters, enemies, gore, exaggerated horror, or high-contrast foreground clutter. Maintain the established dark fantasy painterly game-asset tone and leave overlay-friendly negative space.
```

## 生成メモ

- Image Gen出力を `assets/backgrounds/tavern-interior.png` にコピー。
- `sips` で1920x1080に正規化。
- 情報屋の席は空席の一角として示し、文字付き掲示や人物は入れない方針で生成した。
