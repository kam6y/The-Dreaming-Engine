import { z } from "zod";

import type { Position } from "../geometry.js";
import type { MapId } from "../map.js";

/**
 * escort 型サブクエスト(`propose_quest`。M19)の目的地ホワイトリスト。
 * **既存11マップの通行可能な到達地点**(新IDだが座標は実在・walkable)。
 * 各エントリは (mapId, 座標) を持ち、座標が該当マップで walkable であることを
 * ユニットテストで担保する(ai-integration.md「5b」)。
 */

/** escort 目的地の実在地点(既存マップの通行可能マス) */
export interface EscortDestination {
  readonly mapId: MapId;
  readonly position: Position;
}

export const ESCORT_DESTINATION_IDS = [
  "town-gate",
  "settlement-gate",
  "field-crossroads"
] as const;

export const escortDestinationIdSchema = z.enum(ESCORT_DESTINATION_IDS);
export type EscortDestinationId = z.infer<typeof escortDestinationIdSchema>;

/**
 * 目的地IDごとの到達地点(mapId + 座標)。
 * - town-gate       : 灯町・南門の内側 town(11,13)
 * - settlement-gate : 琥珀郷・南門の内側 settlement(8,10)
 * - field-crossroads: 忘れ野・十字路 field(11,8)
 * キー集合が ESCORT_DESTINATION_IDS と一致し、各座標が walkable であることをテストで担保する。
 */
export const ESCORT_DESTINATIONS: Record<EscortDestinationId, EscortDestination> = {
  "town-gate": { mapId: "town", position: { x: 11, y: 13 } },
  "settlement-gate": { mapId: "settlement", position: { x: 8, y: 10 } },
  "field-crossroads": { mapId: "field", position: { x: 11, y: 8 } }
};

/** 目的地IDの表示名(クエストジャーナルの現況表示に使う。語彙は裁量: JOURNAL 記録) */
export const ESCORT_DESTINATION_NAMES: Record<EscortDestinationId, string> = {
  "town-gate": "灯町・南門",
  "settlement-gate": "琥珀郷・南門",
  "field-crossroads": "忘れ野・十字路"
};

/** escort の目的地として有効か(ホワイトリスト内か) */
export function isEscortDestination(id: string): id is EscortDestinationId {
  return escortDestinationIdSchema.safeParse(id).success;
}

/** 目的地IDから到達地点(mapId + 座標)を引く */
export function escortDestinationLocation(id: EscortDestinationId): EscortDestination {
  return ESCORT_DESTINATIONS[id];
}
