import {
  addItem,
  createDefaultAiDailyCounters,
  emptyInventory,
  type DungeonSymbolCounts,
  type Inventory,
  type SubQuest,
  type WorldEvent
} from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import {
  validateAdjustAffinity,
  validateDreamEvents,
  validateGiveItem,
  validateNarrate,
  validateProposeQuest,
  validateSpeak,
  validateToolCall,
  validateWorldEvent,
  type AdjustAffinityContext,
  type DreamEventsContext,
  type GiveItemContext,
  type ProposeQuestContext,
  type ToolValidationContext,
  type ValidationResult
} from "../src/ai/tool-validation/index.js";

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/** ok を絞って effect を取り出す(reject なら失敗させる) */
function effectOf<E>(result: ValidationResult<E>): E {
  if (!result.ok) throw new Error(`expected ok, got reject: ${result.reason}`);
  return result.effect;
}

/** reject を絞って reason を取り出す(ok なら失敗させる) */
function reasonOf<E>(result: ValidationResult<E>): string {
  if (result.ok) throw new Error(`expected reject, got ok`);
  return result.reason;
}

/** 空き枠が free になるインベントリ(容量20。potion-small を 20-free 個入れる) */
function invWithFree(free: number): Inventory {
  return addItem(emptyInventory(), "potion-small", 20 - free).inventory;
}

/** active 状態の hunt サブクエスト(受注枠を占有する) */
function activeHuntQuest(id: string): SubQuest {
  return {
    type: "hunt",
    targetId: "mist-wolf",
    id,
    count: 1,
    progress: 0,
    rewardGold: 10,
    title: "霧狼狩り",
    description: "忘れ野の霧狼を討つ。",
    status: "active"
  };
}

const DUNGEON_MID: DungeonSymbolCounts = { 1: 4, 2: 4, 3: 4 };

const adjustBase: AdjustAffinityContext = {
  partnerNpcId: "innkeeper",
  adjustAffinityCount: 0,
  dailyAffinityDelta: 0,
  currentAffinity: 30
};

const giveBase: GiveItemContext = {
  affinityAtOpen: 50,
  inventory: emptyInventory(),
  giveItemCountInConversation: 0,
  giveItemCountToday: 0
};

const proposeBase: ProposeQuestContext = {
  subQuests: [],
  pendingProposal: null,
  proposeQuestCount: 0,
  rewardItemProposalCount: 0,
  questId: "quest-1"
};

const dreamBase: DreamEventsContext = { dungeonSymbolCounts: DUNGEON_MID };

const validHuntInput = {
  type: "hunt",
  targetId: "mist-wolf",
  count: 2,
  rewardGold: 40,
  title: "霧狼を狩る",
  description: "忘れ野をうろつく霧狼を二体討ってほしい。"
};

// ===========================================================================
// speak
// ===========================================================================

describe("validateSpeak", () => {
  it("自然な日本語発話を承認し、正規化テキストを effect に持つ", () => {
    const r = validateSpeak({ text: "旅人よ、今宵はよく眠りな。" });
    expect(effectOf(r)).toEqual({ kind: "speak", text: "旅人よ、今宵はよく眠りな。" });
  });

  it("400字ちょうどは通過、401字は too_long で却下", () => {
    const ok = "あ".repeat(400);
    const over = "あ".repeat(401);
    expect(validateSpeak({ text: ok }).ok).toBe(true);
    expect(reasonOf(validateSpeak({ text: over }))).toContain("too_long");
  });

  it("空文字は出力壁の empty で却下", () => {
    expect(reasonOf(validateSpeak({ text: "" }))).toContain("empty");
  });

  it("世界観逸脱(Claude)は deviation で却下", () => {
    expect(reasonOf(validateSpeak({ text: "私はClaudeという言語モデルです。" }))).toContain("deviation");
  });

  it("text 欠落・非文字列はスキーマ検証で却下", () => {
    expect(reasonOf(validateSpeak({}))).toContain("スキーマ");
    expect(reasonOf(validateSpeak({ text: 123 }))).toContain("スキーマ");
    expect(reasonOf(validateSpeak(null))).toContain("スキーマ");
  });
});

// ===========================================================================
// narrate
// ===========================================================================

describe("validateNarrate", () => {
  it("自然な日本語ナレーションを承認する", () => {
    const r = validateNarrate({ text: "霧が晴れ、灯町に朝が差した。" });
    expect(effectOf(r)).toEqual({ kind: "narrate", text: "霧が晴れ、灯町に朝が差した。" });
  });

  it("300字ちょうどは通過、301字は too_long(speak より短い上限)", () => {
    expect(validateNarrate({ text: "あ".repeat(300) }).ok).toBe(true);
    expect(reasonOf(validateNarrate({ text: "あ".repeat(301) }))).toContain("too_long");
  });

  it("非文字列はスキーマ却下", () => {
    expect(reasonOf(validateNarrate({ text: [] }))).toContain("スキーマ");
  });
});

// ===========================================================================
// adjust_affinity
// ===========================================================================

describe("validateAdjustAffinity", () => {
  it("会話相手・範囲内 delta を承認し、適用後好感度と delta を effect に持つ", () => {
    const r = validateAdjustAffinity(
      { npcId: "innkeeper", delta: 5, reason: "親切にされた" },
      { ...adjustBase, currentAffinity: 30 }
    );
    expect(effectOf(r)).toEqual({ kind: "adjust_affinity", npcId: "innkeeper", affinity: 35, delta: 5 });
  });

  it("適用後好感度は0..100にクランプされる", () => {
    const up = validateAdjustAffinity(
      { npcId: "innkeeper", delta: 10, reason: "感謝" },
      { ...adjustBase, currentAffinity: 95 }
    );
    expect(effectOf(up).affinity).toBe(100);
    const down = validateAdjustAffinity(
      { npcId: "innkeeper", delta: -10, reason: "失望" },
      { ...adjustBase, currentAffinity: 5 }
    );
    expect(effectOf(down).affinity).toBe(0);
  });

  it("会話相手と異なるNPCへの変更は却下", () => {
    const r = validateAdjustAffinity(
      { npcId: "merchant", delta: 5, reason: "他人" },
      { ...adjustBase, partnerNpcId: "innkeeper" }
    );
    expect(reasonOf(r)).toContain("会話相手");
  });

  it("delta が範囲外(±10超)・非整数はスキーマ却下(境界±10は通過)", () => {
    expect(validateAdjustAffinity({ npcId: "innkeeper", delta: 10, reason: "x" }, adjustBase).ok).toBe(true);
    expect(validateAdjustAffinity({ npcId: "innkeeper", delta: -10, reason: "x" }, adjustBase).ok).toBe(true);
    expect(reasonOf(validateAdjustAffinity({ npcId: "innkeeper", delta: 11, reason: "x" }, adjustBase))).toContain("スキーマ");
    expect(reasonOf(validateAdjustAffinity({ npcId: "innkeeper", delta: 2.5, reason: "x" }, adjustBase))).toContain("スキーマ");
  });

  it("会話内2回まで(adjustAffinityCount=2 で却下)", () => {
    expect(validateAdjustAffinity({ npcId: "innkeeper", delta: 1, reason: "x" }, { ...adjustBase, adjustAffinityCount: 1 }).ok).toBe(true);
    expect(reasonOf(validateAdjustAffinity({ npcId: "innkeeper", delta: 1, reason: "x" }, { ...adjustBase, adjustAffinityCount: 2 }))).toContain("会話内");
  });

  it("日次累積±20の境界: 累積15+delta5=20は通過、+6=21は却下", () => {
    expect(validateAdjustAffinity({ npcId: "innkeeper", delta: 5, reason: "x" }, { ...adjustBase, dailyAffinityDelta: 15 }).ok).toBe(true);
    expect(reasonOf(validateAdjustAffinity({ npcId: "innkeeper", delta: 6, reason: "x" }, { ...adjustBase, dailyAffinityDelta: 15 }))).toContain("日次累積");
  });

  it("日次累積は負側にも効く(累積-18+delta-5=-23は却下)", () => {
    expect(reasonOf(validateAdjustAffinity({ npcId: "innkeeper", delta: -5, reason: "x" }, { ...adjustBase, dailyAffinityDelta: -18 }))).toContain("日次累積");
  });
});

// ===========================================================================
// give_item
// ===========================================================================

describe("validateGiveItem", () => {
  it("好感度50以上・空きあり・カウンタ余裕で承認する", () => {
    const r = validateGiveItem(
      { itemId: "potion-small", quantity: 2, reason: "餞別" },
      { ...giveBase, affinityAtOpen: 50, inventory: emptyInventory() }
    );
    expect(effectOf(r)).toEqual({ kind: "give_item", itemId: "potion-small", quantity: 2 });
  });

  it("好感度50が境界(50は通過・49は却下)", () => {
    expect(validateGiveItem({ itemId: "antidote", quantity: 1, reason: "x" }, { ...giveBase, affinityAtOpen: 50 }).ok).toBe(true);
    expect(reasonOf(validateGiveItem({ itemId: "antidote", quantity: 1, reason: "x" }, { ...giveBase, affinityAtOpen: 49 }))).toContain("好感度");
  });

  it("give_item は会話中の好感度上昇では解禁されない(affinityAtOpen で判定)", () => {
    // 会話開始時40。会話内 adjust_affinity で現在値が上がっていても、検証器は affinityAtOpen(=40)のみを読む。
    const r = validateGiveItem(
      { itemId: "potion-small", quantity: 1, reason: "上昇後の贈与" },
      { ...giveBase, affinityAtOpen: 40 }
    );
    expect(reasonOf(r)).toContain("好感度");
  });

  it("所持枠不足(空き<quantity)は却下、境界(空き=quantity)は通過", () => {
    expect(validateGiveItem({ itemId: "potion-mid", quantity: 3, reason: "x" }, { ...giveBase, inventory: invWithFree(3) }).ok).toBe(true);
    expect(reasonOf(validateGiveItem({ itemId: "potion-mid", quantity: 3, reason: "x" }, { ...giveBase, inventory: invWithFree(2) }))).toContain("所持枠");
    expect(reasonOf(validateGiveItem({ itemId: "potion-mid", quantity: 1, reason: "x" }, { ...giveBase, inventory: invWithFree(0) }))).toContain("所持枠");
  });

  it("quantity は 1..3 の整数(0・4・非整数はスキーマ却下、3は通過)", () => {
    expect(validateGiveItem({ itemId: "potion-small", quantity: 3, reason: "x" }, giveBase).ok).toBe(true);
    expect(reasonOf(validateGiveItem({ itemId: "potion-small", quantity: 0, reason: "x" }, giveBase))).toContain("スキーマ");
    expect(reasonOf(validateGiveItem({ itemId: "potion-small", quantity: 4, reason: "x" }, giveBase))).toContain("スキーマ");
    expect(reasonOf(validateGiveItem({ itemId: "potion-small", quantity: 2.5, reason: "x" }, giveBase))).toContain("スキーマ");
  });

  it("贈答ホワイトリスト外の itemId はスキーマ却下(素材 ore・クエスト用 old-key)", () => {
    expect(reasonOf(validateGiveItem({ itemId: "ore", quantity: 1, reason: "x" }, giveBase))).toContain("スキーマ");
    expect(reasonOf(validateGiveItem({ itemId: "old-key", quantity: 1, reason: "x" }, giveBase))).toContain("スキーマ");
  });

  it("会話内1回まで(giveItemCountInConversation=1 で却下)", () => {
    expect(reasonOf(validateGiveItem({ itemId: "potion-small", quantity: 1, reason: "x" }, { ...giveBase, giveItemCountInConversation: 1 }))).toContain("会話内");
  });

  it("1日3回まで(giveItemCountToday=3 で却下)", () => {
    expect(reasonOf(validateGiveItem({ itemId: "potion-small", quantity: 1, reason: "x" }, { ...giveBase, giveItemCountToday: 3 }))).toContain("1日");
  });
});

// ===========================================================================
// propose_quest
// ===========================================================================

describe("validateProposeQuest", () => {
  it("有効な hunt 提案を承認し、proposed 状態の SubQuest を effect に持つ", () => {
    const r = validateProposeQuest(validHuntInput, proposeBase);
    const eff = effectOf(r);
    expect(eff.kind).toBe("propose_quest");
    expect(eff.quest).toMatchObject({
      id: "quest-1",
      type: "hunt",
      targetId: "mist-wolf",
      count: 2,
      rewardGold: 40,
      status: "proposed",
      progress: 0
    });
    expect(eff.quest.title).toBe("霧狼を狩る");
  });

  it("有効な fetch(報酬アイテム付き)提案を承認する", () => {
    const r = validateProposeQuest(
      { type: "fetch", targetId: "herb", count: 3, rewardGold: 30, rewardItemId: "potion-small", title: "薬草集め", description: "森辺で薬草を三つ摘んできてほしい。" },
      proposeBase
    );
    expect(effectOf(r).quest).toMatchObject({ type: "fetch", targetId: "herb", rewardItemId: "potion-small", status: "proposed" });
  });

  it("count は 1..5 の整数(0・6・非整数はスキーマ却下)", () => {
    expect(reasonOf(validateProposeQuest({ ...validHuntInput, count: 0, rewardGold: 10 }, proposeBase))).toContain("スキーマ");
    expect(reasonOf(validateProposeQuest({ ...validHuntInput, count: 6, rewardGold: 100 }, proposeBase))).toContain("スキーマ");
    expect(reasonOf(validateProposeQuest({ ...validHuntInput, count: 2.5, rewardGold: 40 }, proposeBase))).toContain("スキーマ");
  });

  it("rewardGold は 10..100(範囲外はスキーマ却下)", () => {
    expect(reasonOf(validateProposeQuest({ ...validHuntInput, count: 1, rewardGold: 9 }, proposeBase))).toContain("スキーマ");
    expect(reasonOf(validateProposeQuest({ ...validHuntInput, count: 5, rewardGold: 101 }, proposeBase))).toContain("スキーマ");
  });

  it("報酬対難度の比: rewardGold ≤ count×20(境界 count2×20=40 通過、41 却下)", () => {
    expect(validateProposeQuest({ ...validHuntInput, count: 2, rewardGold: 40 }, proposeBase).ok).toBe(true);
    expect(reasonOf(validateProposeQuest({ ...validHuntInput, count: 2, rewardGold: 41 }, proposeBase))).toContain("報酬過大");
  });

  it("targetId は type 別ホワイトリスト(hunt に fetch用 herb、fetch に敵 mist-wolf は却下)", () => {
    expect(reasonOf(validateProposeQuest({ ...validHuntInput, targetId: "herb" }, proposeBase))).toContain("スキーマ");
    expect(reasonOf(validateProposeQuest({ type: "fetch", targetId: "mist-wolf", count: 2, rewardGold: 20, title: "採集", description: "何かを集める。" }, proposeBase))).toContain("スキーマ");
    // ボス dream-eater(リスポーンしない)は hunt ホワイトリスト外
    expect(reasonOf(validateProposeQuest({ ...validHuntInput, targetId: "dream-eater" }, proposeBase))).toContain("スキーマ");
  });

  it("未受諾提案が残っている(pendingProposal!=null)なら却下", () => {
    const pending = { ...activeHuntQuest("pending"), status: "proposed" as const };
    expect(reasonOf(validateProposeQuest(validHuntInput, { ...proposeBase, pendingProposal: pending }))).toContain("未受諾");
  });

  it("受注枠が満杯(占有3件)なら却下、2件なら通過", () => {
    const three = [activeHuntQuest("a"), activeHuntQuest("b"), activeHuntQuest("c")];
    expect(reasonOf(validateProposeQuest(validHuntInput, { ...proposeBase, subQuests: three }))).toContain("受注枠");
    expect(validateProposeQuest(validHuntInput, { ...proposeBase, subQuests: three.slice(0, 2) }).ok).toBe(true);
  });

  it("1日の発行上限(proposeQuestCount=3 で却下)", () => {
    expect(reasonOf(validateProposeQuest(validHuntInput, { ...proposeBase, proposeQuestCount: 3 }))).toContain("発行上限");
  });

  it("報酬アイテム付き提案は1日1件(rewardItemProposalCount=1 で却下、報酬アイテムなしは影響なし)", () => {
    const withItem = { ...validHuntInput, rewardItemId: "antidote" };
    expect(reasonOf(validateProposeQuest(withItem, { ...proposeBase, rewardItemProposalCount: 1 }))).toContain("報酬アイテム");
    // rewardItemId なしなら rewardItemProposalCount=1 でも通過
    expect(validateProposeQuest(validHuntInput, { ...proposeBase, rewardItemProposalCount: 1 }).ok).toBe(true);
  });

  it("title 40字超・description 200字超・逸脱は出力壁で却下", () => {
    expect(reasonOf(validateProposeQuest({ ...validHuntInput, title: "あ".repeat(41) }, proposeBase))).toContain("title");
    expect(reasonOf(validateProposeQuest({ ...validHuntInput, description: "あ".repeat(201) }, proposeBase))).toContain("description");
    expect(reasonOf(validateProposeQuest({ ...validHuntInput, title: "Claudeの依頼" }, proposeBase))).toContain("title");
  });
});

// ===========================================================================
// trigger_world_event(単一)
// ===========================================================================

describe("validateWorldEvent(単一)", () => {
  it("weather を承認する", () => {
    const r = validateWorldEvent({ event: { kind: "weather", value: "fog" } }, dreamBase);
    expect(effectOf(r)).toEqual({ kind: "world_event", event: { kind: "weather", value: "fog" }, dungeonSymbolCount: null });
  });

  it("npc_rumor は出力壁を通過し rumor を正規化する(120字超は却下)", () => {
    const ok = validateWorldEvent({ event: { kind: "npc_rumor", npcId: "informant", rumor: "忘れ野に霧が満ちているらしい。" } }, dreamBase);
    expect(effectOf(ok).event).toMatchObject({ kind: "npc_rumor", npcId: "informant" });
    const over = validateWorldEvent({ event: { kind: "npc_rumor", npcId: "informant", rumor: "あ".repeat(121) } }, dreamBase);
    expect(reasonOf(over)).toContain("rumor");
  });

  it("dungeon_shift は起点+delta をクランプした適用後カウントを返す", () => {
    const r = validateWorldEvent({ event: { kind: "dungeon_shift", layer: 1, symbolCountDelta: 1 } }, { dungeonSymbolCounts: { 1: 4, 2: 4, 3: 4 } });
    expect(effectOf(r).dungeonSymbolCount).toEqual({ layer: 1, count: 5 });
    // 上限6での+1はクランプ
    const clamped = validateWorldEvent({ event: { kind: "dungeon_shift", layer: 1, symbolCountDelta: 1 } }, { dungeonSymbolCounts: { 1: 6, 2: 4, 3: 4 } });
    expect(effectOf(clamped).dungeonSymbolCount).toEqual({ layer: 1, count: 6 });
  });

  it("未定義 kind・{event}欠落はスキーマ却下", () => {
    expect(reasonOf(validateWorldEvent({ event: { kind: "earthquake" } }, dreamBase))).toContain("スキーマ");
    expect(reasonOf(validateWorldEvent({ kind: "weather", value: "fog" }, dreamBase))).toContain("スキーマ");
  });
});

// ===========================================================================
// validateDreamEvents(リスト・解決規則)
// ===========================================================================

describe("validateDreamEvents(解決規則)", () => {
  it("weather は後勝ち(最後の1件のみ有効)", () => {
    const r = validateDreamEvents(
      [{ kind: "weather", value: "clear" }, { kind: "weather", value: "fog" }],
      dreamBase
    );
    const weathers = r.effect.events.filter((e): e is Extract<WorldEvent, { kind: "weather" }> => e.kind === "weather");
    expect(weathers).toHaveLength(1);
    expect(weathers[0]?.value).toBe("fog");
  });

  it("npc_rumor は同一NPCで後勝ち・別NPCは併存", () => {
    const sameNpc = validateDreamEvents(
      [
        { kind: "npc_rumor", npcId: "innkeeper", rumor: "古い噂。" },
        { kind: "npc_rumor", npcId: "innkeeper", rumor: "新しい噂。" }
      ],
      dreamBase
    );
    const rumors = sameNpc.effect.events.filter((e): e is Extract<WorldEvent, { kind: "npc_rumor" }> => e.kind === "npc_rumor");
    expect(rumors).toHaveLength(1);
    expect(rumors[0]?.rumor).toBe("新しい噂。");

    const twoNpc = validateDreamEvents(
      [
        { kind: "npc_rumor", npcId: "innkeeper", rumor: "宿の噂。" },
        { kind: "npc_rumor", npcId: "merchant", rumor: "店の噂。" }
      ],
      dreamBase
    );
    expect(twoNpc.effect.events.filter((e) => e.kind === "npc_rumor")).toHaveLength(2);
  });

  it("street_event は異なる id は併存・同一 id の2件目以降は却下", () => {
    const dup = validateDreamEvents(
      [{ kind: "street_event", eventId: "peddler" }, { kind: "street_event", eventId: "peddler" }],
      dreamBase
    );
    expect(dup.effect.events.filter((e) => e.kind === "street_event")).toHaveLength(1);
    expect(dup.rejected).toHaveLength(1);
    expect(dup.rejected[0]?.index).toBe(1);

    const distinct = validateDreamEvents(
      [{ kind: "street_event", eventId: "peddler" }, { kind: "street_event", eventId: "black-cat" }],
      dreamBase
    );
    expect(distinct.effect.events.filter((e) => e.kind === "street_event")).toHaveLength(2);
    expect(distinct.rejected).toHaveLength(0);
  });

  it("dungeon_shift は承認順に累積適用し、レンジへクランプする(上方向)", () => {
    const r = validateDreamEvents(
      [
        { kind: "dungeon_shift", layer: 1, symbolCountDelta: 1 },
        { kind: "dungeon_shift", layer: 1, symbolCountDelta: 1 }
      ],
      { dungeonSymbolCounts: { 1: 5, 2: 4, 3: 4 } }
    );
    // 5→6→6(上限6でクランプ)
    expect(r.effect.dungeonSymbolCounts[1]).toBe(6);
    // dungeon_shift は非累積イベント一覧(events)には載せない
    expect(r.effect.events).toHaveLength(0);
  });

  it("dungeon_shift は下方向にもクランプする(下限2)", () => {
    const r = validateDreamEvents(
      [
        { kind: "dungeon_shift", layer: 2, symbolCountDelta: -1 },
        { kind: "dungeon_shift", layer: 2, symbolCountDelta: -1 },
        { kind: "dungeon_shift", layer: 2, symbolCountDelta: -1 }
      ],
      { dungeonSymbolCounts: { 1: 4, 2: 3, 3: 4 } }
    );
    // 3→2→2→2(下限2でクランプ)
    expect(r.effect.dungeonSymbolCounts[2]).toBe(2);
  });

  it("4件目以降は上限超過として却下(先頭3件のみ処理)", () => {
    const r = validateDreamEvents(
      [
        { kind: "weather", value: "fog" },
        { kind: "street_event", eventId: "peddler" },
        { kind: "street_event", eventId: "black-cat" },
        { kind: "street_event", eventId: "distant-bell" }
      ],
      dreamBase
    );
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0]?.index).toBe(3);
    expect(r.effect.events).toHaveLength(3);
  });

  it("異種混在: weather+rumor+dungeon_shift をまとめて解決する", () => {
    const r = validateDreamEvents(
      [
        { kind: "weather", value: "rain" },
        { kind: "npc_rumor", npcId: "priest", rumor: "灯が揺れている。" },
        { kind: "dungeon_shift", layer: 3, symbolCountDelta: 1 }
      ],
      { dungeonSymbolCounts: { 1: 4, 2: 4, 3: 4 } }
    );
    expect(r.effect.events.filter((e) => e.kind === "weather")).toHaveLength(1);
    expect(r.effect.events.filter((e) => e.kind === "npc_rumor")).toHaveLength(1);
    expect(r.effect.dungeonSymbolCounts[3]).toBe(5);
    expect(r.rejected).toHaveLength(0);
  });

  it("配列でない入力は却下記録つきで空 effect を返す", () => {
    const r = validateDreamEvents({ kind: "weather", value: "fog" }, dreamBase);
    expect(r.effect.events).toHaveLength(0);
    expect(r.rejected).toHaveLength(1);
  });

  it("不正な要素は index つきで却下し、有効な要素は処理する", () => {
    const r = validateDreamEvents(
      [{ kind: "weather", value: "fog" }, { kind: "bogus" }],
      dreamBase
    );
    expect(r.effect.events.filter((e) => e.kind === "weather")).toHaveLength(1);
    expect(r.rejected[0]?.index).toBe(1);
  });
});

// ===========================================================================
// ディスパッチャ(フロー許可集合の二重チェック + 振り分け)
// ===========================================================================

function fullContext(overrides: {
  session?: ToolValidationContext["session"];
  persistent?: Partial<ToolValidationContext["persistent"]>;
} = {}): ToolValidationContext {
  return {
    session:
      overrides.session === undefined
        ? { partnerNpcId: "innkeeper", affinityAtOpen: 60, adjustAffinityCount: 0, giveItemCount: 0, pendingProposal: null }
        : overrides.session,
    persistent: {
      aiDaily: createDefaultAiDailyCounters(),
      affinityByNpc: { innkeeper: 30, merchant: 30, informant: 30, priest: 30, caretaker: 30, artisan: 30, warden: 30 },
      inventory: emptyInventory(),
      subQuests: [],
      dungeonSymbolCounts: DUNGEON_MID,
      nextQuestId: "quest-1",
      ...overrides.persistent
    }
  };
}

describe("validateToolCall(フロー許可集合の二重チェック)", () => {
  it("dream フローで give_item はクロスフロー遮断で却下(振り分け前)", () => {
    const r = validateToolCall("dream", "give_item", { itemId: "potion-small", quantity: 1, reason: "x" }, fullContext());
    expect(reasonOf(r)).toContain("許可されていない");
  });

  it("conversation フローで trigger_world_event は却下", () => {
    const r = validateToolCall("conversation", "trigger_world_event", { event: { kind: "weather", value: "fog" } }, fullContext());
    expect(reasonOf(r)).toContain("許可されていない");
  });

  it("summary フローは空許可集合(あらゆるツールを却下)", () => {
    expect(reasonOf(validateToolCall("summary", "speak", { text: "夢の話" }, fullContext()))).toContain("許可されていない");
  });

  it("battleResult フローは narrate のみ許可(speak は却下)", () => {
    expect(validateToolCall("battleResult", "narrate", { text: "敵は霧に還った。" }, fullContext()).ok).toBe(true);
    expect(reasonOf(validateToolCall("battleResult", "speak", { text: "やあ" }, fullContext()))).toContain("許可されていない");
  });

  it("許可されたツールは対応検証器へ振り分けられる(conversation/speak)", () => {
    const r = validateToolCall("conversation", "speak", { text: "旅人よ。" }, fullContext());
    expect(effectOf(r)).toMatchObject({ kind: "speak" });
  });

  it("give_item は affinityAtOpen で判定(現在の永続好感度が高くても解禁しない)", () => {
    // 会話開始時40、現在の永続好感度は90(会話内で上昇したと仮定)→ give_item は却下されるべき
    const ctx = fullContext({
      session: { partnerNpcId: "innkeeper", affinityAtOpen: 40, adjustAffinityCount: 0, giveItemCount: 0, pendingProposal: null },
      persistent: { affinityByNpc: { innkeeper: 90, merchant: 30, informant: 30, priest: 30, caretaker: 30, artisan: 30, warden: 30 } }
    });
    const r = validateToolCall("conversation", "give_item", { itemId: "potion-small", quantity: 1, reason: "贈与" }, ctx);
    expect(reasonOf(r)).toContain("好感度");
  });

  it("adjust_affinity は永続日次カウンタと会話相手を統合コンテキストから引く", () => {
    const ctx = fullContext({
      session: { partnerNpcId: "informant", affinityAtOpen: 30, adjustAffinityCount: 0, giveItemCount: 0, pendingProposal: null },
      persistent: {
        affinityByNpc: { innkeeper: 30, merchant: 30, informant: 40, priest: 30, caretaker: 30, artisan: 30, warden: 30 },
        aiDaily: { ...createDefaultAiDailyCounters(), affinityDeltaByNpc: { innkeeper: 0, merchant: 0, informant: 18, priest: 0, caretaker: 0, artisan: 0, warden: 0 } }
      }
    });
    // 日次18 + 5 = 23 > 20 → 却下
    expect(reasonOf(validateToolCall("conversation", "adjust_affinity", { npcId: "informant", delta: 5, reason: "x" }, ctx))).toContain("日次累積");
    // 会話相手 informant 宛て delta 2(累積18+2=20)は通過し、現在好感度40+2=42
    const ok = validateToolCall("conversation", "adjust_affinity", { npcId: "informant", delta: 2, reason: "x" }, ctx);
    expect(effectOf(ok)).toMatchObject({ kind: "adjust_affinity", npcId: "informant", affinity: 42, delta: 2 });
  });

  it("propose_quest は questGeneration フローで通過し、未受諾提案の統合も効く", () => {
    const ok = validateToolCall("questGeneration", "propose_quest", validHuntInput, fullContext());
    expect(effectOf(ok)).toMatchObject({ kind: "propose_quest" });

    const pending = { ...activeHuntQuest("p"), status: "proposed" as const };
    const blocked = validateToolCall(
      "questGeneration",
      "propose_quest",
      validHuntInput,
      fullContext({ session: { partnerNpcId: "informant", affinityAtOpen: 30, adjustAffinityCount: 0, giveItemCount: 0, pendingProposal: pending } })
    );
    expect(reasonOf(blocked)).toContain("未受諾");
  });
});
