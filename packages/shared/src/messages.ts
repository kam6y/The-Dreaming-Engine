import { z } from "zod";

import {
  battleCommandSchema,
  battleEventSchema,
  battleOutcomeSchema,
  battleUnitViewSchema
} from "./combat/battle.js";
import { enemySymbolPlacementSchema } from "./combat/encounter.js";
import { itemIdSchema } from "./combat/items.js";
import { statusStateSchema } from "./combat/status.js";
import { gameLocationSchema } from "./game-state.js";
import { directionSchema } from "./geometry.js";
import { enemyIdSchema, npcIdSchema } from "./ids.js";

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
 * 有効な対話(interact で開く UI のシグナル)。
 * `interact`(商人/宿屋の主人)で設定し、`move` 等で解除する。クライアントはこの有無で
 * 店/宿の overlay を開く。買う/売る/泊まるの各操作はこれが該当種別のときのみ有効。
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
  })
]);
export type ActiveInteraction = z.infer<typeof activeInteractionSchema>;

export const snapshotViewSchema = z.object({
  /** 探索 or 戦闘 */
  mode: z.enum(["exploration", "battle"]),
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
  /** 有効な対話(店/宿)。無ければ省略 */
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

/** 新規ゲーム開始オプション(E2E/デバッグ用のシード固定・シンボル無効化) */
export const newGameOptionsSchema = z.object({
  seed: z.number().int().optional(),
  noSymbols: z.boolean().optional()
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
  clientRestMessageSchema
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

export const serverMessageSchema = z.discriminatedUnion("type", [
  serverStateMessageSchema,
  serverPongMessageSchema,
  serverErrorMessageSchema,
  serverHelloMessageSchema,
  serverSnapshotMessageSchema,
  serverDialogMessageSchema,
  serverBattleEventsMessageSchema
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;
