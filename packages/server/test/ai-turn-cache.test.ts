import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BATTLE_RESULT_FALLBACK_TEXT,
  createDefaultAiDailyCounters,
  emptyInventory,
  initialDungeonSymbolCounts,
  type NpcId,
  type SubQuest
} from "@dreaming-engine/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuditLog } from "../src/ai/audit-log.js";
import { loadAiConfig } from "../src/ai/config.js";
import type {
  DreamMaster,
  DreamMasterContext,
  DreamMasterResult
} from "../src/ai/dream-master/index.js";
import {
  AiFlowGatekeeper,
  AiTurnExecutor,
  ConversationSession,
  TURN_CACHE_MAX_ENTRIES_PER_FLOW,
  TurnCache,
  cacheKeyForContext,
  type AiTurnInput
} from "../src/ai/flow-control/index.js";
import { RateLimiter } from "../src/ai/rate-limit.js";
import type { PersistentStateContext } from "../src/ai/tool-validation/index.js";

/**
 * 表示専用ターンのメモ化キャッシュ(M26-2。ai-integration.md「AI応答キャッシュ・先行生成」採用案A)。
 * - 純モジュール(鍵導出・LRU)のユニットテスト
 * - AiTurnExecutor 統合(hit/miss・非記憶条件・run 再呼び出しなし・セッション総数不増加・
 *   縮退中の不使用・cache.enabled=false)
 * - ゲートキーパー経由の監査ログ(ai_cache_hit 行)
 * 防御(ゲート判定・検証・出力壁)は一切変えない前提の追加テストのみ(既存アサートを緩めない)。
 */

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

function huntQuest(id: string, progress = 0): SubQuest {
  return {
    type: "hunt",
    targetId: "mist-wolf",
    id,
    count: 3,
    progress,
    rewardGold: 30,
    title: "霧狼の間引き",
    description: "忘れ野の霧狼を討つ。",
    status: "active"
  };
}

/** スクリプト駆動の DreamMaster スタブ(呼び出し回数を数える) */
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

function narrateSuccess(ctx: DreamMasterContext, text = "霧狼は灰色の霧へと崩れ落ちた。"): DreamMasterResult {
  return {
    ok: true,
    flow: ctx.flow,
    toolCalls: [{ toolName: "narrate", rawInput: { text } }],
    text: null,
    meta: META
  };
}

function speakOnly(ctx: DreamMasterContext, text = "「よく来たね、旅人さん」"): DreamMasterResult {
  return {
    ok: true,
    flow: ctx.flow,
    toolCalls: [{ toolName: "speak", rawInput: { text } }],
    text: null,
    meta: META
  };
}

function speakAndAdjust(ctx: DreamMasterContext, npcId: NpcId = "innkeeper"): DreamMasterResult {
  return {
    ok: true,
    flow: ctx.flow,
    toolCalls: [
      { toolName: "speak", rawInput: { text: "「よく来たね、旅人さん」" } },
      { toolName: "adjust_affinity", rawInput: { npcId, delta: 1, reason: "打ち解けた" } }
    ],
    text: null,
    meta: META
  };
}

function apiError(ctx: DreamMasterContext): DreamMasterResult {
  return { ok: false, flow: ctx.flow, failure: "api_error", meta: META };
}

const config = loadAiConfig();

function battleInput(enemyId: "mist-wolf" | "candle-eater" = "mist-wolf"): AiTurnInput {
  return {
    dmContext: { flow: "battleResult", enemyId },
    persistent: persistentBase(),
    session: null
  };
}

/** 会話開始挨拶(playerUtterance:"")の入力。文脈フィールドを差し替え可能にする */
function greetingInput(overrides: {
  npcId?: NpcId;
  affinity?: number;
  topic?: string;
  memorySummary?: string;
  subQuests?: readonly SubQuest[];
} = {}): AiTurnInput {
  const npcId = overrides.npcId ?? "innkeeper";
  const affinity = overrides.affinity ?? 30;
  return {
    dmContext: {
      flow: "conversation",
      partnerNpcId: npcId,
      playerUtterance: "",
      affinity,
      activeSubQuests: overrides.subQuests ?? [],
      ...(overrides.topic !== undefined ? { topic: overrides.topic } : {}),
      ...(overrides.memorySummary !== undefined ? { memorySummary: overrides.memorySummary } : {})
    },
    persistent: persistentBase({ subQuests: overrides.subQuests ?? [] }),
    session: new ConversationSession(npcId, affinity)
  };
}

// ---------------------------------------------------------------------------
// 純モジュール: 鍵導出(cacheKeyForContext)
// ---------------------------------------------------------------------------

describe("cacheKeyForContext(鍵導出)", () => {
  it("battleResult: 鍵は enemyId のみ(同一 enemyId=同一鍵・別 enemyId=別鍵)", () => {
    const a = cacheKeyForContext({ flow: "battleResult", enemyId: "mist-wolf" });
    const b = cacheKeyForContext({ flow: "battleResult", enemyId: "mist-wolf" });
    const c = cacheKeyForContext({ flow: "battleResult", enemyId: "candle-eater" });
    expect(a).not.toBeNull();
    expect(a?.flow).toBe("battleResult");
    expect(a?.key).toBe(b?.key);
    expect(a?.key).not.toBe(c?.key);
  });

  it("会話開始挨拶(playerUtterance:'')のみ鍵を導出し、自由入力ターンは対象外(null)", () => {
    const greeting = cacheKeyForContext({
      flow: "conversation",
      partnerNpcId: "innkeeper",
      playerUtterance: "",
      affinity: 30
    });
    expect(greeting?.flow).toBe("conversation");
    const freeInput = cacheKeyForContext({
      flow: "conversation",
      partnerNpcId: "innkeeper",
      playerUtterance: "こんばんは",
      affinity: 30
    });
    expect(freeInput).toBeNull();
  });

  it("非対象フロー(questGeneration/dream/summary)は鍵を導出しない(null)", () => {
    expect(cacheKeyForContext({ flow: "questGeneration", partnerNpcId: "informant" })).toBeNull();
    expect(cacheKeyForContext({ flow: "dream", recentPlay: "忘れ野を歩いた" })).toBeNull();
    expect(
      cacheKeyForContext({ flow: "summary", partnerNpcId: "priest", existingSummary: "", exchanges: [] })
    ).toBeNull();
  });

  it("挨拶の鍵は完全文脈フィンガープリント: NPC/好感度/話題/記憶要約/クエスト集合の1要素変化で別鍵", () => {
    const base = {
      flow: "conversation" as const,
      partnerNpcId: "innkeeper" as const,
      playerUtterance: "",
      affinity: 30,
      topic: "宿の噂",
      memorySummary: "旅人と語り合った。",
      activeSubQuests: [huntQuest("q1")]
    };
    const key = cacheKeyForContext(base)?.key;
    expect(key).toBeDefined();
    // 同一文脈=同一鍵
    expect(cacheKeyForContext({ ...base })?.key).toBe(key);
    // 各要素の変化で別鍵
    expect(cacheKeyForContext({ ...base, partnerNpcId: "merchant" })?.key).not.toBe(key);
    expect(cacheKeyForContext({ ...base, affinity: 31 })?.key).not.toBe(key);
    expect(cacheKeyForContext({ ...base, topic: "別の噂" })?.key).not.toBe(key);
    expect(cacheKeyForContext({ ...base, memorySummary: "別の記憶。" })?.key).not.toBe(key);
    expect(cacheKeyForContext({ ...base, activeSubQuests: [huntQuest("q2")] })?.key).not.toBe(key);
    // クエストの内容差(progress)も鍵に含める(鮮度追随)
    expect(cacheKeyForContext({ ...base, activeSubQuests: [huntQuest("q1", 2)] })?.key).not.toBe(key);
  });

  it("クエスト集合は順序非依存に正規化する(並び替えは同一鍵)", () => {
    const q1 = huntQuest("q1");
    const q2 = huntQuest("q2");
    const base = {
      flow: "conversation" as const,
      partnerNpcId: "innkeeper" as const,
      playerUtterance: "",
      affinity: 30
    };
    const ab = cacheKeyForContext({ ...base, activeSubQuests: [q1, q2] })?.key;
    const ba = cacheKeyForContext({ ...base, activeSubQuests: [q2, q1] })?.key;
    expect(ab).toBe(ba);
  });
});

// ---------------------------------------------------------------------------
// 純モジュール: TurnCache(LRU・カウンタ)
// ---------------------------------------------------------------------------

describe("TurnCache(LRU・有界)", () => {
  it("get/set の基本動作と hit/miss/store カウンタ", () => {
    const cache = new TurnCache(2);
    const key = { flow: "battleResult" as const, key: "enemy=mist-wolf" };
    expect(cache.get(key)).toBeUndefined(); // miss
    cache.set(key, { displayText: "霧狼は崩れ落ちた。", model: "m" });
    expect(cache.get(key)?.displayText).toBe("霧狼は崩れ落ちた。"); // hit
    expect(cache.stats()).toEqual({ hits: 1, misses: 1, stores: 1 });
  });

  it("上限件数を超えると最も古い(LRU)要素から追い出す", () => {
    const cache = new TurnCache(2);
    const k = (n: string): { flow: "battleResult"; key: string } => ({ flow: "battleResult", key: n });
    cache.set(k("a"), { displayText: "あ", model: null });
    cache.set(k("b"), { displayText: "い", model: null });
    cache.set(k("c"), { displayText: "う", model: null }); // a を追い出す
    expect(cache.size("battleResult")).toBe(2);
    expect(cache.get(k("a"))).toBeUndefined();
    expect(cache.get(k("b"))).toBeDefined();
    expect(cache.get(k("c"))).toBeDefined();
  });

  it("参照(get)で最新へ繰り上がる(直近参照されたものは追い出されない)", () => {
    const cache = new TurnCache(2);
    const k = (n: string): { flow: "battleResult"; key: string } => ({ flow: "battleResult", key: n });
    cache.set(k("a"), { displayText: "あ", model: null });
    cache.set(k("b"), { displayText: "い", model: null });
    cache.get(k("a")); // a を最新へ
    cache.set(k("c"), { displayText: "う", model: null }); // b を追い出す
    expect(cache.get(k("a"))).toBeDefined();
    expect(cache.get(k("b"))).toBeUndefined();
    expect(cache.get(k("c"))).toBeDefined();
  });

  it("フロー別に独立した領域を持つ(同名鍵でも衝突しない)", () => {
    const cache = new TurnCache(2);
    cache.set({ flow: "battleResult", key: "x" }, { displayText: "戦果", model: null });
    cache.set({ flow: "conversation", key: "x" }, { displayText: "挨拶", model: null });
    expect(cache.get({ flow: "battleResult", key: "x" })?.displayText).toBe("戦果");
    expect(cache.get({ flow: "conversation", key: "x" })?.displayText).toBe("挨拶");
  });

  it("既定の上限件数は正の定数(有界であることの明示)", () => {
    expect(TURN_CACHE_MAX_ENTRIES_PER_FLOW).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AiTurnExecutor 統合: hit/miss と非記憶条件
// ---------------------------------------------------------------------------

describe("AiTurnExecutor メモ化キャッシュ統合", () => {
  it("戦果描写: 同一 enemyId の2回目はヒット=run 再呼び出しなし・セッション総数不増加・同一テキスト", async () => {
    const stub = new StubDreamMaster((_c, ctx) => narrateSuccess(ctx));
    const executor = new AiTurnExecutor({ dreamMaster: stub, config });

    const first = await executor.executeTurn(battleInput("mist-wolf"));
    expect(first.aiInvoked).toBe(true);
    expect(first.cacheHit).toBeUndefined();
    expect(stub.calls).toBe(1);
    expect(executor.getSessionCallCount()).toBe(1);

    const second = await executor.executeTurn(battleInput("mist-wolf"));
    expect(second.cacheHit).toBe(true);
    expect(second.aiInvoked).toBe(false); // AI呼び出しではない
    expect(second.usedFallback).toBe(false);
    expect(second.failedTurn).toBe(false);
    expect(second.approvedEffects).toHaveLength(0);
    expect(second.displayText).toBe(first.displayText); // 検証済みテキストの再生
    expect(stub.calls).toBe(1); // run を再呼び出ししない
    expect(executor.getSessionCallCount()).toBe(1); // セッション総数を消費しない
    expect(executor.getCacheStats().hits).toBe(1);
  });

  it("戦果描写: 別 enemyId は miss で通常のAI呼び出しへ落ちる(鍵1要素変化で miss)", async () => {
    const stub = new StubDreamMaster((_c, ctx) => narrateSuccess(ctx));
    const executor = new AiTurnExecutor({ dreamMaster: stub, config });

    await executor.executeTurn(battleInput("mist-wolf"));
    const other = await executor.executeTurn(battleInput("candle-eater"));
    expect(other.cacheHit).toBeUndefined();
    expect(other.aiInvoked).toBe(true);
    expect(stub.calls).toBe(2);
    expect(executor.getSessionCallCount()).toBe(2);
  });

  it("会話開始挨拶: 同一文脈で hit・文脈の1要素(好感度)変化で miss", async () => {
    const stub = new StubDreamMaster((_c, ctx) => speakOnly(ctx));
    const executor = new AiTurnExecutor({ dreamMaster: stub, config });

    const first = await executor.executeTurn(greetingInput({ affinity: 30 }));
    expect(first.aiInvoked).toBe(true);
    expect(first.approvedEffects).toHaveLength(0); // speak のみ=表示専用ターン
    expect(stub.calls).toBe(1);

    // 同一文脈 → hit
    const hit = await executor.executeTurn(greetingInput({ affinity: 30 }));
    expect(hit.cacheHit).toBe(true);
    expect(hit.displayText).toBe(first.displayText);
    expect(stub.calls).toBe(1);
    expect(executor.getSessionCallCount()).toBe(1);

    // 好感度が変化 → 別鍵で miss(鮮度追随)
    const miss = await executor.executeTurn(greetingInput({ affinity: 31 }));
    expect(miss.cacheHit).toBeUndefined();
    expect(miss.aiInvoked).toBe(true);
    expect(stub.calls).toBe(2);
  });

  it("自由入力ターン(playerUtterance≠'')はキャッシュ対象外(同一入力の連続でも常にAIを呼ぶ)", async () => {
    const stub = new StubDreamMaster((_c, ctx) => speakOnly(ctx));
    const executor = new AiTurnExecutor({ dreamMaster: stub, config });
    const input = (): AiTurnInput => ({
      dmContext: { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "やあ", affinity: 30 },
      persistent: persistentBase(),
      session: new ConversationSession("innkeeper", 30)
    });
    await executor.executeTurn(input());
    await executor.executeTurn(input());
    expect(stub.calls).toBe(2); // 使い回さない
  });

  it("状態変更 effect を含む挨拶ターンは記憶しない(2回目も run を呼ぶ=副作用の二重適用を原理的に排除)", async () => {
    const stub = new StubDreamMaster((_c, ctx) => speakAndAdjust(ctx));
    const executor = new AiTurnExecutor({ dreamMaster: stub, config });

    const first = await executor.executeTurn(greetingInput());
    expect(first.approvedEffects).toHaveLength(1); // adjust_affinity が承認されている
    const second = await executor.executeTurn(greetingInput());
    expect(second.cacheHit).toBeUndefined();
    expect(second.aiInvoked).toBe(true);
    expect(stub.calls).toBe(2); // 記憶されていない
    expect(executor.getCacheStats().stores).toBe(0);
  });

  it("フォールバックターン(DreamMaster失敗)は記憶しない", async () => {
    const stub = new StubDreamMaster((_c, ctx) => apiError(ctx));
    const executor = new AiTurnExecutor({ dreamMaster: stub, config });

    const first = await executor.executeTurn(battleInput());
    expect(first.usedFallback).toBe(true);
    expect(first.displayText).toBe(BATTLE_RESULT_FALLBACK_TEXT);
    expect(stub.calls).toBe(2); // 初回+リトライ

    // フォールバック文は記憶されない: 次の同一鍵も通常のAI呼び出しへ
    const second = await executor.executeTurn(battleInput());
    expect(second.cacheHit).toBeUndefined();
    expect(stub.calls).toBe(4);
    expect(executor.getCacheStats().stores).toBe(0);
  });

  it("出力壁却下(表示系承認0件)のターンは記憶しない", async () => {
    // 逸脱テキスト(英語)は narrate 検証で却下 → display_approved_zero → フォールバック
    const deviation = "As an AI language model, I cannot comply with that request.";
    const stub = new StubDreamMaster((_c, ctx) => narrateSuccess(ctx, deviation));
    const executor = new AiTurnExecutor({ dreamMaster: stub, config });

    const first = await executor.executeTurn(battleInput());
    expect(first.failedTurn).toBe(true);
    expect(first.failureKind).toBe("display_approved_zero");

    const second = await executor.executeTurn(battleInput());
    expect(second.cacheHit).toBeUndefined(); // 却下結果が焼き込まれていない
    expect(executor.getCacheStats().stores).toBe(0);
  });

  it("縮退中はキャッシュを引かない(既存の早期リターン=定型フォールバックの意味を変えない)", async () => {
    // まず成功で battleResult を記憶させる
    const stub = new StubDreamMaster((_c, ctx) =>
      ctx.flow === "battleResult" ? narrateSuccess(ctx) : apiError(ctx)
    );
    const executor = new AiTurnExecutor({ dreamMaster: stub, config });
    const cached = await executor.executeTurn(battleInput());
    expect(cached.aiInvoked).toBe(true);
    expect(executor.getCacheStats().stores).toBe(1);

    // conversation を3トリガー連続失敗させて通常縮退を発動
    for (let i = 0; i < 3; i += 1) {
      await executor.executeTurn({
        dmContext: { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "やあ" },
        persistent: persistentBase(),
        session: new ConversationSession("innkeeper", 30)
      });
    }
    expect(executor.isNormalDegraded()).toBe(true);

    // 縮退中: 記憶済みの鍵でもキャッシュを引かず定型フォールバック(AIも呼ばない)
    const degraded = await executor.executeTurn(battleInput());
    expect(degraded.cacheHit).toBeUndefined();
    expect(degraded.usedFallback).toBe(true);
    expect(degraded.aiInvoked).toBe(false);
    expect(degraded.displayText).toBe(BATTLE_RESULT_FALLBACK_TEXT);
    // ヒットもミスも数えない(ルックアップ自体をしない)
    expect(executor.getCacheStats().hits).toBe(0);
  });

  it("ヒットは失敗にも成功コミットにも数えない(連続失敗カウントを変えない)", async () => {
    const stub = new StubDreamMaster((call, ctx) =>
      ctx.flow === "battleResult" ? narrateSuccess(ctx) : apiError(ctx)
    );
    const executor = new AiTurnExecutor({ dreamMaster: stub, config });
    await executor.executeTurn(battleInput()); // 記憶を作る(成功でカウント0)

    // conversation を1トリガー失敗させてカウント1
    await executor.executeTurn({
      dmContext: { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "やあ" },
      persistent: persistentBase(),
      session: new ConversationSession("innkeeper", 30)
    });
    expect(executor.getConsecutiveFailures("conversation")).toBe(1);

    // battleResult のヒットは conversation の失敗カウントに影響しない(成功コミットもしない)
    const hit = await executor.executeTurn(battleInput());
    expect(hit.cacheHit).toBe(true);
    expect(executor.getConsecutiveFailures("conversation")).toBe(1);
    expect(executor.getConsecutiveFailures("battleResult")).toBe(0);
  });

  it("cache.enabled=false ならキャッシュを一切使わない(格納も参照もしない)", async () => {
    const disabled = loadAiConfig({ cache: { enabled: false } });
    const stub = new StubDreamMaster((_c, ctx) => narrateSuccess(ctx));
    const executor = new AiTurnExecutor({ dreamMaster: stub, config: disabled });

    await executor.executeTurn(battleInput());
    const second = await executor.executeTurn(battleInput());
    expect(second.cacheHit).toBeUndefined();
    expect(second.aiInvoked).toBe(true);
    expect(stub.calls).toBe(2); // 毎回AIを呼ぶ
    expect(executor.getCacheStats()).toEqual({ hits: 0, misses: 0, stores: 0 });
  });

  it("本番デフォルトは cache.enabled=true(config/ai.json の不変条件)", () => {
    expect(loadAiConfig().cache.enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ゲートキーパー経由: 監査ログ(ai_cache_hit)
// ---------------------------------------------------------------------------

describe("AiFlowGatekeeper キャッシュヒットの監査ログ", () => {
  let dir = "";
  let clockMs = 0;

  const readLines = (): Record<string, unknown>[] =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .flatMap((f) =>
        readFileSync(path.join(dir, f), "utf8")
          .split("\n")
          .filter((l) => l.length > 0)
          .map((l) => JSON.parse(l) as Record<string, unknown>)
      );

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "de-cache-"));
    clockMs = 0;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("戦果描写のヒットは ai_cache_hit を1行記録し、ai_call は増えない(生テキストなし)", async () => {
    const auditLog = new AuditLog({ dir, now: () => new Date(clockMs), maskEnv: {} });
    const stub = new StubDreamMaster((_c, ctx) => narrateSuccess(ctx));
    const executor = new AiTurnExecutor({ dreamMaster: stub, config });
    const gk = new AiFlowGatekeeper({
      executor,
      config,
      rateLimiter: new RateLimiter(() => clockMs),
      auditLog,
      now: () => clockMs
    });

    // 初見(miss=通常のAI呼び出し。ゲートは alreadyNarrated=false で通す)
    const first = await gk.battleResult({ enemyId: "mist-wolf", persistent: persistentBase(), alreadyNarrated: false });
    expect(first.aiInvoked).toBe(true);

    // 同一 enemyId の再訪(ゲート判定は現状のまま=alreadyNarrated が false のときのみ到達)
    const hit = await gk.battleResult({ enemyId: "mist-wolf", persistent: persistentBase(), alreadyNarrated: false });
    expect(hit.outcome).toBe("ai");
    expect(hit.aiInvoked).toBe(false); // AI枠不消費
    expect(hit.displayText).toBe(first.displayText);

    const lines = readLines();
    const aiCalls = lines.filter((l) => l.type === "ai_call");
    const cacheHits = lines.filter((l) => l.type === "ai_cache_hit");
    expect(aiCalls).toHaveLength(1); // miss の1回のみ
    expect(cacheHits).toHaveLength(1);
    expect(cacheHits[0]).toMatchObject({ flow: "battle_result" });
    expect(typeof cacheHits[0]?.contextHash).toBe("string");
    // 生テキストは持たない(responseText/playerInput フィールド自体が無い)
    expect(cacheHits[0]).not.toHaveProperty("responseText");
    expect(cacheHits[0]).not.toHaveProperty("playerInput");
  });

  it("ai_cache_hit 行にも機密マスクが無条件適用される(トークン様文字列を平文で残さない)", async () => {
    // 実キー形式のリテラルを置かないため動的に組み立てる(シークレットスキャン対策)
    const tokenLike = ["sk-", "ant-"].join("") + "a".repeat(24);
    const auditLog = new AuditLog({ dir, now: () => new Date(clockMs), maskEnv: {} });
    // contextHash に混入した場合でもマスクされることを logCacheHit 直接呼び出しで確認
    auditLog.logCacheHit({ flow: "battle_result", contextHash: tokenLike });
    const lines = readLines().filter((l) => l.type === "ai_cache_hit");
    expect(lines).toHaveLength(1);
    expect(JSON.stringify(lines[0])).not.toContain(tokenLike);
  });
});
