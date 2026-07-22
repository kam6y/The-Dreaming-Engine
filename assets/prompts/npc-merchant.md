# npc-merchant

- Asset: `assets/portraits/npc-merchant.png`
- Kind: NPC portrait
- Character: 商人 — レンド
- Created: 2026-07-03
- Generation mode: built-in Image Gen, chroma-key background removed locally
- Source generation: `/Users/goodapple/.codex/generated_images/019f26b7-5c61-7f93-b41e-cafdffeaba4d/ig_0bd743a633c0ecd2016a475b34ad688191a15bc286ac05e285.png`

## 外見典拠

`docs/spec/world-lore.md` 3.3:

> 痩身で早口な壮年の男性。片眼鏡、色褪せた行商用の外套、指先にいつもインクの染み

## 固定特徴記述

痩身の壮年男性。片方の目だけに単眼の片眼鏡をかける。色褪せた行商用の外套をまとい、両手の指先に濃いインク染みがある。実用的な旅装、革のストラップ、小型の商い道具を身につけるが、派手な商人風ではなく、低彩度でくたびれた印象に統一する。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: full-body NPC portrait for the Japanese dark fantasy 2D RPG "The Dreaming Engine".
Primary request: Create NPC portrait: Lendo, the merchant of Watarimono-ya.
Reference style: Match the two visible project reference images: the existing player portrait's painterly dark fantasy character rendering, muted blue-grey cloak textures, worn leather detail, subtle amber rim light, and the title background's dim candlelight, blue-grey mist, melancholic dreamlike atmosphere. Keep the same game asset tone and illustration density.
Subject / fixed character features from world lore: A slim, quick-speaking middle-aged man. He wears exactly one monocle: one single round lens over only one eye, with no second lens and no eyeglasses. He has a faded traveling merchant cloak. His fingertips are always stained with ink. He feels sharp about profit but fundamentally dutiful.
Composition/framing: Vertical full-body character standing portrait, centered, 3/4 front view, head to boots visible, generous padding around the silhouette, no crop, no frame, no UI. Show both hands enough that the ink-stained fingertips are visible. The monocle must read clearly as one lens on one eye only.
Clothing/materials: Faded peddler's cloak, layered travel clothes in charcoal, grey-brown, dull blue-grey, worn leather belt and satchel straps, practical boots, aged cloth hems, subtle metal rim and chain on the single monocle.
Lighting/mood: Dim candlelight from one side with restrained amber highlights on the monocle and cloak edges, cool blue-grey ambient mist, melancholy dreamlike mood, low saturation and low contrast.
Scene/backdrop: Perfectly flat solid #00ff00 chroma-key background for background removal only. The background must be one uniform color with no shadows, gradients, texture, floor plane, reflections, scenery, or lighting variation. Keep subject fully separated from background with crisp edges. Do not use #00ff00 anywhere in the subject.
Style/medium: Dark fantasy illustration, muted desaturated colors, painterly style, consistent game asset style, detailed but not photorealistic.
Constraints: no text, no watermark, no logos, no title, no gore, no sexualization, no extra characters, no monsters, no bright merchant colors, no smiling caricature, no eyeglasses, no spectacles, no two lenses, no invented facial hair requirement. Do not contradict the fixed character features.
```

## 生成メモ

初回生成は眼鏡が両眼に見えたため不採用。再生成時に「片方の目だけの単眼レンズ」を強く指定した。生成後、`remove_chroma_key.py` を `python3` で実行し、単色背景を透過化した。出力は 1024x1536 RGBA。
