import { describe, expect, it } from "vitest";

import {
  AFFINITY_MAX,
  AFFINITY_MIN,
  INITIAL_AFFINITY,
  SHOP_BUY_DISCOUNT_PERCENT,
  SHOP_SELL_BONUS_PERCENT,
  SHOP_STOCK,
  adjustedSellPrice,
  buyPriceOf,
  discountedBuyPrice,
  itemIdSchema,
  sellPriceOf,
  shopStockEntries
} from "../src/index.js";

/**
 * 商人の店の段階割引(M11-1)のテスト。
 * 率・端数規則の正は game-design.md「好感度の段階(拡張: M11)」:
 * - 買値: 0-49 割引なし / 50-79(打ち解けた)5%引き / 80-100(信頼)10%引き
 * - 売値: 信頼のみ 5%増し
 * - 端数: 割引額・増額とも floor(基準価格 × 率)
 * - 増加後売値は同じ好感度での割引後買値を上回らない(買値>0 の品)
 */

const ALL_ITEM_IDS = itemIdSchema.options;

describe("discountedBuyPrice(段階割引の買値)", () => {
  it("0-49(警戒・よそよそしい)では全品が既存価格と完全同値", () => {
    for (const affinity of [0, 19, 20, INITIAL_AFFINITY, 49]) {
      for (const itemId of ALL_ITEM_IDS) {
        expect(discountedBuyPrice(itemId, affinity)).toBe(buyPriceOf(itemId));
      }
    }
  });

  it("段階境界で価格が切り替わる(49/50・79/80。錆びた片刃60G)", () => {
    expect(discountedBuyPrice("worn-blade", 49)).toBe(60); // 割引なし
    expect(discountedBuyPrice("worn-blade", 50)).toBe(57); // 5%引き: 60 - floor(3.0)
    expect(discountedBuyPrice("worn-blade", 79)).toBe(57);
    expect(discountedBuyPrice("worn-blade", 80)).toBe(54); // 10%引き: 60 - floor(6.0)
    expect(discountedBuyPrice("worn-blade", 100)).toBe(54);
  });

  it("端数は割引額の切り捨て(floor)", () => {
    // 5%: 20G → 割引1G(floor(1.0)) → 19G / 55G → 割引2G(floor(2.75)) → 53G
    expect(discountedBuyPrice("potion-small", 50)).toBe(19);
    expect(discountedBuyPrice("potion-mid", 50)).toBe(53);
    // 5%: 15G → 割引0G(floor(0.75)) → 15G(据え置き)
    expect(discountedBuyPrice("antidote", 50)).toBe(15);
    // 10%: 15G → 割引1G(floor(1.5)) → 14G / 150G → 割引15G → 135G
    expect(discountedBuyPrice("antidote", 80)).toBe(14);
    expect(discountedBuyPrice("warded-mail", 80)).toBe(135);
  });

  it("全品・全好感度で非負の整数を返す", () => {
    for (let affinity = AFFINITY_MIN; affinity <= AFFINITY_MAX; affinity += 1) {
      for (const itemId of ALL_ITEM_IDS) {
        const price = discountedBuyPrice(itemId, affinity);
        expect(Number.isInteger(price)).toBe(true);
        expect(price).toBeGreaterThanOrEqual(0);
        expect(price).toBeLessThanOrEqual(buyPriceOf(itemId));
      }
    }
  });
});

describe("adjustedSellPrice(段階増しの売値)", () => {
  it("0-79(信頼未満)では全品が既存の売値と完全同値", () => {
    for (const affinity of [0, INITIAL_AFFINITY, 49, 50, 79]) {
      for (const itemId of ALL_ITEM_IDS) {
        expect(adjustedSellPrice(itemId, affinity)).toBe(sellPriceOf(itemId));
      }
    }
  });

  it("信頼(80-100)では5%増し(増額は切り捨て)", () => {
    // 27G → +1G(floor(1.35)) → 28G / 30G → +1G(floor(1.5)) → 31G / 90G → +4G → 94G
    expect(adjustedSellPrice("potion-mid", 80)).toBe(28);
    expect(adjustedSellPrice("worn-blade", 80)).toBe(31);
    expect(adjustedSellPrice("amber-blade", 100)).toBe(94);
    // 増額が1G未満に丸まる品は据え置き(10G → floor(0.5)=0 / 5G → floor(0.25)=0)
    expect(adjustedSellPrice("potion-small", 80)).toBe(10);
    expect(adjustedSellPrice("herb", 80)).toBe(5);
  });

  it("全品・全好感度で、店で買える品(買値>0)の売値は割引後買値を上回らない", () => {
    for (let affinity = AFFINITY_MIN; affinity <= AFFINITY_MAX; affinity += 1) {
      for (const itemId of ALL_ITEM_IDS) {
        const sell = adjustedSellPrice(itemId, affinity);
        expect(Number.isInteger(sell)).toBe(true);
        expect(sell).toBeGreaterThanOrEqual(0);
        if (buyPriceOf(itemId) > 0) {
          expect(sell).toBeLessThanOrEqual(discountedBuyPrice(itemId, affinity));
        }
      }
    }
  });
});

describe("shopStockEntries(好感度つき在庫リスト)", () => {
  it("初期好感度30では基準価格と同値(既存E2E: 錆びた片刃60G を維持)", () => {
    const entries = shopStockEntries(INITIAL_AFFINITY);
    for (const entry of entries) {
      expect(entry.buyPrice).toBe(buyPriceOf(entry.itemId));
    }
    expect(entries.find((e) => e.itemId === "worn-blade")?.buyPrice).toBe(60);
  });

  it("信頼(80)では割引後の買値が並ぶ", () => {
    const entries = shopStockEntries(80);
    expect(entries).toHaveLength(SHOP_STOCK.length);
    for (const entry of entries) {
      expect(entry.buyPrice).toBe(discountedBuyPrice(entry.itemId, 80));
    }
    expect(entries.find((e) => e.itemId === "potion-small")?.buyPrice).toBe(18);
  });
});

describe("段階割引率の定数(仕様表との一致)", () => {
  it("買値割引率: 0/0/5/10、売値増し率: 0/0/0/5", () => {
    expect(SHOP_BUY_DISCOUNT_PERCENT).toEqual({ wary: 0, distant: 0, friendly: 5, trusted: 10 });
    expect(SHOP_SELL_BONUS_PERCENT).toEqual({ wary: 0, distant: 0, friendly: 0, trusted: 5 });
  });
});
