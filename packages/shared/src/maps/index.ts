import type { Direction, Position } from "../geometry.js";
import type { MapDefinition, MapId } from "../map.js";
import { townMap } from "./town.js";
import { fieldMap } from "./field.js";
import { dungeon1Map } from "./dungeon1.js";
import { dungeon2Map } from "./dungeon2.js";
import { dungeon3Map } from "./dungeon3.js";
import { settlementMap } from "./settlement.js";
import { field2Map } from "./field2.js";
import { dungeon4Map } from "./dungeon4.js";

/** 全マップのレジストリ(id → 定義)。 */
export const MAPS: Record<MapId, MapDefinition> = {
  town: townMap,
  field: fieldMap,
  "dungeon-1": dungeon1Map,
  "dungeon-2": dungeon2Map,
  "dungeon-3": dungeon3Map,
  // 第2エリア(M16)
  settlement: settlementMap,
  "field-2": field2Map,
  "dungeon-4": dungeon4Map
};

/** 全マップ定義の配列(検証・列挙用) */
export const ALL_MAPS: readonly MapDefinition[] = Object.values(MAPS);

export function getMap(id: MapId): MapDefinition {
  return MAPS[id];
}

export {
  townMap,
  fieldMap,
  dungeon1Map,
  dungeon2Map,
  dungeon3Map,
  settlementMap,
  field2Map,
  dungeon4Map
};

/**
 * 新規ゲーム開始地点(街=灯町のプレイヤー初期位置)。
 * town.playerStart から導出する(単一の正)。
 */
function resolveNewGameStart(): { mapId: MapId; position: Position; facing: Direction } {
  const start = townMap.playerStart;
  if (!start) {
    // town には playerStart を必ず定義する(スキーマ上は任意なので保険)
    throw new Error("街マップに playerStart が定義されていない");
  }
  return { mapId: "town", position: start.position, facing: start.facing };
}

export const NEW_GAME_START: { mapId: MapId; position: Position; facing: Direction } =
  resolveNewGameStart();
