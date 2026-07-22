import { describe, expect, it } from "vitest";

import {
  createRng,
  fieldMap,
  dungeon1Map,
  dungeon2Map,
  dungeon3Map,
  isWalkable,
  mapDefinitionSchema,
  sampleEnemySymbols,
  samePosition,
  townMap,
  DIRECTIONS,
  MID_BOSS_ENEMY_IDS,
  RESPAWNABLE_ENEMY_IDS
} from "../src/index.js";
import type { Direction, EnemyId, MapDefinition, Position } from "../src/index.js";

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

  // -------------------------------------------------------------------------
  // M17: 見た目の向き(上下左右ランダム)
  // -------------------------------------------------------------------------

  it("M17: 各シンボルは4方向いずれかの向きを持つ", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      for (const p of sampleEnemySymbols(dungeon3Map, createRng(seed))) {
        expect(DIRECTIONS).toContain(p.facing);
      }
    }
  });

  it("M17: 向きは偏らずランダムに割り当てられる(複数シードで4方向すべて現れる)", () => {
    const seen = new Set<Direction>();
    for (let seed = 1; seed <= 100; seed += 1) {
      for (const p of sampleEnemySymbols(dungeon3Map, createRng(seed))) {
        seen.add(p.facing);
      }
    }
    expect([...seen].sort()).toEqual(["down", "left", "right", "up"]);
  });

  // -------------------------------------------------------------------------
  // M10: 新雑魚の出現とレンジ不変・中ボスの非出現
  // -------------------------------------------------------------------------

  /** 複数シードで実際に出現した敵種の集合を返す(存在検証用。メンバーシップだけでは
   *  RESPAWNABLE 未登録で暗黙除外されても検知できないため、実出現を確認する) */
  function speciesSeenAcross(map: MapDefinition, seeds: number): Set<EnemyId> {
    const seen = new Set<EnemyId>();
    for (let seed = 1; seed <= seeds; seed += 1) {
      for (const p of sampleEnemySymbols(map, createRng(seed))) seen.add(p.enemyId);
    }
    return seen;
  }

  it("M10新雑魚は各出現マップで実際に湧く(単なるプール登録でなく出現を確認)", () => {
    // フィールド: 霧狼 + 迷い火 の両方が出る
    const field = speciesSeenAcross(fieldMap, 100);
    expect(field).toContain("wisp-flame");
    expect(field).toContain("mist-wolf");
    // 1層: 蝋燭喰らい + 囁き仮面
    expect(speciesSeenAcross(dungeon1Map, 100)).toContain("whisper-mask");
    // 2層: 囁き仮面 + 錆喰い(と既存2種)
    const d2 = speciesSeenAcross(dungeon2Map, 100);
    expect(d2).toContain("whisper-mask");
    expect(d2).toContain("rust-eater");
    // 3層: 錆喰い
    expect(speciesSeenAcross(dungeon3Map, 100)).toContain("rust-eater");
  });

  it("シンボル数レンジは各マップとも不変(フィールド2-3・ダンジョン各層2-6)", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const f = sampleEnemySymbols(fieldMap, createRng(seed));
      expect(f.length).toBeGreaterThanOrEqual(2);
      expect(f.length).toBeLessThanOrEqual(3);
      for (const map of [dungeon1Map, dungeon2Map, dungeon3Map]) {
        const p = sampleEnemySymbols(map, createRng(seed));
        expect(p.length).toBeGreaterThanOrEqual(2);
        expect(p.length).toBeLessThanOrEqual(6);
      }
    }
  });

  it("中ボス(紡ぎ損ない)はサンプリングで出現しない=固定占有マーカーのみ", () => {
    const midBossPos = dungeon2Map.midBoss?.position;
    expect(midBossPos).toBeDefined();
    for (const map of [dungeon1Map, dungeon2Map, dungeon3Map, fieldMap]) {
      for (let seed = 1; seed <= 100; seed += 1) {
        for (const p of sampleEnemySymbols(map, createRng(seed))) {
          // 中ボス種は湧かない
          for (const midId of MID_BOSS_ENEMY_IDS) expect(p.enemyId).not.toBe(midId);
          // 中ボスの占有マス(非walkable)にはシンボルが載らない
          if (midBossPos && map === dungeon2Map) {
            expect(samePosition(p.position, midBossPos)).toBe(false);
          }
        }
      }
    }
  });
});
