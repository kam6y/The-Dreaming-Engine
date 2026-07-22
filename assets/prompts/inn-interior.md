# inn-interior

- Asset: `assets/backgrounds/inn-interior.png`
- Kind: conversation background
- Record created: 2026-07-03
- Generation mode: Image Gen built-in tool
- Final size: 1920x1080 PNG

## 情景典拠

`docs/spec/world-lore.md` 2.1:

- 宿屋「灯宿」は、暖炉の火、階段のきしみ、古い歯車の意匠の窓を持つ。
- 宿泊は眠りを通じた機関への同期であり、室内にはそれを静かに暗示する意匠がある。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: conversation scene background for The Dreaming Engine, final target 1920x1080 PNG, wide 16:9 landscape.
Primary request: create `inn-interior.png`, the interior of the inn Tomoshiyado (灯宿), used for conversations with the innkeeper and lodging/rest scenes.
Style reference: match the existing project assets in `assets/`: dark fantasy illustration, muted desaturated colors, dim candlelight and blue-grey mist, melancholic dreamlike atmosphere, painterly style, consistent game asset style, low contrast, no text, no watermark.
Lore source: docs/spec/world-lore.md section 2.1. The inn Tomoshiyado has a tilted wooden sign outside, a warm fireplace, creaking stairs, and one old window with a gear motif in the back of the room, quietly hinting that sleep synchronizes the traveler with the Dreaming Engine.
Scene/backdrop: a small stone-and-timber inn common room at blue-grey night. A modest fireplace glows with restrained amber fire on one side, wooden beams are dark and damp with age, stairs climb quietly toward guest rooms, a simple counter or reception desk sits at the edge, and in the back wall a single old circular window uses a tarnished gear pattern. Thin mist from the street softens the threshold and window light.
Subject: the inn interior itself; no innkeeper, no traveler, no guests, no readable signage. The room should feel safe, worn, and sorrowfully warm, not busy.
Composition/framing: wide cinematic 16:9 conversation background. Keep the lower 30% and central foreground visually calm and darker for a dialogue window. Leave broad uncluttered vertical zones left and right for overlaid 1024px-tall character portraits. Place detailed identity cues such as fireplace, stairs, counter, candles, rafters, and gear-window mostly in midground and side/background areas. Avoid a bright central focal object.
Lighting/mood: dim blue-grey ambient night with restrained amber hearth and candlelight; melancholic but protective, quiet, sleepy, gently lived-in.
Color palette: charcoal stone, dark weathered wood, slate blue shadows, blue-grey night mist, muted amber fire and candlelight, tiny tarnished brass gear accents; low saturation and controlled contrast.
Materials/textures: damp stone floor, worn timber beams, wool blankets folded on benches, soot-dark fireplace stone, old iron hardware, tarnished brass gear-window, soft painterly fog and brush texture.
Text: none.
Constraints: follow the lore exactly; do not invent a luxury palace inn, bright tavern crowd, modern hotel, sunny daytime room, large readable signs, menu boards, letters, numbers, title text, watermark, logo, UI frame, characters, enemies, gore, exaggerated horror, or high-contrast foreground clutter. Maintain the established dark fantasy painterly game-asset tone and leave overlay-friendly negative space.
```

## 生成メモ

- Image Gen出力を `assets/backgrounds/inn-interior.png` にコピー。
- `sips` で1920x1080に正規化。
- 会話ウィンドウと立ち絵の重ね合わせを考え、中央下部は暗めの床面として残した。
