import { z } from "zod";

import { ITEMS, itemIdSchema } from "./combat/items.js";
import type { ItemId } from "./combat/items.js";

/**
 * インベントリ(所持品)の純ロジック。Phaser 非依存・不変更新。
 *
 * モデル(裁量。JOURNAL に記録):
 * - 通常アイテムは `items`(itemId ごとのスタック)で持ち、**総数**に所持上限
 *   `INVENTORY_CAPACITY` を課す(「所持枠」= 上限-総数の空き)。
 * - クエスト用アイテム(`questItem: true`)は `questItems` の**別枠**で持ち、
 *   所持上限の対象外・売却/破棄不可(game-design.md「成長・経済」)。満杯でも常に受領できる。
 *
 * 満杯時の各挙動(戦闘ドロップの破棄・宝箱/採取の取り残し・店購入のブロック)は
 * 呼び出し側(server の操作リデューサー)が本モジュールの `freeSpace`/`addItem` を使って実装する。
 */

/** 通常アイテムの所持総数上限(裁量値。JOURNAL に記録) */
export const INVENTORY_CAPACITY = 20;

export const inventoryStackSchema = z.object({
  itemId: itemIdSchema,
  count: z.number().int().positive()
});
export type InventoryStack = z.infer<typeof inventoryStackSchema>;

export const inventorySchema = z.object({
  /** 通常アイテム(所持上限の対象) */
  items: z.array(inventoryStackSchema),
  /** クエスト用アイテムの別枠(所持上限の対象外) */
  questItems: z.array(inventoryStackSchema)
});
export type Inventory = z.infer<typeof inventorySchema>;

export function emptyInventory(): Inventory {
  return { items: [], questItems: [] };
}

/** スタック配列の総数 */
export function totalCount(stacks: readonly InventoryStack[]): number {
  return stacks.reduce((sum, s) => sum + s.count, 0);
}

/** 通常アイテムの使用済み枠数(総数) */
export function usedSpace(inv: Inventory): number {
  return totalCount(inv.items);
}

/** 通常アイテムの空き枠数(上限 - 使用済み。負にはならない) */
export function freeSpace(inv: Inventory): number {
  return Math.max(0, INVENTORY_CAPACITY - usedSpace(inv));
}

function countInStacks(stacks: readonly InventoryStack[], itemId: ItemId): number {
  return stacks.find((s) => s.itemId === itemId)?.count ?? 0;
}

/** 通常アイテムの所持数 */
export function countOf(inv: Inventory, itemId: ItemId): number {
  return countInStacks(inv.items, itemId);
}

/** クエスト用アイテムの所持数(別枠) */
export function countQuestItem(inv: Inventory, itemId: ItemId): number {
  return countInStacks(inv.questItems, itemId);
}

/** スタック配列へ数量を加える(同一 itemId はマージ。不変) */
function addToStacks(stacks: readonly InventoryStack[], itemId: ItemId, qty: number): InventoryStack[] {
  const next = stacks.map((s) => ({ ...s }));
  const existing = next.find((s) => s.itemId === itemId);
  if (existing) {
    existing.count += qty;
  } else {
    next.push({ itemId, count: qty });
  }
  return next;
}

/** スタック配列から数量を取り除く(不足分は取り除ける分だけ。0 になったスタックは削除。不変) */
function removeFromStacks(
  stacks: readonly InventoryStack[],
  itemId: ItemId,
  qty: number
): { stacks: InventoryStack[]; removed: number } {
  const next: InventoryStack[] = [];
  let removed = 0;
  for (const s of stacks) {
    if (s.itemId === itemId) {
      const take = Math.min(s.count, qty);
      removed = take;
      const left = s.count - take;
      if (left > 0) next.push({ itemId: s.itemId, count: left });
    } else {
      next.push({ ...s });
    }
  }
  return { stacks: next, removed };
}

export interface AddResult {
  inventory: Inventory;
  /** 実際に加えられた数 */
  added: number;
  /** 所持上限で入りきらなかった数(クエスト用アイテムは常に 0) */
  overflow: number;
}

/**
 * アイテムを加える。クエスト用アイテムは別枠へ上限なしで加える。
 * 通常アイテムは空き枠の範囲で加え、入りきらない分は `overflow` として返す(破棄・取り残しは呼び出し側の責務)。
 */
export function addItem(inv: Inventory, itemId: ItemId, qty: number): AddResult {
  if (qty <= 0) return { inventory: inv, added: 0, overflow: 0 };

  if (ITEMS[itemId].questItem) {
    return {
      inventory: { ...inv, questItems: addToStacks(inv.questItems, itemId, qty) },
      added: qty,
      overflow: 0
    };
  }

  const space = freeSpace(inv);
  const added = Math.min(qty, space);
  const overflow = qty - added;
  const items = added > 0 ? addToStacks(inv.items, itemId, added) : inv.items;
  return { inventory: { ...inv, items }, added, overflow };
}

/** 指定数量を丸ごと加えられるか(通常アイテムのみ空き枠を要する。クエスト用は常に true) */
export function canAdd(inv: Inventory, itemId: ItemId, qty: number): boolean {
  if (qty <= 0) return true;
  if (ITEMS[itemId].questItem) return true;
  return freeSpace(inv) >= qty;
}

export interface RemoveResult {
  inventory: Inventory;
  /** 実際に取り除いた数 */
  removed: number;
}

/**
 * 通常アイテムを取り除く(破棄・売却・使用・fetch 納品で使う)。
 * クエスト用アイテムは破棄・売却できないため、この関数は通常アイテム(`items`)のみを対象とする。
 */
export function removeItem(inv: Inventory, itemId: ItemId, qty: number): RemoveResult {
  if (qty <= 0) return { inventory: inv, removed: 0 };
  const { stacks, removed } = removeFromStacks(inv.items, itemId, qty);
  return { inventory: { ...inv, items: stacks }, removed };
}
