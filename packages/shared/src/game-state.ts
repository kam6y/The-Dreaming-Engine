import { z } from "zod";

import { streetEventIdSchema } from "./ai/street-event.js";
import {
  dungeonSymbolCountsSchema,
  initialDungeonSymbolCounts,
  weatherSchema
} from "./ai/world-event.js";
import { playerProgressSchema, statsForLevel } from "./combat/index.js";
import { createEmptyEquipment, equipmentSchema } from "./equipment.js";
import { directionSchema, positionSchema } from "./geometry.js";
import { enemyIdSchema } from "./ids.js";
import type { EnemyId, NpcId } from "./ids.js";
import { addItem, emptyInventory, inventorySchema } from "./inventory.js";
import { mapIdSchema } from "./map.js";
import { NEW_GAME_START } from "./maps/index.js";
import { createDefaultNpcStates, DEFAULT_NPC_TOPICS, npcStatesSchema } from "./npc.js";
import {
  MAIN_QUEST_INITIAL_STAGE,
  mainQuestStageSchema,
  SUB_QUEST_MAX_ACTIVE,
  subQuestSchema
} from "./quests.js";

/**
 * サーバー権威の GameState(セーブの正本)。version 付き。
 *
 * 保存対象の正は game-design.md「セーブ/ロード」。M4 で NPC 状態・クエスト進行・
 * 世界状態・戦果描写済み記録・AI 日次カウンタを追加した。追加フィールドはすべて
 * `.default()` 付きで後方互換とし、version は 1 のまま(M3 形式のセーブは
 * デフォルト値で補完して読める。version を上げるのはデフォルトで補完できない
 * 変更を入れるときのみ)。
 */

/** セーブスキーマのバージョン。version 不一致は破損と同扱い(game-design.md) */
export const GAME_STATE_VERSION = 1;

/** 宿泊費(灯宿「灯宿」の定額の少額。game-design.md「宿泊の処理順序」手順0) */
export const INN_COST = 10;

/**
 * 琥珀郷「寄り屋」の宿代(5G。灯宿10Gより安い=寂れた集落の設定。M16。
 * game-design.md「第2エリア(拡張: M16)」経済 / 「第2エリアのNPC」)。
 */
export const SETTLEMENT_INN_COST = 5;

/**
 * 宿NPCごとの宿代(NpcId → ゴールド)。宿の機能を持つ NPC のみを持つ部分マップ。
 * 宿泊の処理順序・無銭時の扱いは灯宿と同一(costGold として ActiveInteraction に載せる)。
 */
export const INN_FEES: Partial<Record<NpcId, number>> = {
  innkeeper: INN_COST,
  caretaker: SETTLEMENT_INN_COST
};

/** 宿NPCの宿代を引く(宿でない NPC は INN_COST を既定として返すが、呼び出し側は宿NPCのみに使う) */
export function innFeeFor(npcId: NpcId): number {
  return INN_FEES[npcId] ?? INN_COST;
}

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

// ---------------------------------------------------------------------------
// 世界状態(天候・街頭演出・各層敵シンボル数)
// ---------------------------------------------------------------------------

/** 世界状態(セーブ対象: game-design.md「セーブ/ロード」) */
export const worldStateSchema = z.object({
  /** 天候(初期 clear。weather イベントで置き換わり、日送りでは持続) */
  weather: weatherSchema.default("clear"),
  /** 当日有効な街頭演出(複数可・同一 ID は重複しない)。日送りでクリア */
  activeStreetEvents: z.array(streetEventIdSchema).default([]),
  /** 各ダンジョン層の敵シンボル数(dungeon_shift 累積適用後の現在値。日送りでは持続) */
  dungeonSymbolCounts: dungeonSymbolCountsSchema.default(initialDungeonSymbolCounts)
});
export type WorldState = z.infer<typeof worldStateSchema>;

/** 世界状態のデフォルト(新規ゲーム・M3 セーブの補完) */
export function createDefaultWorldState(): WorldState {
  return {
    weather: "clear",
    activeStreetEvents: [],
    dungeonSymbolCounts: initialDungeonSymbolCounts()
  };
}

// ---------------------------------------------------------------------------
// AI 日次カウンタ(日送りでリセット。セーブ&ロードでの回避を防ぐため永続化)
// ---------------------------------------------------------------------------

/**
 * NPC 別の adjust_affinity 承認 delta の日次累積(負値あり)。
 * キー集合が npcIdSchema と一致することはユニットテストで担保する。
 */
export const npcDailyAffinityDeltaSchema = z.object({
  innkeeper: z.number().int().default(0),
  merchant: z.number().int().default(0),
  informant: z.number().int().default(0),
  priest: z.number().int().default(0),
  // 第2エリア「琥珀郷」の3人(M16)。旧セーブ(このキー欠落)は default 0 で補完
  caretaker: z.number().int().default(0),
  artisan: z.number().int().default(0),
  warden: z.number().int().default(0)
});
export type NpcDailyAffinityDelta = z.infer<typeof npcDailyAffinityDeltaSchema>;

/** NPC 別日次累積のゼロ値 */
export function createDefaultNpcDailyAffinityDelta(): NpcDailyAffinityDelta {
  return { innkeeper: 0, merchant: 0, informant: 0, priest: 0, caretaker: 0, artisan: 0, warden: 0 };
}

/** AI 関連の「ゲーム内1日◯回」系カウンタ(game-design.md「ゲーム内時間」) */
export const aiDailyCountersSchema = z.object({
  /** give_item の承認回数(全 NPC 合算。1日3回まで) */
  giveItemCount: z.number().int().nonnegative().default(0),
  /** propose_quest の発行数(1日3件まで) */
  proposeQuestCount: z.number().int().nonnegative().default(0),
  /** rewardItemId 付き提案の発行数(1日1件まで) */
  rewardItemProposalCount: z.number().int().nonnegative().default(0),
  /** NPC 別 adjust_affinity 承認 delta の日次累積(±20 を超える呼び出しは却下) */
  affinityDeltaByNpc: npcDailyAffinityDeltaSchema.default(createDefaultNpcDailyAffinityDelta)
});
export type AiDailyCounters = z.infer<typeof aiDailyCountersSchema>;

/** AI 日次カウンタのゼロ値(新規ゲーム・日送りリセット) */
export function createDefaultAiDailyCounters(): AiDailyCounters {
  return {
    giveItemCount: 0,
    proposeQuestCount: 0,
    rewardItemProposalCount: 0,
    affinityDeltaByNpc: createDefaultNpcDailyAffinityDelta()
  };
}

// ---------------------------------------------------------------------------
// GameState 本体
// ---------------------------------------------------------------------------

export const gameStateSchema = z.object({
  version: z.literal(GAME_STATE_VERSION),
  /** プレイヤー状態(レベル・経験値・HP/MP・ゴールド) */
  player: playerProgressSchema,
  /** 位置(マップ・座標・向き) */
  location: gameLocationSchema,
  /** インベントリ(通常アイテム + クエスト用アイテム別枠) */
  inventory: inventorySchema,
  /** 装備スロット(武器・防具)。M8-1 追加。旧セーブは空装備で補完(GAME_STATE_VERSION 据え置き) */
  equipment: equipmentSchema.default(createEmptyEquipment),
  /** ゲーム内日付(1日目からの通し番号)。宿泊と全滅帰還でのみ +1(game-design.md「ゲーム内時間」) */
  day: z.number().int().positive(),
  /** プレイ時間(秒。サーバーで計測しセーブに含める) */
  playtimeSeconds: z.number().int().nonnegative(),
  /**
   * マップギミックの解決状態(開けた宝箱・押したスイッチ・使用済みの鍵等の id)。
   * ロードで巻き戻ると鍵消費型の仕掛けが進行不能になるため永続化する(game-design.md)。
   */
  gimmicks: z.array(z.string()),
  /** NPC 状態(好感度・会話記憶・今日の話題)。M3 セーブはデフォルトで補完 */
  npcs: npcStatesSchema.default(createDefaultNpcStates),
  /** メインクエスト段階(M6 で進行に使用) */
  mainQuestStage: mainQuestStageSchema.default(MAIN_QUEST_INITIAL_STAGE),
  /** 受注中サブクエスト(最大3。未受諾の「提案」はセーブに載せない) */
  subQuests: z.array(subQuestSchema).max(SUB_QUEST_MAX_ACTIVE).default([]),
  /** 世界状態(天候・当日有効な street_event・各層の敵シンボル数) */
  world: worldStateSchema.default(createDefaultWorldState),
  /** 戦果描写済みの敵種(「初見」判定用。ロード後に AI 呼び出しが再発しない) */
  narratedEnemies: z.array(enemyIdSchema).default([]),
  /** AI 日次カウンタ(日送りでリセット) */
  aiDaily: aiDailyCountersSchema.default(createDefaultAiDailyCounters)
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
    equipment: createEmptyEquipment(),
    day: 1,
    playtimeSeconds: 0,
    gimmicks: [],
    npcs: createDefaultNpcStates(),
    mainQuestStage: MAIN_QUEST_INITIAL_STAGE,
    subQuests: [],
    world: createDefaultWorldState(),
    narratedEnemies: [],
    aiDaily: createDefaultAiDailyCounters()
  };
}

// ---------------------------------------------------------------------------
// 日送り・戦果描写記録の純ヘルパー
// ---------------------------------------------------------------------------

/**
 * 日送り(宿泊手順2・全滅帰還)の状態更新(純関数):
 * - 日付 +1
 * - AI 日次カウンタのリセット(game-design.md「ゲーム内時間」)
 * - 「今日の話題」を NPC 別デフォルトへリセット(ai-integration.md「会話セッション管理」)
 * - 当日有効な street_event のクリア(「当日有効」のため翌日へ持ち越さない)
 * 天候・各層敵シンボル数・好感度・会話記憶は持続する。
 */
export function advanceDay(state: GameState): GameState {
  return {
    ...state,
    day: state.day + 1,
    aiDaily: createDefaultAiDailyCounters(),
    npcs: {
      innkeeper: { ...state.npcs.innkeeper, topic: DEFAULT_NPC_TOPICS.innkeeper },
      merchant: { ...state.npcs.merchant, topic: DEFAULT_NPC_TOPICS.merchant },
      informant: { ...state.npcs.informant, topic: DEFAULT_NPC_TOPICS.informant },
      priest: { ...state.npcs.priest, topic: DEFAULT_NPC_TOPICS.priest },
      caretaker: { ...state.npcs.caretaker, topic: DEFAULT_NPC_TOPICS.caretaker },
      artisan: { ...state.npcs.artisan, topic: DEFAULT_NPC_TOPICS.artisan },
      warden: { ...state.npcs.warden, topic: DEFAULT_NPC_TOPICS.warden }
    },
    world: { ...state.world, activeStreetEvents: [] }
  };
}

/** その敵種の戦果描写が済んでいるか(「初見」判定。初見のみ AI 呼び出し) */
export function hasNarratedEnemy(state: GameState, enemyId: EnemyId): boolean {
  return state.narratedEnemies.includes(enemyId);
}

/** 戦果描写済みとして記録する(純関数。重複は追加しない) */
export function recordNarratedEnemy(state: GameState, enemyId: EnemyId): GameState {
  if (hasNarratedEnemy(state, enemyId)) return state;
  return { ...state, narratedEnemies: [...state.narratedEnemies, enemyId] };
}
