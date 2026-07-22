# dungeon

- Asset: `assets/backgrounds/dungeon.png`
- Kind: exploration background
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool
- Final size: 1920x1080 PNG

## 情景典拠

`docs/spec/world-lore.md` 2.3:

- 夢喰いの裂け目は、機関の壊死がもっとも進んだ場所。
- 1層は霧に沈んだ回廊、消えかけた燭台、遠い鐘の音が似合う。
- 2層では建材や通路の理屈が歪み、同じ扉や天井の石畳が現れる。
- 3層では青灰と漆黒が支配的になる。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: exploration background for The Dreaming Engine, final target 1920x1080 PNG, wide 16:9 landscape.
Primary request: create `dungeon.png`, the dungeon: the inner underground of the Dreaming Engine and the Dream Eater fissure (夢喰いの裂け目).
Style reference: match the existing project assets, especially the title background and enemy cutouts: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, low contrast, no text, no watermark.
Lore source: docs/spec/world-lore.md section 2.3. The dungeon is where the engine's necrosis has progressed most deeply. Layer 1 still keeps the shape of a dream: corridors sunk in fog, dying candlesticks, distant bells, a nostalgic eeriness. Layer 2 begins to warp architecture: repeated doors, stone pavement where the ceiling should be. Layer 3 loses most color into blue-grey and black. This background should represent an explorable interior/underground dungeon without showing the final boss.
Scene/backdrop: a mist-filled underground corridor inside a broken dream-machine. Damp stone arches and floors merge with tarnished brass gearwork, chain shadows, old pipes, and recessed machinery. Fading candelabra line the passage with small amber flames. Some architecture subtly disobeys logic: a duplicate door appears deeper in the corridor, and a patch of cobblestone seems to climb into the ceiling.
Subject: the dungeon environment itself; no characters, no enemies, no boss silhouette. The Dreaming Engine should be felt through gears and mechanisms embedded in the walls rather than a separate machine prop.
Composition/framing: wide cinematic 16:9 exploration background; foreground cracked damp stone and low mist, midground arched corridor and dying candles, background receding warped passage and faint gear shapes. Keep a readable route through the scene.
Lighting/mood: dim blue-grey fog, blackened recesses, restrained amber candlelight; nostalgic but uncanny, sorrowful, not a gore-horror scene.
Color palette: blue-grey, charcoal, soot black, tarnished brass, muted amber candlelight; very low saturation and controlled contrast.
Materials/textures: wet stone, corroded gears, worn brass, soot, wax drips, soft painterly fog, old timber and iron details.
Text: none.
Constraints: follow the lore exactly; do not invent a lava cave, bright crystal cavern, natural forest cave, sci-fi neon corridor, clean factory, treasure room, boss arena, characters, enemies, readable symbols or letters, title text, watermark, logo, UI, gore, blood, organs, or excessive grotesque detail. Maintain the established dark fantasy painterly game-asset tone.
```

## 生成メモ

- Image Gen出力を `assets/backgrounds/dungeon.png` にコピー。
- `sips` で1920x1080に正規化。
- 探索用として、最深部やボス戦専用の圧迫感ではなく、通路として読める構図を優先。
