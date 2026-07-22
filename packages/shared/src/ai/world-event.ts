import { z } from "zod";

import { npcIdSchema } from "../ids.js";
import type { NpcId } from "../ids.js";
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

// ---------------------------------------------------------------------------
// M20 追加: 夢の世界変化3種(market_shift / npc_absence / dream_erosion)。
// すべて決定論(AI が選ぶのは種類と定義済み選択肢のみ)。正は ai-integration.md「6b」。
// ---------------------------------------------------------------------------

/**
 * market_shift の市場モード(店の買値への一時倍率。翌日限り・後勝ち)。
 * 倍率の値(scarcity=×1.2 / surplus=×0.9)は経済ロジックのため shop.ts の
 * `MARKET_SHIFT_MULTIPLIERS` が正(合成・売値クランプは shop.ts)。自由数値は受け付けない。
 */
export const MARKET_SHIFT_MODES = ["scarcity", "surplus"] as const;
export const marketShiftModeSchema = z.enum(MARKET_SHIFT_MODES);
export type MarketShiftMode = z.infer<typeof marketShiftModeSchema>;

/** market_shift の mode として有効か(enum 内か) */
export function isMarketShiftMode(mode: string): mode is MarketShiftMode {
  return marketShiftModeSchema.safeParse(mode).success;
}

/**
 * npc_absence の対象NPC(翌日1日だけ不在にできる NPC のホワイトリスト)。
 * **消えても進行不能にならない NPC** に限る=`DeliverRecipientId` と同様に実在 `NpcId` の部分集合。
 * 初期ホワイトリスト: `innkeeper`(オルガ)/`merchant`(レンド)/`caretaker`(イルマ)/`artisan`(ガロ)。
 * **除外必須**: `priest`(フィオル=メインクエスト進行役)・`informant`(カイ=サブクエスト窓口)・
 * `warden`(トワ=第2章進行の担い手)。同時不在は1人まで(検証層の後勝ち)ゆえ
 * 宿(innkeeper/caretaker)・店(merchant/artisan)は同時全滅しない。
 * 各 ID が実在 `NpcId` かつ priest/informant/warden を含まないことをユニットテストで担保する。
 */
export const ABSENT_NPC_IDS = [
  "innkeeper",
  "merchant",
  "caretaker",
  "artisan"
] as const satisfies readonly NpcId[];

export const absentNpcIdSchema = z.enum(ABSENT_NPC_IDS);
export type AbsentNpcId = z.infer<typeof absentNpcIdSchema>;

/** npc_absence の対象として有効か(ホワイトリスト内か) */
export function isAbsentNpc(id: string): id is AbsentNpcId {
  return absentNpcIdSchema.safeParse(id).success;
}

/** dream_erosion の増減(-1 / 0 / +1 のみ)。侵食度を一段階増減する */
export const dreamErosionDeltaSchema = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

/** dream_erosion(侵食度)の絶対レンジ 0-3(0=平穏 / 1=兆し / 2=綻び / 3=侵食) */
export const DREAM_EROSION_MIN = 0;
export const DREAM_EROSION_MAX = 3;

/**
 * 侵食度を 0-3 へ絶対クランプする(dungeon_shift の clampDungeonSymbolCount と同型)。
 * 承認順に累積適用しても何晩重ねてもレンジ外に出ないことの担保(ai-integration.md「6b」)。
 */
export function clampDreamErosion(value: number): number {
  return Math.min(DREAM_EROSION_MAX, Math.max(DREAM_EROSION_MIN, value));
}

/**
 * 世界変化イベント(discriminated union)。定義済み kind 以外はスキーマ検証で却下される。
 * rumor の長さ(120字)・出力壁はツール検証層が checkDisplayText で検査する。
 * market_shift / npc_absence / dream_erosion(M20 追加)はテキスト系フィールドを持たず出力壁対象外。
 */
export const worldEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("weather"), value: weatherSchema }),
  z.object({ kind: z.literal("npc_rumor"), npcId: npcIdSchema, rumor: z.string() }),
  z.object({ kind: z.literal("street_event"), eventId: streetEventIdSchema }),
  z.object({
    kind: z.literal("dungeon_shift"),
    layer: dungeonLayerSchema,
    symbolCountDelta: symbolCountDeltaSchema
  }),
  z.object({ kind: z.literal("market_shift"), mode: marketShiftModeSchema }),
  z.object({ kind: z.literal("npc_absence"), npcId: absentNpcIdSchema }),
  z.object({ kind: z.literal("dream_erosion"), delta: dreamErosionDeltaSchema })
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
