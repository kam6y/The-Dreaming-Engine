import { describe, expect, it } from "vitest";

import {
  createRng,
  fieldMap,
  dungeon3Map,
  isWalkable,
  mapDefinitionSchema,
  sampleEnemySymbols,
  townMap,
  RESPAWNABLE_ENEMY_IDS
} from "../src/index.js";
import type { MapDefinition, Position } from "../src/index.js";

function forbidden(map: MapDefinition): Position[] {
  const list: Position[] = map.transitions.map((t) => t.position);
  if (map.playerStart) list.push(map.playerStart.position);
  return list;
}

describe("sampleEnemySymbols(敵シンボル配置)", () => {
  it("出現数がマップのレンジ内(フィールド 2-3)", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const placements = sampleEnemySymbols(fieldMap, createRng(seed));
      expect(placements.length).toBeGreaterThanOrEqual(2);
      expect(placements.length).toBeLessThanOrEqual(3);
    }
  });

  it("出現数がマップのレンジ内(ダンジョン3層 2-6)", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const placements = sampleEnemySymbols(dungeon3Map, createRng(seed));
      expect(placements.length).toBeGreaterThanOrEqual(2);
      expect(placements.length).toBeLessThanOrEqual(6);
    }
  });

  it("配置は通行可能マスで、禁止マス(遷移・プレイヤー初期位置・占有物)を避ける", () => {
    for (const map of [fieldMap, dungeon3Map]) {
      const bad = forbidden(map);
      for (let seed = 1; seed <= 50; seed += 1) {
        const placements = sampleEnemySymbols(map, createRng(seed));
        for (const p of placements) {
          // isWalkable が地形solid・NPC/オブジェクト/ボス占有を除外する
          expect(isWalkable(map, p.position)).toBe(true);
          // 遷移マス・プレイヤー初期位置ではない
          expect(bad.some((f) => f.x === p.position.x && f.y === p.position.y)).toBe(false);
        }
      }
    }
  });

  it("配置座標に重複がない", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const placements = sampleEnemySymbols(dungeon3Map, createRng(seed));
      const keys = placements.map((p) => `${p.position.x},${p.position.y}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("敵種はそのマップの species(=リスポーン可能な雑魚)から選ばれる", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const placements = sampleEnemySymbols(dungeon3Map, createRng(seed));
      for (const p of placements) {
        expect(dungeon3Map.enemySymbols?.species).toContain(p.enemyId);
        expect(RESPAWNABLE_ENEMY_IDS).toContain(p.enemyId);
      }
    }
  });

  it("ボス『夢喰い』はシンボル出現プールに含まれない(species に混ぜても除外)", () => {
    // species に dream-eater を混ぜた検証用マップ(非安全)
    const raw = {
      id: "field" as const,
      displayName: "検証フィールド",
      width: 5,
      height: 5,
      rows: [".....", ".....", ".....", ".....", "....."],
      safe: false,
      transitions: [],
      npcs: [],
      objects: [],
      enemySymbols: { min: 3, max: 3, species: ["mist-wolf" as const, "dream-eater" as const] }
    };
    const map = mapDefinitionSchema.parse(raw);
    for (let seed = 1; seed <= 100; seed += 1) {
      const placements = sampleEnemySymbols(map, createRng(seed));
      for (const p of placements) {
        expect(p.enemyId).not.toBe("dream-eater");
        expect(p.enemyId).toBe("mist-wolf");
      }
    }
  });

  it("species がボスのみなら何も湧かない(空配列)", () => {
    const raw = {
      id: "field" as const,
      displayName: "検証フィールド2",
      width: 5,
      height: 5,
      rows: [".....", ".....", ".....", ".....", "....."],
      safe: false,
      transitions: [],
      npcs: [],
      objects: [],
      enemySymbols: { min: 2, max: 3, species: ["dream-eater" as const] }
    };
    const map = mapDefinitionSchema.parse(raw);
    expect(sampleEnemySymbols(map, createRng(1))).toEqual([]);
  });

  it("安全地帯(街=enemySymbolsなし)では何も湧かない", () => {
    expect(sampleEnemySymbols(townMap, createRng(1))).toEqual([]);
  });

  it("同一シードで完全再現する", () => {
    const a = sampleEnemySymbols(dungeon3Map, createRng(2024));
    const b = sampleEnemySymbols(dungeon3Map, createRng(2024));
    expect(a).toEqual(b);
  });
});
