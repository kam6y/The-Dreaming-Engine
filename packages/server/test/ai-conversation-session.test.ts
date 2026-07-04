import type { SubQuest } from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import { ConversationSession } from "../src/ai/flow-control/index.js";

/** 提案状態の hunt サブクエスト(未受諾提案スロット用) */
function proposedQuest(id: string): SubQuest {
  return {
    type: "hunt",
    targetId: "mist-wolf",
    id,
    count: 3,
    progress: 0,
    rewardGold: 50,
    title: "霧狼の間引き",
    description: "忘れ野の霧狼を三体屠る。",
    status: "proposed"
  };
}

describe("ConversationSession", () => {
  it("affinityAtOpen を会話開始時点の好感度でスナップショットし、以後変えない", () => {
    const session = new ConversationSession("innkeeper", 42);
    expect(session.affinityAtOpen).toBe(42);
    // adjust を重ねても affinityAtOpen は不変(give_item 解禁判定の唯一の根拠)
    session.recordAdjustAffinity();
    session.recordAdjustAffinity();
    expect(session.affinityAtOpen).toBe(42);
    expect(session.toContext().affinityAtOpen).toBe(42);
  });

  it("会話内カウンタ(adjust/give)を追跡し context に反映する", () => {
    const session = new ConversationSession("merchant", 50);
    expect(session.toContext()).toMatchObject({
      partnerNpcId: "merchant",
      adjustAffinityCount: 0,
      giveItemCount: 0,
      pendingProposal: null
    });

    session.recordAdjustAffinity();
    session.recordGiveItem();
    session.recordAdjustAffinity();

    expect(session.getAdjustAffinityCount()).toBe(2);
    expect(session.getGiveItemCount()).toBe(1);
    const ctx = session.toContext();
    expect(ctx.adjustAffinityCount).toBe(2);
    expect(ctx.giveItemCount).toBe(1);
  });

  it("pendingProposal を保持し、破棄でクリアできる(同時1件)", () => {
    const session = new ConversationSession("informant", 30);
    expect(session.getPendingProposal()).toBeNull();

    const q = proposedQuest("q1");
    session.setPendingProposal(q);
    expect(session.getPendingProposal()).toEqual(q);
    expect(session.toContext().pendingProposal).toEqual(q);

    session.clearPendingProposal();
    expect(session.getPendingProposal()).toBeNull();
    expect(session.toContext().pendingProposal).toBeNull();
  });
});
