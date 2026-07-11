import { describe, expect, it } from "vitest";

import {
  DIRECTIONS,
  MAPS,
  NIGHTFALL_STEPS,
  TOWN_NIGHT_NPC_OVERRIDES,
  inBounds,
  isSolidAt,
  isWalkable,
  neighbor,
  npcPlacementSchema,
  npcPlacementsForTime,
  samePosition,
  timeOfDayForSteps,
  timeOfDaySchema,
  transitionAt
} from "../src/index.js";
import type { MapDefinition, Position } from "../src/index.js";

/**
 * 昼夜サイクル(M23)のユニットテスト。
 * 夜配置マスの妥当性(歩行可能・非重複)は、マップ定義の superRefine が
 * 実行時上書きを見ないため、ここで専用に担保する(game-design.md「NPCの配置変化」)。
 */

/** マップ内BFS(遷移は跨がない)。start から歩いて到達できるマス集合を返す */
function reachableInMap(map: MapDefinition, start: Position): Set<string> {
  const key = (p: Position): string => `${p.x}:${p.y}`;
  const seen = new Set<string>([key(start)]);
  const queue: Position[] = [start];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const direction of DIRECTIONS) {
      const next = neighbor(current, direction);
      if (isWalkable(map, next) && !seen.has(key(next))) {
        seen.add(key(next));
        queue.push(next);
      }
    }
  }
  return seen;
}

describe("timeOfDay — 型と進行規則(M23)", () => {
  it("timeOfDaySchema は day/night のみを受理する", () => {
    expect(timeOfDaySchema.parse("day")).toBe("day");
    expect(timeOfDaySchema.parse("night")).toBe("night");
    expect(() => timeOfDaySchema.parse("dusk")).toThrow();
    expect(() => timeOfDaySchema.parse("")).toThrow();
  });

  it("timeOfDayForSteps の閾値境界: 歩数<40=昼 / 40以上=夜", () => {
    expect(NIGHTFALL_STEPS).toBe(40);
    expect(timeOfDayForSteps(0)).toBe("day");
    expect(timeOfDayForSteps(1)).toBe("day");
    expect(timeOfDayForSteps(NIGHTFALL_STEPS - 1)).toBe("day");
    expect(timeOfDayForSteps(NIGHTFALL_STEPS)).toBe("night");
    expect(timeOfDayForSteps(NIGHTFALL_STEPS + 1)).toBe("night");
    expect(timeOfDayForSteps(9999)).toBe("night");
  });
});

describe("npcPlacementsForTime — 配置の唯一の正(M23)", () => {
  const town = MAPS.town;

  it("昼はどのマップも素通し(map.npcs と参照同一)", () => {
    for (const map of Object.values(MAPS)) {
      expect(npcPlacementsForTime(map, "day")).toBe(map.npcs);
    }
  });

  it("夜も灯町以外のマップは素通し(参照同一=第2エリア・フィールド・ダンジョンに非干渉)", () => {
    for (const map of Object.values(MAPS)) {
      if (map.id === "town") continue;
      expect(npcPlacementsForTime(map, "night")).toBe(map.npcs);
    }
  });

  it("夜の灯町は商人のみ霧笛亭脇 (7,11)・左向きへ移動し、他3人は昼と同一", () => {
    const night = npcPlacementsForTime(town, "night");
    expect(night).toHaveLength(town.npcs.length); // 不在化ではなく移動(人数は不変)
    const merchant = night.find((n) => n.id === "merchant");
    expect(merchant?.position).toEqual({ x: 7, y: 11 });
    expect(merchant?.facing).toBe("left");
    for (const npc of night) {
      if (npc.id === "merchant") continue;
      const day = town.npcs.find((n) => n.id === npc.id);
      expect(day).toBeDefined();
      expect(npc).toEqual(day); // 位置・向きとも据え置き
    }
  });

  it("上書き対象は商人1人のみ(縦切り仕様の回帰ガード)", () => {
    expect(Object.keys(TOWN_NIGHT_NPC_OVERRIDES)).toEqual(["merchant"]);
  });

  it("夜配置は毎回新しい position を返す(呼び出し側の変異が上書き定数を汚さない)", () => {
    const a = npcPlacementsForTime(town, "night").find((n) => n.id === "merchant");
    const b = npcPlacementsForTime(town, "night").find((n) => n.id === "merchant");
    expect(a?.position).not.toBe(TOWN_NIGHT_NPC_OVERRIDES.merchant?.position);
    expect(a?.position).not.toBe(b?.position);
  });

  it("夜配置マスの妥当性: zod整合・歩行可能地形・占有/遷移/playerStartと非重複", () => {
    const night = npcPlacementsForTime(town, "night");
    const start = town.playerStart;
    if (start === undefined) throw new Error("灯町に playerStart が無い(テスト前提の破れ)");

    for (const npc of night) {
      // zodスキーマ整合(NpcPlacement として妥当)
      expect(() => npcPlacementSchema.parse(npc)).not.toThrow();
      // マップ範囲内・通行可能(非solid)地形上
      expect(inBounds(town, npc.position)).toBe(true);
      expect(isSolidAt(town, npc.position)).toBe(false);
      // 遷移マス・プレイヤー初期位置と非重複
      expect(transitionAt(town, npc.position)).toBeNull();
      expect(samePosition(npc.position, start.position)).toBe(false);
      // オブジェクト(看板等)と非重複
      for (const object of town.objects) {
        expect(samePosition(npc.position, object.position)).toBe(false);
      }
      // ボス・中ボスマーカーと非重複(灯町には無いが将来の上書き拡張へのガード)
      if (town.boss) expect(samePosition(npc.position, town.boss.position)).toBe(false);
      if (town.midBoss) expect(samePosition(npc.position, town.midBoss.position)).toBe(false);
    }

    // 夜配置同士の重複禁止(商人の移動先が据え置きNPCと衝突しない)
    night.forEach((a, i) => {
      for (let j = i + 1; j < night.length; j += 1) {
        const b = night[j];
        if (b) expect(samePosition(a.position, b.position)).toBe(false);
      }
    });
  });

  it("夜でも全NPCへ隣接到達できる(ソフトロック不能: 宿・店・窓口・進行役に必ず会える)", () => {
    const night = npcPlacementsForTime(town, "night");
    const start = town.playerStart;
    if (start === undefined) throw new Error("灯町に playerStart が無い(テスト前提の破れ)");
    const nightMap: MapDefinition = { ...town, npcs: night };
    const reachable = reachableInMap(nightMap, start.position);
    for (const npc of night) {
      const adjacentReachable = DIRECTIONS.some((direction) => {
        const p = neighbor(npc.position, direction);
        return reachable.has(`${p.x}:${p.y}`);
      });
      expect(adjacentReachable, `npc:${npc.id} の隣に立てない`).toBe(true);
    }
  });
});
