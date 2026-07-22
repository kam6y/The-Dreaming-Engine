# npc-informant

- Asset: `assets/portraits/npc-informant.png`
- Kind: NPC portrait
- Character: 情報屋 — カイ
- Created: 2026-07-03
- Generation mode: built-in Image Gen, chroma-key background removed locally
- Source generation: `/Users/goodapple/.codex/generated_images/019f26b7-5c61-7f93-b41e-cafdffeaba4d/ig_027edc9a8ef005ae016a475c06762c81918978fc6e1b540d07.png`

## 外見典拠

`docs/spec/world-lore.md` 3.4:

> 若く痩せた中性的な人物。フードを浅く被り、片方の目元に古い傷。指先で常にコインを弄ぶ癖がある

## 固定特徴記述

若く痩せた中性的な人物。浅く被ったフードから顔が見え、片方の目元に古い治癒済みの傷がある。片手の指先で小さなくすんだコインを弄ぶ。細く身軽な立ち姿で、掴みどころはないが露骨に悪人らしくはしない。色は低彩度の青灰、煤けた黒、煙った茶、コインの鈍い金属色に抑える。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: full-body NPC portrait for the Japanese dark fantasy 2D RPG "The Dreaming Engine".
Primary request: Create NPC portrait: Kai, the informant of Mutekitei tavern.
Reference style: Match the two visible project reference images: the existing player portrait's painterly dark fantasy character rendering, muted blue-grey cloak textures, worn leather detail, subtle amber rim light, and the title background's dim candlelight, blue-grey mist, melancholic dreamlike atmosphere. Keep the same game asset tone and illustration density.
Subject / fixed character features from world lore: A young, thin, androgynous person. They wear a hood shallowly over the head, not hiding the face. There is one clearly visible old scar at the outer corner and under the lower lid of one eye; it is healed and pale, not bloody. They constantly toy with a coin between their fingertips. Light, elusive presence, but not sinister.
Composition/framing: Vertical full-body character standing portrait, centered, 3/4 front view, head to boots visible, generous padding around the silhouette, no crop, no frame, no UI. One hand must clearly hold or roll a small tarnished coin between fingertips. The old scar near one eye must be readable at portrait scale under the shallow hood.
Clothing/materials: Worn hooded cloak and layered tavern-street clothes in charcoal, dull blue-grey, smoke-brown, and faded black; light leather straps; practical boots; small coin with muted tarnished metal, no bright gold. The silhouette should remain thin and agile.
Lighting/mood: Dim tavern candlelight from one side with restrained amber highlights on the coin and cheekbone, cool blue-grey ambient mist, melancholy dreamlike mood, low saturation and low contrast.
Scene/backdrop: Perfectly flat solid #00ff00 chroma-key background for background removal only. The background must be one uniform color with no shadows, gradients, texture, floor plane, reflections, scenery, or lighting variation. Keep subject fully separated from background with crisp edges. Do not use #00ff00 anywhere in the subject.
Style/medium: Dark fantasy illustration, muted desaturated colors, painterly style, consistent game asset style, detailed but not photorealistic.
Constraints: no text, no watermark, no logos, no title, no gore, no blood, no sexualization, no extra characters, no monsters, no strong gender coding, no full face mask, no deep hidden hood, no thief stereotype with daggers. Do not contradict the fixed character features.
```

## 生成メモ

初回生成は目元の古傷が弱かったため不採用。再生成で「片方の目元の治癒済みの古傷」を強く指定した。生成後、`remove_chroma_key.py` を `python3` で実行し、単色背景を透過化した。緑縁を抑えるため `--edge-contract 1` を追加。出力は 1024x1536 RGBA。
