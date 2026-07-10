import { z } from "zod";

import type { ItemId } from "../combat/items.js";
import type { NpcId } from "../ids.js";

/**
 * deliver 型サブクエスト(`propose_quest`。M19)の 2 参照系ホワイトリスト。
 * hunt/fetch と同じく `shared` の列挙で定義し、実在性はユニットテストで担保する。
 */

/**
 * 配達の受取NPC(`recipientId`)ホワイトリスト。
 * **会話可能NPC(`NpcId`)から情報屋 `informant` を除いた**部分集合
 * (受注元カイへ配達する無意味なクエストを防ぐ: ai-integration.md「5b」)。
 *
 * 縦切りの初期候補は仕様の明示リストどおり `innkeeper`/`merchant`/`priest`/`artisan` の4名。
 * 世話役 `caretaker`・番人 `warden` は初期候補から除く(ホワイトリストは最小に保つ方針。
 * warden は物語役=語り部で店・宿の窓口を持たないため配達先として置かない。M19-2 の裁量: JOURNAL 記録)。
 * `informant` を含まないこと・各 ID が実在 `NpcId` であることをユニットテストで担保する。
 */
export const DELIVER_RECIPIENT_IDS = [
  "innkeeper",
  "merchant",
  "priest",
  "artisan"
] as const satisfies readonly NpcId[];

export const deliverRecipientIdSchema = z.enum(DELIVER_RECIPIENT_IDS);
export type DeliverRecipientId = z.infer<typeof deliverRecipientIdSchema>;

/** 配達の受取NPCとして有効か(ホワイトリスト内か) */
export function isDeliverRecipient(id: string): id is DeliverRecipientId {
  return deliverRecipientIdSchema.safeParse(id).success;
}

/**
 * 配達の預かり品(`parcelId`)ホワイトリスト=**クエスト用アイテムの新設ホワイトリスト**。
 * 別枠管理・所持上限対象外・売却/破棄不可(game-design.md「成長・経済」)。
 * 一点物 `old-key` は含めない(配達で消費する再入手不要の器のみ)。
 *
 * 各 ID が実在 `ItemId` かつ `questItem: true`(=売却/破棄不可)であることをユニットテストで担保する。
 */
export const DELIVER_PARCEL_IDS = [
  "sealed-letter",
  "warm-oil-flask",
  "amber-charm"
] as const satisfies readonly ItemId[];

export const deliverParcelIdSchema = z.enum(DELIVER_PARCEL_IDS);
export type DeliverParcelId = z.infer<typeof deliverParcelIdSchema>;

/** 配達の預かり品として有効か(ホワイトリスト内か) */
export function isDeliverParcel(id: string): id is DeliverParcelId {
  return deliverParcelIdSchema.safeParse(id).success;
}
