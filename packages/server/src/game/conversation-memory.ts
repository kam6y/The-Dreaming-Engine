import {
  appendUnsummarizedExchange,
  type ConversationExchange,
  type NpcMemory
} from "@dreaming-engine/shared";

import { maskSecrets } from "../ai/secret-mask.js";

/**
 * 会話記憶へ永続化する前の機密マスク(ai-guardrails.md 第5層「状態の壁」)。
 *
 * セーブに焼き込まれるプレイヤー入力原文(会話履歴の未要約往復)には、監査ログと同一の
 * 機密マスク(トークン様文字列 `sk-ant-...` 等)を適用してから保存する。NPC(AI)応答側は
 * 既に出力壁を通過した全文だが、プレイヤー入力は無害化のみで長さ以外の内容審査を受けないため、
 * ここで必ずマスクする(API キーがセーブに平文で残らない)。
 */
export function appendMaskedExchange(
  memory: NpcMemory,
  exchange: ConversationExchange,
  env: NodeJS.ProcessEnv = process.env
): NpcMemory {
  const masked: ConversationExchange = {
    player: maskSecrets(exchange.player, { env }),
    npc: exchange.npc
  };
  return appendUnsummarizedExchange(memory, masked);
}

/** 会話要約を永続化する前の機密マスク(念のための多層防御。要約は出力壁通過済み) */
export function maskSummaryForStorage(summary: string, env: NodeJS.ProcessEnv = process.env): string {
  return maskSecrets(summary, { env });
}
