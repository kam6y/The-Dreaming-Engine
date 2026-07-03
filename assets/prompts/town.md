# town

- Asset: `assets/backgrounds/town.png`
- Kind: exploration background
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool
- Final size: 1920x1080 PNG

## 情景典拠

`docs/spec/world-lore.md` 2.1:

- 灯町は機関の灯がまだ多く残る数少ない安寧の地。
- 石畳は霧に湿り、軒先の灯りが青灰の空気に琥珀色ににじむ。
- 宿屋「灯宿」、商店「渡り物屋」、酒場「霧笛亭」、教会「灯守堂」がある。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: exploration background for The Dreaming Engine, final target 1920x1080 PNG, wide 16:9 landscape.
Primary request: create `town.png`, an outdoor wide view of the sleepy safe town Tomoshimachi (灯町), the town hub.
Style reference: match the existing project assets, especially the title background and enemy cutouts: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, low contrast, no text, no watermark.
Lore source: docs/spec/world-lore.md section 2.1. Tomoshimachi is one of the few peaceful places where many engine-lights remain; once a relay point of the Dreaming Engine, now a small town suited to dusk. Cobblestones are wet with mist, and eaves and windows leak amber light into blue-grey air. Facilities include the inn Tomoshiyado with a tilted wooden sign and gear-window motif, the shop Watarimono-ya, the tavern Mutekitei, and the small church Himorido with a gear-and-lampwick motif.
Scene/backdrop: a small stone-and-timber town at blue-grey twilight, wet cobblestone lanes, low stone bridges and steps, amber candlelit windows, lanterns and a few candles under eaves, thin night fog pooling at street level. In the far distance, only a subdued broken gear mechanism silhouette hints at the Dreaming Engine; it should feel integrated with the town, not like a separate bright spectacle.
Subject: the town itself; no main character or NPC focus. Hint at the inn, shop, tavern, and small church through architecture and light, but avoid readable signage.
Composition/framing: wide cinematic 16:9 establishing view; foreground wet cobblestone street and low railings, midground compact town square and rooftops, background mist and faint machinery. Leave a naturally readable path into the town; no UI frame or border.
Lighting/mood: dim and gentle, blue-grey mist dominates, restrained amber candlelight in windows and lanterns; melancholic, safe, slightly sorrowful, not horror.
Color palette: charcoal stone, slate blue, blue-grey fog, dark weathered wood, small muted amber lights; low saturation and controlled contrast.
Materials/textures: damp stone, worn timber, iron lanterns, fog-softened rooftops, faint tarnished brass gear motifs, painterly brush texture.
Text: none.
Constraints: follow the lore exactly; do not invent a sunny village, desert, forest city, castle metropolis, neon city, snowfield, bright festival, crowds, readable signs, Japanese or English letters, title text, watermark, logo, UI, gore, or exaggerated horror. Maintain the established dark fantasy painterly game-asset tone.
```

## 生成メモ

- Image Gen出力を `assets/backgrounds/town.png` にコピー。
- `sips` で1920x1080に正規化。
- 文字焼き込み禁止、低彩度、青灰の霧、琥珀の灯りを優先。
