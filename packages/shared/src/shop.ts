import { ARMOR_ITEM_IDS, ITEMS, WEAPON_ITEM_IDS, buyPriceOf } from "./combat/items.js";
import type { ItemId } from "./combat/items.js";

/**
 * 商人(レンド)の店の品揃えと価格。純データ・純ロジック(Phaser 非依存)。
 * 在庫リストは裁量(game-design.md「成長・経済」の消耗品と「装備(拡張: M8)」の装備品を含む)。
 * 売買の検証・適用は server の操作リデューサーが行う(所持金・空き枠・クエスト品除外)。
 */

/**
 * 店で購入できる品。並び順は UI 表示順を兼ねる:
 * 消耗品 → 武器(初級 → 上級)→ 防具(初級 → 上級)。
 * - 消耗品: 回復薬(小/中)・解毒薬(game-design.md「成長・経済」)
 * - 装備品: 武器2種・防具2種(game-design.md「装備(拡張: M8)」入手経路=店での購入。M8-3)。
 *   武器/防具の初級→上級の順序は WEAPON_ITEM_IDS/ARMOR_ITEM_IDS(items.ts)に一元定義。
 */
export const SHOP_STOCK: readonly ItemId[] = [
  "potion-small",
  "potion-mid",
  "antidote",
  ...WEAPON_ITEM_IDS,
  ...ARMOR_ITEM_IDS
];

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
