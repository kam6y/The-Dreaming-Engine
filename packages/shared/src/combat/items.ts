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
 * - sealed-letter / warm-oil-flask / amber-charm:
 *                 配達(deliver)サブクエストの預かり品(M19)。クエスト用アイテム
 *                 (別枠・所持上限対象外・売却/破棄不可)。受諾で別枠へ受領し納品で消える器。
 * - worn-blade  : 錆びた片刃。初級の武器(weapon スロット。M8-1)。
 * - amber-blade : 琥珀刃。上級の武器(weapon スロット。M8-1)。
 * - worn-cloak  : 擦り切れた外套。初級の防具(armor スロット。M8-1)。
 * - warded-mail : 灯守りの帷子。上級の防具(armor スロット。M8-1)。
 */

/** 装備スロット(武器・防具の2種。game-design.md「装備(拡張: M8)」) */
export const equipmentSlotSchema = z.enum(["weapon", "armor"]);
export type EquipmentSlot = z.infer<typeof equipmentSlotSchema>;

/** 武器スロットに装備できるアイテム ID(初級 → 上級) */
export const WEAPON_ITEM_IDS = ["worn-blade", "amber-blade"] as const;
/** 防具スロットに装備できるアイテム ID(初級 → 上級) */
export const ARMOR_ITEM_IDS = ["worn-cloak", "warded-mail"] as const;
/** 装備可能アイテム ID の全体(武器 + 防具)。equipment.ts のスロット別スキーマで使う */
export const EQUIPMENT_ITEM_IDS = [...WEAPON_ITEM_IDS, ...ARMOR_ITEM_IDS] as const;

export const equipmentItemIdSchema = z.enum(EQUIPMENT_ITEM_IDS);
/** 装備可能アイテムの ID(itemIdSchema の部分集合) */
export type EquipmentItemId = z.infer<typeof equipmentItemIdSchema>;

export const itemIdSchema = z.enum([
  "potion-small",
  "potion-mid",
  "antidote",
  "herb",
  "ore",
  "old-key",
  "sealed-letter",
  "warm-oil-flask",
  "amber-charm",
  "worn-blade",
  "amber-blade",
  "worn-cloak",
  "warded-mail"
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
  /**
   * 装備スロット(weapon/armor)。定義されている品のみ装備できる(M8-1)。
   * weapon は atkBonus を、armor は defBonus を持つ(game-design.md「装備(拡張: M8)」)。
   */
  slot?: EquipmentSlot;
  /** 武器の攻撃ボーナス(実効攻撃力 = レベル基礎攻撃力 + atkBonus)。weapon スロットのみ */
  atkBonus?: number;
  /** 防具の防御ボーナス(実効防御力 = レベル基礎防御力 + defBonus)。armor スロットのみ */
  defBonus?: number;
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
  },
  "sealed-letter": {
    id: "sealed-letter",
    name: "封緘の文",
    description: "蝋で固く封じられた一通の文。宛先の名だけが、掠れた墨で記されている。",
    buyPrice: 0,
    questItem: true
  },
  "warm-oil-flask": {
    id: "warm-oil-flask",
    name: "灯火の油壺",
    description: "手に持つとほのかに温かい油の壺。誰かの灯を絶やさぬよう、届けを頼まれた。",
    buyPrice: 0,
    questItem: true
  },
  "amber-charm": {
    id: "amber-charm",
    name: "琥珀の護符",
    description: "灯の亡骸を磨いた小さな護符。贈り主の願いが、鈍い橙の奥で眠っている。",
    buyPrice: 0,
    questItem: true
  },
  "worn-blade": {
    id: "worn-blade",
    name: "錆びた片刃",
    description: "青灰の錆を刃に浮かべた、名もなき誰かの得物。切れ味は鈍いが、握れば少しだけ心強い。",
    buyPrice: 60,
    questItem: false,
    slot: "weapon",
    atkBonus: 3
  },
  "amber-blade": {
    id: "amber-blade",
    name: "琥珀刃",
    description: "刀身に琥珀色の灯を宿した刃。振るうたび、忘れられた願いがひとつ、静かに燃える。",
    buyPrice: 180,
    questItem: false,
    slot: "weapon",
    atkBonus: 7
  },
  "worn-cloak": {
    id: "worn-cloak",
    name: "擦り切れた外套",
    description: "幾人もの旅人が羽織り、置いていった外套。青灰の埃を吸って重いが、夜風は防いでくれる。",
    buyPrice: 50,
    questItem: false,
    slot: "armor",
    defBonus: 2
  },
  "warded-mail": {
    id: "warded-mail",
    name: "灯守りの帷子",
    description: "灯守堂に伝わる、まどろみを弾く帷子。琥珀の環が縫い込まれ、悪夢の牙をわずかに遠ざける。",
    buyPrice: 150,
    questItem: false,
    slot: "armor",
    defBonus: 5
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

/** 装備品か(slot を持つか)。true なら装備スロットへ装備できる(M8-1) */
export function isEquipment(id: ItemId): id is EquipmentItemId {
  return ITEMS[id].slot !== undefined;
}

/** 装備先スロット。装備品でなければ undefined(M8-1) */
export function equipmentSlotOf(id: ItemId): EquipmentSlot | undefined {
  return ITEMS[id].slot;
}
