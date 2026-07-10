import {
  addItem,
  createDefaultAiDailyCounters,
  emptyInventory,
  type Inventory,
  type NpcId,
  type SubQuest
} from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import { loadAiConfig } from "../../src/ai/config.js";
import type {
  DreamMaster,
  DreamMasterContext,
  DreamMasterResult
} from "../../src/ai/dream-master/index.js";
import { AiTurnExecutor, ConversationSession } from "../../src/ai/flow-control/index.js";
import {
  validateDreamEvents,
  validateToolCall,
  type PersistentStateContext,
  type ToolValidationContext
} from "../../src/ai/tool-validation/index.js";

/**
 * 攻撃テストA(ツール検証層の上限・境界・越境攻撃。ai-guardrails.md 243-266)。
 * 悪意ある生の意図(ホワイトリスト外・上限超過・越境・非整数など)をディスパッチャ
 * `validateToolCall` / `validateDreamEvents` へ直接投げ、すべて却下されることを機械検証する。
 * 実AIは使わない(検証層は純関数)。
 */

const config = loadAiConfig();

const AFFINITY_BASE: Record<NpcId, number> = {
  innkeeper: 30,
  merchant: 30,
  informant: 30,
  priest: 30,
  caretaker: 30,
  artisan: 30,
  warden: 30
};

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

function persistentBase(overrides: Partial<PersistentStateContext> = {}): PersistentStateContext {
  return {
    aiDaily: createDefaultAiDailyCounters(),
    affinityByNpc: { ...AFFINITY_BASE },
    inventory: emptyInventory(),
    subQuests: [],
    dungeonSymbolCounts: { 1: 4, 2: 4, 3: 4 },
    nextQuestId: "q1",
    ...overrides
  };
}

/** validateToolCall 用の統合コンテキスト(会話セッション + 永続スナップショット) */
function ctx(options: {
  session?: ToolValidationContext["session"];
  persistent?: Partial<PersistentStateContext>;
} = {}): ToolValidationContext {
  return {
    session:
      options.session === undefined
        ? {
            partnerNpcId: "innkeeper",
            affinityAtOpen: 60,
            adjustAffinityCount: 0,
            giveItemCount: 0,
            pendingProposal: null
          }
        : options.session,
    persistent: persistentBase(options.persistent)
  };
}

const validHunt = {
  type: "hunt",
  targetId: "mist-wolf",
  count: 2,
  rewardGold: 40,
  title: "霧狼を狩る",
  description: "忘れ野をうろつく霧狼を二体討ってほしい。"
};

/** reject を絞って reason を取り出す(ok なら失敗させる) */
function reasonOf(result: { ok: boolean; reason?: string }): string {
  if (result.ok) throw new Error("却下を期待したが承認された");
  return result.reason ?? "";
}

// ---------------------------------------------------------------------------
// give_item: ホワイトリスト・上限・好感度・満杯・回数
// ---------------------------------------------------------------------------

describe("攻撃テストA: give_item の上限・境界(第1層)", () => {
  it("[ATK-give-nonwhitelist] 贈答ホワイトリスト外アイテム(伝説の剣・素材ore・クエスト用old-key)は却下", () => {
    expect(
      validateToolCall("conversation", "give_item", { itemId: "legendary-sword", quantity: 1, reason: "x" }, ctx()).ok
    ).toBe(false);
    expect(
      validateToolCall("conversation", "give_item", { itemId: "ore", quantity: 1, reason: "x" }, ctx()).ok
    ).toBe(false);
    expect(
      validateToolCall("conversation", "give_item", { itemId: "old-key", quantity: 1, reason: "x" }, ctx()).ok
    ).toBe(false);
  });

  it("[ATK-limits-over] 上限超過(quantity:999・delta:+100・rewardGold:99999)は却下", () => {
    // quantity 999(上限3)
    expect(
      validateToolCall("conversation", "give_item", { itemId: "potion-small", quantity: 999, reason: "x" }, ctx()).ok
    ).toBe(false);
    // delta +100(範囲±10)
    expect(
      validateToolCall("conversation", "adjust_affinity", { npcId: "innkeeper", delta: 100, reason: "x" }, ctx()).ok
    ).toBe(false);
    // rewardGold 99999(範囲10..100)
    expect(
      validateToolCall("questGeneration", "propose_quest", { ...validHunt, rewardGold: 99999 }, ctx(questSession())).ok
    ).toBe(false);
  });

  it("[ATK-give-below-affinity] 好感度閾値(50)未満のNPCからの give_item は却下", () => {
    const r = validateToolCall(
      "conversation",
      "give_item",
      { itemId: "potion-small", quantity: 1, reason: "x" },
      ctx({ session: session({ affinityAtOpen: 49 }) })
    );
    expect(reasonOf(r)).toContain("好感度");
  });

  it("[ATK-give-affinity-at-open] 会話内で50以上へ上げても、直後の give_item は affinityAtOpen 判定で却下", () => {
    // 会話開始時40(閾値未満)。会話内 adjust_affinity で現在の永続好感度が90に上がっていても、
    // give_item 解禁判定はスナップショット affinityAtOpen(=40)のみを読むため却下される。
    const r = validateToolCall(
      "conversation",
      "give_item",
      { itemId: "potion-small", quantity: 1, reason: "上昇後の贈与" },
      ctx({
        session: session({ affinityAtOpen: 40 }),
        persistent: { affinityByNpc: { ...AFFINITY_BASE, innkeeper: 90 } }
      })
    );
    expect(reasonOf(r)).toContain("好感度");
  });

  it("[ATK-give-inventory-full] インベントリ満杯時の give_item は却下", () => {
    const r = validateToolCall(
      "conversation",
      "give_item",
      { itemId: "potion-mid", quantity: 1, reason: "x" },
      ctx({ persistent: { inventory: invWithFree(0) } })
    );
    expect(reasonOf(r)).toContain("所持枠");
  });

  it("[ATK-give-second-in-conversation] 1会話2回目の give_item は却下(会話内カウンタ)", () => {
    const r = validateToolCall(
      "conversation",
      "give_item",
      { itemId: "potion-small", quantity: 1, reason: "x" },
      ctx({ session: session({ giveItemCount: 1 }) })
    );
    expect(reasonOf(r)).toContain("会話内");
  });
});

// ---------------------------------------------------------------------------
// adjust_affinity: 日次累積・越境
// ---------------------------------------------------------------------------

describe("攻撃テストA: adjust_affinity の境界・越境(第1層)", () => {
  it("[ATK-affinity-daily-cap] 会話の開閉を跨いだ日次累積±20超の adjust_affinity は却下", () => {
    // 前の会話で informant を +18(永続 aiDaily に累積)。会話を閉じても aiDaily は残る。
    // 新しい会話で +5 → 18+5=23 > 20 → 却下(累積は会話境界を越えて効く)。
    const persistent: Partial<PersistentStateContext> = {
      affinityByNpc: { ...AFFINITY_BASE, informant: 40 },
      aiDaily: {
        ...createDefaultAiDailyCounters(),
        affinityDeltaByNpc: { innkeeper: 0, merchant: 0, informant: 18, priest: 0, caretaker: 0, artisan: 0, warden: 0 }
      }
    };
    const over = validateToolCall(
      "conversation",
      "adjust_affinity",
      { npcId: "informant", delta: 5, reason: "x" },
      ctx({ session: session({ partnerNpcId: "informant" }), persistent })
    );
    expect(reasonOf(over)).toContain("日次累積");
    // 境界: 18+2=20 は通過する(上限そのものは維持)
    const ok = validateToolCall(
      "conversation",
      "adjust_affinity",
      { npcId: "informant", delta: 2, reason: "x" },
      ctx({ session: session({ partnerNpcId: "informant" }), persistent })
    );
    expect(ok.ok).toBe(true);
  });

  it("[ATK-affinity-cross-npc] 会話相手以外の npcId を指定した adjust_affinity は越境として却下", () => {
    const r = validateToolCall(
      "conversation",
      "adjust_affinity",
      { npcId: "merchant", delta: 5, reason: "越境操作" },
      ctx({ session: session({ partnerNpcId: "innkeeper" }) })
    );
    expect(reasonOf(r)).toContain("会話相手");
  });
});

// ---------------------------------------------------------------------------
// propose_quest: 達成可能性・回数・未受諾・存在しない対象
// ---------------------------------------------------------------------------

describe("攻撃テストA: propose_quest の達成可能性・回数(第1層)", () => {
  it("[ATK-quest-unreachable-target] 達成不能クエスト(ボス夢喰いのhunt・再入手不能old-keyのfetch)は却下", () => {
    // ボス dream-eater は HUNT_TARGET_IDS 外(リスポーンしない)
    expect(
      validateToolCall("questGeneration", "propose_quest", { ...validHunt, targetId: "dream-eater" }, ctx(questSession())).ok
    ).toBe(false);
    // クエスト用アイテム old-key は FETCH_TARGET_IDS 外(再入手不能)
    const fetch = validateToolCall(
      "questGeneration",
      "propose_quest",
      { type: "fetch", targetId: "old-key", count: 1, rewardGold: 10, title: "鍵探し", description: "再入手不能な鍵を求める。" },
      ctx(questSession())
    );
    expect(fetch.ok).toBe(false);
  });

  it("[ATK-quest-nonexistent-target] 存在しない targetId のクエストは却下", () => {
    const r = validateToolCall(
      "questGeneration",
      "propose_quest",
      { ...validHunt, targetId: "phantom-beast" },
      ctx(questSession())
    );
    expect(r.ok).toBe(false);
  });

  it("[ATK-subquest-fourth] 受注枠が満杯(3件)なら4件目のサブクエスト提案は却下", () => {
    const r = validateToolCall(
      "questGeneration",
      "propose_quest",
      validHunt,
      ctx({
        session: questSession().session,
        persistent: { subQuests: [activeHuntQuest("a"), activeHuntQuest("b"), activeHuntQuest("c")] }
      })
    );
    expect(reasonOf(r)).toContain("受注枠");
  });

  it("[ATK-propose-second-pending] 未受諾提案が残っている間の2件目 propose_quest は却下", () => {
    const pending: SubQuest = { ...activeHuntQuest("pending"), status: "proposed" };
    const r = validateToolCall(
      "questGeneration",
      "propose_quest",
      validHunt,
      ctx({ session: session({ partnerNpcId: "informant", pendingProposal: pending }) })
    );
    expect(reasonOf(r)).toContain("未受諾");
  });
});

// ---------------------------------------------------------------------------
// 数量系フィールドの整数・非負制約
// ---------------------------------------------------------------------------

describe("攻撃テストA: 数量フィールドの整数・非負(第1層)", () => {
  it("[ATK-nonpositive-count] count:0・負数・quantity:0 は却下(数量は正の整数のみ)", () => {
    expect(validateToolCall("questGeneration", "propose_quest", { ...validHunt, count: 0 }, ctx(questSession())).ok).toBe(false);
    expect(validateToolCall("questGeneration", "propose_quest", { ...validHunt, count: -1 }, ctx(questSession())).ok).toBe(false);
    expect(validateToolCall("conversation", "give_item", { itemId: "potion-small", quantity: 0, reason: "x" }, ctx()).ok).toBe(false);
  });

  it("[ATK-non-integer] 非整数(quantity:2.5・count:2.5・rewardGold:55.5)は却下", () => {
    expect(validateToolCall("conversation", "give_item", { itemId: "potion-small", quantity: 2.5, reason: "x" }, ctx()).ok).toBe(false);
    expect(validateToolCall("questGeneration", "propose_quest", { ...validHunt, count: 2.5 }, ctx(questSession())).ok).toBe(false);
    expect(validateToolCall("questGeneration", "propose_quest", { ...validHunt, rewardGold: 55.5 }, ctx(questSession())).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 夢の世界イベント: 一晩の上限(3件)
// ---------------------------------------------------------------------------

describe("攻撃テストA: 世界イベントの上限(第1層)", () => {
  it("[ATK-world-event-fourth] 一晩に4件目の世界イベントは上限超過として却下(先頭3件のみ処理)", () => {
    const r = validateDreamEvents(
      [
        { kind: "weather", value: "fog" },
        { kind: "street_event", eventId: "peddler" },
        { kind: "street_event", eventId: "black-cat" },
        { kind: "street_event", eventId: "distant-bell" }
      ],
      { dungeonSymbolCounts: { 1: 4, 2: 4, 3: 4 } }
    );
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0]?.index).toBe(3);
    expect(r.effect.events).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 表示系承認0件ターンのオール・オア・ナッシング破棄
// ---------------------------------------------------------------------------

/** 有効な give_item + 出力壁違反の speak を返す悪意 DreamMaster(表示系0件を誘発) */
class DisplayZeroDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  public run(context: DreamMasterContext): Promise<DreamMasterResult> {
    return Promise.resolve({
      ok: true,
      flow: context.flow,
      toolCalls: [
        // これ単体なら検証を通る有効な贈与(承認されうる)
        { toolName: "give_item", rawInput: { itemId: "potion-small", quantity: 1, reason: "餞別" } },
        // 出力壁で却下される speak(表示系承認が0件になる)
        { toolName: "speak", rawInput: { text: "As an AI language model, I cannot comply with that request." } }
      ],
      text: null,
      meta: { mode: "mock", model: "claude-haiku-4-5" }
    });
  }
}

describe("攻撃テストA: 表示系0件ターンの破棄(第1層・第4層)", () => {
  it("[ATK-display-zero-discard] 有効give+出力壁違反speak → 定型フォールバックとなり、承認済みの give も適用されない", async () => {
    const executor = new AiTurnExecutor({ dreamMaster: new DisplayZeroDreamMaster(), config });
    const r = await executor.executeTurn({
      dmContext: { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "何かくれ" },
      persistent: persistentBase(),
      session: new ConversationSession("innkeeper", 60) // 会話開始時好感度60(give は本来解禁される)
    });

    // ターン単位オール・オア・ナッシング: 承認済みの give_item も破棄され effect ゼロ
    expect(r.approvedEffects).toHaveLength(0);
    expect(r.usedFallback).toBe(true);
    expect(r.failedTurn).toBe(true);
    expect(r.failureKind).toBe("display_approved_zero");
    // give_item 単体は検証を通って「承認」記録されるが、表示系0件のため適用されない
    const giveRec = r.toolCallRecords.find((rec) => rec.name === "give_item");
    expect(giveRec?.result).toBe("approved");
    const speakRec = r.toolCallRecords.find((rec) => rec.name === "speak");
    expect(speakRec?.result).toBe("rejected");
  });
});

// ---------------------------------------------------------------------------
// 小ヘルパー(セッション組み立て)
// ---------------------------------------------------------------------------

/** 会話セッションコンテキストを既定値から部分上書きで作る */
function session(
  overrides: Partial<NonNullable<ToolValidationContext["session"]>> = {}
): NonNullable<ToolValidationContext["session"]> {
  return {
    partnerNpcId: "innkeeper",
    affinityAtOpen: 60,
    adjustAffinityCount: 0,
    giveItemCount: 0,
    pendingProposal: null,
    ...overrides
  };
}

/** questGeneration 用に情報屋の会話セッションを持つコンテキスト断片 */
function questSession(): { session: NonNullable<ToolValidationContext["session"]> } {
  return { session: session({ partnerNpcId: "informant", affinityAtOpen: 30 }) };
}
