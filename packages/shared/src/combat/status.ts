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

/**
 * 状態異常の定義(効果値・継続ラウンド・文言を種別ごとに集約する一般形)。
 * battle.ts は毒を決め打ちせず、この表から duration・tickダメージ・メッセージを引く。
 * 縦切りでは毒のみ(新規の状態異常追加はM9-2の範囲外)。将来種を足す場合はこの表へ1件追加する。
 */
export interface StatusDefinition {
  id: StatusId;
  /** UI表示名(STATUS_DISPLAY_NAMES と一致) */
  displayName: string;
  /** 付与・再付与時にリセットする継続ラウンド数 */
  duration: number;
  /** 1tickの継続ダメージ(最大HPから算出。0なら継続ダメージなし)。切り捨て・最低1は各定義側で保証 */
  tickDamage: (maxHP: number) => number;
  /** 付与時メッセージ(対象名を受け取る) */
  inflictMessage: (targetName: string) => string;
  /** tick(継続ダメージ)時メッセージ */
  tickMessage: (targetName: string, amount: number) => string;
  /** 失効時メッセージ */
  expireMessage: (targetName: string) => string;
}

export const STATUS_DEFS: Record<StatusId, StatusDefinition> = {
  poison: {
    id: "poison",
    displayName: STATUS_DISPLAY_NAMES.poison,
    duration: POISON_DURATION,
    tickDamage: poisonTickDamage,
    inflictMessage: (name) => `澱んだ靄が${name}の傷に染み入る。(${STATUS_DISPLAY_NAMES.poison})`,
    tickMessage: (name, amount) => `${STATUS_DISPLAY_NAMES.poison}が${name}の身を静かに蝕む。${amount}の痛手。`,
    expireMessage: (name) => `${name}の${STATUS_DISPLAY_NAMES.poison}が引いていった。`
  }
};
