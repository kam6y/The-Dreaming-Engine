import {
  DIRECTIONS,
  MAPS,
  isWalkable,
  neighbor,
  transitionAt
} from "../../src/index.js";
import type { MapDefinition, MapId, Position } from "../../src/index.js";

/** マップをまたぐBFS到達判定用のセルキー */
function cellKey(mapId: MapId, position: Position): string {
  return `${mapId}:${position.x}:${position.y}`;
}

export interface CrossMapStart {
  mapId: MapId;
  position: Position;
}

/**
 * 全マップ(MAPS)をまたいで、開始セルから歩いて到達できるセル集合を返す。
 * - 通行可能な隣接マスへ移動できる
 * - 遷移マスに立つと行き先マップの到着マスへワープする
 * 返すのは到達済みセルキー(`mapId:x:y`)のSet。
 */
export function reachableCells(start: CrossMapStart): Set<string> {
  const seen = new Set<string>();
  const queue: CrossMapStart[] = [];
  const enqueue = (mapId: MapId, position: Position): void => {
    const key = cellKey(mapId, position);
    if (!seen.has(key)) {
      seen.add(key);
      queue.push({ mapId, position });
    }
  };
  enqueue(start.mapId, start.position);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const map = MAPS[current.mapId];
    for (const direction of DIRECTIONS) {
      const next = neighbor(current.position, direction);
      if (isWalkable(map, next)) {
        enqueue(current.mapId, next);
      }
    }
    const transition = transitionAt(map, current.position);
    if (transition) {
      enqueue(transition.to.mapId, transition.to.position);
    }
  }
  return seen;
}

export function isCellReachable(
  reachable: Set<string>,
  mapId: MapId,
  position: Position
): boolean {
  return reachable.has(cellKey(mapId, position));
}

/** 指定マスの4隣接のいずれかが到達済みか(占有マス=ボス等の「隣に立てるか」判定) */
export function isAdjacentReachable(
  reachable: Set<string>,
  mapId: MapId,
  position: Position
): boolean {
  return DIRECTIONS.some((direction) =>
    isCellReachable(reachable, mapId, neighbor(position, direction))
  );
}

/** デバッグ用: 到達済みマスを `+` で塗ったマップ図を返す(接続性テスト失敗時の目視用) */
export function renderReachable(map: MapDefinition, reachable: Set<string>): string {
  return map.rows
    .map((row, y) =>
      [...row]
        .map((ch, x) =>
          isCellReachable(reachable, map.id, { x, y }) ? "+" : ch
        )
        .join("")
    )
    .join("\n");
}
