import { z } from "zod";

import type { StatusId } from "./status.js";

/**
 * アイテム識別子。戦闘消耗品(M2)に加え、M3のインベントリ・店・採取で使う
 * 素材・クエスト用アイテムを含む。
 * - potion-small: 回復薬(小)。HPを小回復。
 * - potion-mid  : 回復薬(中)。HPを中回復。
 * - antidote    : 解毒薬。毒を治療する。
 * - herb        : 薬草。採取ポイントで得る素材(売却用)。将来のfetchクエスト対象候補。
 * - ore         : 鉱石。採取ポイントで得る素材(売却用)。将来のfetchクエスト対象候補。
 * - old-key     : 古びた鍵。クエスト用アイテム(売却・破棄不可・所持上限対象外の別枠)。
 *                 M3では入手経路を持たない構造定義(別枠ロジックの検証・M6の仕掛け用の器)。
 */
export const itemIdSchema = z.enum([
  "potion-small",
  "potion-mid",
  "antidote",
  "herb",
  "ore",
  "old-key"
]);
export type ItemId = z.infer<typeof itemIdSchema>;

/** 戦闘中のアイテム効果(判別可能union) */
export type ItemBattleEffect =
  | { kind: "heal-hp"; amount: number }
  | { kind: "cure-status"; status: StatusId };

/** アイテム定義。price/questItem はM3(店・所持上限)で使うメタ情報。 */
export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  /** 店での購入価格(ゴールド)。店の品揃え(SHOP_STOCK)に載る品のみ意味を持つ。非売品は 0 */
  buyPrice: number;
  /**
   * 店での売却価格(ゴールド)。未指定なら floor(buyPrice/2) を売値とする(sellPriceOf)。
   * 素材のように buyPrice を持たない品は明示する。
   */
  sellPrice?: number;
  /** クエスト用アイテム(売却・破棄不可・所持上限対象外の別枠)。消耗品・素材は false(game-design.md「成長・経済」) */
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
  },
  herb: {
    id: "herb",
    name: "薬草",
    description: "淡い燐光を帯びた草。まだ夢の匂いが残っている。売れば幾らかにはなる。",
    buyPrice: 0,
    sellPrice: 5,
    questItem: false
  },
  ore: {
    id: "ore",
    name: "鉱石",
    description: "鈍く光る石。機関の欠片か、ただの石か――見分けはつかない。",
    buyPrice: 0,
    sellPrice: 12,
    questItem: false
  },
  "old-key": {
    id: "old-key",
    name: "古びた鍵",
    description: "誰かが握りしめたまま忘れていったような、錆びた鍵。手放してはいけない気がする。",
    buyPrice: 0,
    questItem: true
  }
};

/** 戦闘中に使えるアイテムか(battleEffect を持つか) */
export function isBattleUsable(id: ItemId): boolean {
  return ITEMS[id].battleEffect !== undefined;
}

/** 店での購入価格(ゴールド) */
export function buyPriceOf(id: ItemId): number {
  return ITEMS[id].buyPrice;
}

/**
 * 店での売却価格(ゴールド)。sellPrice が定義されていればそれを、
 * なければ floor(buyPrice/2) を使う(売却価格の規則は裁量: game-design.md「成長・経済」)。
 * クエスト用アイテムは売却不可のため、この値は店側の questItem チェックで使われない。
 */
export function sellPriceOf(id: ItemId): number {
  const def = ITEMS[id];
  return def.sellPrice ?? Math.floor(def.buyPrice / 2);
}

/** 売却可能なアイテムか(クエスト用アイテムは不可) */
export function isSellable(id: ItemId): boolean {
  return !ITEMS[id].questItem;
}
