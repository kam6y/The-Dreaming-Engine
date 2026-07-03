import type { ItemId } from "./combat/items.js";

/**
 * 宝箱・採取ポイントの中身(裁量: game-design.md「採取=薬草/鉱石等の素材」「宝箱=消耗品等」)。
 * キーはマップオブジェクトの id(maps/*.ts の objects.id と一致)。
 *
 * - 宝箱(chest): 開封で入手。開封状態はギミック状態として永続化(再訪でも空)。
 * - 採取(gather): 採取で入手。採取後はそのマップから離れて再訪した時にリスポーンする。
 *
 * 満杯時は取得せず対象をマップに残す(取り残し。game-design.md「成長・経済」)。判定は server 側。
 */

export interface LootEntry {
  itemId: ItemId;
  count: number;
}

/** 宝箱の中身(objectId → 内容) */
export const CHEST_CONTENTS: Record<string, readonly LootEntry[]> = {
  "d1-chest": [{ itemId: "potion-mid", count: 1 }],
  "d2-chest": [
    { itemId: "potion-mid", count: 1 },
    { itemId: "antidote", count: 1 }
  ]
};

/** 採取ポイントの中身(objectId → 内容) */
export const GATHER_CONTENTS: Record<string, readonly LootEntry[]> = {
  "field-gather-herb": [{ itemId: "herb", count: 1 }],
  "field-gather-ore": [{ itemId: "ore", count: 1 }]
};

/** 指定オブジェクトの中身を返す(定義がなければ空配列) */
export function lootForChest(objectId: string): readonly LootEntry[] {
  return CHEST_CONTENTS[objectId] ?? [];
}

export function lootForGather(objectId: string): readonly LootEntry[] {
  return GATHER_CONTENTS[objectId] ?? [];
}
