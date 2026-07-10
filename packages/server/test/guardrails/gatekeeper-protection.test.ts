import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createDefaultAiDailyCounters,
  emptyInventory,
  initialDungeonSymbolCounts,
  type SubQuest
} from "@dreaming-engine/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuditLog } from "../../src/ai/audit-log.js";
import { loadAiConfig } from "../../src/ai/config.js";
import { MockDreamMaster } from "../../src/ai/dream-master/index.js";
import type {
  DreamMaster,
  DreamMasterContext,
  DreamMasterResult
} from "../../src/ai/dream-master/index.js";
import { AiFlowGatekeeper, AiTurnExecutor } from "../../src/ai/flow-control/index.js";
import { RateLimiter } from "../../src/ai/rate-limit.js";
import type { PersistentStateContext } from "../../src/ai/tool-validation/index.js";

/**
 * 攻撃テストA(保護イベント記録・コスト保護境界・直列化。ai-guardrails.md 228-236)。
 * ゲートキーパー(AI 呼び出し前段の保護)へ攻撃相当の連打・多重トリガーを与え、
 * (1)AI 呼び出しがモックの呼び出し回数で発生しないこと、(2)ブロック/縮退が監査ログに
 * 境界イベントとして記録されること、(3)同時実行が1件を超えないことを機械検証する。
 */

const META = { mode: "mock" as const, model: "claude-haiku-4-5" };

function persistentBase(overrides: Partial<PersistentStateContext> = {}): PersistentStateContext {
  return {
    aiDaily: createDefaultAiDailyCounters(),
    affinityByNpc: { innkeeper: 30, merchant: 30, informant: 30, priest: 30, caretaker: 30, artisan: 30, warden: 30 },
    inventory: emptyInventory(),
    subQuests: [],
    dungeonSymbolCounts: initialDungeonSymbolCounts(),
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

/** run() の呼び出し回数を数える DreamMaster(コスト保護境界の検証: 実 AI 呼び出しの代理計測) */
class CountingDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  public calls = 0;
  private readonly inner: MockDreamMaster;
  public constructor(config = loadAiConfig()) {
    this.inner = new MockDreamMaster(config);
  }
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    this.calls += 1;
    return this.inner.run(ctx);
  }
}

/** 常に api_error を返す DreamMaster(縮退の発動を誘発) */
class FailingDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    return Promise.resolve({ ok: false, flow: ctx.flow, failure: "api_error", meta: META });
  }
}

/** 応答を任意のタイミングで解決できる DreamMaster(直列化テスト用) */
class DeferredDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  private pending: { resolve: (r: DreamMasterResult) => void; ctx: DreamMasterContext }[] = [];
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    return new Promise((resolve) => {
      this.pending.push({ resolve, ctx });
    });
  }
  public get inFlightCount(): number {
    return this.pending.length;
  }
  public flush(): void {
    const next = this.pending.shift();
    if (next) {
      next.resolve({
        ok: true,
        flow: next.ctx.flow,
        toolCalls: [{ toolName: "speak", rawInput: { text: "「やあ、旅人さん」" } }],
        text: null,
        meta: META
      });
    }
  }
}

describe("攻撃テストA: ゲートキーパー保護(第0/1層 保護イベント・コスト・直列化)", () => {
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

  const boundaryKinds = (): string[] => {
    auditLog.flush();
    return readLines()
      .filter((l) => l.type === "boundary")
      .map((l) => String(l.kind));
  };

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "de-gk-atk-"));
    clockMs = 0;
    auditLog = new AuditLog({ dir, now: () => new Date(clockMs), maskEnv: {} });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function makeGatekeeper(dreamMaster: DreamMaster): {
    gk: AiFlowGatekeeper;
    executor: AiTurnExecutor;
  } {
    const config = loadAiConfig();
    const executor = new AiTurnExecutor({ dreamMaster, config });
    const gk = new AiFlowGatekeeper({
      executor,
      config,
      rateLimiter: new RateLimiter(() => clockMs),
      auditLog,
      now: () => clockMs
    });
    return { gk, executor };
  }

  // -------------------------------------------------------------------------
  // コスト保護の境界(AI 呼び出しをモック回数で検証)
  // -------------------------------------------------------------------------

  it("[ATK-cost-cooldown-greeting] 会話開始クールダウン中の話しかけ(定型挨拶)は AI を呼ばない", async () => {
    const dm = new CountingDreamMaster();
    const { gk } = makeGatekeeper(dm);

    await gk.openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() });
    expect(dm.calls).toBe(1); // 初回はAI

    clockMs += 5_000; // 10秒未満(クールダウン中)
    const cd = await gk.openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() });
    expect(cd.outcome).toBe("cooldown");
    expect(cd.aiInvoked).toBe(false);
    expect(dm.calls).toBe(1); // 追加のAI呼び出しは発生しない
  });

  it("[ATK-cost-zero-exchange-summary] 0往復で終了した会話の要約は AI を呼ばない", async () => {
    const dm = new CountingDreamMaster();
    const { gk } = makeGatekeeper(dm);

    const r = await gk.summarizeConversation({
      npcId: "innkeeper",
      persistent: persistentBase(),
      existingSummary: "",
      exchanges: [] // 0往復
    });
    expect(r.outcome).toBe("skipped");
    expect(r.aiInvoked).toBe(false);
    expect(dm.calls).toBe(0); // 要約呼び出し自体が発生しない
  });

  // -------------------------------------------------------------------------
  // 直列化(同時実行1件以下)
  // -------------------------------------------------------------------------

  it("[ATK-serialize-busy] 実行中の新規AIトリガーは拒否され、同時実行は1件を超えない", async () => {
    const dm = new DeferredDreamMaster();
    const { gk } = makeGatekeeper(dm);

    // 1件目を開始(pending のまま)
    const p1 = gk.openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() });
    expect(gk.isBusy()).toBe(true);
    expect(dm.inFlightCount).toBe(1);

    // 実行中の新規トリガーは busy 拒否(AIを呼ばない)
    const blocked = await gk.sendConversation({ npcId: "innkeeper", utterance: "やあ", persistent: persistentBase() });
    expect(blocked.outcome).toBe("busy");
    expect(blocked.aiInvoked).toBe(false);
    expect(dm.inFlightCount).toBe(1); // 同時実行は1件のまま(2件目は発行されない)

    dm.flush();
    const r1 = await p1;
    expect(r1.outcome).toBe("ai");
    expect(gk.isBusy()).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 保護イベントの監査記録(レート・クールダウン・上限・縮退)
  // -------------------------------------------------------------------------

  it("[ATK-protect-events-audit] レート/クールダウン/上限ブロックと縮退発動が監査ログに記録される", async () => {
    // 縮退は失敗の連続で誘発するため、鍵となる各ブロックを別ゲートキーパーで確実に発生させる。
    // (1) 会話送信レート超過
    const rl = makeGatekeeper(new MockDreamMaster(loadAiConfig()));
    await rl.gk.openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() });
    await rl.gk.sendConversation({ npcId: "innkeeper", utterance: "調子はどう?", persistent: persistentBase() });
    clockMs += 1_000; // 3秒未満 → レート拒否
    const rated = await rl.gk.sendConversation({ npcId: "innkeeper", utterance: "元気?", persistent: persistentBase() });
    expect(rated.outcome).toBe("rate_limited");

    // (2) 会話開始クールダウン
    clockMs += 1_000;
    const cd = await rl.gk.openConversation({ npcId: "innkeeper", affinityAtOpen: 30, persistent: persistentBase() });
    expect(cd.outcome).toBe("cooldown");

    // (3) 受注枠3件による事前ブロック(上限)
    await rl.gk.openConversation({ npcId: "informant", affinityAtOpen: 30, persistent: persistentBase() }); // 別NPCで会話開始(CD跨ぎ)
    clockMs += 20_000;
    await rl.gk.openConversation({ npcId: "informant", affinityAtOpen: 30, persistent: persistentBase() });
    const limited = await rl.gk.generateQuest({
      npcId: "informant",
      persistent: persistentBase({
        subQuests: [activeHuntQuest("a"), activeHuntQuest("b"), activeHuntQuest("c")]
      })
    });
    expect(limited.outcome).toBe("limit");

    const kinds = boundaryKinds();
    expect(kinds).toContain("rate_limited");
    expect(kinds).toContain("cooldown_blocked");
    expect(kinds).toContain("limit_exceeded");

    // (4) 縮退の発動(夢を3回連続失敗)は別ゲートキーパーで
    const deg = makeGatekeeper(new FailingDreamMaster());
    for (let i = 0; i < 3; i += 1) {
      await deg.gk.dreamScene({ persistent: persistentBase(), recentPlay: "" });
      clockMs += 60_000;
    }
    expect(boundaryKinds()).toContain("degraded_activated");
  });

  it("[ATK-degrade-clear] 日送りは通常縮退のみ解除して記録し、セッション上限縮退は解除しない", async () => {
    // 通常縮退(3連続失敗)→ 日送りで解除・記録
    const { gk, executor } = makeGatekeeper(new FailingDreamMaster());
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
    expect(boundaryKinds()).toContain("degraded_cleared");
  });
});
