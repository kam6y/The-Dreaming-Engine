import { z } from "zod";

import type { NpcId } from "./ids.js";

/**
 * NPC 状態(好感度・会話記憶・今日の話題)の zod スキーマと純ヘルパー。
 * セーブ対象(game-design.md「セーブ/ロード」)。M4 で gameStateSchema へ組み込む。
 *
 * - 好感度: 0-100、初期30(game-design.md「NPC」)。50 以上で give_item 解禁
 *   (判定は会話開始時点のスナップショット値: ai-integration.md「give_item」)
 * - 会話記憶: 要約(200字以内・出力壁通過済みのみ永続化)+ 未要約の直近往復(最大10)
 * - 今日の話題: 1件。日送りでデフォルトへリセットし、npc_rumor が置き換える
 *   (ai-integration.md「会話セッション管理」)
 */

/** 好感度の下限(adjust_affinity 適用後にこの範囲へクランプ) */
export const AFFINITY_MIN = 0;
/** 好感度の上限 */
export const AFFINITY_MAX = 100;

/** 初期好感度(game-design.md「NPC」: 初期30) */
export const INITIAL_AFFINITY = 30;

/** give_item 解禁の好感度閾値(会話開始時点のスナップショット値で判定) */
export const GIVE_ITEM_AFFINITY_THRESHOLD = 50;

/** 未要約の直近往復の保持上限(ai-integration.md「会話セッション管理」) */
export const MAX_UNSUMMARIZED_EXCHANGES = 10;

/** 好感度を 0-100 にクランプする */
export function clampAffinity(value: number): number {
  return Math.min(AFFINITY_MAX, Math.max(AFFINITY_MIN, value));
}

/**
 * NPC 別のデフォルト「今日の話題」(裁量文。world-lore.md 3節「夢との関わり」を典拠に作成)。
 * 日送りでこの値へリセットし、trigger_world_event の npc_rumor が置き換える。
 */
export const DEFAULT_NPC_TOPICS: Record<NpcId, string> = {
  innkeeper: "このごろ泊まり客の夢見が悪いらしい。腹ごしらえと温い寝床が一番の薬だ、という話",
  merchant: "行商人から流れ着いた、産地の知れない品が棚の奥で鈍く光っている、という話",
  informant: "霧笛亭に持ち込まれる依頼が少し増えた。忘れ野のあたりが騒がしいらしい、という話",
  priest: "灯守堂の祈りの灯がひとつ揺らいだ。それでも機関はまだ祈りを聞いている、という話"
};

/** 1往復 = プレイヤーの自由入力1回とそれへの NPC(AI)応答1回の組 */
export const conversationExchangeSchema = z.object({
  /** 旅人(プレイヤー)の発言。保存時は機密マスク適用後のテキスト(ai-integration.md「監査ログ」) */
  player: z.string(),
  /** NPC(AI)の応答。出力壁を通過した全文のみ保存する(guardrails 第5層) */
  npc: z.string()
});
export type ConversationExchange = z.infer<typeof conversationExchangeSchema>;

/** 会話記憶(要約 + 未要約の直近往復 最大10) */
export const npcMemorySchema = z.object({
  /** 会話要約(空文字 = 要約なし。出力壁を通過したもののみ保存: guardrails 第5層) */
  summary: z.string().default(""),
  /** 未要約の直近往復(最大10。要約成功で 0 件に戻る) */
  recentExchanges: z.array(conversationExchangeSchema).max(MAX_UNSUMMARIZED_EXCHANGES).default([])
});
export type NpcMemory = z.infer<typeof npcMemorySchema>;

/** NPC 1人分の状態 */
export const npcStateSchema = z.object({
  affinity: z.number().int().min(AFFINITY_MIN).max(AFFINITY_MAX).default(INITIAL_AFFINITY),
  memory: npcMemorySchema.default(() => ({ summary: "", recentExchanges: [] })),
  /** 今日の話題(1件)。日送りで DEFAULT_NPC_TOPICS へリセット */
  topic: z.string()
});
export type NpcState = z.infer<typeof npcStateSchema>;

/** NPC 1人分のデフォルト状態(初期好感度30・記憶なし・デフォルト話題) */
export function createDefaultNpcState(npcId: NpcId): NpcState {
  return {
    affinity: INITIAL_AFFINITY,
    memory: { summary: "", recentExchanges: [] },
    topic: DEFAULT_NPC_TOPICS[npcId]
  };
}

/**
 * 全 NPC の状態(NpcId → NpcState)。各キーにデフォルトを持たせ、
 * M3 形式のセーブ(npcs 欠落)でも後方互換で復元できるようにする。
 * キー集合が npcIdSchema と一致することはユニットテストで担保する。
 */
export const npcStatesSchema = z.object({
  innkeeper: npcStateSchema.default(() => createDefaultNpcState("innkeeper")),
  merchant: npcStateSchema.default(() => createDefaultNpcState("merchant")),
  informant: npcStateSchema.default(() => createDefaultNpcState("informant")),
  priest: npcStateSchema.default(() => createDefaultNpcState("priest"))
});
export type NpcStates = z.infer<typeof npcStatesSchema>;

/** 全 NPC のデフォルト状態 */
export function createDefaultNpcStates(): NpcStates {
  return {
    innkeeper: createDefaultNpcState("innkeeper"),
    merchant: createDefaultNpcState("merchant"),
    informant: createDefaultNpcState("informant"),
    priest: createDefaultNpcState("priest")
  };
}

/** 未要約往復を追記する(上限超過時は古い順に落とし、直近 MAX_UNSUMMARIZED_EXCHANGES 件を保持) */
export function appendUnsummarizedExchange(memory: NpcMemory, exchange: ConversationExchange): NpcMemory {
  const next = [...memory.recentExchanges, exchange];
  return {
    summary: memory.summary,
    recentExchanges: next.slice(Math.max(0, next.length - MAX_UNSUMMARIZED_EXCHANGES))
  };
}
