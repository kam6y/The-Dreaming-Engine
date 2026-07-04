import { SUMMARY_MAX_LENGTH, type NpcId, type SubQuest } from "@dreaming-engine/shared";

import type { ToolCallRecord } from "../audit-log.js";
import type { AiConfig } from "../config.js";
import type {
  DreamMaster,
  DreamMasterContext,
  DreamMasterFailureKind,
  DreamMasterResult,
  DreamMasterSuccess
} from "../dream-master/types.js";
import { checkDisplayText } from "../output-wall.js";
import { validateDreamEvents, validateToolCall } from "../tool-validation/index.js";
import type {
  AdjustAffinityEffect,
  DreamEventsEffect,
  GiveItemEffect,
  PersistentStateContext,
  ProposeQuestEffect,
  ToolFlow,
  ToolValidationContext
} from "../tool-validation/types.js";
import { fallbackTextForFlow } from "./fallback-text.js";
import type { ConversationSession } from "./session.js";

/**
 * AIターン実行器(ai-integration.md「呼び出しフロー別仕様」246-278)。
 *
 * 1トリガー=1ターンとして DreamMaster を呼び、失敗リトライ(1回)・ツール検証・
 * 失敗ターンのオール・オア・ナッシング・縮退状態機械・セッション総数上限を司る。
 *
 * **このサービスは GameState を変更しない**。検証済みの effect と表示テキスト(または
 * 定型フォールバック)を返すだけで、適用・WS送出・セーブは行わない(それは M4-E)。
 * 保護状態(セッション総数カウント・連続失敗カウント・縮退フラグ)は**ランタイム状態**として
 * このクラスが保持する(セーブに載せない)。
 */

/** 縮退を発動する連続失敗回数(ai-integration.md 259「同一フローで3回連続の失敗」)。仕様固定値 */
export const DEGRADE_CONSECUTIVE_FAILURE_THRESHOLD = 3;

/** ターンの失敗種別。DreamMaster 失敗3種 + 検証由来2種 */
export type AiTurnFailureKind =
  | DreamMasterFailureKind
  | "display_approved_zero"
  | "output_wall_rejected";

/** 縮退の発動要因(監査ログ用) */
export type DegradationCause = "consecutive_failures" | "session_limit";

/** M4-E が適用する状態変更 effect(表示系 speak/narrate は displayText に集約するため含めない) */
export type StateChangeEffect =
  | AdjustAffinityEffect
  | GiveItemEffect
  | ProposeQuestEffect
  | DreamEventsEffect;

/** AIターン実行の結果(構造化。GameState 適用は M4-E が行う) */
export interface AiTurnResult {
  readonly flow: ToolFlow;
  /** 表示テキスト(承認 speak/narrate の連結、または定型フォールバック)。summary は空 */
  readonly displayText: string;
  /** 承認された状態変更 effect(オール・オア・ナッシング破棄後)。summary/フォールバックは空 */
  readonly approvedEffects: readonly StateChangeEffect[];
  /** summary フローの検証済み要約(出力壁通過)。他フロー・失敗時は null(M4-E は既存要約を維持) */
  readonly summaryText: string | null;
  /** 定型フォールバックで進行したか(AIを呼ばなかった or 破棄した) */
  readonly usedFallback: boolean;
  /** このトリガーが「1失敗」に数えられたか(縮退の連続カウント対象) */
  readonly failedTurn: boolean;
  /** 失敗種別(failedTurn=true のときのみ非 null) */
  readonly failureKind: AiTurnFailureKind | null;
  /** 実行後にサービスが縮退中か(選択肢のみモードの判断材料) */
  readonly degraded: boolean;
  /** このトリガーで縮退が新たに発動したか(監査ログ用。境界イベントの記録は M4-C2 が行う) */
  readonly degradationActivated: DegradationCause | null;
  /** DreamMaster を実際に呼んだか(監査ログ・失敗計上の可否) */
  readonly aiInvoked: boolean;
  /** 監査ログ用の応答テキスト(speak/narrate 連結 or 要約 or 生テキスト。なければ null) */
  readonly responseText: string | null;
  /** 使用モデル名(AIを呼んだ場合)。なければ null */
  readonly model: string | null;
  /** 監査ログ用: 各ツール呼び出しと検証結果 */
  readonly toolCallRecords: readonly ToolCallRecord[];
}

/** executeTurn の入力 */
export interface AiTurnInput {
  /** DreamMaster 呼び出し用コンテキスト(flow を含む) */
  readonly dmContext: DreamMasterContext;
  /** 永続スナップショット(GameState 由来。読むだけで変更しない) */
  readonly persistent: PersistentStateContext;
  /** 会話セッション(会話・questGeneration のみ。dream/battleResult/summary は null) */
  readonly session: ConversationSession | null;
}

export interface AiTurnExecutorOptions {
  readonly dreamMaster: DreamMaster;
  readonly config: AiConfig;
}

/** ターン内で逐次更新する検証カウンタ(同一ターン内の複数ツール呼び出しで上限を正しく効かせる) */
interface MutableTurnState {
  adjustAffinityCount: number;
  giveItemCount: number;
  pendingProposal: SubQuest | null;
  giveItemCountToday: number;
  proposeQuestCount: number;
  rewardItemProposalCount: number;
  affinityDeltaByNpc: Record<NpcId, number>;
  affinityByNpc: Record<NpcId, number>;
}

function emptyFailureCounts(): Record<ToolFlow, number> {
  return { conversation: 0, questGeneration: 0, dream: 0, battleResult: 0, summary: 0 };
}

/** 生の trigger_world_event 入力({event}) から event フィールドを取り出す(なければそのまま) */
function extractEventField(rawInput: unknown): unknown {
  if (typeof rawInput === "object" && rawInput !== null && "event" in rawInput) {
    return rawInput.event;
  }
  return rawInput;
}

export class AiTurnExecutor {
  private readonly dreamMaster: DreamMaster;
  private readonly sessionCallLimit: number;

  private sessionCallCount = 0;
  /** 通常縮退(3連続失敗)。日送りで解除できる */
  private normalDegraded = false;
  /** セッション総数上限縮退。日送りでは解除しない(サーバー再起動/設定のみ) */
  private sessionLimitDegraded = false;
  /** フロー別の連続失敗カウント(ai-integration.md 259「同一フロー」) */
  private consecutiveFailures: Record<ToolFlow, number> = emptyFailureCounts();

  public constructor(options: AiTurnExecutorOptions) {
    this.dreamMaster = options.dreamMaster;
    this.sessionCallLimit = options.config.sessionCallLimit;
  }

  // -------------------------------------------------------------------------
  // 縮退状態・カウンタの照会(M4-C2 / テスト用)
  // -------------------------------------------------------------------------

  public isDegraded(): boolean {
    return this.normalDegraded || this.sessionLimitDegraded;
  }

  public isNormalDegraded(): boolean {
    return this.normalDegraded;
  }

  public isSessionLimitDegraded(): boolean {
    return this.sessionLimitDegraded;
  }

  public getSessionCallCount(): number {
    return this.sessionCallCount;
  }

  public getConsecutiveFailures(flow: ToolFlow): number {
    return this.consecutiveFailures[flow];
  }

  /**
   * 通常縮退(3連続失敗)を解除し、連続失敗カウントを0に戻す(ai-integration.md 271-274)。
   * **セッション総数上限縮退は解除しない**(上限保護の無効化を防ぐ: 同 276-277)。
   * 日送り完了時に M4-C2 の day-advance フックから呼ぶ。解除したら true を返す(監査記録用)。
   */
  public clearNormalDegradation(): boolean {
    if (!this.normalDegraded) return false;
    this.normalDegraded = false;
    this.consecutiveFailures = emptyFailureCounts();
    return true;
  }

  // -------------------------------------------------------------------------
  // ターン実行
  // -------------------------------------------------------------------------

  public async executeTurn(input: AiTurnInput): Promise<AiTurnResult> {
    const flow = input.dmContext.flow;

    // 縮退中: AIを呼ばず定型フォールバック(AIを呼ばないブロックなので失敗に数えない)
    if (this.isDegraded()) {
      return this.fallbackResult(flow, {
        failedTurn: false,
        failureKind: null,
        degradationActivated: null,
        aiInvoked: false
      });
    }

    // 初回呼び出し(セッション総数上限ゲート付き)
    const first = await this.invokeWithLimit(input.dmContext);
    if (first.blocked) {
      return this.fallbackResult(flow, {
        failedTurn: false,
        failureKind: null,
        degradationActivated: first.justActivated ? "session_limit" : null,
        aiInvoked: false
      });
    }
    let result: DreamMasterResult = first.result;

    // リトライは失敗(タイムアウト/APIエラー)のみ1回
    if (!result.ok) {
      const second = await this.invokeWithLimit(input.dmContext);
      if (second.blocked) {
        // リトライがセッション上限で遮断。縮退へ移行(連続カウントは活性化でリセット済み)
        return this.fallbackResult(flow, {
          failedTurn: false,
          failureKind: null,
          degradationActivated: second.justActivated ? "session_limit" : null,
          aiInvoked: true
        });
      }
      result = second.result;
    }

    if (!result.ok) {
      // 初回+リトライの両方が失敗 → このトリガーを1失敗とする
      const activated = this.recordConsecutiveFailure(flow);
      return this.fallbackResult(flow, {
        failedTurn: true,
        failureKind: result.failure,
        degradationActivated: activated,
        aiInvoked: true,
        model: result.meta.model
      });
    }

    return this.handleSuccess(flow, input, result);
  }

  // -------------------------------------------------------------------------
  // DreamMaster 呼び出し(セッション総数上限)
  // -------------------------------------------------------------------------

  private async invokeWithLimit(
    ctx: DreamMasterContext
  ): Promise<
    | { readonly blocked: true; readonly justActivated: boolean }
    | { readonly blocked: false; readonly result: DreamMasterResult }
  > {
    // 呼ぶ前に上限を検査。到達していればセッション上限縮退を発動しブロック
    if (this.sessionCallCount >= this.sessionCallLimit) {
      const justActivated = this.activateSessionLimitDegraded();
      return { blocked: true, justActivated };
    }
    // 呼ぶ前にカウンタ +1(AI_MODE 非依存。モックでも数える)
    this.sessionCallCount += 1;
    const result = await this.dreamMaster.run(ctx);
    return { blocked: false, result };
  }

  // -------------------------------------------------------------------------
  // 成功ターンの処理(フロー別)
  // -------------------------------------------------------------------------

  private handleSuccess(
    flow: ToolFlow,
    input: AiTurnInput,
    result: DreamMasterSuccess
  ): AiTurnResult {
    if (flow === "summary") return this.handleSummarySuccess(result);
    if (flow === "dream") return this.handleDreamSuccess(input, result);
    return this.handleGenericSuccess(flow, input, result);
  }

  /** 会話要約(ツールなし・テキスト出力に出力壁)。失敗はタイムアウト/エラー/出力壁却下の3種 */
  private handleSummarySuccess(result: DreamMasterSuccess): AiTurnResult {
    const model = result.meta.model;
    const raw = result.text;
    const checked = raw !== null ? checkDisplayText(raw, { maxLength: SUMMARY_MAX_LENGTH }) : null;
    // summary はツールを持たないため、万一のツール意図は却下として監査に残す
    const records: ToolCallRecord[] = result.toolCalls.map((tc) => ({
      name: tc.toolName,
      input: tc.rawInput,
      result: "rejected",
      reason: "summary フローではツールを許可しない"
    }));

    if (checked === null || !checked.ok) {
      const activated = this.recordConsecutiveFailure("summary");
      return {
        flow: "summary",
        displayText: "",
        approvedEffects: [],
        summaryText: null,
        usedFallback: true,
        failedTurn: true,
        failureKind: "output_wall_rejected",
        degraded: this.isDegraded(),
        degradationActivated: activated,
        aiInvoked: true,
        responseText: raw,
        model,
        toolCallRecords: records
      };
    }

    this.consecutiveFailures.summary = 0;
    return {
      flow: "summary",
      displayText: "",
      approvedEffects: [],
      summaryText: checked.normalized,
      usedFallback: false,
      failedTurn: false,
      failureKind: null,
      degraded: this.isDegraded(),
      degradationActivated: null,
      aiInvoked: true,
      responseText: checked.normalized,
      model,
      toolCallRecords: records
    };
  }

  /** 夢シーン(narrate + trigger_world_event)。世界変化は最大3件・解決規則をバッチ適用 */
  private handleDreamSuccess(input: AiTurnInput, result: DreamMasterSuccess): AiTurnResult {
    const model = result.meta.model;
    const records: ToolCallRecord[] = [];
    const narrateTexts: string[] = [];
    const rawEvents: unknown[] = [];
    const worldEventCalls: { rawInput: unknown; eventIndex: number }[] = [];
    const dreamCtx: ToolValidationContext = { session: null, persistent: input.persistent };

    for (const tc of result.toolCalls) {
      if (tc.toolName === "narrate") {
        const vr = validateToolCall("dream", "narrate", tc.rawInput, dreamCtx);
        if (vr.ok && vr.effect.kind === "narrate") {
          narrateTexts.push(vr.effect.text);
          records.push({ name: "narrate", input: tc.rawInput, result: "approved" });
        } else {
          records.push({
            name: "narrate",
            input: tc.rawInput,
            result: "rejected",
            reason: vr.ok ? "narrate: 予期しない effect" : vr.reason
          });
        }
      } else if (tc.toolName === "trigger_world_event") {
        worldEventCalls.push({ rawInput: tc.rawInput, eventIndex: rawEvents.length });
        rawEvents.push(extractEventField(tc.rawInput));
      } else {
        records.push({
          name: tc.toolName,
          input: tc.rawInput,
          result: "rejected",
          reason: `フロー dream でツール ${tc.toolName} は許可されていない`
        });
      }
    }

    // 世界変化をバッチ検証(最大3件・後勝ち/累積などの解決規則)
    const dreamEvents = validateDreamEvents(rawEvents, {
      dungeonSymbolCounts: input.persistent.dungeonSymbolCounts
    });
    for (const call of worldEventCalls) {
      const rej = dreamEvents.rejected.find((r) => r.index === call.eventIndex);
      records.push({
        name: "trigger_world_event",
        input: call.rawInput,
        result: rej ? "rejected" : "approved",
        ...(rej ? { reason: rej.reason } : {})
      });
    }

    // 表示系(narrate)承認0件 → オール・オア・ナッシング破棄(世界変化なし)+1失敗
    if (narrateTexts.length === 0) {
      const activated = this.recordConsecutiveFailure("dream");
      return this.fallbackResult("dream", {
        failedTurn: true,
        failureKind: "display_approved_zero",
        degradationActivated: activated,
        aiInvoked: true,
        model,
        toolCallRecords: records
      });
    }

    this.consecutiveFailures.dream = 0;
    const displayText = narrateTexts.join("\n");
    return {
      flow: "dream",
      displayText,
      approvedEffects: [dreamEvents.effect],
      summaryText: null,
      usedFallback: false,
      failedTurn: false,
      failureKind: null,
      degraded: this.isDegraded(),
      degradationActivated: null,
      aiInvoked: true,
      responseText: displayText,
      model,
      toolCallRecords: records
    };
  }

  /** 会話 / サブクエスト生成 / 戦果描写(逐次ツール検証。表示系0件でオール・オア・ナッシング) */
  private handleGenericSuccess(
    flow: ToolFlow,
    input: AiTurnInput,
    result: DreamMasterSuccess
  ): AiTurnResult {
    const model = result.meta.model;
    const session = input.session;
    const turn = this.initTurnState(input, session);
    const records: ToolCallRecord[] = [];
    const displayTexts: string[] = [];
    const stateEffects: StateChangeEffect[] = [];
    const commits: (() => void)[] = [];

    for (const tc of result.toolCalls) {
      const ctx = this.buildValidationContext(input, session, turn);
      const vr = validateToolCall(flow, tc.toolName, tc.rawInput, ctx);
      if (!vr.ok) {
        records.push({ name: tc.toolName, input: tc.rawInput, result: "rejected", reason: vr.reason });
        continue;
      }
      records.push({ name: tc.toolName, input: tc.rawInput, result: "approved" });
      const eff = vr.effect;
      switch (eff.kind) {
        case "speak":
        case "narrate":
          displayTexts.push(eff.text);
          break;
        case "adjust_affinity": {
          const npcId = eff.npcId;
          turn.adjustAffinityCount += 1;
          turn.affinityDeltaByNpc[npcId] += eff.delta;
          turn.affinityByNpc[npcId] = eff.affinity;
          stateEffects.push(eff);
          commits.push(() => session?.recordAdjustAffinity());
          break;
        }
        case "give_item":
          turn.giveItemCount += 1;
          turn.giveItemCountToday += 1;
          stateEffects.push(eff);
          commits.push(() => session?.recordGiveItem());
          break;
        case "propose_quest": {
          const quest = eff.quest;
          turn.pendingProposal = quest;
          turn.proposeQuestCount += 1;
          if (quest.rewardItemId !== undefined) turn.rewardItemProposalCount += 1;
          stateEffects.push(eff);
          commits.push(() => session?.setPendingProposal(quest));
          break;
        }
        case "world_event":
          // これらのフローでは trigger_world_event は allowlist で却下されるため到達しない
          break;
      }
    }

    // 表示系(speak/narrate)承認0件 → 承認済み状態変更も破棄 + 定型フォールバック + 1失敗
    if (displayTexts.length === 0) {
      const activated = this.recordConsecutiveFailure(flow);
      return this.fallbackResult(flow, {
        failedTurn: true,
        failureKind: "display_approved_zero",
        degradationActivated: activated,
        aiInvoked: true,
        model,
        toolCallRecords: records
      });
    }

    // 採用: セッションの会話内カウンタ・提案スロットを確定
    for (const commit of commits) commit();
    this.consecutiveFailures[flow] = 0;
    const displayText = displayTexts.join("\n");
    return {
      flow,
      displayText,
      approvedEffects: stateEffects,
      summaryText: null,
      usedFallback: false,
      failedTurn: false,
      failureKind: null,
      degraded: this.isDegraded(),
      degradationActivated: null,
      aiInvoked: true,
      responseText: displayText,
      model,
      toolCallRecords: records
    };
  }

  // -------------------------------------------------------------------------
  // ターン内検証状態
  // -------------------------------------------------------------------------

  private initTurnState(input: AiTurnInput, session: ConversationSession | null): MutableTurnState {
    const daily = input.persistent.aiDaily;
    return {
      adjustAffinityCount: session?.getAdjustAffinityCount() ?? 0,
      giveItemCount: session?.getGiveItemCount() ?? 0,
      pendingProposal: session?.getPendingProposal() ?? null,
      giveItemCountToday: daily.giveItemCount,
      proposeQuestCount: daily.proposeQuestCount,
      rewardItemProposalCount: daily.rewardItemProposalCount,
      affinityDeltaByNpc: { ...daily.affinityDeltaByNpc },
      affinityByNpc: { ...input.persistent.affinityByNpc }
    };
  }

  private buildValidationContext(
    input: AiTurnInput,
    session: ConversationSession | null,
    turn: MutableTurnState
  ): ToolValidationContext {
    return {
      session:
        session === null
          ? null
          : {
              partnerNpcId: session.partnerNpcId,
              affinityAtOpen: session.affinityAtOpen,
              adjustAffinityCount: turn.adjustAffinityCount,
              giveItemCount: turn.giveItemCount,
              pendingProposal: turn.pendingProposal
            },
      persistent: {
        aiDaily: {
          giveItemCount: turn.giveItemCountToday,
          proposeQuestCount: turn.proposeQuestCount,
          rewardItemProposalCount: turn.rewardItemProposalCount,
          affinityDeltaByNpc: turn.affinityDeltaByNpc
        },
        affinityByNpc: turn.affinityByNpc,
        inventory: input.persistent.inventory,
        subQuests: input.persistent.subQuests,
        dungeonSymbolCounts: input.persistent.dungeonSymbolCounts,
        nextQuestId: input.persistent.nextQuestId
      }
    };
  }

  // -------------------------------------------------------------------------
  // 縮退状態機械
  // -------------------------------------------------------------------------

  /** 該当フローの連続失敗を+1し、閾値到達で通常縮退を発動する。発動したら要因を返す */
  private recordConsecutiveFailure(flow: ToolFlow): DegradationCause | null {
    const next = this.consecutiveFailures[flow] + 1;
    this.consecutiveFailures[flow] = next;
    if (next >= DEGRADE_CONSECUTIVE_FAILURE_THRESHOLD) {
      this.normalDegraded = true;
      // 発動時に連続失敗カウントを0へ(解除直後の1失敗で即再発動しない)
      this.consecutiveFailures = emptyFailureCounts();
      return "consecutive_failures";
    }
    return null;
  }

  /** セッション総数上限縮退を発動する(まだなら)。発動時は連続失敗カウントも0へ */
  private activateSessionLimitDegraded(): boolean {
    if (this.sessionLimitDegraded) return false;
    this.sessionLimitDegraded = true;
    this.consecutiveFailures = emptyFailureCounts();
    return true;
  }

  // -------------------------------------------------------------------------
  // フォールバック結果の組み立て
  // -------------------------------------------------------------------------

  private fallbackResult(
    flow: ToolFlow,
    opts: {
      failedTurn: boolean;
      failureKind: AiTurnFailureKind | null;
      degradationActivated: DegradationCause | null;
      aiInvoked: boolean;
      model?: string | null;
      responseText?: string | null;
      toolCallRecords?: readonly ToolCallRecord[];
    }
  ): AiTurnResult {
    return {
      flow,
      displayText: fallbackTextForFlow(flow),
      approvedEffects: [],
      summaryText: null,
      usedFallback: true,
      failedTurn: opts.failedTurn,
      failureKind: opts.failureKind,
      degraded: this.isDegraded(),
      degradationActivated: opts.degradationActivated,
      aiInvoked: opts.aiInvoked,
      responseText: opts.responseText ?? null,
      model: opts.model ?? null,
      toolCallRecords: opts.toolCallRecords ?? []
    };
  }
}
