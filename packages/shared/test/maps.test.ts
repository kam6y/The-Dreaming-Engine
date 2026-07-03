import { describe, expect, it } from "vitest";

import {
  ALL_MAPS,
  MAPS,
  NEW_GAME_START,
  isWalkable,
  mapDefinitionSchema,
  transitionAt
} from "../src/index.js";
import type { MapDefinition, MapId } from "../src/index.js";
import {
  isAdjacentReachable,
  isCellReachable,
  reachableCells,
  renderReachable
} from "./helpers/pathfinding.js";

const EXPECTED_MAP_IDS: MapId[] = ["town", "field", "dungeon-1", "dungeon-2", "dungeon-3"];

describe("マップレジストリ", () => {
  it("5マップが登録されている", () => {
    expect(ALL_MAPS).toHaveLength(5);
    for (const id of EXPECTED_MAP_IDS) {
      expect(MAPS[id].id).toBe(id);
    }
  });

  it("全マップがスキーマに適合する", () => {
    for (const map of ALL_MAPS) {
      expect(() => mapDefinitionSchema.parse(map)).not.toThrow();
    }
  });

  it("新規ゲーム開始地点は街のプレイヤー初期位置", () => {
    expect(NEW_GAME_START.mapId).toBe("town");
    expect(MAPS.town.playerStart?.position).toEqual(NEW_GAME_START.position);
    expect(MAPS.town.playerStart?.facing).toBe(NEW_GAME_START.facing);
  });
});

describe("敵シンボル出現数レンジ(game-design.md『マップ構成』が正)", () => {
  it("フィールドは2-3体", () => {
    expect(MAPS.field.enemySymbols).toEqual({
      min: 2,
      max: 3,
      species: ["mist-wolf"]
    });
  });

  it("ダンジョン各層は2-6体", () => {
    for (const id of ["dungeon-1", "dungeon-2", "dungeon-3"] as const) {
      expect(MAPS[id].enemySymbols?.min).toBe(2);
      expect(MAPS[id].enemySymbols?.max).toBe(6);
    }
  });

  it("街は安全地帯(敵シンボルなし)", () => {
    expect(MAPS.town.safe).toBe(true);
    expect(MAPS.town.enemySymbols).toBeUndefined();
  });

  it("ボス『夢喰い』はどのシンボル出現プールにも含まれない(リスポーンしない)", () => {
    for (const map of ALL_MAPS) {
      expect(map.enemySymbols?.species ?? []).not.toContain("dream-eater");
    }
  });
});

describe("配置(NPC・オブジェクト・ボス)", () => {
  it("街に4人のNPC(宿屋・商人・情報屋・司祭)がいる", () => {
    const ids = MAPS.town.npcs.map((n) => n.id).sort();
    expect(ids).toEqual(["informant", "innkeeper", "merchant", "priest"]);
  });

  it("フィールドの採取ポイントは1-2箇所", () => {
    const gathers = MAPS.field.objects.filter((o) => o.kind === "gather");
    expect(gathers.length).toBeGreaterThanOrEqual(1);
    expect(gathers.length).toBeLessThanOrEqual(2);
  });

  it("ボスマーカーは三層(最深部)のみに存在する", () => {
    for (const map of ALL_MAPS) {
      if (map.id === "dungeon-3") {
        expect(map.boss?.enemyId).toBe("dream-eater");
      } else {
        expect(map.boss).toBeUndefined();
      }
    }
  });
});

describe("遷移の双方向整合", () => {
  const findReturn = (from: MapId, to: MapId): boolean =>
    MAPS[to].transitions.some((t) => t.to.mapId === from);

  it("全ての遷移に逆向きの遷移が存在する", () => {
    for (const map of ALL_MAPS) {
      for (const t of map.transitions) {
        expect(findReturn(map.id, t.to.mapId)).toBe(true);
      }
    }
  });

  it("到着マスは通行可能で、それ自体が遷移マスではない(跳ね返り防止)", () => {
    for (const map of ALL_MAPS) {
      for (const t of map.transitions) {
        const dest: MapDefinition = MAPS[t.to.mapId];
        expect(isWalkable(dest, t.to.position)).toBe(true);
        expect(transitionAt(dest, t.to.position)).toBeNull();
      }
    }
  });
});

describe("接続性(街→ダンジョン最下層)", () => {
  const reachable = reachableCells(NEW_GAME_START);

  it("街の新規開始地点から各マップの入口へ歩いて到達できる", () => {
    // 各マップに少なくとも1つの到達済みセルがある
    for (const id of EXPECTED_MAP_IDS) {
      const anyReached = [...reachable].some((key) => key.startsWith(`${id}:`));
      expect(anyReached, `${id} に到達できない`).toBe(true);
    }
  });

  it("街からダンジョン最深部のボスの隣まで歩いて到達できる", () => {
    const boss = MAPS["dungeon-3"].boss;
    expect(boss).toBeDefined();
    if (!boss) return;
    const ok = isAdjacentReachable(reachable, "dungeon-3", boss.position);
    if (!ok) {
      // 失敗時は到達図を出して原因を目視できるようにする
      console.log(renderReachable(MAPS["dungeon-3"], reachable));
    }
    expect(ok).toBe(true);
  });

  it("各マップの遷移マス自体にも到達できる(門が塞がれていない)", () => {
    for (const map of ALL_MAPS) {
      for (const t of map.transitions) {
        // 街到達済みかつ経路上にある門のみを対象にする(全門が街から辿れる設計)
        expect(
          isCellReachable(reachable, map.id, t.position),
          `${map.id} の遷移マス (${t.position.x},${t.position.y}) に到達できない`
        ).toBe(true);
      }
    }
  });
});
