import { z } from "zod";

import type { EnemyId } from "../ids.js";

/**
 * hunt 型サブクエスト(`propose_quest`)の討伐対象ホワイトリスト。
 * **リスポーンする雑魚敵のみ**。ボス「夢喰い」(dream-eater)はリスポーンしないため
 * 含めない(ai-integration.md「propose_quest」/ ids.ts `RESPAWNABLE_ENEMY_IDS`)。
 *
 * `RESPAWNABLE_ENEMY_IDS`(型は `readonly EnemyId[]` でリテラルタプルでない)とは
 * 別に、zod enum のためのリテラルタプルとして定義し、両者の一致をテストで担保する
 * (どちらかに敵を足し忘れた場合の drift をユニットテストで検知する)。
 */
export const HUNT_TARGET_IDS = [
  "mist-wolf",
  "candle-eater",
  "creaking-doll"
] as const satisfies readonly EnemyId[];

export const huntTargetIdSchema = z.enum(HUNT_TARGET_IDS);
export type HuntTargetId = z.infer<typeof huntTargetIdSchema>;

/** hunt 対象として有効な敵か(ホワイトリスト内か) */
export function isHuntTarget(id: string): id is HuntTargetId {
  return huntTargetIdSchema.safeParse(id).success;
}
