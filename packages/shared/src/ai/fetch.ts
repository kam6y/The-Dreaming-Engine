import { z } from "zod";

import type { ItemId } from "../combat/items.js";

/**
 * fetch 型サブクエスト(`propose_quest`)の納品対象ホワイトリスト。
 * **購入・採取・ドロップで再入手可能なアイテムのみ**。一点物のクエスト用アイテム
 * (old-key)は含めない(ai-integration.md「propose_quest」)。
 *
 * 内訳(再入手経路):
 * - potion-small / potion-mid / antidote: 店で購入可(SHOP_STOCK)。一部は宝箱ドロップも。
 * - herb / ore: 採取ポイントでリスポーン入手(GATHER_CONTENTS)。
 *
 * 各 ID が実際に再入手経路を持つこと(SHOP_STOCK / CHEST_CONTENTS / GATHER_CONTENTS の
 * いずれかに含まれること)、および old-key を含まないことをユニットテストで担保する。
 */
export const FETCH_TARGET_IDS = [
  "potion-small",
  "potion-mid",
  "antidote",
  "herb",
  "ore"
] as const satisfies readonly ItemId[];

export const fetchTargetIdSchema = z.enum(FETCH_TARGET_IDS);
export type FetchTargetId = z.infer<typeof fetchTargetIdSchema>;

/** fetch 対象として有効なアイテムか(ホワイトリスト内か) */
export function isFetchTarget(id: string): id is FetchTargetId {
  return fetchTargetIdSchema.safeParse(id).success;
}
