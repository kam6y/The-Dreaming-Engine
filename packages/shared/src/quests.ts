import { z } from "zod";

import { fetchTargetIdSchema } from "./ai/fetch.js";
import { giftableItemIdSchema } from "./ai/giftable.js";
import { huntTargetIdSchema } from "./ai/hunt.js";
import type { FetchTargetId } from "./ai/fetch.js";
import type { GiftableItemId } from "./ai/giftable.js";
import type { HuntTargetId } from "./ai/hunt.js";
import type { EnemyId } from "./ids.js";
import { addItem, countOf, freeSpace, removeItem } from "./inventory.js";
import type { Inventory } from "./inventory.js";

/**
 * クエストエンジン(メインクエスト段階 + サブクエスト状態機械)。
 * Phaser 非依存の純ロジック。仕様の正: game-design.md「メインクエスト」/
 * ai-integration.md「propose_quest」(達成の意味論・満杯時の報酬保留)。
 */

// ---------------------------------------------------------------------------
// メインクエスト段階(M6 で進行に使用)
// ---------------------------------------------------------------------------

/**
 * メインクエスト段階(game-design.md「メインクエスト」手順1-5 を最小の enum で表す。語彙は裁量):
 * - arrival             : オープニング後。記憶を失った旅人が街に流れ着いた(手順1)
 * - rift-revealed       : 司祭との会話で「綻びの原因は夢喰い」と知った(手順2。以降ダンジョン攻略=手順3)
 * - dream-eater-defeated: ボス「夢喰い」撃破(手順4)
 * - epilogue            : エンディング視聴済み(手順5)
 */
export const MAIN_QUEST_STAGES = ["arrival", "rift-revealed", "dream-eater-defeated", "epilogue"] as const;
export const mainQuestStageSchema = z.enum(MAIN_QUEST_STAGES);
export type MainQuestStage = z.infer<typeof mainQuestStageSchema>;

/** 新規ゲームのメインクエスト段階 */
export const MAIN_QUEST_INITIAL_STAGE: MainQuestStage = "arrival";

// ---------------------------------------------------------------------------
// サブクエスト: 定数・スキーマ
// ---------------------------------------------------------------------------

/** 受注中サブクエストの同時上限(game-design.md) */
export const SUB_QUEST_MAX_ACTIVE = 3;
/** count の範囲(1-5 の整数: ai-integration.md「propose_quest」) */
export const SUB_QUEST_COUNT_MIN = 1;
export const SUB_QUEST_COUNT_MAX = 5;
/** rewardGold の範囲(10-100 の整数) */
export const SUB_QUEST_REWARD_GOLD_MIN = 10;
export const SUB_QUEST_REWARD_GOLD_MAX = 100;
/** 報酬対難度の比: rewardGold ≤ count × この係数 */
export const SUB_QUEST_REWARD_GOLD_PER_COUNT = 20;
/** title / description の長さ上限 */
export const SUB_QUEST_TITLE_MAX_LENGTH = 40;
export const SUB_QUEST_DESCRIPTION_MAX_LENGTH = 200;

/**
 * サブクエスト状態(語彙は裁量。JOURNAL 記録対象):
 * - proposed : AI が提案し未受諾(同時1件。未受諾のまま会話終了で破棄=セーブに載らない)
 * - active   : 受諾済み・進行中(受注枠を占有)
 * - completed: 達成条件到達(hunt=討伐数到達。fetch は報告時に所持数で判定するため active のまま。受注枠を占有)
 * - reported : 情報屋へ報告済み(報酬受領済み。受注枠から外れる)
 */
export const subQuestStatusSchema = z.enum(["proposed", "active", "completed", "reported"]);
export type SubQuestStatus = z.infer<typeof subQuestStatusSchema>;

const subQuestBaseShape = {
  id: z.string().min(1),
  /** 目標数(hunt=討伐数 / fetch=納品数) */
  count: z.number().int().min(SUB_QUEST_COUNT_MIN).max(SUB_QUEST_COUNT_MAX),
  /** hunt: 受注後の討伐数(count でキャップ)。fetch では常に 0(所持数は報告時に判定) */
  progress: z.number().int().nonnegative().default(0),
  rewardGold: z
    .number()
    .int()
    .min(SUB_QUEST_REWARD_GOLD_MIN)
    .max(SUB_QUEST_REWARD_GOLD_MAX),
  /** 報酬アイテム(贈答ホワイトリスト内・1個)。任意 */
  rewardItemId: giftableItemIdSchema.optional(),
  title: z.string().min(1).max(SUB_QUEST_TITLE_MAX_LENGTH),
  description: z.string().min(1).max(SUB_QUEST_DESCRIPTION_MAX_LENGTH),
  status: subQuestStatusSchema
} as const;

/**
 * サブクエスト。targetId は type 別の達成可能ホワイトリスト
 * (hunt=HuntTargetId / fetch=FetchTargetId)でのみ構成できる。
 */
export const subQuestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hunt"), targetId: huntTargetIdSchema, ...subQuestBaseShape }),
  z.object({ type: z.literal("fetch"), targetId: fetchTargetIdSchema, ...subQuestBaseShape })
]);
export type SubQuest = z.infer<typeof subQuestSchema>;

/** 未受諾提案スロット(同時1件)。会話コンテキストが保持し、セーブには載らない */
export type PendingProposal = SubQuest | null;

// ---------------------------------------------------------------------------
// 提案の生成・受諾・辞退
// ---------------------------------------------------------------------------

/** 検証層を通過した propose_quest 入力(title/description は出力壁の正規化済みテキスト) */
export type QuestProposalDraft =
  | {
      type: "hunt";
      targetId: HuntTargetId;
      count: number;
      rewardGold: number;
      rewardItemId?: GiftableItemId | undefined;
      title: string;
      description: string;
    }
  | {
      type: "fetch";
      targetId: FetchTargetId;
      count: number;
      rewardGold: number;
      rewardItemId?: GiftableItemId | undefined;
      title: string;
      description: string;
    };

/** 検証済みの propose_quest 入力から「提案」状態のサブクエストを作る(id は呼び出し側が採番) */
export function createProposedQuest(id: string, draft: QuestProposalDraft): SubQuest {
  const common = {
    id,
    count: draft.count,
    progress: 0,
    rewardGold: draft.rewardGold,
    title: draft.title,
    description: draft.description,
    status: "proposed" as const,
    ...(draft.rewardItemId !== undefined ? { rewardItemId: draft.rewardItemId } : {})
  };
  if (draft.type === "hunt") {
    return { type: "hunt", targetId: draft.targetId, ...common };
  }
  return { type: "fetch", targetId: draft.targetId, ...common };
}

/** 受注枠を占有するか(active / completed が枠を使う。proposed は未受諾、reported は解放済み) */
export function occupiesQuestSlot(quest: SubQuest): boolean {
  return quest.status === "active" || quest.status === "completed";
}

/** 受注中(枠占有中)のサブクエスト数 */
export function activeQuestSlotCount(quests: readonly SubQuest[]): number {
  return quests.filter(occupiesQuestSlot).length;
}

export type AcceptProposalResult =
  | { ok: true; quests: SubQuest[] }
  | { ok: false; reason: "not_proposed" | "slots_full" };

/**
 * 提案を受諾する: proposed → active にして受注中リストへ加える。
 * 受注中(枠占有)が SUB_QUEST_MAX_ACTIVE 件のときは受諾できない。
 */
export function acceptProposal(proposal: SubQuest, quests: readonly SubQuest[]): AcceptProposalResult {
  if (proposal.status !== "proposed") return { ok: false, reason: "not_proposed" };
  if (activeQuestSlotCount(quests) >= SUB_QUEST_MAX_ACTIVE) return { ok: false, reason: "slots_full" };
  return { ok: true, quests: [...quests, { ...proposal, status: "active", progress: 0 }] };
}

/**
 * 提案を辞退する(破棄)。未受諾提案スロットは空になり、受注中リストは変化しない。
 * 未受諾のまま会話が終了した場合の破棄も、呼び出し側がこの値でスロットを置き換える。
 */
export function declineProposal(): PendingProposal {
  return null;
}

// ---------------------------------------------------------------------------
// 進行(hunt 討伐カウント)
// ---------------------------------------------------------------------------

/**
 * hunt 討伐カウント: 受注中(active)の hunt クエストのうち対象が一致するものへ +1。
 * count 到達で completed(達成条件到達)。受注前(proposed)・達成後(completed)・
 * 報告後(reported)の討伐は数えない(受注後の対象討伐のみ: ai-integration.md)。
 */
export function recordHuntKill(quests: readonly SubQuest[], enemyId: EnemyId): SubQuest[] {
  return quests.map((quest) => {
    if (quest.type !== "hunt" || quest.status !== "active" || quest.targetId !== enemyId) {
      return quest;
    }
    const progress = Math.min(quest.count, quest.progress + 1);
    return { ...quest, progress, status: progress >= quest.count ? "completed" : "active" };
  });
}

// ---------------------------------------------------------------------------
// 報告(達成判定・納品・報酬付与)
// ---------------------------------------------------------------------------

/**
 * 報告時の達成判定:
 * - hunt : 受注後の討伐数が count に到達していること
 * - fetch: 報告時点で対象アイテムを count 個所持していること
 */
export function isReportReady(quest: SubQuest, inventory: Inventory): boolean {
  if (quest.status !== "active" && quest.status !== "completed") return false;
  if (quest.type === "hunt") return quest.progress >= quest.count;
  return countOf(inventory, quest.targetId) >= quest.count;
}

export type ReportQuestResult =
  | {
      ok: true;
      quest: SubQuest;
      inventory: Inventory;
      /** 付与するゴールド(呼び出し側が加算する) */
      goldGained: number;
      /** 報酬アイテム(1個)を付与したか */
      rewardItemGranted: boolean;
    }
  | { ok: false; reason: "not_ready" | "inventory_full" };

/**
 * 報告処理。fetch は納品(対象 count 個削除)→報酬付与の順で処理し、
 * 納品で空いた所持枠を報酬アイテムの受領に使える(ai-integration.md「達成の意味論」)。
 * 報酬アイテムが入らない場合は受領を保留し、何も変更せず ok:false を返す
 * (クエストは達成状態を維持し、納品物も報酬も消失しない: game-design.md「成長・経済」)。
 */
export function reportQuest(quest: SubQuest, inventory: Inventory): ReportQuestResult {
  if (!isReportReady(quest, inventory)) return { ok: false, reason: "not_ready" };

  // fetch: 納品(対象アイテム count 個をインベントリから削除)
  const delivered =
    quest.type === "fetch" ? removeItem(inventory, quest.targetId, quest.count).inventory : inventory;

  // 報酬アイテム(あれば 1 個)。満杯なら報告全体を保留(納品も含めて変更しない)
  let rewarded = delivered;
  let rewardItemGranted = false;
  if (quest.rewardItemId !== undefined) {
    if (freeSpace(delivered) < 1) return { ok: false, reason: "inventory_full" };
    rewarded = addItem(delivered, quest.rewardItemId, 1).inventory;
    rewardItemGranted = true;
  }

  return {
    ok: true,
    quest: { ...quest, status: "reported" },
    inventory: rewarded,
    goldGained: quest.rewardGold,
    rewardItemGranted
  };
}

// ---------------------------------------------------------------------------
// 除去・放棄
// ---------------------------------------------------------------------------

/**
 * 受注中リストから指定 id のサブクエストを除去する(汎用の除去ヘルパー・不変)。
 * 報告済み(reported)クエストは受注枠から外れるため、reportQuest 成功後に
 * 呼び出し側がこのヘルパーで state.subQuests から除去する。"reported" は
 * reportQuest の戻り値/UI 用シグナルであり、subQuests には永続化しない
 * (ai-integration.md「propose_quest」: reported=受注枠から外れる)。
 */
export function removeQuestFromList(quests: readonly SubQuest[], questId: string): SubQuest[] {
  return quests.filter((quest) => quest.id !== questId);
}

/**
 * 放棄: 受注中サブクエストはクエストジャーナルからいつでも放棄できる
 * (即時に受注枠を解放。ペナルティなし: game-design.md「メインクエスト」)。
 * 進行度は失われ、fetch の所持アイテムはそのまま残る(納品していないため)。
 */
export function abandonQuest(quests: readonly SubQuest[], questId: string): SubQuest[] {
  return removeQuestFromList(quests, questId);
}
