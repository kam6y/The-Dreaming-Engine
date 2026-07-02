# AGENTS.md — The Dreaming Engine 開発憲法

このリポジトリは、ゲーム実行中に生成AI(Claude Agent SDK)を組み込んだ日本語ダークファンタジー2D RPG
「The Dreaming Engine」を、codexの長時間自律駆動で開発するプロジェクトである。
あなた(codex)はこのファイルの規約に**常に**従うこと。

## セッション開始時の手順(必須)

1. `docs/progress/JOURNAL.md` の末尾エントリを読み、前回の状態と申し送りを把握する
2. `docs/progress/ROADMAP.md` で現在のマイルストーンと未完了タスクを確認する
3. 作業対象に関係する `docs/spec/` 配下の仕様書を読む
4. `git status` と直近のコミットログで作業ツリーの状態を確認する
5. 未コミット変更が残っていた場合(前セッションの強制中断跡): `pnpm check`を実行し、
   緑なら内容を確認して小さくコミットする(JOURNALに「中断からの回収」として記録)。
   M0で`pnpm check`が未整備の間は、内容確認のみで回収可否を判断してよい。
   赤・内容を判断できない場合は`git stash -u`(未追跡ファイルも退避)で退避して
   JOURNALに記録し、直近エントリの「次にやること」から再開する
   (無確認での破棄(`git checkout .`等)は禁止)

## セッション終了時・各タスク完了時の義務(必須)

1. `pnpm check` が緑であることを確認してからコミットする
   (例外: `pnpm check`が未整備のM0初期は適用外。M0の最初のタスクとして整備する)
2. `docs/progress/ROADMAP.md` のチェックボックスを実態に合わせて更新する
3. `docs/progress/JOURNAL.md` に新しいエントリを追記する(フォーマットは同ファイル冒頭を参照)
4. 未完了・保留の事項は必ずJOURNALの「次にやること」に書き残す

## ドキュメントマップ

| ファイル | 内容 |
|---|---|
| `docs/spec/game-design.md` | ゲーム仕様(マップ・戦闘・NPC・クエスト・セーブ) |
| `docs/spec/world-lore.md` | 世界観・命名・NPC人物設定の正(ロア) |
| `docs/spec/ai-integration.md` | Agent SDK統合・DreamMaster・ツール定義 |
| `docs/spec/ai-guardrails.md` | ゲーム内AIの防御仕様・世界観憲法プロンプト |
| `docs/spec/asset-pipeline.md` | Image Genアセット生成の規約 |
| `docs/progress/ROADMAP.md` | マイルストーンと完了条件 |
| `docs/progress/JOURNAL.md` | セッション間の作業ログ(あなたの長期記憶) |
| `docs/progress/BACKLOG.md` | 縦切り完成後の拡張アイデア |

仕様と実装が食い違う場合は**仕様が正**。仕様自体を変えたい場合は、変更せずに
JOURNALへ「仕様変更提案」として理由付きで記録し、可能な範囲で仕様に沿って前進する。
例外: BACKLOG項目または仕様書自身が明示的に指示・許可している追記・更新
(例: `asset-pipeline.md`の共通接頭辞の確定反映、`ai-guardrails.md`の防御強化、
BACKLOG展開に伴う骨子追記)は、仕様変更提案なしで行ってよい(JOURNALに記録)。
禁止されるのは既存要件の変更・削除・弱体化である。
ただし仕様に書かれていない細部(定数・命名・ロア・演出)はあなたの裁量で決めてよい。
裁量で決めた事項はJOURNALに記録する。

## 技術スタック

- pnpm workspace モノレポ(Node.js 22+, TypeScript strict)
- `packages/shared` — zodスキーマ・型定義(client/server共有。ゲーム状態・WSメッセージ・ツール入出力)
- `packages/client` — Phaser 3 + Vite(ブラウザ側)
- `packages/server` — Fastify + WebSocket + `@anthropic-ai/claude-agent-sdk`
- テスト: Vitest(ユニット)、Playwright(E2E)。E2EはモックAIモードで走らせる。
  E2Eは**直列実行(workers=1)**とし、テスト毎にサーバー状態を初期化する
  (WS同時1接続の仕様と並列workerを競合させない)。セーブはテスト専用ディレクトリに
  切り替える(人間のプレイセーブを上書きしない: `game-design.md`「セーブ/ロード」)

## コマンド(M0で整備し、変更したらこの表を更新)

| コマンド | 内容 |
|---|---|
| `pnpm dev` | サーバー(:3000)とクライアント(:5173)を同時起動 |
| `pnpm dev:mock` | AIをモックにして同時起動(E2E・通常開発用) |
| `pnpm check` | typecheck + lint + unit test + build + シークレットスキャン(品質ゲート) |
| `pnpm test:e2e` | PlaywrightのE2Eスモーク(モックAI。数分以内に収める) |
| `pnpm test:e2e:full` | 通しプレイE2E(新規→エンディング。モックAI+テスト用加速設定。M6で整備し、節目のみ実行) |
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
2. M1以降: `pnpm test:e2e`(スモーク)が緑。E2Eは2層構成とする:
   コミット毎に走らせるのはスモークのみ(数分以内)。**通しプレイの
   `pnpm test:e2e:full`(M6で整備)はコミット毎ではなく、M6整備後の
   マイルストーン完了時と縦切り完成時に緑であること**(テスト用のゲーム進行加速は`ai-integration.md`
   「レート・コスト保護」の注記どおり許可)
3. 新しいゲームロジックにはユニットテストを付ける
4. コミットは小さく頻繁に。メッセージは `feat:` `fix:` `test:` `docs:` `chore:` プレフィックス+日本語要約
5. シークレット非混入: `pnpm check`に簡易シークレットスキャンを含める(M0で整備)。
   `sk-ant-`等の実キー形式(接頭辞+長い英数字列)へのgrepガードとし、仕様書中の
   接頭辞への言及は誤検知しないパターンにする。検出があればコミットしない。
   テストフィクスチャで必要なトークン様文字列(監査ログのマスク検証等)は
   文字列連結等で動的に組み立て、実キー形式のリテラルをソースに置かない
   (テストを通すためにスキャンを緩めることを禁ずる)

## 禁止事項

- `.env`系ファイル(`.env.example`を除く)・Auth token・APIキー・`saves/`・`logs/` をコミットしない
- `.env`の**値**を読まない・出力しない・ソース/ドキュメント/JOURNALへ転記しない
  (必要なのはキー名の有無のみ。設定手順の記述は`.env.example`とキー名で行う)
- `main` ブランチへの直接コミット・push禁止。作業は `codex/dev` で行う
- 品質ゲートを飛ばしたコミット禁止(赤のまま次のタスクへ進まない)
- `pnpm test:ai-live` をループや自動実行に組み込まない(サブスク枠の浪費防止)
- `docs/spec/ai-guardrails.md` の防御要件を弱める変更禁止
- ゲーム内AI(DreamMaster)にカスタムMCPツール以外のツール(ファイル・Bash等)を許可しない
  (SDKの`bypassPermissions`も使用禁止。機構は`ai-integration.md`「AIサンドボックス」)

## スタック時のルール

- 同じエラーへの修正試行が3回失敗したら、アプローチを変えるか、その箇所を
  プレースホルダー実装で前進させ、JOURNALに「既知の問題」として記録する
- ライブラリの使い方が不明な場合は公式ドキュメントを調査してよい
- 1タスクに2時間相当以上かかりそうなら、タスクを分割してROADMAP/JOURNALに反映する
- 完了条件に**人間にしか実行できない項目**(`pnpm test:ai-live`の実行、実プレイ確認等)が
  含まれる場合は、テストコード・手順の整備まで済ませた上でJOURNALに「人間確認待ち」として
  記録し、その項目の実行を待たずに先へ進む(自分で`test:ai-live`を実行してはならない)

## 実行環境の前提

- ゲームのAI呼び出しの認証は **`CLAUDE_CODE_OAUTH_TOKEN` を既定**とする
  (サブスクの`claude setup-token`で発行。`.env`、gitignore済み。オーナーの要望)。
  動作しない・レート制限が問題になる場合は`ANTHROPIC_API_KEY`へ切り替える
  (両方ある場合はOAuth優先)。環境変数1つの差し替えで切り替え可能な認証抽象を
  実装する(事実関係の注記・優先制御の詳細は`ai-integration.md`)
- `.env.example` に必要な環境変数の一覧を維持する
- 開発・E2Eでは実AIを呼ばない(モック使用)。`AI_MODE`は**未設定・不正値をmockとして扱う**
  (実AIは明示的な`AI_MODE=live`のみ。テスト実行下の`live`は起動時エラー、
  `pnpm test:ai-live`のみ例外: `ai-integration.md`)。実AI確認は人間が `pnpm test:ai-live` で行う
