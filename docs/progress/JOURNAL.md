# JOURNAL — セッション間作業ログ

このファイルはClaude Codeの**長期記憶**である。セッションやコンテキストが切れても、
末尾のエントリを読めば作業を再開できる状態を常に保つこと。

## 書き方

- 新しいエントリはファイル**末尾**に追記する(古いものが上)
- 1タスク完了ごと、またはセッション終了時に必ず書く
- 事実のみ簡潔に。長い考察は書かない

### エントリのフォーマット

```
## [通し番号] YYYY-MM-DD 作業タイトル

- やったこと: (箇条書き)
- 検証: pnpm check / test:e2e の結果、目視確認の内容
- 裁量で決めたこと: (仕様にない細部を決めた場合。なければ省略)
- 既知の問題: (あれば。なければ省略)
- 仕様変更提案: (あれば理由付きで。なければ省略)
- 次にやること: (具体的に。次のセッションはここから始める)
```

---

## [0] 2026-07-02 プロジェクト初期化(Claude Codeによる仕様策定)

- やったこと:
  - 要件定義・設計を完了し、`docs/spec/` 配下に仕様書5点(`world-lore.md`含む)を作成
  - `AGENTS.md`(開発憲法)、`ROADMAP.md`、`BACKLOG.md`、codex駆動用プロンプト2点を作成
- 検証: ドキュメントのみ。コードはまだ存在しない
- 既知の問題: なし
- 次にやること: ROADMAP M0(環境構築)を最初から。pnpm workspaceの雛形作成から始める

## [1] 2026-07-03 M0環境構築

- やったこと:
  - pnpm workspaceモノレポを作成し、`packages/shared` / `packages/client` / `packages/server` を整備
  - TypeScript strict、ESLint、Vitest、Playwright、`pnpm check`、シークレットスキャンを追加
  - Phaserの黒背景タイトル画面と、Fastify + WebSocketのping/pong疎通を実装
  - Viteを`127.0.0.1`限定・`.env*`/`saves/`/`logs/`配信拒否に設定
  - サーバーを`127.0.0.1`固定bind、HTTP/WS Origin許可リスト検証、WS同時1接続置換に対応
  - `.env.example`、`.gitignore`、READMEのセットアップ手順、E2Eタイトルスモークを整備
- 検証:
  - `pnpm check` 緑
  - `pnpm test:e2e` 緑(ローカルlistenが必要なため権限昇格で実行)
- 裁量で決めたこと:
  - npm registryで確認した2026-07-03時点のlatest安定版を固定指定した(Vite 8.1.3、Phaser 4.2.0、Fastify 5.9.0、Playwright 1.61.1、TypeScript 6.0.3等)
  - `tsx`がこの実行環境でIPC pipe権限に失敗するため、serverのdevは`tsc` build後に`node dist/index.js`で起動する方式にした
  - Vite準備完了よりserver listenが遅れる瞬間に備え、クライアントWSは500ms間隔で再接続する
- 既知の問題: なし
- 次にやること: ROADMAP M1(マップと移動)へ進み、まずグリッドベースのタイルマップ描画とプレイヤー移動の純TSデータ定義から始める

## [2] 2026-07-03 開発主体をcodexからClaude Codeへ移行

- やったこと:
  - ドキュメント一式をClaude Code前提に書き換え(開発憲法を`AGENTS.md`→`CLAUDE.md`へ改名。
    `AGENTS.md`はcodex向けの画像生成専用の注意書きに差し替え)
  - 作業ブランチを`codex/dev`→`claude/dev`に改名(全ドキュメントの参照も更新)
  - `asset-pipeline.md`を「codex(Image Gen)への委譲」前提に再構成
    (生成=codex、検収・組み込み・コミット=Claude Code)
  - M5用画像アセット一式の生成をcodexへ委譲(納品先は`assets/`配下。
    納品後にClaude Codeが検収する)
- 検証: `pnpm check` 緑(ドキュメント変更のみ)
- 既知の問題: なし
- 次にやること: ROADMAP M1(マップと移動)へ進む(前エントリと同じ)。
  M5到達時に`assets/`のcodex納品物を検収してから組み込みを行う

## [3] 2026-07-03 codexによる画像アセット納品と検収

- やったこと:
  - codexへの委譲でM5用画像アセット26点を生成・納品(バッチ分割で実施):
    タイトル背景1 / 立ち絵5(主人公+NPC4、透過) / 敵5(雑魚3+ボス2形態、透過) /
    背景13(街・フィールド・ダンジョン・戦闘2種・屋内4種・OP2・ED2) / UI装飾2(枠・カーソル、透過)
  - 会話用屋内背景4点(宿屋・商店・酒場・教会)を人間の指示で生成対象に追加し、
    `asset-pipeline.md`の生成対象一覧に反映
  - `assets/manifest.json`(26件)と`assets/prompts/`(26件)を整備
  - 検収: manifest全エントリのpath/promptFile実在・全PNGの網羅を機械検証しPASS。
    `assets/`外への変更がないことを確認
- 検証: `pnpm check` 緑。manifest検証スクリプトPASS(26/26)
- 既知の問題:
  - 初回委譲セッションの中断により`title-background`と`player`の生成プロンプト原文が
    逸失(プロンプトファイルに注記済み。再生成時に更新する)
  - 画像の見た目の最終確認(トーン・品質)は人間の目視待ち(「人間確認待ち」)
- 次にやること: ROADMAP M1(マップと移動)へ進む。M5到達時は納品済みアセットの
  組み込み(会話立ち絵表示・戦闘背景+敵グラフィック・タイトル画面)から始める
