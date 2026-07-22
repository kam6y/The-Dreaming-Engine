import { ITEMS, STATUS_DISPLAY_NAMES, type ItemId } from "@dreaming-engine/shared";

/**
 * アイテムの短い性能表記(リストのラベルに付ける括弧書き。M15-3)。
 * - 装備品: 攻/防ボーナス(M8-4の表記を踏襲)
 * - 消耗品: 戦闘効果(回復量・状態異常の治療)。「何をするか」を購入・使用前に確認できる
 * - 素材・クエスト用アイテム: 空文字(効果を持たない)
 */
export function itemShortLabel(itemId: ItemId): string {
  const def = ITEMS[itemId];
  if (def.slot === "weapon") {
    return `(攻+${def.atkBonus ?? 0})`;
  }
  if (def.slot === "armor") {
    return `(防+${def.defBonus ?? 0})`;
  }
  const effect = def.battleEffect;
  if (effect === undefined) {
    return "";
  }
  if (effect.kind === "heal-hp") {
    return `(HP+${effect.amount})`;
  }
  if (effect.kind === "cure-status") {
    return `(${STATUS_DISPLAY_NAMES[effect.status]}を治す)`;
  }
  // cure-statuses(灯明=眩惑・竦みの解除。M21-3の型追従。演出詳細はM21-4)
  return `(${effect.statuses.map((s) => STATUS_DISPLAY_NAMES[s]).join("・")}を治す)`;
}
