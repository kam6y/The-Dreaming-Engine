import { validateAdjustAffinity } from "./adjust-affinity.js";
import { validateGiveItem } from "./give-item.js";
import { validateProposeQuest } from "./propose-quest.js";
import { validateNarrate, validateSpeak } from "./speak-narrate.js";
import {
  FLOW_TOOL_ALLOWLIST,
  type ToolEffect,
  type ToolFlow,
  type ToolName,
  type ToolValidationContext,
  type ValidationResult
} from "./types.js";
import { validateWorldEvent } from "./world-event.js";

/**
 * ツール検証ディスパッチャ(guardrails 第1層: フロー許可集合の二重チェック)。
 *
 * まず toolName がそのフローの許可集合に含まれるかを検査し、含まれなければ却下する
 * (会話フローからの trigger_world_event 等のクロスフロー呼び出しを技術的に遮断)。
 * その後、各ツール検証器へ振り分ける。統合コンテキストから各検証器の狭いコンテキストを組み立てる。
 */
export function validateToolCall(
  flow: ToolFlow,
  toolName: ToolName,
  rawInput: unknown,
  ctx: ToolValidationContext
): ValidationResult<ToolEffect> {
  // 1. フロー許可集合の二重チェック(振り分け前に行う)
  const allowed = FLOW_TOOL_ALLOWLIST[flow];
  if (!allowed.includes(toolName)) {
    return { ok: false, reason: `フロー ${flow} でツール ${toolName} は許可されていない` };
  }

  const { session, persistent } = ctx;

  // 2. 各ツール検証器へ振り分け
  switch (toolName) {
    case "speak":
      return validateSpeak(rawInput);
    case "narrate":
      return validateNarrate(rawInput);
    case "adjust_affinity": {
      if (session === null) return { ok: false, reason: "adjust_affinity: 会話セッションがない" };
      return validateAdjustAffinity(rawInput, {
        partnerNpcId: session.partnerNpcId,
        adjustAffinityCount: session.adjustAffinityCount,
        dailyAffinityDelta: persistent.aiDaily.affinityDeltaByNpc[session.partnerNpcId],
        currentAffinity: persistent.affinityByNpc[session.partnerNpcId]
      });
    }
    case "give_item": {
      if (session === null) return { ok: false, reason: "give_item: 会話セッションがない" };
      return validateGiveItem(rawInput, {
        affinityAtOpen: session.affinityAtOpen,
        inventory: persistent.inventory,
        giveItemCountInConversation: session.giveItemCount,
        giveItemCountToday: persistent.aiDaily.giveItemCount
      });
    }
    case "propose_quest": {
      if (session === null) return { ok: false, reason: "propose_quest: 会話セッションがない" };
      return validateProposeQuest(rawInput, {
        subQuests: persistent.subQuests,
        pendingProposal: session.pendingProposal,
        proposeQuestCount: persistent.aiDaily.proposeQuestCount,
        rewardItemProposalCount: persistent.aiDaily.rewardItemProposalCount,
        questId: persistent.nextQuestId
      });
    }
    case "trigger_world_event":
      return validateWorldEvent(rawInput, { dungeonSymbolCounts: persistent.dungeonSymbolCounts });
  }
}
