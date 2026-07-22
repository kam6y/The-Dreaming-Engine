import { z } from "zod";

import type { NpcId } from "./ids.js";
import type { MapDefinition, NpcPlacement } from "./map.js";

// ---------------------------------------------------------------------------
// 昼夜サイクル(M23。game-design.md「昼夜サイクルと時間帯によるNPC配置(拡張: M23)」)
//
// - 時間帯は2段階(昼/夜)。進行源は「プレイヤーの移動が実際に成立した歩数」のみ(決定論)
// - 時間帯はサーバーのランタイム状態(セーブ非永続。セーブは必ず朝=ロードは常に昼)
// - NPC配置の変化は灯町(town)のみ。配置の唯一の正は npcPlacementsForTime で、
//   サーバー(移動衝突・正面インタラクション・占有判定)とクライアント(描画)の
//   **両方**が必ずこの同一関数を通す(片側だけだと絵と当たり判定が乖離する)
// - 機能は時間帯で変えない(店・宿・会話は昼と同じ。変わるのは位置・向きのみ)
// ---------------------------------------------------------------------------

/** 時間帯(昼/夜)。AIへ渡す時刻帯(固定演出値「宵闇」)とは別概念(AI非波及) */
export const timeOfDaySchema = z.enum(["day", "night"]);
export type TimeOfDay = z.infer<typeof timeOfDaySchema>;

/**
 * 日没までの歩数閾値(移動成立歩数がこの値に達したら夜)。
 * 仕様の目安40歩(game-design.md。実測調整可の裁量値)。
 * 既存E2EはNPC接触まで十数歩以内(昼のまま)なので非干渉。
 */
export const NIGHTFALL_STEPS = 40;

/** その日の移動成立歩数 → 時間帯(steps < 40 = 昼 / 40 以上 = 夜)。純関数 */
export function timeOfDayForSteps(steps: number): TimeOfDay {
  return steps >= NIGHTFALL_STEPS ? "night" : "day";
}

/**
 * 灯町の夜の配置上書き(位置・向きのみ。機能は変えない)。
 * 縦切りでは商人レンド1人のみ: 渡り物屋前 (16,4) → 霧笛亭(酒場)脇 (7,11)・左向き
 * (店じまいして酒場で一杯。左向き=霧笛亭の建物(x3-6)の方を向く)。
 * (7,11) は灯町グリッドの床マスで、占有(NPC/オブジェクト)・遷移・playerStart と
 * 非重複であることを専用ユニットテストで担保する(マップ定義の superRefine は
 * 実行時上書きを見ないため)。表に NPC を足すだけで拡張できる。
 */
export const TOWN_NIGHT_NPC_OVERRIDES: Partial<
  Record<NpcId, Pick<NpcPlacement, "position" | "facing">>
> = {
  merchant: { position: { x: 7, y: 11 }, facing: "left" }
};

/**
 * マップ定義の npcs に時間帯別の上書きを適用した配置を返す(純関数。配置の唯一の正)。
 * - 昼、または灯町(town)以外のマップは**素通し**(map.npcs をそのまま返す=参照同一。
 *   呼び出し側は参照比較で「変化なし」を判定できる)
 * - 灯町の夜のみ TOWN_NIGHT_NPC_OVERRIDES を適用(position は複製して返し、
 *   呼び出し側の変異が定数を汚さないようにする)
 */
export function npcPlacementsForTime(map: MapDefinition, timeOfDay: TimeOfDay): NpcPlacement[] {
  if (timeOfDay === "day" || map.id !== "town") return map.npcs;
  return map.npcs.map((npc) => {
    const override = TOWN_NIGHT_NPC_OVERRIDES[npc.id];
    if (override === undefined) return npc;
    return { ...npc, position: { ...override.position }, facing: override.facing };
  });
}
