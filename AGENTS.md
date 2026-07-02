# AGENTS.md — The Dreaming Engine 開発憲法

このリポジトリは、ゲーム実行中に生成AI(Claude Agent SDK)を組み込んだ日本語ダークファンタジー2D RPG
「The Dreaming Engine」を、codexの長時間自律駆動で開発するプロジェクトである。
あなた(codex)はこのファイルの規約に**常に**従うこと。

## セッション開始時の手順(必須)

1. `docs/progress/JOURNAL.md` の末尾エントリを読み、前回の状態と申し送りを把握する
2. `docs/progress/ROADMAP.md` で現在のマイルストーンと未完了タスクを確認する
3. 作業対象に関係する `docs/spec/` 配下の仕様書を読む
4. `git status` と直近のコミットログで作業ツリーの状態を確認する

## セッション終了時・各タスク完了時の義務(必須)

1. `pnpm check` が緑であることを確認してからコミットする
2. `docs/progress/ROADMAP.md` のチェックボックスを実態に合わせて更新する
3. `docs/progress/JOURNAL.md` に新しいエントリを追記する(フォーマットは同ファイル冒頭を参照)
4. 未完了・保留の事項は必ずJOURNALの「次にやること」に書き残す

## ドキュメントマップ

| ファイル | 内容 |
|---|---|
| `docs/spec/game-design.md` | ゲーム仕様(マップ・戦闘・NPC・クエスト・セーブ) |
| `docs/spec/ai-integration.md` | Agent SDK統合・DreamMaster・ツール定義 |
| `docs/spec/ai-guardrails.md` | ゲーム内AIの防御仕様・世界観憲法プロンプト |
| `docs/spec/asset-pipeline.md` | Image Genアセット生成の規約 |
| `docs/progress/ROADMAP.md` | マイルストーンと完了条件 |
| `docs/progress/JOURNAL.md` | セッション間の作業ログ(あなたの長期記憶) |
| `docs/progress/BACKLOG.md` | 縦切り完成後の拡張アイデア |

仕様と実装が食い違う場合は**仕様が正**。仕様自体を変えたい場合は、変更せずに
JOURNALへ「仕様変更提案」として理由付きで記録し、可能な範囲で仕様に沿って前進する。
ただし仕様に書かれていない細部(定数・命名・ロア・演出)はあなたの裁量で決めてよい。
裁量で決めた事項はJOURNALに記録する。

## 技術スタック

- pnpm workspace モノレポ(Node.js 22+, TypeScript strict)
- `packages/shared` — zodスキーマ・型定義(client/server共有。ゲーム状態・WSメッセージ・ツール入出力)
- `packages/client` — Phaser 3 + Vite(ブラウザ側)
- `packages/server` — Fastify + WebSocket + `@anthropic-ai/claude-agent-sdk`
- テスト: Vitest(ユニット)、Playwright(E2E)。E2EはモックAIモードで走らせる

## コマンド(M0で整備し、変更したらこの表を更新)

| コマンド | 内容 |
|---|---|
| `pnpm dev` | サーバー(:3000)とクライアント(:5173)を同時起動 |
| `pnpm dev:mock` | AIをモックにして同時起動(E2E・通常開発用) |
| `pnpm check` | typecheck + lint + unit test + build(品質ゲート) |
| `pnpm test:e2e` | PlaywrightのE2Eスモーク(モックAI) |
| `pnpm test:ai-live` | 実AI疎通テスト(明示実行のみ。自動実行禁止) |

## コーディング規約

- TypeScript strict。`any`の使用は原則禁止(やむを得ない場合は理由コメント)
- 外部入力(プレイヤー入力・AI出力・セーブデータ)は必ずzodでパースしてから使う
- ゲームロジック(戦闘計算・インベントリ・クエスト状態機械・ツール検証)は
  Phaser非依存の純TSモジュールとして`shared`または`server`に置き、ユニットテストを書く
- UIテキスト・AI応答・コメントは日本語。識別子は英語
- 乱数はシード可能な実装にし、テストでは固定シードを使う

## 品質ゲート(コミットの前提条件)

1. `pnpm check` が緑
2. M1以降: `pnpm test:e2e` が緑
3. 新しいゲームロジックにはユニットテストを付ける
4. コミットは小さく頻繁に。メッセージは `feat:` `fix:` `test:` `docs:` `chore:` プレフィックス+日本語要約

## 禁止事項

- `.env`・Auth token・APIキー・`saves/`・`logs/` をコミットしない
- `main` ブランチへの直接コミット・push禁止。作業は `codex/dev` で行う
- 品質ゲートを飛ばしたコミット禁止(赤のまま次のタスクへ進まない)
- `pnpm test:ai-live` をループや自動実行に組み込まない(サブスク枠の浪費防止)
- `docs/spec/ai-guardrails.md` の防御要件を弱める変更禁止
- ゲーム内AI(DreamMaster)にカスタムMCPツール以外のツール(ファイル・Bash等)を許可しない

## スタック時のルール

- 同じエラーへの修正試行が3回失敗したら、アプローチを変えるか、その箇所を
  プレースホルダー実装で前進させ、JOURNALに「既知の問題」として記録する
- ライブラリの使い方が不明な場合は公式ドキュメントを調査してよい
- 1タスクに2時間相当以上かかりそうなら、タスクを分割してROADMAP/JOURNALに反映する

## 実行環境の前提

- ゲームのAI呼び出しは `CLAUDE_CODE_OAUTH_TOKEN`(`.env`、gitignore済み)を使う
- `.env.example` に必要な環境変数の一覧を維持する
- 開発・E2Eでは実AIを呼ばない(モック使用)。実AI確認は人間が `pnpm test:ai-live` で行う
