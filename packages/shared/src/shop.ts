import { ARMOR_ITEM_IDS, ITEMS, WEAPON_ITEM_IDS, buyPriceOf, sellPriceOf } from "./combat/items.js";
import type { ItemId } from "./combat/items.js";
import type { NpcId } from "./ids.js";
import { affinityTier } from "./npc.js";
import type { AffinityTier } from "./npc.js";

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

/**
 * 琥珀工房(職人ガロ)の品揃え(M16。game-design.md「第2エリア(拡張: M16)」経済)。
 * ITEMS に実在する品のみ:回復薬(中)・解毒薬 + 上級装備(琥珀刃・灯守りの帷子)=
 * 灯町より一段深い側の構成。松明は縦切り仕様に記載があるが実装に存在しないため含めない。
 * いずれの品も SHOP_STOCK の部分集合(価格・存在は既存 ITEMS に依拠)。
 */
export const AMBER_WORKSHOP_STOCK: readonly ItemId[] = [
  "potion-mid",
  "antidote",
  "amber-blade",
  "warded-mail"
];

/**
 * 店を持つ NPC ごとの品揃え(NpcId → 在庫リスト)。レンド(渡り物屋)は SHOP_STOCK で不変、
 * ガロ(琥珀工房)は AMBER_WORKSHOP_STOCK。宿・語り部などの非店NPCはキーを持たない
 * (shopStockFor が空配列を返し、その店では何も買えない)。
 */
export const NPC_SHOP_STOCK: Partial<Record<NpcId, readonly ItemId[]>> = {
  merchant: SHOP_STOCK,
  artisan: AMBER_WORKSHOP_STOCK
};

/** 指定NPCの店の品揃え(店を持たないNPCは空配列) */
export function shopStockFor(npcId: NpcId): readonly ItemId[] {
  return NPC_SHOP_STOCK[npcId] ?? [];
}

/** その品が指定NPCの店の品揃えにあるか(店ごとに扱いを分ける=表示外の品の購入を防ぐ) */
export function isInShopStock(npcId: NpcId, id: ItemId): boolean {
  return shopStockFor(npcId).includes(id);
}

// ===========================================================================
// 好感度の段階割引(game-design.md「好感度の段階(拡張: M11)」)
// ===========================================================================

/**
 * 段階別の買値割引率(%)。0-49(警戒・よそよそしい)は割引なし=既存価格と完全同値。
 * 率・端数規則は仕様表が正(割引額 = floor(買値 × 率 / 100) を買値から引く)。
 */
export const SHOP_BUY_DISCOUNT_PERCENT: Record<AffinityTier, number> = {
  wary: 0,
  distant: 0,
  friendly: 5,
  trusted: 10
};

/** 段階別の売値増し率(%)。信頼のみ+5%(増額 = floor(売値 × 率 / 100) を売値に足す) */
export const SHOP_SELL_BONUS_PERCENT: Record<AffinityTier, number> = {
  wary: 0,
  distant: 0,
  friendly: 0,
  trusted: 5
};

/**
 * 商人の好感度を反映した購入価格(純関数)。
 * 0-49 では buyPriceOf と完全同値(初期好感度30の既存テスト・E2E を変えない)。
 * 端数は割引額側の切り捨て(floor)= 価格は仕様の端数規則どおり。
 */
export function discountedBuyPrice(itemId: ItemId, affinity: number): number {
  const base = buyPriceOf(itemId);
  const percent = SHOP_BUY_DISCOUNT_PERCENT[affinityTier(affinity)];
  return base - Math.floor((base * percent) / 100);
}

/**
 * 商人の好感度を反映した売却価格(純関数)。信頼(80-100)のみ+5%。
 * 店で購入できる品(買値>0)は、同じ好感度での割引後買値を上回らないよう
 * クランプする(買い戻し往復によるゴールド増殖の防止。仕様の保証)。
 * ※ M11-1 のサーバー適用は買値割引のみ。本関数の配線(売却適用+表示)は M11-3 で行う。
 */
export function adjustedSellPrice(itemId: ItemId, affinity: number): number {
  const base = sellPriceOf(itemId);
  const percent = SHOP_SELL_BONUS_PERCENT[affinityTier(affinity)];
  const raised = base + Math.floor((base * percent) / 100);
  const buyBase = buyPriceOf(itemId);
  if (buyBase > 0) {
    return Math.min(raised, discountedBuyPrice(itemId, affinity));
  }
  return raised;
}

export interface ShopStockEntry {
  itemId: ItemId;
  name: string;
  buyPrice: number;
}

/**
 * 店頭に並ぶ品の一覧(UI 表示用)。品揃えは店主 NPC ごと(shopStockFor)、buyPrice は
 * その店主の好感度を反映した割引後の値(クライアントはこの値をそのまま表示する。
 * 初期好感度30では従来価格と同値)。割引規則(discountedBuyPrice)は全店で同一を再利用する。
 */
export function shopStockEntries(npcId: NpcId, affinity: number): ShopStockEntry[] {
  return shopStockFor(npcId).map((itemId) => ({
    itemId,
    name: ITEMS[itemId].name,
    buyPrice: discountedBuyPrice(itemId, affinity)
  }));
}
