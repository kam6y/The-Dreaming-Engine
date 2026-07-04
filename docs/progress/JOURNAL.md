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
