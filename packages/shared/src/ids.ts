import { z } from "zod";

/**
 * NPC識別子(world-lore.mdの4人)。
 * ゲーム内エンティティのIDであり、立ち絵アセットIDは `npc-${NpcId}`(例: npc-innkeeper)で対応する。
 * - innkeeper: 宿屋の主人 オルガ(灯宿)
 * - merchant : 商人 レンド(渡り物屋)
 * - informant: 情報屋 カイ(霧笛亭)
 * - priest   : 謎の司祭 フィオル(灯守堂)
 */
export const npcIdSchema = z.enum(["innkeeper", "merchant", "informant", "priest"]);
export type NpcId = z.infer<typeof npcIdSchema>;

/** NPCの表示名(world-lore.md 3節が正) */
export const NPC_DISPLAY_NAMES: Record<NpcId, string> = {
  innkeeper: "オルガ",
  merchant: "レンド",
  informant: "カイ",
  priest: "フィオル"
};

/**
 * 敵識別子。IDはアセットmanifest(assets/manifest.json)と一致させる。
 * - mist-wolf    : 霧狼(フィールドの雑魚)
 * - candle-eater : 蝋燭喰らい(ダンジョン浅層の雑魚)
 * - creaking-doll: 軋み人形(ダンジョン深層の雑魚)
 * - dream-eater  : 夢喰い(ボス。リスポーンしない=シンボル出現プールには含めない)
 * ボス第2形態(dream-eater-phase2)は「形態」でありスポーン対象の敵IDではないため列挙しない。
 */
export const enemyIdSchema = z.enum([
  "mist-wolf",
  "candle-eater",
  "creaking-doll",
  "dream-eater"
]);
export type EnemyId = z.infer<typeof enemyIdSchema>;

/** 敵の表示名(world-lore.md 4節が正) */
export const ENEMY_DISPLAY_NAMES: Record<EnemyId, string> = {
  "mist-wolf": "霧狼",
  "candle-eater": "蝋燭喰らい",
  "creaking-doll": "軋み人形",
  "dream-eater": "夢喰い"
};

/**
 * リスポーンする雑魚敵(hunt型サブクエストの対象になりうる敵)。
 * ボス「夢喰い」はリスポーンしないため含めない(game-design.md / ai-integration.md「propose_quest」)。
 * M4のHuntTargetIdはこの集合を基に定義する想定。
 */
export const RESPAWNABLE_ENEMY_IDS: readonly EnemyId[] = [
  "mist-wolf",
  "candle-eater",
  "creaking-doll"
];
