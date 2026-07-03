import { z } from "zod";

import { playerProgressSchema, statsForLevel } from "./combat/index.js";
import { directionSchema, positionSchema } from "./geometry.js";
import { addItem, emptyInventory, inventorySchema } from "./inventory.js";
import { mapIdSchema } from "./map.js";
import { NEW_GAME_START } from "./maps/index.js";

/**
 * サーバー権威の GameState(セーブの正本)。version 付き。
 *
 * game-design.md「セーブ/ロード」の保存対象のうち、**M3 時点で存在する状態のみ**を含む
 * (プレイヤー・位置・インベントリ・クエスト用アイテム別枠・ゲーム内日付・プレイ時間・
 * マップギミックの解決状態)。M4 以降の NPC 状態・世界状態・クエスト進行・戦果描写済み記録・
 * 日次カウンタは version を上げて追加する(JOURNAL に注記)。
 */

/** セーブスキーマのバージョン。version 不一致は破損と同扱い(game-design.md) */
export const GAME_STATE_VERSION = 1;

/** 宿泊費(定額の少額。game-design.md「宿泊の処理順序」手順0) */
export const INN_COST = 10;

/** 新規ゲームの初期ゴールド(裁量。M2 のクライアント値を継承) */
export const INITIAL_GOLD = 30;

/** 新規ゲームの初期所持品(裁量: 回復薬(小)×2。店実装までの緩衝) */
export const INITIAL_ITEMS: readonly { itemId: "potion-small"; count: number }[] = [
  { itemId: "potion-small", count: 2 }
];

/** ゲーム内の位置(マップ・座標・向き) */
export const gameLocationSchema = z.object({
  mapId: mapIdSchema,
  position: positionSchema,
  facing: directionSchema
});
export type GameLocation = z.infer<typeof gameLocationSchema>;

/**
 * 全滅帰還で目覚める地点(街=灯町、宿屋オルガの前 (4,5) を向く)。
 * game-design.md「全滅時」「ゲーム内時間」: HP/MP全回復+ゴールド半減+日送りで宿屋で目覚める。
 */
export const TOWN_WAKE_POINT: GameLocation = {
  mapId: "town",
  position: { x: 4, y: 5 },
  facing: "up"
};

export const gameStateSchema = z.object({
  version: z.literal(GAME_STATE_VERSION),
  /** プレイヤー状態(レベル・経験値・HP/MP・ゴールド) */
  player: playerProgressSchema,
  /** 位置(マップ・座標・向き) */
  location: gameLocationSchema,
  /** インベントリ(通常アイテム + クエスト用アイテム別枠) */
  inventory: inventorySchema,
  /** ゲーム内日付(1日目からの通し番号)。宿泊と全滅帰還でのみ +1(game-design.md「ゲーム内時間」) */
  day: z.number().int().positive(),
  /** プレイ時間(秒。サーバーで計測しセーブに含める) */
  playtimeSeconds: z.number().int().nonnegative(),
  /**
   * マップギミックの解決状態(開けた宝箱・押したスイッチ・使用済みの鍵等の id)。
   * ロードで巻き戻ると鍵消費型の仕掛けが進行不能になるため永続化する(game-design.md)。
   */
  gimmicks: z.array(z.string())
});
export type GameState = z.infer<typeof gameStateSchema>;

/** 新規ゲームの GameState を生成する(既存セーブには触れない) */
export function createNewGameState(): GameState {
  const stats = statsForLevel(1);
  let inventory = emptyInventory();
  for (const { itemId, count } of INITIAL_ITEMS) {
    inventory = addItem(inventory, itemId, count).inventory;
  }
  return {
    version: GAME_STATE_VERSION,
    player: { level: 1, xp: 0, hp: stats.maxHP, mp: stats.maxMP, gold: INITIAL_GOLD },
    location: {
      mapId: NEW_GAME_START.mapId,
      position: { ...NEW_GAME_START.position },
      facing: NEW_GAME_START.facing
    },
    inventory,
    day: 1,
    playtimeSeconds: 0,
    gimmicks: []
  };
}
