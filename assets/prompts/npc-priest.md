# npc-priest

- Asset: `assets/portraits/npc-priest.png`
- Kind: NPC portrait
- Character: 謎の司祭 — フィオル
- Created: 2026-07-03
- Generation mode: built-in Image Gen, chroma-key background removed locally
- Source generation: `/Users/goodapple/.codex/generated_images/019f26b7-5c61-7f93-b41e-cafdffeaba4d/ig_07f9191461068723016a475d01f61081918f2c9619c13217a9.png`

## 外見典拠

`docs/spec/world-lore.md` 3.5:

> 痩せて背の高い、年齢不詳の人物。灰色がかった法衣、灯芯を象った杖、常に伏し目がち

## 固定特徴記述

痩せて背の高い年齢不詳の人物。灰色がかった法衣をまとい、灯芯を象った杖を持つ。顔は常に伏し目がちで、静かで疲れた印象を持つが、黒幕や邪教徒のような悪役表現には寄せない。色は灰色、青灰、煤けた黒、杖先の控えめな琥珀光に抑える。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: full-body NPC portrait for the Japanese dark fantasy 2D RPG "The Dreaming Engine".
Primary request: Create NPC portrait: Fior, the mysterious priest of Himorido.
Reference style: Match the two visible project reference images: the existing player portrait's painterly dark fantasy character rendering, muted blue-grey cloak textures, worn leather detail, subtle amber rim light, and the title background's dim candlelight, blue-grey mist, melancholic dreamlike atmosphere. Keep the same game asset tone and illustration density.
Subject / fixed character features from world lore: A thin, tall, age-ambiguous person. They wear greyish priestly robes. They carry a staff shaped like a lamp wick. Their eyes are always downcast, quiet and tired, not villainous.
Composition/framing: Vertical full-body character standing portrait, centered, 3/4 front view, head to feet visible, generous padding around the silhouette and staff, no crop, no frame, no UI. The full lamp-wick-shaped staff must be visible. The head is slightly bowed with downcast eyes.
Clothing/materials: Greyish ceremonial robes, worn layered cloth, faint soot and wax-like stains, dark blue-grey shadows, restrained amber edging near the staff tip, simple practical sandals or boots under the robe. Keep the silhouette tall and slender.
Lighting/mood: Dim candlelight from one side with restrained amber highlights on the staff and robe edges, cool blue-grey ambient mist, solemn melancholic dreamlike mood, low saturation and low contrast.
Scene/backdrop: Perfectly flat solid #00ff00 chroma-key background for background removal only. The background must be one uniform color with no shadows, gradients, texture, floor plane, reflections, scenery, or lighting variation. Keep subject fully separated from background with crisp edges. Do not use #00ff00 anywhere in the subject.
Style/medium: Dark fantasy illustration, muted desaturated colors, painterly style, consistent game asset style, detailed but not photorealistic.
Constraints: no text, no watermark, no logos, no title, no gore, no blood, no sexualization, no extra characters, no monsters, no skull motifs, no evil cultist look, no ornate golden bishop costume, no bright holy glow. Do not contradict the fixed character features.
```

## 生成メモ

生成後、`remove_chroma_key.py` を `python3` で実行し、単色背景を透過化した。出力は 1024x1536 RGBA。痩せた長身、灰色がかった法衣、灯芯を象った杖、伏し目がちな表情が判別できるため採用。
