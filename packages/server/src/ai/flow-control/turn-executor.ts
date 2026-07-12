import { SUMMARY_MAX_LENGTH, type NpcId, type SubQuest } from "@dreaming-engine/shared";

import type { ToolCallRecord } from "../audit-log.js";
import type { AiConfig } from "../config.js";
import type {
  DreamMaster,
  DreamMasterContext,
  DreamMasterFailureKind,
  DreamMasterResult,
  DreamMasterRunOptions,
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
import { TurnCache, cacheKeyForContext, type CacheKey, type TurnCacheStats } from "./turn-cache.js";

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

/**
 * 1トリガーあたりのリトライ上限(ai-integration.md「リトライ」。サブスク枠保護)。
 * 初回に加えてこの回数まで DreamMaster を呼ぶ。失敗理由の組み合わせによらず超過しない。仕様固定値
 */
export const RETRY_LIMIT_PER_TRIGGER = 1;

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
  /**
   * メモ化キャッシュのヒットで検証済み表示専用ターンを再生したか(M26)。
   * true のとき aiInvoked=false・approvedEffects 空・失敗ではない。監査は ai_cache_hit として記録する
   * (ai_call ではない)。未設定=通常ターン(false 相当)。
   */
  readonly cacheHit?: boolean;
  /** 監査ログ用の応答テキスト(speak/narrate 連結 or 要約 or 生テキスト。なければ null) */
  readonly responseText: string | null;
  /** 使用モデル名(AIを呼んだ場合)。なければ null */
  readonly model: string | null;
  /** 監査ログ用: 各ツール呼び出しと検証結果 */
  readonly toolCallRecords: readonly ToolCallRecord[];
  /** 対話ストリーミングで未検証増分を1件以上先行転送したか(監査の streamed/retracted 用) */
  readonly streamed?: boolean;
}

/**
 * DreamMaster 1回の結果を評価した中間結果。**副作用は未確定**にしておき、
 * リトライ判定(表示系承認0件・DreamMaster失敗はリトライ対象)のあと finalizeOutcome で
 * 連続失敗カウントの記録・セッション状態の確定(commit)を行う。これにより、リトライする
 * 初回試行の副作用(検証カウンタ・好感度変化・失敗カウント)が漏れて二重適用にならない。
 */
type TurnOutcome =
  | {
      /** 成功(表示系承認あり)。commit で連続失敗カウントのリセットとセッション確定を行う */
      readonly kind: "success";
      readonly result: AiTurnResult;
      readonly commit: () => void;
    }
  | {
      /** DreamMaster 失敗(タイムアウト/APIエラー)。リトライ対象 */
      readonly kind: "dm_failure";
      readonly failure: DreamMasterFailureKind;
      readonly model: string;
    }
  | {
      /** 成功したが表示系(speak/narrate)承認0件(dream/generic フロー)。リトライ対象 */
      readonly kind: "display_zero";
      readonly model: string;
      readonly records: readonly ToolCallRecord[];
    }
  | {
      /** summary フローの出力壁却下。**リトライ対象外**(即失敗確定) */
      readonly kind: "summary_reject";
      readonly responseText: string | null;
      readonly model: string;
      readonly records: readonly ToolCallRecord[];
    };

/**
 * 対話ストリーミングの受け口(セッション層が実装。オーナー指示 2026-07-12)。
 * ターン実行器は各試行の最初のデルタ直前に onAttemptStart を呼ぶ
 * (リトライ時に再度呼ばれる=クライアントは表示バッファをクリアして再開する)。
 */
export interface SpeakStreamSink {
  onAttemptStart(): void;
  onDelta(delta: string): void;
}

/** executeTurn の入力 */
export interface AiTurnInput {
  /** DreamMaster 呼び出し用コンテキスト(flow を含む) */
  readonly dmContext: DreamMasterContext;
  /** 永続スナップショット(GameState 由来。読むだけで変更しない) */
  readonly persistent: PersistentStateContext;
  /** 会話セッション(会話・questGeneration のみ。dream/battleResult/summary は null) */
  readonly session: ConversationSession | null;
  /** 対話ストリーミングの受け口(未指定なら従来どおり非ストリーミング) */
  readonly speakStream?: SpeakStreamSink;
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
  /** 表示専用ターンのメモ化キャッシュ(メモリのみ・非永続・有界。M26) */
  private readonly turnCache = new TurnCache();
  /** キャッシュの有効/無効(config.cache.enabled。本番デフォルト true) */
  private readonly cacheEnabled: boolean;

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
    this.cacheEnabled = options.config.cache.enabled;
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

  /** メモ化キャッシュの観測カウンタ(hit/miss/store。デバッグ・テスト用) */
  public getCacheStats(): TurnCacheStats {
    return this.turnCache.stats();
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

    // 縮退中: AIを呼ばず定型フォールバック(AIを呼ばないブロックなので失敗に数えない)。
    // **縮退中はキャッシュを引かない**(早期リターンの意味を変えない: ai-integration.md「整合」)。
    if (this.isDegraded()) {
      return this.fallbackResult(flow, {
        failedTurn: false,
        failureKind: null,
        degradationActivated: null,
        aiInvoked: false
      });
    }

    // メモ化キャッシュ(DreamMaster.run 直前のルックアップ)。対象2フロー(戦果描写・会話開始挨拶)
    // かつ有効時のみ鍵を導出する。ヒットなら**AIを呼ばず**検証済みの表示テキストを即返す
    // (セッション総数を消費しない・失敗に数えない。許可判定=直列化/クールダウン/送信レートは
    // ゲートキーパーで先に適用済み。縮退中は上の早期リターンで既に除外)。
    const cacheKey = this.cacheEnabled ? cacheKeyForContext(input.dmContext) : null;
    if (cacheKey !== null) {
      const cached = this.turnCache.get(cacheKey);
      if (cached !== undefined) {
        return {
          flow,
          displayText: cached.displayText,
          approvedEffects: [],
          summaryText: null,
          usedFallback: false,
          failedTurn: false,
          failureKind: null,
          degraded: false,
          degradationActivated: null,
          aiInvoked: false,
          cacheHit: true,
          responseText: null,
          model: cached.model,
          toolCallRecords: []
        };
      }
    }

    // 初回 + リトライ最大1回(ai-integration.md「リトライ」)。リトライ対象は
    // 「DreamMaster失敗(タイムアウト/APIエラー)」と「成功したが表示系承認0件」。
    // 出力壁却下(summary)・成功はリトライしない。**1トリガーにつきリトライは最大1回**=
    // 失敗理由の組み合わせによらず2回目のリトライはしない(例: 初回timeout→リトライ→
    // 成功したが表示系0件、は display_approved_zero で確定し3回目を呼ばない: サブスク枠保護)。
    // 表示系0件の初回試行は副作用(検証カウンタ・失敗カウント・セッションcommit)を確定させず、
    // リトライは新しい turnState で再検証する(初回の副作用が漏れて二重適用にならない)。
    // 対話ストリーミング(オーナー指示 2026-07-12)。sink 未指定なら runOptions は undefined
    // のままで従来どおり(Live/Mock とも onSpeakDelta を渡さない呼び出しと等価)。
    // 各試行の最初の未検証デルタ直前に onAttemptStart を呼ぶ(リトライで再度呼ばれ得る=
    // クライアントは表示バッファをクリアして再開する)。空デルタは転送しない。
    let streamed = false;
    const sink = input.speakStream;
    for (let attempt = 0; attempt <= RETRY_LIMIT_PER_TRIGGER; attempt += 1) {
      let attemptStarted = false;
      const runOptions: DreamMasterRunOptions | undefined =
        sink === undefined
          ? undefined
          : {
              onSpeakDelta: (delta): void => {
                if (delta.length === 0) return;
                if (!attemptStarted) {
                  attemptStarted = true;
                  sink.onAttemptStart();
                }
                streamed = true;
                sink.onDelta(delta);
              }
            };
      const invoked = await this.invokeWithLimit(input.dmContext, runOptions);
      if (invoked.blocked) {
        // セッション総数上限で遮断(AIを呼ばないブロック=失敗に数えない)。
        // 初回(attempt=0)はまだ1度も呼んでいない。リトライ(attempt>0)は初回で呼んでいる
        const blockedResult = this.fallbackResult(flow, {
          failedTurn: false,
          failureKind: null,
          degradationActivated: invoked.justActivated ? "session_limit" : null,
          aiInvoked: attempt > 0
        });
        return streamed ? { ...blockedResult, streamed: true } : blockedResult;
      }
      const outcome = this.evaluateResult(flow, input, invoked.result);
      const retryable = outcome.kind === "dm_failure" || outcome.kind === "display_zero";
      if (retryable && attempt < RETRY_LIMIT_PER_TRIGGER) {
        // 副作用を確定させず次の試行へ(検証カウンタ・失敗カウント・セッションcommitは未確定)
        continue;
      }
      const finalized = this.finalizeOutcome(flow, outcome);
      const result = streamed ? { ...finalized, streamed: true } : finalized;
      // メモ化キャッシュ(DreamMaster.run 直後の格納)。**状態変更 effect を1件も含まない
      // 成功ターン**(フォールバック/縮退/却下でない・出力壁通過済み)だけを記憶する。
      if (cacheKey !== null) this.maybeStoreTurn(cacheKey, result);
      return result;
    }

    // ループは attempt=RETRY_LIMIT_PER_TRIGGER で必ず return する(到達しない。網羅性の保険)
    return this.fallbackResult(flow, {
      failedTurn: false,
      failureKind: null,
      degradationActivated: null,
      aiInvoked: true
    });
  }

  /**
   * このトリガーの最終結果が**記憶条件**を満たすときだけキャッシュへ格納する(DreamMaster.run 直後)。
   * 記憶条件(ai-integration.md 採用案A): 実際にAIを呼んで得た成功で、フォールバック/縮退/却下でなく、
   * **状態変更 effect を1件も含まない**(approvedEffects 空・summary でない)表示専用ターン。
   * これにより汚染テキスト・却下結果・副作用(adjust_affinity 等)がキャッシュに焼き込まれない。
   */
  private maybeStoreTurn(cacheKey: CacheKey, result: AiTurnResult): void {
    if (
      result.aiInvoked &&
      !result.usedFallback &&
      !result.failedTurn &&
      result.summaryText === null &&
      result.approvedEffects.length === 0 &&
      result.displayText.length > 0
    ) {
      this.turnCache.set(cacheKey, { displayText: result.displayText, model: result.model });
    }
  }

  /** DreamMaster 結果を TurnOutcome へ評価する(副作用なし。確定は finalizeOutcome) */
  private evaluateResult(
    flow: ToolFlow,
    input: AiTurnInput,
    result: DreamMasterResult
  ): TurnOutcome {
    if (!result.ok) {
      return { kind: "dm_failure", failure: result.failure, model: result.meta.model };
    }
    return this.handleSuccess(flow, input, result);
  }

  /**
   * TurnOutcome をこのトリガーの最終試行として確定する。成功は commit(連続失敗カウント0+
   * セッション確定)、失敗種別は連続失敗カウントを記録して定型フォールバックへ。
   */
  private finalizeOutcome(flow: ToolFlow, outcome: TurnOutcome): AiTurnResult {
    switch (outcome.kind) {
      case "success":
        outcome.commit();
        return outcome.result;
      case "dm_failure": {
        const activated = this.recordConsecutiveFailure(flow);
        return this.fallbackResult(flow, {
          failedTurn: true,
          failureKind: outcome.failure,
          degradationActivated: activated,
          aiInvoked: true,
          model: outcome.model
        });
      }
      case "display_zero": {
        const activated = this.recordConsecutiveFailure(flow);
        return this.fallbackResult(flow, {
          failedTurn: true,
          failureKind: "display_approved_zero",
          degradationActivated: activated,
          aiInvoked: true,
          model: outcome.model,
          toolCallRecords: outcome.records
        });
      }
      case "summary_reject": {
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
          responseText: outcome.responseText,
          model: outcome.model,
          toolCallRecords: outcome.records
        };
      }
    }
  }

  // -------------------------------------------------------------------------
  // DreamMaster 呼び出し(セッション総数上限)
  // -------------------------------------------------------------------------

  private async invokeWithLimit(
    ctx: DreamMasterContext,
    runOptions?: DreamMasterRunOptions
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
    const result = await this.dreamMaster.run(ctx, runOptions);
    return { blocked: false, result };
  }

  // -------------------------------------------------------------------------
  // 成功ターンの処理(フロー別)
  // -------------------------------------------------------------------------

  private handleSuccess(
    flow: ToolFlow,
    input: AiTurnInput,
    result: DreamMasterSuccess
  ): TurnOutcome {
    if (flow === "summary") return this.handleSummarySuccess(result);
    if (flow === "dream") return this.handleDreamSuccess(input, result);
    return this.handleGenericSuccess(flow, input, result);
  }

  /**
   * 会話要約(ツールなし・テキスト出力に出力壁)。失敗はタイムアウト/エラー/出力壁却下の3種。
   * **出力壁却下はリトライ対象外**なので summary_reject として即失敗確定へ回す(表示系0件判定は非適用)。
   */
  private handleSummarySuccess(result: DreamMasterSuccess): TurnOutcome {
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
      return { kind: "summary_reject", responseText: raw, model, records };
    }

    const normalized = checked.normalized;
    const outcome: AiTurnResult = {
      flow: "summary",
      displayText: "",
      approvedEffects: [],
      summaryText: normalized,
      usedFallback: false,
      failedTurn: false,
      failureKind: null,
      degraded: this.isDegraded(),
      degradationActivated: null,
      aiInvoked: true,
      responseText: normalized,
      model,
      toolCallRecords: records
    };
    return {
      kind: "success",
      result: outcome,
      commit: () => {
        this.consecutiveFailures.summary = 0;
      }
    };
  }

  /** 夢シーン(narrate + trigger_world_event)。世界変化は最大3件・解決規則をバッチ適用 */
  private handleDreamSuccess(input: AiTurnInput, result: DreamMasterSuccess): TurnOutcome {
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
      dungeonSymbolCounts: input.persistent.dungeonSymbolCounts,
      dreamErosion: input.persistent.dreamErosion
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

    // 表示系(narrate)承認0件 → リトライ対象(display_zero)。確定は finalizeOutcome。
    // 世界変化はオール・オア・ナッシングで破棄する(承認済み effect を採用しない)
    if (narrateTexts.length === 0) {
      return { kind: "display_zero", model, records };
    }

    const displayText = narrateTexts.join("\n");
    const outcome: AiTurnResult = {
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
    return {
      kind: "success",
      result: outcome,
      commit: () => {
        this.consecutiveFailures.dream = 0;
      }
    };
  }

  /** 会話 / サブクエスト生成 / 戦果描写(逐次ツール検証。表示系0件でオール・オア・ナッシング) */
  private handleGenericSuccess(
    flow: ToolFlow,
    input: AiTurnInput,
    result: DreamMasterSuccess
  ): TurnOutcome {
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

    // 表示系(speak/narrate)承認0件 → リトライ対象(display_zero)。確定は finalizeOutcome。
    // 承認済み状態変更(commits)はここでは実行せず破棄(オール・オア・ナッシング)。
    // commits を実行しないため、リトライは新しい turnState で再検証され二重適用にならない
    if (displayTexts.length === 0) {
      return { kind: "display_zero", model, records };
    }

    const displayText = displayTexts.join("\n");
    const outcome: AiTurnResult = {
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
    return {
      kind: "success",
      result: outcome,
      commit: () => {
        // 採用: セッションの会話内カウンタ・提案スロットを確定
        for (const commit of commits) commit();
        this.consecutiveFailures[flow] = 0;
      }
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
        dreamErosion: input.persistent.dreamErosion,
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
