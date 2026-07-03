import { z } from "zod";

import { enemyIdSchema } from "../ids.js";
import type { EnemyId } from "../ids.js";
import type { CombatantStats } from "./stats.js";
import type { ItemId } from "./items.js";
import type { StatusId } from "./status.js";

// ---------------------------------------------------------------------------
// 敵の行動(技)カタログ — 決定論的な行動選択で参照する
// ---------------------------------------------------------------------------

/** 敵技の識別子(全敵共通のカタログ。ローテーションはこのIDで記述する) */
export const enemyMoveIdSchema = z.enum([
  "strike", // 通常攻撃
  "heavy", // 重い一撃(高倍率)
  "poison-bite", // 毒を伴う攻撃
  "gear-grind", // ボス: 歯車の軋み
  "devour", // ボス: 貪り(高倍率)
  "nightmare-spew", // ボス: 悪夢の吐瀉(毒)
  "frenzy" // ボス第2形態: 飢餓の暴走(最高倍率)
]);
export type EnemyMoveId = z.infer<typeof enemyMoveIdSchema>;

export interface EnemyMoveDefinition {
  id: EnemyMoveId;
  /** UIの行動宣言メッセージに使う所作(「<敵名>は牙を剥いた。」の後半) */
  flavor: string;
  /** 攻撃力にかける倍率(ダメージ式は battle.ts の computeDamage) */
  powerMultiplier: number;
  /** 命中時に付与する状態異常(決定論的に必ず付与)。なければ攻撃のみ */
  inflicts?: StatusId;
}

export const ENEMY_MOVES: Record<EnemyMoveId, EnemyMoveDefinition> = {
  strike: { id: "strike", flavor: "は牙を剥いた。", powerMultiplier: 1.0 },
  heavy: { id: "heavy", flavor: "は身を沈め、重く躍りかかった。", powerMultiplier: 1.4 },
  "poison-bite": {
    id: "poison-bite",
    flavor: "は軋む指で掻き抱こうとした。",
    powerMultiplier: 0.8,
    inflicts: "poison"
  },
  "gear-grind": { id: "gear-grind", flavor: "の歯車が軋み、靄が渦を巻いた。", powerMultiplier: 1.1 },
  devour: { id: "devour", flavor: "は口に似た裂け目を開き、貪ろうとした。", powerMultiplier: 1.5 },
  "nightmare-spew": {
    id: "nightmare-spew",
    flavor: "は澱んだ悪夢を吐き出した。",
    powerMultiplier: 1.0,
    inflicts: "poison"
  },
  frenzy: { id: "frenzy", flavor: "は飢えのままに暴れ狂った。", powerMultiplier: 1.7 }
};

// ---------------------------------------------------------------------------
// 敵の行動フェーズ(決定論的: HP閾値でフェーズが進み、フェーズ内はローテーション)
// ---------------------------------------------------------------------------

export interface EnemyBehaviorPhase {
  /**
   * このフェーズが有効になるHP割合の上限(現在HP割合 <= hpThreshold で有効)。
   * 配列は hpThreshold の降順で並べる。初期フェーズは 1.0(常時有効)。
   * 例: ボスは [1.0, 0.5]。HP50%以下(<=0.5)で2番目のフェーズへ移る。
   */
  hpThreshold: number;
  /** ターンごとに順番に選ぶ行動列(モジュロで巡回) */
  rotation: EnemyMoveId[];
  /** このフェーズへ移った瞬間の定型演出(ボスの形態変化台詞。world-lore 4節・6節のトーン) */
  transition?: { message: string };
}

// ---------------------------------------------------------------------------
// 敵定義
// ---------------------------------------------------------------------------

export interface EnemyReward {
  /** 撃破で得る経験値(固定) */
  xp: number;
  /** 撃破で得るゴールド(min-max の乱数。固定なら min=max) */
  gold: { min: number; max: number };
  /** ドロップ品(確率 chance で itemId を1つ入手)。なければドロップなし */
  drop?: { itemId: ItemId; chance: number };
}

export interface EnemyDefinition {
  id: EnemyId;
  /** 表示名は ENEMY_DISPLAY_NAMES(ids.ts)を正とするが、参照容易化のため再掲 */
  displayName: string;
  stats: CombatantStats;
  /** ボスか(にげる不可・戦果描写narrate対象・2形態) */
  isBoss: boolean;
  /** 行動フェーズ(hpThreshold 降順)。雑魚は単一フェーズ、ボスは2形態 */
  phases: EnemyBehaviorPhase[];
  reward: EnemyReward;
}

/**
 * 敵定義表。ステータス数値・行動パターン・報酬はClaude Codeの裁量
 * (game-design.md「敵」: 名称・姿は world-lore.md 4節が正、数値・行動はClaude Codeが決定)。
 * 行動パターンは決定論的(HP閾値+ローテーション)。雑魚は2パターン程度。
 */
export const ENEMIES: Record<EnemyId, EnemyDefinition> = {
  // 霧狼(フィールド最弱)— Lv1で3-5ターンで勝てる基準
  "mist-wolf": {
    id: "mist-wolf",
    displayName: "霧狼",
    stats: { maxHP: 20, maxMP: 0, attack: 6, defense: 2, speed: 6 },
    isBoss: false,
    phases: [{ hpThreshold: 1.0, rotation: ["strike", "strike", "heavy"] }],
    reward: {
      xp: 4,
      gold: { min: 3, max: 6 },
      drop: { itemId: "potion-small", chance: 0.2 }
    }
  },
  // 蝋燭喰らい(ダンジョン浅層)
  "candle-eater": {
    id: "candle-eater",
    displayName: "蝋燭喰らい",
    stats: { maxHP: 32, maxMP: 0, attack: 9, defense: 4, speed: 8 },
    isBoss: false,
    phases: [{ hpThreshold: 1.0, rotation: ["strike", "heavy"] }],
    reward: {
      xp: 9,
      gold: { min: 6, max: 12 },
      drop: { itemId: "potion-small", chance: 0.25 }
    }
  },
  // 軋み人形(ダンジョン深層)— 毒を持つ
  "creaking-doll": {
    id: "creaking-doll",
    displayName: "軋み人形",
    stats: { maxHP: 48, maxMP: 0, attack: 12, defense: 7, speed: 6 },
    isBoss: false,
    phases: [{ hpThreshold: 1.0, rotation: ["strike", "poison-bite", "heavy"] }],
    reward: {
      xp: 16,
      gold: { min: 12, max: 20 },
      drop: { itemId: "antidote", chance: 0.25 }
    }
  },
  // 夢喰い(ボス)— HP多め・2形態(HP50%以下で行動変化)。推奨Lv5-6
  "dream-eater": {
    id: "dream-eater",
    displayName: "夢喰い",
    stats: { maxHP: 150, maxMP: 0, attack: 13, defense: 9, speed: 9 },
    isBoss: true,
    phases: [
      {
        hpThreshold: 1.0,
        rotation: ["gear-grind", "devour", "nightmare-spew"]
      },
      {
        hpThreshold: 0.5,
        rotation: ["frenzy", "devour", "nightmare-spew"],
        transition: {
          // world-lore 4節「苦痛の限界を越えた反射的な暴走…憎悪ではなく苦しみの発露」
          message:
            "――軋みが、悲鳴に似た音を立てた。\n靄が剥がれ落ち、剥き出しの歯車が飢えのままに回りだす。\nそれは怒りではなく、ただ、終われない苦しみだった。"
        }
      }
    ],
    reward: {
      xp: 120,
      gold: { min: 100, max: 100 }
    }
  }
};

export function getEnemy(id: EnemyId): EnemyDefinition {
  return ENEMIES[id];
}

/** enemyId が妥当か(zod で厳格に。UI/セーブ経由の外部入力用) */
export function isEnemyId(value: unknown): value is EnemyId {
  return enemyIdSchema.safeParse(value).success;
}
