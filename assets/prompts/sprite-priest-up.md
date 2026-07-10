# sprite-priest-up

- Asset: `assets/sprites/sprite-priest-up.png`
- Kind: map sprite
- Character: 謎の司祭 — フィオル
- Direction: 上向き(up / 背面)
- Record created: 2026-07-10
- Generation mode: Image Gen built-in tool + `#00ff00` chroma-key removal
- Adopted source generation: `/Users/goodapple/.codex/generated_images/019f49a3-db02-7a31-b08b-130b08b22272/exec-57ed01e0-5319-4629-a5ff-5e359850ce43.png`

## 外見典拠

`docs/spec/world-lore.md` 3.5:

> 痩せて背の高い、年齢不詳の人物。灰色がかった法衣、灯芯を象った杖、常に伏し目がち

## 同一人物性メモ

`assets/sprites/sprite-priest.png` の長い灰白髪、白灰の法衣、灯芯型の杖、細い体格を保持。背面では顔を完全に隠し、長い髪、法衣背面、同じ手の杖を見せた。十字・装身具などは追加していない。

## 採用生成プロンプト全文

```text
Use case: stylized-concept
Asset type: identity-preserving top-down overworld map character sprite cutout for the Japanese dark fantasy 2D RPG "The Dreaming Engine". Final use 256x256 transparent PNG displayed at about 32px on dark map tiles.
Input image: Image 1 is the exact identity, costume, palette, painterly style, top-down camera, scale and proportion reference: assets/sprites/sprite-priest.png. Create a new rear orientation drawing.
Primary request: Create sprite-priest-up, Fior the priest facing UP/NORTH, viewed from behind. Preserve the exact same identity/outfit as Image 1: thin age-ambiguous person, long pale grey-white hair, slightly bowed head, plain worn off-white/grey priestly robes, layered ceremonial cloth, one weathered staff shaped like a lamp wick held upright, tiny subdued amber wick glow, solemn and tired—not villainous.
Orientation definition: UP means true rear view. Body faces top and back faces viewer. Show back/crown of pale hair, long hair falling down the back, rear shoulders, robe back, one upright lamp-wick staff beside the body, and tiny heels. Absolutely no face, eyes, nose, mouth, downcast frontal gaze, chest front or frontal robe panels.
Critical viewpoint: TRUE TOP-DOWN-LEANING OVERWORLD VIEW identical to Image 1. High steep camera; pale crown/hair top, narrow shoulders, upper robe plane and staff top dominate; back torso compressed; feet tiny. Compact 2.5 to 3 heads tall while still reading as Fior's taller narrow silhouette. Not eye-level.
Identity and invariants: change only direction. Same pale hair mass and length, same plain grey/off-white robe layers, same exact single lamp-wick-shaped staff, same muted colors and broad painterly shapes, scale/padding/center. Full staff fits. No symbols.
Map readability: simplified bold 32px silhouette: tall narrow robe mass but compact body, pale hair stripe down back, clear separate vertical staff with curled wick-shaped top and tiny amber point, rear-facing tiny heels.
Style: dark fantasy painterly illustration, muted ash grey, cool blue-grey, soot black, worn off-white, muted brown staff, tiny subdued amber, melancholic solemn; match reference and tiles.
Composition: one full-body standing sprite centered with generous padding; full staff inside frame. No crop, ground, cast/contact shadow, reflection, frame, UI or extra props.
Background for removal: perfectly flat solid #00ff00 chroma-key background, uniform edge-to-edge, no gradients, texture, floor, lighting variation, reflection or shadow. Crisp edges. No #00ff00 in subject.
Constraints: follow docs/spec/world-lore.md 3.5 exactly. Absolutely no cross, crucifix, pendant, necklace symbol, church symbol, skull motif, cult symbol, golden bishop costume, halo, wings, monster, extra character, weapon other than lamp-wick staff, text, watermark, logo, frame or UI. Not front, side, 3/4, isometric, eye-level or realistically tall.
```

## 後処理・検収メモ

- `remove_chroma_key.py` を `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` で実行。
- 非透明被写体を縦横比維持で最大210pxに縮小し、中心 `(128, 126)` へ配置して256x256 RGBAへ正規化。
- 正規化時の補間で生じたalpha 1〜32の緑優勢画素を完全透明化し、低alphaのクロマキー残留も除去。
- final alpha bbox: `(74, 21, 181, 231)`。四隅alpha: `[0, 0, 0, 0]`。
- 鮮緑フリンジ検出0。暗色背景上の32px縮小表示で背面と人物シルエットを確認。
