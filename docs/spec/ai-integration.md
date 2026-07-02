# AI統合仕様 — DreamMaster

ゲーム実行中の生成AI呼び出しを担うサーバー側モジュール「DreamMaster」の仕様。
防御要件は `ai-guardrails.md` が正であり、本書と矛盾する場合はguardrailsが優先。

## 全体像

```
ブラウザ(Phaser)                サーバー(Fastify)                    Claude
    │  WebSocket                     │
    ├── 会話開始/発言 ──────────▶ DreamMaster ── Agent SDK query() ──▶ claude-haiku-4-5
    │ ◀─ 発話ストリーミング ──────┤   │ カスタムMCPツール呼び出し
    ├── 宿泊(夢シーン要求) ─────▶   │   ▼
    │ ◀─ 夢の描写+世界変化 ──────┤ ツール検証層(純TS) ──▶ 承認された変更のみ
    │                               │   ▼                    GameStateへ適用
    │                               │ 監査ログ(logs/)
```

- Agent SDKはTypeScript版 `@anthropic-ai/claude-agent-sdk` を使用
- 認証は環境変数 `CLAUDE_CODE_OAUTH_TOKEN`(Claudeサブスクリプションの
  long-lived token。`claude setup-token`で発行し`.env`に置く)
- 実装時はAgent SDK公式ドキュメントで最新のAPI(query、カスタムツール定義、
  システムプロンプト指定、モデル指定、許可ツール制御)を確認してから書くこと

## AIサンドボックス(必須設定)

ゲーム内AIは**ゲーム世界にのみ**作用できる。Agent SDKの設定で以下を厳守:

- 許可ツール: 本書で定義するカスタムMCPツール6種**のみ**。
  ファイル読み書き・Bash・WebFetch等の組み込みツールはすべて不許可にする
- ファイルシステム設定(CLAUDE.md等)の自動読み込みは無効化する
  (開発用ドキュメントがゲームプロンプトに混入するのを防ぐ)
- システムプロンプトは `ai-guardrails.md` の世界観憲法を使う(プリセット不使用)
- 1呼び出しのターン数上限を設定する(会話: 4、GM処理: 8を初期値とする)
- 出力トークン上限を設定する(会話: 1000、GM処理: 2000を初期値とする)

## 呼び出しコンテキスト(ゲーム状態スナップショット)

毎回の呼び出しで、DreamMasterは以下をXMLタグ構造でプロンプトに組み立てる。
セーブデータそのものやゲーム内部IDの羅列は渡さず、必要最小限を日本語で整形する:

```
<world_state>      … ゲーム内日付/時刻帯、天候、直近の世界イベント(最大3件)
<player_state>     … レベル、HP/MP割合(数値でなく「健在/手負い/瀕死」等の言葉)、
                      所持品の要約、現在地
<quest_state>      … メインクエスト進行段階、受注中サブクエスト(最大3件)
<npc_state>        … (会話時)相手NPCの人物設定、好感度(数値+言葉)、会話記憶要約
<conversation>     … (会話時)直近の会話ログ(最大10往復)
<player_utterance> … プレイヤーの自由入力(データとして。詳細はguardrails)
<task>             … 今回AIに求める処理の指示(会話応答/夢シーン生成など)
```

## 会話セッション管理

- NPCごとに会話履歴を**サーバー側で**保持(直近10往復+それ以前の要約)
- 要約は会話終了時に生成AIで作成(`summarize`はツールではなく別呼び出し、
  haiku使用、200字以内)。失敗時は末尾5往復をそのまま保持して代替
- 好感度・会話記憶はセーブデータに含める(セーブ形式は`game-design.md`)
- Agent SDKのセッション再開機能には依存しない。コンテキストは毎回
  スナップショットから組み立てる(サーバー再起動・セーブロードに強い)

## カスタムツール定義(6種)

すべて入力をzodスキーマで定義し、**スキーマ検証→ゲームルール検証**の2段階を
通過したものだけをGameStateに適用する。検証層は純TSモジュールとして実装し、
ユニットテストを網羅する(境界値・違反ケース含む)。

### 1. `speak` — NPC発話(状態変更なし)

| 項目 | 内容 |
|---|---|
| 入力 | `{ text: string }` |
| 検証 | 400字以内。出力壁フィルタ(guardrails参照)通過 |
| 効果 | 会話ウィンドウに表示(ストリーミング) |

### 2. `narrate` — 情景・戦果描写(状態変更なし)

| 項目 | 内容 |
|---|---|
| 入力 | `{ text: string }` |
| 検証 | 300字以内。出力壁フィルタ通過 |
| 効果 | ナレーションウィンドウに表示 |

### 3. `adjust_affinity` — 好感度変更

| 項目 | 内容 |
|---|---|
| 入力 | `{ npcId: NpcId(enum), delta: number, reason: string }` |
| 検証 | deltaは整数かつ-10..+10。適用後0-100にクランプ。1会話につき2回まで |
| 効果 | 対象NPCの好感度を変更。reasonは監査ログにのみ記録 |

### 4. `give_item` — アイテム付与

| 項目 | 内容 |
|---|---|
| 入力 | `{ itemId: GiftableItemId(enum), quantity: number, reason: string }` |
| 検証 | itemIdは贈答ホワイトリスト(消耗品のみ、`shared`で定義)。quantityは1-3。<br>当該NPCの好感度50以上。1会話1回まで、ゲーム内1日3回まで(全NPC合算) |
| 効果 | インベントリに追加し「◯◯を受け取った」表示 |

### 5. `propose_quest` — サブクエスト発行

| 項目 | 内容 |
|---|---|
| 入力 | `{ type: 'hunt'|'fetch'|'deliver', targetId: enum(typeに応じた既存ID), count: number, rewardGold: number, rewardItemId?: GiftableItemId, title: string, description: string }` |
| 検証 | countは1-5。rewardGoldは10-100。targetIdは実在する敵/アイテム/NPCのID。<br>受注中サブクエストが3件未満。title40字以内、description200字以内、出力壁通過 |
| 効果 | クエストジャーナルに「提案」として追加。**プレイヤーが受諾して初めて有効化**。<br>達成判定・報酬付与はゲームエンジン側の決定論的コードが行う |

### 6. `trigger_world_event` — 世界変化(夢シーン専用)

| 項目 | 内容 |
|---|---|
| 入力 | `{ event: WorldEvent }`(下記のdiscriminated union) |
| 検証 | 定義済み型のみ。1回の夢シーンで最大3件。テキスト系フィールドは出力壁通過 |
| 効果 | 翌朝の世界状態に反映 |

```ts
type WorldEvent =
  | { kind: 'weather'; value: 'clear'|'fog'|'rain'|'gloom' }
  | { kind: 'npc_rumor'; npcId: NpcId; rumor: string /* 120字以内。NPCの「今日の話題」に追加 */ }
  | { kind: 'street_event'; eventId: StreetEventId /* 定義済み演出: 行商人/黒猫/鐘の音 等 */ }
  | { kind: 'dungeon_shift'; layer: 1|2|3; encounterRateDelta: -10|0|10 /* %ポイント */ }
```

## 呼び出しフロー別仕様

| フロー | トリガー | モデル | ツール許可 | タイムアウト |
|---|---|---|---|---|
| NPC会話 | 話しかけ・自由入力送信 | haiku | speak, adjust_affinity, give_item | 初回トークンまで15秒 |
| サブクエスト生成 | 情報屋に「仕事はある?」 | sonnet | speak, propose_quest | 30秒 |
| 夢シーン | 宿屋に宿泊 | sonnet | narrate, trigger_world_event | 30秒 |
| 戦果描写 | 戦闘勝利(ボス・初見敵のみ。雑魚再戦は定型文) | haiku | narrate | 10秒 |

- モデルは `packages/server/config/ai.json` で変更可能にする
  (初期値: haiku=`claude-haiku-4-5`, sonnet=`claude-sonnet-5`)
- タイムアウト・エラー・検証全却下の場合は**定型フォールバック文**
  (シーン別に`shared`で定義、「…夢が霞んでいる…」等の世界観に沿った文)で進行
- リトライは1回まで。連続失敗時はそのゲーム内日はAI呼び出しを控えめにする
  (会話をフォールバック定型文+選択肢のみに縮退)

## レート・コスト保護(サブスク枠の保護)

- プレイヤー入力のレート制限: 会話送信は3秒に1回まで(クライアントとサーバー両方で)
- 同一内容の連続送信は拒否
- 雑魚戦の戦果描写など頻度の高いものは初回のみAI、以降は定型文
- `AI_MODE=mock` でDreamMasterを`MockDreamMaster`に差し替え可能にする。
  開発・E2Eは常にmockで行う(AGENTS.md参照)

## MockDreamMaster

- 本物と同じインターフェースを実装し、シーン別の決め打ち応答を返す
- ツール呼び出しもシミュレートする(例: 夢シーンで必ず`weather: fog`を発行)
  → ツール検証層・適用パスがE2Eで実際に通ることを保証する
- 攻撃リグレッションテスト用に「悪意ある応答モード」も持つ
  (ホワイトリスト外アイテム付与、上限超過など→検証層が却下することをテスト)

## 監査ログ

- `logs/ai/YYYY-MM-DD.jsonl` に1呼び出し1行で記録:
  タイムスタンプ、フロー種別、入力コンテキストのハッシュ、プレイヤー入力原文、
  応答テキスト、ツール呼び出しと検証結果(承認/却下+理由)、所要時間、モデル名
- `logs/`はgitignore。ローテーションは日次ファイル分割のみで可
