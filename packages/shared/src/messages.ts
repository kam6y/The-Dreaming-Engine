import { z } from "zod";

import { giftableItemIdSchema } from "./ai/giftable.js";
import {
  battleCommandSchema,
  battleEventSchema,
  battleOutcomeSchema,
  battleUnitViewSchema
} from "./combat/battle.js";
import { enemySymbolPlacementSchema } from "./combat/encounter.js";
import { itemIdSchema } from "./combat/items.js";
import { MAX_LEVEL } from "./combat/stats.js";
import { statusStateSchema } from "./combat/status.js";
import { gameLocationSchema } from "./game-state.js";
import { directionSchema } from "./geometry.js";
import { enemyIdSchema, npcIdSchema } from "./ids.js";
import { mainQuestStageSchema, subQuestStatusSchema } from "./quests.js";

export const GAME_TITLE = "The Dreaming Engine";

// ===========================================================================
// クライアント権威スナップショット(server→client のビュー)
//
// GameState の正本はサーバーが保持し、毎操作後にこのビューをクライアントへ送る。
// 探索/戦闘のモード、プレイヤー状態、現マップの敵シンボル、店の在庫など、
// UI の再構築に必要な全情報を含む(ai-integration.md「全体像」の再同期)。
// ===========================================================================

/** インベントリ表示用スタック(名称・クエスト品フラグ付き) */
export const viewItemStackSchema = z.object({
  itemId: itemIdSchema,
  name: z.string(),
  count: z.number().int().positive(),
  questItem: z.boolean()
});
export type ViewItemStack = z.infer<typeof viewItemStackSchema>;

/** プレイヤー状態のビュー */
export const viewPlayerSchema = z.object({
  level: z.number().int(),
  xp: z.number().int(),
  /** 次レベルまでの必要経験値。最大レベルなら null */
  xpToNext: z.number().int().nullable(),
  hp: z.number().int(),
  maxHp: z.number().int(),
  mp: z.number().int(),
  maxMp: z.number().int(),
  gold: z.number().int()
});
export type ViewPlayer = z.infer<typeof viewPlayerSchema>;

/** 戦闘モードのビュー(mode==="battle" のとき snapshot.battle に入る) */
export const viewBattleSchema = z.object({
  enemyId: enemyIdSchema,
  enemyName: z.string(),
  isBoss: z.boolean(),
  turn: z.number().int(),
  outcome: battleOutcomeSchema,
  player: z.object({
    level: z.number().int(),
    hp: z.number().int(),
    maxHp: z.number().int(),
    mp: z.number().int(),
    maxMp: z.number().int(),
    statuses: z.array(statusStateSchema)
  }),
  enemy: battleUnitViewSchema
});
export type ViewBattle = z.infer<typeof viewBattleSchema>;

/**
 * 会話でプレイヤーが取りうるアクション(会話 UI が options として表示する)。
 * - send        : 自由入力の送信(conversation-send)
 * - accept       : 提案中サブクエストの受諾(conversation-choose choice=accept)
 * - decline      : 提案中サブクエストの辞退(conversation-choose choice=decline)
 * - end          : 会話の終了(conversation-end。要約フローへ)
 * - quest-request: 情報屋への「仕事はある?」(quest-request)
 */
export const conversationActionSchema = z.enum(["send", "accept", "decline", "end", "quest-request"]);
export type ConversationAction = z.infer<typeof conversationActionSchema>;

/** 報酬アイテム表示(id + 表示名)。give_item/propose_quest の贈答ホワイトリスト内 */
export const rewardItemViewSchema = z.object({ itemId: giftableItemIdSchema, name: z.string() });
export type RewardItemView = z.infer<typeof rewardItemViewSchema>;

/** 提案中サブクエストの表示情報(受諾前。会話 overlay に提示する) */
export const pendingProposalViewSchema = z.object({
  type: z.enum(["hunt", "fetch"]),
  title: z.string(),
  description: z.string(),
  count: z.number().int(),
  rewardGold: z.number().int(),
  rewardItem: rewardItemViewSchema.optional()
});
export type PendingProposalView = z.infer<typeof pendingProposalViewSchema>;

/**
 * 有効な対話(interact で開く UI のシグナル)。
 * `interact`(商人=shop / 宿屋の主人=inn / 情報屋・司祭=conversation)で設定し、`move` 等で解除する。
 * クライアントはこの種別で店/宿/会話の overlay を切り替える。各操作は該当種別のときのみ有効。
 */
export const activeInteractionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("shop"),
    npcId: npcIdSchema,
    npcName: z.string(),
    stock: z.array(
      z.object({ itemId: itemIdSchema, name: z.string(), buyPrice: z.number().int() })
    )
  }),
  z.object({
    kind: z.literal("inn"),
    npcId: npcIdSchema,
    npcName: z.string(),
    costGold: z.number().int()
  }),
  z.object({
    kind: z.literal("conversation"),
    npcId: npcIdSchema,
    npcName: z.string(),
    /** 現在取りうるアクション(状態依存。提案中なら accept/decline を含む) */
    options: z.array(conversationActionSchema),
    /** 提案中サブクエスト(あれば)。無ければ省略 */
    pendingProposal: pendingProposalViewSchema.optional()
  })
]);
export type ActiveInteraction = z.infer<typeof activeInteractionSchema>;

/**
 * 受注中サブクエストの表示情報(クエストジャーナル用)。SnapshotView.subQuests に含める。
 * targetName は type 別の表示名(hunt=敵名 / fetch=アイテム名)。
 */
export const subQuestViewSchema = z.object({
  id: z.string(),
  type: z.enum(["hunt", "fetch"]),
  targetName: z.string(),
  progress: z.number().int(),
  count: z.number().int(),
  rewardGold: z.number().int(),
  rewardItem: rewardItemViewSchema.optional(),
  title: z.string(),
  description: z.string(),
  status: subQuestStatusSchema
});
export type SubQuestView = z.infer<typeof subQuestViewSchema>;

export const snapshotViewSchema = z.object({
  /** 探索 or 戦闘 */
  mode: z.enum(["exploration", "battle"]),
  /**
   * メインクエスト段階(毎スナップショットに載せる)。クライアント(M6-B)は
   * これでオープニング要否・ボスマーカーの表示可否・ボス撃破後のエンディング遷移を判定する。
   * ボスマーカー表示: rift-revealed で描画・戦闘可。arrival は接触時に司祭誘導・
   * dream-eater-defeated 以降は非アクティブ(描画対象から外す)。
   */
  mainQuestStage: mainQuestStageSchema,
  player: viewPlayerSchema,
  /** ゲーム内日付(1日目〜) */
  day: z.number().int().positive(),
  /** プレイ時間(秒) */
  playtimeSeconds: z.number().int().nonnegative(),
  /** 現在地(マップ・座標・向き)。戦闘中も直前の探索位置を保持 */
  location: gameLocationSchema,
  /** 通常アイテム(所持上限の対象) */
  inventory: z.array(viewItemStackSchema),
  /** クエスト用アイテム(別枠) */
  questItems: z.array(viewItemStackSchema),
  inventoryCapacity: z.number().int(),
  inventoryUsed: z.number().int(),
  /** 現マップの敵シンボル(探索時) */
  symbols: z.array(enemySymbolPlacementSchema),
  /**
   * 現マップで既に解決/消費されたオブジェクト id(開封済み宝箱 + 今回訪問で採取済みの採取点)。
   * クライアントはこれらのオブジェクトを描画しない。
   */
  resolvedObjectIds: z.array(z.string()),
  /** 受注中サブクエスト(クエストジャーナル)。無くても空配列で常に含める */
  subQuests: z.array(subQuestViewSchema),
  /** 有効な対話(店/宿/会話)。無ければ省略 */
  interaction: activeInteractionSchema.optional(),
  /** 戦闘ビュー(mode==="battle" のときのみ) */
  battle: viewBattleSchema.optional()
});
export type SnapshotView = z.infer<typeof snapshotViewSchema>;

// ===========================================================================
// クライアント → サーバー(操作イベント)。すべて zod でパースしてから処理する。
// ===========================================================================

export const clientPingMessageSchema = z.object({
  type: z.literal("ping"),
  sentAt: z.number().int().nonnegative()
});

/**
 * 新規ゲーム開始オプション(E2E/デバッグ用のシード固定・シンボル無効化・開始レベル)。
 * startLevel はテスト加速用で、サーバーは mock(非 live)時のみ尊重する
 * (通しプレイ E2E がボス(推奨 Lv5-6)へ到達して勝つための加速。live では無視)。
 */
export const newGameOptionsSchema = z.object({
  seed: z.number().int().optional(),
  noSymbols: z.boolean().optional(),
  startLevel: z.number().int().min(1).max(MAX_LEVEL).optional()
});

export const clientNewGameMessageSchema = z.object({
  type: z.literal("new-game"),
  options: newGameOptionsSchema.optional()
});

export const clientContinueMessageSchema = z.object({ type: z.literal("continue") });

export const clientMoveMessageSchema = z.object({
  type: z.literal("move"),
  direction: directionSchema
});

export const clientInteractMessageSchema = z.object({ type: z.literal("interact") });

export const clientBattleCommandMessageSchema = z.object({
  type: z.literal("battle-command"),
  command: battleCommandSchema
});

export const clientUseItemMessageSchema = z.object({
  type: z.literal("use-item"),
  itemId: itemIdSchema
});

export const clientDiscardItemMessageSchema = z.object({
  type: z.literal("discard-item"),
  itemId: itemIdSchema,
  quantity: z.number().int().positive().default(1)
});

export const clientShopBuyMessageSchema = z.object({
  type: z.literal("shop-buy"),
  itemId: itemIdSchema,
  quantity: z.number().int().positive()
});

export const clientShopSellMessageSchema = z.object({
  type: z.literal("shop-sell"),
  itemId: itemIdSchema,
  quantity: z.number().int().positive()
});

export const clientRestMessageSchema = z.object({ type: z.literal("rest") });

/**
 * 会話中の自由入力送信。`text` の sanitize(制御文字除去)と厳密な長さ上限は
 * **サーバーが強制**する(config playerInputMaxLength)。ここでの上限は粗い DoS ガードのみ
 * (サーバーが切り詰めるべき長さでもパース段では拒否せず受ける)。
 */
export const clientConversationSendMessageSchema = z.object({
  type: z.literal("conversation-send"),
  text: z.string().max(4000)
});

/** 提案中サブクエストの受諾/辞退 */
export const clientConversationChooseMessageSchema = z.object({
  type: z.literal("conversation-choose"),
  choice: z.enum(["accept", "decline"])
});

/** 会話の終了(要約フローへ)。会話 overlay を閉じる */
export const clientConversationEndMessageSchema = z.object({ type: z.literal("conversation-end") });

/** 情報屋への「仕事はある?」(サブクエスト生成の要求) */
export const clientQuestRequestMessageSchema = z.object({ type: z.literal("quest-request") });

export const clientMessageSchema = z.discriminatedUnion("type", [
  clientPingMessageSchema,
  clientNewGameMessageSchema,
  clientContinueMessageSchema,
  clientMoveMessageSchema,
  clientInteractMessageSchema,
  clientBattleCommandMessageSchema,
  clientUseItemMessageSchema,
  clientDiscardItemMessageSchema,
  clientShopBuyMessageSchema,
  clientShopSellMessageSchema,
  clientRestMessageSchema,
  clientConversationSendMessageSchema,
  clientConversationChooseMessageSchema,
  clientConversationEndMessageSchema,
  clientQuestRequestMessageSchema
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ===========================================================================
// サーバー → クライアント
// ===========================================================================

/** M0 由来の接続直後メッセージ(スキーマ互換のため残置。現在は hello を送る) */
export const serverStateMessageSchema = z.object({
  type: z.literal("state"),
  title: z.literal(GAME_TITLE)
});

export const serverPongMessageSchema = z.object({
  type: z.literal("pong"),
  sentAt: z.number().int().nonnegative(),
  receivedAt: z.number().int().nonnegative()
});

export const serverErrorMessageSchema = z.object({
  type: z.literal("error"),
  message: z.string().min(1),
  /** 機械可読なエラー種別(no-save / save-corrupted / inventory-full 等)。省略時は汎用エラー */
  code: z.string().optional()
});

/** 接続直後の hello(セーブ有無) */
export const serverHelloMessageSchema = z.object({
  type: z.literal("hello"),
  title: z.literal(GAME_TITLE),
  hasSave: z.boolean()
});

/** 権威スナップショット(毎操作後の完全なクライアント向けビュー) */
export const serverSnapshotMessageSchema = z.object({
  type: z.literal("snapshot"),
  view: snapshotViewSchema
});

/** ダイアログ表示(話者+本文)。話者が地の文なら speaker=null */
export const serverDialogMessageSchema = z.object({
  type: z.literal("dialog"),
  speaker: z.string().nullable(),
  body: z.string().min(1)
});

/** 戦闘イベント列(1ターン分の解決結果) */
export const serverBattleEventsMessageSchema = z.object({
  type: z.literal("battle-events"),
  events: z.array(battleEventSchema)
});

/**
 * 検証済みの AI 発話/ナレーション(探索の dialog キューとは別チャンネル)。
 * クライアントの TypewriterText がこの**検証済み全文**を疑似ストリーミング表示する
 * (未検証テキストは送らない: ai-guardrails.md 第4層)。
 * - channel: speak(NPC 発話)/ narrate(情景・夢・戦果)
 * - npcId: 発話 NPC(speak 時)。narrate や地の文では省略
 */
export const serverAiUtteranceMessageSchema = z.object({
  type: z.literal("ai-utterance"),
  channel: z.enum(["speak", "narrate"]),
  npcId: npcIdSchema.optional(),
  text: z.string().min(1)
});

export const serverMessageSchema = z.discriminatedUnion("type", [
  serverStateMessageSchema,
  serverPongMessageSchema,
  serverErrorMessageSchema,
  serverHelloMessageSchema,
  serverSnapshotMessageSchema,
  serverDialogMessageSchema,
  serverBattleEventsMessageSchema,
  serverAiUtteranceMessageSchema
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;
