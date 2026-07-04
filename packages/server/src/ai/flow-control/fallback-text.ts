import {
  BATTLE_RESULT_FALLBACK_TEXT,
  CONVERSATION_FALLBACK_TEXT,
  DREAM_FALLBACK_TEXT,
  QUEST_GENERATION_FALLBACK_TEXT
} from "@dreaming-engine/shared";

import type { AuditFlow } from "../audit-log.js";
import type { ToolFlow } from "../tool-validation/types.js";

/**
 * フロー(サーバー概念の `ToolFlow`)→ 定型フォールバック文(shared 定義)の写像。
 * 表示テキストの正は shared/ai/fallback.ts。ここでは分類(可変値ではない)のみを解決する。
 * summary は表示を持たないため空文字を返す(フォールバック=要約を更新しない)。
 */
export function fallbackTextForFlow(flow: ToolFlow): string {
  switch (flow) {
    case "conversation":
      return CONVERSATION_FALLBACK_TEXT;
    case "questGeneration":
      return QUEST_GENERATION_FALLBACK_TEXT;
    case "dream":
      return DREAM_FALLBACK_TEXT;
    case "battleResult":
      return BATTLE_RESULT_FALLBACK_TEXT;
    case "summary":
      return "";
  }
}

/** `ToolFlow`(camelCase)→ 監査ログの `AuditFlow`(snake_case)の写像 */
export const AUDIT_FLOW_BY_TOOL_FLOW: Record<ToolFlow, AuditFlow> = {
  conversation: "conversation",
  questGeneration: "quest_generation",
  dream: "dream",
  battleResult: "battle_result",
  summary: "summary"
};
