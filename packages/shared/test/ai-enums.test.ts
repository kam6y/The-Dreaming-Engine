import { describe, expect, it } from "vitest";

import {
  CHEST_CONTENTS,
  FETCH_TARGET_IDS,
  fetchTargetIdSchema,
  GATHER_CONTENTS,
  GIFTABLE_ITEM_IDS,
  giftableItemIdSchema,
  HUNT_TARGET_IDS,
  huntTargetIdSchema,
  isFetchTarget,
  isGiftableItem,
  isHuntTarget,
  isStreetEvent,
  ITEMS,
  itemIdSchema,
  RESPAWNABLE_ENEMY_IDS,
  SHOP_STOCK,
  STREET_EVENT_IDS,
  STREET_EVENTS,
  streetEventIdSchema,
  type ItemId
} from "../src/index.js";

describe("GiftableItemId(贈答ホワイトリスト)", () => {
  it("すべて既存 ItemId であり、消耗品(battleEffect 持ち)で、クエスト用でない", () => {
    for (const id of GIFTABLE_ITEM_IDS) {
      expect(itemIdSchema.safeParse(id).success).toBe(true);
      const def = ITEMS[id];
      expect(def.battleEffect).toBeDefined(); // 消耗品(回復・治療)であること
      expect(def.questItem).toBe(false);
    }
  });

  it("素材(herb/ore)・クエスト用(old-key)は含まない", () => {
    expect(GIFTABLE_ITEM_IDS).not.toContain("herb");
    expect(GIFTABLE_ITEM_IDS).not.toContain("ore");
    expect(GIFTABLE_ITEM_IDS).not.toContain("old-key");
  });

  it("スキーマ・型ガードが一致する", () => {
    expect(giftableItemIdSchema.safeParse("potion-small").success).toBe(true);
    expect(giftableItemIdSchema.safeParse("herb").success).toBe(false);
    expect(isGiftableItem("antidote")).toBe(true);
    expect(isGiftableItem("old-key")).toBe(false);
  });
});

describe("HuntTargetId(討伐ホワイトリスト)", () => {
  it("RESPAWNABLE_ENEMY_IDS と集合として一致する(drift 検知)", () => {
    expect([...HUNT_TARGET_IDS].sort()).toEqual([...RESPAWNABLE_ENEMY_IDS].sort());
  });

  it("ボス dream-eater を含まない", () => {
    expect(HUNT_TARGET_IDS).not.toContain("dream-eater");
    expect(huntTargetIdSchema.safeParse("dream-eater").success).toBe(false);
    expect(isHuntTarget("mist-wolf")).toBe(true);
    expect(isHuntTarget("dream-eater")).toBe(false);
  });
});

describe("FetchTargetId(納品ホワイトリスト)", () => {
  const reobtainable = new Set<ItemId>();
  for (const id of SHOP_STOCK) reobtainable.add(id);
  for (const entries of Object.values(CHEST_CONTENTS)) {
    for (const e of entries) reobtainable.add(e.itemId);
  }
  for (const entries of Object.values(GATHER_CONTENTS)) {
    for (const e of entries) reobtainable.add(e.itemId);
  }

  it("すべて既存 ItemId かつ再入手経路(購入/宝箱/採取)を持ち、クエスト用でない", () => {
    for (const id of FETCH_TARGET_IDS) {
      expect(itemIdSchema.safeParse(id).success).toBe(true);
      expect(ITEMS[id].questItem).toBe(false);
      expect(reobtainable.has(id)).toBe(true);
    }
  });

  it("一点物クエストアイテム(old-key)は含まない", () => {
    expect(FETCH_TARGET_IDS).not.toContain("old-key");
    expect(fetchTargetIdSchema.safeParse("old-key").success).toBe(false);
    expect(isFetchTarget("herb")).toBe(true);
    expect(isFetchTarget("old-key")).toBe(false);
  });
});

describe("StreetEventId(街頭演出)", () => {
  it("3〜5種が定義され、各 ID に定義(name・text)がある", () => {
    expect(STREET_EVENT_IDS.length).toBeGreaterThanOrEqual(3);
    expect(STREET_EVENT_IDS.length).toBeLessThanOrEqual(5);
    for (const id of STREET_EVENT_IDS) {
      const def = STREET_EVENTS[id];
      expect(def.id).toBe(id);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.text.length).toBeGreaterThan(0);
    }
  });

  it("STREET_EVENTS のキー集合と STREET_EVENT_IDS が一致する", () => {
    expect(Object.keys(STREET_EVENTS).sort()).toEqual([...STREET_EVENT_IDS].sort());
  });

  it("スキーマ・型ガードが一致する", () => {
    expect(streetEventIdSchema.safeParse("distant-bell").success).toBe(true);
    expect(streetEventIdSchema.safeParse("dragon").success).toBe(false);
    expect(isStreetEvent("peddler")).toBe(true);
    expect(isStreetEvent("dragon")).toBe(false);
  });
});
