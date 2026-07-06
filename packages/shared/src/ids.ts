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
 * - mist-wolf     : 霧狼(フィールドの雑魚)
 * - candle-eater  : 蝋燭喰らい(ダンジョン浅層の雑魚)
 * - creaking-doll : 軋み人形(ダンジョン深層の雑魚)
 * - dream-eater   : 夢喰い(ボス。リスポーンしない=シンボル出現プールには含めない)
 * M10拡張(world-lore.md 4.1節):
 * - wisp-flame    : 迷い火(フィールドの雑魚)
 * - whisper-mask  : 囁き仮面(ダンジョン浅層の雑魚)
 * - rust-eater    : 錆喰い(ダンジョン深層の雑魚)
 * - failing-spinner: 紡ぎ損ない(ダンジョン2層の中ボス。固定配置・リスポーンしない)
 * ボス第2形態(dream-eater-phase2)は「形態」でありスポーン対象の敵IDではないため列挙しない。
 */
export const enemyIdSchema = z.enum([
  "mist-wolf",
  "candle-eater",
  "creaking-doll",
  "dream-eater",
  "wisp-flame",
  "whisper-mask",
  "rust-eater",
  "failing-spinner"
]);
export type EnemyId = z.infer<typeof enemyIdSchema>;

/** 敵の表示名(world-lore.md 4節・4.1節が正) */
export const ENEMY_DISPLAY_NAMES: Record<EnemyId, string> = {
  "mist-wolf": "霧狼",
  "candle-eater": "蝋燭喰らい",
  "creaking-doll": "軋み人形",
  "dream-eater": "夢喰い",
  "wisp-flame": "迷い火",
  "whisper-mask": "囁き仮面",
  "rust-eater": "錆喰い",
  "failing-spinner": "紡ぎ損ない"
};

/**
 * 中ボスの敵ID(固定配置・リスポーンしない・出現プール外。game-design.md「敵バリエーション(拡張: M10)」)。
 * 最終ボス「夢喰い」とは別枠で、メインクエスト進行を誘発しない(isBoss=false)。
 */
export const MID_BOSS_ENEMY_IDS: readonly EnemyId[] = ["failing-spinner"];

/** 中ボスの敵IDか(固定配置マーカーの識別・撃破記録判定に使う) */
export function isMidBossEnemyId(id: EnemyId): boolean {
  return MID_BOSS_ENEMY_IDS.includes(id);
}

/**
 * 中ボス撃破のセーブ記録フラグ文字列(敵ID別)。GameState.gimmicks に格納し、
 * SnapshotView.resolvedObjectIds にも載せてクライアントのマーカー表示可否に使う。
 * マップの占有物ID(宝箱等)と名前空間が衝突しないよう `midboss:` 接頭辞を付ける。
 */
export function midBossDefeatFlag(enemyId: EnemyId): string {
  return `midboss:${enemyId}`;
}

/**
 * リスポーンする雑魚敵(=敵シンボル出現プールに載りうる敵)。
 * ボス「夢喰い」・中ボス「紡ぎ損ない」はリスポーンしないため含めない
 * (game-design.md / ai-integration.md「propose_quest」)。
 * 注: hunt型サブクエストの討伐対象ホワイトリスト `HuntTargetId`(ai/hunt.ts)は
 * この集合の**部分集合**であり、両者は一致しない(M10で新雑魚を追加したが HuntTargetId は据え置き)。
 */
export const RESPAWNABLE_ENEMY_IDS: readonly EnemyId[] = [
  "mist-wolf",
  "candle-eater",
  "creaking-doll",
  "wisp-flame",
  "whisper-mask",
  "rust-eater"
];
