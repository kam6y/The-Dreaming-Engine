import { z } from "zod";

import type { ItemId } from "../combat/items.js";

/**
 * 贈答ホワイトリスト(`give_item` / `propose_quest` の rewardItemId で使う)。
 * **消耗品のみ**(battleEffect を持つ回復・治療アイテム)。素材(herb/ore=売却用)や
 * クエスト用アイテム(old-key)は含めない(ai-integration.md「give_item」)。
 *
 * ここに載る ID はすべて既存 `ItemId` の部分集合であることを型(satisfies)と
 * ユニットテストの二重で担保する。
 */
export const GIFTABLE_ITEM_IDS = [
  "potion-small",
  "potion-mid",
  "antidote"
] as const satisfies readonly ItemId[];

export const giftableItemIdSchema = z.enum(GIFTABLE_ITEM_IDS);
export type GiftableItemId = z.infer<typeof giftableItemIdSchema>;

/** 贈答可能なアイテムか */
export function isGiftableItem(id: string): id is GiftableItemId {
  return giftableItemIdSchema.safeParse(id).success;
}
