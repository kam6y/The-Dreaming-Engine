import {
  activeQuestSlotCount,
  createProposedQuest,
  fetchTargetIdSchema,
  giftableItemIdSchema,
  huntTargetIdSchema,
  SUB_QUEST_COUNT_MAX,
  SUB_QUEST_COUNT_MIN,
  SUB_QUEST_DESCRIPTION_MAX_LENGTH,
  SUB_QUEST_MAX_ACTIVE,
  SUB_QUEST_REWARD_GOLD_MAX,
  SUB_QUEST_REWARD_GOLD_MIN,
  SUB_QUEST_REWARD_GOLD_PER_COUNT,
  SUB_QUEST_TITLE_MAX_LENGTH,
  type QuestProposalDraft
} from "@dreaming-engine/shared";
import { z } from "zod";

import { checkDisplayText } from "../output-wall.js";
import {
  PROPOSE_QUEST_PER_DAY_MAX,
  REWARD_ITEM_PROPOSAL_PER_DAY_MAX,
  type ProposeQuestContext,
  type ProposeQuestEffect,
  type ValidationResult
} from "./types.js";

/**
 * propose_quest: サブクエスト発行(ai-integration.md「propose_quest」)。
 * - count は整数 1..5、rewardGold は整数 10..100 かつ count×20 以下(報酬対難度の比)
 * - rewardItemId は贈答ホワイトリスト内。rewardItemId 付き提案はゲーム内1日1件まで
 * - targetId は type 別ホワイトリスト(hunt=HuntTargetId / fetch=FetchTargetId。
 *   discriminatedUnion がスキーマ段で強制。違反は綺麗に却下)
 * - 受注枠占有中サブクエストが3件未満・未受諾提案が残っていない・発行はゲーム内1日3件まで
 * - title 40字以内・description 200字以内・両方出力壁通過
 * - effect は createProposedQuest で作った「提案」状態の SubQuest
 */

const proposeQuestBaseShape = {
  count: z.number().int().min(SUB_QUEST_COUNT_MIN).max(SUB_QUEST_COUNT_MAX),
  rewardGold: z.number().int().min(SUB_QUEST_REWARD_GOLD_MIN).max(SUB_QUEST_REWARD_GOLD_MAX),
  rewardItemId: giftableItemIdSchema.optional(),
  title: z.string(),
  description: z.string()
} as const;

const proposeQuestInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hunt"), targetId: huntTargetIdSchema, ...proposeQuestBaseShape }),
  z.object({ type: z.literal("fetch"), targetId: fetchTargetIdSchema, ...proposeQuestBaseShape })
]);

export function validateProposeQuest(
  rawInput: unknown,
  ctx: ProposeQuestContext
): ValidationResult<ProposeQuestEffect> {
  const parsed = proposeQuestInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, reason: "propose_quest: 入力スキーマ検証に失敗" };
  const data = parsed.data;

  // 報酬対難度の比: rewardGold ≤ count × 20
  if (data.rewardGold > data.count * SUB_QUEST_REWARD_GOLD_PER_COUNT) {
    return {
      ok: false,
      reason: `propose_quest: 報酬過大(gold${data.rewardGold} > count${data.count}×${SUB_QUEST_REWARD_GOLD_PER_COUNT})`
    };
  }

  // rewardItemId 付き提案はゲーム内1日1件まで
  if (data.rewardItemId !== undefined && ctx.rewardItemProposalCount >= REWARD_ITEM_PROPOSAL_PER_DAY_MAX) {
    return { ok: false, reason: "propose_quest: 報酬アイテム付き提案の1日上限(1件)超過" };
  }

  // 未受諾の提案が残っている間は新規提案を却下(未受諾提案は同時1件)
  if (ctx.pendingProposal !== null) {
    return { ok: false, reason: "propose_quest: 未受諾の提案が残っている" };
  }

  // 受注枠(active / completed)が満杯
  if (activeQuestSlotCount(ctx.subQuests) >= SUB_QUEST_MAX_ACTIVE) {
    return { ok: false, reason: "propose_quest: 受注枠が満杯(3件)" };
  }

  // ゲーム内1日の発行上限
  if (ctx.proposeQuestCount >= PROPOSE_QUEST_PER_DAY_MAX) {
    return { ok: false, reason: "propose_quest: 1日の発行上限(3件)超過" };
  }

  // title / description は出力壁を通過させ、正規化済みテキストを提案に載せる
  const titleCheck = checkDisplayText(data.title, { maxLength: SUB_QUEST_TITLE_MAX_LENGTH });
  if (!titleCheck.ok) return { ok: false, reason: `propose_quest: title 出力壁却下(${titleCheck.reason})` };
  const descCheck = checkDisplayText(data.description, { maxLength: SUB_QUEST_DESCRIPTION_MAX_LENGTH });
  if (!descCheck.ok) {
    return { ok: false, reason: `propose_quest: description 出力壁却下(${descCheck.reason})` };
  }

  const rewardItemPart =
    data.rewardItemId !== undefined ? { rewardItemId: data.rewardItemId } : {};
  const draft: QuestProposalDraft =
    data.type === "hunt"
      ? {
          type: "hunt",
          targetId: data.targetId,
          count: data.count,
          rewardGold: data.rewardGold,
          title: titleCheck.normalized,
          description: descCheck.normalized,
          ...rewardItemPart
        }
      : {
          type: "fetch",
          targetId: data.targetId,
          count: data.count,
          rewardGold: data.rewardGold,
          title: titleCheck.normalized,
          description: descCheck.normalized,
          ...rewardItemPart
        };

  const quest = createProposedQuest(ctx.questId, draft);
  return { ok: true, effect: { kind: "propose_quest", quest } };
}
