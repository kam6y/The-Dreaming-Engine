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

## [4] 2026-07-03 人間レビューを受けたアセット2点の再生成(codex再委譲)

- やったこと:
  - `dream-eater-phase2.png` を再生成: 「第1形態と大差がなくラスボス感が足りない」との
    人間フィードバックを受け、ロアの範囲内でエスカレーションを強化
    (そびえ立つシルエット・中央の縦の大裂け目・琥珀の炉光の明確な増加・靄の剥落)
  - `cursor.png` を再生成: 「完全な真横向き」を、通常のマウスポインタ風の
    先端左上・約20度傾きに修正
  - 両点の `assets/prompts/*.md` に試行メモを追記、manifestの該当エントリを更新
- 検証: `pnpm check` 緑。画像は目視で第1形態との差別化・カーソルの向きを確認
- 既知の問題: なし
- 次にやること: ROADMAP M1(マップと移動)へ進む(前エントリと同じ)

## [5] 2026-07-03 ボス第2形態の再々生成(3回目の試行)

- やったこと:
  - `dream-eater-phase2.png` を再々生成: 2回目は「原型が無さすぎる」との人間フィードバック
    (対称な祭壇状になり第1形態のボディプランが消えた)。3回目は第1形態の構図・
    シルエット(うずくまった非対称の歯車巨躯・中央の割れた巨大歯車の位置)を保ったまま、
    靄の剥落・大裂け目・琥珀の炉光増加の差分のみエスカレーションさせた
  - `prompts/dream-eater-phase2.md` に3試行の経緯(似すぎ→離れすぎ→中間)を記録
- 検証: `pnpm check` 緑。目視で「同一個体の変化」と「明確な形態差」の両立を確認
- 既知の問題: なし
- 次にやること: ROADMAP M1(マップと移動)へ進む(前エントリと同じ)

## [6] 2026-07-04 M1完了: マップと移動(オーケストレーター+subagent体制)

- やったこと:
  - 体制: オーケストレーター(Claude Code)がUI実装と検収を担当し、ロジック・テストはopus subagentへ委譲する運用を開始
  - shared(subagent実装): マップのzodスキーマ(`map.ts`)、方向・座標(`geometry.ts`)、
    NPC/敵ID(`ids.ts`)、マップ5枚(`maps/`: 灯町22x15・忘れ野24x16・裂け目1〜3層)、
    移動/衝突/遷移/インタラクションの純ロジック、ユニットテスト37件(接続性BFS担保含む)
  - client(オーケストレーター実装): タイトル→新規ゲーム→探索の導線、探索シーン
    (プレースホルダータイル描画・WASD/矢印グリッド移動・カメラ・マップ遷移・
    スペースキーのインタラクション+会話ウィンドウ)、E2E用のDOM状態同期(`#game`のdata属性)
  - E2E(subagent実装): 移動スモーク(新規ゲーム→街→忘れ野→裂け目1〜3層到達、約14秒)
  - 人間フィードバック対応: キャンバスの全画面化(Phaser RESIZE)、マップ全体の
    containフィット+中央寄せ(見切れ解消)、ヘッダーの中央寄せ・拡大・オーバーレイ化
- 検証: `pnpm check` 緑(ユニット46件)。`pnpm test:e2e` 緑(2件)。
  ブラウザ実操作でも移動・遷移・会話・衝突・ダイアログ中の入力ブロックを確認
- 裁量で決めたこと:
  - NpcId=`innkeeper/merchant/informant/priest`、EnemyId=アセットmanifestのIDと一致
    (`mist-wolf/candle-eater/creaking-doll/dream-eater`)。M4以降もこの契約を継承する
  - タイル種別5種(`floor/wall/water/road/grass`)。衝突は種別から一意導出(wall/waterがsolid)
  - NPC・オブジェクト・ボスは占有マス(通行不可)。`interactionTarget`は第3種`boss`も返す(M2の戦闘開始に使用予定)
  - 層別敵種: 1層=蝋燭喰らい、2層=蝋燭喰らい+軋み人形、3層=軋み人形
  - 1マス移動の補間140ms。マップ表示はcontain方式(全体が常に画面内、余白はアスペクト差分のみ)
  - 全マップの背骨道はx=11列で南北貫通(E2Eの経路もこれを利用)
- 既知の問題:
  - 開発中に一度だけプレイヤーの自走(入力なし移動)を観測。クリーンなロードでは再現せず、
    Vite再読み込みを跨いだキー押下状態の残留と推定。防御として探索シーン生成時に
    `keyboard.resetKeys()`を導入済み。E2Eでは未発生。再発したら要調査
  - クリーンチェックアウト直後(`dist`未生成)は`pnpm check`のtypecheckがsharedの
    解決に失敗しうる(checkはtypecheck→buildの順のため)。現環境では問題なし。
    対処するならcheckでsharedを先にビルドする(コマンド表の変更を伴うため保留)
- 次にやること: ROADMAP M2(ターン制戦闘)。戦闘計算エンジン(純TS+ユニットテスト)を
  subagentへ委譲し、戦闘シーンUIはオーケストレーターが実装する。敵定義データ・
  シンボルエンカウントも含む

## [7] 2026-07-04 M2完了: ターン制戦闘

- やったこと:
  - shared(subagent実装): シード可能PRNG(mulberry32)、戦闘エンジン(イベント駆動・不変更新・
    `rngState`内包で完全再現可能)、敵4種定義(霧狼/蝋燭喰らい/軋み人形/夢喰い2形態)、
    決定論的行動ローテーション、毒(最大HP5%/3R)、レベル1-10成長・XPテーブル、報酬・ドロップ、
    全滅処理`applyPartyWipe`、敵シンボル配置サンプラー、テスト53件
  - client(オーケストレーター実装): 戦闘シーンUI(4コマンド+スキル/どうぐサブメニュー・
    HP/MPゲージ・イベント逐次表示・スペース送り)、敵シンボル描画+接触エンカウント、
    勝利で除去/逃走で残存/再入場リスポーン、全滅→ゴールド半減→灯宿前で目覚めるフロー、
    クライアント側ラン状態(RunState)、UI部品(MenuList/GaugeBar)
  - E2E(subagent実装): 戦闘スモーク(seed=42でエンカウント→たたかう連打で勝利→探索復帰・
    シンボル減少を検証。座標はsharedのRNG+サンプラー再現とBFSで導出しハードコード回避)
  - ブラウザ実操作検証で発見・修正: プレイヤーパネルとメッセージ窓の重なり/
    敵の先手で倒れた際にどうぐが不当消費される問題(item-usedイベント発生時のみ消費に修正)
- 検証: `pnpm check`緑(ユニット96件)。`pnpm test:e2e`緑(3件・約49秒)。
  ブラウザで攻撃・スキル・どうぐ・にげる・勝利・全滅の全フローを実操作確認
- 裁量で決めたこと:
  - バランス数値(実測: Lv1雑魚3-4T必勝/Lv4以下ボス全滅率100%/Lv6勝率100%、300シード)
  - スキル名「焔の一閃」(MP4・×1.8)「安らぎの灯」(MP5・HP45)。ゲーム内スキル名につき
    world-lore用語集追記は不要と判断
  - アイテム3種を先行定義(回復薬小/中・解毒薬)。所持数管理はM3
  - 初期ゴールド30G・初期所持品=回復薬(小)×2(店実装までの緩衝)
  - レベルアップ時は成長分のみHP/MP回復(全回復しない)。超過XPは繰り越し
  - 不正コマンド(MP不足等)はターン消費なしで再入力
  - M2ではボスマーカーとの戦闘トリガーは未配線(メインクエスト進行と合わせてM6で配線。
    敵定義・2形態・撃破はエンジンレベルでテスト済み)
  - テスト用URLフラグ `?seed=N`(エンカウントRNG固定)と`?noSymbols=1`(シンボル無効。
    移動スモークの安定化用)を導入
  - E2E specはsharedを`packages/shared/dist`経由でimport(ルートにworkspace依存を足さない選択。
    distは`pnpm check`のbuildで常に生成される前提)
- 既知の問題: なし
- 次にやること: ROADMAP M3(インベントリ・店・セーブ)。インベントリ/店ロジック(純TS)を
  subagentへ委譲し、店・インベントリUI・タイトル「つづきから」はオーケストレーターが実装。
  セーブはサーバー正本(GameState移行)+`saves/`原子的書き込み。ラン状態のサーバー移行を含む

## [8] 2026-07-04 M3完了: インベントリ・店・セーブ(サーバー正本移行の完成)

- やったこと:
  - 中断からの回収: 前セッションのM3先行コミット3件(513d86e サーバー正本化 /
    83a9a45 タイトルメニュー化 / a9f527e GameClientネット層)がJOURNAL未記載のまま
    残っていた(作業ツリーはクリーン)。内容を確認して本エントリで記録し、続きから再開
  - client(オーケストレーター実装): サーバー正本への全面移行。main.tsをGameClientへ
    差し替え、タイトル(helloで「つづきから」有効化・上書き確認・new-game/continue送信)、
    探索(move/interact送信+snapshot駆動描画・宿のConfirmDialogからrest=セーブ)、
    戦闘(battle-command送信+battle-eventsの逐次表示)。旧クライアントRunStateを撤去
  - client(オーケストレーター実装): ShopOverlay(買う/売る/やめる・所持金/所持数表示・
    拒否メッセージの通知行)、InventoryOverlay(Escで開閉・使う/すてる・上限表示・
    クエスト品別枠)、MenuListのカーソル維持(initialIndex/currentIndex)、
    日本語折返し(useAdvancedWrap)、タイトルuiLayerの深度修正
  - E2E(subagent実装): save-load.spec(新規→宿泊セーブ→リロード→つづきから→復元検証+
    セーブファイルの隔離ディレクトリへの実在確認)、webServerへのSAVE_DIR注入
    (test-results/e2e-saves 絶対パス)、globalSetupでの実行開始時クリーンアップ
  - ブラウザ実操作で全フロー検証: 購入(30G→10G)・金不足拒否・売却(+10G)・HP満タン時の
    使用拒否・破棄・宿泊セーブ(day2/10G)・リロード→つづきから完全復元・新規ゲーム上書き確認
- 検証: `pnpm check` 緑(ユニット195件)。`pnpm test:e2e` 緑(4件・約1.3分、
  subagent側でも2回連続緑)。ブラウザ実操作(上記)
- 裁量で決めたこと:
  - 店の売買・アイテム使用/破棄は1個ずつ(数量指定UIなし。M3の最小実装)
  - Escは「もちもの」オーバーレイの開閉に割当(仕様「Esc=メニュー」の最小実装)
  - dialogメッセージはグローバルキューで管理し探索シーンが順次表示
    (戦闘中に届く全滅・戦利品あふれの文言も探索復帰後に表示される)
  - E2E用DOM data属性に day/gold/level/hp を追加(セーブ/ロード検証用)
  - ゲーム内から「タイトルへ戻る」手段は未実装のため、セーブ/ロードE2Eはページ
    リロードでタイトルへ戻る(タイトル復帰メニューはM6のエンディング導線で検討)
  - E2EのSAVE_DIRは`test-results/e2e-saves`(gitignore済み領域・絶対パスで注入)
- 既知の問題:
  - PhaserのKeyboardPluginはキー入力をフレーム単位で処理するため、同一フレームに
    2キーが入る速度(例: ArrowDown→Enterを無遅延送出)ではメニューのカーソル移動が
    決定に反映されない。人間の操作速度では実害なし。E2Eはキー間に250ms挟んで回避
  - E2Eスイートは直列・アルファベット順+globalSetup1回/実行に依存。save-loadより
    後ろにソートされる「新規ゲーム前提」のspecを追加すると上書き確認で詰まる
    (追加時はセーブ削除を先頭に入れること)
  - 前セッションの残存devサーバー(古いdistの:3000)をPlaywrightがreuseし、E2Eが
    誤って赤になった。残存プロセスを停止して解決。E2Eが不可解に赤いときは
    ポート3000/5173の残存プロセスを疑うこと
- 次にやること: ROADMAP M4(AI統合・DreamMaster)。着手前に`@anthropic-ai/claude-agent-sdk`の
  最新ドキュメントを必ず確認する。`ai-integration.md`と`ai-guardrails.md`を精読し、
  ツール検証層(純TS+ユニットテスト)・DreamMaster/MockDreamMasterをsubagentへ委譲、
  会話UI(自由入力+選択肢・疑似ストリーミング)とクエストジャーナルUIはオーケストレーターが実装

## [9] 2026-07-04 M4着手: AI基盤・純ロジックエンジン・6ツール検証層(M4-A/M4-B完了)

- やったこと(M4はA〜Gに分割。本エントリはA・Bと会話UI部品の先行分):
  - M4-A(subagent実装・コミット8ecafdb): AI基盤。贈答/hunt/fetch/street-eventの
    ホワイトリスト列挙(`shared/src/ai/`)、config(`server/config/ai.json`+loader)、
    AI_MODEフェイルセーフ(`mode.ts`: 非liveは全てmock/テスト下のliveは起動時エラー)、
    機密マスク・監査ログ・入力壁・出力壁(`checkDisplayText`)・レートリミッタ(テスト59件)
  - 会話UI部品の先行実装(オーケストレーター・コミット8b2f363): TypewriterText
    (検証済み全文の疑似ストリーミング)、TextInputBox(IME対応の自由入力。maxLength200・
    Phaserキーボード停止でスペース/矢印を入力欄へ)。M4-Fで会話UIに組み込む
  - M4-B前半(subagent実装・コミット4651064): 純ロジックエンジン。クエスト
    (`quests.ts`: メインクエスト段階enum+サブクエスト状態機械・提案/受諾/hunt進行/
    報告=納品→報酬・満杯時保留・放棄)、NPC状態(`npc.ts`: 好感度0-100初期30・会話記憶・
    今日の話題)、世界イベント(`ai/world-event.ts`: WorldEvent判別union・敵シンボル数の
    絶対クランプ・初期値=レンジ中央値)、GameState拡張(npcs/mainQuestStage/subQuests/
    world/narratedEnemies/aiDaily。全て`.default()`でversion1のまま後方互換)。テスト36件
  - M4-B後半(subagent実装・コミット1fc0bd3): ゲーム内AI6ツール検証層
    (`server/src/ai/tool-validation/`)。純関数`(input,context)=>Result`でスキーマ検証→
    ゲームルール検証、承認済みeffectのみ返す。フロー許可集合の二重チェック
    (`validateToolCall`=guardrails第1層)、speak/narrate/adjust_affinity/give_item/
    propose_quest/trigger_world_event(単一+夢の最大3件・解決規則)。テスト55件
- 検証: `pnpm check` 緑(ユニット347件・25→27ファイル・build・シークレットスキャン)
- 裁量で決めたこと:
  - 検証層の状態分離: 永続=GameState由来(aiDaily/affinity/inventory/subQuests/
    dungeonSymbolCounts)、揮発=会話セッション(partnerNpcId/affinityAtOpen/
    会話内adjust回数/give回数/pendingProposal)。揮発は型定義のみでtool-validation内に置き、
    セッションマネージャは構築しない(M4-Cの責務)
  - give_itemの好感度50ゲートは会話開始時点`affinityAtOpen`のみ参照(会話中の
    adjust_affinity上昇では解禁しない: 仕様明記)。名前付きテストで担保
  - reportedクエストは`subQuests`から除去(`.max(3)`超過回避)。`"reported"`は戻り値/
    UI用シグナルのみで永続化しない。除去は`removeQuestFromList`
  - 敵シンボル数の初期値=各層レンジの中央値(2-6→4)。最大/最小初期化だと±1シフトが
    片方向で恒久クランプ無効化されるため双方向に効き代を残す
  - initial好感度=30、advanceDayはactiveStreetEventsクリア+aiDailyゼロ+topicデフォルト戻し、
    weather/dungeonSymbolCounts/affinity/memoryは持続
- 既知の問題:
  - M4-BのsubagentディスパッチがAPIエラー(Fable5上限/Response stalled mid-stream)で
    3回連続失敗。うち1回はadvisor呼び出し(大コンテキスト転送)直前で停止。対処:
    タスクをshared半分/検証層半分の2ディスパッチへ分割し、model:opus明示+advisor禁止
    +範囲縮小で両方成功。以後の重いsubagentタスクは分割+advisor禁止を既定とする
  - `packages/server/test/`はサーバーtsconfig(src/**のみ)対象外でtsc型検査を受けない
    (eslint+vitestで担保。M4-Aと同じ既存慣習)
- 次にやること: M4-C(DreamMaster+MockDreamMaster+フロー制御=直列化・クールダウン・
  縮退・セッション上限)をsubagentへ委譲。着手前に`@anthropic-ai/claude-agent-sdk`の
  最新ドキュメントを確認(M4-DのLive実装で使用)。ROADMAP M4の「ツール検証層」boxは
  クールダウン(M4-C)完了まで未チェックのまま

## [10] 2026-07-04 M4-C完了: DreamMaster抽象・Mock・フロー制御(縮退/上限/クールダウン)

- やったこと(すべてsubagent実装。C1→C2の順で3コミット):
  - C1(コミットd7c9a98): DreamMaster抽象IF(`server/src/ai/dream-master/`)。単一
    `run(context,options)`→`{ok:true,flow,toolCalls:RawToolCall[],text,meta}` または
    `{ok:false,failure:'timeout_first'|'timeout_total'|'api_error'}`。検証・適用はしない
    (生の意図を返すだけ)。`createDreamMaster(mode,config)`ファクトリ、Liveはプレースホルダ。
    MockDreamMaster(通常/悪意モード・決定論・夢は必ずnarrate+weather:fog)。テスト19件
  - C2コミット1(76517af): 会話セッション管理(affinityAtOpenスナップショット・会話内
    カウンタ・pendingProposal)+ AIターン実行器(DreamMaster→validateToolCall→
    表示系0件でオールオアナッシング破棄+定型フォールバック+失敗計上、タイムアウト/
    APIエラーのみ1回リトライ)+ 縮退状態機械 + セッション総数上限。テスト15件
  - C2コミット2(c825d53): ゲートキーパー(直列化=同時1件・実行中拒否、クールダウン=
    会話10秒/夢60秒/クエスト30秒、送信レート3秒・同一内容拒否)+ 監査境界イベント配線
    + 縮退解除(onDayAdvanced)。定型フォールバック文は`shared/src/ai/fallback.ts`。テスト11件
- 検証: `pnpm check` 緑(ユニット392件・build・シークレットスキャン)。全コミット個別緑
- 裁量で決めたこと:
  - サービスはGameStateを変更せず・WS/セーブに触れず、検証済みeffectと表示テキスト
    (または定型)を返すだけ。保護状態(クールダウン時刻・実行中・縮退・セッション数)は
    ランタイム保持でセーブ非対象(縮退はセーブに載せない仕様に忠実)
  - 縮退フラグを2分離: `normalDegraded`(3連続失敗・日送りで解除)と
    `sessionLimitDegraded`(総数上限・日送りで解除しない)。連続失敗カウントはフロー別
    (仕様「同一フローで3回連続」に忠実)、発動/解除時に0化
  - 時刻・乱数は全注入(Date.now直呼びなし)、設定値は全てconfig由来でテスト差し替え可能。
    ハードコードは仕様固定の「3連続」閾値のみ
  - 会話要約の出力壁上限`SUMMARY_MAX_LENGTH=200`をnpc.tsに追加
- 既知の問題:
  - 重いsubagentタスク(C2=234kトークン)でもmodel:opus明示+advisor禁止+2コミット
    チェックポイント方式で安定完走。M4-B/Cを通じ本方式を確立
  - `packages/server/test/`はtsc対象外(eslint+vitestで担保。既存慣習)
- 次にやること: M4-D(LiveDreamMaster=Agent SDK統合+test:ai-live整備)。SDK未導入
  (`pnpm add @anthropic-ai/claude-agent-sdk`が必要)。オーケストレーターがcontext7で
  SDK最新APIを確認済み(下記)。M4-Dのセキュリティ姿勢:
  settingSources省略/[](CLAUDE.md・FS設定を読まない)、systemPromptは世界観憲法の文字列
  (claude_codeプリセット不使用)、tools未指定、mcpServersは自作dream-toolsのみ、
  allowedToolsは現在フローのカスタムツールのみ、disallowedToolsで組み込み明示遮断、
  canUseToolでデフォルト拒否(権威的二重チェック)、permissionMode:'default'・
  allowDangerouslySkipPermissions:false(bypassPermissions禁止)。認証はenvでサブプロセスへ
  渡す変数を制御しOAuth優先(CLAUDE_CODE_OAUTH_TOKEN既定・ANTHROPIC_API_KEYフォールバック)

## [11] 2026-07-04 M4-D完了: LiveDreamMaster(Agent SDK統合)+認証抽象+test:ai-live整備

- やったこと(subagent実装。2コミット):
  - コミットe6fe6af: `@anthropic-ai/claude-agent-sdk@0.3.200` をserverへ追加。LiveDreamMaster
    (`dream-master/live.ts`)がDreamMaster IFを実装。フロー別に `query()` を呼び、6ツールを
    `createSdkMcpServer`+`tool()`で登録(ハンドラは生intentを記録して無害ackを返すだけ=
    検証・適用はしない)。認証抽象(`auth.ts`): キー名の有無のみ判定・値は読まない、
    OAuth優先、非採用資格情報をenvから削除して優先制御(env1つで切替)。世界観憲法
    プロンプト(`constitution.ts`/`prompt.ts`)。テスト34件(auth 8+live 26)
  - コミット48aeb56: `pnpm test:ai-live`(`AI_LIVE_TEST=1 AI_MODE=live` を付与し専用
    `vitest.ai-live.config.ts` で `*.ailive.ts` のみ実行)。挨拶1回の最小疎通テスト。
    `describe.runIf` で実キー存在時のみ実行・未達はskip。通常 `pnpm check` からは除外
- 検証: `pnpm check`(mock)緑(ユニット426件・build・シークレットスキャン)。防御姿勢を
  オーケストレーターが直接確認: `settingSources:[]`・`strictMcpConfig:true`・`canUseTool`
  デフォルト拒否(許可集合内のカスタムツールのみallow、組み込み/クロスフロー/未知は全deny)・
  `disallowedTools`組み込み遮断・`permissionMode:'default'`・bypass系不使用・`persistSession:false`
- 裁量で決めたこと:
  - 出力トークン上限はSDK Optionsに直接の口が無いため、`maxTurns`+出力壁(表示テキスト
    長さ上限)で有界化。config `maxOutputTokens` はFlowSpecに残置(将来SDKが口を持てば渡す)
  - プロンプトは常に単発文字列。会話履歴は毎回スナップショットから `<conversation>` タグで
    注入しSDKセッション再開に依存しない(全可変テキストは `neutralizeTags` でタグ無害化=第3層)
  - 追加ハードニング(guardrailsが許容する強化のみ): strictMcpConfig/persistSession/
    組み込み遮断リスト網羅。防御要件の弱体化はなし
  - DreamMasterContext(C1)は最小構成。好感度/受注クエスト等の完全スナップショット注入は
    M4-EでIF拡張時に充実(`prompt.ts`は前方互換)
- 人間確認待ち: **`pnpm test:ai-live` の実行**(実AI疎通)。テストコード・スクリプト・
  手順は整備済み(実行はオーナーが `.env` に `CLAUDE_CODE_OAUTH_TOKEN` 設定後 `pnpm test:ai-live`)。
  CLAUDE.md規約によりClaude Codeは実行しない。この項目を待たずに先へ進む
- 既知の問題: なし(SDKの出力トークン上限の件は上記のとおり有界化で対応)
- 次にやること: M4-E(サーバー統合=WS会話/クエスト/夢/戦果フローの配線+セーブ拡張+
  DreamMasterContextの充実)をsubagentへ委譲。会話UI等(M4-F)はM4-EのWS protocol確定後に
  オーケストレーターが実装。ROADMAP M4のツール検証層boxはM4-C完了済みなのでチェック可

## [12] 2026-07-04 M4-E完了: AIフローのGameSession配線+WS protocol拡張+セーブ拡張

- やったこと(subagent実装。2コミット):
  - コミット363fa8c(土台): effect適用リデューサー `game/ai-effects.ts`
    (`applyStateChangeEffect`。**aiDailyカウンタ書き戻しの核心**)、DreamMasterContext充実
    (types/prompt/gatekeeper)、WS protocol拡張(messages.ts)、セーブ時マスク
    `game/conversation-memory.ts`(既存 `secret-mask.js` を再利用)。テスト10件
  - コミット50dc550(配線): `GameSession.handle()` に会話/クエスト/夢/戦果フローを接続。
    `GameSessionDeps` にゲートキーパー(任意注入・不在ならM3互換フォールバック)、
    `createDefaultSession` が実物を組む。統合テスト12件
- 検証: `pnpm check` 緑(ユニット448件)。`pnpm test:e2e` 4/4緑
  (戦闘勝利が戦果ナレーション経路を、save-loadが夢フローを通過)
- **カウンタ書き戻しループの閉じ方**(advisor指摘の要点):
  - 永続(GameState.aiDaily)=`applyStateChangeEffect` で give→giveItemCount++/
    adjust→affinityDeltaByNpc[npc]+=delta/propose→proposeQuestCount++(+rewardItem付きは
    rewardItemProposalCount++)。GameSession経由の `give_item×3→4回目拒否` テストで実証
  - 会話内(ConversationSession)=turn-executor が承認時に記録。`adjust×2→3回目拒否` で実証
- WS protocol(M4-F契約):
  - client→server: `conversation-send{text}`(sanitize/長さはサーバー強制)・
    `conversation-choose{choice:accept|decline}`・`conversation-end`・`quest-request`。
    会話開始は既存 `interact` を流用
  - server→client: `ai-utterance{channel:speak|narrate, npcId?, text}`
    (探索dialogとは別チャンネル。TypewriterTextが検証済み全文を疑似ストリーミング)。
    GameClientが `ai-utterance` イベントを発火
  - `ActiveInteraction` に `conversation` 種別追加(npcId/npcName/options/pendingProposal)。
    `SnapshotView.subQuests`(クエストジャーナル用・常に配列)追加
- 裁量/**仕様との差異(要検討)**:
  - **会話対応NPC=情報屋(informant)+司祭(priest)のみ**。宿屋主人(innkeeper)は inn(宿泊)、
    商人(merchant)は shop を維持(ロックしたprotocolに会話内での宿泊/購入アクションが無いため)。
    仕様のNPC好感度/DEFAULT_NPC_TOPICSは4人全員を想定しており厳密には差異。ただし縦切りの
    クリティカルパス(主筋=司祭会話・サブクエ=情報屋会話・夢=宿泊・買物=商人)は全て機能し、
    give_item/adjust_affinityも情報屋・司祭で行える。**M6/BACKLOGで商人・宿屋への会話併設を検討**
  - 宿泊の順序厳守=徴収→回復→advanceDay→onDayAdvanced(縮退解除)→dreamScene→世界変化適用→
    セーブ。**AI失敗(タイムアウト/表示系0件/悪意)でもセーブ成立・日付前進**(悪意Mockテストで実証)。
    宿泊費不足の無料就寝はAI夢をスキップし定型文(コスト保護)
  - クエストid=`pq-<n>` 単調増加(ロード時に既存id超へ再同期)
- 既知の問題:
  - `secret-mask.ts` はファイル名の "secret" によりreadがhookでブロックされる環境。subagentは
    `audit-log.ts` の使用例と仕様から署名を推定して import(再実装せず既存を再利用)。マスク動作は
    テストで確認(偽キーは文字列連結で構築しシークレットスキャンを汚さない)
- 次にやること: **M4-F(会話UI・クエストジャーナルUI・夢シーン演出)をオーケストレーターが実装**。
  ConversationOverlay(TypewriterText+TextInputBox+MenuListで発話/自由入力/提案受諾)、
  QuestJournalOverlay(subQuests一覧)、夢シーン演出(rest時のnarrate ai-utterance)。
  game-client.ts に ai-utterance ハンドラ、exploration-scene に conversation overlay を配線

## [13] 2026-07-04 M4-F完了: 会話UI・クエストジャーナル・夢シーン演出(オーケストレーター実装+ブラウザ検証)

- やったこと(オーケストレーターが実装。3コミット):
  - 17797d3: ConversationOverlay(情報屋・司祭。NPC発話をTypewriter疑似ストリーミング・
    自由入力=TextInputBox・提案の受諾/辞退・仕事依頼・立ち去る)。exploration-sceneに
    ai-utterance購読・conversation interactionでoverlay開閉・**speakのstash(到着順非依存)**・
    全ガード条件にconversationOverlay追加。battle-sceneは戦果narrateをバッファし勝利メッセージ
    送り完了時に表示してから探索復帰(snapshotで遷移せず・再戦雑魚はnarrate待ちしない)
  - a0b6ead: DreamOverlay(宿泊後の夢を暗幕+TypewriterTextで演出。おやすみダイアログ後に
    開き、スペースで目覚めて翌朝へ。narrateをstashし先行ダイアログ待ちで開く)。
    QuestJournalOverlay(受注中subQuests一覧。Qで開閉・Escで閉じる)
  - 09965dd: ブラウザ検証で発見した会話UIの2バグ修正(下記)
- 検証: `pnpm check` 緑(ユニット448件)・`pnpm test:e2e` 4/4緑。**Playwrightでブラウザ実操作
  検証**: 新規→情報屋に話しかけ(挨拶Typewriter)→自由入力送信→応答→仕事依頼→提案→受諾確認
  「恩に着るよ」がoverlay内表示→クエストジャーナルQに「霧狼の間引き 0/3」表示→宿屋で宿泊
  (10G徴収・HP全回復・2日目)→おやすみ→夢シーン演出(「霧が濃い…あなたの名を呼んだ気がした」)
  →目を覚まして探索復帰、を通しで確認
- 裁量で決めたこと:
  - AIテキストの表示面: 会話=ConversationOverlay内Typewriter、夢=DreamOverlay(全画面暗幕+
    Typewriter)、戦果=戦闘メッセージ窓に平テキスト。会話・夢はTypewriter疑似ストリーミング、
    戦果は戦闘UIの平テキスト様式に合わせた(いずれも検証済み全文・プレーンテキスト=第4層準拠)
  - utteranceタイミング機構(advisor指摘): シーンごとに1スロットstashし、overlay生成前に
    届いたspeakを流し込む(サーバーはsnapshot→utterance順だが到着順に非依存化)。夢narrateも
    stashして宿屋のおやすみダイアログ表示後にupdate()で開く(pendingInnと同じ先行ダイアログ待ち)
  - クエストジャーナルはQで開閉・Escで閉じる読み取り専用テキストパネル。会話overlayのガードは
    shopOverlay参照箇所すべてに一対一で追加(movement/dialog-queue/interact/escape/shutdown)
- 既知の問題/ブラウザ検証で発見・修正した2バグ(09965dd):
  1. 提案応答後にアクションメニューが消える: `setAwaiting`がメニュー破棄→応答到着時の`refresh`は
     `awaiting`中で再構築スキップ→受諾/辞退が出ない。`playUtterance`で応答到着時に再構築して解決
  2. 受諾/辞退の確認台詞(サーバーは定型を`dialog`で送る)が会話中は保留され会話後に浮いて
     クエストジャーナル(Q)をブロック。会話中のNPC台詞(speaker非null)は会話overlayの発話として
     流す(保留しない)よう修正。dream/journal中のダイアログは従来どおり保留
  - **戦果narrate(narrate表示)はブラウザ手動未検証**(戦闘E2Eは緑=narrate追加で戦闘フローは壊れない
    ことを確認済み)。M4-GのE2Eスモークで「初見戦闘勝利時にnarrateが戦闘中に表示される」を機械検証する
- 次にやること: M4-G(攻撃テストA=マニフェスト照合メタテスト+ゲーム内AIから組み込みツールが
  呼べないことの機械検証+悪意Mock応答の検証層却下+E2Eスモーク3種=会話/クエスト受注/夢シーン、
  戦果narrate表示のアサーション含む)をsubagentへ委譲

## [14] 2026-07-04 M4完了: 攻撃テストA(テストIDマニフェスト照合含む)+E2Eスモーク3種

- やったこと(subagent実装。M4-Gを2ディスパッチに分割):
  - M4-G(cee766a/fd0e6de): 攻撃テストA(`server/test/guardrails/`)=ツール許可マニフェスト照合・
    canUseToolデフォルト拒否・悪意Mock全却下・入出力壁・Origin/WS単一接続。E2Eスモーク3種
    (会話/クエスト受注/夢シーン)+戦果narrateのWSフレーム傍受アサート
  - M4-G-2(844efa4): M4完了条件(guardrails.md 315行)の欠落=**テストID版マニフェスト照合
    メタテスト**を整備。各攻撃テストに安定`[ATK-...]`ID付与(47件)、必須IDマニフェスト、
    guardrails/*.test.tsをソース走査してアクティブID集合と照合するメタテスト
    (削除・skip・.only・未ラベルを検出。1件skipで実際に落ちることを確認済み)
- 検証: `pnpm check` 緑(ユニット502件・42ファイル)。`pnpm test:e2e` 8/8緑
  (既存4+会話/クエスト/夢/戦果narrate)
- 裁量/既知の問題:
  - M4-Gのブラウザ検証で会話UIの2バグを発見・修正済み(JOURNAL[13])。E2Eスモークが
    会話/クエスト/夢フローを自動回帰で担保
  - Origin不許可テストは `app.inject`(in-process)で実施(実WSアップグレードの403は
    HTTP接続追跡から外れた socket が `app.close()` をハングさせるため)
  - **secret-mask.ts / scan-secrets.mjs はファイル名の "secret" によりRead権限で読めない**環境
    (subagentは使用例から署名推定)。M5で私が触れたシークレットスキャンの件は下記[15]
- **M4マイルストーン完了**。ROADMAP M4全項目チェック。攻撃テストB(実AI)と `test:ai-live` の
  実行は人間確認待ち(テスト・手順は整備済み: JOURNAL[11][14])

## [15] 2026-07-04 M5(大部分)完了: アセット検収+組み込み(タイトル/戦闘/会話に実画像)

- 前提: **人間がアセットを先行納品**(assets/ に PNG26点+manifest.json+prompts26)。
  M5はcodex委譲ではなく検収→組み込みから開始(asset-pipeline.md 91行の想定どおり)
- やったこと(オーケストレーター実装。コミット e13a113):
  - **検収**: manifest↔ファイル整合(26=26)・PNG署名・宣言sizePxと実寸一致・prompt実在・
    id一意を機械検証。タイトル/司祭立ち絵/霧狼/戦場背景を目視で世界観適合も確認
  - PreloadScene(`manifest.json`駆動で全画像をidロード。欠落は各シーンが`textures.exists`で
    プレースホルダー退避)。main.tsの先頭シーンに登録
  - アセット配信: **Viteプラグイン**で `/assets/*` を dev配信(当初symlinkにしたが
    `scan-secrets.mjs`がEISDIRでクラッシュしたためプラグインへ切替。dist未使用なのでbuildコピー無し)
  - タイトル背景(機関の街+暗幕)、戦闘(敵グラフィック透過+場所別背景battle-field/dungeon、
    形態変化でdream-eater-phase2差替)、会話(NPC立ち絵+屋内背景=情報屋:霧笛亭/司祭:灯守堂)
  - `fitCover`/`fitContain`ヘルパーでスロット毎スケール(サイズ差吸収)
- 検証: `pnpm check` 緑(502件)。`pnpm test:e2e` 8/8緑。**Playwright test runner内でscreenshot
  撮影→Read で3シーン目視検証**(MCP切断のため。タイトル・会話・戦闘とも実画像描画を確認)。
  会話の発話テキストが立ち絵/パネルに隠れるz順バグを発見→utteranceをcontainer後に追加して修正
- 裁量で決めたこと:
  - タイルマップ・マップ上のキャラはプレースホルダー維持(asset-pipeline.md「タイルマップの方針」。
    立ち絵と会話で世界観担保)。OP/ED(op-1/2,ed-1/2)はM6のオープニング/エンディングで組み込む
  - 会話屋内: 情報屋=tavern-interior、司祭=chapel-interior(宿屋=inn/商人=shopはUI別途)
- 既知の問題/残: **日本語フォント未導入**(納品にフォント無し。現状systemのserifで表示は成立。
  BACKLOG/追加納品待ち)。UI装飾(window-frame/cursor)は未組み込み(任意ポリッシュ)
- 次にやること: M6(縦切り完成)=メインクエスト進行(司祭会話で夢喰いを知る→ダンジョン→
  ボス撃破→エンディング)、オープニング(op-1/2)/エンディング(ed-1/2)演出、バランス調整、
  通しE2E(pnpm test:e2e:full)整備。M6着手前にgame-design.mdのメインクエスト/エンディング節を精読

## [16] 2026-07-04 M6完了=縦切り完成: メインクエスト・オープニング/エンディング・通しプレイE2E

- やったこと(server配線=subagent、UI=オーケストレーター、通しE2E=subagent、README/検証=オーケストレーター):
  - M6-A(subagent・4259506/53b3401): メインクエスト状態機械。`SnapshotView.mainQuestStage`
    追加、司祭スクリプト会話(arrival→rift-revealed・AI非依存の3行dialog)、ボス戦トリガー
    (rift-revealedでゲート・接触で夢喰い戦・撃破でdream-eater-defeated・再戦不可)、
    テスト加速`startLevel`(mock限定)、`acknowledge-ending`でepilogue確定。テスト14件
  - M6-B(オーケストレーター・6317f3c/87ac1f6): Cinematic(静止画+ナレーションのスペース送り)、
    OpeningScene(op-1/2)、EndingScene(ed-1/2+acknowledge-ending送信)。title→新規は
    オープニング経由(?skipIntro=1で演出スキップ)・つづきからは探索直行、battle→ボス撃破で
    エンディング直行、ボスマーカーはrift-revealedのみ描画。既存E2E6件のnew-game gotoへ
    skipIntro付与しスモーク維持
  - M6-C(subagent・07f117b): 通しプレイE2E `pnpm test:e2e:full`(専用config+testIgnoreで
    スモークから分離)。新規→オープニング→司祭→ダンジョン1→2→3→夢喰い撃破→エンディング→
    タイトルを約40秒で自動走破(startLevel=8/noSymbols/skipIntro/seed=42の加速)。2ケース
  - M6-D(オーケストレーター): README「遊び方」節+スクリーンショット5枚(docs/screenshots/)、
    バランス確認、BGM判断
- 検証: `pnpm check` 緑・`pnpm test:e2e` 8/8緑・`pnpm test:e2e:full` 2/2緑。
  **Playwright screenshotで目視検証**: タイトル(機関の街)・オープニング(旅人到着)・
  会話(霧笛亭+カイ立ち絵)・ボス戦(夢喰い第1形態+ダンジョン背景)・**形態変化(実戦で
  50%HP時にphase-changeが発火しdream-eater-phase2へ差替)**・エンディング(ed-1)を確認
- 裁量で決めたこと:
  - **BGM/SEは縦切りでは無音**。オープンライセンス音源の導入はBACKLOG(納品にも音源なし)
  - オープニングは**new-game操作で駆動**(snapshotのstage依存にしない=再接続の再同期で
    再生されないため。advisor助言)。ボス撃破→エンディングは**battle-scene**で直行
    (探索経由の一瞬のちらつき/遷移レース回避)
  - `?skipIntro=1`(演出スキップ)を追加し既存E2Eを維持。通しE2Eは加速フラグで数十秒
  - バランス: Lv6=累積248XP、敵XP霧狼4/蝋燭9/軋み16・ボス120。約30-40討伐でLv5-6到達可、
    ボス撃破可・下位レベルは全滅あり(M2実測と整合)。調整不要
  - オープニング/エンディングのナレーションはworld-lore 3節(旅人・機関・夢喰いの弔い・凪)に準拠
- 既知の問題: なし
- 人間確認待ち(縦切り完成の受け入れ): (1)`.env`設定の上で `pnpm dev` の実プレイ通し確認
  (1-2時間の実感)、(2)`pnpm test:ai-live`(実AI疎通+インジェクション攻撃テストB)の実行。
  いずれもテスト・手順・加速の整備は完了済み(CLAUDE.md規約によりClaude Codeは実行しない)
- **★縦切り完成★**: タイトル→新規→オープニング→メインクエスト(司祭→ダンジョン→夢喰い撃破)→
  エンディング→タイトルが通しでプレイ可能。`pnpm check`+全E2E(スモーク8+通し2)緑。
  M0-M6全マイルストーン完了。以降は BACKLOG.md に従い /loop で拡張する
- 次にやること: 縦切りは完成。拡張フェーズ(/loop + BACKLOG.md)。着手時はBACKLOG上位項目
  (装備システム・新エリア・第2章等)から。人間確認待ち項目(実プレイ・test:ai-live)の消化は人間

## [17] 2026-07-04 バグ修正: 調べる/会話後の移動不能(awaiting固着)

- やったこと:
  - 症状(ユーザーの実プレイ報告): 人物に話しかけたり何かを調べたりした後、**たまに矢印キーが
    利かず移動不能**になる
  - 根本原因(systematic-debugging + 実測で特定): 探索シーンの移動ロック `awaiting` は
    「応答(snapshot / dialog / error)待ち」の契約(exploration-scene.ts の定義コメント)だが、
    シーンは dialog を購読しておらず **snapshot / error でしか解除していなかった**。サーバーの
    interact 応答には snapshot を伴わず **dialog のみ**を返す経路(立て札・空振り=正面に何も無い・
    空箱・満杯で拾えない等)があり、その後 `awaiting` が true 固着 → 以後 move を送れず移動不能。
    dialog-only の操作でだけ固着するため「たまに」に見える(開発者は同種をボス経路だけ
    `approachBoss` で回避済みだったが他 interact 経路を見落としていた)
  - 修正(client 1点): 探索シーンが `client.on("dialog", …)` で `awaiting` を解除
    (exploration-scene.ts)。実プレイは gatekeeper 常時注入で NPC 会話は全経路 snapshot 応答
    (dialog-only にならない)ため、この単一修正で「調べた後」も「話した後(万一の dialog-only)」も
    全クラスを1点で解消する
  - E2E 観測用に `data-dialog`(open/closed)を #game データ属性へ同期(dialog-only 応答は
    snapshot を伴わず既存の syncDomState では観測できないため)
  - 回帰 E2E `movement-after-interaction.spec.ts` 2件(調べた後の移動・会話後の移動)を追加
- 検証: `pnpm check` 緑・`pnpm test:e2e` **10/10**緑(既存8+新規2)。実測で
  **修正前=y:10固着 / 修正後=y:9移動**を確認。会話4バリエーション(送信→Esc / 立ち去る /
  入力Escキャンセル / 依頼を尋ねる)すべてで会話後の移動成立を実測し、別バグ疑い(自由入力欄
  TextInputBox のフォーカス残留で keyboard 無効化)は**不在**と確認(afterSubmit の
  activeElement=BODY・inputs=0・移動成功)
- 裁量で決めたこと: `data-dialog` データ属性を追加(既存の E2E 用データ属性同期と同趣旨)。
  サーバー側は不変更(interact 応答が dialog-only でよい契約を維持。`approachBoss` の
  snapshot 先行付与は本修正で冗長になるが無害なため据え置き=スコープ拡大回避)
- 既知の問題: なし
- 次にやること: 縦切りは完成済み。拡張フェーズ(/loop + BACKLOG.md)。人間確認待ち項目の消化は人間

## [18] 2026-07-05 バグ修正: .env読み込み経路の欠如(実AI=liveで生成できない)

- やったこと:
  - 症状(ユーザー報告): `.env` に認証情報や `AI_MODE=live` を設定しても実AIで生成できない
  - 根本原因(systematic-debugging で特定・2点):
    (1) `.env` を `process.env` へ読み込む経路が皆無。サーバー起動は `node dist/index.js` で
    dotenv/`--env-file`/`process.loadEnvFile` のいずれも無く、`pnpm test:ai-live`
    (vitest.ai-live.config.ts)も同様で資格情報ガードにより全テストが静かに skip されていた。
    (2) resolveAiMode の二重実装が未統合。起動エントリ index.ts は旧 config.ts 版
    (未文書化の `DREAMING_ENGINE_ALLOW_LIVE_AI=1` が必須)を使い、仮に .env が読めても
    `AI_MODE=live` で起動時 throw。ai/mode.ts 冒頭に「統合は後続の配線タスク」と記録された
    M4 の宿題が未実施だった
  - 修正(実装は subagent=Opus へ委譲、オーケストレーターが検収。UI変更なし):
    - 新規 `packages/server/src/env.ts`: `loadDotEnv(filePath?)` が リポジトリ直下 `.env` を
      Node native `process.loadEnvFile` で読み込む(依存追加なし)。ENOENT のみ黙って
      スキップ(fresh clone/CI 保護)、他エラーは再throw。index.ts の最初で呼ぶ
    - `config.ts`: 旧 resolveAiMode と `DREAMING_ENGINE_ALLOW_LIVE_AI` を撤去し
      `ai/mode.ts` の resolveAiMode(env) へ一本化(mode.ts の宿題の実施)。
      フェイルセーフ(未設定・不正値=mock/テスト実行下live拒否)は不変
    - `vitest.ai-live.config.ts`: 先頭でルート `.env` を読み込み(test:ai-live へ資格情報が届く)
    - ユニットテスト追加: env.test.ts 3件(載る/既存env非上書き/欠落で無害)+ config.test.ts 書き直し
  - 安全性の根拠(実測): `process.loadEnvFile` は既存環境変数を**上書きしない**ことを実測確認。
    `pnpm dev:mock`/E2E(Playwright webServer)の `AI_MODE=mock` 注入は `.env` の live に侵食されない
- 検証: `pnpm check` 緑(unit 520件)・`pnpm test:e2e` **10/10緑**・mock手動起動で `(mock)` ログ確認。
  live起動・実AI呼び出しは規約どおり未実行
- E2E干渉の顛末(記録): 検収中 battle.spec.ts:113 が4連続失敗。エラーページに
  「サーバー: 別画面に接続されました」→ **開きっぱなしの Chrome タブ(127.0.0.1:5173)が
  E2E の Vite 起動で HMR 自動リロード→WS再接続し、WS同時1接続仕様がテストページを切断**していた。
  ベースライン(HEAD・変更 stash)でも同一失敗を確認し修正無関係と断定。当該タブを
  about:blank へ退避(可逆)したところ 10/10 緑。**教訓: E2E 実行前にゲームを開いた
  ブラウザタブを閉じること**(実プレイ確認と E2E の併用時に再発しうる)
- 裁量で決めたこと: Node native `process.loadEnvFile` 採用(dotenv 依存を追加しない)。
  `DREAMING_ENGINE_ALLOW_LIVE_AI` の撤去は mode.ts 自身が予告していた統合の実施であり
  防御の弱体化ではない(live には依然 明示的 `AI_MODE=live` が必要・テスト実行下は拒否)
- 既知の問題: なし(ai-live の vitest worker への env 伝播は未実測だが、最悪でも従来どおり
  skip に留まり実AI誤爆は起きない)
- 人間確認待ち: (1) `.env` 設定の上で `pnpm dev` → 実プレイで live 生成の確認、
  (2) `pnpm test:ai-live` の実行(資格情報が届き skip が解消されるはず)
- 次にやること: 拡張フェーズ(/loop + BACKLOG.md)。人間確認待ち項目の消化は人間

## [19] 2026-07-05 バグ修正: live会話でフォールバック文表示(speak呼び忘れ)+thinkingフロー別制御

- やったこと:
  - 症状(ユーザー報告): 実プレイ(AI_MODE=live)のNPC会話でフォールバック文章が表示された。
    `pnpm test:ai-live` 自体は緑(23.7秒)=認証・疎通は前エントリ[18]の修正で機能している
  - 根本原因(systematic-debugging+実測プローブで特定): 監査ログ(durationMs=19580・
    responseText=null・toolCalls=[])から、**AIがツールを1つも呼ばずテキストのみで応答を
    終え、表示系(speak)承認0件 → display_approved_zero → 定型フォールバック**の経路と特定。
    寄与要因は (a) SDK既定で有効な拡張思考(thinking)による長考(実測: 会話応答22秒中
    思考8秒超)と脱線、(b) SDK/CLIが注入する合成メッセージ(「Tool loaded.」等)への
    気取られ、(c) taskタグの「必ずspeakツールで」だけではHaikuへの拘束が弱い、の複合
  - 修正(実装はsubagent=Opusへ委譲、オーケストレーターが検収):
    - **thinkingのフロー別制御**(flow-spec.ts に FLOW_THINKING_DISABLED 追加、live.ts で
      該当フローのみ thinking: disabled を SDK Options へ):
      プレイヤーがリアルタイムで待つ conversation / questGeneration / battleResult は無効、
      裏方GM処理の dream / summary は維持(**ユーザー決定**: 対話するAIは思考不要、
      対話しないAIは思考維持)
    - **taskタグのツール必須拘束を強化**(prompt.ts): 「ツールを使わない地の文・思考・
      前置きはプレイヤーに表示されず破棄される」「システム通知に応答しない」「声が空なら
      こちらから挨拶をspeakで」等を4フローに明文化(summary・世界観憲法は不変更)
    - **監査ログの診断性強化**: ai_call レコードへ failureKind / usedFallback を追加
      (audit-log.ts+gatekeeper.ts。今回の診断が難航した教訓。監査の強化=仕様の弱体化なし)
  - 実AI検証(ユーザーの明示許可により実行): `pnpm test:ai-live` **緑・11.9秒**(修正前
    23.7秒からほぼ半減)。実プレイ失敗ケース再現プローブ(会話開始・playerUtterance空)で
    **9.1秒完了・speak確実発火・オルガの口調正常**(修正前22秒)を確認
- 検証: `pnpm check` 緑(unit 534件)・`pnpm test:e2e` 10/10緑・実AI2回(上記)
- 実AI観測の記録(プローブで判明した既知挙動・スコープ外):
  - モデルが ToolSearch を1ターン使って mcp__dream__speak をロードしてから呼ぶ
    (SDKのツール遅延ロード)。また speak 後にSDK合成メッセージ(「no visible output」)への
    応答で1ターン消費し、**num_turns=4/4 と maxTurns ギリギリ**。ツール検証層の防御は活き
    ており実害なしだが、余裕がない
  - CLAUDE_SDK_CAN_USE_TOOL_SHADOWED 警告: bare allowedTools が canUseTool を
    シャドーする(SDK仕様)。検証層(第1層)の二重検査は独立して機能しているため
    防御は維持されているが、canUseTool のデフォルト拒否を実効化するなら
    PreToolUse フック等への移行が必要
- 仕様変更提案(実装せず記録のみ):
  - (1) display_approved_zero もリトライ1回の対象に加える(現仕様 ai-integration.md 258-259 は
    「検証却下はリトライせず」。thinking無効化+プロンプト強化で発生率は下げたが、
    非決定的な再発の保険として)
  - (2) 会話フローの maxTurns を 4→6 へ(SDKのツール遅延ロード+合成メッセージ応答で
    2ターン浪費し、実測 4/4 ギリギリのため。ai-integration.md「ターン数上限(会話: 4)」の変更)
- 裁量で決めたこと: FLOW_THINKING_DISABLED は config でなく flow-spec.ts の分類定数
  (FLOW_MODEL_TIER と同格)。維持フローは thinking キー自体を渡さず SDK 既定に委ねる
- 既知の問題: audit-log.ts に HEAD から NUL 文字(境界イベント集約キーの区切りに実バイトの
  0x00 がテンプレートリテラル内へ直接埋め込まれている)があり、git がバイナリ扱いして
  diff が見えない。可視のエスケープ表記への置換を検討(機能は正常。次回の軽微タスク向き)
- 人間確認待ち: 実プレイ(pnpm dev)での会話体感確認(応答9秒前後・フォールバック文が
  出ないこと)。E2E実行時はゲームを開いたブラウザタブを閉じること(エントリ[18]の教訓)
- 次にやること: 拡張フェーズ(/loop + BACKLOG.md)。仕様変更提案(1)(2)の採否は人間

## [20] 2026-07-05 仕様変更2件の正式化(オーナー承認): 表示系0件リトライ+会話maxTurns 6

- やったこと:
  - エントリ[19]の仕様変更提案2件を**オーナーが正式に受け入れた**ため、仕様書
    (docs/spec/ai-integration.md)と実装の両方を更新(実装はsubagent=Opus、検収はオーケストレーター)
  - 変更1: リトライ対象に**表示系承認0件(display_approved_zero)**を追加
    (ai-integration.md リトライ節)。出力壁却下(summary)は引き続き対象外。
    **1トリガーにつきリトライは最大1回**(失敗理由の組み合わせによらず。例: 初回timeout→
    リトライ→表示系0件はそこで確定、3回目は呼ばない=サブスク枠保護)
  - 実装: turn-executor.ts を TurnOutcome 判別共用体(success/dm_failure/display_zero/
    summary_reject)へ再構築。**副作用(検証カウンタ・セッションcommit・失敗カウント)を
    確定から分離**し、executeTurn は「初回+リトライ1」の単一ループで evaluateResult →
    (リトライ可否判定)→ finalizeOutcome の構造に。初回の表示系0件試行は何も確定させず、
    リトライは新しい turnState で再検証(二重適用なし=テストで保証)
  - 変更2: 会話区分の maxTurns を **4→6**(config/ai.json+仕様書2箇所)。根拠は[19]の実測
    (SDKのツール遅延ロード+合成メッセージ応答で2ターン浪費し4/4ギリギリ)
  - テスト5件追加(0件→リトライ成功/0件→0件で1失敗/timeout→0件で確定=呼び出し2回/
    summaryは対象外/リトライ時の効果二重適用なし)。unit 534→539
- 検証: `pnpm check` 緑・`pnpm test:e2e` 10/10緑(1回目の失敗はブラウザタブ干渉=[18]の
  既知環境問題。タブ退避AppleScriptがエラーになった回で、再実行で全緑)
- 注記(subagent申し送り): maxTurns 6 は「会話区分」共通のため battleResult / summary にも
  適用される(区分の構造上不可避。battleResult は無害な余裕、summary はテキストのみで影響なし)
- 次にやること: 会話立ち去り後のフリーズ解消(要約非同期化)→ 会話開始の即時画面切替
  (本セッションのタスク#2/#3)

## [21] 2026-07-05 会話立ち去り後のフリーズ解消(要約AIの非同期化)

- やったこと(ユーザー要望): 立ち去り後に要約AI(summaryフロー。liveで数秒〜数十秒)の完了を
  待って画面が固まるのを解消。実装はsubagent=Opus、検収はオーケストレーター
  - session.ts `conversationEnd` を同期メソッド化: 要約を fire-and-forget で開始し、
    closeConversation+interaction解除+snapshot を**即座に**返す(クライアントのawaitingが
    すぐ解除され立ち去り直後に移動可能)
  - 完了ハンドラは**同期のみ・awaitなし**(直列処理チェーン外での状態read-writeをアトミックに):
    要約成功時のみ最新memoryのsummaryを差し替え、`recentExchanges.slice(N)`(N=要約に渡した
    往復数)で**要約中に積まれた新往復を保持**。失敗時はmemory不変。例外はcatchで無害化
  - 新フィールド `gameGeneration`(newGame/continueで+1): 立ち去り→即タイトル→ロード後に
    要約が完了しても**別ゲームのmemoryを汚さない**(世代不一致で破棄)
  - gatekeeper既存ガード(inFlight・同一NPC要約完了待ち)は不変更。テスト6件追加(unit 545)
- 検証: `pnpm check` 緑・`pnpm test:e2e` 10/10緑
- 既知の問題(subagent申し送り→BACKLOG相当): 要約がinFlightスロットを応答後も短時間保持する
  ため、その窓で発火したAIフローがbusy定型文に落ちる。特に**初見敵の即時撃破**では
  narrateBattleがAI呼び出しの有無に関わらず narratedEnemies に記録するため、固有AI描写が
  出ないまま既見扱いになる(フレーバーのみ・進行阻害なし・窓は狭い)。修正は別論点を含むため見送り
- 次にやること: 会話開始の即時画面切替(タスク#3。UI側は実装済み・未コミット)

## [22] 2026-07-05 会話開始の即時画面切替(挨拶生成を待たずに会話画面へ)

- やったこと(ユーザー要望): 話しかけた際、挨拶AI生成(liveで約10秒)完了まで探索画面が
  固まるのを解消。**サーバー側=subagent(Opus)、クライアントUI=オーケストレーター自身**が実装
  - **push機構(新設)**: GameSession に `setPushSender`/`push` を追加し、server.ts が
    WS接続確立時に注入・切断時に解除(登録主のときのみ)。直列チェーンの外(AI完了ハンドラ)
    から現接続へ自発配信する初の機構。切断中のpushは黙って破棄(再接続時は connect() の
    snapshot再同期が正を配る)。送信例外は二重に握って無害化。sharedのWSスキーマ変更なし
  - **openConversation の2段階化**(session.ts): 即時に会話interactionを張って snapshot
    のみ返し(クライアントは会話画面へ即切替)、挨拶生成は fire-and-forget。完了ハンドラ
    (同期のみ・世代印ガード)で「まだ同一NPCと会話中」のときのみ interaction 再構築+
    [snapshot, ai-utterance(speak)] を push。待たずに立ち去ったら発話は破棄(承認effectの
    好感度+1等はAIターンとして成立済みのため適用)。クールダウン定型・busy・フォールバック
    も同経路(displayText を speak として必ず push する契約)
  - **クライアント(オーケストレーター実装)**: ConversationOverlay に `awaitGreeting`
    オプションを追加。第一声が未着なら「……(相手の言葉を待っている)」の待機表示で開き、
    メニューは speak 到着(playUtterance/showMessage)で活性。既存の stashedSpeak 機構で
    到着順ずれにも対応。フォールバック文も speak で届く契約のため待機で固まり続けない
  - テスト: session-ai.test.ts へ5件(AI完了前に応答が返る/完了後にpush/完了前の立ち去りで
    speak破棄/世代印で全破棄/切断中も安全)+ server-push.test.ts(WS統合: 接続→interact→
    push配信)。unit 551
- 検証: `pnpm check` 緑・`pnpm test:e2e` 10/10緑(情報屋の会話受注・会話後の移動を含む)
- 既知の挙動(subagent申し送り): 挨拶生成中に同一NPCへ再度話しかけると古いspeakが
  push され得る(世代印は同一のため)。クライアントは speak 到着までメニューを隠すため
  実害なし。ガードは仕様外につき未追加
- 人間確認待ち: 実プレイ(live)で (1)話しかけ→即会話画面+待機表示→挨拶表示、
  (2)立ち去り→即移動可、の体感確認
- 次にやること: 拡張フェーズ(/loop + BACKLOG.md)

## [23] 2026-07-05 バグ修正: 夢シーンの本文が暗幕に隠れて読めない(描画順)

- やったこと(ユーザーのテストプレイ報告): 「― 夢 ―」の下の本文が背景と被って読みづらい。
  根本原因は**色ではなく描画順のバグ**: dream-overlay.ts は本文(TypewriterText。生成時に
  自身を parentLayer へ add する=生成順が描画順)を生成した**後**に、暗幕(veil、不透明度
  0.92)を含む container を parentLayer へ追加していたため、**暗幕が本文の上に被って**ほぼ
  読めなかった。タイトル「― 夢 ―」と「目を覚ます」は container 内で veil より後=正常に
  見えるため「本文だけ読みづらい」症状と一致(conversation-overlay は同じ罠を避けるため
  発話テキストを container の後に追加しており、その流儀へ揃えた)
- 修正(UI=オーケストレーター自身): 本文 TypewriterText の生成を container 追加の後へ移動
  (色・レイアウトは不変更。#c7bfe0 は暗幕上で十分読める)
- 検証: `pnpm check` 緑・`pnpm test:e2e` 10/10緑。**モックで実プレイ再現**(Playwright MCP:
  新規→宿屋(4,5)→宿泊→夢シーン)し、スクリーンショットで本文がはっきり読めることを確認
- 運用メモ: E2E が起動した dev:mock サーバー(vite+node)が終了処理漏れでポート
  5173/3000 に残留することがある(dev:mock の起動失敗「Port 5173 is already in use」の原因)。
  今回は視覚確認に再利用した上で kill した。残留サーバーは古い dist を配信し得るため、
  E2E 前後にポートを確認するとよい
- 次にやること: 拡張フェーズ(/loop + BACKLOG.md)

## [24] 2026-07-05 日本語フォント「しっぽり明朝」の導入(M5完了)

- やったこと(ROADMAP M5最後の未完了項目。UI作業のためオーケストレーター自身が実装、
  fontFamily使用箇所の調査のみExplore subagentへ委譲):
  - しっぽり明朝 Regular(SIL OFL 1.1)を google/fonts リポジトリから取得し、
    fonttools で woff2 へ無加工圧縮(8.7MB→3.2MB)して `assets/fonts/` に同梱
    (OFL.txt・出典README付き)。**サブセット化はしない**(AIが任意の漢字を出力しうるため全グリフ保持)
  - `@font-face` を style.css に宣言し、vite の assets 配信ミドルウェアに
    `.woff2: font/woff2` を追加。HTMLオーバーレイ(h1等)のfont-familyにも先頭適用
  - 共通定数 `UI_FONT_FAMILY`(`"Shippori Mincho", serif`)を
    `packages/client/src/ui/font.ts` に新設し、38箇所の `fontFamily: "serif"`
    ハードコード(16ファイル)をすべて置換(以後のフォント変更は1箇所で済む)
  - PreloadScene の create で `waitForUiFont()` を待ってからタイトルへ遷移
    (Phaser Text は生成時に自前キャンバスへ描画するため、確定前に描画すると
    フォールバック字形のまま残る)。**失敗・タイムアウト(5秒)・非ブラウザ環境でも
    必ず解決**して起動を阻害しない設計。テスト5件追加(font.test.ts。unit 556)
- 検証: `pnpm check` 緑・`pnpm test:e2e` 10/10緑・モック実プレイ(Playwright MCP)で
  タイトル画面スクリーンショット確認(明朝体で描画)+ `document.fonts.check` true
- 裁量で決めたこと:
  - Boldウェイトは導入しない(クライアントに fontStyle 指定が0件のため。必要になったら
    `assets/fonts/` へ追加して @font-face を足す)
  - フォントは manifest.json の管理対象外(台帳は画像用で、preload が全エントリを
    load.image するため混ぜられない)。出典・ライセンスは assets/fonts/README.md に記録
- これで **M5の全項目が完了**(ROADMAPの未完了項目は尽きた)
- 次にやること: 拡張フェーズ。BACKLOG.md 最上位の未完了項目「タイルマップの
  グラフィック改善(Kenney等CC0素材への置換、またはオートタイル実装)」を
  M7+としてROADMAP末尾へ分割展開してから着手する

## [25] 2026-07-05 M7展開+M7-1: CC0タイルセット(Kenney Roguelike/RPG pack)の同梱

- やったこと(拡張フェーズ1件目。BACKLOG最上位「タイルマップのグラフィック改善」を
  ROADMAP末尾へM7として3分割で展開し、M7-1を完了):
  - 事前調査(Explore subagent): 現行タイル描画は exploration-scene.ts の drawTiles
    (647-670行)が単一Graphicsへ単色矩形+グリッド線を手描き。タイル5種
    (floor/wall/water/road/grass)の定義と通行可否はshared(map.ts)にあり
    サーバー権威のため、**描画置換は純粋な見た目変更**。E2Eは座標クリック・
    画像比較・タイル見た目への依存が一切なく安全
  - Kenney「Roguelike/RPG pack」(CC0 1.0)を kenney.nl から取得し、透過版
    スプライトシートを `assets/tiles/roguelike-sheet-transparent.png` として同梱
    (LICENSE.txt・出典README付き)。検収は機械検証: PNG署名一致、
    968x526px=16pxタイル+1px間隔(外周マージンなし)で57列x31行=1767タイル
  - asset-pipeline.md「タイルマップの方針」へ展開済みの注記を追記
    (BACKLOG展開に伴う骨子追記=CLAUDE.mdが許可する類の更新。既存要件の変更なし)
- 裁量で決めたこと: タイル素材はcodex台帳 manifest.json の対象外とし
  assets/tiles/README.md を台帳とする(フォント[24]と同じ扱い。manifestは
  preloadが全エントリをload.imageする画像台帳のため、スプライトシートを混ぜない)
- 検証: `pnpm check` 緑・`pnpm test:e2e` 10/10緑(コード変更なし・アセット+ドキュメントのみ)
- 次にやること: M7-2(タイル描画のタイルセット参照化)。クライアント描画=UI作業のため
  オーケストレーター自身が実装する。Phaser読み込みは
  `frameWidth:16, frameHeight:16, margin:0, spacing:1`、32pxグリッドへはNEARESTで2倍。
  5種タイル×マップ種別のフレーム割当はスプライトシートを目視してから決める

## [26] 2026-07-05 M7-2: タイル描画のCC0タイルセット参照化

- やったこと(クライアント描画=UI作業のためオーケストレーター自身が実装):
  - `packages/client/src/tile-frames.ts` 新設: タイルセット定数(キー・パス・
    16px+間隔1px・57列x31行)と、マップ区分(town/field/dungeon)x タイル5種の
    フレーム割当表 `tileFrame(mapId, tile)`。座標は `frameAt(列, 行)` で可読に保持。
    選定は Pillow でシートの座標ラベル付き拡大クロップ+ミニマップ合成プレビューを
    作って目視(街=石畳(6,3)+土壁(17,16)+煉瓦道(5,2)、フィールド=土(6,1)+
    岩壁(21,16)+砂道(8,1)、ダンジョン=石床(7,1)+青灰壁(28,16)。水と草は共通)
  - preload-scene: `load.spritesheet` でタイルセットを読み込み(manifest対象外の
    直接パス指定。失敗時は既存の FILE_LOAD_ERROR 警告のみで続行)
  - exploration-scene: drawTiles を分岐化 — テクスチャが存在すれば
    `drawTilesFromTileset()`(タイル毎に image を setOrigin(0)+2倍スケールで配置、
    Texture.setFilter(NEAREST) でにじみ防止)、無ければ従来の
    `drawTilesPlaceholder()`(単色+グリッド線)へ退避
  - テスト3件追加(tile-frames.test.ts: 全マップx全種別がシート範囲内/
    ダンジョン3層は同一区分/床・壁が区分間で相違。unit 559)
- 検証: `pnpm check` 緑・`pnpm test:e2e` 10/10緑・モック実プレイ(Playwright MCP)で
  街(石畳・煉瓦道・土壁)とフィールド(草地・砂道・岩壁・水場)の描画をスクリーンショット確認
- 既知の観察(M7-3で対応): タイルは原色寄りで明るく、ダークファンタジーのトーンに
  未調整(tint/暗色オーバーレイをM7-3で)。NPC名ラベル(白文字)が明るいタイル上で
  読みにくい。フィールドの草(5,1)は彩度が高く「荒れ野」の雰囲気に合っていない
  可能性(M7-3でより沈んだ草タイルへの差し替えも検討)
- 次にやること: M7-3(全5マップの実プレイ確認+ダークファンタジートーン調整)。
  Phaser 4 の Texture.setFilter は確認済み。ダンジョンのフレームは合成プレビューのみで
  実プレイ未確認のため、M7-3で最深部まで歩いて確認する(movement.spec の経路が参考)

## [27] 2026-07-05 M7-3: タイルのダークファンタジートーン調整と全マップ確認(M7完了)

- やったこと(クライアント描画=UI作業のためオーケストレーター自身が実装):
  - tile-frames.ts に `tileTint(mapId)` を追加: マップ区分別の乗算tint
    (街=0xaaa6b4 夕暮れの青灰 / フィールド=0x8f9480 くすんだ荒野 /
    ダンジョン=0x7d84a0 冷たい青灰)。値はPillowで「無調整/tint適用」比較の
    合成プレビューを作って目視選定。exploration-scene の drawTilesFromTileset が
    タイル画像へ setTint を適用
  - [26]の申し送り対応: フィールドの草の彩度過多はtintで解消(差し替え不要と判断)。
    NPC名ラベルの視認性もタイル暗色化で改善
  - テスト2件追加(tileTint の24bit範囲/ダンジョンが街より暗い。unit 561)
  - **全5マップの実プレイ確認**: Playwright(run_code)で新規→背骨道(x=11)を
    最深部まで踏破し、town/field/dungeon-1/2/3 のスクリーンショットを取得・目視
    (街=青灰の石畳と土壁、フィールド=くすんだ草地と岩壁、ダンジョン=冷青灰の石床と壁)
- 検証: `pnpm check` 緑(unit 561)・`pnpm test:e2e` 10/10緑・
  **`pnpm test:e2e:full` 2/2緑**(M7完了のマイルストーンゲートとして実行。
  新規→ボス撃破→エンディング 41.4秒)
- **M7完了**: BACKLOG「タイルマップのグラフィック改善」にチェック
- 運用メモ: マップ踏破の自動操作は Playwright MCP の run_code で
  `keyboard.down("ArrowDown")`+data-map-id ポーリングが確実(合成KeyboardEventは
  Phaserに届かないことがある)。E2Eの noSymbols=1&skipIntro=1 フラグが再利用できる
- 次にやること: BACKLOG次点「装備システム(武器・防具のスロット、攻防への反映、
  店での売買)」をM8として展開してから着手。ゲームロジック中心のため
  subagent(Opus)への委譲が主体になる見込み(UI=装備画面のみオーケストレーター)

## [28] 2026-07-05 M8展開+M8-1: 装備システムの仕様骨子とsharedデータモデル

- やったこと(BACKLOG「装備システム」をM8として4分割で展開し、M8-1を完了。
  実装はsubagent=Opus、事前調査=Explore、検収・コミット=オーケストレーター):
  - 仕様骨子: game-design.mdへ「装備(拡張: M8)」節を新設(スロット2つ=武器/防具、
    実効攻防=レベル基礎値+装備ボーナス(ダメージ式の構造不変)、装備・解除は
    インベントリとの授受(解除は満杯不可・入れ替えは満杯でも常に成功)、入手は店)。
    「セーブ/ロード」保存内容列挙へ「装備スロット」を追記(列挙更新は仕様書自身の指示)
  - shared: items.tsへ装備4種(worn-blade 錆びた片刃 攻+3 60G / amber-blade 琥珀刃
    攻+7 180G / worn-cloak 擦り切れた外套 防+2 50G / warded-mail 灯守りの帷子 防+5 150G)
    とslot/atkBonus/defBonusフィールド・ID部分集合(WEAPON/ARMOR_ITEM_IDS)を追加。
    equipment.ts新設(スロット別enumのequipmentSchema・equipItem/unequipItem純ロジック・
    effectiveStats)。gameStateSchemaへ equipment を .default() 付きで追加
    (GAME_STATE_VERSION=1据え置き=旧セーブ互換)
  - テスト18件+既存互換テスト拡張(unit 561→579)。バランス根拠: Lv1基礎攻8/防5、
    価格はポーション小20G・ボス報酬100G等の経済と整合(subagent報告に詳細)
- 検証: `pnpm check` 緑(unit 579)・`pnpm test:e2e` 10/10緑(検収時に再実行)。
  battle.ts・server・clientは不変更(effectiveStatsの組み込みはM8-2)
- 次にやること: M8-2(サーバー統合)をsubagentへ委譲。申し送り:
  (1) createBattle/applyLevelUps を effectiveStats(level, equipment) 差し替え
  (equipmentをBattleStateへ渡す経路が必要)、(2) equip/unequip のWSメッセージ+
  session.tsリデューサー(shopBuy/useItemが雛形、handle switchは254-288行)、
  (3) buildView(session.ts:1193)へ装備ビュー+実効ステータス反映、
  (4) セーブは追加実装不要(.default()補完)。探索中のuseItem(session.ts:933)と
  buildViewのstatsForLevel直呼びも effectiveStats へ統一すること

## [29] 2026-07-06 M8-2: 装備のサーバー統合(WSメッセージ・戦闘反映・ビュー公開)

- やったこと(実装はsubagent=Opus、検収・コミットはオーケストレーター):
  - WSメッセージ: `equip`(itemIdは装備可能4種にzod限定)と `unequip`(slot)を
    clientMessageSchema へ追加。viewPlayerSchema へ `equipment.{weapon,armor}`
    (null または {itemId,name,bonus})と `effectiveAttack`/`effectiveDefense` を追加
    (既存フィールド不変=現行UIは無改修で動作)
  - session.ts: equip/unequip リデューサー(sharedの純ロジックを呼び snapshot 返却。
    失敗は shopBuy の error+code 流儀: not-owned/not-equipped/inventory-full。
    探索中限定ガードは useItem と同じ requireExploration)。buildView へ装備ビュー+実効攻防
  - battle.ts: createBattle に**任意引数** equipment(省略=空装備で従来と完全同値=
    既存バランステスト無改変)。BattleState.equipment を保持し、applyLevelUps も
    effectiveStats で再導出(装備ボーナスがレベルアップで消えない)。
    beginBattle/beginBossBattle が state.equipment を渡す。useItem の maxHP 参照は
    基礎値のまま(装備は maxHP に影響せず同値。意図コメントあり)
  - テスト13件相当を追加(装備リデューサー・戦闘反映・旧セーブ互換の一連。unit 579→592)
- 検証: `pnpm check` 緑(unit 592)・`pnpm test:e2e` 10/10緑(検収時に再実行)
- 裁量(subagent): unequip失敗を空スロット(not-equipped)と満杯(inventory-full)で
  別コード化。エラー文言は地の文の流儀で新規(「そこには、何も帯びていない。」等)
- 次にやること: M8-3(店の売買対応)をsubagentへ委譲。申し送り: SHOP_STOCK/
  shopStockEntries(shared/src/shop.ts)へ装備4種を追加すれば既存の shopBuy/shopSell が
  そのまま動く(装備固有の分岐不要)。E2Eの店スモークが在庫一覧に依存していないか確認する

## [30] 2026-07-06 M8-3: 店の装備売買対応

- やったこと(実装はsubagent=Opus、検収・コミットはオーケストレーター):
  - shop.ts の SHOP_STOCK へ装備4種を追加(並び=消耗品→武器(初級→上級)→防具(同)。
    順序は WEAPON/ARMOR_ITEM_IDS のspreadで一元化)。game-design.md 装備節の入手経路へ1行追記
  - shopBuy/shopSell は**無修正で動作**を確認(売却は state.inventory のみを対象とするため、
    装備中の品はスロットにあり構造的に売却対象外=誤売却なし)
  - テスト8件追加(在庫・並び順・価格/購入・満杯ブロック・売却・装備中売却不可。unit 600)
- 検証: `pnpm check` 緑(unit 600)・`pnpm test:e2e` 10/10緑(検収時に再実行)
- 運用メモ(subagent発見): `pnpm check` は test を build より先に実行するため、
  shared 変更後に古い dist が残っていると server テストが stale dist で落ちることがある
  (fresh checkout や clean 後は先に `pnpm build`)。今回の初回失敗もこれで、テスト自体は健全
- 次にやること: M8-4(装備画面UI+E2Eスモーク1本)。**UI作業のためオーケストレーター自身が実装**。
  申し送り: (1) snapshot.view.player.equipment.{weapon,armor}(null or {itemId,name,bonus})と
  effectiveAttack/effectiveDefense が利用可能、(2) 送信は {type:"equip",itemId} /
  {type:"unequip",slot}、失敗コード not-owned/not-equipped/inventory-full、
  (3) 探索中のみ有効(戦闘中は invalid-mode)、(4) 店の買い/売りリストに装備の
  ボーナス値が出ない(shop-overlay.ts buildBuyItems。ITEMS[id].atkBonus/defBonus 参照で
  ラベル拡張を検討)、(5) InventoryOverlay(Escで開く)への統合か新規オーバーレイかは
  実装時に判断(game-design.md:31 の将来像はEscメニュー集約)

## [31] 2026-07-06 M8-4: 装備画面UI+E2Eスモーク(M8完了)

- やったこと(UI作業のためオーケストレーター自身が実装):
  - もちものオーバーレイへ装備UIを統合: リスト先頭に[武器]/[防具]のスロット行
    (装備中は選択→「はずす」、空は選択不可)、装備品アイテムのアクション先頭に
    「そうびする」(消耗品は従来どおり「使う」)、ヘッダー2行目に実効攻防
    (攻撃/防御。装備込み)。装備品ラベルに(攻+N)/(防+N)のボーナス表記
  - 店の買い/売りリストにも装備ボーナス表記を追加([30]の申し送り対応。
    購入前に性能を確認できる)
  - E2E同期点: #game に data-atk / data-def(実効攻防)と data-menu
    (もちもの開閉。data-dialogと同じ流儀)を追加
  - テスト加速フラグ ?startGold=N を追加(newGameOptions+session+url-flags。
    startLevelと同一のmock限定ゲート。装備購入スモークの資金確保用)。
    server側ユニットテスト2件(mock尊重/live無視。unit 602)
  - E2Eスモーク equipment.spec.ts を追加(11本目): 商人(16,4)へ移動→
    「錆びた片刃」購入(999→939G)→もちものから装備(data-atk 8→11)→
    はずす(→8)→閉じて移動可。正対は「ブロック移動で向きだけ変わる」既存作法
- 検証: `pnpm check` 緑(unit 602)・`pnpm test:e2e` **11/11緑**・
  **`pnpm test:e2e:full` 2/2緑**(M8完了のマイルストーンゲート)。
  モック実プレイ(Playwright run_code)で店リスト・装備前後のもちもの画面を
  スクリーンショット確認(ヘッダー攻撃11/防御5、スロット行表示、ボーナス表記)
- 裁量で決めたこと: 装備UIは新規オーバーレイでなく既存もちものへ統合
  (game-design.md:31 の将来像=Escメニュー集約に沿う最小形)。空スロット行は
  選択不可(MenuListが初期カーソルでスキップする性質をE2Eの決定論に利用)
- **M8完了**: BACKLOG「装備システム」にチェック
- 次にやること: BACKLOG次点「スキル拡充(主人公のスキルツリーまたは
  レベル習得スキル5種以上)」をM9として展開してから着手(ゲームロジック中心=
  subagent委譲が主体。スキル選択UIの拡張のみオーケストレーター)

## [32] 2026-07-06 M9展開+M9-1: スキルのレベル習得機構

- やったこと(BACKLOG「スキル拡充」をM9として3分割で展開し、M9-1を完了。
  実装はsubagent=Opus、事前調査=Explore、検収・コミットはオーケストレーター):
  - 仕様骨子: game-design.mdへ「スキル(拡張: M9)」節を新設し**5種の仕様表を確定**:
    焔の一閃(Lv1・攻×1.8・MP4)/安らぎの灯(Lv1・回復45・MP5)/
    澱み斬り murk-cleave(Lv3・攻×1.3+毒付与・MP5)/灯守りの構え warding-stance
    (Lv4・防御+8を3ターン・MP6)/焔尽くし blaze-ender(Lv6・攻×3.0・MP12)。
    習得はレベルから純粋導出(セーブ非保存を明記)
  - shared: skills.ts へ learnLevel・SKILL_ORDER(enum宣言順に自動追随)・
    isSkillLearned・skillsForLevel(習得Lv昇順→同Lvは定義順。範囲外は例外でなく空)。
    INITIAL_SKILL_IDS は skillsForLevel(1) へ整理
  - battle.ts: validateCommand へ未習得拒否(判定順: 未知ID→未習得→MP不足)。
    reject理由 skill-not-learned を union/zod/文言(「その術は、まだ会得していない。」)へ追加
  - battle-scene: スキルメニューを skillsForLevel(view.player.level) 導出へ
    (viewBattleSchema.player.level が既存。ラベル・レイアウト不変=M9-3の範囲)
  - テスト10件追加(skillsForLevelの境界・未習得拒否でラウンド不進行等。unit 611)。
    既存の combat-balance.test は無改変で緑(既存2種Lv1習得のため挙動不変)
- 検証: `pnpm check` 緑(unit 611)・`pnpm test:e2e` 11/11緑(検収時に再実行)
- 次にやること: M9-2(新スキル3種+新効果種の戦闘エンジン拡張)をsubagentへ委譲。
  申し送り: (1) skillIdSchema へ3ID追加+SKILLS 3定義(skillsForLevel/検証は一般形で不変)、
  (2) 毒付与攻撃= AttackSkillDefinition に任意 inflicts、executePlayerCommand で
  dealDamage 後に inflictStatus(next,"enemy",...)(target対応済み)、
  (3) 防御バフが唯一の新機構= BattlePlayerState にバフ状態(残ターン)、
  tickStatuses の毒専用処理の一般化、dealDamage の実効防御へ加算、
  (4) inflictStatus/tickStatuses は duration・文言が毒ハードコード(battle.ts:520,527,558)
  なので一般化が必要、(5) combat-balance.test の bossPolicy(58-69行)は2スキル前提=
  新スキル込みの方策更新+勝率閾値の再検証、(6) BattleEvent へバフ演出イベント追加時は
  手書き型とzodの一致規約に注意

## [33] 2026-07-06 M9-2: 新スキル3種と新効果種(毒付与・防御バフ・強撃)

- やったこと(実装はsubagent=Opus、検収・コミットはオーケストレーター):
  - 新スキル3種を仕様表どおり実装: 澱み斬り(攻×1.3+敵へ毒付与。撃破時は付与しない)/
    灯守りの構え(防御+8を3ターン。付与ラウンドを1ターン目と数える。重ねがけは
    上書きリセット)/焔尽くし(攻×3.0の強撃)
  - バフ機構の一般化: BattlePlayerState.defenseBuff {amount, remainingTurns}。
    被ダメは playerEffectiveDefense(基礎+バフ)で計算し、ラウンド終端の tickBuffs で
    減衰・失効(buff-applied/buff-expired イベントを union+zod 両方へ追加)
  - 毒ハードコードの一般化: STATUS_DEFS(status.ts)へ duration・tickダメージ・
    文言を集約し、inflictStatus/tickStatuses が表から引く形に(文言・数値は従来と同一)
  - クライアントは最小対応(新イベントは message を持ち既存の逐次表示に乗る。
    applyEventToView へ no-op 2ケース追加)
  - テスト16件追加(unit 622)。combat-balance の bossPolicy を新スキル込みへ更新し
    **全閾値を緩めずクリア**(Lv5勝率85.7%・Lv6 100%)
- 検証: `pnpm check` 緑(unit 622)・`pnpm test:e2e` 11/11緑(検収時に再実行)
- subagentの正直な所見(記録): warding-stance はボス戦の削り合い(Lv5)では
  net-negative(1回使うと勝率85.7%→30.3%)のため、bossPolicy は Lv7-8 の余力時のみ
  使用する方策とした。バフの挙動担保はユニットテスト側(被ダメ-4・3ターン失効・上書き)。
  スキル数値・閾値は不変更
- 次にやること: M9-3(UI対応+E2Eスモーク)。**UI作業のためオーケストレーター自身が実装**。
  申し送り: (1) スキルサブメニューは5種でMenuList高さ174px・原点 y=height-264 固定のため
  レイアウト確認と必要なら位置調整(battle-scene.ts:507-531付近)、(2) 防御バフは
  battleUnitViewSchema(hp/maxHp/statuses)に載らずイベントでのみ伝わる=常設表示を
  出すならビュー拡張が必要(毒アイコンは statuses で常設)、(3) E2Eスモークは
  スキル選択→効果反映(startLevel加速でLv3+にして澱み斬り→毒付与を data 属性で観測が
  一案。battle-scene の data 属性は現状 data-scene/data-battle-enemy のみ=属性追加が要る)

## [34] 2026-07-06 M9-3: スキルUI調整+E2Eスモーク(M9完了)

- やったこと(UI作業のためオーケストレーター自身が実装):
  - サブメニューのレイアウト修正: スキル5種で高さ174pxとなり固定位置(y=height-264)では
    メッセージ窓(上端 height-112)に22px重なるため、項目数に応じて窓の上へ下詰め配置に変更
    (menu-list.ts へ menuListHeight(itemCount) を公開し、内部定数と一致を保つ)。
    Lv6実プレイで5種表示がどうする?窓に重ならないことをスクリーンショット確認
  - E2E同期点: battle-scene の syncDomState へ data-player-mp / data-enemy-status /
    data-battle-mode を追加し、コマンド入力フェーズ毎(openCommandMenu)に更新
  - E2Eスモーク skill.spec.ts(12本目): seed=42+startLevel=3 で霧狼(HP20)へ
    澱み斬り(Lv3ダメージ13-16=確実に生存)→ MP15→10 と毒付与を data 属性で検証。
    メッセージ送りの Space が「たたかう」を誤発火しないよう data-battle-mode を
    「確認してから1回押す」方式で使用
  - **E2E順序依存バグの修正**: save-load.spec がテスト専用セーブを消さずに残し、
    直後に新規開始する spec(新設の skill.spec が初該当)が上書き確認ダイアログで詰まる
    問題を再現・特定。dream.spec の既存流儀(「後続スペックのため必ず消す」afterEach)を
    save-load.spec にも適用し、skill.spec 側も先行セーブ残留に耐える開始処理にした
  - 習得レベル表示は見送り(メニューは習得済みのみ列挙するため表示する意味が薄い。
    未習得のグレー表示が欲しくなったら再検討)
- 検証: `pnpm check` 緑(unit 622)・`pnpm test:e2e` **12/12緑**・
  `pnpm test:e2e:full` 2/2緑(M9完了のマイルストーンゲート)。
  実プレイ(Lv6)で5種メニューのレイアウトをスクリーンショット確認
- 既知の観察: E2Eスモーク全体が5.8分(仕様の「数分以内」の上限近く)。
  次にspecを足す際は所要時間の再点検を(必要なら分割・短縮を検討)
- **M9完了**: BACKLOG「スキル拡充」にチェック
- 次にやること: BACKLOG次点「敵バリエーション追加(雑魚+3種、中ボス1種。
  codex委譲でグラフィックも生成)」をM10として展開してから着手
  (敵定義・行動・配置=subagent、グラフィック=codex委譲(asset-pipeline.md)、
  検収・コミット=オーケストレーター)

## [35] 2026-07-06 M10-1: 新敵4種の定義と出現(敵バリエーション基盤)

- やったこと(実装=subagent。グラフィックは M10-2 で codex 委譲):
  - ロア/仕様追記: world-lore.md に §4.1「敵バリエーション(拡張: M10)」+ §5用語集4件、
    game-design.md 敵表直後に「敵バリエーション(拡張: M10)」小節(区分・出現マップ・
    推奨レベル帯・中ボス出現方式)を追記(既存記述の変更なし・追記のみ)
  - 新敵4種を定義(shared): 迷い火 `wisp-flame`(フィールド Lv1-2)/囁き仮面
    `whisper-mask`(浅層 Lv2-3)/錆喰い `rust-eater`(深層 Lv3-4)/中ボス 紡ぎ損ない
    `failing-spinner`(2層 Lv4-5)。enemyIdSchema・ENEMY_DISPLAY_NAMES・ENEMIES・
    ENEMY_MOVES(新技6種)へ追加。既存4敵の数値・挙動は不変
  - 出現プール: field=霧狼+迷い火 / d1=蝋燭喰らい+囁き仮面 / d2=既存2種+囁き仮面+錆喰い /
    d3=軋み人形+錆喰い。**シンボル数レンジ(2-3 / 各層2-6)は不変**
  - 新雑魚3種は `RESPAWNABLE_ENEMY_IDS` に追加(リスポーン=出現可)。ただし
    **`HuntTargetId`(ai/hunt.ts)は既存3種のまま据え置き**(将来拡張)。よって
    RESPAWNABLE と HUNT_TARGET_IDS の「一致」不変条件を「HUNT⊆RESPAWNABLE(hunt対象は
    必ずリスポーン)」へ更新(ai-enums.test)。propose_quest のホワイトリストは無変更
  - 中ボス出現方式(裁量設計): dungeon-2 の側室 (17,8)(背骨道 x=11 外)に**占有マーカー**
    `midBoss` を1体固定配置(最終ボス `boss` とは別枠)。map.ts へ `midBoss`/`midBossAt`/
    `isOccupied` 拡張。踏み込み=戦闘、撃破は `gimmicks` に `midboss:<id>` 記録して
    リスポーンなし(旧セーブは既定=未撃破で互換。gameStateSchema 変更不要)。撃破後は
    定型 dialog で再戦不可。`isBoss=false` とし**メインクエスト進行/エンディングを誘発しない**
    (逃走は可能)。撃破フラグは resolvedObjectIds に載せてクライアントのマーカーを非表示化
  - クライアント: battle-scene ENEMY_COLORS / exploration-scene SYMBOL_COLORS に新4色
    (グラフィック未生成=退避描画で動作)。exploration-scene に中ボスマーカー描画 `drawMidBoss`
  - テスト: enemies.test(新規=定義妥当性を全敵横断)/encounter(新雑魚の実出現・レンジ不変・
    中ボス非出現)/ai-enums(HUNT⊆RESPAWNABLE)/combat-balance(推奨帯検証)/session
    (中ボス戦・撃破記録・再戦不可・エンディング非誘発・背骨道非閉塞)/maps(field species)
  - **seed=42 問題への対処**: フィールドのプール拡張で seed=42 の最寄りシンボルが
    霧狼→迷い火 に変化。battle.spec は「敵種をサンプリング結果から動的導出」する方式へ更新
    (検証意図=接触→勝利→復帰は不変。むしろサーバー/テストの敵種一致検証に強化)。
    skill.spec は澱み斬りで敵が生存する必要があるため、迷い火(HP16=倒しきる)を避け
    霧狼(HP20=生存)を明示的に狙う BFS へ更新(他シンボルは壁扱いで別戦闘を回避)
- 数値根拠(300シード純関数sim・通常攻撃): 迷い火 Lv1勝率100%(2-3ターン。霧狼相当の
  最序盤)。囁き仮面 Lv3=100%/Lv1=全滅(蝋燭喰らいと軋み人形の中間)。錆喰い Lv4=99%/
  Lv2=全滅(軋み人形と同格の閾値)。紡ぎ損ない(中ボス。heal+ember相当) Lv5≈100%/Lv4≈88%/
  Lv2-3=全滅(HP96=夢喰いHP150より弱く雑魚より格上。推奨Lv4-5)
- 検証: `pnpm check` 緑(unit **676**・typecheck/lint/build/secretscan)・
  `pnpm test:e2e` **12/12緑**(5.6分)。既存の敵・ボスの数値/挙動・防御仕様は不変
- 裁量で決めたこと: 敵ID/技ID命名(英語)・ステータス/報酬値・中ボス配置座標(17,8)・
  中ボス出現方式(占有マーカー+gimmicks撃破記録)・プレースホルダー色・narrate定型文
- 既知の申し送り: (a) 新雑魚の hunt 対象化は未実施(HuntTargetId 据え置き)。将来
  `HUNT_TARGET_IDS` へ追加すれば propose_quest 対象に昇格可(drift テストは部分集合で許容済み)。
  (b) ROADMAP の M10-1 チェックと commit はオーケストレーター(検収後)。本セッションは未コミット
- 次にやること: **M10-2**(codex委譲で敵グラフィック4種を生成)。外見典拠は world-lore.md
  §4.1(迷い火=青白い炎/囁き仮面=罅の白面/錆喰い=錆歯車の蛭状/紡ぎ損ない=崩れた織機・
  2形態)。サイズは既存踏襲で雑魚3種 512x512・中ボスは 512 か 768(ボス級演出なら 768x768)。
  manifest 追加時は id=敵ID(wisp-flame等)で一致必須。battle-scene は `textures.exists(enemyId)`
  で自動的に画像へ切替(未生成時は退避描画のまま)。中ボスは isBoss=false のため戦闘スロットは
  通常サイズ(ENEMY_SLOT_HEIGHT)で表示される点に留意

## [36] 2026-07-06 M10-2: codex委譲で敵グラフィック5枚を生成・検収(M10完了)

- やったこと(生成=codex(mcp__codex__codex)、検収・組み込み確認・コミット=オーケストレーター):
  - codexへ委譲(AGENTS.md/asset-pipeline.md/world-lore §4.1 の外見典拠・既存プロンプト
    書式・クロマキー手順を依頼に含めた): 迷い火/囁き仮面/錆喰い/紡ぎ損ない(1形態)/
    紡ぎ損ない(2形態)の**5枚**(512x512 背景透過PNG)を assets/enemies/ へ納品。
    prompts/<id>.md 5件と manifest.json 5エントリも codex が登録
  - 検収: 目視で5枚ともロアに忠実(迷い火=芯の燈心が透ける青白い炎/仮面=罅と空洞と靄/
    錆喰い=錆歯車の蛭状+黒い靄/紡ぎ損ない=織機の巨躯と垂れ糸、2形態=糸が焼け落ち
    紡錘が逆回転する演出でシルエット維持)。manifest整合・PNG署名・宣言サイズ一致・
    prompt実在・id一意は pnpm check 内の manifest テストで機械検証
  - **UIバグ修正(オーケストレーター自身)**: 戦闘の形態変化(phase-change)の画像切替が
    `dream-eater-phase2` にハードコードされており、形態変化を持つ紡ぎ損ないで
    夢喰いの画像へ化ける潜在バグ。`<敵ID>-phase2` の規約で引く汎用形へ修正
    (failing-spinner-phase2 がこの規約で自動適用される)
  - 実プレイ確認: seed=42 のフィールドで迷い火との戦闘を開始し、戦闘画面での
    表示(透過・トーン整合)をスクリーンショットで確認
- 検証: `pnpm check` 緑(unit 675。manifest検証含む)・`pnpm test:e2e` 12/12緑・
  **`pnpm test:e2e:full` 2/2緑**(M10完了のマイルストーンゲート)
- **M10完了**: BACKLOG「敵バリエーション追加」にチェック
- 人間確認待ち: 紡ぎ損ない(中ボス)の実プレイでの形態変化演出の体感確認
  (dungeon-2 側室 (17,8)。機械検証と画像検収は済み)
- 次にやること: BACKLOG次点「NPCの記憶の活用強化(会話要約の質・粒度の改善、
  好感度による態度変化の拡充)」をM11として展開してから着手(AI統合系=
  ai-integration.md/ai-guardrails.md を熟読のこと。防御仕様は弱めない)

## [37] 2026-07-07 M11展開+M11-1: 好感度の段階と商人の決定論的割引

- やったこと(BACKLOG「NPCの記憶の活用強化」をM11として3分割で展開し、M11-1を完了。
  事前調査=Explore、実装=subagent=Opus(APIエラー中断から SendMessage で再開・完遂)、
  検収・コミット=オーケストレーター):
  - 仕様骨子: game-design.mdへ「好感度の段階(拡張: M11)」小節(4段階:
    0-19警戒/20-49よそよそしい(初期30)/50-79打ち解けた/80-100信頼。50境界は
    give_item解禁閾値と一致=メタテストで担保)。ai-integration.mdへ注記4行
    (段階はエンジン側の決定論的写像。ツール権限・±10/2回/日次±20・50ゲートは不変)
  - shared: affinityTierSchema/AFFINITY_TIERS(日本語名つき段階表)/affinityTier純関数
    (npc.ts)。shop.tsへ段階割引: 買値=打ち解けた5%引き・信頼10%引き
    (割引額floor)、売値=信頼+5%(**同好感度の割引後買値を上回らないクランプ**=
    買い戻し往復のゴールド増殖防止。全品x好感度0-100の全数テスト)
  - server: 開店時のstockを商人好感度で構築し、shopBuyの請求も同じ関数で計算
    (**表示と請求は常に一致**)。売値増しの配線は見送り(クライアントの売値ラベルが
    sellPriceOf直参照のため、先に適用すると表示と実受取がずれる。M11-3で表示と同時配線)
  - テスト19件追加(unit 675→696)。防御(ツール検証・プロンプト・出力壁)は無変更で
    攻撃リグレッション全緑
- 検証: `pnpm check` 緑(unit 696)・`pnpm test:e2e` 12/12緑(検収時に再実行)。
  初期好感度30は「よそよそしい」=無割引のため既存E2E(equipment 60G購入等)は不変
- 運用メモ(subagent発見): 対話用に起動したままの `pnpm dev` が残っていると、
  PlaywrightのreuseExistingServerがそれを再利用し、既存クライアントにWS単一枠を
  奪われてE2Eが大量に落ちる。E2E前にポート5173/3000の残留プロセスを確認・停止すること
  (JOURNAL[23]の運用メモと同根。今回は人間セーブ・監査ログへの汚染なしを確認済み)
- 次にやること: M11-2(liveプロンプトの段階別態度指示+要約プロンプトの質改善)を
  subagentへ委譲。申し送り: affinityTier/affinityTierDefinition(日本語名つき)を
  prompt.ts の <npc_state> 組み立てで利用可。憲法骨格(constitution.ts:7)・
  neutralizeTags・SUMMARY_MAX_LENGTH(200)・出力壁は不変。要約の質改善は
  構造化指示(事実・約束・呼び名・感情の優先順)をsummaryプロンプトのタスク文に足す形

## [38] 2026-07-07 M11-2: liveプロンプトの段階別態度指示と要約プロンプトの質改善

- やったこと(実装はsubagent=Opus、検収・コミットはオーケストレーター。変更は
  prompt.ts+テスト+仕様注記の3ファイルのみ):
  - 会話プロンプト: <npc_state> の好感度行を「好感度: N/ 段階: <日本語名>」に拡張し、
    段階別の態度指示(警戒=素っ気なく受け流す/よそよそしい=礼は尽くすが距離を保つ/
    打ち解けた=噂を自分から少し零す/信頼=本音まで率直に)+「人物設定が態度より優先」の
    注記を注入。**指示文はサーバー管理の固定定数**(NPC_PERSONAと同じ信頼クラス)のため
    neutralizeTags 対象外(可変テキストの無害化経路は全て不変=テストで担保)
  - 要約プロンプト: タスク文を構造化(優先順: (1)約束・依頼・貸し借りの事実
    (2)旅人の呼び名・口調の癖 (3)NPCの感情の変化。具体は残し社交辞令は省く)。
    既存要約がある場合のみ「古い出来事は圧縮してよいが新しい約束は必ず残す」を追加。
    200字・置換方式・ツール不使用・出力壁は不変(SUMMARY_MAX_LENGTHを定数参照化)
  - ai-integration.md「会話セッション管理」へ態度指示の渡し方を11行追記
    (game-design.md (a)項の前方参照の実体化=既存要件の変更なし)
  - テスト7件追加(段階切替・49/50境界・好感度未供給の前方互換・要約構造化。unit 703)。
    constitution.ts・mock.ts・ツール検証・出力壁・監査は無変更=攻撃リグレッション全緑
- 検証: `pnpm check` 緑(unit 703)・`pnpm test:e2e` 12/12緑(検収時に再実行)
- 人間確認待ち: live での態度変化・要約質の体感確認(プロンプト変更はモックでは
  文言組立てのみ検証。実AIでの応答品質は `pnpm test:ai-live`+実プレイで)
- 次にやること: M11-3(UI: 会話画面の関係性暗示表示+売値増しの配線と表示の同時切替)。
  **UI作業のためオーケストレーター自身が実装**。申し送り: (1) 段階は
  affinityTier/affinityTierDefinition(shared)。数値は出さず雰囲気のみ、
  (2) 売値: adjustedSellPrice は実装済み。クライアントの売値ラベルが sellPriceOf
  直参照のため、shopSell のサーバー適用と表示を同じ値で同時に切替える
  (クライアントは商人好感度を知らない=view か stock 相当の売値伝搬が必要)、
  (3) 会話overlayへの段階表示には interaction(conversation)への tier 追加が最小

## [39] 2026-07-07 M11-3: 関係性の暗示表示と売値配線(M11完了)

- やったこと(UI作業のためオーケストレーター自身が実装):
  - view拡張(最小限): 会話 interaction へ `affinityTier`(段階のみ・数値は送らない)、
    shop interaction へ `merchantAffinity`(売値表示の同一計算用。UIに数値は出さない)
  - 会話UI: ヘッダーのNPC名の右に「― 段階名 ―」を沈んだ色(#7d8494・14px)で表示。
    snapshot毎に interaction が組み直されるため、会話中の adjust_affinity による
    段階変化にも表示が追従する(名前幅に合わせて置き直し)
  - 売値の段階増しを配線: shopSell が adjustedSellPrice(信頼+5%・買い戻し増殖防止
    クランプ込み)で請求し、クライアントの売りリスト表示も interaction.merchantAffinity
    から**同じ関数で計算**(表示と実受取が常に一致)。M11-1の「好感度80でも売却は従来価格」
    テストは配線に伴い期待値を+5%へ更新(M11-1時点で予告済みの適用)
  - テスト4件追加・1件更新(unit 706): 信頼の売却+5%/49以下は従来売値/
    shopのmerchantAffinity/会話のaffinityTier(段階変化追従)
  - 実プレイ確認: 情報屋カイとの会話で「カイ ― よそよそしい ―」の表示を
    スクリーンショット確認(初期好感度30)
- 検証: `pnpm check` 緑(unit 706)・`pnpm test:e2e` 12/12緑・
  **`pnpm test:e2e:full` 2/2緑**(M11完了のマイルストーンゲート)
- **M11完了**: BACKLOG「NPCの記憶の活用強化」にチェック
- 人間確認待ち: live での段階別態度・要約質の体感確認([38]から継続)
- 次にやること: BACKLOG次点「効果音・BGMの整備(オープンライセンス素材の選定・
  組み込み)」をM12として展開してから着手。JOURNAL[16]で縦切りは無音の判断だった
  経緯があるため、素材選定(CC0/CC-BY)・ライセンス記録(fonts/tilesの台帳方式)・
  音量設定UI・E2Eへの影響(音声はheadlessで無害)を分割の観点にする

## [40] 2026-07-07 M12展開+M12-1: SE素材の選定・同梱と音声アセット方針

- やったこと(BACKLOG「効果音・BGMの整備」をM12として3分割で展開し、M12-1を完了。
  素材の選定・同梱・台帳=オーケストレーター自身。fonts/tilesと同じCC0同梱方式):
  - asset-pipeline.mdへ「音声アセットの方針(拡張: M12)」を追記(音声はcodex対象外・
    オープンライセンス同梱(CC0優先・CC-BYは帰属記録)・台帳は assets/audio/README.md・
    読み込み失敗や音声無効環境で進行を阻害しないフェイルセーフ)
  - Kenney CC0 3パック(RPG Audio / Interface Sounds / Music Jingles)から
    SE12点を選定し assets/audio/se/ へ同梱(id=ファイル名: se-cursor/confirm/cancel/
    error/attack/skill/damage/heal/coin/door/levelup/victory)。
    ライセンス文3点(LICENSE-kenney-*.txt)と台帳README(用途・出典の対応表)を整備
  - 選定はファイル名・パック説明に基づく(**聴感の最終確認は人間プレイ待ち**。
    差し替えは該当idのファイル置換+台帳更新のみで可能な構造)
- 検証: `pnpm check` 緑(unit 706)・`pnpm test:e2e` 12/12緑(コード変更なし・
  アセット+ドキュメントのみ)
- 次にやること: M12-2(SE再生基盤+配線)をsubagentへ委譲。申し送り:
  (1) 台帳のid 12種を assets/audio/se/<id>.ogg から直接ロード(manifest対象外。
  preload-sceneのフォント/タイルセットと同様の直接パス指定)、(2) サウンド
  マネージャは読み込み失敗・WebAudio無効(ユーザー操作前のautoplay制限含む)で
  無害にno-op、(3) 配線先の目安: MenuList(カーソル/決定/キャンセル)・
  battle-scene(attack/skill/damage/levelup/victory)・session応答のerror系・
  shop売買成立・マップ遷移・回復、(4) E2E(headless)が緑のまま=音声で
  タイミングを変えない、(5) 音量はまず固定定数(設定UIはM12-3)

## [41] 2026-07-07 M12-2: SE再生基盤+配線(subagent実装)

- やったこと(SE再生基盤とゲーム全体への配線。コミットはオーケストレーター):
  - サウンドマネージャ `packages/client/src/audio.ts` を新設。台帳12 idを `SE_IDS`
    (union型 `SeId`)で定数化、`seAssetPath(id)`=`assets/audio/se/<id>.ogg`。
    `playSe(scene, id)` はフェイルセーフ: scene/sound/cache欠如・**未ロード
    (`cache.audio.exists`偽)・WebAudioロック中(`sound.locked`)・音量0** で
    無音return、`sound.play`はtry/catchで握りconsole.warn。Phaser非依存の構造型
    `SoundScene` を注入口にし(font.tsのFontLoaderと同方式)、シーンからは `playSe(this,id)`
  - 音量: モジュール内 `seVolume`(既定 `DEFAULT_SE_VOLUME=0.5`)+ `getSeVolume`/
    `setSeVolume`(0..1クランプ)。M12-3の音量UIはこのsetterで可変化する受け皿
  - preload-scene: `SE_IDS` を `this.load.audio` で12点直接ロード(manifest対象外・
    フォント/タイルと同方式)。失敗は既存 FILE_LOAD_ERROR 警告のみで続行
  - vite.config: dev配信の contentTypes へ `.ogg`(audio/ogg)追加
  - 配線(イベント→SE): MenuList=カーソル移動se-cursor(実移動時のみ)/決定se-confirm/
    キャンセルse-cancel(全メニュー共通=タイトル・戦闘・各overlay・確認ダイアログを網羅)。
    battle-scene(applyEventToView)=damage/敵→se-attack・damage/自→se-damage・
    action.skill→se-skill・heal→se-heal・level-up→se-levelup・victory→se-victory。
    exploration-scene=マップ遷移開始→se-door・server-error→se-error・
    売買成立→se-coin・アイテム使用回復→se-heal
  - 売買/回復の成立観測: 探索は店開放中/インベントリ開放中に自律snapshotが来ない
    ことを利用し、要求送信時に成立待ちフラグ(awaitingCoinSe/awaitingHealSe)を立て、
    次のsnapshot(=結果)で鳴らす。失敗はserver-error(se-error)でフラグ解除。
    探索の use-item はサーバー側で heal-hp のみ成功する(解毒等はエラー)ため
    「成功=回復」が確定し se-heal 観測が正確。フラグはhandleSnapshot冒頭で取り出し
    クリアして残留を防ぐ
  - ユニットテスト `test/audio.test.ts` 11件: 12id/パス/音量クランプ/未ロード無音/
    ロック無音/scene欠如無害/音量反映/例外非伝播 等
- 検証: `pnpm check` 緑(typecheck+lint+**unit 717**+build+secretスキャン)・
  `pnpm test:e2e` **12/12緑**。配線ゼロで先にE2Eを走らせ音声ロード単独の安定性を確認
  (12/12緑・約4.5分)してから配線を追加し、配線込みでも12/12緑(約4.6分)
- 裁量で決めたこと:
  - se-attackは damage(target=enemy) 着弾時、se-damageは damage(target=player) 時に
    鳴らす(damageイベントの target を利用)。status-tick(毒等の継続dmg)は鳴らさない。
    スキルの与ダメは action.skill→se-skill の後に着弾で se-attack が重なる=溜め→斬撃の
    レイヤーとして許容
  - SE音量はジングル系も含め一律 0.5(聴感の最終確認は人間プレイ待ちのため個別バランスは
    未調整。M12-3 or 人間確認後に調整)
  - 同一フレーム重複再生の抑止は入れない(既存の入力ガードで同フレーム二重発火の経路が
    無いことを確認済み。Phaser既定の多重再生許容に従う)
  - server-errorのse-errorは探索のみ配線(戦闘のcommand-rejectedはスキル/MP不足を
    メニュー側でdisabled済みで稀のため未配線)。ROADMAP M12-1のチェック漏れも実態に
    合わせて[x]へ更新([40]で完了済みだった)
- 既知の問題(人間確認待ち):
  - 初回SEはWebAudioロック中(初回ユーザー操作=タイトル選択の前)は無音になる。
    これはautoplay制限に対する設計どおりの挙動(locked ガード)。以後は鳴る
  - 各SEの実際の聴感・音量バランス・ジングル長は人間プレイでの確認待ち(素材選定と同じ)
- 次にやること: M12-3(BGM選定・同梱+シーン別BGM切替(フェード)+音量/ミュート設定UI。
  オーケストレーター自身が実装)。SE音量UIの受け皿は `audio.ts` の
  `getSeVolume`/`setSeVolume`(0..1)。BGMは別系統(ループ/フェード)として追加し、
  BGM音量とSE音量を別スライダーにするのが素直。M12完了時に `pnpm test:e2e:full` 緑+
  BACKLOG「効果音・BGMの整備」へチェック

## [42] 2026-07-07 M12-3: BGM同梱・シーン別切替・音量/ミュート設定UI(M12完了)

- やったこと(素材同梱・BGM基盤・設定UI=オーケストレーター自身が実装):
  - BGM5曲を同梱(Kevin MacLeod / incompetech.com、**CC-BY 4.0=帰属表記必須**。
    assets/audio/README.md とルート README のクレジット節に帰属を記録):
    bgm-title(Long Note One)/bgm-town(Ossuary 6 - Air)/bgm-field(Penumbra)/
    bgm-dungeon(The Dread)/bgm-battle(Volatile Reaction)。ffmpegで112kbps・
    **120秒+フェードアウトへトリム**(容量8.3MB・デコード時間削減。ループの継ぎ目は
    フェード終端でハードカット=聴感確認は人間待ち)
  - audio.ts拡張: playBgm(ループ・フェードイン・切替時の旧曲停止・ロック解除後開始・
    「切替済みなら古い解除予約は再生しない」ゲート)/stopBgm/音量・ミュート
    (SE/BGM別音量+マスターミュート。localStorageへ永続化・復元)
  - **重要な学び(E2E赤→修正)**: 当初BGMをpreloadで読み込んだところ、WebAudioの
    デコード(当初20MB)がpreloadを数十秒塞ぎ、E2Eのタイトル操作が間に合わず10/12が赤に。
    **requestBgm(遅延読み込み)**へ変更: preloadではSEのみ読み込み、BGMはシーンが
    要求した時にシーンのローダーでバックグラウンド読み込み→完了時に「まだその曲が
    望まれているか(desiredBgm)」を確認して再生。E2E 12/12緑へ回復
  - シーン配線: タイトル=bgm-title(オープニングへ継続)/探索=マップ区分で
    town/field/dungeon/戦闘=bgm-battle(終了時は探索createが戻す)
  - 設定UI(SettingsOverlay): タイトルメニューに「設定」を追加(3項目目=既存E2Eの
    カーソル位置に影響なし)。BGM音量・効果音音量(20%刻み巡回)・ミュート(トグル)・
    とじる。変更は再生中のBGMへ即時反映+localStorage永続化。実プレイで
    変更→保存(bgmVolume 0.2/muted true)をスクリーンショット+localStorageで確認
  - テスト11件追加(BGM id/パス・切替・ロック解除・古い予約の破棄・音量/ミュート反映・
    requestBgmのゲート。unit 728)
- 検証: `pnpm check` 緑(unit 728)・`pnpm test:e2e` 12/12緑・
  **`pnpm test:e2e:full` 2/2緑**(M12完了のマイルストーンゲート)
- **M12完了**: BACKLOG「効果音・BGMの整備」にチェック
- 人間確認待ち: BGM・SEの聴感(音量バランス・トリムしたループの継ぎ目)。
  差し替えは assets/audio/ のファイル置換+台帳更新のみで可能
- 次にやること: BACKLOG次点(優先度: 高)「タイルマップ上のNPCや主人公、敵、
  一マス構造物の絵のcodex生成と反映」をM13として展開してから着手
  (人間が追加した項目。asset-pipeline.mdの「プレイヤー・NPCのマップ上の見た目も
  プレースホルダー」方針の更新を伴う。1マス=32pxのトップダウンスプライトは
  タイルマップの方針(グリッド整合性)と衝突しないよう、生成方式(1体ずつ透過生成)を
  仕様骨子で先に固めること)

## [43] 2026-07-07 M13展開+M13-1: マップ上スプライト第1弾(主人公+NPC4)のcodex生成

- やったこと(BACKLOG(人間追加)「タイルマップ上のNPCや主人公、敵、一マス構造物の
  絵のcodex生成と反映」をM13として3分割で展開し、M13-1を完了。
  生成=codex、仕様骨子・検収・コミット=オーケストレーター):
  - asset-pipeline.md「タイルマップの方針」のプレースホルダー行へ展開済み注記を追記
    (マップ上スプライト=1体ずつの透過カットアウト・256x256・見下ろし俯瞰・正面1枚・
    32px表示で読めるシルエット・納品先 assets/sprites/・kind:"sprite")
  - codexへ委譲して主人公+NPC4(オルガ/レンド/カイ/フィオル)の5枚を生成。
    prompts5件・manifest5エントリも登録
  - **人間フィードバックによる差し戻し→再生成**: 初回納品は3/4のほぼ正面向き立ち絵で、
    「もっと上から見た絵でマップのテイストに合わせるべき」との指摘を受けた。
    仕様へ視点要件(真上寄りの見下ろし俯瞰・2.5-3頭身デフォルメ・タイルに馴染む
    低彩度と単純化)を明文化し、codexへ差し戻し理由つきで再委譲。再納品5枚は
    頭・肩が大きく足元が縮む俯瞰視点になり受入(プロンプトファイルに試行記録あり)
  - 検収: 5枚とも256x256 RGBA・四隅透明・同一人物性(青灰フード外套/三つ編みと肩掛け/
    片眼鏡と革鞄/フードとコイン/法衣と灯の杖)を目視確認。manifest整合は
    pnpm check の機械検証
- 検証: `pnpm check` 緑(unit 728)・`pnpm test:e2e` 12/12緑(アセット+ドキュメントのみ。
  クライアント反映はM13-3)
- 次にやること: M13-2(codex委譲第2弾: 敵シンボル8種(雑魚6+ボス+中ボス)+
  一マス構造物3種(看板・宝箱・採取ポイント))。**視点要件(見下ろし俯瞰・タイルに馴染む)を
  依頼に必ず含める**(今回の差し戻しの教訓)。敵はマップ上の「シンボル」なので
  戦闘グラフィック(enemies/)より簡略・小サイズ感で。構造物は正面気味でも
  タイルに置けるが、俯瞰の影の付け方を揃えること

## [44] 2026-07-07 M13-2: マップ上スプライト第2弾(敵シンボル8種+構造物3種)のcodex生成

- やったこと(生成=codex、検収・コミット=オーケストレーター):
  - codexへ委譲して11枚を生成: 敵シンボル8種(symbol-mist-wolf/wisp-flame/
    candle-eater/whisper-mask/rust-eater/creaking-doll/dream-eater(ボスマーカー用・
    大きめ)/failing-spinner(中ボスマーカー用))+構造物3種(prop-sign/prop-chest/
    prop-gather)。すべて256x256透過・**見下ろし俯瞰**(前回差し戻しの教訓を依頼に
    明記し、今回は一発受入)。prompts11件・manifest11エントリも登録
  - 検収: 代表7枚を目視(霧狼=俯瞰の狼影+霧、夢喰い=歯車塊+青灰の靄、
    紡ぎ損ない=織機フレーム+垂れ糸、宝箱・看板・採取草花はタイルに置ける小物感)。
    戦闘グラフィックとの同一個体性(主要特徴の俯瞰圧縮)も良好。
    manifest整合は pnpm check の機械検証。codexは蝋燭喰らい初回の顔に見える生成を
    自主的に破棄・再生成(プロンプトに試行記録あり)
- 検証: `pnpm check` 緑(unit 728)・`pnpm test:e2e` 12/12緑(アセットのみ。
  クライアント反映はM13-3)
- 次にやること: M13-3(クライアント反映)。**UI作業のためオーケストレーター自身が実装**。
  申し送り: (1) exploration-scene の createPlayer(矩形+向きドット)・drawNpcs(円+名前)・
  updateEnemySymbols(SYMBOL_COLORS の図形)・drawBoss/drawMidBoss・drawObjects
  (OBJECT_COLORS の矩形)をスプライト画像へ差し替え(textures.exists で存在確認し
  無ければ既存プレースホルダーへ退避)、(2) スプライトは manifest 経由で preload 済み
  (kind:"sprite" も画像として読み込まれる=preload-scene は全エントリを load.image する)、
  (3) 32px マスに対する表示サイズはやや大きめ(例 30-34px 高)で足元をマス中心へ、
  (4) プレイヤーの向き表示は既存の向きドットを継続(仕様どおり)、
  (5) 実プレイのスクリーンショットでタイルとの馴染みを確認(ユーザーの美術方針
  フィードバック=memory 参照)

## [45] 2026-07-07 M13-3: マップ上スプライトのクライアント反映(M13完了)

- やったこと(UI作業のためオーケストレーター自身が実装):
  - exploration-scene に mapSprite ヘルパー(textures.exists で存在確認し、
    未整備なら null=呼び出し側が既存プレースホルダー図形へ退避)を新設し、
    全描画を差し替え: プレイヤー(sprite-player 42px+向きドット継続。ドット色は
    スプライト時=琥珀/退避矩形時=暗色)、NPC4(sprite-<npcId> 42px+名前ラベル)、
    敵シンボル(symbol-<enemyId> 34px+既存の脈動tween)、ボス(symbol-dream-eater
    56px)、中ボス(symbol-failing-spinner 48px)、構造物(prop-<kind> 30px。
    objectViews の型を Rectangle|Image へ拡張し解決済み非表示は不変)
  - 実プレイ確認: 街(NPC4人+主人公+看板)とフィールド(迷い火・霧狼のシンボル、
    採取ポイント、看板)のスクリーンショットで、見下ろし俯瞰スプライトがタイルに
    馴染むことを確認(ユーザーの美術方針フィードバック=memory 準拠)
- 検証: `pnpm check` 緑(unit 728)・`pnpm test:e2e` 12/12緑・
  **`pnpm test:e2e:full` 2/2緑**(M13完了のマイルストーンゲート)
- **M13完了**: BACKLOG「タイルマップ上のNPCや主人公、敵、一マス構造物の絵の
  codex生成と反映」にチェック
- 人間確認待ち: スプライトの見た目の好み(サイズ感42/34px等は裁量値。
  調整は displaySize の定数変更のみ)
- 次にやること: BACKLOG次点「タイルマップの絵の正しい適用(向き差分に基づいた
  適切なタイル絵の配置)」をM14として展開してから着手(壁の向き・接続に応じた
  タイルフレーム選択=いわゆるオートタイル。Kenneyシートには方向別の壁・角の
  フレームがあるため、tile-frames.ts の割当を近傍参照(ビットマスク)で拡張する
  設計が本命。ロジック中心=subagent委譲、見た目確認=オーケストレーター)

## [46] 2026-07-07 M14展開+M14-1: 壁タイルの向き差分(正面/上面の2段構え)

- やったこと(BACKLOG「タイルマップの絵の正しい適用(向き差分)」をM14として
  2分割で展開し、M14-1を完了。実装=subagent(Opus)、検収・コミット=オーケストレーター):
  - shared/map.ts へ純関数 isWallLike(map, pos)(壁 or マップ範囲外=壁扱い。
    境界の見た目が破綻しない。水などの他solid種は壁扱いしない)
  - tile-frames.ts へ wallFrame(mapId, southIsWall): 南が非壁=壁の正面
    (現行フレームと単一出所=ドリフトしない)/南も壁=上面・内部フレーム
    (WALL_TOP_FRAMES。12行目のボーダー付き無地ブロック=**暫定値・M14-2で目視調整**)
  - exploration-scene の drawTilesFromTileset に壁のみの分岐(他タイル種は不変)。
    4近傍マスクは作らず南のみ判定(過剰設計回避。角対応は将来 isWallLike で拡張可能な形)
  - テスト7件追加(isWallLike境界・正面=現行値の回帰・正面≠上面・3層同一。unit 735)
- 検証: `pnpm check` 緑(unit 735)・`pnpm test:e2e` 12/12緑(検収時に再実行)
- 次にやること: M14-2(全マップの実プレイ確認とフレーム座標の目視調整)。
  **オーケストレーター自身が実装**。調整対象は tile-frames.ts の WALL_TOP_FRAMES
  1箇所のみ(frameAt(列,行)の差し替え)。確認観点: 街の建物ブロック・境界壁の
  上面/正面の立体感、フィールド・ダンジョンの外周。必要なら水・道の縁取りも検討し、
  過剰なら見送ってよい(完了条件は壁の向き差分)。完了時にM14ゲート
  (test:e2e:full)+BACKLOGチェック

## [47] 2026-07-07 M14-2: 壁上面フレームの目視調整(M14完了)

- やったこと(オーケストレーター自身が実装。UI/見た目調整):
  - ゲームと同一ロジック(wallFrame+isWallLike+tint)で全5マップのタイル層を
    合成プレビューするスクリプトを scratchpad に作成し、暫定の上面フレーム
    (シート12行目のボーダー付きブロック)を確認 → 縦積みで横縞に見える問題を発見
  - 候補比較(12/14/15行目を縦積み+正面と合成)の結果、15行目の縁取り石ブロックへ
    差し替え: town=(14,15)/field=(21,15)/dungeon=(28,15)。変更は WALL_TOP_FRAMES のみ
  - dev:mock+Playwrightで実プレイ表示(街)も確認。建物の上面/正面の二段が機能し、
    外周も石積みとして自然。角・水/道の縁取り拡張は現状で読めるため見送り(裁量)
- 検証: `pnpm check` 緑(unit 735)・`pnpm test:e2e` 12/12緑・
  **`pnpm test:e2e:full` 2/2緑**(M14完了のマイルストーンゲート)
- **M14完了**: BACKLOG「タイルマップの絵の正しい適用(向き差分)」にチェック
- 既知の問題(フレーク観察): e2e一括実行で conversation.spec が2回連続
  「サーバー: 別画面に接続されました」で失敗→単体・再実行では緑(12/12)。
  直前まで目視確認用の dev:mock+MCPブラウザを使っていた環境干渉が濃厚。
  再発したらこの署名(別画面に接続されました=WS接続の横取り)を手がかりに、
  スイート内の前テストの page close とWS再接続の競合を疑うこと
- 次にやること: BACKLOG次点「全体的なUI/UXの検証・修正」をM15として展開してから着手
  (タイトル画面にタイトルが二つある問題(実プレイ確認でも再確認済み: canvas内
  タイトルとDOMヘッダーが重複)、操作キーの説明画面、subagentに実プレイさせて
  改善点を列挙→修正。調査=subagent委譲、UI修正=オーケストレーター)

## [48] 2026-07-07 M15展開+M15-1: 実プレイUX点検(subagent委譲)

- やったこと: BACKLOG「全体的なUI/UXの検証・修正」をM15として展開(M15-1〜4)。
  M15-1のUX点検をsubagent(Opus)へ委譲: SAVE_DIRを一時ディレクトリへ切替えた
  dev:mock+Playwrightで新規開始→探索→会話→店→メニュー→戦闘→宿・夢→設定→
  つづきから、を実操作で巡回(人間セーブは保護。環境は停止・掃除済み)
- 結果(改善点13件。詳細な期待像・ファイルの当たりはROADMAP M15-2〜4に反映):
  - 既知2件は事実と確認: (1)DOM h1が全シーンに常時被さる(タイトル二重の実体。
    E2Eがh1を参照するため削除でなくsr-only等で隠す) (2)操作キー説明が皆無+
    オーバーレイ間で案内表記が不統一
  - P2: 設定音量がEnter連打で下がる一方(左右キー無反応) / 消耗品の効果説明なし /
    対話可能オブジェクトの手掛かりなし(看板を鉄床と誤認) / 勝利時の戦果表示なし
  - P3: 接続ステータス常時表示 / 店の即時購入(確認・成功表示なし) / OP一括スキップ不可 /
    セーブ有時も初期カーソルが新規 / 撃破後も敵絵が残る / 横長窓の黒帯 / 宿確認文の折返し
  - 良かった点(直さない): 戦闘UIの明快さ、会話UI(立ち絵+気分タグ+選択肢+入力案内)、
    クエスト誘導と宿の確認文の親切さ、セーブ/ロードとリサイズの堅牢さ
- 検証: docs のみの変更(コード無変更。直前コミットでcheck/e2e/e2e:full全緑)。
  `pnpm check` は本コミット前に再実行して緑を確認
- 次にやること: M15-2(タイトル二重解消+操作キー説明画面+オーバーレイ案内の統一。
  **UI=オーケストレーター自身が実装**)。h1/#connection-statusはE2E参照のため
  視覚的に隠すだけにする(style.cssのコメント参照)。ヘルプはタイトルとメニューの
  両方から出せると理想だが、最小はタイトル画面のフッター常設+探索HUDへのキーヒント

## [49] 2026-07-07 M15-2: タイトル二重解消+操作キーの常設ヘルプ(UI=オーケストレーター)

- やったこと:
  - style.css: DOMのh1を1pxクリップ(clip-path+overflow)で視覚的に不可視化。
    display:none/visibility:hiddenはE2Eの toBeVisible(10スペックが参照)が落ちるため
    「存在するが見えない」方式を採用(スクリーンリーダーにも残る)。
    これでタイトル画面の二重表示と、全シーン上部への常時被さりが解消
  - title-scene: 画面下端に操作キーの常設ヘルプ1行
    (移動 ↑↓←→/WASD ・ 調べる/決定 スペース ・ もちもの Esc ・ クエスト Q)
  - exploration-scene: 右下に常設キーヒント(スペース/Esc/Q。リサイズ追従)
  - settings/inventory/shop の3オーバーレイにタイトル行右肩の操作ヒントを統一様式で追加
    (下部はmessageText帯と衝突するため右肩に配置。dialog-boxの文体を踏襲)
- 検証: `pnpm check` 緑(unit 735)・`pnpm test:e2e` 12/12緑(h1クリップ方式の回帰なし)。
  dev:mock+Playwrightでタイトル・探索・もちものの実表示を目視確認
- 次にやること: M15-3(UX点検のP2群+軽量P3)。内訳はROADMAP参照。
  設定音量の左右キー増減(settings-overlay+menu-listへの左右キー通知が必要かも)/
  消耗品の効果説明(効果値はshared側の定義から引く=ロジック寄りはsubagent)/
  オブジェクトの視覚的手掛かり/勝利時の戦果表示(resolveVictoryの戻りに
  xpGained/goldGainedあり=表示のみ)/接続ステータス自動非表示/タイトル初期カーソル/
  宿確認文の折返し。ロジック(shared/server)=subagent委譲、UI=オーケストレーター

## [50] 2026-07-07 M15-3前半: 純UIの4件(UI=オーケストレーター)

- やったこと(M15-3の7件中、shared/serverに触れない純UIの4件を先行):
  - 設定音量の左右キー増減: menu-list に onAdjust オプション(←→/A/Dキー。
    渡したメニューだけが左右キーを受ける=探索のA/D移動と競合しない)を追加し、
    settings-overlay で音量±20%(端で停止。Enterの巡回は従来どおり)。ヒント文言も更新
  - 接続ステータスの自動非表示: 「サーバー: 接続済み」の間は1pxクリップで視覚的に隠す
    (title.spec が接続済みテキストの可視性を同期点にするため display:none は不可。
    h1と同じ方式)。異常時(再接続中・別画面・応答異常)は従来どおり表示
  - セーブ有時のタイトル初期カーソル=「つづきから」(buildMenu の initialIndex)。
    **save-load.spec の ArrowDown 前提を Enter 一発に更新**(仕様変更に伴うテスト追随)
  - 宿確認文の折返し: 明示改行で「)」の孤立を解消
- 検証: `pnpm check` 緑(unit 735)・`pnpm test:e2e` 12/12緑。
  dev:mock+Playwrightで初期カーソル・左右キー増減(0%⇔20%)・接続表示の非表示を目視確認
- 次にやること: M15-3後半の3件。(1)消耗品の効果説明1行=sharedのアイテム定義から
  効果値を引く純関数(subagent委譲+ユニットテスト)→もちもの/店のUI表示(私)、
  (2)勝利時の獲得EXP/ゴールド表示=resolveVictoryの戻り(xpGained/goldGained)が
  クライアントのbattle viewへ届いているか確認から(届いていればUIのみ)、
  (3)対話可能オブジェクトの視覚的手掛かり=UI(点滅・光彩等の軽い演出)

## [51] 2026-07-07 M15-3完了: 効果説明・戦果表示・調べられる手掛かり(UI=オーケストレーター)

- やったこと(M15-3後半3件。着手前の調査で、sharedに必要な定義が全て揃っている
  ことを確認=ITEMS[].battleEffect / 勝利イベントのxpGained・goldGained・drops。
  そのため全件クライアントUIのみで完結し、subagent委譲は不要だった):
  - 消耗品の効果説明: ui/item-labels.ts の itemShortLabel を新設
    (装備=攻/防ボーナス(M8-4表記の踏襲)、消耗品=(HP+30)/(毒を治す))。
    もちもの・店の重複していたボーナス表記関数を本関数へ統一。テスト4件(unit 739)
  - 勝利時の戦果表示: battle-scene の advanceMessage で勝利イベントに
    「経験値Nと Mゴールドを得た。(+ドロップ名)」を合成
  - 調べられる手掛かり: 看板・宝箱・採取点の上に琥珀色の小さな灯(circle)を
    浮かべ、ゆっくり明滅+上下(tween)。解決済み(開封・採取済み)は
    objectViews 経由でオブジェクトごと非表示(既存機構に相乗り)
- 検証: `pnpm check` 緑(unit 739)・`pnpm test:e2e` 12/12緑。
  dev:mockで灯の明滅と「回復薬(小)(HP+30) ×2」表示を目視確認
- **M15-3完了**。次にやること: M15-4(残りP3: 店の購入確認・成功フィードバック・
  買えない品の区別 / OPの一括スキップ / 撃破時の敵フェードアウト / 横長窓の黒帯改善。
  裁量で一部見送り可=見送りは理由をJOURNALへ)。完了時にBACKLOGチェック+
  M15ゲート(test:e2e:full)

## [52] 2026-07-07 M15-4: 残りP3の修正(M15完了。UI=オーケストレーター)

- やったこと(4件):
  - 店: 売買成立時に「取引が成立した。」を通知行へ表示(se-coinの成立確定と同じ
    awaitingCoinSe経路)+資金不足の品を無効化(選択不可・灰色表示。snapshot毎に再評価)。
    **購入確認ダイアログは見送り**(裁量。理由: 1個単位の安価な購入で、無効化により
    誤操作の主因=買えない品への決定が消えるため、確認は手数の増加が上回る)
  - オープニング: Escで演出全体を一括スキップ(cinematic共通実装のため
    エンディングでも有効)。送りプロンプトに「(Esc: とばす)」を明記
  - 戦闘勝利: 敵スプライトを700msでフェードアウト(「崩れて消える」文と一致)
  - 黒帯解消: 探索カメラを contain(全体表示+黒帯)→ cover(画面を必ずタイルで
    埋める+プレイヤー追従スクロール)へ変更。applyWorldZoomのmin→maxのみで、
    中央寄せマージンはリサイズ端数への防御として維持
- 検証: `pnpm check` 緑(unit 739)・`pnpm test:e2e` 12/12緑・
  **`pnpm test:e2e:full` 2/2緑**(M15完了のマイルストーンゲート)。
  dev:mockでOPのEscスキップとcoverズーム(黒帯なし)を目視確認
- **M15完了**: BACKLOG「全体的なUI/UXの検証・修正」にチェック
- 次にやること: BACKLOG「優先度: 高」は全て完了。次は「優先度: 中」の最上位
  「第2エリア(新しい街または集落+フィールド+ダンジョン。codex委譲で背景・
  NPC立ち絵生成)」をM16として展開してから着手(大きい項目のため、
  world-lore.md/game-design.mdへの骨子追記→マップ定義→NPC→接続→アセットの
  順の分割を想定。ロア・マップ定義=subagent、codex委譲・検収=オーケストレーター)
