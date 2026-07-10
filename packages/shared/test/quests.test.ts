import { describe, expect, it } from "vitest";

import {
  abandonQuest,
  acceptProposal,
  activeQuestSlotCount,
  addItem,
  countOf,
  createNewGameState,
  createProposedQuest,
  emptyInventory,
  gameStateSchema,
  INVENTORY_CAPACITY,
  isReportReady,
  isStageAtOrAfter,
  MAIN_QUEST_STAGES,
  mainQuestStageIndex,
  occupiesQuestSlot,
  recordHuntKill,
  removeQuestFromList,
  reportQuest,
  subQuestSchema,
  SUB_QUEST_MAX_ACTIVE,
  SUB_QUEST_REWARD_GOLD_PER_COUNT,
  usedSpace
} from "../src/index.js";
import type { MainQuestStage, QuestProposalDraft, SubQuest } from "../src/index.js";

// ---------------------------------------------------------------------------
// テスト用ファクトリ(有効な既定値。over で個別に上書き)
// ---------------------------------------------------------------------------

type HuntQuest = Extract<SubQuest, { type: "hunt" }>;
type FetchQuest = Extract<SubQuest, { type: "fetch" }>;

function makeHunt(over: Partial<HuntQuest> = {}): HuntQuest {
  return {
    type: "hunt",
    targetId: "mist-wolf",
    id: "h",
    count: 2,
    progress: 0,
    rewardGold: 40,
    title: "霧狼討伐",
    description: "霧狼を狩る",
    status: "active",
    ...over
  };
}

function makeFetch(over: Partial<FetchQuest> = {}): FetchQuest {
  return {
    type: "fetch",
    targetId: "herb",
    id: "f",
    count: 2,
    progress: 0,
    rewardGold: 30,
    title: "薬草納品",
    description: "薬草を納める",
    status: "active",
    ...over
  };
}

describe("createProposedQuest(提案の生成)", () => {
  it("proposed 状態・progress0 のサブクエストを作る", () => {
    const draft: QuestProposalDraft = {
      type: "hunt",
      targetId: "mist-wolf",
      count: 2,
      rewardGold: 40,
      title: "霧狼討伐",
      description: "霧狼を2体狩る"
    };
    const q = createProposedQuest("q1", draft);
    expect(q.id).toBe("q1");
    expect(q.status).toBe("proposed");
    expect(q.progress).toBe(0);
    expect(q.type).toBe("hunt");
    if (q.type === "hunt") expect(q.targetId).toBe("mist-wolf");
    expect(q.rewardItemId).toBeUndefined();
    expect(subQuestSchema.safeParse(q).success).toBe(true);
  });

  it("rewardItemId 付き提案(fetch)を保持する", () => {
    const draft: QuestProposalDraft = {
      type: "fetch",
      targetId: "herb",
      count: 3,
      rewardGold: 30,
      rewardItemId: "potion-small",
      title: "薬草納品",
      description: "薬草を3つ納める"
    };
    const q = createProposedQuest("q2", draft);
    expect(q.rewardItemId).toBe("potion-small");
    expect(q.type).toBe("fetch");
    if (q.type === "fetch") expect(q.targetId).toBe("herb");
    expect(subQuestSchema.safeParse(q).success).toBe(true);
  });
});

describe("acceptProposal(受諾)", () => {
  it("proposed を active にして受注リストへ加える", () => {
    const proposal = makeHunt({ status: "proposed", progress: 0 });
    const r = acceptProposal(proposal, []);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quests).toHaveLength(1);
      expect(r.quests[0]?.status).toBe("active");
      expect(r.quests[0]?.progress).toBe(0);
    }
  });

  it("proposed でなければ not_proposed", () => {
    const r = acceptProposal(makeHunt({ status: "active" }), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_proposed");
  });

  it("受注枠が満杯(3件)なら slots_full", () => {
    const existing: SubQuest[] = [
      makeHunt({ id: "a", status: "active" }),
      makeHunt({ id: "b", status: "completed" }),
      makeHunt({ id: "c", status: "active" })
    ];
    expect(activeQuestSlotCount(existing)).toBe(SUB_QUEST_MAX_ACTIVE);
    const r = acceptProposal(makeHunt({ id: "d", status: "proposed" }), existing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("slots_full");
  });
});

describe("recordHuntKill(討伐カウント)", () => {
  it("active かつ対象一致の hunt のみ +1、count 到達で completed。それ以外は無視", () => {
    const quests: SubQuest[] = [
      makeHunt({ id: "active-match", status: "active", targetId: "mist-wolf", count: 2, progress: 0 }),
      makeHunt({ id: "near", status: "active", targetId: "mist-wolf", count: 2, progress: 1 }),
      makeHunt({ id: "other-target", status: "active", targetId: "candle-eater", count: 2, progress: 0 }),
      makeHunt({ id: "proposed", status: "proposed", targetId: "mist-wolf", count: 2, progress: 0 }),
      makeHunt({ id: "completed", status: "completed", targetId: "mist-wolf", count: 2, progress: 2 }),
      makeHunt({ id: "reported", status: "reported", targetId: "mist-wolf", count: 2, progress: 2 }),
      makeFetch({ id: "fetch", status: "active", targetId: "herb", count: 2, progress: 0 })
    ];
    const next = recordHuntKill(quests, "mist-wolf");
    const byId = (id: string): SubQuest | undefined => next.find((q) => q.id === id);

    expect(byId("active-match")?.progress).toBe(1);
    expect(byId("active-match")?.status).toBe("active");
    expect(byId("near")?.progress).toBe(2);
    expect(byId("near")?.status).toBe("completed");
    expect(byId("other-target")?.progress).toBe(0);
    expect(byId("proposed")?.progress).toBe(0);
    expect(byId("completed")?.progress).toBe(2);
    expect(byId("reported")?.progress).toBe(2);
    expect(byId("fetch")?.progress).toBe(0);
  });
});

describe("isReportReady(報告可否判定)", () => {
  it("hunt は progress、fetch は所持数で判定し、proposed/reported は対象外", () => {
    const inv = addItem(emptyInventory(), "herb", 3).inventory;
    // hunt: 進行度
    expect(isReportReady(makeHunt({ status: "completed", progress: 2, count: 2 }), emptyInventory())).toBe(true);
    expect(isReportReady(makeHunt({ status: "active", progress: 1, count: 2 }), emptyInventory())).toBe(false);
    // fetch: 所持数
    expect(isReportReady(makeFetch({ status: "active", targetId: "herb", count: 3 }), inv)).toBe(true);
    expect(isReportReady(makeFetch({ status: "active", targetId: "herb", count: 4 }), inv)).toBe(false);
    // 対象外ステータス
    expect(isReportReady(makeHunt({ status: "proposed", progress: 2, count: 2 }), emptyInventory())).toBe(false);
    expect(isReportReady(makeHunt({ status: "reported", progress: 2, count: 2 }), emptyInventory())).toBe(false);
  });
});

describe("reportQuest(報告・納品・報酬)", () => {
  it("hunt 成功: reported 化・ゴールド付与・報酬なしなら rewardItemGranted false", () => {
    const quest = makeHunt({ status: "completed", progress: 2, count: 2, rewardGold: 30 });
    const r = reportQuest(quest, emptyInventory());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quest.status).toBe("reported");
      expect(r.goldGained).toBe(30);
      expect(r.rewardItemGranted).toBe(false);
    }
  });

  it("hunt 成功: 報酬アイテムを付与する", () => {
    const quest = makeHunt({ status: "completed", progress: 2, count: 2, rewardGold: 40, rewardItemId: "antidote" });
    const r = reportQuest(quest, emptyInventory());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rewardItemGranted).toBe(true);
      expect(countOf(r.inventory, "antidote")).toBe(1);
      expect(r.goldGained).toBe(40);
    }
  });

  it("fetch 成功: count 個を納品してから報酬を付与する", () => {
    const quest = makeFetch({
      status: "active",
      targetId: "herb",
      count: 3,
      rewardGold: 30,
      rewardItemId: "potion-small"
    });
    const inv = addItem(emptyInventory(), "herb", 5).inventory;
    const r = reportQuest(quest, inv);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quest.status).toBe("reported");
      expect(r.goldGained).toBe(30);
      expect(r.rewardItemGranted).toBe(true);
      expect(countOf(r.inventory, "herb")).toBe(2); // 5 - 3(納品)
      expect(countOf(r.inventory, "potion-small")).toBe(1);
    }
    // 純関数: 元インベントリは不変
    expect(countOf(inv, "herb")).toBe(5);
  });

  it("fetch 成功: 満杯でも納品で空いた枠へ報酬アイテムを受領できる(達成の意味論)", () => {
    const quest = makeFetch({ status: "active", targetId: "herb", count: 1, rewardGold: 20, rewardItemId: "potion-small" });
    const full = addItem(emptyInventory(), "herb", INVENTORY_CAPACITY).inventory;
    const r = reportQuest(quest, full);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rewardItemGranted).toBe(true);
      expect(countOf(r.inventory, "herb")).toBe(INVENTORY_CAPACITY - 1);
      expect(countOf(r.inventory, "potion-small")).toBe(1);
    }
  });

  it("満杯 + 報酬アイテムで inventory_full、渡したインベントリは変更されない", () => {
    // hunt は納品がないため満杯だと報酬が入らない(fetch は納品で必ず枠が空くため到達しない)
    const full = addItem(emptyInventory(), "herb", INVENTORY_CAPACITY).inventory;
    expect(usedSpace(full)).toBe(INVENTORY_CAPACITY);
    const quest = makeHunt({ status: "completed", progress: 2, count: 2, rewardItemId: "potion-small" });
    const r = reportQuest(quest, full);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("inventory_full");
    // 納品も報酬も含め何も変更されない
    expect(usedSpace(full)).toBe(INVENTORY_CAPACITY);
    expect(countOf(full, "potion-small")).toBe(0);
  });

  it("達成条件未達なら not_ready", () => {
    const hunt = makeHunt({ status: "active", progress: 1, count: 2 });
    const rh = reportQuest(hunt, emptyInventory());
    expect(rh.ok).toBe(false);
    if (!rh.ok) expect(rh.reason).toBe("not_ready");

    const fetch = makeFetch({ status: "active", targetId: "herb", count: 3 });
    const rf = reportQuest(fetch, addItem(emptyInventory(), "herb", 2).inventory);
    expect(rf.ok).toBe(false);
    if (!rf.ok) expect(rf.reason).toBe("not_ready");
  });
});

describe("除去・放棄・枠占有", () => {
  it("abandonQuest / removeQuestFromList: id でフィルタして除去する", () => {
    const quests: SubQuest[] = [makeHunt({ id: "x" }), makeHunt({ id: "y" }), makeFetch({ id: "z", targetId: "herb" })];
    expect(abandonQuest(quests, "y").map((q) => q.id)).toEqual(["x", "z"]);
    expect(removeQuestFromList(quests, "z").map((q) => q.id)).toEqual(["x", "y"]);
    // 存在しない id は無変化
    expect(removeQuestFromList(quests, "nope")).toHaveLength(3);
  });

  it("occupiesQuestSlot / activeQuestSlotCount: active・completed のみ枠を占有", () => {
    expect(occupiesQuestSlot(makeHunt({ status: "active" }))).toBe(true);
    expect(occupiesQuestSlot(makeHunt({ status: "completed" }))).toBe(true);
    expect(occupiesQuestSlot(makeHunt({ status: "proposed" }))).toBe(false);
    expect(occupiesQuestSlot(makeHunt({ status: "reported" }))).toBe(false);
    const quests: SubQuest[] = [
      makeHunt({ id: "a", status: "active" }),
      makeHunt({ id: "b", status: "completed" }),
      makeHunt({ id: "c", status: "proposed" }),
      makeHunt({ id: "d", status: "reported" })
    ];
    expect(activeQuestSlotCount(quests)).toBe(2);
  });
});

describe("境界値", () => {
  it("count は 1-5、rewardGold は 10-100 を受理し外れ値を却下", () => {
    expect(subQuestSchema.safeParse(makeHunt({ count: 1 })).success).toBe(true);
    expect(subQuestSchema.safeParse(makeHunt({ count: 5 })).success).toBe(true);
    expect(subQuestSchema.safeParse(makeHunt({ count: 0 })).success).toBe(false);
    expect(subQuestSchema.safeParse(makeHunt({ count: 6 })).success).toBe(false);
    expect(subQuestSchema.safeParse(makeHunt({ rewardGold: 10 })).success).toBe(true);
    expect(subQuestSchema.safeParse(makeHunt({ rewardGold: 100 })).success).toBe(true);
    expect(subQuestSchema.safeParse(makeHunt({ rewardGold: 9 })).success).toBe(false);
    expect(subQuestSchema.safeParse(makeHunt({ rewardGold: 101 })).success).toBe(false);
  });

  it("rewardGold ≤ count × SUB_QUEST_REWARD_GOLD_PER_COUNT の上限で有効", () => {
    expect(SUB_QUEST_REWARD_GOLD_PER_COUNT).toBe(20);
    const atCap = makeHunt({ count: 5, rewardGold: 5 * SUB_QUEST_REWARD_GOLD_PER_COUNT });
    expect(atCap.rewardGold).toBe(100);
    expect(subQuestSchema.safeParse(atCap).success).toBe(true);
  });
});

describe("多周回(報告=除去による受注枠の再利用)", () => {
  it("3件報告(除去)後に新規3件受諾しても subQuests は3以下で parse 成功", () => {
    let quests: SubQuest[] = [];

    // 1周目: hunt(count1)を3件受諾
    for (let i = 0; i < SUB_QUEST_MAX_ACTIVE; i += 1) {
      const proposal = createProposedQuest(`q${i}`, {
        type: "hunt",
        targetId: "mist-wolf",
        count: 1,
        rewardGold: 20,
        title: "霧狼討伐",
        description: "霧狼を1体狩る"
      });
      const r = acceptProposal(proposal, quests);
      expect(r.ok).toBe(true);
      if (r.ok) quests = r.quests;
    }
    expect(activeQuestSlotCount(quests)).toBe(SUB_QUEST_MAX_ACTIVE);

    // 4件目は満杯で受諾不可
    const extra = createProposedQuest("qx", {
      type: "hunt",
      targetId: "mist-wolf",
      count: 1,
      rewardGold: 20,
      title: "霧狼討伐",
      description: "霧狼を1体狩る"
    });
    expect(acceptProposal(extra, quests).ok).toBe(false);

    // 討伐で全て completed 化 → 報告して subQuests から除去
    quests = recordHuntKill(quests, "mist-wolf");
    for (const q of [...quests]) {
      const rep = reportQuest(q, emptyInventory());
      expect(rep.ok).toBe(true);
      quests = removeQuestFromList(quests, q.id);
    }
    expect(quests).toHaveLength(0);

    // 2周目: fetch を新規3件受諾
    for (let i = 0; i < SUB_QUEST_MAX_ACTIVE; i += 1) {
      const proposal = createProposedQuest(`r${i}`, {
        type: "fetch",
        targetId: "herb",
        count: 2,
        rewardGold: 20,
        title: "薬草納品",
        description: "薬草を2つ納める"
      });
      const r = acceptProposal(proposal, quests);
      expect(r.ok).toBe(true);
      if (r.ok) quests = r.quests;
    }
    expect(quests.length).toBeLessThanOrEqual(SUB_QUEST_MAX_ACTIVE);

    // セーブに載せても gameStateSchema.parse が成功する
    const state = { ...createNewGameState(), subQuests: quests };
    expect(gameStateSchema.safeParse(state).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// メインクエスト段階の順序判定(第2章 M18-2。enum 末尾追記の後方互換)
// ---------------------------------------------------------------------------

describe("メインクエスト段階(順序判定・enum 後方互換)", () => {
  it("MAIN_QUEST_STAGES は第1章4段階の後ろに第2章3段階が単調接続する(既存順序不変)", () => {
    // 第1章の既存4段階は先頭に同順で保たれる(旧セーブ互換の要)
    expect(MAIN_QUEST_STAGES.slice(0, 4)).toEqual([
      "arrival",
      "rift-revealed",
      "dream-eater-defeated",
      "epilogue"
    ]);
    // 第2章の3段階が末尾に追記されている
    expect(MAIN_QUEST_STAGES.slice(4)).toEqual(["ch2-stirring", "ch2-vigil-song", "ch2-beyond"]);
  });

  it("mainQuestStageIndex は宣言順のインデックスを返す(単調増加)", () => {
    const indices = MAIN_QUEST_STAGES.map((s) => mainQuestStageIndex(s));
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("isStageAtOrAfter は base 以降(base を含む)で真", () => {
    // dream-eater-defeated 以降(=ボス撃破済み)は第2章の各段階でも真
    expect(isStageAtOrAfter("dream-eater-defeated", "dream-eater-defeated")).toBe(true);
    expect(isStageAtOrAfter("epilogue", "dream-eater-defeated")).toBe(true);
    expect(isStageAtOrAfter("ch2-stirring", "dream-eater-defeated")).toBe(true);
    expect(isStageAtOrAfter("ch2-vigil-song", "dream-eater-defeated")).toBe(true);
    expect(isStageAtOrAfter("ch2-beyond", "dream-eater-defeated")).toBe(true);
    // base より前は偽
    expect(isStageAtOrAfter("arrival", "dream-eater-defeated")).toBe(false);
    expect(isStageAtOrAfter("rift-revealed", "dream-eater-defeated")).toBe(false);
    // 同一段階も含む・自身との比較は常に真
    for (const s of MAIN_QUEST_STAGES) expect(isStageAtOrAfter(s, s)).toBe(true);
  });

  it("旧セーブ(第1章の各段階)は enum 追記後も gameStateSchema でパースできる(後方互換)", () => {
    const legacyStages: MainQuestStage[] = [
      "arrival",
      "rift-revealed",
      "dream-eater-defeated",
      "epilogue"
    ];
    for (const stage of legacyStages) {
      const state = { ...createNewGameState(), mainQuestStage: stage };
      const parsed = gameStateSchema.safeParse(state);
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.mainQuestStage).toBe(stage);
    }
  });

  it("第2章の新段階も gameStateSchema でパースできる(セーブに載る)", () => {
    for (const stage of ["ch2-stirring", "ch2-vigil-song", "ch2-beyond"] as const) {
      const state = { ...createNewGameState(), mainQuestStage: stage };
      const parsed = gameStateSchema.safeParse(state);
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.mainQuestStage).toBe(stage);
    }
  });
});
