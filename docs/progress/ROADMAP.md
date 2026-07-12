# ROADMAP — The Dreaming Engine

マイルストーンは上から順に進める。各マイルストーンの完了条件を満たし、
`pnpm check`(M1以降は`pnpm test:e2e`も)が緑で、コミット済みになったらチェックを付ける。
チェックの更新はチェック対象の作業をしたセッション自身が行う。
項目に付く運用注記(「ブロック中: 理由」「(プレースホルダー: …)」)の扱いは
`docs/prompts/`の各プロンプトの規定に従う(注記付き項目に未検証のチェックを付けない。
「ブロック中」注記の解除は人間のみが行う)。
**既存項目・完了条件の変更・削除・緩和は人間のみが行う。** Claude Codeが行ってよいのは、
チェックの更新、運用注記の付与、項目分割によるサブ項目の追加、BACKLOG展開による
M7+マイルストーンの追加のみ(既存の項目・完了条件を変えたい場合は、変えずに
JOURNALへ「仕様変更提案」として記録する)。

## M0: 環境構築

- [x] pnpm workspaceモノレポ(`shared` / `client` / `server`)の雛形
- [x] TypeScript strict / ESLint / Vitest / Playwright / `pnpm check` の整備
- [x] `pnpm dev` でPhaserの空シーン(黒背景+タイトル文字)がブラウザに表示される
      (Vite開発サーバーは`127.0.0.1`限定、`fs.deny`に`.env*`・`saves/`・`logs/`、CORS無効:
      `ai-guardrails.md`第0層)
- [x] `pnpm dev:mock` でサーバーとのWebSocket疎通(ping/pong)が確認できる
      (サーバーは`127.0.0.1`にのみbindし、Origin許可リスト検証・WS同時1接続を実装:
      `ai-guardrails.md`第0層)
- [x] `.env.example` / `.gitignore`(`.env*`(`.env.example`除く) `saves/` `logs/` `node_modules/`)整備
- [x] `pnpm check`に簡易シークレットスキャンを組み込む(`sk-ant-`等の実キー形式の
      grepガード。AGENTS.md「品質ゲート」参照)
- [x] `README.md` にセットアップ手順(認証設定含む。既定は`CLAUDE_CODE_OAUTH_TOKEN`、
      代替は`ANTHROPIC_API_KEY`: `ai-integration.md`)を記載
- [x] E2Eに「タイトル文字が表示される」スモークを追加

完了条件: 上記すべて+E2Eで「タイトル文字が表示される」スモークが緑。

## M1: マップと移動

- [x] グリッドベースのタイルマップ描画(プレースホルダータイル: 単色+簡易パターン)
- [x] プレイヤーキャラの移動(WASD/矢印)・衝突判定・カメラ追従
- [x] マップ間遷移(街⇔フィールド⇔ダンジョン各層)
- [x] 街・フィールド・ダンジョン3層のマップデータ(JSON)作成
- [x] NPC・調べられるオブジェクトの配置と、スペースキーでのインタラクション枠組み
- [x] E2Eに移動スモークを追加(街→ダンジョン最下層への到達)

完了条件: 街からダンジョン最下層まで歩いて到達できる。E2Eに移動スモーク追加。

## M2: ターン制戦闘

- [x] 戦闘計算エンジン(純TSモジュール+ユニットテスト): ダメージ式・行動順・状態異常最小1種
- [x] 戦闘シーンUI(コマンド: 攻撃/スキル/アイテム/逃走)
- [x] シンボルエンカウント(フィールド・ダンジョンの敵シンボル接触で戦闘開始)
- [x] 敵定義データ(雑魚3種+ボス1種)と敵行動パターン(決定論的)
- [x] 経験値・レベルアップ・ゴールド・戦利品
- [x] 全滅時の処理(街に戻る+ペナルティ)
- [x] E2Eに戦闘スモークを追加(エンカウント→勝利→探索復帰)

完了条件: 雑魚戦とレベルアップが機能し、戦闘ユニットテストが揃う。E2Eに戦闘スモーク追加。

## M3: インベントリ・店・セーブ

- [x] インベントリ(消耗品使用・所持上限。満杯時の挙動は`game-design.md`「成長・経済」)
- [x] 商人NPCの店(購入・売却)
- [x] 宿屋でのセーブ/ロード(サーバーが`saves/`にJSON保存、スロット1つで可)
- [x] タイトル画面から「つづきから」でロード
- [x] E2Eにセーブ/ロードスモークを追加(セーブ→タイトル→ロードの状態復元。
      テスト専用セーブディレクトリを使用: `game-design.md`「セーブ/ロード」)

完了条件: セーブ→タイトル→ロードで状態が完全復元される。E2Eにセーブ/ロードスモーク追加。

## M4: AI統合(DreamMaster)

- [x] `docs/spec/ai-integration.md` に従いDreamMaster実装(Agent SDK + カスタムMCPツール6種)
- [x] ツール検証層(純TSモジュール+ユニットテスト。仕様の上限・ホワイトリスト・クールダウンすべて)
- [x] `MockDreamMaster`(定型応答)と `AI_MODE=mock|live` 切り替え
      (未設定・不正値はmockに倒すフェイルセーフ: `ai-integration.md`)
- [x] NPC会話UI(自由入力+選択肢、検証済み全文の疑似ストリーミング表示、会話履歴・要約管理)
- [x] 酒場でのサブクエスト動的生成(`propose_quest`)とクエストジャーナルUI
- [x] 宿泊時の夢シーン→翌朝の世界変化(`trigger_world_event`)
- [x] 戦闘勝利後の戦果描写(`narrate`)
- [x] `docs/spec/ai-guardrails.md` の防御実装(境界壁・入力壁・出力壁・監査ログ)と攻撃リグレッションテスト
- [x] `pnpm test:ai-live`(実AI疎通の最小テスト)整備(実行は人間確認待ち: JOURNAL[11])
- [x] E2Eに会話・クエスト受注・夢シーンのスモークを追加(モックAI)

完了条件: モックAIでE2E(会話・クエスト受注・夢シーン)が緑。攻撃テストA(モック攻撃)が
全て防がれる。攻撃テストB(実AI)はテスト・手順の整備までがM4の範囲であり、実行は人間の
受け入れ確認として別枠(JOURNALに「人間確認待ち」と記録してM5へ進んでよい)。

## M5: アセット生成と組み込み

- [x] `docs/spec/asset-pipeline.md` のスタイルガイドに従い、codexへの委譲で生成:
      タイトル画面 / 主人公+NPC4人の立ち絵 / 敵3種+ボスのグラフィック / 背景(街・フィールド・ダンジョン・戦闘) / UI装飾
      (人間が先行納品済み=PNG26点。オーケストレーターが検収して受け入れ)
- [x] `assets/manifest.json` と `assets/prompts/` の整備(codex納品物の検収を含む)
      (manifest↔ファイル整合・PNG署名・宣言サイズ一致・prompt実在・id一意を機械検証+目視確認)
- [x] ゲームへの組み込み(会話時立ち絵表示、戦闘背景+敵グラフィック、タイトル画面)
      (OP/EDの op-1/2・ed-1/2 はM6のオープニング/エンディングで組み込む)
- [x] 日本語フォント(ダークファンタジーに合うオープンライセンスのもの)の導入
      (しっぽり明朝 Regular / SIL OFL 1.1。`assets/fonts/`にwoff2で同梱、
      起動時に読込待ちしてから全シーンへ適用。JOURNAL[24])

完了条件: プレースホルダー画像が主要シーンから消え、見た目が「ゲーム」になっている。

## M6: 縦切り完成

- [x] メインクエストライン実装(街到着→司祭の依頼→ダンジョン攻略→ボス「夢喰い」→エンディング)
- [x] オープニング・エンディングの演出(静止画+テキストで可)
- [x] BGM/SE(縦切りは**無音**の判断。オープンライセンス音源の導入はBACKLOG。JOURNAL[16]に記録)
- [x] バランス調整(Lv6到達=累積248XP・約30-40討伐、ボス撃破可・全滅も起こりうる。
      M2実測と整合。1-2時間の実感確認は人間プレイ待ち)
- [x] 通しプレイのE2E(新規→メインクエスト完遂→エンディング到達をモックAIで自動化。
      `pnpm test:e2e:full`として分離し、コミット毎の`test:e2e`スモークには含めない。
      テスト用の加速設定(XP倍率・移動速度・演出スキップ等)を使ってよい:
      `ai-integration.md`「レート・コスト保護」の注記参照。バランス目標1-2時間は
      人間プレイ想定の値であり、E2Eをこの実時間で走らせない)
- [x] README.md更新(遊び方・スクリーンショット)

完了条件: タイトル→エンディングまで人間が通しでプレイでき、`pnpm check`+全E2Eが緑。
**ここまでで縦切り完成。以降は `BACKLOG.md` に従い /loop で拡張する。**

## M7: タイルマップのグラフィック改善(BACKLOG「優先度: 高」1件目の展開)

- [x] M7-1: CC0タイルセットの取得・同梱・検収(Kenney「Roguelike/RPG pack」CC0。
      `assets/tiles/`にスプライトシート+LICENSE+出典READMEを同梱。
      PNG署名・グリッド整合(16pxタイル+1px間隔=57列x31行)を機械検証。JOURNAL[25])
- [x] M7-2: 探索マップのタイル描画をタイルセット参照へ置換(exploration-sceneの
      drawTilesをスプライトシートベースへ。16px→32pxはNEARESTフィルタで2倍表示。
      タイルセット未ロード時は既存の単色プレースホルダーへフォールバック。
      マップ(街/フィールド/ダンジョン)ごとに5種タイルのフレーム割当を定義。JOURNAL[26])
- [x] M7-3: 実プレイでの見た目確認(全5マップのスクリーンショット)と
      ダークファンタジートーンへの調整(必要ならtint/カラーオーバーレイ)。
      完了時にBACKLOG側の「タイルマップのグラフィック改善」へチェック
      (マップ区分別の乗算tintで暗色化。全5マップ踏破で確認。JOURNAL[27])

完了条件: 全マップ(街・フィールド・ダンジョン1-3層)がCC0タイルで描画され、
`pnpm check`+`pnpm test:e2e`(スモーク)が緑。

## M8: 装備システム(BACKLOG「優先度: 高」2件目の展開)

- [x] M8-1: 仕様骨子の追記(game-design.mdへ「装備」節: スロット構成(武器/防具)・
      攻防への反映式・入手経路・保存内容列挙への装備追加)+ sharedの装備データモデル
      (装備品定義・equip/unequipの純ロジック・装備込み攻防の算出関数)+ユニットテスト
      (装備4種: 錆びた片刃/琥珀刃/擦り切れた外套/灯守りの帷子。JOURNAL[28])
- [x] M8-2: サーバー統合(装備変更のWSメッセージ処理、戦闘計算への装備ボーナス反映、
      セーブ/ロード対応(装備なし旧セーブとの互換=デフォルト値)+テスト
      (equip/unequipメッセージ+実効攻防のビュー公開。JOURNAL[29])
- [x] M8-3: 店の売買対応(武器・防具の品揃え定義、購入・売却、所持上限との整合)+テスト
      (SHOP_STOCKへ装備4種を追加。既存shopBuy/shopSellは無修正で動作。JOURNAL[30])
- [x] M8-4: 装備画面UI(メニューからの装備確認・変更。オーケストレーター自身が実装)
      +E2Eスモーク1本(装備変更で攻撃力表示が変わる等)
      (もちものオーバーレイへスロット行+そうびする/はずす+実効攻防表示を統合。
      店リストにボーナス表記。E2Eは購入→装備→解除で11本目。JOURNAL[31])

完了条件: 武器・防具を店で購入して装備でき、攻防に反映され、セーブ/ロードで
維持される。`pnpm check`+`pnpm test:e2e`緑(M8完了時は`pnpm test:e2e:full`も)。

## M9: スキル拡充(BACKLOG「優先度: 高」3件目の展開。レベル習得スキル5種以上)

- [x] M9-1: 仕様骨子の追記(game-design.mdへ「スキル(拡張: M9)」節: 5種以上の一覧表=
      名称・習得レベル・効果・MP消費)+ 習得機構(sharedのskillsForLevel(level)、
      戦闘エンジンの未習得スキル使用拒否、戦闘UIのスキル一覧を習得済み導出へ)
      +ユニットテスト(既存2種はLv1習得で挙動不変)
      (仕様表5種確定: 焔の一閃Lv1/安らぎの灯Lv1/澱み斬りLv3/灯守りの構えLv4/
      焔尽くしLv6。JOURNAL[32])
- [x] M9-2: 新スキル3種以上と新効果種の戦闘エンジン拡張(状態異常付与スキル(毒)・
      防御バフ(バフ状態のフィールドとターン経過の一般化)・強撃等。
      仕様表どおりに実装+combat-balance.test の方策・閾値の再検証)
      (澱み斬り/灯守りの構え/焔尽くし実装。バランス閾値は緩めず全クリア。JOURNAL[33])
- [x] M9-3: UI対応(スキルサブメニューの5種以上レイアウト調整(高さ・位置)、
      習得レベル表示等。オーケストレーター自身が実装)+E2Eスモーク
      (スキル選択→効果反映)。完了時にBACKLOG側へチェック
      (サブメニューを項目数に応じ下詰め配置。E2Eは澱み斬り→毒付与で12本目。JOURNAL[34])

完了条件: レベル習得スキルが5種以上あり、習得レベル未満では使えず、
新効果種(状態異常付与・バフ等)が戦闘で機能する。`pnpm check`+`pnpm test:e2e`緑
(M9完了時は`pnpm test:e2e:full`も)。

## M10: 敵バリエーション追加(BACKLOG「優先度: 高」4件目の展開。雑魚+3種・中ボス1種)

- [x] M10-1: ロア・仕様骨子の追記(world-lore.md 4節へ新敵4種の名称・外見・生態を追記、
      game-design.mdの敵表へ拡張区分=出現マップ・中ボスの出現方式を追記)+ 敵定義
      (ステータス・決定論的行動・報酬・ドロップ)+ 出現プールへの組み込み
      (敵シンボル数レンジ(フィールド2-3・ダンジョン各層2-6)は不変。既存E2Eの
      移動経路・通しプレイを塞がない配置)+バランステスト
      (グラフィックは未着手=既存のプレースホルダー退避描画で進む)
      (迷い火/囁き仮面/錆喰い+中ボス紡ぎ損ない(d2側室(17,8)固定・gimmicks撃破記録・
      エンディング非誘発)。JOURNAL[35])
- [x] M10-2: codex委譲で敵グラフィック4種を生成(asset-pipeline.md準拠:
      スタイルガイド+world-lore外見典拠を依頼に含める。自作しない)
      + manifest/prompts整備+検収+戦闘シーンでの表示確認。
      完了時にBACKLOG側へチェック
      (5枚納品=紡ぎ損ないは2形態。phase2切替の敵ID汎用化も修正。JOURNAL[36])

完了条件: 新敵4種が定義・出現し(中ボス含む)、グラフィックが戦闘で表示され、
`pnpm check`+`pnpm test:e2e`緑(M10完了時は`pnpm test:e2e:full`も)。

## M11: NPCの記憶の活用強化(BACKLOG「優先度: 高」5件目の展開)

- [x] M11-1: 仕様骨子の追記(game-design.md/ai-integration.mdへ「好感度の段階(拡張: M11)」=
      段階表(4段階目安)・段階別の態度指示・決定論的効果(商人の段階割引等)。
      既存要件の変更・緩和はしない)+ shared の affinityTier 純関数・段階定数
      + 商人価格の段階割引(決定論。初期好感度30では無割引=既存E2E/テスト不変)+テスト
      (警戒/よそよそしい/打ち解けた/信頼。買値5/10%引き・売値増しはM11-3配線。JOURNAL[37])
- [x] M11-2: liveプロンプトの段階別態度指示(prompt.ts。憲法骨格・neutralizeTags維持)
      + 要約プロンプトの質改善(構造化指示: 事実・約束・呼び名・感情を優先。
      SUMMARY_MAX_LENGTH と出力壁は不変)+ ガードレール攻撃リグレッション緑維持+テスト
      (4段階の態度指示は固定定数=NPC_PERSONAと同じ信頼クラス。JOURNAL[38])
- [x] M11-3: UI対応(会話画面に関係性の暗示表示。数値は出さず段階の雰囲気のみ。
      view拡張は最小限。オーケストレーター自身が実装)+E2Eスモーク。
      完了時にBACKLOG側へチェック
      (会話ヘッダーに「― 段階名 ―」を暗色表示。売値+5%の配線と表示を
      merchantAffinity 経由で同一計算に。JOURNAL[39])

完了条件: 好感度の段階が態度(プロンプト)・価格(決定論)・UI(暗示表示)に反映され、
要約の質改善が入り、防御仕様(第1〜6層)がすべて不変。`pnpm check`+`pnpm test:e2e`緑
(M11完了時は`pnpm test:e2e:full`も)。

## M12: 効果音・BGMの整備(BACKLOG「優先度: 高」6件目の展開)

- [x] M12-1: 方針の仕様骨子(asset-pipeline.mdへ「音声アセットの方針」追記=
      オープンライセンス同梱・台帳は assets/audio/README.md・フェイルセーフ)
      + SE素材の選定・同梱(Kenney CC0 3パックから12点: UI操作4・戦闘4・
      その他4。台帳・ライセンス文つき)
- [x] M12-2: クライアントのSE再生基盤(サウンドマネージャ: 台帳idでロード、
      読み込み失敗・音声無効環境で無害、音量定数)+ 主要イベントへの配線
      (メニュー操作・戦闘ヒット/スキル/被弾・レベルアップ・勝利・売買・回復・
      マップ遷移・操作拒否)+テスト(E2E 12本が緑のまま)
- [x] M12-3: BGMの選定・同梱(タイトル・街・フィールド・ダンジョン・戦闘の3-5曲。
      ループ可能なダークアンビエント。CC0優先/CC-BYは帰属記録)+ シーン別BGM切替
      (フェード)+ 音量・ミュートの設定UI(オーケストレーター自身が実装)。
      完了時にBACKLOG側へチェック
      (Kevin MacLeod 5曲(CC-BY 4.0・帰属記録済み)。BGMは遅延読み込みで
      preload非ブロッキング化。設定はタイトル「設定」+localStorage永続化。JOURNAL[42])

完了条件: 主要な操作・戦闘・遷移に効果音が鳴り、シーンに応じたBGMが流れ、
ミュートできる。音声無効環境・E2E(headless)で進行を阻害しない。
`pnpm check`+`pnpm test:e2e`緑(M12完了時は`pnpm test:e2e:full`も)。

## M13: マップ上スプライトのcodex生成と反映(BACKLOG「優先度: 高」7件目の展開)

- [x] M13-1: 生成方式の仕様骨子(asset-pipeline.mdの「プレイヤー・NPCのマップ上の
      見た目もプレースホルダー」方針を展開済みへ更新=1体ずつ透過生成・256x256・
      真上寄りの見下ろし俯瞰・向きは正面1枚(向き表示は既存の向きドットを継続)・
      立ち絵/敵グラフィックとの同一人物性)+ codex委譲 第1弾: 主人公+NPC4
      (world-lore 3節の外見典拠・既存立ち絵を参照)+ manifest/prompts整備+検収
      (初回納品は3/4正面立ち絵で人間レビュー差し戻し→見下ろし俯瞰で再生成し受入。
      仕様へ視点要件を明文化。JOURNAL[43])
- [x] M13-2: codex委譲 第2弾: 敵シンボル8種(雑魚6+ボス+中ボス)と
      一マス構造物3種(看板・宝箱・採取ポイント)+ manifest/prompts整備+検収
      (11枚納品。視点要件(見下ろし俯瞰)を依頼に明記し一発受入。JOURNAL[44])
- [x] M13-3: クライアント反映(exploration-sceneのプレイヤー・NPC・敵シンボル・
      ボス/中ボスマーカー・構造物の描画をスプライトへ差し替え。未整備時は
      既存プレースホルダーへ退避。オーケストレーター自身が実装)+実プレイ確認。
      完了時にBACKLOG側へチェック
      (mapSpriteヘルパー(存在確認+退避)で全種差し替え。街・フィールドの
      実プレイスクリーンショットで馴染みを確認。JOURNAL[45])

完了条件: マップ上の主人公・NPC・敵シンボル・構造物がプレースホルダー図形でなく
生成スプライトで描画され、`pnpm check`+`pnpm test:e2e`緑(M13完了時は
`pnpm test:e2e:full`も)。

## M14: タイルの向き差分適用(BACKLOG「優先度: 高」8件目の展開。壁のオートタイル)

- [x] M14-1: sharedの近傍判定の純関数(壁の4近傍マスク。マップ端は壁扱い)+
      tile-frames.ts のマスク対応拡張(最小方式: 「南が非壁=壁の正面(現行フレーム)/
      それ以外=壁の上面・内部フレーム」の2段構え。フレーム座標は暫定でよい=
      M14-2で目視調整)+ drawTilesFromTileset の壁分岐+ユニットテスト
      (isWallLike(範囲外=壁扱い)+wallFrame(正面はtileFrameと単一出所)。JOURNAL[46])
- [x] M14-2: 全マップの実プレイ確認とフレーム座標の目視調整(必要なら角・
      水/道の縁取りへ拡張。オーケストレーター自身が実装)。
      完了時にBACKLOG側へチェック
      (上面を12行目→15行目の石ブロックへ差し替え(縦積みの横縞を解消)。
      全5マップ合成プレビュー+実プレイ目視で確定。角・水/道の縁取りは
      現状で読めるため見送り。test:e2e:full 2/2緑=M14完了。JOURNAL[47])

完了条件: 壁が配置の向き(正面/上面)に応じたタイル絵で描画され、建物・境界の
立体感が破綻しない。`pnpm check`+`pnpm test:e2e`緑(M14完了時は`pnpm test:e2e:full`も)。

## M15: 全体的なUI/UXの検証・修正(BACKLOG「優先度: 高」9件目の展開)

- [x] M15-1: subagentによる実プレイUX点検(調査のみ・コード変更なし)。
      dev:mock+Playwrightで新規開始→探索→会話→店→宿(SAVE_DIRを一時ディレクトリへ
      切替えて人間セーブを保護)→戦闘→メニュー各画面を巡回し、改善点を
      優先度付きで列挙。既知2件(タイトル画面のタイトル二重表示、操作キー説明の不在)の
      再確認を含む。結果はROADMAP M15-3のサブ項目とJOURNALへ確定記録
      (改善点13件=P1x1/P2x5/P3x7を確認。JOURNAL[48])
- [x] M15-2: タイトル二重表示の解消+操作キーの説明画面(タイトルまたはメニューから
      参照可能なヘルプ。UI=オーケストレーター自身が実装)。
      注意: DOMの h1/#connection-status はE2Eが参照するため削除せず
      視覚的に隠す(sr-only等)。あわせて各オーバーレイの操作ヒント表記を統一する
      (h1=1pxクリップで不可視化(toBeVisible維持)、タイトル下端+探索右下に
      常設キーヘルプ、設定/もちもの/店の右肩ヒント統一。JOURNAL[49])
- [x] M15-3: UX点検のP2群+軽量P3の修正(UI=オーケストレーター、ロジック=subagent):
      [x] 設定音量の左右キー増減+ヒント表示 / [x] 消耗品の効果説明1行(もちもの・店) /
      [x] 対話可能オブジェクト(看板・宝箱・採取)の視覚的手掛かり /
      [x] 戦闘勝利時の獲得EXP・ゴールド表示 / [x] 接続ステータスの接続時自動非表示 /
      [x] セーブ有時のタイトル初期カーソル=つづきから / [x] 宿確認文の閉じ括弧折返し調整
      (前半4件=JOURNAL[50]、後半3件=JOURNAL[51]。sharedに必要な定義が揃っていたため
      全件UIで完結=subagent委譲は不要だった)
- [x] M15-4: UX点検の残りP3の修正(裁量で一部見送り可。見送りはJOURNALに理由を記録):
      店の購入確認・成功フィードバック・買えない商品の区別 /
      オープニングの一括スキップ / 撃破時の敵スプライトのフェードアウト /
      横長ウィンドウの黒帯改善。完了時にBACKLOG側へチェック+M15ゲート(test:e2e:full)
      (店=成立メッセージ+資金不足品の無効化(購入確認は見送り: JOURNAL[52])、
      OP=Escで一括スキップ、勝利=敵フェードアウト、黒帯=cover方式ズーム+
      カメラ追従スクロールへ変更。test:e2e:full 2/2緑=M15完了。JOURNAL[52])

## M16: 第2エリア(BACKLOG「優先度: 中」1件目の展開。新集落+フィールド+ダンジョン)

- [x] M16-1: ロア・仕様の骨子追記(BACKLOG展開に伴う骨子追記=CLAUDE.mdの例外に該当)。
      world-lore.md: 第2エリアの地名・成り立ち(1.5「残された謎」のフックと接続)・
      新NPC2〜3人の人物設定(3.0共通ルール準拠) / game-design.md: マップ3枚の構成・
      灯町側との接続・敵配置(既存8種の再利用を基本とし新敵は増やさない=裁量)・
      経済(店の品揃え・宿代)・クエストフック。ロア執筆=subagent、検収=オーケストレーター
      (琥珀郷/沈み野/灯還りの坑+イルマ・ガロ・トワ。1.5フック#2を場所と兆候のみで
      実体化、#1は温存。JOURNAL[53])
- [x] M16-2: sharedのマップ定義3枚(集落・第2フィールド・第2ダンジョン)+
      既存フィールドとの接続+オブジェクト・シンボル配置+ユニットテスト(subagent)
      (settlement/field-2/dungeon-4。前セッション中断跡からの回収=検収して採用。
      JOURNAL[54])
- [x] M16-3: 新NPCの実装(定義・ペルソナ・店/宿の割当)+サーバー対応+
      ユニットテスト(subagent)。ai-guardrails.mdの防御要件は不変
      (caretaker/artisan/warden。宿5G・琥珀工房4品+ガロ好感度割引・
      warden会話のみ。旧セーブ互換。JOURNAL[56])
- [x] M16-4: クライアント反映(マップ区分tint・スプライトは既存流用または
      プレースホルダー)+E2Eスモーク1本(第2エリア到達)。見た目=オーケストレーター
      (区分割当修正+マップ別tint上書き+BGM/内装流用+到達E2E=13本目。JOURNAL[57])
- [x] M16-5: アセットのcodex委譲(新NPCのマップスプライト・立ち絵、必要なら
      集落背景)+検収+実プレイ確認。完了時にBACKLOG側へチェック+M16ゲート(test:e2e:full)
      (立ち絵3枚+スプライト4方向x3人=15枚。集落背景は見送り(裁量)。
      実プレイで琥珀郷のNPC表示・トワ会話立ち絵を確認。test:e2e:full 2/2緑=
      M16完了。JOURNAL[58])

## M17: マップ上スプライトの向き差分(BACKLOG「優先度: 高」10件目の展開。
## 人間の明示指示によりM16完了前に先行着手: 2026-07-10)

- [x] M17-1: 仕様更新(asset-pipeline.mdのマップ上スプライト注記を4方向へ展開=
      down=既存正面、up/left/rightを`<id>-<dir>`接尾辞で追加。向きドットは廃止)+
      codex委譲 第1弾: 主人公+NPC4の上左右(5体x3方向=15枚。既存正面スプライトとの
      同一人物性・見下ろし俯瞰を依頼に明記)+ manifest/prompts整備+検収
      (codexが商人左右・情報屋3方向を品質不足で自主再生成し受入。JOURNAL[55])
- [x] M17-2: codex委譲 第2弾: 徘徊雑魚6種(RESPAWNABLE: 霧狼・迷い火・蝋燭喰らい・
      囁き仮面・錆喰い・軋み人形)の上左右(6体x3方向=18枚)+ manifest/prompts整備+検収
      (ボス・中ボスマーカーは固定演出物のため正面据え置き=裁量。JOURNALに記録)
      (18枚一発受入=4枚はcodex自主再生成。JOURNAL[55])
- [x] M17-3: 反映(shared: 敵シンボルへのランダム向き付与=シード付きRNG・
      NPC facingを「建物を背にした向き」へ修正+テスト / client: 向き別テクスチャ選択
      (未整備方向は正面へ退避)・プレイヤーの向きをテクスチャ切替へ・向きドット削除。
      オーケストレーター自身が実装)+実プレイ確認。
      完了時にBACKLOG側へチェック+M17ゲート(test:e2e:full)
      (実プレイでNPC背面/主人公向き切替/敵ランダム向きを確認。test:e2e:full 2/2緑=
      M17完了。JOURNAL[55])

完了条件: 主人公が移動方向のスプライトで描かれ(補助点なし)、NPCが建物を背にした
向き、敵シンボルが上下左右ランダムな向きで描かれる。未整備の向きは正面へ退避し
進行を阻害しない。`pnpm check`+`pnpm test:e2e`緑(M17完了時は`pnpm test:e2e:full`も)。

## M18: メインクエスト第2章(BACKLOG「優先度: 中」2件目の展開。夢の機関の謎の深掘り)

- [x] M18-1: 物語・仕様の骨子追記(BACKLOG展開に伴う骨子追記=CLAUDE.mdの例外に該当。
      骨子執筆=subagent、検収=オーケストレーター)。
      game-design.md: 「メインクエスト第2章」節=章の開始条件(epilogue後を想定)・
      進行段階・必須会話(選択肢=AI非依存)・到達目標と結び・既存第1章/エンディングへの
      不干渉条件 / world-lore.md: 1.5フック#2(機関の全体像)の展開=導管の間(d4-conduit)を
      起点にトワ(3.8)を語り部とする筋。核心の全開示はせず「続き」の余地を残す。
      **制約: 新マップ・新敵・新アセットを必須にしない**(既存11マップ・既存敵の再利用。
      必要が出たら別項目として分割)
      (world-lore 1.6「灯の還る先」+用語集1語、game-design第2章節=
      3段階(ch2-stirring/vigil-song/beyond)・純追記127行。JOURNAL[59])
- [x] M18-2: shared/serverのクエスト状態機械拡張(第2章ステージのenum追記=
      旧セーブ互換・開始/進行トリガー・フラグ)+ユニットテスト(subagent)。
      既存の第1章進行・エンディング・E2E(スモーク13本+full)は不変
      (3段階の決定論遷移+isBossDefeated順序判定化+テスト12件。JOURNAL[60])
- [x] M18-3: 必須会話・演出の実装(選択肢スクリプト・調べイベント・世界変化)+
      クライアント対応(UI=オーケストレーター)+テスト
      (必須会話・調べイベントはM18-2で実装済み。本項=ジャーナルの
      メインクエスト現況(全7段階)+data-main-quest-stage+導管の脈動演出。JOURNAL[61])
- [x] M18-4: E2Eスモーク(第2章の開始〜結びの最短経路)+実プレイ確認。
      完了時にBACKLOG側へチェック+M18ゲート(test:e2e:full)
      (chapter2.spec=フィクスチャ+つづきからの3幕構成(14本目・約12s)。
      実プレイで導管の脈動とジャーナルch2文言を確認。test:e2e:full 2/2緑=
      M18完了。JOURNAL[62])

完了条件: エンディング後に第2章を開始でき、選択肢会話のみ(AI非依存)で結びまで
到達できる。第1章の進行・エンディング・既存セーブ互換が不変。
`pnpm check`+`pnpm test:e2e`緑(M18完了時は`pnpm test:e2e:full`も)。

## M19: サブクエストのテンプレート拡充(BACKLOG「優先度: 中」3件目の展開。
## propose_questへdeliver/escort/surveyの3型追加+防御検証の拡張)

- [x] M19-1: 仕様骨子の追記(BACKLOG展開に伴う骨子追記=CLAUDE.mdの例外+
      ai-integration.md 5節注記自身の予告(「入力スキーマごと拡張する」)に該当。
      骨子執筆=subagent、検収=オーケストレーター)。
      ai-integration.md「5b. propose_questの型拡張」=3型の入力スキーマ(discriminated
      union)・ホワイトリスト4種・達成の意味論・放棄時の預かり品回収・モック方針・
      旧セーブ互換 / game-design.md「サブクエストの型拡充」=プレイヤー視点の流れ・
      ジャーナル表示・不干渉条件 / ai-guardrails.md=攻撃リグレッション3ブロック追加
      (追加方向のみ。既存の上限・ホワイトリスト・クールダウンは不変)
      (escort/surveyはcount=1固定、報告先は全型カイ、遂行は全て決定論。JOURNAL[63])
- [x] M19-2: sharedのクエスト状態機械拡張(subQuestスキーマへ3型追加=旧セーブ互換・
      新ホワイトリスト4列挙(DeliverRecipientId/DeliverParcelId/EscortDestinationId/
      SurveyTargetId)の新設・受諾/納品/到達/調査/放棄/報告の純ロジック・
      預かり品の別枠管理)+実在性ドリフト検知を含むユニットテスト(subagent)
      (discriminatedUnion末尾追加・escort/surveyはcount=z.literal(1)・
      removeQuestItem新設・テスト33件追加=unit 826。JOURNAL[64])
- [x] M19-3: サーバー統合(propose_quest検証層の3型対応・納品/到達/調査のイベント
      処理・モック応答への新型+悪意応答追加)+攻撃リグレッションテスト拡張
      (subagent)。既存の上限・ホワイトリスト・クールダウンは不変
      (abandon-quest/report-questハンドラの新規配線(pre-existing gap回収)・
      モックは番兵topic方式で既存E2E不変・攻撃ID6種登録・テスト16件=unit 842。
      JOURNAL[65])
- [x] M19-4: クライアントUI(ジャーナルの型別現況表示・deliver納品の選択肢会話・
      escort同行者マーカー・survey達成マーク。UI=オーケストレーター)+E2Eスモーク。
      完了時にBACKLOG側へチェック+M19ゲート(test:e2e:full)
      (ジャーナルにカーソル+Enter報告+X放棄(確認付き)・reportReadyビュー・
      「連れの灯」マーカー・deliver E2E=15本目・liveプロンプト候補はsubagent委譲。
      納品会話はM19-3実装済みのdialog列で足りると判断。ゲート全緑=M19完了。
      JOURNAL[66])

完了条件: propose_questで3型(deliver/escort/survey)が発行・受諾・遂行・報告でき、
防御検証が3型に拡張され(既存要件は不変)、旧セーブと既存E2E(スモーク14本+full)が
壊れない。`pnpm check`+`pnpm test:e2e`緑(M19完了時は`pnpm test:e2e:full`も)。

## M20: 夢シーンの演出強化(BACKLOG「優先度: 中」4件目の展開。
## trigger_world_eventへmarket_shift/npc_absence/dream_erosionの3kind追加)

- [x] M20-1: 仕様骨子の追記(BACKLOG展開に伴う骨子追記=CLAUDE.mdの例外に該当。
      骨子執筆=subagent、検収=オーケストレーター)。
      ai-integration.md「6b. WorldEventの型拡張」=3kindの定義(すべて決定論=
      enum/ホワイトリスト/deltaのみ)・同種解決規則・絶対クランプ・旧セーブ互換 /
      game-design.md「夢の世界変化の拡充」=プレイヤー視点の見え方・寿命・不干渉条件 /
      ai-guardrails.md=攻撃リグレッション追記(追加方向のみ)
      (npc_absenceはpriest/informant/warden除外+同時1人=宿・店の同時全滅なし、
      market_shiftは売値≤実効買値クランプ拡張=買い戻し増殖防止、
      dream_erosionは0-3累積クランプ・演出のみ。JOURNAL[67])
- [x] M20-2: shared/serverの実装(worldEventSchemaへ3kind追加=旧セーブ互換・
      MarketShiftMode/AbsentNpcId列挙・world状態3フィールド(optional+default)・
      advanceDayのリセット群拡張(marketShift/absentNpc。dreamErosionは持続)・
      買値/売値クランプの市場倍率対応・validateDreamEventsの解決規則・
      applyDreamEvents適用・不在NPCのinteract遮断・モック+悪意応答)
      +攻撃リグレッション+ユニットテスト(subagent)。
      game-design.md「セーブ/ロード」保存内容列挙への3フィールド追記を含む
      (shop関数はoptional第3引数=null時従来完全同値・売値≤実効買値クランプ・
      夢モックは番兵recentPlay方式で既定不変・攻撃ID4種登録・テスト29件=unit 879。
      JOURNAL[68])
- [x] M20-3: クライアント演出(市場の変化の店頭表示・NPC不在の表示・侵食度の
      画面tint演出。UI=オーケストレーター)+E2Eスモーク。
      完了時にBACKLOG側へチェック+M20ゲート(test:e2e:full)
      (view.world最小追加+shop interactionへmarketShift=売値の同一計算・
      市場の一言・不在NPC非表示(npcViews)・侵食の帳(暗色rect 4段階)・
      world-events.spec=16本目・liveのプロンプト候補とSDKスキーマ追従は
      subagent委譲。実プレイ目視確認済み。ゲート全緑=M20完了。JOURNAL[69])

完了条件: 夢シーンでmarket_shift/npc_absence/dream_erosionが発行・適用され、
翌朝の市場・NPCの不在・世界の色に現れ、防御検証が3kindに拡張され(既存要件は不変)、
旧セーブと既存E2Eが壊れない。`pnpm check`+`pnpm test:e2e`緑(M20完了時は
`pnpm test:e2e:full`も)。

## M21: 状態異常・属性の拡充(BACKLOG「優先度: 中」5件目の展開。
## 状態異常2種(眩惑/竦み)追加+状態異常耐性(属性)の仕組み)

- [x] M21-1: 仕様骨子の追記(BACKLOG展開に伴う骨子追記=CLAUDE.mdの例外に該当。
      骨子執筆=subagent、検収=オーケストレーター)。
      game-design.md「状態異常・属性の拡充」=追加2種(眩惑=命中低下/竦み=行動不能確率)の
      効果・持続・付与確率・重複規則、耐性(0-1・既定0=属性)の仕組み、既存敵/ボス/スキルへの
      割り当て方針、RNG保存によるcombat-balance.test閾値の不衝突、AI波及なし、セーブ形式不変、
      UI/演出骨子、不干渉条件。**既存の毒仕様は不変・追加方向のみ**。
      ai-integration.md/ai-guardrails.mdは触らない(戦闘はAI非依存)
      (眩惑=蝋燭喰らい/竦み=軋み人形(いずれもbalance-test対象外)へ主割り当て、
      属性=状態異常種別ごとの耐性(炎氷等のダメージ倍率は対象外=裁量)、
      解除は灯/光アイテム。JOURNAL[70])
- [x] M21-2: sharedの状態異常エンジン拡張(status.tsのstatusIdSchema/STATUS_DEFSへ
      眩惑・竦みを追加=一般形維持・StatusDefinitionへ効果種(命中低下/行動不能)拡張・
      表示名/文言・技への付与確率フィールド(既定1.0=既存不変)・battle.tsの命中判定/
      行動不能判定の分岐(**当該状態の行動時のみRNG消費**=無縁戦闘のRNG列を保存)・
      BattleEvent型/zodスキーマ追従)+ユニットテスト(新2種の挙動・既存poison不変・
      RNG列不変・イベント整合)(subagent)。この時点では敵/装備への割り当てはせず既定で不活性
- [x] M21-3: 耐性(属性)システム+割り当て+バランス再検証(subagent):
      状態異常kindごとの耐性(0-1・既定0)を戦闘員へ・実効付与=付与確率×(1-耐性)・
      プレイヤー耐性は装備由来(既存レベル基礎値には持たせない)・敵耐性は敵定義由来(既定0)・
      毒耐性は0維持(既存毒挙動を保存)/ 蝋燭喰らい=眩惑move・軋み人形=竦みmoveの追加(既存の
      毒付与技は併存)・眩惑/竦みの解除アイテム(灯/光)/ **combat-balance.testの全閾値を再検証し
      緩めない**(統計対象外の2雑魚は非干渉。ボス等へ任意付与する場合は閾値を満たすことを確認、
      満たせなければ付与確率/持続を下げるか見送り)+ユニットテスト
- [x] M21-4: クライアント表示・演出(バトルUIの眩惑・竦みバッジ/ラベル・空振り/行動不能の
      イベント文言・解除フィードバック・耐性の暗示表示は任意。UI=オーケストレーター)+
      E2Eスモーク1本(状態異常付与→UI反映)。完了時にBACKLOG側へチェック+M21ゲート(test:e2e:full)

完了条件: 眩惑・竦みの2種が戦闘で付与・作用・解除でき、状態異常耐性(属性)が装備・敵定義に反映され、
既存の毒仕様・スキル・装備・敵の挙動とcombat-balance.testの全閾値が不変、旧セーブと既存E2Eが
壊れない。AIツール・防御仕様は不変。`pnpm check`+`pnpm test:e2e`緑(M21完了時は`pnpm test:e2e:full`も)。

## M22: ミニマップまたは全体マップUI(BACKLOG「優先度: 中」6件目の展開。
## 全体マップオーバーレイ「夢の地図」=訪問済みマップの接続グラフ)

- [x] M22-1: 仕様骨子の追記(BACKLOG展開に伴う骨子追記=CLAUDE.mdの例外に該当。
      骨子執筆=subagent、検収=オーケストレーター)。
      game-design.md「全体マップUI『夢の地図』(拡張: M22)」=採用案(全体マップoverlayのみ・
      常時ミニマップ見送り・現在マップのタイル俯瞰は対象外)・表示内容(接続グラフ/訪問済みのみ
      表示/未訪問は靄/8マップのノード配置目安)・データ設計(visitedMaps=optional+default・
      version据え置き・接続グラフの共有純ヘルパー・viewはvisitedMapsのみ追加=クライアントは
      既存MAPS登録簿を直接参照)・セーブ列挙への追記・UI骨子(Mキー・data-menu="map"+
      data-visited-count・探索限定)・不干渉条件。ai-integration.md/ai-guardrails.mdは
      触らない(本UIはAI非依存の描画のみ)
- [x] M22-2: shared/serverのデータ拡張(**subagent担当**。UIは書かない):
      GameStateへvisitedMaps(mapId配列・optional+default([])・GAME_STATE_VERSION据え置き)追加=
      新規ゲームはtown初期値・マップ遷移が成立するたび行き先mapIdを追記・つづきから/ロードで
      現在地mapIdを補完(旧セーブ互換)・advanceDayで持続 / sharedにマップ接続グラフの純ヘルパー
      (全transitionから無向の隣接を導出・重複辺を畳む・Phaser非依存)/ SnapshotViewへ
      visitedMaps露出(接続グラフとdisplayNameはクライアントがMAPSから直接引くためviewに増やすのは
      これのみ)。旧セーブ互換(visitedMaps欠落→現在地補完)・遷移記録・接続グラフ・advanceDay持続の
      ユニットテスト。game-design.md保存内容列挙はM22-1で追記済み
- [x] M22-3: クライアントUI=全体マップオーバーレイ「夢の地図」(**UI=オーケストレーター**):
      Mキーで開閉・Escで閉じる(既存overlayのガードと同流儀=探索限定・他overlay/会話/店/宿/夢中は
      不可)・接続グラフ描画・ノード配置定数(world-lore地理感)・現在地強調・訪問済みのみ表示/
      未訪問は靄・常設キーヒントに「M: 地図」追加・syncDomStateへdata-menu="map"+data-visited-count。
      新規画像アセットなし(手続き描画)+E2Eスモーク1本(マップ移動で訪問数が増える→オーバーレイに
      反映を観測)。完了時にBACKLOG側へチェック+M22ゲート(test:e2e:full)

完了条件: 探索中に`M`で全体マップ「夢の地図」を開閉でき、訪問済みマップの接続グラフと現在地が
表示され(未訪問は靄で伏せる)、`visitedMaps`が旧セーブ互換(GAME_STATE_VERSION据え置き)で
永続化され、既存の移動・戦闘・会話・セーブ・既存E2Eが壊れない。新マップ・新敵・新アセットを
増やさず、AIツール・防御仕様は不変。`pnpm check`+`pnpm test:e2e`緑(M22完了時は`pnpm test:e2e:full`も)。

## M23: 昼夜サイクルと時間帯によるNPC配置変化(BACKLOG「優先度: 低」1件目の展開。
## 昼/夜の2時間帯+夜の灯町NPC配置変化。AI非波及・セーブ非永続の最小設計)

- [x] M23-1: 仕様骨子の追記(BACKLOG展開に伴う骨子追記=CLAUDE.mdの例外に該当。
      骨子執筆=subagent、検収=オーケストレーター)。
      game-design.md「昼夜サイクルと時間帯によるNPC配置(拡張: M23)」=採用案(時間帯2段階
      昼/夜・進行は移動歩数のみ(`NIGHTFALL_STEPS`目安40歩)・宿泊/全滅/新規/ロードで昼へ
      リセット)・NPC配置変化(灯町のみ・夜は商人レンド1人が霧笛亭脇へ移動・他3人据え置き・
      配置の唯一の正は`shared`の純関数`npcPlacementsForTime`をサーバー衝突/インタラクションと
      クライアント描画の**両方**が通す・機能は時間帯で変えない・M20 npc_absenceとの整合・
      ソフトロック不能条件)・見た目(夜の藍色の帳=侵食の帳より下の序列・HUD時間帯語・
      新規画像アセット不要)・セーブ非永続(セーブは必ず朝ゆえ時間帯は保存不要・保存内容/
      保存しないもの列挙は変更不要・GAME_STATE_VERSION据え置き)・AI非波及・E2E不干渉
      (昼開始+mock限定`timeOfDay`固定フラグ)・不干渉条件。
      ai-integration.md/ai-guardrails.mdは触らない(AIへ渡す時刻帯=「ゲーム内時間」既存記述は不変)
- [x] M23-2: shared/serverの実装(**subagent担当**。UIは書かない):
      shared=時間帯型`TimeOfDay`(`"day"|"night"`)・`NIGHTFALL_STEPS`定数・
      `timeOfDayForSteps(steps)`純関数・灯町の夜配置上書きデータ+`npcPlacementsForTime(map,timeOfDay)`
      純関数(灯町のみ夜配置を適用・他マップは素通し)・ユニットテスト(夜配置マスが歩行可能かつ
      占有/遷移/playerStartと非重複=マップ定義superRefineは実行時上書きを見ないため専用テストで
      担保・商人のみ移動し他3人不変・閾値境界(歩数<40=昼/=40以上=夜)・素通しマップの不変)。
      server=GameSessionに非永続ランタイム`timeOfDay`/`daySteps`を保持(`mode`同格・セーブ非対象)・
      移動成立ごとに`daySteps`加算し`timeOfDay`再計算・新規/ロード/宿泊(手順2の日送り)/全滅帰還で
      昼へリセット・移動衝突/正面インタラクション/占有判定を`npcPlacementsForTime`の時間帯配置に
      対して行う・`buildView`へ`timeOfDay`露出・mock限定の`timeOfDay`固定オプション(`startLevel`同流儀)
      +統合テスト。**セーブスキーマ変更なし**(旧セーブ互換は自明=常に昼で読める)。
      既存E2E(スモーク+full)を緑に保つことを閾値・配置の確定条件とする。
      (shared側=型/定数/配置データ/純関数+テストと、server側=ランタイム状態/衝突配線/view露出/
      統合テストの合算が2時間相当を超える見込みなら、M23-2a(shared)/M23-2b(server)へ分割してよい)
- [x] M23-3: クライアント表示・演出(**UI=オーケストレーター**):
      NPC描画を`npcPlacementsForTime(map, view.timeOfDay)`の配置へ差し替え(サーバーと同一関数)・
      夜の藍色の帳オーバーレイ(手続き矩形・侵食の帳=深度50より下の序列・alpha目安0.16は目視調整)・
      HUDに時間帯語を追加・`syncDomState`へ`data-time-of-day`(day/night)追加。
      新規画像アセットなし+E2Eスモーク1本(mock限定`timeOfDay=night`で開始→`data-time-of-day="night"`と
      商人の夜配置(位置ずれ)を観測、または昼→夜遷移を観測)。
      完了時にBACKLOG側へチェック+M23ゲート(test:e2e:full)

完了条件: 探索中に時間帯(昼/夜)が移動歩数で決定論的に進み(宿泊/全滅/新規/ロードで昼へ戻る)、
夜は灯町で商人の立ち位置が変わり画面に夜の帳が掛かる。時間帯はセーブに永続化せず(常に昼で
ロード)、NPC配置の正はサーバー・クライアント共通の`shared`純関数に一元化され、宿・店・
サブクエスト窓口・メインクエスト進行役へは昼夜いずれでも到達・会話できる(ソフトロックしない)。
既存の移動・戦闘・会話・店・宿・セーブ・M20/M22挙動・既存E2E(スモーク+`test:e2e:full`)が壊れず、
新マップ・新敵・新規画像アセットを増やさず、AIツール・防御仕様・AIへの時刻帯受け渡しは不変。
`pnpm check`+`pnpm test:e2e`緑(M23完了時は`pnpm test:e2e:full`も)。

## M24: 実績システム「夢の欠片」(BACKLOG「優先度: 低」2件目の展開。
## 閲覧のみの実績12件+解除トースト+Kキー一覧オーバーレイ。報酬なし・AI非波及の最小設計)

- [x] M24-1: 仕様骨子の追記(BACKLOG展開に伴う骨子追記=CLAUDE.mdの例外に該当。
      骨子執筆=subagent、検収=オーケストレーター)。
      game-design.md「実績システム『夢の欠片』(拡張: M24)」=採用案(実績は閲覧のみ・
      報酬/進行/経済に無影響・定義は`shared`静的登録簿`ACHIEVEMENTS`・解除は不可逆・
      AI非依存の決定論判定)・初期セット12件の表(id/表示名/解除条件/フレーバー全件明記)・
      判定は`shared`純関数`evaluateAchievements`+サーバー単一チョークポイント評価
      (フック散在禁止・乱数非消費・dialog非送出)・`GameState.unlockedAchievements`=
      `optional`+`default([])`で`GAME_STATE_VERSION`据え置き(旧セーブ=再収集で成立の論拠明記)・
      view露出は解除id配列のみ+解除通知はview差分・UI要件(トースト=非モーダル/初回snapshot抑制、
      一覧=Kキー開閉/未解除は靄)・data-観測点3種・不干渉条件。
      「セーブ/ロード」章の保存内容列挙へ`unlockedAchievements`を追記(同章自身の指示に従う追記)
- [x] M24-2: shared/serverの実装(**subagent担当**。UIは書かない):
      shared=`achievementIdSchema`+登録簿`ACHIEVEMENTS`12件(骨子の表が正)+
      `evaluateAchievements(input)`純関数(入力=GameState部分+`timeOfDay`+決定論イベント2種
      `sub-quest-reported`/`world-event-applied`)+ユニットテスト(12条件それぞれの成立/不成立・
      単調性=解除集合は増えるのみ・イベント2種の意味論)。
      `GameState.unlockedAchievements`を`optional`+`default([])`で追加(`advanceDay`で持続・
      新規ゲームは空・`GAME_STATE_VERSION`据え置き)。
      server=単一チョークポイント(操作処理後・snapshot構築前)での評価+∪単調更新の配線・
      イベント積み(`report-quest`成功・宿泊手順4の世界変化適用=手順4後/手順5前に評価)・
      `buildView`へ`unlockedAchievements`露出・旧セーブ互換(欠落フィールドが空で読める)テスト+
      統合テスト。**セーブスキーマは後方互換の純追加のみ**。解除で`dialog`を送らない・
      乱数を消費しない(既存combat-balance/E2Eの決定論を壊さない)。
      viewは純追加フィールドのためクライアント未着手でも既存E2Eは緑のまま
- [x] M24-3: クライアントUI(**UI=オーケストレーター**):
      解除トースト(snapshot間の`unlockedAchievements`差分検出・シーン開始後初回snapshotは抑制・
      非モーダル/入力を奪わない/数秒フェード/複数解除は順送り)・実績一覧オーバーレイ
      (`K`で開閉・`Esc`で閉じる・探索限定=M22「夢の地図」同流儀・解除済み=表示名+フレーバー/
      未解除=靄で伏せる・ヘッダ「欠片 n/12」)・常設キーヒントへ「K: 欠片」追加・
      `syncDomState`へ`data-achievements-unlocked`/`data-achievement-last`/`data-menu="achievements"`。
      新規画像アセットなし+E2Eスモーク1本(決定論解除=装備2点等→カウント/last観測→K開閉)。
      完了時にBACKLOG側へチェック+M24ゲート(test:e2e:full)

完了条件: プレイの節目12件が「夢の欠片」として決定論的に解除・収集され(解除は不可逆・
報酬/進行/経済/バランスへ無影響)、解除時トーストとKキーの一覧オーバーレイ(未解除は靄)で
閲覧できる。実績はセーブへ後方互換(`optional`+`default([])`・`GAME_STATE_VERSION`据え置き)で
永続化され、旧セーブは再収集で自然に成立する。判定はサーバー・クライアント共通の`shared`
純関数+登録簿に一元化され、AIツール・防御仕様・`<world_state>`は不変。既存の移動・戦闘・
会話・店・宿・セーブ・既存E2E(スモーク+`test:e2e:full`)が壊れず、新マップ・新敵・
新規画像アセットを増やさない。`pnpm check`+`pnpm test:e2e`緑(M24完了時は`pnpm test:e2e:full`も)。

## M25: 難易度設定(BACKLOG「優先度: 低」3件目の展開。
## やさしい/ふつう/むずかしいの3段階=被ダメージ倍率のみのランタイム乗算層。ふつう=恒等で完全不変)

- [x] M25-1: 仕様骨子の追記(BACKLOG展開に伴う骨子追記=CLAUDE.mdの例外に該当。
      骨子執筆=subagent、検収=オーケストレーター)。
      game-design.md「難易度設定(拡張: M25)」=採用案(3段階 easy/normal/hard・
      動かすのは**プレイヤー被ダメージ倍率のみ**(0.75/1.0固定/1.4)・敵定義/経済/命中/
      状態異常/XP/ゴールドは難易度非依存)・適用点(computeDamage戻り後にdealDamageの
      target==="player"分岐でmax(1, floor(dmg×係数))=RNG非消費・normal=恒等写像で
      combat-balance.testバイト一致保存の根拠明記)・係数運搬(createBattle第5引数+
      BattleState.incomingDamageMultiplier・進行中戦闘は開始時係数で固定)・セーブ互換
      (GameState.difficulty=default("normal")・version据え置き・continueはセーブ値が正)・
      選択UI(新規ゲーム時3択が確定点・difficultyはmock限定にしない(チートでなく正規選択の裁量)・
      ゲーム中変更set-difficultyは任意=縮退可)・?difficulty=URLフラグ・view純追加・
      data-difficulty観測点・AI非波及・不干渉条件。「セーブ/ロード」章の保存内容列挙へ追記
- [x] M25-2: shared/serverの実装(**subagent担当**。UIは書かない):
      shared=`difficultySchema`(easy/normal/hard)・`DIFFICULTY_DISPLAY_NAMES`・
      `DIFFICULTY_COEFFICIENTS`(0.75/1.0/1.4)・`createBattle`第5引数`difficulty`(既定normal)+
      `BattleState.incomingDamageMultiplier`(既定1.0)・`dealDamage`のプレイヤー被弾分岐1点で
      `max(1, floor(dmg×係数))`適用(**RNG消費順序・既存式は不変**)。
      `GameState.difficulty`=`.default("normal")`(version据え置き・advanceDayで持続)。
      `newGameOptionsSchema.difficulty`(**mock限定にしない**)+`snapshotViewSchema.difficulty`純追加。
      server=new-gameでGameStateへ反映・戦闘入口2箇所で`createBattle(..., state.difficulty)`。
      ユニットテスト=easy/hardの被ダメ増減方向・normal恒等・旧セーブ互換(欠落→normal)・
      最低1ダメージ保証。**既存combat-balance.testのnormal閾値・判定は一切変えない(緩めない)**。
      既存E2E(スモーク+full)緑を確認
- [ ] M25-3: クライアントUI(**UI=オーケストレーター**):
      タイトルの新規ゲームフローへ難易度3択(既定カーソル=ふつう・決定値をoptions.difficultyで送信)・
      `newGameOptionsFromUrl()`へ`?difficulty=`読み取り・`syncDomState`へ`data-difficulty`・
      HUD表示は裁量(出す場合は控えめ)。ゲーム中変更(set-difficulty)は実装コストで採否判断
      (縮退案=新規時のみ確定でメッセージ追加なし)。
      新規画像アセットなし+E2Eスモーク1本(`?difficulty=hard`→`data-difficulty="hard"`観測)。
      完了時にBACKLOG側へチェック+M25ゲート(test:e2e:full)

完了条件: 新規ゲーム時に難易度3段階(やさしい/ふつう/むずかしい)を選べ、選択はセーブへ
後方互換(`default("normal")`・`GAME_STATE_VERSION`据え置き)で永続化され、プレイヤーの
被ダメージのみが係数(0.75/1.0/1.4)で増減する(最低1ダメージ保証・進行中戦闘は開始時係数)。
既定「ふつう」は現行挙動と完全一致し、`combat-balance.test`の統計がバイト一致で保存され、
敵定義・経済・命中・状態異常・XP/ゴールド・クエスト・AIツール・防御仕様は不変。
既存E2E(スモーク+`test:e2e:full`)が壊れず、新マップ・新敵・新規画像アセットを増やさない。
`pnpm check`+`pnpm test:e2e`緑(M25完了時は`pnpm test:e2e:full`も)。
