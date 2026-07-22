import { freeSpace, giftableItemIdSchema, GIVE_ITEM_AFFINITY_THRESHOLD } from "@dreaming-engine/shared";
import { z } from "zod";

import {
  GIVE_ITEM_PER_CONVERSATION_MAX,
  GIVE_ITEM_PER_DAY_MAX,
  GIVE_ITEM_QUANTITY_MAX,
  GIVE_ITEM_QUANTITY_MIN,
  type GiveItemContext,
  type GiveItemEffect,
  type ValidationResult
} from "./types.js";

/**
 * give_item: アイテム付与(ai-integration.md「give_item」)。
 * - itemId は贈答ホワイトリスト(消耗品のみ)、quantity は整数 1..3
 * - 好感度50ゲートは **会話開始時点のスナップショット(affinityAtOpen)** で判定する。
 *   会話内の adjust_affinity による上昇では解禁されない(現在/永続の affinity は読まない)。
 * - インベントリに quantity 分の空きが必要(不足/満杯は却下)
 * - 会話内1回まで・ゲーム内1日3回まで(全NPC合算)
 */

const giveItemInputSchema = z.object({
  itemId: giftableItemIdSchema,
  quantity: z.number().int().min(GIVE_ITEM_QUANTITY_MIN).max(GIVE_ITEM_QUANTITY_MAX),
  reason: z.string()
});

export function validateGiveItem(
  rawInput: unknown,
  ctx: GiveItemContext
): ValidationResult<GiveItemEffect> {
  const parsed = giveItemInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, reason: "give_item: 入力スキーマ検証に失敗" };
  const { itemId, quantity } = parsed.data;

  // 好感度ゲート: 会話開始時点のスナップショットのみを読む(会話中の上昇では解禁しない)
  if (ctx.affinityAtOpen < GIVE_ITEM_AFFINITY_THRESHOLD) {
    return {
      ok: false,
      reason: `give_item: 会話開始時の好感度(${ctx.affinityAtOpen})が閾値(${GIVE_ITEM_AFFINITY_THRESHOLD})未満`
    };
  }

  const space = freeSpace(ctx.inventory);
  if (space < quantity) {
    return { ok: false, reason: `give_item: 所持枠不足(空き${space}/要求${quantity})` };
  }

  if (ctx.giveItemCountInConversation >= GIVE_ITEM_PER_CONVERSATION_MAX) {
    return { ok: false, reason: "give_item: 会話内の上限(1回)超過" };
  }
  if (ctx.giveItemCountToday >= GIVE_ITEM_PER_DAY_MAX) {
    return { ok: false, reason: "give_item: 1日の上限(3回)超過" };
  }

  return { ok: true, effect: { kind: "give_item", itemId, quantity } };
}
