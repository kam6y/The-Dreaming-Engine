# sprite-priest-left

- Asset: `assets/sprites/sprite-priest-left.png`
- Kind: map sprite
- Character: 謎の司祭 — フィオル
- Direction: 左向き(left / 左プロフィール)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-5b1143c2-6ade-42d2-80cc-d5466b2c9a10.png`

## 外見典拠

`docs/spec/world-lore.md` 3.5:

> 痩せて背の高い、年齢不詳の人物。灰色がかった法衣、灯芯を象った杖、常に伏し目がち

## 同一人物性メモ

`assets/sprites/sprite-priest.png` の長い灰白髪、伏し目の姿勢、白灰の法衣、灯芯型の杖を保持。頭頂を大きく、顔・胴脚を圧縮し、伏せた顔と靴先を左へ向けた。十字・胸飾りはない。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use 256x256 transparent PNG displayed at about 32px on dark map tiles.
Input image: Image 1 is the exact identity, costume, palette, painterly style, top-down camera, scale and proportion reference: assets/sprites/sprite-priest.png. Create a new left-facing orientation.
Primary request: Create sprite-priest-left, Fior the priest facing LEFT/WEST in a true left-facing profile. Preserve the same thin age-ambiguous person/outfit as Image 1: long pale grey-white hair, downcast eyes and bowed head, plain worn off-white/grey priestly robes, layered ceremonial cloth, one weathered staff shaped like a lamp wick held upright, tiny subdued amber wick light, quiet tired solemn mood.
Orientation definition: LEFT means the bowed face profile, chest, knees and toes point unmistakably toward the left. Show a small downcast left profile partly veiled by pale hair, compact narrow robe from the side, left-pointing tiny boots. Keep the lamp-wick staff upright beside the body and fully visible, positioned consistently with the same physical hand from Image 1. Do not face viewer or use 3/4 front.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW identical to Image 1. High steep camera shows pale crown, hair top, near shoulder, upper robe plane and staff top; face small/foreshortened; torso compressed; feet tiny. Compact 2.5 to 3 heads tall while reading as Fior's narrow tall archetype, not eye-level or realistic-tall.
Identity and invariants: change only direction. Same long pale hair, bowed head, plain grey/off-white tattered robe layers, exact single lamp-wick staff, muted colors, broad painterly shapes, scale/padding/center. No symbols or jewelry.
Map readability: bold simple 32px silhouette: pale bowed head points left, narrow layered robe trails right, small left-pointing boots, separate vertical staff with unmistakable wick curl and tiny amber point.
Style: dark fantasy painterly illustration, muted ash grey, cool blue-grey, soot black, worn off-white, muted brown staff, tiny amber, melancholic solemn; match reference and tiles.
Composition: one full-body standing sprite centered with generous padding; entire staff fits. No crop, ground, cast/contact shadow, reflection, frame, UI or props.
Background for removal: perfectly flat solid #00ff00 chroma-key background, uniform edge-to-edge, no gradients, texture, floor, lighting variation, reflection or shadow. Crisp edges. No #00ff00 in subject.
Constraints: follow docs/spec/world-lore.md 3.5 exactly. Absolutely no cross, crucifix, pendant, necklace symbol, church symbol, skull motif, cult symbol, golden bishop costume, halo, wings, monster, extra character, weapon other than lamp-wick staff, text, watermark, logo, frame or UI. Not front, rear, right, 3/4, isometric, eye-level or realistic tall proportions.
```

## 後処理・検収メモ

- `remove_chroma_key.py` を `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で実行。
- 非透明被写体を縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- 正規化時の補間で生じたalpha 1〜32の緑優勢画素を完全透明化し、低alphaのクロマキー残留も除去。
- final alpha bbox: `(76, 21, 179, 231)`。四隅alpha: `[0, 0, 0, 0]`。
- 鮮緑フリンジ検出0。暗色背景上の32px縮小表示で左右方向と人物シルエットを確認。
