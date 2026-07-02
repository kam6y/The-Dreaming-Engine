# /goal 用プロンプト — 縦切り完成まで

以下のブロックをそのままcodexの `/goal` に貼り付けて使う。

---

日本語ダークファンタジー2D RPG「The Dreaming Engine」の縦切り(vertical slice)を完成させよ。

## ゴール

`docs/progress/ROADMAP.md` のM0からM6までのすべてのチェックボックスを、
各マイルストーンの完了条件を満たした上で完了させる。最終状態は:

- タイトル→新規ゲーム→メインクエスト→ボス「夢喰い」撃破→エンディング→タイトル
  まで通しでプレイできる
- `pnpm check` と `pnpm test:e2e` が緑
- 主要シーンに生成画像アセットが組み込まれている
- すべてコミット済みで、`docs/progress/JOURNAL.md` が最新状態を反映している

## 最初にやること

1. `AGENTS.md` を読む(このプロジェクトの憲法。全作業で従うこと)
2. `docs/progress/JOURNAL.md` の末尾エントリで現在地を確認する
3. `docs/progress/ROADMAP.md` で次の未完了マイルストーンを特定する
4. 対象マイルストーンに関係する `docs/spec/` の仕様書を読む

## 作業サイクル(これを完了まで繰り返す)

1. ROADMAPの次の未完了項目を1つ選び、1-2時間相当以下のタスクに分解する
2. 実装する。ゲームロジックはユニットテストを先に(または同時に)書く
3. `pnpm check` を緑にする(M1以降は `pnpm test:e2e` も)
4. 小さくコミットする(AGENTS.mdのコミット規約に従う)
5. `ROADMAP.md` のチェックと `JOURNAL.md` のエントリを更新してコミットする
6. 次の項目へ

## 重要な規律

- 仕様(`docs/spec/`)が正。仕様にない細部は裁量で決めてJOURNALに記録する。
  仕様を変えたい場合は変えずに「仕様変更提案」としてJOURNALに書き、前進する
- ゲーム内AIの防御要件(`docs/spec/ai-guardrails.md`)は絶対に弱めない
- 開発・E2Eでは実AIを呼ばない(`AI_MODE=mock`)。`pnpm test:ai-live` を
  自動実行に組み込まない
- 同じエラーに3回失敗したらアプローチを変えるか、プレースホルダーで前進して
  JOURNALに既知の問題として記録する。1つの問題で止まり続けない
- `.env`・秘密情報・`saves/`・`logs/` をコミットしない。作業ブランチは `codex/dev`
- M5では `docs/spec/asset-pipeline.md` に従い、Image Genで画像アセットを生成して
  組み込む(スタイルガイド・ファイル管理規約・プロンプト保存を遵守)
- ライブラリのAPIが不明なときは公式ドキュメントを調べる。
  特にClaude Agent SDK(`@anthropic-ai/claude-agent-sdk`)はM4実装前に
  必ず最新ドキュメントを確認する

## 完了の宣言

M6の完了条件をすべて満たしたら、JOURNALに「縦切り完成」エントリを書き、
通しプレイのE2Eスクリーンショット一式の場所を記載して作業を終了する。

---

## (参考)投入前チェックリスト — 人間(あなた)用

- [ ] `git checkout codex/dev` されている
- [ ] Node.js 22+ / pnpm がインストール済み
- [ ] `claude setup-token` で発行したAuth tokenを `.env` に設定済み
      (`CLAUDE_CODE_OAUTH_TOKEN=...`。M4の `test:ai-live` まで実際には使われない)
- [ ] codexにネットワークアクセス(パッケージ取得・ドキュメント調査)の権限がある
- [ ] codexにImage Gen(画像生成)の権限がある(M5で使用)
