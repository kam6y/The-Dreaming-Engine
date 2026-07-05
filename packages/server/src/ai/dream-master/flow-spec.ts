import type { AiConfig } from "../config.js";
import { FLOW_TOOL_ALLOWLIST, type ToolFlow, type ToolName } from "../tool-validation/types.js";

/**
 * フロー別の実行仕様(モデル / 許可ツール / タイムアウト / ターン・トークン上限)を
 * `config/ai.json`(`AiConfig`)と `FLOW_TOOL_ALLOWLIST` から解決する。
 *
 * **値はすべて config 由来**(モデル名・タイムアウト秒・ターン/トークン上限)であり、
 * ここでハードコードするのは「フロー→モデル区分(haiku/sonnet)」「フロー→上限区分
 * (会話/GM)」「フロー→拡張思考の有効/無効」の対応だけ。これは ai-integration.md
 * 「呼び出しフロー別仕様」220-229 の表そのものの構造(可変値ではない)であり、
 * `FLOW_TOOL_ALLOWLIST` と同格の分類である。
 */

/** フロー → モデル区分(ai-integration.md 220-226 の「モデル」列) */
export const FLOW_MODEL_TIER: Record<ToolFlow, "haiku" | "sonnet"> = {
  conversation: "haiku",
  questGeneration: "sonnet",
  dream: "sonnet",
  battleResult: "haiku",
  summary: "haiku"
};

/** フロー → ターン数・出力トークン上限の区分(ai-integration.md 228-229 の「区分」列) */
export const FLOW_DIVISION: Record<ToolFlow, "conversation" | "gm"> = {
  conversation: "conversation",
  questGeneration: "gm",
  dream: "gm",
  battleResult: "conversation",
  summary: "conversation"
};

/** フロー → 拡張思考(thinking)を無効化するか(ユーザー決定)。*/
export const FLOW_THINKING_DISABLED: Record<ToolFlow, boolean> = {
  conversation: true,
  questGeneration: true,
  dream: false,
  battleResult: true,
  summary: false
};

/** フロー別の解決済み実行仕様(Live/Mock 双方が参照する共通スペック) */
export interface FlowSpec {
  readonly flow: ToolFlow;
  /** 使用モデル名(config.models 由来) */
  readonly model: string;
  /** このフローで許可するカスタムツール集合(FLOW_TOOL_ALLOWLIST 由来) */
  readonly allowedTools: readonly ToolName[];
  /** タイムアウト2値(初回/全体、秒。config.timeouts 由来) */
  readonly timeout: {
    readonly firstTokenSeconds: number;
    readonly totalSeconds: number;
  };
  /** ターン数・出力トークン上限(config.limits 由来) */
  readonly limits: {
    readonly maxTurns: number;
    readonly maxOutputTokens: number;
  };
  /** 拡張思考を無効化するか(FLOW_THINKING_DISABLED 由来。true のフローのみ live が thinking を渡す) */
  readonly thinkingDisabled: boolean;
}

/** フローと config から実行仕様を解決する(純関数) */
export function resolveFlowSpec(flow: ToolFlow, config: AiConfig): FlowSpec {
  const tier = FLOW_MODEL_TIER[flow];
  const division = FLOW_DIVISION[flow];
  const timeout = config.timeouts[flow];
  const limits = config.limits[division];
  return {
    flow,
    model: config.models[tier],
    allowedTools: FLOW_TOOL_ALLOWLIST[flow],
    timeout: { firstTokenSeconds: timeout.firstTokenSeconds, totalSeconds: timeout.totalSeconds },
    limits: { maxTurns: limits.maxTurns, maxOutputTokens: limits.maxOutputTokens },
    thinkingDisabled: FLOW_THINKING_DISABLED[flow]
  };
}
