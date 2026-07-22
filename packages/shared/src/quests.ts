import { z } from "zod";

import { deliverParcelIdSchema, deliverRecipientIdSchema } from "./ai/deliver.js";
import { fetchTargetIdSchema } from "./ai/fetch.js";
import { giftableItemIdSchema } from "./ai/giftable.js";
import { huntTargetIdSchema } from "./ai/hunt.js";
import {
  ESCORT_DESTINATIONS,
  ESCORT_DESTINATION_NAMES,
  escortDestinationIdSchema
} from "./ai/escort.js";
import { SURVEY_TARGET_NAMES, surveyTargetIdSchema } from "./ai/survey.js";
import type { DeliverParcelId, DeliverRecipientId } from "./ai/deliver.js";
import type { FetchTargetId } from "./ai/fetch.js";
import type { GiftableItemId } from "./ai/giftable.js";
import type { HuntTargetId } from "./ai/hunt.js";
import type { EscortDestinationId } from "./ai/escort.js";
import type { SurveyTargetId } from "./ai/survey.js";
import { ITEMS } from "./combat/items.js";
import { samePosition } from "./geometry.js";
import type { Position } from "./geometry.js";
import { ENEMY_DISPLAY_NAMES, NPC_DISPLAY_NAMES } from "./ids.js";
import type { EnemyId, NpcId } from "./ids.js";
import { addItem, countOf, freeSpace, removeItem, removeQuestItem } from "./inventory.js";
import type { Inventory } from "./inventory.js";
import type { MapId } from "./map.js";

/**
 * クエストエンジン(メインクエスト段階 + サブクエスト状態機械)。
 * Phaser 非依存の純ロジック。仕様の正: game-design.md「メインクエスト」/
 * ai-integration.md「propose_quest」(達成の意味論・満杯時の報酬保留)。
 */

// ---------------------------------------------------------------------------
// メインクエスト段階(M6 で進行に使用)
// ---------------------------------------------------------------------------

/**
 * メインクエスト段階(第1章=game-design.md「メインクエスト」手順1-5 / 第2章=同「メインクエスト第2章
 * (拡張: M18)」。語彙は裁量)。**末尾追記のみ**で既存値・順序は不変(旧セーブは既存値のみを持つため
 * 後方互換。GAME_STATE_VERSION は据え置き):
 * - arrival             : オープニング後。記憶を失った旅人が街に流れ着いた(手順1)
 * - rift-revealed       : 司祭との会話で「綻びの原因は夢喰い」と知った(手順2。以降ダンジョン攻略=手順3)
 * - dream-eater-defeated: ボス「夢喰い」撃破(手順4)
 * - epilogue            : エンディング視聴済み(手順5。ここまでが第1章)
 * - ch2-stirring        : 【第2章開始】導管の間で脈打つ導管の異変に気づいた(epilogue 段階で d4-conduit を調べる)
 * - ch2-vigil-song      : 番人トワが唄の続き「灯の還る先」を明かした(ch2-stirring 段階でトワと会話)
 * - ch2-beyond          : 【第2章クリア】導管の間へ戻り、機関の外にまだ夢を紡ぐ何かがある確証を得た(ch2-vigil-song 段階で d4-conduit を再び調べる)
 */
export const MAIN_QUEST_STAGES = [
  "arrival",
  "rift-revealed",
  "dream-eater-defeated",
  "epilogue",
  "ch2-stirring",
  "ch2-vigil-song",
  "ch2-beyond"
] as const;
export const mainQuestStageSchema = z.enum(MAIN_QUEST_STAGES);
export type MainQuestStage = z.infer<typeof mainQuestStageSchema>;

/** 新規ゲームのメインクエスト段階 */
export const MAIN_QUEST_INITIAL_STAGE: MainQuestStage = "arrival";

/**
 * メインクエスト段階の順序インデックス(MAIN_QUEST_STAGES の並び順=単調な進行順)。
 * 第1章(arrival→epilogue)に第2章(ch2-stirring→ch2-beyond)が単調接続する。
 * 未知値は入り得ない(zod パース済み)が、防御的に -1 を返す。
 */
export function mainQuestStageIndex(stage: MainQuestStage): number {
  return MAIN_QUEST_STAGES.indexOf(stage);
}

/**
 * stage が base 段階以降(base を含む)まで進んでいるか(段階の順序判定)。
 * 例: isStageAtOrAfter(state.mainQuestStage, "dream-eater-defeated") で
 * 「ボス撃破済み(第2章の各段階でも真)」を等値ではなく順序で表す。
 */
export function isStageAtOrAfter(stage: MainQuestStage, base: MainQuestStage): boolean {
  return mainQuestStageIndex(stage) >= mainQuestStageIndex(base);
}

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
 * - completed: 達成条件到達。hunt=討伐数到達 / deliver=納品済み / escort=到達済み / survey=調べ済み。
 *              fetch は報告時に所持数で判定するため active のまま(受注枠を占有)
 * - reported : 情報屋へ報告済み(報酬受領済み。受注枠から外れる)
 */
export const subQuestStatusSchema = z.enum(["proposed", "active", "completed", "reported"]);
export type SubQuestStatus = z.infer<typeof subQuestStatusSchema>;

/**
 * サブクエストの型(M19 で hunt/fetch に deliver/escort/survey を追加。上位集合化=旧セーブ互換)。
 * `subQuestSchema` の discriminatedUnion の判別子リテラルと一致することをユニットテストで担保する
 * (`messages.ts` の表示ビュー(pendingProposalView/subQuestView)の type 列もこの列挙を使う)。
 */
export const subQuestTypeSchema = z.enum(["hunt", "fetch", "deliver", "escort", "survey"]);
export type SubQuestType = z.infer<typeof subQuestTypeSchema>;

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
 * サブクエスト。型別の参照フィールドは各 type 専用のホワイトリストでのみ構成できる
 * (hunt=HuntTargetId / fetch=FetchTargetId / deliver=DeliverParcelId+DeliverRecipientId /
 * escort=EscortDestinationId / survey=SurveyTargetId。ai-integration.md「5b」)。
 * escort/survey は count=1 固定(1回の道行き / 1地点の調査。count≠1 はスキーマ段で却下)。
 * discriminatedUnion なので型不一致・混成フィールドはスキーマ段で綺麗に却下される。
 * hunt/fetch のみの旧セーブは上位集合化により引き続きパースできる(GAME_STATE_VERSION 据え置き)。
 */
export const subQuestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hunt"), targetId: huntTargetIdSchema, ...subQuestBaseShape }),
  z.object({ type: z.literal("fetch"), targetId: fetchTargetIdSchema, ...subQuestBaseShape }),
  z.object({
    type: z.literal("deliver"),
    parcelId: deliverParcelIdSchema,
    recipientId: deliverRecipientIdSchema,
    ...subQuestBaseShape
  }),
  z.object({
    type: z.literal("escort"),
    destinationId: escortDestinationIdSchema,
    ...subQuestBaseShape,
    count: z.literal(1)
  }),
  z.object({
    type: z.literal("survey"),
    targetId: surveyTargetIdSchema,
    ...subQuestBaseShape,
    count: z.literal(1)
  })
]);
export type SubQuest = z.infer<typeof subQuestSchema>;

/** 未受諾提案スロット(同時1件)。会話コンテキストが保持し、セーブには載らない */
export type PendingProposal = SubQuest | null;

// ---------------------------------------------------------------------------
// 提案の生成・受諾・辞退
// ---------------------------------------------------------------------------

/** propose_quest の型共通フィールド(検証済み。title/description は出力壁の正規化済みテキスト) */
type QuestProposalCommon = {
  count: number;
  rewardGold: number;
  rewardItemId?: GiftableItemId | undefined;
  title: string;
  description: string;
};

/**
 * 検証層を通過した propose_quest 入力(型別の判別可能 union)。
 * escort/survey の count は仕様上 1 固定だが、DTO では number として受け、
 * createProposedQuest が 1 に確定する(count≠1 の却下はスキーマ・検証層の責務)。
 */
export type QuestProposalDraft =
  | ({ type: "hunt"; targetId: HuntTargetId } & QuestProposalCommon)
  | ({ type: "fetch"; targetId: FetchTargetId } & QuestProposalCommon)
  | ({ type: "deliver"; parcelId: DeliverParcelId; recipientId: DeliverRecipientId } & QuestProposalCommon)
  | ({ type: "escort"; destinationId: EscortDestinationId } & QuestProposalCommon)
  | ({ type: "survey"; targetId: SurveyTargetId } & QuestProposalCommon);

/** 検証済みの propose_quest 入力から「提案」状態のサブクエストを作る(id は呼び出し側が採番) */
export function createProposedQuest(id: string, draft: QuestProposalDraft): SubQuest {
  const common = {
    id,
    progress: 0,
    rewardGold: draft.rewardGold,
    title: draft.title,
    description: draft.description,
    status: "proposed" as const,
    ...(draft.rewardItemId !== undefined ? { rewardItemId: draft.rewardItemId } : {})
  };
  switch (draft.type) {
    case "hunt":
      return { type: "hunt", targetId: draft.targetId, count: draft.count, ...common };
    case "fetch":
      return { type: "fetch", targetId: draft.targetId, count: draft.count, ...common };
    case "deliver":
      return {
        type: "deliver",
        parcelId: draft.parcelId,
        recipientId: draft.recipientId,
        count: draft.count,
        ...common
      };
    case "escort":
      // escort は count=1 固定(1回の道行き)
      return { type: "escort", destinationId: draft.destinationId, count: 1, ...common };
    case "survey":
      // survey は count=1 固定(1地点の調査)
      return { type: "survey", targetId: draft.targetId, count: 1, ...common };
  }
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
 * 受諾時の預かり品受領(deliver のみ)。預かり品 count 個をクエスト用アイテムの
 * 別枠へ受領する(所持上限対象外=満杯でも受諾可: ai-integration.md「5b」受諾時)。
 * deliver 以外・受領物のない型(hunt/fetch/escort/survey)はインベントリを変えずに返す。
 * acceptProposal はリスト側の受諾のみを担うため、預かり品の授受はこの純関数で分離する
 * (呼び出し側(server)が acceptProposal 成功時に本関数でインベントリを更新する)。
 */
export function receiveQuestParcel(quest: SubQuest, inventory: Inventory): Inventory {
  if (quest.type !== "deliver") return inventory;
  return addItem(inventory, quest.parcelId, quest.count).inventory;
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

/** deliver 納品の結果(受注中リストと預かり品を消した後のインベントリ) */
export interface DeliveryResult {
  quests: SubQuest[];
  inventory: Inventory;
}

/**
 * deliver 納品: 受取NPC recipientId に話しかけた時、対象が一致する受注中(active)の
 * deliver クエストを completed にし、預かり品を別枠から count 個削除する
 * (ai-integration.md「5b」達成の意味論。納品は原子的=progress は使わない)。
 * 受注前(proposed)・納品済み(completed)・報告後(reported)は対象外。
 */
export function recordDelivery(
  quests: readonly SubQuest[],
  inventory: Inventory,
  recipientId: NpcId
): DeliveryResult {
  let inv = inventory;
  const next = quests.map((quest) => {
    if (quest.type !== "deliver" || quest.status !== "active" || quest.recipientId !== recipientId) {
      return quest;
    }
    inv = removeQuestItem(inv, quest.parcelId, quest.count).inventory;
    return { ...quest, status: "completed" as const };
  });
  return { quests: next, inventory: inv };
}

/**
 * escort 到達: プレイヤーが現在地 (mapId, position) に至った時、目的地が一致する
 * 受注中(active)の escort クエストを completed にする(到達は原子的)。
 */
export function recordEscortArrival(
  quests: readonly SubQuest[],
  mapId: MapId,
  position: Position
): SubQuest[] {
  return quests.map((quest) => {
    if (quest.type !== "escort" || quest.status !== "active") return quest;
    const dest = ESCORT_DESTINATIONS[quest.destinationId];
    if (dest.mapId !== mapId || !samePosition(dest.position, position)) return quest;
    return { ...quest, status: "completed" as const };
  });
}

/**
 * survey 調べ: プレイヤーが調べオブジェクト objectId を調べた時、対象が一致する
 * 受注中(active)の survey クエストを completed にする(調べは原子的)。
 * objectId は調べたオブジェクトの id(string)。survey 対象でなければどの quest も変わらない。
 */
export function recordSurvey(quests: readonly SubQuest[], objectId: string): SubQuest[] {
  return quests.map((quest) => {
    if (quest.type !== "survey" || quest.status !== "active" || quest.targetId !== objectId) {
      return quest;
    }
    return { ...quest, status: "completed" as const };
  });
}

// ---------------------------------------------------------------------------
// 報告(達成判定・納品・報酬付与)
// ---------------------------------------------------------------------------

/**
 * 報告時の達成判定:
 * - hunt : 受注後の討伐数が count に到達していること
 * - fetch: 報告時点で対象アイテムを count 個所持していること
 * - deliver/escort/survey: 達成が原子的なため status==="completed"(納品/到達/調べ済み)を条件とする
 */
export function isReportReady(quest: SubQuest, inventory: Inventory): boolean {
  if (quest.status !== "active" && quest.status !== "completed") return false;
  switch (quest.type) {
    case "hunt":
      return quest.progress >= quest.count;
    case "fetch":
      return countOf(inventory, quest.targetId) >= quest.count;
    case "deliver":
    case "escort":
    case "survey":
      return quest.status === "completed";
  }
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
 * 報告処理。**インベントリからの削除(納品)を伴うのは fetch のみ**。
 * fetch は納品(対象 count 個削除)→報酬付与の順で処理し、納品で空いた所持枠を
 * 報酬アイテムの受領に使える(ai-integration.md「達成の意味論」)。
 * deliver/escort/survey は報告時の削除を伴わない(deliver の納品は受取NPCへの手渡し時に
 * 完結済み)。報酬(gold+任意 rewardItem)のみ付与する。
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
 * deliver の未納品の預かり品回収は副作用があるため、呼び出し側(server)が本関数の前に
 * reclaimQuestParcel でインベントリを更新する(escort/survey は副作用なし)。
 */
export function abandonQuest(quests: readonly SubQuest[], questId: string): SubQuest[] {
  return removeQuestFromList(quests, questId);
}

/**
 * 放棄時の預かり品回収(deliver の未納品=active のときのみ)。
 * 未納品の預かり品を別枠から count 個削除(消滅)する。売却/破棄不可の品が放棄後に
 * 残って所持を圧迫しないため(ai-integration.md「5b」放棄時 / game-design.md)。
 * 納品済み(completed/reported)なら別枠に無いので対象なし=無変化。
 * deliver 以外(hunt/fetch/escort/survey)は副作用がないため無変化で返す。
 */
export function reclaimQuestParcel(quest: SubQuest, inventory: Inventory): Inventory {
  if (quest.type !== "deliver" || quest.status !== "active") return inventory;
  return removeQuestItem(inventory, quest.parcelId, quest.count).inventory;
}

// ---------------------------------------------------------------------------
// 表示ラベル(クエストジャーナル・プロンプトの現況表示)
// ---------------------------------------------------------------------------

/**
 * サブクエストの対象を1語で表す表示ラベル(型別):
 * hunt=敵名 / fetch=アイテム名 / deliver=受取NPC名 / escort=目的地名 / survey=調査対象名。
 * サーバーのクエストジャーナル表示・プロンプトの受注中一覧で用いる(全型を網羅)。
 */
export function subQuestTargetLabel(quest: SubQuest): string {
  switch (quest.type) {
    case "hunt":
      return ENEMY_DISPLAY_NAMES[quest.targetId];
    case "fetch":
      return ITEMS[quest.targetId].name;
    case "deliver":
      return NPC_DISPLAY_NAMES[quest.recipientId];
    case "escort":
      return ESCORT_DESTINATION_NAMES[quest.destinationId];
    case "survey":
      return SURVEY_TARGET_NAMES[quest.targetId];
  }
}
