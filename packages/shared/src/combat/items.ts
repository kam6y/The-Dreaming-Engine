import { z } from "zod";

import type { StatusId } from "./status.js";

/**
 * アイテム識別子(M2最小限)。本格的なインベントリ・店はM3で実装するため、
 * ここでは戦闘で使える消耗品の「定義」のみを持つ。所持数の管理はM3/呼び出し側に委ねる。
 * - potion-small: 回復薬(小)。HPを小回復。
 * - potion-mid  : 回復薬(中)。HPを中回復(game-design.md のアイテム一覧「回復薬(小/中)」に対応。M3の店で使用)。
 * - antidote    : 解毒薬。毒を治療する(本パッケージで毒を導入するため対の手段として定義)。
 */
export const itemIdSchema = z.enum(["potion-small", "potion-mid", "antidote"]);
export type ItemId = z.infer<typeof itemIdSchema>;

/** 戦闘中のアイテム効果(判別可能union) */
export type ItemBattleEffect =
  | { kind: "heal-hp"; amount: number }
  | { kind: "cure-status"; status: StatusId };

/** アイテム定義。price/questItem はM3(店・所持上限)を見据えた最小限のメタ情報。 */
export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  /** 購入価格(ゴールド)。M3の店で使用 */
  buyPrice: number;
  /** クエスト用アイテム(売却・破棄不可)。消耗品は false(game-design.md「成長・経済」) */
  questItem: boolean;
  /** 戦闘中に使える効果。持たないアイテムは戦闘コマンド「どうぐ」で選べない */
  battleEffect?: ItemBattleEffect;
}

/** アイテム定義表(識別子 → 定義)。効果値・価格はClaude Codeの裁量。 */
export const ITEMS: Record<ItemId, ItemDefinition> = {
  "potion-small": {
    id: "potion-small",
    name: "回復薬(小)",
    description: "淡く光る雫。ひと口含むと、傷がゆっくりと塞がっていく。",
    buyPrice: 20,
    questItem: false,
    battleEffect: { kind: "heal-hp", amount: 30 }
  },
  "potion-mid": {
    id: "potion-mid",
    name: "回復薬(中)",
    description: "深い琥珀色の雫。小瓶ひとつで、深い傷にも届く。",
    buyPrice: 55,
    questItem: false,
    battleEffect: { kind: "heal-hp", amount: 80 }
  },
  antidote: {
    id: "antidote",
    name: "解毒薬",
    description: "澱んだものを洗い流す苦い薬。身に巣食う毒を鎮める。",
    buyPrice: 15,
    questItem: false,
    battleEffect: { kind: "cure-status", status: "poison" }
  }
};

/** 戦闘中に使えるアイテムか(battleEffect を持つか) */
export function isBattleUsable(id: ItemId): boolean {
  return ITEMS[id].battleEffect !== undefined;
}
