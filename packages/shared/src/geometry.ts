import { z } from "zod";

/** 4方向の向き(移動・キャラクターの向き・遷移後の向きに共通で使う) */
export const directionSchema = z.enum(["up", "down", "left", "right"]);
export type Direction = z.infer<typeof directionSchema>;

export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

/** グリッド座標(タイル単位。原点は左上、xが列・yが行) */
export const positionSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative()
});
export type Position = z.infer<typeof positionSchema>;

/** 各向きの座標差分(y下向きが正) */
const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 }
};

/** 指定座標から向きに1マス進んだ座標を返す(範囲チェックはしない) */
export function neighbor(position: Position, direction: Direction): Position {
  const delta = DIRECTION_DELTA[direction];
  return { x: position.x + delta.dx, y: position.y + delta.dy };
}

/** 2つの座標が同一マスかどうか */
export function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
