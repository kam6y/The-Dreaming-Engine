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
