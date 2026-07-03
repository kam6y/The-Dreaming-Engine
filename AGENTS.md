# AGENTS.md — codex向けの注意(画像アセット生成専用)

本リポジトリの開発は**Claude Code**が行う(開発憲法は `CLAUDE.md`)。
codexの役割は**画像アセットの生成のみ**である。以下に常に従うこと。

- 規約は `docs/spec/asset-pipeline.md` が正(スタイルガイド・生成対象・
  ファイル管理規約・プロンプト保存をすべて遵守する)
- キャラクター・敵の外見の典拠は `docs/spec/world-lore.md` 3節(人物)・4節(敵)。
  記載と異なる外見を発明しない
- 納品先は `assets/` 配下のみ。**`assets/` の外のファイル(コード・仕様書・
  進捗ドキュメント)を作成・変更・削除しない**
- 生成に使ったプロンプト全文を `assets/prompts/<asset-id>.md` に保存し、
  `assets/manifest.json` に台帳エントリを登録する
- git操作(コミット・ブランチ操作)は行わない。検収とコミットはClaude Code側が行う
