# ed-2

- Asset: `assets/backgrounds/ed-2.png`
- Kind: ending still
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool
- Final size: 1920x1080 PNG

## 復元注記

セッション中断によりプロンプト原文逸失。以下は `assets/backgrounds/ed-2.png` の目視確認と、既存プロンプト群のスタイルから書き起こした復元プロンプト記録。

## 情景典拠

`docs/spec/asset-pipeline.md`:

- 世界観はダークファンタジー。「壊れかけた機関が紡ぐ、まどろみの夢の世界」。
- 暗め・彩度低め・コントラスト控えめ。夜霧、燭光、青灰と琥珀の対比。
- 絵画的なイラスト調で統一し、文字を画像内に焼き込まない。

## 復元プロンプト

```text
Use case: stylized-concept
Asset type: ending still image for The Dreaming Engine, final target 1920x1080 PNG, wide 16:9 landscape.
Primary request: create `ed-2.png`, a quiet final ending still of the dream town and the broken Dreaming Engine after the conflict, seen from a wet stone terrace beside dark water.
Style reference: match the existing project assets in `assets/`: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, low contrast, no text, no watermark.
Scene/backdrop: a rain-wet stone canal district at night or late dusk, with slate roofs, old stone houses, narrow bridges, railings, a church-like building with a circular gear-window, small boats or docks near dark water, and many tiny amber window lights. In the far background, a vast dreamlike mechanical city rises into mist, built from towers, spires, and enormous interlocking gears. The machinery is subdued and distant, partially swallowed by blue-grey fog rather than triumphant or explosive.
Subject: the town after the ending, not a battle scene. A lone small traveler silhouette may stand on the foreground terrace, facing the lit town and the distant engine, but the environment should dominate. The feeling is mournful relief and continuation, not a solved-perfect happy ending.
Composition/framing: wide cinematic 16:9 establishing view. Foreground wet cobblestones and terrace railings lead the eye toward the canal and bridge. Midground lamps, windows, and church architecture provide warm amber points. Background gear towers and misty engine structures form the skyline. Leave soft cloud and mist areas for possible game-side text overlays.
Lighting/mood: deep blue-grey night fog, damp stone reflections, dim amber lamps and candlelit windows, quiet after-rain atmosphere, melancholic and reverent.
Color palette: blue-grey mist, charcoal stone, dark slate roofs, tarnished brass gears, muted amber lights, wet black reflections; low saturation and controlled contrast.
Materials/textures: wet cobblestone, old stone walls, wrought iron railings, dark water, slate roofs, fog, tarnished gearwork, candlelit glass, painterly brush texture.
Text: none.
Constraints: no title text, no readable signage, no letters, no numbers, no watermark, no logo, no UI frame, no bright festival, no sunny sky, no gore, no monster corpse, no crowded characters, no modern machinery, no neon colors. Maintain the established dark fantasy painterly game-asset tone.
```

## 生成メモ

- 前バッチ中断により生成時の原文プロンプトは残っていなかった。
- 画像特徴として、青灰の夜霧、雨上がりの石畳、水路と橋、琥珀色の窓灯り、歯車都市の遠景を確認。
- `assets/backgrounds/ed-2.png` 自体は既存納品物のまま変更していない。
