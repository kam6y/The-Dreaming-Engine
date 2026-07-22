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

/** 会話要約の長さ上限(200字。出力壁 checkDisplayText の maxLength に使う: ai-integration.md「会話セッション管理」124) */
export const SUMMARY_MAX_LENGTH = 200;

/** 好感度を 0-100 にクランプする */
export function clampAffinity(value: number): number {
  return Math.min(AFFINITY_MAX, Math.max(AFFINITY_MIN, value));
}

// ===========================================================================
// 好感度の段階(game-design.md「好感度の段階(拡張: M11)」)
// ===========================================================================

/** 好感度の段階(4段階)。境界は give_item の解禁閾値50と整合(50が段階境界) */
export const AFFINITY_TIER_IDS = ["wary", "distant", "friendly", "trusted"] as const;
export const affinityTierSchema = z.enum(AFFINITY_TIER_IDS);
export type AffinityTier = z.infer<typeof affinityTierSchema>;

/** 段階1件の定義(下限・上限・日本語表示名。仕様表と一致させる) */
export interface AffinityTierDefinition {
  id: AffinityTier;
  /** 日本語の段階名(仕様表の名称) */
  label: string;
  /** この段階に属する好感度の下限(含む) */
  min: number;
  /** この段階に属する好感度の上限(含む) */
  max: number;
}

/**
 * 段階表(昇順・隙間なく 0-100 を被覆)。friendly の下限は
 * GIVE_ITEM_AFFINITY_THRESHOLD(50)と一致する(ユニットテストで担保)。
 */
export const AFFINITY_TIERS: readonly AffinityTierDefinition[] = [
  { id: "wary", label: "警戒", min: 0, max: 19 },
  { id: "distant", label: "よそよそしい", min: 20, max: 49 },
  { id: "friendly", label: "打ち解けた", min: 50, max: 79 },
  { id: "trusted", label: "信頼", min: 80, max: 100 }
];

/**
 * 好感度 → 段階の写像(純関数)。範囲外の値はクランプしてから判定する。
 * 段階表の下限を降順に照合するため、表と実装が常に一致する。
 */
export function affinityTier(affinity: number): AffinityTier {
  const value = clampAffinity(affinity);
  for (let i = AFFINITY_TIERS.length - 1; i >= 0; i -= 1) {
    const tier = AFFINITY_TIERS[i];
    if (tier !== undefined && value >= tier.min) {
      return tier.id;
    }
  }
  return "wary"; // clampAffinity 後は必ず表に該当するため到達しない
}

/** 段階 ID → 定義(表示名の参照用。M11-2 のプロンプト・M11-3 の UI で使う) */
export function affinityTierDefinition(tier: AffinityTier): AffinityTierDefinition {
  const found = AFFINITY_TIERS.find((t) => t.id === tier);
  if (found === undefined) {
    throw new Error(`未定義の好感度段階: ${tier}`); // enum 網羅により到達しない
  }
  return found;
}

/**
 * NPC 別のデフォルト「今日の話題」(裁量文。world-lore.md 3節「夢との関わり」を典拠に作成)。
 * 日送りでこの値へリセットし、trigger_world_event の npc_rumor が置き換える。
 */
export const DEFAULT_NPC_TOPICS: Record<NpcId, string> = {
  innkeeper: "このごろ泊まり客の夢見が悪いらしい。腹ごしらえと温い寝床が一番の薬だ、という話",
  merchant: "行商人から流れ着いた、産地の知れない品が棚の奥で鈍く光っている、という話",
  informant: "霧笛亭に持ち込まれる依頼が少し増えた。忘れ野のあたりが騒がしいらしい、という話",
  priest: "灯守堂の祈りの灯がひとつ揺らいだ。それでも機関はまだ祈りを聞いている、という話",
  // 第2エリア「琥珀郷」の3人(M16。world-lore.md 3.6〜3.8「夢との関わり」を典拠)
  caretaker: "寄り屋の囲炉裏が夜更けによく爆ぜる。火のそばで一夜を過ごせば夢見も穏やかになる、という話",
  artisan: "沈み野の採取場で、灯の亡骸の細片がこのところ多く採れる。何かの前触れか、という話",
  // 表の節・公開の言い伝えに留める(坑=灯の還るところ は 2.6 の公開ロア。「歌われなくなった続き」は
  // トワの50-69帯の秘密なので初期話題に載せない=world-lore 3.0 の帯規約)
  warden: "坑口の番人トワが、灯がこの坑へ還るという古い言い伝えを、唄にして口ずさんでいる、という話"
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
  priest: npcStateSchema.default(() => createDefaultNpcState("priest")),
  // 第2エリア「琥珀郷」の3人(M16)。旧セーブ(このキー欠落)でも default で初期状態(好感度30)に倒す
  caretaker: npcStateSchema.default(() => createDefaultNpcState("caretaker")),
  artisan: npcStateSchema.default(() => createDefaultNpcState("artisan")),
  warden: npcStateSchema.default(() => createDefaultNpcState("warden"))
});
export type NpcStates = z.infer<typeof npcStatesSchema>;

/** 全 NPC のデフォルト状態 */
export function createDefaultNpcStates(): NpcStates {
  return {
    innkeeper: createDefaultNpcState("innkeeper"),
    merchant: createDefaultNpcState("merchant"),
    informant: createDefaultNpcState("informant"),
    priest: createDefaultNpcState("priest"),
    caretaker: createDefaultNpcState("caretaker"),
    artisan: createDefaultNpcState("artisan"),
    warden: createDefaultNpcState("warden")
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
