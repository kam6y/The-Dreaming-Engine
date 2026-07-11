import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BATTLE_RESULT_FALLBACK_TEXT,
  CONVERSATION_BUSY_TEXT,
  DREAM_FALLBACK_TEXT,
  NPC_COOLDOWN_GREETING,
  QUEST_SLOTS_FULL_FALLBACK_TEXT,
  createDefaultAiDailyCounters,
  emptyInventory,
  initialDungeonSymbolCounts,
  type SubQuest
} from "@dreaming-engine/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuditLog } from "../src/ai/audit-log.js";
import { loadAiConfig, type AiConfig, type DeepPartial } from "../src/ai/config.js";
import { MockDreamMaster } from "../src/ai/dream-master/index.js";
import type {
  DreamMaster,
  DreamMasterContext,
  DreamMasterResult
} from "../src/ai/dream-master/index.js";
import { AiFlowGatekeeper, AiTurnExecutor } from "../src/ai/flow-control/index.js";
import { RateLimiter } from "../src/ai/rate-limit.js";
import type { PersistentStateContext } from "../src/ai/tool-validation/index.js";

const META = { mode: "mock" as const, model: "claude-haiku-4-5" };

function persistentBase(overrides: Partial<PersistentStateContext> = {}): PersistentStateContext {
  return {
    aiDaily: createDefaultAiDailyCounters(),
    affinityByNpc: { innkeeper: 30, merchant: 30, informant: 30, priest: 30, caretaker: 30, artisan: 30, warden: 30 },
    inventory: emptyInventory(),
    subQuests: [],
    dungeonSymbolCounts: initialDungeonSymbolCounts(),
    dreamErosion: 0,
    nextQuestId: "q1",
    ...overrides
  };
}

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

/** 常に api_error を返す DreamMaster */
class FailingDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    return Promise.resolve({ ok: false, flow: ctx.flow, failure: "api_error", meta: META });
  }
}

/** 成功するがツールを1つも呼ばない DreamMaster(実プレイの失敗インシデント再現用) */
class ToollessSuccessDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    return Promise.resolve({ ok: true, flow: ctx.flow, toolCalls: [], text: null, meta: META });
  }
}

/** 応答を任意のタイミングで解決できる DreamMaster(直列化テスト用) */
class DeferredDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  private pending: { resolve: (r: DreamMasterResult) => void; ctx: DreamMasterContext }[] = [];
  public constructor(private readonly resultFor: (ctx: DreamMasterContext) => DreamMasterResult) {}
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    return new Promise((resolve) => {
      this.pending.push({ resolve, ctx });
    });
  }
  /** 最も古い未解決の run を解決する */
  public flush(): void {
    const next = this.pending.shift();
    if (next) next.resolve(this.resultFor(next.ctx));
  }
}

function speakSuccess(ctx: DreamMasterContext): DreamMasterResult {
  return {
    ok: true,
    flow: ctx.flow,
    toolCalls: [{ toolName: "speak", rawInput: { text: "「やあ、旅人さん」" } }],
    text: null,
    meta: META
  };
}

function summaryOrSpeak(ctx: DreamMasterContext): DreamMasterResult {
  if (ctx.flow === "summary") {
    return { ok: true, flow: "summary", toolCalls: [], text: "旅人と穏やかに語り合った。", meta: META };
  }
  return speakSuccess(ctx);
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("AiFlowGatekeeper", () => {
  let dir = "";
  let clockMs = 0;
  let auditLog: AuditLog;

  const readLines = (): Record<string, unknown>[] =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .flatMap((f) =>
        readFileSync(path.join(dir, f), "utf8")
          .split("\n")
          .filter((l) => l.length > 0)
          .map((l) => JSON.parse(l) as Record<string, unknown>)
      );

  const boundaryLines = (): Record<string, unknown>[] => {
    auditLog.flush();
    return readLines().filter((l) => l.type === "boundary");
  };

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "de-gk-"));
    clockMs = 0;
    auditLog = new AuditLog({ dir, now: () => new Date(clockMs), maskEnv: {} });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function makeGatekeeper(
    dreamMaster: DreamMaster,
    overrides?: DeepPartial<AiConfig>
  ): { gk: AiFlowGatekeeper; executor: AiTurnExecutor; config: AiConfig } {
    const config = loadAiConfig(overrides);
    const executor = new AiTurnExecutor({ dreamMaster, config });
    const gk = new AiFlowGatekeeper({
      executor,
      config,
      rateLimiter: new RateLimiter(() => clockMs),
      auditLog,
      now: () => clockMs
    });
    return { gk, executor, config };
  }

  // -------------------------------------------------------------------------
  // 直列化
  // -------------------------------------------------------------------------

  it("実行中のAIトリガーは新トリガーを拒否する(会話系は定型文)", async () => {
    const dm = new DeferredDreamMaster(speakSuccess);
    const { gk } = makeGatekeeper(dm);

    const p1 = gk.openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() });
    expect(gk.isBusy()).toBe(true);

    const blocked = await gk.sendConversation({
      npcId: "innkeeper",
      utterance: "やあ",
      persistent: persistentBase()
    });
    expect(blocked.outcome).toBe("busy");
    expect(blocked.displayText).toBe(CONVERSATION_BUSY_TEXT);
    expect(blocked.aiInvoked).toBe(false);

    dm.flush();
    const r1 = await p1;
    expect(r1.outcome).toBe("ai");
    expect(gk.isBusy()).toBe(false);
  });

  it("会話要約の実行中でも、同一NPCへの新規会話開始は要約完了を待って進む(別NPCは拒否)", async () => {
    const dm = new DeferredDreamMaster(summaryOrSpeak);
    const { gk } = makeGatekeeper(dm);

    const pSum = gk.summarizeConversation({
      npcId: "innkeeper",
      persistent: persistentBase(),
      existingSummary: "",
      exchanges: [{ player: "こんばんは", npc: "やあ" }]
    });
    expect(gk.isBusy()).toBe(true);

    // 別NPCは拒否
    const other = await gk.openConversation({ npcId: "merchant", affinityAtOpen: 30, persistent: persistentBase() });
    expect(other.outcome).toBe("busy");

    // 同一NPCは待機(まだ解決しない)
    let openResolved = false;
    const pOpen = gk
      .openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() })
      .then((r) => {
        openResolved = true;
        return r;
      });
    await tick();
    expect(openResolved).toBe(false);

    // 要約を解決 → 会話開始が再開して挨拶呼び出しを発行(まだ pending)
    dm.flush();
    const rSum = await pSum;
    expect(rSum.outcome).toBe("ai");
    await tick();
    expect(openResolved).toBe(false);

    // 挨拶呼び出しを解決 → 会話開始が完了
    dm.flush();
    const rOpen = await pOpen;
    expect(rOpen.outcome).toBe("ai");
    expect(openResolved).toBe(true);
  });

  // -------------------------------------------------------------------------
  // クールダウン
  // -------------------------------------------------------------------------

  it("会話開始クールダウン中は挨拶を定型化する(AIを呼ばない・監査記録)", async () => {
    const { gk } = makeGatekeeper(new MockDreamMaster(loadAiConfig()));

    const first = await gk.openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() });
    expect(first.outcome).toBe("ai");

    // 10秒未満の再話しかけ → 定型挨拶
    clockMs += 5_000;
    const cd = await gk.openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() });
    expect(cd.outcome).toBe("cooldown");
    expect(cd.displayText).toBe(NPC_COOLDOWN_GREETING.innkeeper);
    expect(cd.aiInvoked).toBe(false);
    expect(boundaryLines().some((l) => l.kind === "cooldown_blocked")).toBe(true);

    // 10秒経過 → 再びAI
    clockMs += 6_000;
    const back = await gk.openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() });
    expect(back.outcome).toBe("ai");
  });

  it("夢シーンのクールダウン中は定型・世界変化なしを返す", async () => {
    const { gk } = makeGatekeeper(new MockDreamMaster(loadAiConfig()));

    const first = await gk.dreamScene({ persistent: persistentBase(), recentPlay: "忘れ野を歩いた" });
    expect(first.outcome).toBe("ai");
    expect(first.approvedEffects).toHaveLength(1);

    clockMs += 30_000; // 60秒未満
    const cd = await gk.dreamScene({ persistent: persistentBase(), recentPlay: "また歩いた" });
    expect(cd.outcome).toBe("cooldown");
    expect(cd.displayText).toBe(DREAM_FALLBACK_TEXT);
    expect(cd.approvedEffects).toHaveLength(0); // 世界変化なし
    expect(cd.aiInvoked).toBe(false);
  });

  it("サブクエスト生成は30秒クールダウン・受注3件で事前ブロックする", async () => {
    // 3件ブロック(クールダウンより先に判定)
    const blk = makeGatekeeper(new MockDreamMaster(loadAiConfig()));
    await blk.gk.openConversation({ npcId: "informant", affinityAtOpen: 30, persistent: persistentBase() });
    const full = await blk.gk.generateQuest({
      npcId: "informant",
      persistent: persistentBase({
        subQuests: [activeHuntQuest("a"), activeHuntQuest("b"), activeHuntQuest("c")]
      })
    });
    expect(full.outcome).toBe("limit");
    expect(full.displayText).toBe(QUEST_SLOTS_FULL_FALLBACK_TEXT);
    expect(full.aiInvoked).toBe(false);
    expect(boundaryLines().some((l) => l.kind === "limit_exceeded")).toBe(true);

    // クールダウン(30秒)
    clockMs = 0;
    const cd = makeGatekeeper(new MockDreamMaster(loadAiConfig()));
    await cd.gk.openConversation({ npcId: "informant", affinityAtOpen: 30, persistent: persistentBase() });
    const q1 = await cd.gk.generateQuest({ npcId: "informant", persistent: persistentBase() });
    expect(q1.outcome).toBe("ai");
    clockMs += 10_000; // 30秒未満
    const q2 = await cd.gk.generateQuest({ npcId: "informant", persistent: persistentBase() });
    expect(q2.outcome).toBe("cooldown");
    expect(q2.aiInvoked).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 戦果描写(初見のみAI)
  // -------------------------------------------------------------------------

  it("戦果描写は初見のみAI・既見は定型", async () => {
    const { gk } = makeGatekeeper(new MockDreamMaster(loadAiConfig()));

    const first = await gk.battleResult({ enemyId: "mist-wolf", persistent: persistentBase(), alreadyNarrated: false });
    expect(first.outcome).toBe("ai");
    expect(first.aiInvoked).toBe(true);

    const seen = await gk.battleResult({ enemyId: "mist-wolf", persistent: persistentBase(), alreadyNarrated: true });
    expect(seen.outcome).toBe("skipped");
    expect(seen.displayText).toBe(BATTLE_RESULT_FALLBACK_TEXT);
    expect(seen.aiInvoked).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 送信レート
  // -------------------------------------------------------------------------

  it("会話送信は3秒に1回・同一内容は拒否する", async () => {
    const { gk } = makeGatekeeper(new MockDreamMaster(loadAiConfig()));
    await gk.openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() });

    const s1 = await gk.sendConversation({ npcId: "innkeeper", utterance: "調子はどう?", persistent: persistentBase() });
    expect(s1.outcome).toBe("ai");

    // 3秒未満 → レート拒否
    clockMs += 1_000;
    const s2 = await gk.sendConversation({ npcId: "innkeeper", utterance: "元気?", persistent: persistentBase() });
    expect(s2.outcome).toBe("rate_limited");
    expect(boundaryLines().some((l) => l.kind === "rate_limited")).toBe(true);

    // 3秒経過しても同一内容は拒否
    clockMs += 3_000;
    const s3 = await gk.sendConversation({ npcId: "innkeeper", utterance: "調子はどう?", persistent: persistentBase() });
    expect(s3.outcome).toBe("rate_limited");

    // 別内容なら通る
    const s4 = await gk.sendConversation({ npcId: "innkeeper", utterance: "また来たよ", persistent: persistentBase() });
    expect(s4.outcome).toBe("ai");
  });

  // -------------------------------------------------------------------------
  // 監査ログ(境界イベントの集約)
  // -------------------------------------------------------------------------

  it("同種の境界イベントは10秒ウィンドウで集約して記録する", async () => {
    const { gk } = makeGatekeeper(new MockDreamMaster(loadAiConfig()));

    await gk.dreamScene({ persistent: persistentBase(), recentPlay: "" }); // AI(消費)
    clockMs += 1_000;
    await gk.dreamScene({ persistent: persistentBase(), recentPlay: "" }); // cooldown_blocked #1
    clockMs += 1_000;
    await gk.dreamScene({ persistent: persistentBase(), recentPlay: "" }); // cooldown_blocked #2(同種・同ウィンドウ)

    expect(auditLog.pendingBoundaryCount()).toBe(1); // 集約中は1件
    const lines = boundaryLines();
    const cooldown = lines.filter((l) => l.kind === "cooldown_blocked");
    expect(cooldown).toHaveLength(1);
    expect(cooldown[0]?.count).toBe(2);
  });

  it("表示系承認0件の会話ターンは failureKind=display_approved_zero と usedFallback を ai_call に記録する", async () => {
    // 実プレイのインシデント(responseText=null・toolCalls=[])の再現:
    // AIがツールを1つも呼ばずテキストだけで応答を終える → 表示系承認0件 → 定型フォールバック。
    const { gk } = makeGatekeeper(new ToollessSuccessDreamMaster());
    const r = await gk.openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() });
    expect(r.outcome).toBe("ai");
    expect(r.aiInvoked).toBe(true);

    const aiCalls = readLines().filter((l) => l.type === "ai_call");
    expect(aiCalls).toHaveLength(1);
    expect(aiCalls[0]).toMatchObject({
      flow: "conversation",
      failureKind: "display_approved_zero",
      usedFallback: true
    });
  });

  it("成功した会話ターンは failureKind=null・usedFallback=false を ai_call に記録する", async () => {
    const dm = new DeferredDreamMaster(speakSuccess);
    const { gk } = makeGatekeeper(dm);
    const p = gk.openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() });
    dm.flush(); // AI成功(speak)を解決
    const r = await p;
    expect(r.outcome).toBe("ai");

    const aiCalls = readLines().filter((l) => l.type === "ai_call");
    expect(aiCalls).toHaveLength(1);
    expect(aiCalls[0]).toMatchObject({
      flow: "conversation",
      failureKind: null,
      usedFallback: false
    });
  });

  it("縮退の発動を境界イベントとして記録する", async () => {
    const { gk } = makeGatekeeper(new FailingDreamMaster());
    // 夢を60秒ごとに3回失敗させ、3回目で縮退発動
    await gk.dreamScene({ persistent: persistentBase(), recentPlay: "" });
    clockMs += 60_000;
    await gk.dreamScene({ persistent: persistentBase(), recentPlay: "" });
    clockMs += 60_000;
    await gk.dreamScene({ persistent: persistentBase(), recentPlay: "" });

    expect(boundaryLines().some((l) => l.kind === "degraded_activated")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 日送りフック
  // -------------------------------------------------------------------------

  it("onDayAdvanced は通常縮退を解除して記録する", async () => {
    const dm = new FailingDreamMaster();
    const { gk, executor } = makeGatekeeper(dm);
    // 実行器を直接3連続失敗させて通常縮退させる
    for (let i = 0; i < 3; i += 1) {
      await executor.executeTurn({
        dmContext: { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "" },
        persistent: persistentBase(),
        session: null
      });
    }
    expect(executor.isNormalDegraded()).toBe(true);

    gk.onDayAdvanced();
    expect(executor.isNormalDegraded()).toBe(false);
    expect(boundaryLines().some((l) => l.kind === "degraded_cleared")).toBe(true);
  });

  it("onDayAdvanced はセッション上限縮退を解除しない", async () => {
    const { gk, executor } = makeGatekeeper(new MockDreamMaster(loadAiConfig({ sessionCallLimit: 1 })), {
      sessionCallLimit: 1
    });
    const input = {
      dmContext: { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "" } as const,
      persistent: persistentBase(),
      session: null
    };
    await executor.executeTurn(input); // 1回目(消費)
    await executor.executeTurn(input); // 2回目 → 上限縮退
    expect(executor.isSessionLimitDegraded()).toBe(true);

    gk.onDayAdvanced();
    expect(executor.isSessionLimitDegraded()).toBe(true); // 解除されない
    expect(boundaryLines().some((l) => l.kind === "degraded_cleared")).toBe(false);
  });
});
