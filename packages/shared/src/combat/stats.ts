import { z } from "zod";

/**
 * 戦闘に使う能力値(プレイヤー・敵で共通の形)。
 * ダメージ式・行動順はすべてこの4能力値から計算する(game-design.md「ターン制戦闘」)。
 */
export const combatantStatsSchema = z.object({
  maxHP: z.number().int().positive(),
  maxMP: z.number().int().nonnegative(),
  attack: z.number().int().positive(),
  defense: z.number().int().nonnegative(),
  speed: z.number().int().nonnegative()
});
export type CombatantStats = z.infer<typeof combatantStatsSchema>;

/** 縦切りの最大レベル(game-design.md「成長・経済」: レベル1-10想定) */
export const MAX_LEVEL = 10;

/**
 * レベル別ステータス表(Lv1-10)。配列インデックスは level-1。
 * 数値はClaude Codeの裁量(game-design.md はLv1で最弱雑魚に3-5ターン・推奨Lv未満のボスは
 * 全滅、を満たすことのみ要求)。バランスシミュレーションのユニットテストで担保する。
 */
export const LEVEL_STATS: readonly CombatantStats[] = [
  { maxHP: 30, maxMP: 10, attack: 8, defense: 5, speed: 7 }, // Lv1
  { maxHP: 38, maxMP: 12, attack: 10, defense: 6, speed: 8 }, // Lv2
  { maxHP: 46, maxMP: 15, attack: 12, defense: 7, speed: 9 }, // Lv3
  { maxHP: 56, maxMP: 18, attack: 15, defense: 9, speed: 10 }, // Lv4
  { maxHP: 68, maxMP: 22, attack: 18, defense: 11, speed: 11 }, // Lv5
  { maxHP: 82, maxMP: 26, attack: 21, defense: 13, speed: 12 }, // Lv6
  { maxHP: 96, maxMP: 30, attack: 24, defense: 15, speed: 13 }, // Lv7
  { maxHP: 112, maxMP: 34, attack: 27, defense: 17, speed: 14 }, // Lv8
  { maxHP: 130, maxMP: 38, attack: 30, defense: 19, speed: 15 }, // Lv9
  { maxHP: 150, maxMP: 44, attack: 34, defense: 22, speed: 16 } // Lv10
];

/**
 * 次のレベルへ上がるのに必要な経験値(累積ではなく各レベルでの必要量)。
 * 配列インデックスは level-1(Lv1→2 が [0])。Lv10 には次がないため長さは MAX_LEVEL-1。
 */
export const XP_TO_NEXT: readonly number[] = [
  8, // Lv1 → 2
  20, // Lv2 → 3
  40, // Lv3 → 4
  70, // Lv4 → 5
  110, // Lv5 → 6
  160, // Lv6 → 7
  230, // Lv7 → 8
  320, // Lv8 → 9
  440 // Lv9 → 10
];

/** 指定レベルのステータスを返す(範囲外はエラー。levelは内部状態由来で外部入力ではない) */
export function statsForLevel(level: number): CombatantStats {
  const s = LEVEL_STATS[level - 1];
  if (!s) throw new Error(`不正なレベル: ${level}(1-${MAX_LEVEL} の範囲外)`);
  return s;
}

/** 指定レベルから次レベルへ必要な経験値。最大レベルなら null。 */
export function xpToNext(level: number): number | null {
  if (level < 1 || level > MAX_LEVEL) throw new Error(`不正なレベル: ${level}`);
  if (level >= MAX_LEVEL) return null;
  const need = XP_TO_NEXT[level - 1];
  if (need === undefined) throw new Error(`経験値テーブル欠落: Lv${level}`);
  return need;
}
