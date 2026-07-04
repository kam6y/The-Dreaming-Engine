import type {
  AiDailyCounters,
  DungeonLayer,
  DungeonSymbolCounts,
  GiftableItemId,
  Inventory,
  NpcId,
  SubQuest,
  WorldEvent
} from "@dreaming-engine/shared";

/**
 * ゲーム内AI(DreamMaster)6ツール検証層の共通型・定数(guardrails 第1層 / ai-integration.md
 * 「カスタムツール定義」)。検証器は純関数で、まず zod スキーマ検証、その後ゲームルール検証を行い、
 * GameState を変更せず I/O もしない。結果は判別可能ユニオンで返す。
 *
 * 状態は「永続」と「揮発」に分離する(最重要):
 * - 永続(GameState 由来): aiDaily / NPC 別 affinity / inventory / subQuests / dungeonSymbolCounts。
 * - 揮発(会話セッション。GameState に載せない): 会話相手・会話開始時点の好感度スナップショット・
 *   会話内カウンタ・未受諾提案。M4-C のセッションマネージャがこの契約に沿った値を供給する
 *   (本層はセッションマネージャを import・構築しない。型を定義するだけ)。
 */

// ---------------------------------------------------------------------------
// 検証結果(判別可能ユニオン)
// ---------------------------------------------------------------------------

/** effect = 承認済み変更記述子(後続 M4-E が決定論的に適用する値)。reason = 監査ログ用文字列 */
export type ValidationResult<E> =
  | { readonly ok: true; readonly effect: E }
  | { readonly ok: false; readonly reason: string };

// ---------------------------------------------------------------------------
// ツール別の効果記述子
// ---------------------------------------------------------------------------

/** speak: 出力壁で正規化した発話テキスト */
export interface SpeakEffect {
  readonly kind: "speak";
  readonly text: string;
}

/** narrate: 出力壁で正規化した情景/戦果テキスト */
export interface NarrateEffect {
  readonly kind: "narrate";
  readonly text: string;
}

/** adjust_affinity: 適用後クランプ(0..100)した好感度と、日次カウンタへ加算する申告 delta */
export interface AdjustAffinityEffect {
  readonly kind: "adjust_affinity";
  readonly npcId: NpcId;
  readonly affinity: number;
  readonly delta: number;
}

/** give_item: インベントリへ追加するアイテムの記述子 */
export interface GiveItemEffect {
  readonly kind: "give_item";
  readonly itemId: GiftableItemId;
  readonly quantity: number;
}

/** propose_quest: createProposedQuest で作った「提案」状態の SubQuest */
export interface ProposeQuestEffect {
  readonly kind: "propose_quest";
  readonly quest: SubQuest;
}

/** dungeon_shift 適用後の対象層カウント(dungeon_shift 以外は null) */
export interface AppliedDungeonSymbolCount {
  readonly layer: DungeonLayer;
  readonly count: number;
}

/** trigger_world_event(単一): 正規化済みイベントと、dungeon_shift の適用後カウント */
export interface SingleWorldEventEffect {
  readonly kind: "world_event";
  readonly event: WorldEvent;
  readonly dungeonSymbolCount: AppliedDungeonSymbolCount | null;
}

/** ディスパッチャが返す全ツール効果のユニオン(kind で判別) */
export type ToolEffect =
  | SpeakEffect
  | NarrateEffect
  | AdjustAffinityEffect
  | GiveItemEffect
  | ProposeQuestEffect
  | SingleWorldEventEffect;

// ---------------------------------------------------------------------------
// 夢シーンのイベントリスト(最大3件・解決規則適用後)
// ---------------------------------------------------------------------------

/** 夢シーンで却下された要素(監査ログ用。index は入力リスト内の位置) */
export interface RejectedEvent {
  readonly index: number;
  readonly reason: string;
}

/** 夢シーンの世界状態変化記述子(解決規則適用後の有効イベントと、累積適用後のシンボル数) */
export interface DreamEventsEffect {
  readonly kind: "dream_world_events";
  /** 解決後に有効な非累積イベント(weather=後勝ち1件 / npc_rumor=NPC別後勝ち / street_event=id別1件) */
  readonly events: readonly WorldEvent[];
  /** dungeon_shift を承認順に累積適用した後の各層シンボル数 */
  readonly dungeonSymbolCounts: DungeonSymbolCounts;
}

/** 夢シーンのイベントリスト検証結果(常に effect を返し、却下要素は rejected に記録) */
export interface DreamEventsResult {
  readonly effect: DreamEventsEffect;
  readonly rejected: readonly RejectedEvent[];
}

// ---------------------------------------------------------------------------
// 検証器ごとのコンテキスト(永続 + 揮発の必要分)
// ---------------------------------------------------------------------------

export interface AdjustAffinityContext {
  /** 現在の会話相手(npcId はこれと一致必須) */
  readonly partnerNpcId: NpcId;
  /** 会話内の adjust_affinity 承認回数(この値が上限未満で許可) */
  readonly adjustAffinityCount: number;
  /** 対象NPCの日次累積 delta(承認申告値の合計。永続) */
  readonly dailyAffinityDelta: number;
  /** 対象NPCの現在の永続好感度(effect の適用後値の算出に使う) */
  readonly currentAffinity: number;
}

export interface GiveItemContext {
  /** 会話開始時点の好感度スナップショット(解禁判定はこの値のみを読む) */
  readonly affinityAtOpen: number;
  /** 現在のインベントリ(空き枠判定に使う。永続) */
  readonly inventory: Inventory;
  /** 会話内の give_item 承認回数(この値が上限未満で許可) */
  readonly giveItemCountInConversation: number;
  /** ゲーム内1日の give_item 承認回数(全NPC合算。永続) */
  readonly giveItemCountToday: number;
}

export interface ProposeQuestContext {
  /** 受注中サブクエスト(枠占有数の判定に使う。永続) */
  readonly subQuests: readonly SubQuest[];
  /** 未受諾提案(non-null なら新規提案を却下。揮発) */
  readonly pendingProposal: SubQuest | null;
  /** ゲーム内1日の propose_quest 発行数(永続) */
  readonly proposeQuestCount: number;
  /** ゲーム内1日の rewardItemId 付き提案の発行数(永続) */
  readonly rewardItemProposalCount: number;
  /** 生成する提案 SubQuest の id(セッションマネージャが採番。純関数化のため引数で受ける) */
  readonly questId: string;
}

export interface DreamEventsContext {
  /** 各ダンジョン層の現在のシンボル数(dungeon_shift 累積適用の起点。永続) */
  readonly dungeonSymbolCounts: DungeonSymbolCounts;
}

// ---------------------------------------------------------------------------
// ディスパッチャ用の統合コンテキスト
// ---------------------------------------------------------------------------

/** 会話セッション(揮発。会話・questGeneration フローで有効。dream/battleResult では null) */
export interface ConversationSessionContext {
  readonly partnerNpcId: NpcId;
  readonly affinityAtOpen: number;
  readonly adjustAffinityCount: number;
  readonly giveItemCount: number;
  readonly pendingProposal: SubQuest | null;
}

/** 永続スナップショット(GameState 由来。検証器は読むだけで変更しない) */
export interface PersistentStateContext {
  readonly aiDaily: AiDailyCounters;
  readonly affinityByNpc: Readonly<Record<NpcId, number>>;
  readonly inventory: Inventory;
  readonly subQuests: readonly SubQuest[];
  readonly dungeonSymbolCounts: DungeonSymbolCounts;
  /** 生成する提案 SubQuest の id(セッションマネージャが採番) */
  readonly nextQuestId: string;
}

/** validateToolCall が受け取る統合コンテキスト */
export interface ToolValidationContext {
  readonly session: ConversationSessionContext | null;
  readonly persistent: PersistentStateContext;
}

// ---------------------------------------------------------------------------
// フロー / ツール名 / フロー別許可集合(guardrails 第1層: 二重チェック)
// ---------------------------------------------------------------------------

export const TOOL_FLOWS = [
  "conversation",
  "questGeneration",
  "dream",
  "battleResult",
  "summary"
] as const;
export type ToolFlow = (typeof TOOL_FLOWS)[number];

export const TOOL_NAMES = [
  "speak",
  "narrate",
  "adjust_affinity",
  "give_item",
  "propose_quest",
  "trigger_world_event"
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/**
 * フロー別のツール許可集合(ai-integration.md「呼び出しフロー別仕様」220-226)。
 * summary はツールなし(空集合)。ディスパッチャはまずこの集合で二重チェックしてから振り分ける。
 */
export const FLOW_TOOL_ALLOWLIST: Record<ToolFlow, readonly ToolName[]> = {
  conversation: ["speak", "adjust_affinity", "give_item"],
  questGeneration: ["speak", "propose_quest"],
  dream: ["narrate", "trigger_world_event"],
  battleResult: ["narrate"],
  summary: []
};

// ---------------------------------------------------------------------------
// 検証の定数(仕様値。ai-integration.md「カスタムツール定義」)
// ---------------------------------------------------------------------------

/** speak の長さ上限(400字) */
export const SPEAK_MAX_LENGTH = 400;
/** narrate の長さ上限(300字) */
export const NARRATE_MAX_LENGTH = 300;

/** adjust_affinity: delta の範囲(-10..+10 の整数) */
export const ADJUST_AFFINITY_DELTA_MIN = -10;
export const ADJUST_AFFINITY_DELTA_MAX = 10;
/** adjust_affinity: 1会話あたりの承認上限 */
export const ADJUST_AFFINITY_PER_CONVERSATION_MAX = 2;
/** adjust_affinity: 同一NPCの日次累積 delta の絶対上限(±20) */
export const ADJUST_AFFINITY_DAILY_ABS_MAX = 20;

/** give_item: quantity の範囲(1..3 の整数) */
export const GIVE_ITEM_QUANTITY_MIN = 1;
export const GIVE_ITEM_QUANTITY_MAX = 3;
/** give_item: 1会話あたりの承認上限 */
export const GIVE_ITEM_PER_CONVERSATION_MAX = 1;
/** give_item: ゲーム内1日あたりの承認上限(全NPC合算) */
export const GIVE_ITEM_PER_DAY_MAX = 3;

/** propose_quest: ゲーム内1日あたりの発行上限 */
export const PROPOSE_QUEST_PER_DAY_MAX = 3;
/** propose_quest: rewardItemId 付き提案のゲーム内1日あたりの発行上限 */
export const REWARD_ITEM_PROPOSAL_PER_DAY_MAX = 1;

/** trigger_world_event: 1回の夢シーンで受け付けるイベント数の上限 */
export const DREAM_EVENTS_MAX = 3;
