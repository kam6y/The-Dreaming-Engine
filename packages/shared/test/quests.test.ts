import { describe, expect, it } from "vitest";

import {
  abandonQuest,
  acceptProposal,
  activeQuestSlotCount,
  addItem,
  countOf,
  countQuestItem,
  createNewGameState,
  createProposedQuest,
  emptyInventory,
  ESCORT_DESTINATIONS,
  gameStateSchema,
  INVENTORY_CAPACITY,
  isReportReady,
  isStageAtOrAfter,
  MAIN_QUEST_STAGES,
  mainQuestStageIndex,
  occupiesQuestSlot,
  reclaimQuestParcel,
  receiveQuestParcel,
  recordDelivery,
  recordEscortArrival,
  recordHuntKill,
  recordSurvey,
  removeQuestFromList,
  reportQuest,
  subQuestSchema,
  subQuestTargetLabel,
  subQuestTypeSchema,
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

// M19: deliver / escort / survey の3型
type DeliverQuest = Extract<SubQuest, { type: "deliver" }>;
type EscortQuest = Extract<SubQuest, { type: "escort" }>;
type SurveyQuest = Extract<SubQuest, { type: "survey" }>;

function makeDeliver(over: Partial<DeliverQuest> = {}): DeliverQuest {
  return {
    type: "deliver",
    parcelId: "sealed-letter",
    recipientId: "innkeeper",
    id: "d",
    count: 2,
    progress: 0,
    rewardGold: 30,
    title: "封緘の文を届ける",
    description: "文をオルガへ届ける",
    status: "active",
    ...over
  };
}

function makeEscort(over: Partial<EscortQuest> = {}): EscortQuest {
  return {
    type: "escort",
    destinationId: "town-gate",
    id: "e",
    count: 1,
    progress: 0,
    rewardGold: 20,
    title: "南門まで護衛",
    description: "南門まで同行する",
    status: "active",
    ...over
  };
}

function makeSurvey(over: Partial<SurveyQuest> = {}): SurveyQuest {
  return {
    type: "survey",
    targetId: "field-sign-post",
    id: "s",
    count: 1,
    progress: 0,
    rewardGold: 20,
    title: "道標を調べる",
    description: "忘れ野の道標を確かめる",
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

// ---------------------------------------------------------------------------
// M19: サブクエスト3型(deliver / escort / survey)の状態機械
// ---------------------------------------------------------------------------

describe("M19 スキーマ(discriminatedUnion 追加・count 固定・混成却下)", () => {
  it("subQuestTypeSchema が discriminatedUnion の判別子5種と一致する(drift 検知)", () => {
    expect(subQuestTypeSchema.options).toEqual(["hunt", "fetch", "deliver", "escort", "survey"]);
    expect(subQuestSchema.safeParse(makeHunt()).success).toBe(true);
    expect(subQuestSchema.safeParse(makeFetch()).success).toBe(true);
    expect(subQuestSchema.safeParse(makeDeliver()).success).toBe(true);
    expect(subQuestSchema.safeParse(makeEscort()).success).toBe(true);
    expect(subQuestSchema.safeParse(makeSurvey()).success).toBe(true);
  });

  it("escort/survey は count=1 のみ受理し count≠1 を却下する(追加規則)", () => {
    expect(subQuestSchema.safeParse(makeEscort({ count: 1 })).success).toBe(true);
    expect(subQuestSchema.safeParse(makeSurvey({ count: 1 })).success).toBe(true);
    // count≠1 は却下(型を外して生の値で検証)
    expect(subQuestSchema.safeParse({ ...makeEscort(), count: 2 }).success).toBe(false);
    expect(subQuestSchema.safeParse({ ...makeSurvey(), count: 3 }).success).toBe(false);
    expect(subQuestSchema.safeParse({ ...makeEscort(), count: 0 }).success).toBe(false);
  });

  it("混成フィールド・ホワイトリスト外は却下(deliver に hunt 用 targetId を混ぜる等)", () => {
    // deliver に parcelId/recipientId が無く targetId を混ぜても却下
    const mixed = {
      type: "deliver",
      targetId: "mist-wolf",
      id: "x",
      count: 1,
      progress: 0,
      rewardGold: 20,
      title: "t",
      description: "d",
      status: "active"
    };
    expect(subQuestSchema.safeParse(mixed).success).toBe(false);
    // ホワイトリスト外の recipient/destination/target(生の値で検証)
    expect(subQuestSchema.safeParse({ ...makeDeliver(), recipientId: "informant" }).success).toBe(false);
    expect(subQuestSchema.safeParse({ ...makeEscort(), destinationId: "moon-gate" }).success).toBe(false);
    expect(subQuestSchema.safeParse({ ...makeSurvey(), targetId: "d4-conduit" }).success).toBe(false);
  });

  it("createProposedQuest は escort/survey の count を 1 に確定する", () => {
    const e = createProposedQuest("e", {
      type: "escort",
      destinationId: "town-gate",
      count: 3,
      rewardGold: 20,
      title: "護衛",
      description: "同行"
    });
    expect(e.count).toBe(1);
    expect(e.status).toBe("proposed");
    const s = createProposedQuest("s", {
      type: "survey",
      targetId: "d1-sign",
      count: 5,
      rewardGold: 20,
      title: "調査",
      description: "調べる"
    });
    expect(s.count).toBe(1);
    expect(subQuestSchema.safeParse(e).success).toBe(true);
    expect(subQuestSchema.safeParse(s).success).toBe(true);
  });

  it("subQuestTargetLabel は型別の表示ラベルを返す", () => {
    expect(subQuestTargetLabel(makeHunt({ targetId: "mist-wolf" }))).toBe("霧狼");
    expect(subQuestTargetLabel(makeFetch({ targetId: "herb" }))).toBe("薬草");
    expect(subQuestTargetLabel(makeDeliver({ recipientId: "innkeeper" }))).toBe("オルガ");
    expect(subQuestTargetLabel(makeEscort({ destinationId: "town-gate" }))).toBe("灯町・南門");
    expect(subQuestTargetLabel(makeSurvey({ targetId: "field-sign-post" }))).toBe("忘れ野の道標");
  });
});

describe("M19 deliver(配達)の状態機械", () => {
  it("正常系: 受諾→預かり品受領→納品→completed→報告(所持削除なし・報酬付与)", () => {
    const proposal = createProposedQuest("d1", {
      type: "deliver",
      parcelId: "sealed-letter",
      recipientId: "innkeeper",
      count: 2,
      rewardGold: 30,
      rewardItemId: "potion-small",
      title: "封緘の文",
      description: "オルガへ届ける"
    });
    expect(proposal.status).toBe("proposed");
    expect(subQuestSchema.safeParse(proposal).success).toBe(true);

    // 受諾: リスト側
    const acc = acceptProposal(proposal, []);
    expect(acc.ok).toBe(true);
    const active = acc.ok ? acc.quests : [];

    // 受諾: 預かり品を別枠へ(通常枠に空きあり)
    let inv = addItem(emptyInventory(), "potion-small", 1).inventory;
    inv = receiveQuestParcel(proposal, inv);
    expect(countQuestItem(inv, "sealed-letter")).toBe(2);

    // 遂行: 受取NPCに話しかけて納品 → completed・別枠から削除
    const del = recordDelivery(active, inv, "innkeeper");
    const completed = del.quests[0];
    expect(completed?.status).toBe("completed");
    expect(countQuestItem(del.inventory, "sealed-letter")).toBe(0);

    // 報告: 所持削除なし・報酬付与(通常枠に空きがあるので rewardItem を受領)
    expect(completed).toBeDefined();
    if (completed) {
      expect(isReportReady(completed, del.inventory)).toBe(true);
      const rep = reportQuest(completed, del.inventory);
      expect(rep.ok).toBe(true);
      if (rep.ok) {
        expect(rep.quest.status).toBe("reported");
        expect(rep.goldGained).toBe(30);
        expect(rep.rewardItemGranted).toBe(true);
        expect(countOf(rep.inventory, "potion-small")).toBe(2); // 既存1 + 報酬1
        expect(countQuestItem(rep.inventory, "sealed-letter")).toBe(0); // 別枠は変わらず空
      }
    }
  });

  it("受諾: 通常枠が満杯でも預かり品を別枠へ受領できる(所持上限対象外)", () => {
    const proposal = makeDeliver({ status: "proposed", parcelId: "amber-charm", count: 3 });
    const full = addItem(emptyInventory(), "herb", INVENTORY_CAPACITY).inventory;
    const inv = receiveQuestParcel(proposal, full);
    expect(countQuestItem(inv, "amber-charm")).toBe(3);
    expect(usedSpace(inv)).toBe(INVENTORY_CAPACITY); // 通常枠は不変
  });

  it("報告: deliver は納品削除がないため通常枠満杯だと rewardItem 受領を保留(fetch と異なる)", () => {
    // deliver の納品は受取NPCへの手渡しで完結済み。報告時に通常枠が空かないので満杯だと保留
    const quest = makeDeliver({ status: "completed", rewardGold: 30, rewardItemId: "potion-small" });
    const full = addItem(emptyInventory(), "herb", INVENTORY_CAPACITY).inventory;
    const rep = reportQuest(quest, full);
    expect(rep.ok).toBe(false);
    if (!rep.ok) expect(rep.reason).toBe("inventory_full");
    expect(usedSpace(full)).toBe(INVENTORY_CAPACITY); // 何も変更されない
  });

  it("納品は受取NPCが一致した active の deliver のみ(別NPC・別状態は無変化)", () => {
    const quests: SubQuest[] = [
      makeDeliver({ id: "match", recipientId: "innkeeper", parcelId: "sealed-letter", count: 1, status: "active" }),
      makeDeliver({ id: "other-npc", recipientId: "merchant", parcelId: "sealed-letter", count: 1, status: "active" }),
      makeDeliver({ id: "proposed", recipientId: "innkeeper", parcelId: "sealed-letter", count: 1, status: "proposed" })
    ];
    const inv = addItem(emptyInventory(), "sealed-letter", 3).inventory;
    const res = recordDelivery(quests, inv, "innkeeper");
    const byId = (id: string): SubQuest | undefined => res.quests.find((q) => q.id === id);
    expect(byId("match")?.status).toBe("completed");
    expect(byId("other-npc")?.status).toBe("active");
    expect(byId("proposed")?.status).toBe("proposed");
    // 一致した1件分(count1)のみ別枠から減る
    expect(countQuestItem(res.inventory, "sealed-letter")).toBe(2);
  });

  it("放棄: 未納品(active)の預かり品を別枠から回収(消滅)する", () => {
    const quest = makeDeliver({ status: "active", parcelId: "warm-oil-flask", count: 3 });
    const inv = addItem(emptyInventory(), "warm-oil-flask", 3).inventory;
    const reclaimed = reclaimQuestParcel(quest, inv);
    expect(countQuestItem(reclaimed, "warm-oil-flask")).toBe(0);
  });

  it("放棄: 納品済み(completed)は回収対象なし(別枠は既に空)", () => {
    const quest = makeDeliver({ status: "completed", parcelId: "warm-oil-flask", count: 3 });
    const inv = emptyInventory();
    expect(reclaimQuestParcel(quest, inv)).toEqual(inv);
  });
});

describe("M19 escort(護衛)の状態機械", () => {
  it("正常系: 受諾(受領物なし)→目的地座標に到達→completed→報告(所持削除なし)", () => {
    const proposal = createProposedQuest("e1", {
      type: "escort",
      destinationId: "town-gate",
      count: 1,
      rewardGold: 20,
      title: "護衛",
      description: "南門まで同行"
    });
    const acc = acceptProposal(proposal, []);
    const active = acc.ok ? acc.quests : [];
    // 受領物なし(escort は receiveQuestParcel が無変化)
    const inv = addItem(emptyInventory(), "herb", 5).inventory;
    expect(receiveQuestParcel(proposal, inv)).toEqual(inv);

    const dest = ESCORT_DESTINATIONS["town-gate"];
    // 別座標・別マップでは未達
    expect(recordEscortArrival(active, dest.mapId, { x: dest.position.x, y: dest.position.y + 1 })[0]?.status).toBe("active");
    expect(recordEscortArrival(active, "field", dest.position)[0]?.status).toBe("active");
    // 目的地到達で completed
    const arrived = recordEscortArrival(active, dest.mapId, dest.position);
    const completed = arrived[0];
    expect(completed?.status).toBe("completed");

    expect(completed).toBeDefined();
    if (completed) {
      expect(isReportReady(completed, inv)).toBe(true);
      const rep = reportQuest(completed, inv);
      expect(rep.ok).toBe(true);
      if (rep.ok) {
        expect(rep.quest.status).toBe("reported");
        expect(rep.goldGained).toBe(20);
        expect(countOf(rep.inventory, "herb")).toBe(5); // 所持は不変(納品なし)
      }
    }
  });
});

describe("M19 survey(調査)の状態機械", () => {
  it("正常系: 受諾→対象を調べる→completed→報告(所持削除なし)", () => {
    const proposal = createProposedQuest("s1", {
      type: "survey",
      targetId: "d1-sign",
      count: 1,
      rewardGold: 20,
      title: "調査",
      description: "刻印を確かめる"
    });
    const acc = acceptProposal(proposal, []);
    const active = acc.ok ? acc.quests : [];

    // 別オブジェクトを調べても未達
    expect(recordSurvey(active, "town-sign-tavern")[0]?.status).toBe("active");
    // 対象を調べて completed
    const done = recordSurvey(active, "d1-sign");
    const completed = done[0];
    expect(completed?.status).toBe("completed");

    expect(completed).toBeDefined();
    if (completed) {
      expect(isReportReady(completed, emptyInventory())).toBe(true);
      const rep = reportQuest(completed, emptyInventory());
      expect(rep.ok).toBe(true);
      if (rep.ok) {
        expect(rep.quest.status).toBe("reported");
        expect(rep.goldGained).toBe(20);
      }
    }
  });
});

describe("M19 報告ゲート・既存型不変・旧セーブ互換", () => {
  it("deliver/escort/survey は completed 未達(active)では報告不可", () => {
    expect(isReportReady(makeDeliver({ status: "active" }), emptyInventory())).toBe(false);
    expect(isReportReady(makeEscort({ status: "active" }), emptyInventory())).toBe(false);
    expect(isReportReady(makeSurvey({ status: "active" }), emptyInventory())).toBe(false);
    // completed なら報告可
    expect(isReportReady(makeDeliver({ status: "completed" }), emptyInventory())).toBe(true);
    expect(isReportReady(makeEscort({ status: "completed" }), emptyInventory())).toBe(true);
    expect(isReportReady(makeSurvey({ status: "completed" }), emptyInventory())).toBe(true);
  });

  it("新3型の報告はインベントリを削除しない(fetch のみ納品削除=不変)", () => {
    // deliver/escort/survey: 報告で所持は減らない
    for (const quest of [
      makeDeliver({ status: "completed" }),
      makeEscort({ status: "completed" }),
      makeSurvey({ status: "completed" })
    ]) {
      const inv = addItem(emptyInventory(), "herb", 4).inventory;
      const rep = reportQuest(quest, inv);
      expect(rep.ok).toBe(true);
      if (rep.ok) expect(countOf(rep.inventory, "herb")).toBe(4);
    }
    // fetch は従来どおり報告時に count 個を削除する(不変)
    const fetch = makeFetch({ status: "active", targetId: "herb", count: 3 });
    const rf = reportQuest(fetch, addItem(emptyInventory(), "herb", 5).inventory);
    expect(rf.ok).toBe(true);
    if (rf.ok) expect(countOf(rf.inventory, "herb")).toBe(2);
  });

  it("hunt の progress 挙動は不変(recordHuntKill は hunt のみ加算・新3型は無視)", () => {
    const quests: SubQuest[] = [
      makeHunt({ id: "h", status: "active", targetId: "mist-wolf", count: 2, progress: 0 }),
      makeDeliver({ id: "d", status: "active" }),
      makeEscort({ id: "e", status: "active" }),
      makeSurvey({ id: "s", status: "active" })
    ];
    const next = recordHuntKill(quests, "mist-wolf");
    const byId = (id: string): SubQuest | undefined => next.find((q) => q.id === id);
    expect(byId("h")?.progress).toBe(1);
    expect(byId("h")?.status).toBe("active");
    // 新3型は progress 0 のまま・status も不変(hunt 以外は無視)
    expect(byId("d")?.progress).toBe(0);
    expect(byId("e")?.progress).toBe(0);
    expect(byId("s")?.progress).toBe(0);
  });

  it("旧セーブ互換: hunt/fetch のみの subQuests 形状が union 追加後もパースできる", () => {
    const legacy: SubQuest[] = [makeHunt({ id: "h1" }), makeFetch({ id: "f1", targetId: "herb" })];
    const state = { ...createNewGameState(), subQuests: legacy };
    expect(gameStateSchema.safeParse(state).success).toBe(true);
  });

  it("新3型を含む subQuests も gameStateSchema でパースできる(セーブに載る)", () => {
    const quests: SubQuest[] = [
      makeDeliver({ id: "d1", status: "active" }),
      makeEscort({ id: "e1", status: "active" }),
      makeSurvey({ id: "s1", status: "completed" })
    ];
    const state = { ...createNewGameState(), subQuests: quests };
    const parsed = gameStateSchema.safeParse(state);
    expect(parsed.success).toBe(true);
  });
});
