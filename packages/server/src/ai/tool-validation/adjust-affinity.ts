import { clampAffinity, npcIdSchema } from "@dreaming-engine/shared";
import { z } from "zod";

import {
  ADJUST_AFFINITY_DAILY_ABS_MAX,
  ADJUST_AFFINITY_DELTA_MAX,
  ADJUST_AFFINITY_DELTA_MIN,
  ADJUST_AFFINITY_PER_CONVERSATION_MAX,
  type AdjustAffinityContext,
  type AdjustAffinityEffect,
  type ValidationResult
} from "./types.js";

/**
 * adjust_affinity: 好感度変更(ai-integration.md「adjust_affinity」)。
 * - npcId は現在の会話相手と一致必須
 * - delta は整数 -10..+10、1会話につき2回まで
 * - 同一NPCの日次累積 delta(申告値)が ±20 を超える呼び出しは却下
 * - effect は適用後クランプ(0..100)した好感度と、日次カウンタへ加算する delta
 */

const adjustAffinityInputSchema = z.object({
  npcId: npcIdSchema,
  delta: z.number().int().min(ADJUST_AFFINITY_DELTA_MIN).max(ADJUST_AFFINITY_DELTA_MAX),
  reason: z.string()
});

export function validateAdjustAffinity(
  rawInput: unknown,
  ctx: AdjustAffinityContext
): ValidationResult<AdjustAffinityEffect> {
  const parsed = adjustAffinityInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, reason: "adjust_affinity: 入力スキーマ検証に失敗" };
  const { npcId, delta } = parsed.data;

  if (npcId !== ctx.partnerNpcId) {
    return {
      ok: false,
      reason: `adjust_affinity: 会話相手(${ctx.partnerNpcId})と異なるNPC(${npcId})への変更`
    };
  }
  if (ctx.adjustAffinityCount >= ADJUST_AFFINITY_PER_CONVERSATION_MAX) {
    return { ok: false, reason: "adjust_affinity: 会話内の上限(2回)超過" };
  }

  const nextDaily = ctx.dailyAffinityDelta + delta;
  if (nextDaily > ADJUST_AFFINITY_DAILY_ABS_MAX || nextDaily < -ADJUST_AFFINITY_DAILY_ABS_MAX) {
    return {
      ok: false,
      reason: `adjust_affinity: 日次累積上限(±20)超過(累積${ctx.dailyAffinityDelta}+${delta})`
    };
  }

  const affinity = clampAffinity(ctx.currentAffinity + delta);
  return { ok: true, effect: { kind: "adjust_affinity", npcId, affinity, delta } };
}
