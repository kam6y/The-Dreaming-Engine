# 音声アセット(効果音・BGM)

音声は画像アセット(codex委譲: `docs/spec/asset-pipeline.md`)と異なり、
オープンライセンス配布物の同梱で賄う。**本READMEが台帳**(`manifest.json` の対象外。
フォント `assets/fonts/`・タイル `assets/tiles/` と同じ扱い)。

## ライセンス

| 出典パック | ライセンス | 同梱ライセンス文 |
|---|---|---|
| [Kenney「RPG Audio」](https://kenney.nl/assets/rpg-audio) | CC0 1.0 | `LICENSE-kenney-rpg-audio.txt` |
| [Kenney「Interface Sounds」](https://kenney.nl/assets/interface-sounds) | CC0 1.0 | `LICENSE-kenney-interface-sounds.txt` |
| [Kenney「Music Jingles」](https://kenney.nl/assets/music-jingles) | CC0 1.0 | `LICENSE-kenney-music-jingles.txt` |

いずれも 2026-07-07 に kenney.nl から取得(無加工。ファイル名のみ用途別に変更)。

## 効果音(se/)

id はファイル名(拡張子なし)と一致させる。クライアントは本表の id でロードする。

| id | 用途 | 出典ファイル |
|---|---|---|
| `se-cursor` | メニューカーソル移動 | Interface Sounds `select_001.ogg` |
| `se-confirm` | 決定 | Interface Sounds `confirmation_001.ogg` |
| `se-cancel` | キャンセル/戻る | Interface Sounds `back_002.ogg` |
| `se-error` | 操作の拒否(MP不足・満杯・資金不足等) | Interface Sounds `error_004.ogg` |
| `se-attack` | 攻撃ヒット | RPG Audio `knifeSlice.ogg` |
| `se-skill` | スキル発動 | RPG Audio `drawKnife1.ogg` |
| `se-damage` | 被ダメージ | RPG Audio `chop.ogg` |
| `se-heal` | 回復(アイテム・スキル) | Interface Sounds `pluck_001.ogg` |
| `se-coin` | 売買成立 | RPG Audio `handleCoins.ogg` |
| `se-door` | マップ遷移 | RPG Audio `doorOpen_1.ogg` |
| `se-levelup` | レベルアップ | Music Jingles `jingles_STEEL04.ogg` |
| `se-victory` | 戦闘勝利 | Music Jingles `jingles_STEEL00.ogg` |

- 選定はファイル名・パック説明に基づく(聴感の最終確認は人間プレイ待ち。
  差し替えは該当 id のファイルを置き換えて本表を更新するだけでよい)

## BGM(bgm/)

すべて **Kevin MacLeod (incompetech.com)** の楽曲。ライセンスは **CC BY 4.0**
(https://creativecommons.org/licenses/by/4.0/)。**帰属表記が必須**であり、
本READMEとゲームのREADMEに以下のクレジットを維持すること:

> Music by Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License

2026-07-07 に incompetech.com から取得し、ffmpeg で 112kbps MP3 へ再エンコード
(尺・内容は無加工)。

| id | 用途 | 原題 |
|---|---|---|
| `bgm-title` | タイトル画面(オープニングにも継続) | Long Note One |
| `bgm-town` | 街(灯町) | Ossuary 6 - Air |
| `bgm-field` | フィールド(忘れ野) | Penumbra |
| `bgm-dungeon` | ダンジョン(裂け目 全層) | The Dread |
| `bgm-battle` | 戦闘 | Volatile Reaction |

- 選定は楽曲説明・タイトルに基づくダークアンビエント志向(聴感の最終確認は
  人間プレイ待ち。差し替えは該当 id のファイル置換+本表更新でよい)
