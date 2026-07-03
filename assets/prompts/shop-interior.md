# shop-interior

- Asset: `assets/backgrounds/shop-interior.png`
- Kind: conversation background
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool
- Final size: 1920x1080 PNG

## 情景典拠

`docs/spec/world-lore.md` 2.1 / 3.3:

- 商店「渡り物屋」は旅装・薬・雑貨を扱い、行商人から流れ着いた品や産地不明の品も並ぶ。
- 商人レンドの窓口として、売買や旅の道具を扱う場所。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: conversation scene background for The Dreaming Engine, final target 1920x1080 PNG, wide 16:9 landscape.
Primary request: create `shop-interior.png`, the interior of the shop Watarimono-ya (渡り物屋), used for conversations and buying/selling with the merchant.
Style reference: match the existing project assets in `assets/`: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, low contrast, no text, no watermark.
Lore source: docs/spec/world-lore.md section 2.1 and 3.3. Watarimono-ya handles travel gear, medicine, and miscellaneous goods. Shelves hold items brought by traveling merchants, including some objects of unknown origin. The merchant is practical and fastidious, with ink-stained fingers, but no person should appear in this background.
Scene/backdrop: a narrow stone-and-timber shop interior at dim twilight. Shelves and cubbies hold worn travel cloaks, rolled blankets, simple packs, rope, lanterns, small medicine bottles, herb bundles, dull mineral samples, folded maps with no readable marks, and a few strange originless curios shaped like tarnished brass gear fragments or sealed glass vials. A modest counter with a ledger, ink bottle, scale, and wrapped parcels sits to one side. Blue-grey street mist seeps through the doorway and a small window; amber candles and lanterns give restrained warmth.
Subject: the shop interior itself; no merchant, no customers, no readable labels, no price tags, no text. The room should feel useful, cramped, and quietly mysterious rather than festive.
Composition/framing: wide cinematic 16:9 conversation background. Keep the lower 30% and central foreground calm and lower-detail for a dialogue window. Leave broad vertical zones on the left and right for overlaid 1024px character portraits by pushing most shelf detail into the midground and rear wall. Counter and shelves may frame the scene, but avoid high-contrast clutter in the center.
Lighting/mood: dim blue-grey ambient light with small muted amber candle and lantern accents; pragmatic, hushed, slightly uncanny, but safe inside Tomoshimachi.
Color palette: charcoal stone, dark weathered wood, slate blue mist, muted amber light, faded cloth browns and greys, tarnished brass, dusty glass; low saturation and controlled contrast.
Materials/textures: worn timber shelves, damp stone floor, leather straps, wool and canvas, cloudy glass bottles, dried herbs, tarnished brass mechanisms, parchment without legible writing, painterly brush texture.
Text: none.
Constraints: follow the lore exactly; do not invent a bright market stall, modern store, apothecary laboratory, magical neon shop, crowded bazaar, readable signs, labels, price tags, letters, numbers, title text, watermark, logo, UI frame, characters, enemies, gore, exaggerated horror, or high-contrast foreground clutter. Maintain the established dark fantasy painterly game-asset tone and leave overlay-friendly negative space.
```

## 生成メモ

- Image Gen出力を `assets/backgrounds/shop-interior.png` にコピー。
- `sips` で1920x1080に正規化。
- 棚の情報量は中景へ寄せ、会話UI用に手前の石床と中央通路を比較的静かに残した。
