import {
  createSdkMcpServer,
  query as sdkQuery,
  tool,
  type CanUseTool,
  type Options,
  type PermissionResult
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { resolveAiAuth } from "../auth.js";
import type { AiConfig } from "../config.js";
import { FLOW_TOOL_ALLOWLIST, type ToolFlow, type ToolName } from "../tool-validation/types.js";
import { resolveFlowSpec } from "./flow-spec.js";
import { buildPrompt } from "./prompt.js";
import type {
  DreamMaster,
  DreamMasterContext,
  DreamMasterFailureKind,
  DreamMasterResult,
  DreamMasterRunOptions,
  RawToolCall
} from "./types.js";

/**
 * LiveDreamMaster(実AI = `@anthropic-ai/claude-agent-sdk` 実装。M4-D)。
 *
 * セキュリティ姿勢(ai-integration.md「AIサンドボックス」48-72 / guardrails 第1層):
 * - カスタムMCPサーバーに **現在フローの許可ツールだけ** を登録し(呼び出しごとに設定)、
 *   `allowedTools` で事前承認、`disallowedTools` で組み込みツールを明示遮断、
 *   `canUseTool` を **デフォルト拒否**(許可集合内のカスタムツール以外は組み込み含め全拒否)にする。
 * - `settingSources: []`(CLAUDE.md・FS設定を読まない)、`strictMcpConfig: true`
 *   (.mcp.json・プラグイン等の他MCPを無視)、`systemPrompt` は世界観憲法の文字列
 *   (`claude_code` プリセット不使用)、`tools` 未指定(組み込みプリセットを積まない)、
 *   `permissionMode: 'default'`、`allowDangerouslySkipPermissions` は設定しない(bypass 禁止)、
 *   `persistSession: false`(プレイヤー入力を SDK セッション履歴として外部へ焼かない)。
 * - **ツールハンドラは呼び出しの生 intent を記録して無害な ack を返すだけ**。検証・適用は
 *   フロー制御(turn-executor)+ 検証層の責務(本クラスは行わない)。
 * - 認証は `auth.ts` が OAuth 優先で解決した env をサブプロセスへ渡す。
 * - **実AI呼び出し(query)は run 実行時のみ**。import・構築時には呼ばない。
 *
 * 既知の制約: Agent SDK の `Options` には「1応答あたりの出力トークン上限」を直接表す項目が
 * 無い(sdk.d.ts)。出力量は `maxTurns` と出力壁(表示系テキストの長さ上限で超過を却下)で
 * 有界化する。config の maxOutputTokens は FlowSpec に保持し、SDK が直接口を持てば渡せるよう
 * 残す(現状は未使用。最終報告に既知の問題として記載)。
 */

/** カスタムMCPサーバー名。ツールの完全名は `mcp__<server>__<tool>`(SDK 規約) */
export const DREAM_SERVER_NAME = "dream";

/** ToolName → SDK 上の完全なツール名(`mcp__dream__speak` 等) */
export function mcpToolName(toolName: ToolName): string {
  return `mcp__${DREAM_SERVER_NAME}__${toolName}`;
}

/** 現在フローの許可ツールを SDK 完全名の集合へ写像する */
export function buildAllowedToolNames(flow: ToolFlow): ReadonlySet<string> {
  return new Set(FLOW_TOOL_ALLOWLIST[flow].map(mcpToolName));
}

/**
 * 明示遮断する組み込みツール(guardrails 第1層「disallowedTools での明示拒否」)。
 * これは防御の一段目であり、**権威的な最終防壁は `canUseTool` のデフォルト拒否**である
 * (未列挙の未知ツールも canUseTool が拒否する)。
 */
export const DISALLOWED_BUILTIN_TOOLS: readonly string[] = [
  "Bash",
  "BashOutput",
  "KillBash",
  "KillShell",
  "Read",
  "Write",
  "Edit",
  "MultiEdit",
  "NotebookEdit",
  "NotebookRead",
  "Glob",
  "Grep",
  "LS",
  "WebFetch",
  "WebSearch",
  "Task",
  "Agent",
  "TodoWrite",
  "ExitPlanMode",
  "Skill",
  "SlashCommand",
  "AskUserQuestion",
  "ListMcpResources",
  "ReadMcpResource"
];

/** 却下・拒否時に AI へ返す世界観内の中立文(再試行を促さない: guardrails 第1層) */
const DENY_MESSAGE = "……その行いは、この夢では形にならなかった。";
/** ツールハンドラが返す無害な ack(検証・適用はここでは行わない) */
const TOOL_ACK_TEXT = "(その言葉は夢に刻まれた)";

/**
 * canUseTool を組み立てる(**デフォルト拒否**の権威的二重チェック: guardrails 第1層)。
 * 現在フローの許可集合にある `mcp__dream__<tool>` のみ allow。組み込み・クロスフロー・
 * 未知ツールはすべて deny。
 */
export function makeCanUseTool(allowedNames: ReadonlySet<string>): CanUseTool {
  return async (toolName, input): Promise<PermissionResult> => {
    if (allowedNames.has(toolName)) {
      return { behavior: "allow", updatedInput: input };
    }
    return { behavior: "deny", message: DENY_MESSAGE };
  };
}

// ---------------------------------------------------------------------------
// カスタムツール定義(6種)。ハンドラは生 intent を記録して ack を返すだけ。
// 入力スキーマは緩め(型は string/number)にし、**厳密検証は検証層に委ねる**
// (SDK スキーマを防御境界にしない。生の意図をそのまま検証層へ渡す: guardrails 第1層)。
// ---------------------------------------------------------------------------

type Recorder = (call: RawToolCall) => void;

function ackResult(): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: TOOL_ACK_TEXT }] };
}

/** 生 intent を記録して無害な ack を返すハンドラ(全ツール共通。args は生値として扱う) */
function makeHandler(toolName: ToolName, record: Recorder): (args: unknown) => Promise<{ content: { type: "text"; text: string }[] }> {
  return async (args: unknown) => {
    record({ toolName, rawInput: args });
    return ackResult();
  };
}

/** フローの許可ツールぶんだけの SDK ツール定義を作る(呼び出しごとに許可ツールを設定) */
export function buildFlowTools(allowed: readonly ToolName[], record: Recorder) {
  const builders = {
    speak: () =>
      tool(
        "speak",
        "NPCの発話。{ text } を渡す(空白除去後1字以上・400字以内・日本語)。",
        { text: z.string() },
        makeHandler("speak", record)
      ),
    narrate: () =>
      tool(
        "narrate",
        "情景・戦果の描写。{ text } を渡す(1字以上・300字以内・日本語)。状態は変えない。",
        { text: z.string() },
        makeHandler("narrate", record)
      ),
    adjust_affinity: () =>
      tool(
        "adjust_affinity",
        "会話相手NPCの好感度を微調整。{ npcId, delta(-10..+10 整数), reason }。1会話2回まで。",
        { npcId: z.string(), delta: z.number(), reason: z.string() },
        makeHandler("adjust_affinity", record)
      ),
    give_item: () =>
      tool(
        "give_item",
        "会話相手に消耗品を贈る。{ itemId, quantity(1..3 整数), reason }。好感度50以上で解禁。",
        { itemId: z.string(), quantity: z.number(), reason: z.string() },
        makeHandler("give_item", record)
      ),
    propose_quest: () =>
      tool(
        "propose_quest",
        "サブクエストを1件提案。{ type('hunt'|'fetch'), targetId, count(1..5), rewardGold(10..100), rewardItemId?, title, description }。対象は候補一覧に限る。",
        {
          type: z.string(),
          targetId: z.string(),
          count: z.number(),
          rewardGold: z.number(),
          rewardItemId: z.string().optional(),
          title: z.string(),
          description: z.string()
        },
        makeHandler("propose_quest", record)
      ),
    trigger_world_event: () =>
      tool(
        "trigger_world_event",
        "翌朝の世界変化を1件起こす(夢シーン専用)。{ event: { kind, ... } }。1夜3件まで。",
        {
          event: z.object({
            kind: z.string(),
            value: z.string().optional(),
            npcId: z.string().optional(),
            rumor: z.string().optional(),
            eventId: z.string().optional(),
            layer: z.number().optional(),
            symbolCountDelta: z.number().optional()
          })
        },
        makeHandler("trigger_world_event", record)
      )
  } as const satisfies Record<ToolName, () => unknown>;

  return allowed.map((name) => builders[name]());
}

// ---------------------------------------------------------------------------
// タイムアウト2値つきストリーム消費(初回/全体)。偽の async iterable でテスト可能。
// ---------------------------------------------------------------------------

/** SDK メッセージの必要最小フィールドだけを見る構造型(実 SDKMessage も代入可能) */
export interface SdkMessageLike {
  readonly type: string;
  readonly subtype?: string;
  readonly result?: string;
}

type TimerHandle = ReturnType<typeof setTimeout>;

/** タイマ抽象(テストで差し替え可能。既定は global setTimeout/clearTimeout) */
export interface StreamTimers {
  set(fn: () => void, ms: number): TimerHandle;
  clear(handle: TimerHandle): void;
}

const DEFAULT_TIMERS: StreamTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle)
};

export interface DrainDeps {
  readonly firstTokenMs: number;
  readonly totalMs: number;
  /** タイムアウト・外部シグナルで query をキャンセルするための AbortController */
  readonly abortController: AbortController;
  /** 呼び出し側の任意キャンセル(全体タイムアウト等)。abort されたら timeout_total 扱い */
  readonly signal?: AbortSignal;
  readonly timers?: StreamTimers;
}

export type DrainResult =
  | { readonly ok: true; readonly text: string | null }
  | { readonly ok: false; readonly failure: DreamMasterFailureKind };

/**
 * ストリームを消費し、初回トークン/全体のタイムアウトを強制する。
 * - 初回メッセージ未受信のまま firstTokenMs 超過 → timeout_first
 * - 全体が totalMs 超過(または外部 signal abort)→ timeout_total
 * - result(subtype:success)→ ok(text=結果テキスト)
 * - result(error)・result 無しでストリーム終了・SDK例外 → api_error
 */
export function drainStream(stream: AsyncIterable<SdkMessageLike>, deps: DrainDeps): Promise<DrainResult> {
  const timers = deps.timers ?? DEFAULT_TIMERS;
  return new Promise<DrainResult>((resolve) => {
    let done = false;
    let firstReceived = false;
    let signalHandler: (() => void) | undefined;

    const finish = (result: DrainResult, abort: boolean): void => {
      if (done) return;
      done = true;
      timers.clear(firstTimer);
      timers.clear(totalTimer);
      if (signalHandler !== undefined) deps.signal?.removeEventListener("abort", signalHandler);
      if (abort) deps.abortController.abort();
      resolve(result);
    };

    const firstTimer = timers.set(() => {
      if (!firstReceived) finish({ ok: false, failure: "timeout_first" }, true);
    }, deps.firstTokenMs);
    const totalTimer = timers.set(() => {
      finish({ ok: false, failure: "timeout_total" }, true);
    }, deps.totalMs);

    if (deps.signal !== undefined) {
      const signal = deps.signal;
      signalHandler = () => finish({ ok: false, failure: "timeout_total" }, true);
      if (signal.aborted) signalHandler();
      else signal.addEventListener("abort", signalHandler);
    }

    void (async () => {
      try {
        for await (const message of stream) {
          if (done) return;
          if (!firstReceived) {
            firstReceived = true;
            timers.clear(firstTimer);
          }
          if (message.type === "result") {
            if (message.subtype === "success") {
              finish({ ok: true, text: message.result ?? null }, false);
            } else {
              finish({ ok: false, failure: "api_error" }, false);
            }
            return;
          }
        }
        // result メッセージ無しでストリームが閉じた → APIエラー扱い
        finish({ ok: false, failure: "api_error" }, false);
      } catch {
        // abort による中断・SDK 例外。タイムアウト起因なら finish 済み(no-op)。
        finish({ ok: false, failure: "api_error" }, false);
      }
    })();
  });
}

// ---------------------------------------------------------------------------
// LiveDreamMaster 本体
// ---------------------------------------------------------------------------

/** query の注入型(既定は SDK query。テストでは偽の async iterable を返す関数を注入する) */
export type QueryFn = (params: { prompt: string; options: Options }) => AsyncIterable<SdkMessageLike>;

const defaultQuery: QueryFn = (params) => sdkQuery(params);

export interface LiveDreamMasterDeps {
  readonly config: AiConfig;
  /** 認証解決に使う env(既定 process.env)。値は読まず有無のみ判定 */
  readonly env?: NodeJS.ProcessEnv;
  /** query 実装(既定 SDK query)。テスト用に注入する */
  readonly query?: QueryFn;
  /** ストリーム消費のタイマ抽象(テスト用) */
  readonly timers?: StreamTimers;
}

export class LiveDreamMaster implements DreamMaster {
  public readonly mode = "live" as const;

  private readonly config: AiConfig;
  private readonly query: QueryFn;
  private readonly authEnv: Record<string, string>;
  private readonly timers: StreamTimers | undefined;

  public constructor(deps: LiveDreamMasterDeps) {
    this.config = deps.config;
    this.query = deps.query ?? defaultQuery;
    this.timers = deps.timers;
    // 認証は構築時に解決(資格情報が無ければここで即エラー=起動時に気づける)。
    // query はまだ呼ばない(実AI呼び出しは run 実行時のみ)。
    this.authEnv = resolveAiAuth(deps.env ?? process.env).env;
  }

  public async run(
    context: DreamMasterContext,
    runOptions?: DreamMasterRunOptions
  ): Promise<DreamMasterResult> {
    const flow = context.flow;
    const spec = resolveFlowSpec(flow, this.config);
    const meta = { mode: this.mode, model: spec.model } as const;

    const recorded: RawToolCall[] = [];
    const { systemPrompt, userPrompt } = buildPrompt(context);
    const allowedNames = buildAllowedToolNames(flow);

    const dreamServer = createSdkMcpServer({
      name: DREAM_SERVER_NAME,
      version: "0.1.0",
      tools: buildFlowTools(spec.allowedTools, (call) => recorded.push(call))
    });

    const abortController = new AbortController();
    const options: Options = {
      mcpServers: { [DREAM_SERVER_NAME]: dreamServer },
      allowedTools: [...allowedNames],
      disallowedTools: [...DISALLOWED_BUILTIN_TOOLS],
      canUseTool: makeCanUseTool(allowedNames),
      settingSources: [],
      strictMcpConfig: true,
      systemPrompt,
      model: spec.model,
      maxTurns: spec.limits.maxTurns,
      permissionMode: "default",
      persistSession: false,
      ...(spec.thinkingDisabled ? { thinking: { type: "disabled" as const } } : {}),
      env: this.authEnv,
      abortController
    };

    let stream: AsyncIterable<SdkMessageLike>;
    try {
      stream = this.query({ prompt: userPrompt, options });
    } catch {
      return { ok: false, flow, failure: "api_error", meta };
    }

    const drainDeps: DrainDeps = {
      firstTokenMs: spec.timeout.firstTokenSeconds * 1000,
      totalMs: spec.timeout.totalSeconds * 1000,
      abortController,
      ...(runOptions?.signal !== undefined ? { signal: runOptions.signal } : {}),
      ...(this.timers !== undefined ? { timers: this.timers } : {})
    };

    const drain = await drainStream(stream, drainDeps);
    if (!drain.ok) {
      return { ok: false, flow, failure: drain.failure, meta };
    }

    // summary フローは最終テキストが要約本体。他フローはツールが本体でテキストは持たせない。
    const text = flow === "summary" ? drain.text : null;
    return { ok: true, flow, toolCalls: recorded, text, meta };
  }
}

/** LiveDreamMaster を生成する(実AI呼び出しは run 時のみ。構築時は認証解決のみ) */
export function createLiveDreamMaster(deps: LiveDreamMasterDeps): DreamMaster {
  return new LiveDreamMaster(deps);
}

/** 参照用に公開(縮退・失敗種別のテスト補助) */
export const LIVE_FAILURE_KINDS: readonly DreamMasterFailureKind[] = [
  "timeout_first",
  "timeout_total",
  "api_error"
];
