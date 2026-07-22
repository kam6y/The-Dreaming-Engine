# タイルセット

| ファイル | 素材 | 仕様 | ライセンス | 出典 |
|---|---|---|---|---|
| `roguelike-sheet-transparent.png` | Kenney「Roguelike/RPG pack」のスプライトシート(透過版。原名 `roguelikeSheet_transparent.png`) | 968x526px。16x16pxタイル、タイル間隔1px・外周マージンなし(57列x31行=1767タイル) | CC0 1.0(同梱の `LICENSE.txt`) | [kenney.nl/assets/roguelike-rpg-pack](https://kenney.nl/assets/roguelike-rpg-pack)(2026-07-05 取得) |

- タイル・スプライトシートは画像生成(codex委譲)の対象外であり、CC0素材の同梱で賄う
  (`docs/spec/asset-pipeline.md`「タイルマップの方針」)
- codex生成画像の台帳である `manifest.json` の管理対象外(フォント同様、本READMEが台帳)
- Phaser での読み込み設定: `frameWidth: 16, frameHeight: 16, margin: 0, spacing: 1`。
  ゲームのグリッドは32pxのため NEAREST フィルタで2倍表示する
- 検収済み(2026-07-05): PNG署名一致・グリッド整合(968=57x16+56, 526=31x16+30)
