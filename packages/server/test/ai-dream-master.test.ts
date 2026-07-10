import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  createDefaultAiDailyCounters,
  DELIVER_PARCEL_IDS,
  DELIVER_RECIPIENT_IDS,
  emptyInventory,
  ESCORT_DESTINATION_IDS,
  FETCH_TARGET_IDS,
  HUNT_TARGET_IDS,
  isGiftableItem,
  SURVEY_TARGET_IDS,
  type NpcId
} from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import { loadAiConfig } from "../src/ai/config.js";
import { OAUTH_TOKEN_ENV } from "../src/ai/auth.js";
import {
  buildPrompt,
  createDreamMaster,
  createLiveDreamMaster,
  FLOW_DIVISION,
  FLOW_MODEL_TIER,
  FLOW_THINKING_DISABLED,
  MockDreamMaster,
  resolveFlowSpec,
  type DreamMasterContext,
  type DreamMasterResult,
  type DreamMasterSuccess,
  type QueryFn,
  type RawToolCall,
  type SdkMessageLike
} from "../src/ai/dream-master/index.js";
import { checkDisplayText } from "../src/ai/output-wall.js";
import {
  FLOW_TOOL_ALLOWLIST,
  validateAdjustAffinity,
  validateGiveItem,
  validateNarrate,
  validateProposeQuest,
  validateSpeak,
  validateToolCall,
  validateWorldEvent,
  type ToolValidationContext
} from "../src/ai/tool-validation/index.js";

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

const config = loadAiConfig();

/** ok を絞って success を取り出す(failure なら失敗させる) */
function successOf(result: DreamMasterResult): DreamMasterSuccess {
  if (!result.ok) throw new Error(`expected success, got failure: ${result.failure}`);
  return result;
}

/** 指定ツール名の生の意図をすべて取り出す */
function callsOf(result: DreamMasterSuccess, toolName: RawToolCall["toolName"]): RawToolCall[] {
  return result.toolCalls.filter((call) => call.toolName === toolName);
}

/** 指定ツール名の生の意図を1件だけ取り出す(0件/複数件は失敗させる) */
function oneCallOf(result: DreamMasterSuccess, toolName: RawToolCall["toolName"]): RawToolCall {
  const calls = callsOf(result, toolName);
  if (calls.length !== 1) throw new Error(`expected exactly 1 ${toolName}, got ${calls.length}`);
  const [call] = calls;
  if (call === undefined) throw new Error("unreachable");
  return call;
}

/** dispatch の許可集合チェック用の最小 ToolValidationContext(会話セッションあり) */
function makeCtx(partnerNpcId: NpcId = "innkeeper"): ToolValidationContext {
  const affinityByNpc: Record<NpcId, number> = {
    innkeeper: 30,
    merchant: 30,
    informant: 30,
    priest: 30,
    caretaker: 30,
    artisan: 30,
    warden: 30
  };
  return {
    session: {
      partnerNpcId,
      affinityAtOpen: 30,
      adjustAffinityCount: 0,
      giveItemCount: 0,
      pendingProposal: null
    },
    persistent: {
      aiDaily: createDefaultAiDailyCounters(),
      affinityByNpc,
      inventory: emptyInventory(),
      subQuests: [],
      dungeonSymbolCounts: { 1: 4, 2: 4, 3: 4 },
      nextQuestId: "q-test"
    }
  };
}

const conversationCtx: DreamMasterContext = {
  flow: "conversation",
  partnerNpcId: "innkeeper",
  playerUtterance: "こんにちは"
};
const questGenCtx: DreamMasterContext = { flow: "questGeneration", partnerNpcId: "informant" };
const dreamCtx: DreamMasterContext = { flow: "dream", recentPlay: "忘れ野で霧狼を2体倒した" };
const summaryCtx: DreamMasterContext = {
  flow: "summary",
  partnerNpcId: "innkeeper",
  existingSummary: "",
  exchanges: []
};

// ---------------------------------------------------------------------------
// buildPrompt: <quest_targets> に全型の実在ホワイトリスト候補が並ぶ(M19-4)
// live AI が deliver/escort/survey を提案できるよう、候補IDと入力スキーマを列挙する。
// ---------------------------------------------------------------------------

describe("buildPrompt questGeneration の <quest_targets>", () => {
  const { userPrompt } = buildPrompt(questGenCtx);

  it("既存 hunt/fetch 候補は不変(追加のみ・回帰防止)", () => {
    expect(userPrompt).toContain("<quest_targets>");
    expect(userPrompt).toContain("討伐対象(hunt):");
    expect(userPrompt).toContain("納品対象(fetch):");
    for (const id of HUNT_TARGET_IDS) expect(userPrompt).toContain(`(${id})`);
    for (const id of FETCH_TARGET_IDS) expect(userPrompt).toContain(`(${id})`);
  });

  it("deliver の預かり品・受取NPC候補IDが列挙され、フィールド名が示される", () => {
    expect(userPrompt).toContain("配達対象(deliver):");
    expect(userPrompt).toContain("parcelId=");
    expect(userPrompt).toContain("recipientId=");
    for (const id of DELIVER_PARCEL_IDS) expect(userPrompt).toContain(`(${id})`);
    for (const id of DELIVER_RECIPIENT_IDS) expect(userPrompt).toContain(`(${id})`);
    // 受注元カイ(informant)は配達先ホワイトリストに無いので候補に現れない
    expect(userPrompt).not.toContain("(informant)");
  });

  it("escort の目的地候補IDが destinationId として列挙される", () => {
    expect(userPrompt).toContain("護送目的地(escort):");
    expect(userPrompt).toContain("destinationId=");
    for (const id of ESCORT_DESTINATION_IDS) expect(userPrompt).toContain(`(${id})`);
  });

  it("survey の調査対象候補IDが targetId として列挙される", () => {
    expect(userPrompt).toContain("調査対象(survey):");
    for (const id of SURVEY_TARGET_IDS) expect(userPrompt).toContain(`(${id})`);
  });

  it("escort/survey は count=1固定である旨が明示される", () => {
    expect(userPrompt).toContain("escort/survey は1固定");
    expect(userPrompt).toContain("count≠1 は却下");
  });
});

// ---------------------------------------------------------------------------
// resolveFlowSpec: config と FLOW_TOOL_ALLOWLIST から実行仕様を引く(ハードコードしない)
// ---------------------------------------------------------------------------

describe("resolveFlowSpec", () => {
  it("conversation は haiku・会話区分・conversation の許可集合/タイムアウトを引く", () => {
    const spec = resolveFlowSpec("conversation", config);
    expect(spec.model).toBe(config.models.haiku);
    expect(spec.allowedTools).toEqual(FLOW_TOOL_ALLOWLIST.conversation);
    expect(spec.timeout).toEqual(config.timeouts.conversation);
    expect(spec.limits).toEqual(config.limits.conversation);
  });

  it("dream は sonnet・GM区分・dream の許可集合/タイムアウトを引く", () => {
    const spec = resolveFlowSpec("dream", config);
    expect(spec.model).toBe(config.models.sonnet);
    expect(spec.allowedTools).toEqual(FLOW_TOOL_ALLOWLIST.dream);
    expect(spec.timeout).toEqual(config.timeouts.dream);
    expect(spec.limits).toEqual(config.limits.gm);
  });

  it("questGeneration は sonnet・GM区分", () => {
    const spec = resolveFlowSpec("questGeneration", config);
    expect(spec.model).toBe(config.models.sonnet);
    expect(spec.limits).toEqual(config.limits.gm);
  });

  it("summary はツールなし(空集合)・haiku・会話区分", () => {
    const spec = resolveFlowSpec("summary", config);
    expect(spec.allowedTools).toEqual([]);
    expect(spec.model).toBe(config.models.haiku);
    expect(spec.limits).toEqual(config.limits.conversation);
  });

  it("フロー→区分マップは全5フローを網羅する", () => {
    expect(Object.keys(FLOW_MODEL_TIER).sort()).toEqual(
      ["battleResult", "conversation", "dream", "questGeneration", "summary"].sort()
    );
    expect(Object.keys(FLOW_DIVISION).sort()).toEqual(Object.keys(FLOW_MODEL_TIER).sort());
    expect(Object.keys(FLOW_THINKING_DISABLED).sort()).toEqual(Object.keys(FLOW_MODEL_TIER).sort());
  });

  it("thinking 無効化はリアルタイム待ちフロー(会話・依頼提案・戦果)のみ true", () => {
    expect(resolveFlowSpec("conversation", config).thinkingDisabled).toBe(true);
    expect(resolveFlowSpec("questGeneration", config).thinkingDisabled).toBe(true);
    expect(resolveFlowSpec("battleResult", config).thinkingDisabled).toBe(true);
    // 裏方GM処理は品質優先で思考を維持(false)
    expect(resolveFlowSpec("dream", config).thinkingDisabled).toBe(false);
    expect(resolveFlowSpec("summary", config).thinkingDisabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ファクトリ: mock→MockDreamMaster / live→プレースホルダエラー
// ---------------------------------------------------------------------------

describe("createDreamMaster ファクトリ / LiveDreamMaster 構築", () => {
  it("mock は MockDreamMaster を返す", () => {
    const dm = createDreamMaster("mock", config);
    expect(dm).toBeInstanceOf(MockDreamMaster);
    expect(dm.mode).toBe("mock");
  });

  it("live: 資格情報ありで LiveDreamMaster を構築する(構築時に query は呼ばない)", () => {
    let called = 0;
    const fakeQuery: QueryFn = (): AsyncIterable<SdkMessageLike> => {
      called += 1;
      return (async function* (): AsyncGenerator<SdkMessageLike> {})();
    };
    const dm = createLiveDreamMaster({
      config,
      env: { [OAUTH_TOKEN_ENV]: "dummy-oauth-present" },
      query: fakeQuery
    });
    expect(dm.mode).toBe("live");
    // 実AI呼び出しは run 実行時のみ。構築では query を一切呼ばない。
    expect(called).toBe(0);
  });

  it("live: 資格情報が無ければ構築時に認証エラー(値は出さない)", () => {
    expect(() => createLiveDreamMaster({ config, env: {} })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// MockDreamMaster 通常モード: 各フローが検証を通る生の意図列を返す
// ---------------------------------------------------------------------------

describe("MockDreamMaster 通常モード", () => {
  const dm = new MockDreamMaster(config);

  it("conversation: speak(有効)+ 軽微な adjust_affinity(会話相手・範囲内)を返す", async () => {
    const result = successOf(await dm.run(conversationCtx));
    expect(result.flow).toBe("conversation");
    expect(result.text).toBeNull();
    expect(result.meta).toEqual({ mode: "mock", model: config.models.haiku });

    const speak = oneCallOf(result, "speak");
    expect(validateSpeak(speak.rawInput).ok).toBe(true);

    const adjust = oneCallOf(result, "adjust_affinity");
    const adjustResult = validateAdjustAffinity(adjust.rawInput, {
      partnerNpcId: "innkeeper",
      adjustAffinityCount: 0,
      dailyAffinityDelta: 0,
      currentAffinity: 30
    });
    expect(adjustResult.ok).toBe(true);
    if (adjustResult.ok) {
      expect(adjustResult.effect.npcId).toBe("innkeeper");
      expect(adjustResult.effect.delta).toBe(1);
    }
  });

  it("questGeneration: speak + propose_quest(実在 HuntTargetId・検証通過)を返す", async () => {
    const result = successOf(await dm.run(questGenCtx));
    expect(result.meta.model).toBe(config.models.sonnet);
    expect(callsOf(result, "speak")).toHaveLength(1);

    const propose = oneCallOf(result, "propose_quest");
    const proposeResult = validateProposeQuest(propose.rawInput, {
      subQuests: [],
      pendingProposal: null,
      proposeQuestCount: 0,
      rewardItemProposalCount: 0,
      questId: "q-test"
    });
    expect(proposeResult.ok).toBe(true);
    if (proposeResult.ok) {
      expect(proposeResult.effect.quest.type).toBe("hunt");
      expect(proposeResult.effect.quest.targetId).toBe("mist-wolf");
      expect(proposeResult.effect.quest.status).toBe("proposed");
    }
  });

  it("dream: 必ず narrate + trigger_world_event(weather: fog)を返す(仕様327-330)", async () => {
    const result = successOf(await dm.run(dreamCtx));

    const narrate = oneCallOf(result, "narrate");
    expect(validateNarrate(narrate.rawInput).ok).toBe(true);

    const event = oneCallOf(result, "trigger_world_event");
    const eventResult = validateWorldEvent(event.rawInput, {
      dungeonSymbolCounts: { 1: 4, 2: 4, 3: 4 }
    });
    expect(eventResult.ok).toBe(true);
    if (eventResult.ok && eventResult.effect.event.kind === "weather") {
      expect(eventResult.effect.event.value).toBe("fog");
    } else {
      throw new Error("dream は weather イベントを含むべき");
    }
  });

  it("battleResult: narrate のみ(初見敵の戦果描写。敵別に決定論的)", async () => {
    const wolf = successOf(await dm.run({ flow: "battleResult", enemyId: "mist-wolf" }));
    expect(wolf.toolCalls).toHaveLength(1);
    const wolfNarrate = oneCallOf(wolf, "narrate");
    expect(validateNarrate(wolfNarrate.rawInput).ok).toBe(true);
    expect(wolf.meta.model).toBe(config.models.haiku);

    const candle = successOf(await dm.run({ flow: "battleResult", enemyId: "candle-eater" }));
    const candleNarrate = oneCallOf(candle, "narrate");
    // 敵別に異なる描写(決定論的だが敵ごとに差がある)
    expect(candleNarrate.rawInput).not.toEqual(wolfNarrate.rawInput);
  });

  it("summary: ツールなし・テキストのみ(出力壁を通過する)", async () => {
    const result = successOf(await dm.run(summaryCtx));
    expect(result.toolCalls).toEqual([]);
    expect(result.text).not.toBeNull();
    const text = result.text ?? "";
    expect(checkDisplayText(text, { maxLength: 200 }).ok).toBe(true);
    // 会話相手名(オルガ)を織り込む
    expect(text).toContain("オルガ");
  });

  it("決定論的: 同一フロー・同一入力で安定した出力を返す", async () => {
    const a = await dm.run(conversationCtx);
    const b = await dm.run(conversationCtx);
    expect(a).toEqual(b);
  });

  it("mock 経路のソースは Agent SDK を import しない(live.ts のみが SDK 境界)", () => {
    // mock 実装本体(mock.ts)と、共有の型/仕様/プロンプト/憲法は SDK を import しない。
    // factory/index は live.ts を相対参照するのみで、SDK リテラルを含まない。
    const nonSdkFiles = [
      "types.ts",
      "flow-spec.ts",
      "constitution.ts",
      "prompt.ts",
      "mock.ts",
      "factory.ts",
      "index.ts"
    ];
    for (const file of nonSdkFiles) {
      const src = readFileSync(
        fileURLToPath(new URL(`../src/ai/dream-master/${file}`, import.meta.url)),
        "utf8"
      );
      expect(src, `${file} は Agent SDK を import しないこと`).not.toContain("@anthropic-ai");
    }
    // live.ts は唯一の SDK 境界(実AI呼び出しは run 実行時のみ)。
    const liveSrc = readFileSync(
      fileURLToPath(new URL("../src/ai/dream-master/live.ts", import.meta.url)),
      "utf8"
    );
    expect(liveSrc).toContain("@anthropic-ai/claude-agent-sdk");
  });
});

// ---------------------------------------------------------------------------
// MockDreamMaster 悪意モード: 各種の違反意図を出せる(検証層が却下する素材)
// ---------------------------------------------------------------------------

describe("MockDreamMaster 悪意モード", () => {
  const dm = new MockDreamMaster(config, { malicious: true });

  it("conversation: ホワイトリスト外アイテム・範囲外delta・フロー非許可ツールの違反意図を出す", async () => {
    const result = successOf(await dm.run(conversationCtx));

    // ホワイトリスト外アイテム(old-key)+ 数量超過 → 検証却下される素材
    const give = oneCallOf(result, "give_item");
    const giveInput = give.rawInput as { itemId: string };
    expect(isGiftableItem(giveInput.itemId)).toBe(false);
    expect(validateGiveItem(give.rawInput, {
      affinityAtOpen: 50,
      inventory: emptyInventory(),
      giveItemCountInConversation: 0,
      giveItemCountToday: 0
    }).ok).toBe(false);

    // delta 範囲外 → 却下
    const adjust = oneCallOf(result, "adjust_affinity");
    expect(validateAdjustAffinity(adjust.rawInput, {
      partnerNpcId: "innkeeper",
      adjustAffinityCount: 0,
      dailyAffinityDelta: 0,
      currentAffinity: 30
    }).ok).toBe(false);

    // 現在フロー非許可ツール(trigger_world_event は conversation で不許可)→ 許可集合の二重チェックで却下
    const crossFlow = oneCallOf(result, "trigger_world_event");
    const dispatched = validateToolCall("conversation", "trigger_world_event", crossFlow.rawInput, makeCtx());
    expect(dispatched.ok).toBe(false);
  });

  it("questGeneration: ボス対象・ホワイトリスト外・混成・count>1 の propose_quest 違反意図を出す(全却下)", async () => {
    // 悪意モードの questGeneration は hunt(ボス)+ 新3型(deliver 受注元/escort count>1/survey 除外対象)
    // + 型偽装の混成、いずれも検証層で却下されるべき生の違反意図を出す(M19)。
    const result = successOf(await dm.run(questGenCtx));
    const proposes = callsOf(result, "propose_quest");
    expect(proposes.length).toBeGreaterThanOrEqual(5);
    for (const propose of proposes) {
      expect(
        validateProposeQuest(propose.rawInput, {
          subQuests: [],
          pendingProposal: null,
          proposeQuestCount: 0,
          rewardItemProposalCount: 0,
          questId: "q-test"
        }).ok
      ).toBe(false);
    }
  });

  it("dream: 出力壁逸脱の narrate と上限超過 rumor の違反意図を出す", async () => {
    const result = successOf(await dm.run(dreamCtx));
    const narrate = oneCallOf(result, "narrate");
    expect(validateNarrate(narrate.rawInput).ok).toBe(false);

    const event = oneCallOf(result, "trigger_world_event");
    expect(validateWorldEvent(event.rawInput, { dungeonSymbolCounts: { 1: 4, 2: 4, 3: 4 } }).ok).toBe(false);
  });

  it("battleResult: 出力壁逸脱 narrate と フロー非許可ツール(adjust_affinity)の違反意図を出す", async () => {
    const result = successOf(await dm.run({ flow: "battleResult", enemyId: "mist-wolf" }));
    const narrate = oneCallOf(result, "narrate");
    expect(validateNarrate(narrate.rawInput).ok).toBe(false);

    const crossFlow = oneCallOf(result, "adjust_affinity");
    const dispatched = validateToolCall("battleResult", "adjust_affinity", crossFlow.rawInput, makeCtx());
    expect(dispatched.ok).toBe(false);
  });

  it("summary: 出力壁逸脱テキストと フロー非許可ツール(speak)の違反意図を出す", async () => {
    const result = successOf(await dm.run(summaryCtx));
    const text = result.text ?? "";
    expect(checkDisplayText(text, { maxLength: 200 }).ok).toBe(false);

    const crossFlow = oneCallOf(result, "speak");
    const dispatched = validateToolCall("summary", "speak", crossFlow.rawInput, makeCtx());
    expect(dispatched.ok).toBe(false);
  });
});
