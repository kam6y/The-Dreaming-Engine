# npc-innkeeper

- Asset: `assets/portraits/npc-innkeeper.png`
- Kind: NPC portrait
- Character: 宿屋の主人 — オルガ
- Created: 2026-07-03
- Generation mode: built-in Image Gen, chroma-key background removed locally
- Source generation: `/Users/goodapple/.codex/generated_images/019f26b7-5c61-7f93-b41e-cafdffeaba4d/ig_02d5528a96cf43e3016a475a4542e88191844124016313046c.png`

## 外見典拠

`docs/spec/world-lore.md` 3.2:

> 恰幅のよい初老の女性。灰の混じった三つ編み、火傷の跡が残る太い手、いつも羊毛の肩掛け

## 固定特徴記述

恰幅のよい初老の女性。灰の混じった長い三つ編み。太い手と前腕に古い火傷跡が見える。厚い羊毛の肩掛けを常に身につけ、宿屋の主人らしい実用的な衣服と、肝の据わった温かい表情を持つ。色は低彩度の青灰、煤けた茶、羊毛の灰色、控えめな琥珀の縁光に限定する。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: full-body NPC portrait for the Japanese dark fantasy 2D RPG "The Dreaming Engine".
Primary request: Create NPC portrait: Olga, the innkeeper of Tomoshiyado.
Reference style: Match the two visible project reference images: the existing player portrait's painterly dark fantasy character rendering, muted blue-grey cloak textures, worn leather detail, subtle amber rim light, and the title background's dim candlelight, blue-grey mist, melancholic dreamlike atmosphere. Keep the same game asset tone and illustration density.
Subject / fixed character features from world lore: A stout elderly woman, the innkeeper. Grey-streaked braided hair. Thick hands with visible old burn scars. Always wearing a wool shoulder shawl. Warm but sturdy presence, practical and unshaken.
Composition/framing: Vertical full-body character standing portrait, centered, 3/4 front view, head to boots visible, generous padding around the silhouette, no crop, no frame, no UI. She may hold a simple innkeeper cloth or rest one scarred hand near her shawl, but do not add unrelated props.
Clothing/materials: Humble dark fantasy innkeeper clothing, worn layered dress or apron in charcoal, brown-grey, and faded blue-grey, heavy wool shoulder shawl, practical boots, soot-darkened fabric edges, painterly cloth and leather texture.
Lighting/mood: Dim candlelight from one side with restrained amber highlights, cool blue-grey ambient mist, melancholic but comforting mood, low saturation and low contrast.
Scene/backdrop: Perfectly flat solid #00ff00 chroma-key background for background removal only. The background must be one uniform color with no shadows, gradients, texture, floor plane, reflections, scenery, or lighting variation. Keep subject fully separated from background with crisp edges. Do not use #00ff00 anywhere in the subject.
Style/medium: Dark fantasy illustration, muted desaturated colors, painterly style, consistent game asset style, detailed but not photorealistic.
Constraints: no text, no watermark, no logos, no title, no gore, no sexualization, no extra characters, no monsters, no transparent/ghost body beyond subtle painterly atmosphere at the silhouette edge. Do not contradict the fixed character features.
```

## 生成メモ

生成後、`remove_chroma_key.py` を `python3` で実行し、単色背景を透過化した。出力は 1024x1536 RGBA。火傷跡の太い手、灰混じりの三つ編み、羊毛肩掛けが判別できるため採用。
