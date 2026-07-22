import { describe, expect, it } from "vitest";

import {
  addItem,
  ARMOR_ITEM_IDS,
  countOf,
  createEmptyEquipment,
  effectiveStats,
  emptyInventory,
  EMPTY_EQUIPMENT,
  EQUIPMENT_ITEM_IDS,
  equipItem,
  equipmentSchema,
  equipmentSlotOf,
  INVENTORY_CAPACITY,
  isEquipment,
  isSellable,
  ITEMS,
  itemIdSchema,
  statsForLevel,
  unequipItem,
  usedSpace,
  WEAPON_ITEM_IDS
} from "../src/index.js";
import type { Equipment } from "../src/index.js";

describe("equipItem(装備)", () => {
  it("所持している装備品を装備でき、インベントリから1個減る", () => {
    const inv = addItem(emptyInventory(), "worn-blade", 1).inventory;
    const result = equipItem(inv, createEmptyEquipment(), "worn-blade");

    expect(result.ok).toBe(true);
    expect(result.equipment.weapon).toBe("worn-blade");
    expect(countOf(result.inventory, "worn-blade")).toBe(0);
  });

  it("所持していない装備品は装備できず、状態は不変", () => {
    const inv = emptyInventory();
    const equip = createEmptyEquipment();
    const result = equipItem(inv, equip, "worn-blade");

    expect(result.ok).toBe(false);
    expect(result.inventory).toBe(inv);
    expect(result.equipment).toBe(equip);
  });

  it("装備不可アイテム(回復薬)は装備できず、状態は不変", () => {
    const inv = addItem(emptyInventory(), "potion-small", 1).inventory;
    const equip = createEmptyEquipment();
    const result = equipItem(inv, equip, "potion-small");

    expect(result.ok).toBe(false);
    expect(result.inventory).toBe(inv);
    expect(result.equipment).toBe(equip);
  });

  it("防具スロットにも同様に装備できる", () => {
    const inv = addItem(emptyInventory(), "worn-cloak", 1).inventory;
    const result = equipItem(inv, createEmptyEquipment(), "worn-cloak");

    expect(result.ok).toBe(true);
    expect(result.equipment.armor).toBe("worn-cloak");
    expect(result.equipment.weapon).toBeNull();
    expect(countOf(result.inventory, "worn-cloak")).toBe(0);
  });
});

describe("equipItem(入れ替え)", () => {
  it("スロット使用中に別装備すると旧装備がインベントリへ戻る", () => {
    const inv = addItem(emptyInventory(), "amber-blade", 1).inventory;
    const equipped: Equipment = { weapon: "worn-blade", armor: null };
    const result = equipItem(inv, equipped, "amber-blade");

    expect(result.ok).toBe(true);
    expect(result.equipment.weapon).toBe("amber-blade");
    expect(countOf(result.inventory, "worn-blade")).toBe(1); // 旧装備が戻る
    expect(countOf(result.inventory, "amber-blade")).toBe(0); // 新装備は消費
  });

  it("インベントリ満杯でも入れ替えは成功する(総数は保存される)", () => {
    // 満杯(20個)を、装備先の worn-blade 1個 + 回復薬19個で構成する
    let inv = addItem(emptyInventory(), "potion-small", INVENTORY_CAPACITY - 1).inventory;
    inv = addItem(inv, "worn-blade", 1).inventory;
    expect(usedSpace(inv)).toBe(INVENTORY_CAPACITY); // 満杯

    const equipped: Equipment = { weapon: "amber-blade", armor: null };
    const result = equipItem(inv, equipped, "worn-blade");

    expect(result.ok).toBe(true);
    expect(result.equipment.weapon).toBe("worn-blade");
    expect(countOf(result.inventory, "amber-blade")).toBe(1); // 旧装備が戻る
    expect(countOf(result.inventory, "worn-blade")).toBe(0); // 新装備は消費
    expect(usedSpace(result.inventory)).toBe(INVENTORY_CAPACITY); // 総数は不変(保存)
  });
});

describe("unequipItem(解除)", () => {
  it("解除するとインベントリへ戻り、スロットが空になる", () => {
    const inv = emptyInventory();
    const equipped: Equipment = { weapon: "worn-blade", armor: null };
    const result = unequipItem(inv, equipped, "weapon");

    expect(result.ok).toBe(true);
    expect(result.equipment.weapon).toBeNull();
    expect(countOf(result.inventory, "worn-blade")).toBe(1);
  });

  it("インベントリ満杯なら解除に失敗し、状態は不変", () => {
    const inv = addItem(emptyInventory(), "potion-small", INVENTORY_CAPACITY).inventory;
    expect(usedSpace(inv)).toBe(INVENTORY_CAPACITY); // 満杯
    const equipped: Equipment = { weapon: "worn-blade", armor: null };
    const result = unequipItem(inv, equipped, "weapon");

    expect(result.ok).toBe(false);
    expect(result.inventory).toBe(inv);
    expect(result.equipment).toBe(equipped);
  });

  it("空スロットの解除は失敗(状態不変)", () => {
    const inv = emptyInventory();
    const equip = createEmptyEquipment();
    const result = unequipItem(inv, equip, "weapon");

    expect(result.ok).toBe(false);
    expect(result.equipment).toBe(equip);
  });
});

describe("effectiveStats(実効ステータス)", () => {
  const level = 5;
  const base = statsForLevel(level);

  it("装備なしは基礎値と一致する", () => {
    expect(effectiveStats(level, EMPTY_EQUIPMENT)).toEqual(base);
  });

  it("武器の atkBonus が attack に、防具の defBonus が defense に加算される", () => {
    const equipment: Equipment = { weapon: "amber-blade", armor: "warded-mail" };
    const stats = effectiveStats(level, equipment);

    expect(stats.attack).toBe(base.attack + (ITEMS["amber-blade"].atkBonus ?? 0));
    expect(stats.defense).toBe(base.defense + (ITEMS["warded-mail"].defBonus ?? 0));
    // それ以外のステータスは基礎値のまま
    expect(stats.maxHP).toBe(base.maxHP);
    expect(stats.maxMP).toBe(base.maxMP);
    expect(stats.speed).toBe(base.speed);
  });

  it("武器のみ・防具のみでも該当ステータスだけが上がる", () => {
    const weaponOnly = effectiveStats(level, { weapon: "worn-blade", armor: null });
    expect(weaponOnly.attack).toBe(base.attack + 3);
    expect(weaponOnly.defense).toBe(base.defense);

    const armorOnly = effectiveStats(level, { weapon: null, armor: "worn-cloak" });
    expect(armorOnly.attack).toBe(base.attack);
    expect(armorOnly.defense).toBe(base.defense + 2);
  });
});

describe("装備品定義の妥当性", () => {
  it("4種すべてが itemIdSchema に含まれ、slot と正のボーナスを持ち、questItem でなく売却可能", () => {
    expect(EQUIPMENT_ITEM_IDS).toHaveLength(4);
    for (const id of EQUIPMENT_ITEM_IDS) {
      expect(() => itemIdSchema.parse(id)).not.toThrow(); // itemId としても有効(定義ドリフト防止)
      const def = ITEMS[id];
      expect(def.slot).toBeDefined();
      expect(def.questItem).toBe(false);
      expect(isSellable(id)).toBe(true);
      expect(isEquipment(id)).toBe(true);
      expect(equipmentSlotOf(id)).toBe(def.slot);
    }
  });

  it("武器は weapon スロット + 正の atkBonus、防具は armor スロット + 正の defBonus を持つ", () => {
    for (const id of WEAPON_ITEM_IDS) {
      expect(ITEMS[id].slot).toBe("weapon");
      expect(ITEMS[id].atkBonus ?? 0).toBeGreaterThan(0);
    }
    for (const id of ARMOR_ITEM_IDS) {
      expect(ITEMS[id].slot).toBe("armor");
      expect(ITEMS[id].defBonus ?? 0).toBeGreaterThan(0);
    }
  });

  it("消耗品・クエスト品は装備品ではない", () => {
    expect(isEquipment("potion-small")).toBe(false);
    expect(isEquipment("old-key")).toBe(false);
    expect(equipmentSlotOf("potion-small")).toBeUndefined();
  });
});

describe("equipmentSchema(スロット別の型)", () => {
  it("空オブジェクトはデフォルト補完で空装備になる", () => {
    expect(equipmentSchema.parse({})).toEqual({ weapon: null, armor: null });
  });

  it("正しいスロットの装備品と null を受け入れる", () => {
    expect(equipmentSchema.parse({ weapon: "worn-blade", armor: "warded-mail" })).toEqual({
      weapon: "worn-blade",
      armor: "warded-mail"
    });
  });

  it("スロット違い(防具を武器スロットへ)は拒否する", () => {
    expect(equipmentSchema.safeParse({ weapon: "worn-cloak", armor: null }).success).toBe(false);
  });
});
