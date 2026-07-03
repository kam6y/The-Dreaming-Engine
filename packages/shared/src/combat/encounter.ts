import { z } from "zod";

import { positionSchema, samePosition } from "../geometry.js";
import type { Position } from "../geometry.js";
import { enemyIdSchema, RESPAWNABLE_ENEMY_IDS } from "../ids.js";
import { isWalkable } from "../map.js";
import type { MapDefinition } from "../map.js";
import type { Rng } from "../rng.js";

/** 敵シンボルの配置(マップ上に置く1体分) */
export const enemySymbolPlacementSchema = z.object({
  position: positionSchema,
  enemyId: enemyIdSchema
});
export type EnemySymbolPlacement = z.infer<typeof enemySymbolPlacementSchema>;

/**
 * マップの enemySymbols 設定に従い、敵シンボルの出現数・配置座標・敵種をサンプリングする。
 *
 * - 出現数は [min, max] からサンプル(game-design.md「マップ構成」のマップ別レンジが正)
 * - 配置マスは通行可能(isWalkable=地形非solid かつ NPC/オブジェクト/ボス非占有)で、
 *   さらに遷移マス・プレイヤー初期位置(playerStart)を避ける
 * - 敵種は species からサンプル(ボス「夢喰い」はリスポーン対象外=RESPAWNABLE に限定して混入を防ぐ)
 *
 * 候補マスが不足する場合は取れる数だけ返す(数はレンジ上限を超えない)。
 * 同一 (map, rng状態) で完全に再現可能。rng の状態は呼び出し側で管理する。
 */
export function sampleEnemySymbols(map: MapDefinition, rng: Rng): EnemySymbolPlacement[] {
  const config = map.enemySymbols;
  if (!config || config.max <= 0) return [];

  // 出現しうる敵種はリスポーン可能な雑魚に限定(ボス混入の防止)
  const species = config.species.filter((id) => RESPAWNABLE_ENEMY_IDS.includes(id));
  if (species.length === 0) return [];

  const count = rng.int(config.min, config.max);
  if (count <= 0) return [];

  const candidates = collectSpawnableTiles(map);
  if (candidates.length === 0) return [];

  const chosen = pickDistinct(candidates, count, rng);
  const placements: EnemySymbolPlacement[] = [];
  for (const position of chosen) {
    const enemyId = species[rng.int(0, species.length - 1)];
    if (!enemyId) continue; // species は非空を保証済み(noUncheckedIndexedAccess 対策)
    placements.push({ position, enemyId });
  }
  return placements;
}

/** 敵シンボルを置ける全マスを収集する(禁止マスを除外) */
function collectSpawnableTiles(map: MapDefinition): Position[] {
  const forbidden = forbiddenPositions(map);
  const tiles: Position[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const pos = { x, y };
      // isWalkable が地形solid・NPC/オブジェクト/ボス占有を除外する。
      if (!isWalkable(map, pos)) continue;
      // 遷移マス・プレイヤー初期位置を追加で除外。
      if (forbidden.some((f) => samePosition(f, pos))) continue;
      tiles.push(pos);
    }
  }
  return tiles;
}

function forbiddenPositions(map: MapDefinition): Position[] {
  const forbidden: Position[] = map.transitions.map((t) => t.position);
  if (map.playerStart) forbidden.push(map.playerStart.position);
  return forbidden;
}

/** 候補から重複なく count 個(不足時はある分だけ)を等確率で選ぶ(Fisher-Yates 部分抽出) */
function pickDistinct(candidates: Position[], count: number, rng: Rng): Position[] {
  const pool = candidates.slice();
  const take = Math.min(count, pool.length);
  const result: Position[] = [];
  for (let i = 0; i < take; i += 1) {
    const j = rng.int(i, pool.length - 1);
    const a = pool[i];
    const b = pool[j];
    if (a && b) {
      pool[i] = b;
      pool[j] = a;
    }
    const picked = pool[i];
    if (picked) result.push(picked);
  }
  return result;
}
