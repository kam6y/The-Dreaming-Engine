import { ITEMS, buyPriceOf } from "./combat/items.js";
import type { ItemId } from "./combat/items.js";

/**
 * 商人(レンド)の店の品揃えと価格。純データ・純ロジック(Phaser 非依存)。
 * 在庫リストは裁量(game-design.md「成長・経済」の消耗品を含む)。
 * 売買の検証・適用は server の操作リデューサーが行う(所持金・空き枠・クエスト品除外)。
 */

/** 店で購入できる品(裁量。回復薬(小/中)・解毒薬を含む: game-design.md) */
export const SHOP_STOCK: readonly ItemId[] = ["potion-small", "potion-mid", "antidote"];

export function isInShopStock(id: ItemId): boolean {
  return SHOP_STOCK.includes(id);
}

export interface ShopStockEntry {
  itemId: ItemId;
  name: string;
  buyPrice: number;
}

/** 店頭に並ぶ品の一覧(UI 表示用) */
export function shopStockEntries(): ShopStockEntry[] {
  return SHOP_STOCK.map((itemId) => ({
    itemId,
    name: ITEMS[itemId].name,
    buyPrice: buyPriceOf(itemId)
  }));
}
