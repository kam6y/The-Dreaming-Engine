import { z } from "zod";

import { npcIdSchema } from "../ids.js";
import type { MapId } from "../map.js";
import { MAPS } from "../maps/index.js";
import { streetEventIdSchema } from "./street-event.js";

/**
 * 世界変化イベント(`trigger_world_event` の入力)と天候・ダンジョン層のヘルパー。
 * イベント定義の正は ai-integration.md「trigger_world_event」、
 * 敵シンボル数レンジの正は game-design.md「マップ構成」(ダンジョン各層2-6体)。
 */

/** 天候(初期 clear。weather イベントは後勝ちで置き換える) */
export const WEATHERS = ["clear", "fog", "rain", "gloom"] as const;
export const weatherSchema = z.enum(WEATHERS);
export type Weather = z.infer<typeof weatherSchema>;

/** npc_rumor の噂テキスト上限(120字。出力壁 checkDisplayText の maxLength に使う) */
export const NPC_RUMOR_MAX_LENGTH = 120;

/** dungeon_shift の対象層(ダンジョン1-3層のみ。フィールドは対象外) */
export const dungeonLayerSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type DungeonLayer = z.infer<typeof dungeonLayerSchema>;

/** dungeon_shift の増減(-1 / 0 / +1 のみ) */
export const symbolCountDeltaSchema = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

/**
 * 世界変化イベント(discriminated union)。定義済み kind 以外はスキーマ検証で却下される。
 * rumor の長さ(120字)・出力壁はツール検証層が checkDisplayText で検査する。
 */
export const worldEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("weather"), value: weatherSchema }),
  z.object({ kind: z.literal("npc_rumor"), npcId: npcIdSchema, rumor: z.string() }),
  z.object({ kind: z.literal("street_event"), eventId: streetEventIdSchema }),
  z.object({
    kind: z.literal("dungeon_shift"),
    layer: dungeonLayerSchema,
    symbolCountDelta: symbolCountDeltaSchema
  })
]);
export type WorldEvent = z.infer<typeof worldEventSchema>;

/** ダンジョン層 → マップ ID の対応 */
export const DUNGEON_LAYER_MAP_IDS: Record<DungeonLayer, MapId> = {
  1: "dungeon-1",
  2: "dungeon-2",
  3: "dungeon-3"
};

/** 対象層の敵シンボル数レンジ(マップ定義が唯一の正: game-design.md「マップ構成」) */
export function dungeonSymbolRange(layer: DungeonLayer): { min: number; max: number } {
  const map = MAPS[DUNGEON_LAYER_MAP_IDS[layer]];
  const config = map.enemySymbols;
  if (!config) {
    // マップ定義の不変条件(ダンジョン層は必ず enemySymbols を持つ)
    throw new Error(`ダンジョン層 ${layer} に enemySymbols が定義されていない`);
  }
  return { min: config.min, max: config.max };
}

/**
 * 対象層のレンジへ絶対クランプする。
 * dungeon_shift を何晩重ねてもシンボル数がレンジ外に出ないことの担保(ai-integration.md)。
 */
export function clampDungeonSymbolCount(layer: DungeonLayer, value: number): number {
  const { min, max } = dungeonSymbolRange(layer);
  return Math.min(max, Math.max(min, value));
}

/** 各層の敵シンボル数(セーブ対象。dungeon_shift 累積適用後の現在値) */
export const dungeonSymbolCountsSchema = z.object({
  1: z.number().int().nonnegative(),
  2: z.number().int().nonnegative(),
  3: z.number().int().nonnegative()
});
export type DungeonSymbolCounts = z.infer<typeof dungeonSymbolCountsSchema>;

/**
 * 敵シンボル数の初期値: 各層レンジの中央値(四捨五入。レンジ2-6なら4)。
 * 最大値/最小値で初期化すると +1/-1 の dungeon_shift が恒久的にクランプ無効化されるため、
 * 双方向に効き代を残す中央値を採用する(裁量。JOURNAL 記録対象)。
 */
export function initialDungeonSymbolCounts(): DungeonSymbolCounts {
  const median = (layer: DungeonLayer): number => {
    const { min, max } = dungeonSymbolRange(layer);
    return Math.round((min + max) / 2);
  };
  return { 1: median(1), 2: median(2), 3: median(3) };
}
