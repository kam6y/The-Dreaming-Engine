import {
  CONVERSATION_FALLBACK_TEXT,
  DREAM_FALLBACK_TEXT,
  SUMMARY_MAX_LENGTH,
  createDefaultAiDailyCounters,
  emptyInventory,
  initialDungeonSymbolCounts,
  type NpcId
} from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import { loadAiConfig } from "../src/ai/config.js";
import { MockDreamMaster } from "../src/ai/dream-master/index.js";
import type {
  DreamMaster,
  DreamMasterContext,
  DreamMasterResult
} from "../src/ai/dream-master/index.js";
import {
  AiTurnExecutor,
  ConversationSession,
  type AiTurnInput
} from "../src/ai/flow-control/index.js";
import type { PersistentStateContext, ToolFlow } from "../src/ai/tool-validation/index.js";

// ---------------------------------------------------------------------------
// フィクスチャ
// ---------------------------------------------------------------------------

const META = { mode: "mock" as const, model: "claude-haiku-4-5" };

function persistentBase(overrides: Partial<PersistentStateContext> = {}): PersistentStateContext {
  return {
    aiDaily: createDefaultAiDailyCounters(),
    affinityByNpc: { innkeeper: 30, merchant: 30, informant: 30, priest: 30 },
    inventory: emptyInventory(),
    subQuests: [],
    dungeonSymbolCounts: initialDungeonSymbolCounts(),
    nextQuestId: "q1",
    ...overrides
  };
}

/** スクリプト駆動の DreamMaster スタブ(呼び出し回数に応じた結果を返す) */
class StubDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  public calls = 0;
  public constructor(
    private readonly script: (call: number, ctx: DreamMasterContext) => DreamMasterResult
  ) {}
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    const result = this.script(this.calls, ctx);
    this.calls += 1;
    return Promise.resolve(result);
  }
}

function apiError(flow: ToolFlow): DreamMasterResult {
  return { ok: false, flow, failure: "api_error", meta: META };
}

function speakSuccess(flow: ToolFlow, text = "「やあ、旅人さん」"): DreamMasterResult {
  return {
    ok: true,
    flow,
    toolCalls: [{ toolName: "speak", rawInput: { text } }],
    text: null,
    meta: META
  };
}

/** speak を含まず adjust_affinity のみ(それ自体は検証を通るが表示系承認0件になる会話応答) */
function adjustOnly(flow: ToolFlow, npcId: NpcId = "innkeeper"): DreamMasterResult {
  return {
    ok: true,
    flow,
    toolCalls: [{ toolName: "adjust_affinity", rawInput: { npcId, delta: 1, reason: "打ち解けた" } }],
    text: null,
    meta: META
  };
}

/** speak + adjust_affinity(表示系承認あり=成功。状態変更を1回分だけ伴う) */
function speakAndAdjust(
  flow: ToolFlow,
  npcId: NpcId = "innkeeper",
  text = "「よく来たね、旅人さん」"
): DreamMasterResult {
  return {
    ok: true,
    flow,
    toolCalls: [
      { toolName: "speak", rawInput: { text } },
      { toolName: "adjust_affinity", rawInput: { npcId, delta: 1, reason: "打ち解けた" } }
    ],
    text: null,
    meta: META
  };
}

const config = loadAiConfig();

function newExecutor(dreamMaster: DreamMaster, cfg = config): AiTurnExecutor {
  return new AiTurnExecutor({ dreamMaster, config: cfg });
}

function conversationInput(npcId: NpcId, affinityAtOpen = 30): AiTurnInput {
  return {
    dmContext: { flow: "conversation", partnerNpcId: npcId, playerUtterance: "こんばんは" },
    persistent: persistentBase(),
    session: new ConversationSession(npcId, affinityAtOpen)
  };
}

// ---------------------------------------------------------------------------
// 成功ターンの適用
// ---------------------------------------------------------------------------

describe("AiTurnExecutor 成功ターン", () => {
  it("会話: speak を表示し adjust_affinity を承認 effect にする(GameState は変更しない)", async () => {
    const executor = newExecutor(new MockDreamMaster(config));
    const session = new ConversationSession("innkeeper", 30);
    const input: AiTurnInput = {
      dmContext: { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "こんばんは" },
      persistent: persistentBase(),
      session
    };
    const r = await executor.executeTurn(input);

    expect(r.aiInvoked).toBe(true);
    expect(r.usedFallback).toBe(false);
    expect(r.failedTurn).toBe(false);
    expect(r.displayText).toContain("よく来たね");
    expect(r.approvedEffects).toHaveLength(1);
    expect(r.approvedEffects[0]).toMatchObject({ kind: "adjust_affinity", npcId: "innkeeper", affinity: 31, delta: 1 });
    // 会話内カウンタが確定している
    expect(session.getAdjustAffinityCount()).toBe(1);
    expect(executor.getSessionCallCount()).toBe(1);
  });

  it("夢: narrate を表示し weather を dream_world_events effect にする", async () => {
    const executor = newExecutor(new MockDreamMaster(config));
    const input: AiTurnInput = {
      dmContext: { flow: "dream", recentPlay: "忘れ野を歩いた" },
      persistent: persistentBase(),
      session: null
    };
    const r = await executor.executeTurn(input);

    expect(r.failedTurn).toBe(false);
    expect(r.displayText.length).toBeGreaterThan(0);
    expect(r.approvedEffects).toHaveLength(1);
    expect(r.approvedEffects[0]).toMatchObject({ kind: "dream_world_events" });
    const eff = r.approvedEffects[0];
    if (eff.kind === "dream_world_events") {
      expect(eff.events).toContainEqual({ kind: "weather", value: "fog" });
    }
  });

  it("会話要約: 出力壁を通過した要約テキストを summaryText で返す", async () => {
    const executor = newExecutor(new MockDreamMaster(config));
    const input: AiTurnInput = {
      dmContext: { flow: "summary", partnerNpcId: "priest", existingSummary: "", exchanges: [] },
      persistent: persistentBase(),
      session: null
    };
    const r = await executor.executeTurn(input);

    expect(r.failedTurn).toBe(false);
    expect(r.summaryText).not.toBeNull();
    expect(r.summaryText?.length).toBeGreaterThan(0);
    expect(r.approvedEffects).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// リトライ
// ---------------------------------------------------------------------------

describe("AiTurnExecutor リトライ", () => {
  it("初回タイムアウト/APIエラーで1回だけリトライし、成功すれば適用する", async () => {
    const stub = new StubDreamMaster((call, ctx) =>
      call === 0 ? apiError(ctx.flow) : speakSuccess(ctx.flow)
    );
    const executor = newExecutor(stub);
    const r = await executor.executeTurn(conversationInput("innkeeper"));

    expect(stub.calls).toBe(2); // 初回 + リトライ
    expect(executor.getSessionCallCount()).toBe(2);
    expect(r.failedTurn).toBe(false);
    expect(r.usedFallback).toBe(false);
    expect(r.displayText).toContain("旅人");
    expect(executor.getConsecutiveFailures("conversation")).toBe(0);
  });

  it("初回+リトライの両方が失敗して初めて1失敗(トリガー単位)", async () => {
    const stub = new StubDreamMaster((_call, ctx) => apiError(ctx.flow));
    const executor = newExecutor(stub);
    const r = await executor.executeTurn(conversationInput("innkeeper"));

    expect(stub.calls).toBe(2);
    expect(r.failedTurn).toBe(true);
    expect(r.failureKind).toBe("api_error");
    expect(r.usedFallback).toBe(true);
    expect(r.displayText).toBe(CONVERSATION_FALLBACK_TEXT);
    expect(executor.getConsecutiveFailures("conversation")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 表示系承認0件 → オール・オア・ナッシング
// ---------------------------------------------------------------------------

describe("AiTurnExecutor 表示系承認0件", () => {
  it("会話: 状態変更のみ承認・表示系0件なら状態変更も破棄しフォールバック+1失敗", async () => {
    // speak を含まず adjust_affinity のみ(それ自体は検証を通る)
    const stub = new StubDreamMaster((_call, ctx) => ({
      ok: true,
      flow: ctx.flow,
      toolCalls: [
        {
          toolName: "adjust_affinity",
          rawInput: { npcId: "innkeeper", delta: 1, reason: "打ち解けた" }
        }
      ],
      text: null,
      meta: META
    }));
    const executor = newExecutor(stub);
    const session = new ConversationSession("innkeeper", 30);
    const r = await executor.executeTurn({
      dmContext: { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "やあ" },
      persistent: persistentBase(),
      session
    });

    expect(r.failedTurn).toBe(true);
    expect(r.failureKind).toBe("display_approved_zero");
    expect(r.usedFallback).toBe(true);
    expect(r.approvedEffects).toHaveLength(0); // 承認済み adjust も破棄
    expect(r.displayText).toBe(CONVERSATION_FALLBACK_TEXT);
    // 破棄されたので会話内カウンタは進めない
    expect(session.getAdjustAffinityCount()).toBe(0);
    expect(executor.getConsecutiveFailures("conversation")).toBe(1);
  });

  it("夢: narrate 却下(悪意モード)で世界変化なし・フォールバック+1失敗", async () => {
    const executor = newExecutor(new MockDreamMaster(config, { malicious: true }));
    const r = await executor.executeTurn({
      dmContext: { flow: "dream", recentPlay: "" },
      persistent: persistentBase(),
      session: null
    });

    expect(r.failedTurn).toBe(true);
    expect(r.failureKind).toBe("display_approved_zero");
    expect(r.approvedEffects).toHaveLength(0); // 世界変化なし
    expect(r.displayText).toBe(DREAM_FALLBACK_TEXT);
  });

  it("状態変更ツールだけ却下・表示系は承認 → 発話は表示し、効果は承認分のみ", async () => {
    // speak(承認) + adjust(delta 100=範囲外で却下)
    const stub = new StubDreamMaster((_call, ctx) => ({
      ok: true,
      flow: ctx.flow,
      toolCalls: [
        { toolName: "speak", rawInput: { text: "「よく来たね、旅人さん」" } },
        { toolName: "adjust_affinity", rawInput: { npcId: "innkeeper", delta: 100, reason: "暴騰" } }
      ],
      text: null,
      meta: META
    }));
    const executor = newExecutor(stub);
    const r = await executor.executeTurn(conversationInput("innkeeper"));

    expect(r.failedTurn).toBe(false);
    expect(r.usedFallback).toBe(false);
    expect(r.displayText).toContain("よく来たね");
    expect(r.approvedEffects).toHaveLength(0); // adjust は却下=効果なし
    const rejected = r.toolCallRecords.filter((rec) => rec.result === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.name).toBe("adjust_affinity");
  });
});

// ---------------------------------------------------------------------------
// 表示系承認0件のリトライ(display_approved_zero もリトライ1回の対象)
// ---------------------------------------------------------------------------

describe("AiTurnExecutor 表示系0件リトライ", () => {
  it("表示系0件 → リトライで成功 → 通常成功・失敗カウント0・aiInvoked=true", async () => {
    const stub = new StubDreamMaster((call, ctx) =>
      call === 0 ? adjustOnly(ctx.flow) : speakSuccess(ctx.flow)
    );
    const executor = newExecutor(stub);
    const session = new ConversationSession("innkeeper", 30);
    const r = await executor.executeTurn({
      dmContext: { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "やあ" },
      persistent: persistentBase(),
      session
    });

    expect(stub.calls).toBe(2); // 初回(表示系0件) + リトライ(成功)
    expect(r.aiInvoked).toBe(true);
    expect(r.failedTurn).toBe(false);
    expect(r.usedFallback).toBe(false);
    expect(r.displayText).toContain("旅人");
    expect(executor.getConsecutiveFailures("conversation")).toBe(0);
  });

  it("表示系0件 → リトライも表示系0件 → 1失敗(display_approved_zero)・フォールバック", async () => {
    const stub = new StubDreamMaster((_call, ctx) => adjustOnly(ctx.flow));
    const executor = newExecutor(stub);
    const session = new ConversationSession("innkeeper", 30);
    const r = await executor.executeTurn({
      dmContext: { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "やあ" },
      persistent: persistentBase(),
      session
    });

    expect(stub.calls).toBe(2); // 初回 + リトライの両方が表示系0件
    expect(r.failedTurn).toBe(true);
    expect(r.failureKind).toBe("display_approved_zero");
    expect(r.usedFallback).toBe(true);
    expect(r.displayText).toBe(CONVERSATION_FALLBACK_TEXT);
    expect(r.approvedEffects).toHaveLength(0);
    // 破棄されたので会話内カウンタは進めない
    expect(session.getAdjustAffinityCount()).toBe(0);
    expect(executor.getConsecutiveFailures("conversation")).toBe(1);
  });

  it("timeout → リトライで成功したが表示系0件 → そのまま確定(3回目は呼ばない)", async () => {
    const stub = new StubDreamMaster((call, ctx) =>
      call === 0 ? apiError(ctx.flow) : adjustOnly(ctx.flow)
    );
    const executor = newExecutor(stub);
    const session = new ConversationSession("innkeeper", 30);
    const r = await executor.executeTurn({
      dmContext: { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "やあ" },
      persistent: persistentBase(),
      session
    });

    // 1トリガーにつきリトライは最大1回: 初回timeout + リトライ0件で確定。3回目は無い
    expect(stub.calls).toBe(2);
    expect(r.failedTurn).toBe(true);
    expect(r.failureKind).toBe("display_approved_zero");
    expect(r.usedFallback).toBe(true);
    expect(executor.getConsecutiveFailures("conversation")).toBe(1);
  });

  it("summary: 出力壁却下はリトライしない(表示系0件リトライの非適用・既存挙動の回帰)", async () => {
    const longText = "あ".repeat(SUMMARY_MAX_LENGTH + 50); // 出力壁の文字数上限を超過
    const stub = new StubDreamMaster((_call, ctx) => ({
      ok: true,
      flow: ctx.flow,
      toolCalls: [],
      text: longText,
      meta: META
    }));
    const executor = newExecutor(stub);
    const r = await executor.executeTurn({
      dmContext: { flow: "summary", partnerNpcId: "priest", existingSummary: "", exchanges: [] },
      persistent: persistentBase(),
      session: null
    });

    expect(stub.calls).toBe(1); // 出力壁却下はリトライ対象外
    expect(r.failedTurn).toBe(true);
    expect(r.failureKind).toBe("output_wall_rejected");
    expect(r.summaryText).toBeNull();
    expect(executor.getConsecutiveFailures("summary")).toBe(1);
  });

  it("リトライ時にセッション/永続カウンタが二重適用されない(0件試行のadjustは漏れない)", async () => {
    // 初回: adjust のみ(表示系0件で破棄) → リトライ: speak+adjust(成功)
    const stub = new StubDreamMaster((call, ctx) =>
      call === 0 ? adjustOnly(ctx.flow) : speakAndAdjust(ctx.flow)
    );
    const executor = newExecutor(stub);
    const session = new ConversationSession("innkeeper", 30);
    const r = await executor.executeTurn({
      dmContext: { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "やあ" },
      persistent: persistentBase(),
      session
    });

    expect(stub.calls).toBe(2);
    expect(r.failedTurn).toBe(false);
    // 好感度変化はリトライ成功分の1回のみ(初回0件試行の adjust は commit されず漏れない)
    expect(r.approvedEffects).toHaveLength(1);
    expect(r.approvedEffects[0]).toMatchObject({
      kind: "adjust_affinity",
      npcId: "innkeeper",
      delta: 1,
      affinity: 31
    });
    expect(session.getAdjustAffinityCount()).toBe(1);
    expect(executor.getSessionCallCount()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 縮退状態機械
// ---------------------------------------------------------------------------

describe("AiTurnExecutor 縮退", () => {
  it("3連続失敗で縮退発動し、以降は全フローを定型化(AIを呼ばない)", async () => {
    const stub = new StubDreamMaster((_call, ctx) => apiError(ctx.flow));
    const executor = newExecutor(stub);

    const r1 = await executor.executeTurn(conversationInput("innkeeper"));
    expect(r1.degradationActivated).toBeNull();
    expect(executor.getConsecutiveFailures("conversation")).toBe(1);

    const r2 = await executor.executeTurn(conversationInput("innkeeper"));
    expect(r2.degradationActivated).toBeNull();
    expect(executor.getConsecutiveFailures("conversation")).toBe(2);

    const r3 = await executor.executeTurn(conversationInput("innkeeper"));
    expect(r3.degradationActivated).toBe("consecutive_failures");
    expect(executor.isNormalDegraded()).toBe(true);
    // 発動時に連続失敗カウントは0へ
    expect(executor.getConsecutiveFailures("conversation")).toBe(0);

    // 縮退後: 別フローもAIを呼ばず定型化
    const callsBefore = stub.calls;
    const r4 = await executor.executeTurn({
      dmContext: { flow: "dream", recentPlay: "" },
      persistent: persistentBase(),
      session: null
    });
    expect(r4.aiInvoked).toBe(false);
    expect(r4.usedFallback).toBe(true);
    expect(r4.failedTurn).toBe(false); // AIを呼ばないブロックは失敗に数えない
    expect(stub.calls).toBe(callsBefore); // 呼び出していない
  });

  it("成功(リトライ成功含む)で連続失敗カウントが0に戻る", async () => {
    const stub = new StubDreamMaster((call, ctx) => (call < 2 ? apiError(ctx.flow) : speakSuccess(ctx.flow)));
    const executor = newExecutor(stub);

    await executor.executeTurn(conversationInput("innkeeper")); // 失敗1
    expect(executor.getConsecutiveFailures("conversation")).toBe(1);
    const r = await executor.executeTurn(conversationInput("innkeeper")); // 成功
    expect(r.failedTurn).toBe(false);
    expect(executor.getConsecutiveFailures("conversation")).toBe(0);
  });

  it("clearNormalDegradation は通常縮退のみ解除し、連続カウントを0へ", async () => {
    const stub = new StubDreamMaster((_call, ctx) => apiError(ctx.flow));
    const executor = newExecutor(stub);
    for (let i = 0; i < 3; i += 1) await executor.executeTurn(conversationInput("innkeeper"));
    expect(executor.isNormalDegraded()).toBe(true);

    const cleared = executor.clearNormalDegradation();
    expect(cleared).toBe(true);
    expect(executor.isNormalDegraded()).toBe(false);
    expect(executor.isDegraded()).toBe(false);
    // 二重解除は false
    expect(executor.clearNormalDegradation()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// セッション総数上限
// ---------------------------------------------------------------------------

describe("AiTurnExecutor セッション総数上限", () => {
  it("上限超過で全フローを縮退し、AIを呼ばない(失敗に数えない)", async () => {
    const cfg = loadAiConfig({ sessionCallLimit: 2 });
    const mock = new MockDreamMaster(cfg);
    const executor = newExecutor(mock, cfg);

    const r1 = await executor.executeTurn(conversationInput("innkeeper"));
    expect(r1.aiInvoked).toBe(true);
    const r2 = await executor.executeTurn(conversationInput("innkeeper"));
    expect(r2.aiInvoked).toBe(true);
    expect(executor.getSessionCallCount()).toBe(2);

    // 3回目: 上限に達しているのでブロック → セッション上限縮退
    const r3 = await executor.executeTurn(conversationInput("innkeeper"));
    expect(r3.aiInvoked).toBe(false);
    expect(r3.usedFallback).toBe(true);
    expect(r3.failedTurn).toBe(false);
    expect(r3.degradationActivated).toBe("session_limit");
    expect(executor.isSessionLimitDegraded()).toBe(true);
    expect(executor.getSessionCallCount()).toBe(2); // ブロックは加算しない

    // 別フローも縮退(AIを呼ばない)
    const r4 = await executor.executeTurn({
      dmContext: { flow: "dream", recentPlay: "" },
      persistent: persistentBase(),
      session: null
    });
    expect(r4.aiInvoked).toBe(false);
    expect(r4.degradationActivated).toBeNull(); // 既に縮退中(再発動ではない)

    // 通常縮退の解除ではセッション上限縮退は解けない
    expect(executor.clearNormalDegradation()).toBe(false);
    expect(executor.isSessionLimitDegraded()).toBe(true);
  });
});
