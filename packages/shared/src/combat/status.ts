import { z } from "zod";

/**
 * 状態異常の種別。縦切りでは毒のみ(game-design.md「状態異常: 最低1種」)。
 * - poison: 毎ターン(1ラウンド)最大HPの5%(最低1)のダメージ。
 */
export const statusIdSchema = z.enum(["poison"]);
export type StatusId = z.infer<typeof statusIdSchema>;

/** 状態異常の付与状態(BattleState 内で各戦闘員が保持する。残りターン数で管理) */
export const statusStateSchema = z.object({
  id: statusIdSchema,
  /** 残りラウンド数。ラウンド終端のtickごとに1減り、0で解除 */
  remainingTurns: z.number().int().positive()
});
export type StatusState = z.infer<typeof statusStateSchema>;

/** 毒の継続ラウンド数(付与・更新時にこの値へリセット) */
export const POISON_DURATION = 3;

/** 毒の1tickダメージ = 最大HPの5%(最低1)。切り捨て。 */
export function poisonTickDamage(maxHP: number): number {
  return Math.max(1, Math.floor(maxHP * 0.05));
}

/** 状態異常の表示名(UIメッセージ用) */
export const STATUS_DISPLAY_NAMES: Record<StatusId, string> = {
  poison: "毒"
};
