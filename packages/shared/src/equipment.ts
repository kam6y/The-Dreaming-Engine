import { z } from "zod";

import {
  ARMOR_ITEM_IDS,
  equipmentSlotOf,
  ITEMS,
  WEAPON_ITEM_IDS
} from "./combat/items.js";
import type { EquipmentSlot, ItemId } from "./combat/items.js";
import { statsForLevel } from "./combat/stats.js";
import type { CombatantStats } from "./combat/stats.js";
import { clampResistance, statusIdSchema } from "./combat/status.js";
import type { StatusId, StatusResistances } from "./combat/status.js";
import { addItem, canAdd, countOf, removeItem } from "./inventory.js";
import type { Inventory } from "./inventory.js";

/**
 * 装備(武器・防具)の純ロジック。Phaser 非依存・不変更新(inventory.ts の流儀に合わせる)。
 *
 * モデル(game-design.md「装備(拡張: M8)」):
 * - スロットは2つ(weapon/armor)。各スロットは装備品1つ、または空(null)。
 * - 装備品はアイテムの一種(combat/items.ts に一元管理)。装備・解除はインベントリとの授受:
 *   装備=インベントリから1個消費してスロットへ、解除=スロットからインベントリへ戻す。
 * - スロット使用中に別の装備をすると入れ替え(旧装備はインベントリへ戻る)。新装備の除去で
 *   1枠空くため、インベントリ満杯でも入れ替えは常に成功する。
 * - 実効ステータス: 実効攻撃力 = レベル基礎攻撃力 + 武器の atkBonus、
 *   実効防御力 = レベル基礎防御力 + 防具の defBonus(他ステータスは基礎値のまま)。
 *   battle.ts への組み込みは M8-2 の範囲(ここでは effectiveStats を提供するのみ)。
 */

/**
 * 装備スロットの状態。各スロットは対応するスロットの装備品 ID または null。
 * zod でスロットごとに装備可能 ID のみ許容する(武器スロットに防具を入れられない)。
 * 後方互換のため各スロットは .default(null)(旧セーブの補完に使う)。
 */
export const equipmentSchema = z.object({
  weapon: z.enum(WEAPON_ITEM_IDS).nullable().default(null),
  armor: z.enum(ARMOR_ITEM_IDS).nullable().default(null)
});
export type Equipment = z.infer<typeof equipmentSchema>;

/** 何も装備していない状態(参照用の定数。生成には createEmptyEquipment を使う) */
export const EMPTY_EQUIPMENT: Equipment = { weapon: null, armor: null };

/** 空の装備状態を生成する(新規ゲーム・スキーマ既定値。共有参照を避けるため都度生成) */
export function createEmptyEquipment(): Equipment {
  return { weapon: null, armor: null };
}

/** 装備・解除の結果(成否と、更新後のインベントリ・装備状態) */
export interface EquipResult {
  /** 操作が成立したか(失敗時は inventory/equipment は入力と同一で不変) */
  ok: boolean;
  inventory: Inventory;
  equipment: Equipment;
}

/**
 * インベントリの装備品をスロットへ装備する。
 * - 装備不可アイテム(slot を持たない)・未所持なら失敗(状態不変)。
 * - インベントリから当該品を1個消費し、スロットへ収める。
 * - スロット使用中なら入れ替え(旧装備をインベントリへ戻す)。1個消費で枠が空くため満杯でも成功する。
 */
export function equipItem(inventory: Inventory, equipment: Equipment, itemId: ItemId): EquipResult {
  const slot = equipmentSlotOf(itemId);
  if (!slot) return { ok: false, inventory, equipment }; // 装備不可アイテム
  if (countOf(inventory, itemId) <= 0) return { ok: false, inventory, equipment }; // 未所持

  // インベントリから1個消費 → 旧装備を戻す(この順序により満杯でも常に1枠空く)
  let nextInv = removeItem(inventory, itemId, 1).inventory;
  const previous = equipment[slot];
  if (previous !== null) {
    nextInv = addItem(nextInv, previous, 1).inventory;
  }
  const nextEquipment: Equipment = { ...equipment, [slot]: itemId };
  return { ok: true, inventory: nextInv, equipment: nextEquipment };
}

/**
 * スロットの装備を解除し、インベントリへ戻す。
 * - スロットが空なら失敗(状態不変)。
 * - インベントリが満杯で戻せないなら失敗(状態不変)。
 */
export function unequipItem(inventory: Inventory, equipment: Equipment, slot: EquipmentSlot): EquipResult {
  const equipped = equipment[slot];
  if (equipped === null) return { ok: false, inventory, equipment }; // 何も装備していない
  if (!canAdd(inventory, equipped, 1)) return { ok: false, inventory, equipment }; // 満杯で戻せない

  const nextInv = addItem(inventory, equipped, 1).inventory;
  const nextEquipment: Equipment = { ...equipment, [slot]: null };
  return { ok: true, inventory: nextInv, equipment: nextEquipment };
}

/**
 * レベル基礎ステータスに装備ボーナスを反映した実効ステータスを返す。
 * attack に武器の atkBonus、defense に防具の defBonus を加算し、他ステータスは基礎値のまま。
 * ダメージ式の構造は不変で、攻撃力・防御力の入力が装備込みになるだけ(game-design.md「装備(拡張: M8)」)。
 */
export function effectiveStats(level: number, equipment: Equipment): CombatantStats {
  const base = statsForLevel(level);
  const atkBonus = equipment.weapon ? ITEMS[equipment.weapon].atkBonus ?? 0 : 0;
  const defBonus = equipment.armor ? ITEMS[equipment.armor].defBonus ?? 0 : 0;
  return {
    ...base,
    attack: base.attack + atkBonus,
    defense: base.defense + defBonus
  };
}

/**
 * 装備由来の状態異常耐性(M21-3)。装備中の武器・防具の resistances を kind ごとに合算し、
 * 0.0〜1.0 にクランプして返す(複数装備が同じ kind へ耐性を持つ場合は加算・上限1.0)。
 * プレイヤーの耐性は装備由来のみ(レベル基礎値には持たせない=game-design.md「耐性」)。
 * 空装備なら空の耐性(すべて0)を返し、装備なしの計測(combat-balance.test)へ一切影響しない。
 */
export function effectiveStatusResistances(equipment: Equipment): StatusResistances {
  const totals: Partial<Record<StatusId, number>> = {};
  const slots = [equipment.weapon, equipment.armor];
  for (const itemId of slots) {
    if (itemId === null) continue;
    const res = ITEMS[itemId].resistances;
    if (res === undefined) continue;
    for (const [kind, value] of Object.entries(res)) {
      // Object.entries のキーは string なので StatusId へ厳格に絞り込む(想定外キーは無視)
      const parsed = statusIdSchema.safeParse(kind);
      if (!parsed.success || value === undefined) continue;
      totals[parsed.data] = (totals[parsed.data] ?? 0) + value;
    }
  }
  const result: StatusResistances = {};
  for (const [kind, value] of Object.entries(totals)) {
    const parsed = statusIdSchema.safeParse(kind);
    if (parsed.success && value !== undefined) result[parsed.data] = clampResistance(value);
  }
  return result;
}
