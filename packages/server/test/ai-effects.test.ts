import {
  countOf,
  createNewGameState,
  createProposedQuest,
  type QuestProposalDraft,
  type SubQuest
} from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import { applyStateChangeEffect } from "../src/game/ai-effects.js";
import type { DreamEventsEffect } from "../src/ai/tool-validation/types.js";

/**
 * effect 適用リデューサー(applyStateChangeEffect)の単体テスト。
 * 各 effect の GameState 反映と、**日次カウンタ(aiDaily)の書き戻し**を検証する
 * (閉ループの土台。GameSession 経由の実証はコミット2の統合テストで行う)。
 */

describe("applyStateChangeEffect: adjust_affinity", () => {
  it("好感度を適用後値へ更新し、日次累積 delta を加算する", () => {
    const base = createNewGameState();
    const next = applyStateChangeEffect(base, {
      kind: "adjust_affinity",
      npcId: "priest",
      affinity: 35,
      delta: 5
    });
    expect(next.npcs.priest.affinity).toBe(35);
    expect(next.aiDaily.affinityDeltaByNpc.priest).toBe(5);
    // 他 NPC・元状態は不変
    expect(next.npcs.innkeeper.affinity).toBe(30);
    expect(base.npcs.priest.affinity).toBe(30);
  });

  it("負の delta も累積へ反映する(既存累積に加算)", () => {
    const base = createNewGameState();
    base.aiDaily.affinityDeltaByNpc.priest = 8;
    const next = applyStateChangeEffect(base, {
      kind: "adjust_affinity",
      npcId: "priest",
      affinity: 24,
      delta: -6
    });
    expect(next.aiDaily.affinityDeltaByNpc.priest).toBe(2);
    expect(next.npcs.priest.affinity).toBe(24);
  });
});

describe("applyStateChangeEffect: give_item", () => {
  it("インベントリへ加算し、日次 give_item カウンタを +1 する", () => {
    const base = createNewGameState();
    const before = countOf(base.inventory, "potion-small");
    const next = applyStateChangeEffect(base, {
      kind: "give_item",
      itemId: "potion-small",
      quantity: 2
    });
    expect(countOf(next.inventory, "potion-small")).toBe(before + 2);
    expect(next.aiDaily.giveItemCount).toBe(1);
  });
});

describe("applyStateChangeEffect: propose_quest", () => {
  function proposal(withReward: boolean): SubQuest {
    const draft: QuestProposalDraft = withReward
      ? {
          type: "hunt",
          targetId: "mist-wolf",
          count: 3,
          rewardGold: 50,
          title: "霧狼の間引き",
          description: "忘れ野の霧狼を三体屠る。",
          rewardItemId: "potion-small"
        }
      : {
          type: "hunt",
          targetId: "mist-wolf",
          count: 3,
          rewardGold: 50,
          title: "霧狼の間引き",
          description: "忘れ野の霧狼を三体屠る。"
        };
    return createProposedQuest("q-test", draft);
  }

  it("提案生成で proposeQuestCount を +1(サブクエストは追加しない)", () => {
    const base = createNewGameState();
    const next = applyStateChangeEffect(base, { kind: "propose_quest", quest: proposal(false) });
    expect(next.aiDaily.proposeQuestCount).toBe(1);
    expect(next.aiDaily.rewardItemProposalCount).toBe(0);
    expect(next.subQuests).toEqual([]); // 受諾ではないので未追加
  });

  it("rewardItemId 付き提案は rewardItemProposalCount も +1", () => {
    const base = createNewGameState();
    const next = applyStateChangeEffect(base, { kind: "propose_quest", quest: proposal(true) });
    expect(next.aiDaily.proposeQuestCount).toBe(1);
    expect(next.aiDaily.rewardItemProposalCount).toBe(1);
  });
});

describe("applyStateChangeEffect: dream_world_events", () => {
  it("weather 後勝ち・street_event 集合・npc_rumor 話題置換・dungeon 適用後値を反映する", () => {
    const base = createNewGameState();
    const effect: DreamEventsEffect = {
      kind: "dream_world_events",
      events: [
        { kind: "weather", value: "fog" },
        { kind: "street_event", eventId: "black-cat" },
        { kind: "npc_rumor", npcId: "informant", rumor: "忘れ野の霧が濃くなったという噂" }
      ],
      dungeonSymbolCounts: { 1: 5, 2: 4, 3: 3 }
    };
    const next = applyStateChangeEffect(base, effect);
    expect(next.world.weather).toBe("fog");
    expect(next.world.activeStreetEvents).toContain("black-cat");
    expect(next.npcs.informant.topic).toBe("忘れ野の霧が濃くなったという噂");
    expect(next.world.dungeonSymbolCounts).toEqual({ 1: 5, 2: 4, 3: 3 });
  });

  it("既存の街頭演出へ重複せず追加する", () => {
    const base = createNewGameState();
    base.world.activeStreetEvents = ["black-cat"];
    const effect: DreamEventsEffect = {
      kind: "dream_world_events",
      events: [{ kind: "street_event", eventId: "black-cat" }],
      dungeonSymbolCounts: base.world.dungeonSymbolCounts
    };
    const next = applyStateChangeEffect(base, effect);
    expect(next.world.activeStreetEvents).toEqual(["black-cat"]);
  });
});
