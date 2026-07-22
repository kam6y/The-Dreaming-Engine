# failing-spinner

- Asset: `assets/enemies/failing-spinner.png`
- Kind: enemy battle graphic
- Enemy: 紡ぎ損ない(つむぎそこない) 第1形態
- Record created: 2026-07-06
- Generation mode: Image Gen built-in tool + chroma-key removal

## 外見典拠

`docs/spec/world-lore.md` 4.1:

> 1形態: 崩れかけた織機のような巨躯。四方へ垂れた無数の解れた糸(消えかけた灯の名残)の中心で、翳(かす)んだ紡錘がゆっくりと空回りしている。

> 正しく紡ぐことをとうに忘れ、触れる灯を片端から縺(もつ)れさせる。討つことは、その虚しい空回りを止めてやることでもある。

## 特徴記述

崩れかけた織機のような非人型の巨躯。壊れた横木と支柱の中心に翳んだ紡錘があり、その周囲から無数の解れ糸が四方へ垂れる。糸は消えかけた灯の名残として、ごく小さな琥珀の微光だけを含む。顔・目・手足・武器・ルーン・吊り灯などは加えない。

## 第2形態への連続性メモ

第2形態では、この第1形態の壊れた織機フレーム、中央の紡錘位置、非人型の四角い巨躯、暗い木金属の質感を共有する。差分は、糸が焼け落ちて短い炭化片になり、剥き出しの紡錘が逆しまに回ることに限定する。

## 生成プロンプト全文

```text
Use case: stylized-concept
Asset type: mid-boss enemy battle cutout for The Dreaming Engine, target square 512x512 PNG
Style reference: match the already visible project enemy assets: dark fantasy painterly illustration, muted desaturated colors, dim candlelight accents, blue-grey mist, subtle amber rim light, low contrast, melancholic dreamlike mood, transparent-character-cutout composition.
Primary request: create the mid-boss "Failing Spinner" (紡ぎ損ない / tsumugi-sokonai), phase 1.
Lore source: phase 1 appearance is "a huge body like a collapsing loom. In the center of countless frayed threads hanging in every direction, a dimmed spindle slowly spins idly." The hanging threads are remnants of disappearing lights. It is a broken dream-spinning mechanism, exhausted rather than angry.
Subject: a single massive non-humanoid broken loom-like body, an old dream-weaving machine collapsing under its own weight. The silhouette reads as a ruined loom frame with cracked horizontal and vertical beams and a central dim metal spindle. Countless frayed threads hang downward and outward from all four directions around the center; threads are thin, worn, ghostly fibers, not chains and not ropes. The central spindle is the clear focal point, dull and clouded, partly veiled by threads, slowly idling. No face, no eyes, no hands, no legs, no weapons, no armor, no runes, no lanterns, no hanging lamps, no decorative pendants.
Composition/framing: centered three-quarter view, entire creature visible with at least 12 percent empty green padding on every side. Do not touch or crop against any image border. No ground plane, no cast shadow, no scattered floor debris. Suitable to overlay on battle backgrounds.
Lighting/mood: dim blue-grey shadows with faint amber glimmers only as tiny ember-like points caught inside a few thread fibers and inside the spindle core; mournful, exhausted, and dreamlike.
Color palette: charcoal worn wood-or-metal loom frame, ash grey, tarnished brass spindle, blue-grey mist, extremely subtle muted amber thread embers; avoid green in the subject.
Materials/textures: cracked old loom beams, corroded spindle metal, frayed thread fibers, soft dream mist, painterly texture; readable silhouette.
Continuity anchor for phase 2: preserve this broad broken-loom body plan, same central spindle position, same square framing, and same overall silhouette; only the threads burn away and the spindle becomes exposed in phase 2.
Background for removal: perfectly flat solid #00ff00 chroma-key background. The actual image background must be pure bright green (#00ff00), one uniform flat color, not black and not transparent. No shadows, gradients, texture, floor, reflection, lighting variation, or contact shadow. Keep the subject fully separated from the background with crisp enough edges and generous padding. Do not use #00ff00 anywhere in the subject.
Text: none.
Constraints: follow the lore appearance exactly; do not add a humanoid face, eyes, horns, wings, arms, legs, claws, weapon, armor, runes, symbols, blood, gore, lanterns, lamps, candles, text, watermark, logo, frame, or UI. No excessive grotesque detail.
```

## 生成メモ

- 試行1は織機の巨躯として強かったが、余白不足と吊り下げ灯のように見える微光があったため不採用。
- 採用版では、余白指定と「灯は糸端の微光のみ」「ランタン・吊り灯禁止」を強めた。
- Image Gen出力をフラットな緑クロマキー背景で生成。
- `remove_chroma_key.py` で背景を透過し、512x512へリサイズして `assets/enemies/failing-spinner.png` に保存。
- 最終PNGは512x512 RGBA。透明コーナー、キー色残留ほぼなしを確認。
