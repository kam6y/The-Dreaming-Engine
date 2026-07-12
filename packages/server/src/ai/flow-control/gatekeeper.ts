import { createHash } from "node:crypto";

import {
  CONVERSATION_BUSY_TEXT,
  NPC_COOLDOWN_GREETING,
  QUEST_SLOTS_FULL_FALLBACK_TEXT,
  activeQuestSlotCount,
  SUB_QUEST_MAX_ACTIVE,
  type ConversationExchange,
  type EnemyId,
  type NpcId,
  type WorldState
} from "@dreaming-engine/shared";

import type { AuditLog } from "../audit-log.js";
import type { AiConfig } from "../config.js";
import type { DreamMasterContext } from "../dream-master/types.js";
import type { RateLimiter } from "../rate-limit.js";
import type { PersistentStateContext, ToolFlow } from "../tool-validation/types.js";
import { AUDIT_FLOW_BY_TOOL_FLOW, fallbackTextForFlow } from "./fallback-text.js";
import { ConversationSession } from "./session.js";
import type { AiTurnExecutor, AiTurnResult, StateChangeEffect } from "./turn-executor.js";

/**
 * ゲートキーパー(ai-integration.md「呼び出しフロー別仕様」直列化234-241 /
 * 「レート・コスト保護」280-321 / 「監査ログ」334-357)。
 *
 * AIターン実行器の**前段**に立ち、AIを呼ぶ前の保護を司る:
 * - 直列化(サーバー全体で同時1件。要約中の同一NPC会話開始のみ待機)
 * - シーン別クールダウン(会話開始・夢・サブクエスト生成)
 * - プレイヤー入力レート(会話送信3秒・同一内容拒否)
 * - サブクエスト受注3件の事前ブロック・戦果描写の初見のみAI
 * - 境界/保護イベントの監査ログ配線(AIを呼ばないブロックも記録)・縮退の発動/解除の記録
 * - 日送り完了時の通常縮退解除(セッション上限縮退は解除しない)
 *
 * **GameState は変更しない・WS/セーブには触れない**(それは M4-E)。会話セッションのライフサイクル
 * (揮発ランタイム状態)と保護状態のみを保持し、判定結果を `GateResult` で返す。
 */

/** ゲート判定の結果種別 */
export type GateOutcome =
  | "ai" // AIを呼んで応答(成功/失敗フォールバック含む)
  | "cooldown" // クールダウンで定型(挨拶/夢/クエスト)
  | "rate_limited" // 送信レート/同一内容で拒否
  | "busy" // 直列化で拒否
  | "limit" // 受注3件などで事前ブロック
  | "skipped"; // 0往復要約スキップ・既見戦果の定型

export interface GateResult {
  readonly outcome: GateOutcome;
  /** 表示テキスト(AI応答 or 定型)。summary は空 */
  readonly displayText: string;
  /** 承認された状態変更 effect(M4-E が適用)。ブロック時は空 */
  readonly approvedEffects: readonly StateChangeEffect[];
  /** 会話要約(summary の成功時のみ)。他は null */
  readonly summaryText: string | null;
  /** AIを実際に呼んだか */
  readonly aiInvoked: boolean;
  /** 実行後にサービスが縮退中か */
  readonly degraded: boolean;
  /** 実行器の生結果(AIを呼んだ場合)。ブロック時は null */
  readonly turn: AiTurnResult | null;
}

export interface OpenConversationInput {
  readonly npcId: NpcId;
  /** 会話開始時点のNPC好感度(GameState 由来。セッションがスナップショットする) */
  readonly affinityAtOpen: number;
  readonly persistent: PersistentStateContext;
  /** 充実コンテキスト(M4-E が GameState から供給。Live prompt が使う。任意) */
  readonly topic?: string;
  readonly memorySummary?: string;
}

export interface SendConversationInput {
  readonly npcId: NpcId;
  readonly utterance: string;
  readonly persistent: PersistentStateContext;
  readonly topic?: string;
  readonly memorySummary?: string;
}

export interface GenerateQuestInput {
  /** 通常は情報屋カイ */
  readonly npcId: NpcId;
  readonly persistent: PersistentStateContext;
  readonly topic?: string;
}

export interface DreamSceneInput {
  readonly persistent: PersistentStateContext;
  readonly recentPlay: string;
  /** 現在の世界状態(翌朝の変化の基準として Live prompt に提示。任意) */
  readonly world?: WorldState;
}

export interface BattleResultInput {
  readonly enemyId: EnemyId;
  readonly persistent: PersistentStateContext;
  /** すでに戦果描写済み(既見)か。true なら定型でAIを呼ばない(hasNarratedEnemy で判定して渡す) */
  readonly alreadyNarrated: boolean;
}

export interface SummarizeInput {
  readonly npcId: NpcId;
  readonly persistent: PersistentStateContext;
  readonly existingSummary: string;
  readonly exchanges: readonly ConversationExchange[];
}

export interface AiFlowGatekeeperOptions {
  readonly executor: AiTurnExecutor;
  readonly config: AiConfig;
  /** クロック注入済みの共有 RateLimiter(プロセス全体で単一) */
  readonly rateLimiter: RateLimiter;
  /** 監査ログ(境界イベント集約・AI呼び出し記録) */
  readonly auditLog: AuditLog;
  /** 所要時間計測用クロック(ミリ秒)。テストで固定 */
  readonly now: () => number;
}

/** 実行中の1件(直列化の追跡) */
interface InFlight {
  readonly flow: ToolFlow;
  readonly npcId: NpcId | null;
  readonly promise: Promise<AiTurnResult>;
}

/** 直列化ブロック時の定型文(会話系は会話定型、その他はフロー別フォールバック) */
function busyTextForFlow(flow: ToolFlow): string {
  if (flow === "conversation" || flow === "questGeneration") return CONVERSATION_BUSY_TEXT;
  return fallbackTextForFlow(flow);
}

function hashContext(ctx: DreamMasterContext): string {
  return createHash("sha256").update(JSON.stringify(ctx)).digest("hex").slice(0, 16);
}

export class AiFlowGatekeeper {
  private readonly executor: AiTurnExecutor;
  private readonly config: AiConfig;
  private readonly rate: RateLimiter;
  private readonly auditLog: AuditLog;
  private readonly now: () => number;

  private session: ConversationSession | null = null;
  private inFlight: InFlight | null = null;

  public constructor(options: AiFlowGatekeeperOptions) {
    this.executor = options.executor;
    this.config = options.config;
    this.rate = options.rateLimiter;
    this.auditLog = options.auditLog;
    this.now = options.now;
  }

  // -------------------------------------------------------------------------
  // 照会(テスト・M4-E 用)
  // -------------------------------------------------------------------------

  public getSession(): ConversationSession | null {
    return this.session;
  }

  public isBusy(): boolean {
    return this.inFlight !== null;
  }

  // -------------------------------------------------------------------------
  // 会話開始(話しかけ)
  // -------------------------------------------------------------------------

  public async openConversation(input: OpenConversationInput): Promise<GateResult> {
    if (this.inFlight !== null) {
      const busy = this.inFlight;
      // 例外: 会話要約の実行中に同一NPCへの新規会話開始 → 要約の完了/失敗確定を待つ
      if (busy.flow === "summary" && busy.npcId === input.npcId) {
        await busy.promise;
      } else {
        return this.blockResult("busy", CONVERSATION_BUSY_TEXT);
      }
    }

    // クールダウン中でも会話は開く(セッションを生成)
    const session = new ConversationSession(input.npcId, input.affinityAtOpen);
    this.session = session;

    const cooldownMs = this.config.cooldowns.conversationStartSeconds * 1000;
    if (!this.rate.tryAcquire(`talk:${input.npcId}`, cooldownMs)) {
      // 挨拶はAIを呼ばず定型文
      this.auditLog.logBoundaryEvent({
        kind: "cooldown_blocked",
        reason: `会話開始クールダウン(${input.npcId})`
      });
      return this.blockResult("cooldown", NPC_COOLDOWN_GREETING[input.npcId]);
    }

    return this.runGuardedTurn({
      flow: "conversation",
      npcId: input.npcId,
      dmContext: {
        flow: "conversation",
        partnerNpcId: input.npcId,
        playerUtterance: "",
        affinity: input.affinityAtOpen,
        activeSubQuests: input.persistent.subQuests,
        ...(input.topic !== undefined ? { topic: input.topic } : {}),
        ...(input.memorySummary !== undefined ? { memorySummary: input.memorySummary } : {})
      },
      persistent: input.persistent,
      session,
      playerInput: null
    });
  }

  // -------------------------------------------------------------------------
  // 会話送信(自由入力)
  // -------------------------------------------------------------------------

  public async sendConversation(input: SendConversationInput): Promise<GateResult> {
    const session = this.session;
    if (session === null || session.partnerNpcId !== input.npcId) {
      // 会話が開いていない(呼び出し側の前提違反)。定型で無害に返す
      return this.blockResult("skipped", fallbackTextForFlow("conversation"));
    }

    if (this.inFlight !== null) {
      return this.blockResult("busy", CONVERSATION_BUSY_TEXT);
    }

    const key = `send:${input.npcId}`;
    const sendMs = this.config.conversationSendRateSeconds * 1000;

    // レート(3秒に1回)を非消費で先に確認する
    if (this.rate.msUntilReady(key, sendMs) > 0) {
      this.auditLog.logBoundaryEvent({ kind: "rate_limited", reason: "会話送信レート超過" });
      return this.blockResult("rate_limited", CONVERSATION_BUSY_TEXT);
    }
    // 同一内容の連続送信を拒否
    if (!this.rate.acceptContent(key, input.utterance)) {
      this.auditLog.logBoundaryEvent({ kind: "rate_limited", reason: "同一内容の連続送信" });
      return this.blockResult("rate_limited", CONVERSATION_BUSY_TEXT);
    }
    // ここまで通ったのでレートを消費する
    this.rate.tryAcquire(key, sendMs);

    return this.runGuardedTurn({
      flow: "conversation",
      npcId: input.npcId,
      dmContext: {
        flow: "conversation",
        partnerNpcId: input.npcId,
        playerUtterance: input.utterance,
        affinity: input.persistent.affinityByNpc[input.npcId],
        activeSubQuests: input.persistent.subQuests,
        ...(input.topic !== undefined ? { topic: input.topic } : {}),
        ...(input.memorySummary !== undefined ? { memorySummary: input.memorySummary } : {})
      },
      persistent: input.persistent,
      session,
      playerInput: input.utterance
    });
  }

  // -------------------------------------------------------------------------
  // サブクエスト生成(情報屋への「仕事はある?」)
  // -------------------------------------------------------------------------

  public async generateQuest(input: GenerateQuestInput): Promise<GateResult> {
    const session = this.session;
    if (session === null || session.partnerNpcId !== input.npcId) {
      return this.blockResult("skipped", fallbackTextForFlow("questGeneration"));
    }

    if (this.inFlight !== null) {
      return this.blockResult("busy", busyTextForFlow("questGeneration"));
    }

    // 受注中3件のときはAIを呼ばず定型で断る(呼び出し前ブロック)
    if (activeQuestSlotCount(input.persistent.subQuests) >= SUB_QUEST_MAX_ACTIVE) {
      this.auditLog.logBoundaryEvent({ kind: "limit_exceeded", reason: "受注中サブクエスト3件" });
      return this.blockResult("limit", QUEST_SLOTS_FULL_FALLBACK_TEXT);
    }

    // クールダウン(30秒に1回)
    const cooldownMs = this.config.cooldowns.questGenerationSeconds * 1000;
    if (!this.rate.tryAcquire("quest", cooldownMs)) {
      this.auditLog.logBoundaryEvent({ kind: "cooldown_blocked", reason: "サブクエスト生成クールダウン" });
      return this.blockResult("cooldown", fallbackTextForFlow("questGeneration"));
    }

    return this.runGuardedTurn({
      flow: "questGeneration",
      npcId: input.npcId,
      dmContext: {
        flow: "questGeneration",
        partnerNpcId: input.npcId,
        activeSubQuests: input.persistent.subQuests,
        ...(input.topic !== undefined ? { topic: input.topic } : {})
      },
      persistent: input.persistent,
      session,
      playerInput: null
    });
  }

  // -------------------------------------------------------------------------
  // 夢シーン(宿泊)
  // -------------------------------------------------------------------------

  public async dreamScene(input: DreamSceneInput): Promise<GateResult> {
    if (this.inFlight !== null) {
      return this.blockResult("busy", busyTextForFlow("dream"));
    }

    // クールダウン(60秒に1回)。中の宿泊も宿泊処理は通常どおり(このサービスは夢のみ担当)。
    // 夢はAIを呼ばず定型・世界変化なし
    const cooldownMs = this.config.cooldowns.dreamSeconds * 1000;
    if (!this.rate.tryAcquire("dream", cooldownMs)) {
      this.auditLog.logBoundaryEvent({ kind: "cooldown_blocked", reason: "夢シーンクールダウン" });
      return this.blockResult("cooldown", fallbackTextForFlow("dream"));
    }

    return this.runGuardedTurn({
      flow: "dream",
      npcId: null,
      dmContext: {
        flow: "dream",
        recentPlay: input.recentPlay,
        activeSubQuests: input.persistent.subQuests,
        ...(input.world !== undefined ? { world: input.world } : {})
      },
      persistent: input.persistent,
      session: null,
      playerInput: null
    });
  }

  // -------------------------------------------------------------------------
  // 戦果描写(初見のみAI)
  // -------------------------------------------------------------------------

  public async battleResult(input: BattleResultInput): Promise<GateResult> {
    if (this.inFlight !== null) {
      return this.blockResult("busy", busyTextForFlow("battleResult"));
    }

    // 既見敵は定型文(AIを呼ばない)
    if (input.alreadyNarrated) {
      return this.blockResult("skipped", fallbackTextForFlow("battleResult"));
    }

    return this.runGuardedTurn({
      flow: "battleResult",
      npcId: null,
      dmContext: { flow: "battleResult", enemyId: input.enemyId },
      persistent: input.persistent,
      session: null,
      playerInput: null
    });
  }

  // -------------------------------------------------------------------------
  // 会話要約(会話終了時)
  // -------------------------------------------------------------------------

  public async summarizeConversation(input: SummarizeInput): Promise<GateResult> {
    // 0往復で終了した会話は要約呼び出し自体をスキップ(サブスク枠の保護)
    if (input.exchanges.length === 0) {
      return this.blockResult("skipped", "");
    }

    if (this.inFlight !== null) {
      return this.blockResult("busy", "");
    }

    return this.runGuardedTurn({
      flow: "summary",
      npcId: input.npcId,
      dmContext: {
        flow: "summary",
        partnerNpcId: input.npcId,
        existingSummary: input.existingSummary,
        exchanges: input.exchanges
      },
      persistent: input.persistent,
      session: null,
      playerInput: null
    });
  }

  // -------------------------------------------------------------------------
  // 会話終了・日送り
  // -------------------------------------------------------------------------

  /** 会話終了: 揮発セッション(未受諾提案含む)を破棄する */
  public closeConversation(): void {
    this.session?.clearPendingProposal();
    this.session = null;
  }

  /**
   * 日送り完了フック(宿泊手順2直後・全滅帰還の日送りでも)。
   * 通常縮退を解除する(連続カウント0)。**セッション上限縮退は解除しない**。
   */
  public onDayAdvanced(): void {
    if (this.executor.clearNormalDegradation()) {
      this.auditLog.logBoundaryEvent({ kind: "degraded_cleared", reason: "日送りにより通常縮退を解除" });
    }
  }

  // -------------------------------------------------------------------------
  // 内部: ガード付きターン実行 + 監査
  // -------------------------------------------------------------------------

  private runGuardedTurn(spec: {
    flow: ToolFlow;
    npcId: NpcId | null;
    dmContext: DreamMasterContext;
    persistent: PersistentStateContext;
    session: ConversationSession | null;
    playerInput: string | null;
  }): Promise<GateResult> {
    const promise = this.executor.executeTurn({
      dmContext: spec.dmContext,
      persistent: spec.persistent,
      session: spec.session
    });
    const entry: InFlight = { flow: spec.flow, npcId: spec.npcId, promise };
    this.inFlight = entry;
    const startMs = this.now();

    return promise
      .then((turn) => {
        const durationMs = this.now() - startMs;
        this.auditTurn(spec.flow, spec.dmContext, spec.playerInput, turn, durationMs);
        return this.aiResult(turn);
      })
      .finally(() => {
        if (this.inFlight === entry) this.inFlight = null;
      });
  }

  private auditTurn(
    flow: ToolFlow,
    dmContext: DreamMasterContext,
    playerInput: string | null,
    turn: AiTurnResult,
    durationMs: number
  ): void {
    if (turn.cacheHit === true) {
      // キャッシュヒット(AI呼び出しではない): ai_cache_hit を1行残す(生テキストなし・注記のみ)。
      // aiInvoked=false なので下の ai_call とは排他(二重記録しない)。
      this.auditLog.logCacheHit({
        flow: AUDIT_FLOW_BY_TOOL_FLOW[flow],
        contextHash: hashContext(dmContext)
      });
    } else if (turn.aiInvoked) {
      this.auditLog.logAiCall({
        flow: AUDIT_FLOW_BY_TOOL_FLOW[flow],
        contextHash: hashContext(dmContext),
        playerInput,
        responseText: turn.responseText,
        toolCalls: [...turn.toolCallRecords],
        durationMs,
        model: turn.model ?? "unknown",
        // 失敗種別・フォールバック有無を残す(表示系承認0件フォールバック等の事後診断のため)
        failureKind: turn.failureKind,
        usedFallback: turn.usedFallback
      });
    }
    // 縮退の発動を境界イベントとして記録
    if (turn.degradationActivated === "consecutive_failures") {
      this.auditLog.logBoundaryEvent({
        kind: "degraded_activated",
        reason: "同一フロー3回連続失敗による縮退"
      });
    } else if (turn.degradationActivated === "session_limit") {
      this.auditLog.logBoundaryEvent({
        kind: "session_limit_exceeded",
        reason: "セッション総数上限超過による縮退"
      });
    }
  }

  private aiResult(turn: AiTurnResult): GateResult {
    return {
      outcome: "ai",
      displayText: turn.displayText,
      approvedEffects: turn.approvedEffects,
      summaryText: turn.summaryText,
      aiInvoked: turn.aiInvoked,
      degraded: turn.degraded,
      turn
    };
  }

  private blockResult(
    outcome: Exclude<GateOutcome, "ai">,
    displayText: string,
    summaryText: string | null = null
  ): GateResult {
    return {
      outcome,
      displayText,
      approvedEffects: [],
      summaryText,
      aiInvoked: false,
      degraded: this.executor.isDegraded(),
      turn: null
    };
  }
}
