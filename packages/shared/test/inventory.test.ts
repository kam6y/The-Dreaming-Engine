import { describe, expect, it } from "vitest";

import {
  INVENTORY_CAPACITY,
  addItem,
  canAdd,
  countOf,
  countQuestItem,
  createNewGameState,
  emptyInventory,
  freeSpace,
  GAME_STATE_VERSION,
  gameStateSchema,
  INITIAL_GOLD,
  ITEMS,
  lootForChest,
  lootForGather,
  NEW_GAME_START,
  removeItem,
  sellPriceOf,
  SHOP_STOCK,
  shopStockEntries,
  usedSpace
} from "../src/index.js";
import type { Inventory } from "../src/index.js";

describe("インベントリ(所持上限・別枠・不変更新)", () => {
  it("addItemは同一itemIdのスタックへマージする", () => {
    const inv = emptyInventory();
    const r1 = addItem(inv, "potion-small", 2);
    const r2 = addItem(r1.inventory, "potion-small", 3);
    expect(countOf(r2.inventory, "potion-small")).toBe(5);
    expect(r2.inventory.items).toHaveLength(1);
    // 不変更新: 元のインベントリは変わらない
    expect(countOf(inv, "potion-small")).toBe(0);
  });

  it("上限(INVENTORY_CAPACITY)を超える分はoverflowとして返す", () => {
    const inv = addItem(emptyInventory(), "herb", INVENTORY_CAPACITY - 1).inventory;
    const r = addItem(inv, "ore", 5);
    expect(r.added).toBe(1);
    expect(r.overflow).toBe(4);
    expect(usedSpace(r.inventory)).toBe(INVENTORY_CAPACITY);
    expect(freeSpace(r.inventory)).toBe(0);
  });

  it("満杯時のaddItemは何も加えずoverflowのみ返す", () => {
    const inv = addItem(emptyInventory(), "herb", INVENTORY_CAPACITY).inventory;
    const r = addItem(inv, "potion-small", 2);
    expect(r.added).toBe(0);
    expect(r.overflow).toBe(2);
    expect(countOf(r.inventory, "potion-small")).toBe(0);
  });

  it("クエスト用アイテムは別枠へ入り、満杯でも上限の対象外で受領できる", () => {
    const full = addItem(emptyInventory(), "herb", INVENTORY_CAPACITY).inventory;
    expect(ITEMS["old-key"].questItem).toBe(true);
    const r = addItem(full, "old-key", 1);
    expect(r.added).toBe(1);
    expect(r.overflow).toBe(0);
    expect(countQuestItem(r.inventory, "old-key")).toBe(1);
    // 通常枠の使用数は変わらない(別枠)
    expect(usedSpace(r.inventory)).toBe(INVENTORY_CAPACITY);
    expect(canAdd(full, "old-key", 99)).toBe(true);
  });

  it("removeItemは所持数まで取り除き、0になったスタックは消える", () => {
    const inv = addItem(emptyInventory(), "herb", 3).inventory;
    const r1 = removeItem(inv, "herb", 2);
    expect(r1.removed).toBe(2);
    expect(countOf(r1.inventory, "herb")).toBe(1);
    const r2 = removeItem(r1.inventory, "herb", 5);
    expect(r2.removed).toBe(1);
    expect(r2.inventory.items).toHaveLength(0);
  });

  it("removeItemはクエスト用アイテム(別枠)には作用しない", () => {
    const inv: Inventory = addItem(emptyInventory(), "old-key", 1).inventory;
    const r = removeItem(inv, "old-key", 1);
    expect(r.removed).toBe(0);
    expect(countQuestItem(r.inventory, "old-key")).toBe(1);
  });

  it("canAddは空き枠と数量で判定する", () => {
    const inv = addItem(emptyInventory(), "herb", INVENTORY_CAPACITY - 2).inventory;
    expect(canAdd(inv, "ore", 2)).toBe(true);
    expect(canAdd(inv, "ore", 3)).toBe(false);
  });
});

describe("店(在庫・価格)", () => {
  it("在庫に回復薬(小・中)と解毒薬を含む", () => {
    expect(SHOP_STOCK).toContain("potion-small");
    expect(SHOP_STOCK).toContain("potion-mid");
    expect(SHOP_STOCK).toContain("antidote");
  });

  it("shopStockEntriesは名称と購入価格を持つ", () => {
    const entries = shopStockEntries();
    expect(entries).toHaveLength(SHOP_STOCK.length);
    for (const e of entries) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.buyPrice).toBeGreaterThan(0);
    }
  });

  it("売却価格は明示値がなければ購入価格の半額(切り捨て)", () => {
    expect(sellPriceOf("potion-small")).toBe(10); // 20 / 2
    expect(sellPriceOf("potion-mid")).toBe(27); // floor(55 / 2)
    expect(sellPriceOf("antidote")).toBe(7); // floor(15 / 2)
    // 素材は明示の売却価格を持つ
    expect(sellPriceOf("herb")).toBe(5);
    expect(sellPriceOf("ore")).toBe(12);
  });
});

describe("ルートテーブル(宝箱・採取)", () => {
  it("既知の宝箱/採取点は中身を返し、未知のidは空配列", () => {
    expect(lootForChest("d1-chest").length).toBeGreaterThan(0);
    expect(lootForGather("field-gather-herb")).toEqual([{ itemId: "herb", count: 1 }]);
    expect(lootForChest("unknown-chest")).toEqual([]);
    expect(lootForGather("unknown-gather")).toEqual([]);
  });
});

describe("GameState(新規ゲーム・スキーマ)", () => {
  it("createNewGameStateは仕様どおりの初期状態を返す", () => {
    const state = createNewGameState();
    expect(state.version).toBe(GAME_STATE_VERSION);
    expect(state.player.level).toBe(1);
    expect(state.player.gold).toBe(INITIAL_GOLD);
    expect(countOf(state.inventory, "potion-small")).toBe(2);
    expect(state.inventory.questItems).toEqual([]);
    expect(state.day).toBe(1);
    expect(state.playtimeSeconds).toBe(0);
    expect(state.gimmicks).toEqual([]);
    expect(state.location.mapId).toBe(NEW_GAME_START.mapId);
    expect(state.location.position).toEqual(NEW_GAME_START.position);
  });

  it("gameStateSchemaはversion不一致を拒否する", () => {
    const state = createNewGameState();
    expect(gameStateSchema.safeParse(state).success).toBe(true);
    expect(gameStateSchema.safeParse({ ...state, version: 2 }).success).toBe(false);
  });
});
