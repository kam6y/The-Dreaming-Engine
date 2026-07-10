import { describe, expect, it } from "vitest";

import {
  ALL_MAPS,
  MAPS,
  NEW_GAME_START,
  isWalkable,
  mapDefinitionSchema,
  neighbor,
  tileTypeAt,
  transitionAt
} from "../src/index.js";
import type { Direction, MapDefinition, MapId } from "../src/index.js";
import {
  isAdjacentReachable,
  isCellReachable,
  reachableCells,
  renderReachable
} from "./helpers/pathfinding.js";

const EXPECTED_MAP_IDS: MapId[] = [
  "town",
  "field",
  "dungeon-1",
  "dungeon-2",
  "dungeon-3",
  // 第2エリア(M16)
  "settlement",
  "field-2",
  "dungeon-4"
];

describe("マップレジストリ", () => {
  it("8マップが登録されている(第2エリア3枚を含む)", () => {
    expect(ALL_MAPS).toHaveLength(8);
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
  it("フィールドは2-3体(レンジ不変。プールは霧狼+迷い火 に拡張=M10)", () => {
    // レンジ(min/max)は game-design.md「マップ構成」が唯一の正=不変。species は M10 で拡張。
    expect(MAPS.field.enemySymbols?.min).toBe(2);
    expect(MAPS.field.enemySymbols?.max).toBe(3);
    expect(MAPS.field.enemySymbols?.species).toEqual(["mist-wolf", "wisp-flame"]);
  });

  it("ダンジョン各層は2-6体(レンジ不変)", () => {
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

  it("NPCは建物を背にして立つ(背後のマスが壁。M17)", () => {
    const OPPOSITE: Record<Direction, Direction> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left"
    };
    for (const map of ALL_MAPS) {
      for (const npc of map.npcs) {
        const behind = neighbor(npc.position, OPPOSITE[npc.facing]);
        expect(
          tileTypeAt(map, behind),
          `${map.id} の ${npc.id} の背後 (${behind.x},${behind.y}) は建物(壁)であるべき`
        ).toBe("wall");
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

describe("第2エリア(M16。game-design.md『第2エリア(拡張: M16)』が正)", () => {
  it("琥珀郷は安全地帯で敵シンボルを持たない(灯町と同じ不変条件)", () => {
    expect(MAPS.settlement.safe).toBe(true);
    expect(MAPS.settlement.enemySymbols).toBeUndefined();
  });

  it("琥珀郷は 16x12・NPC未配置(M16-3で追加)", () => {
    expect(MAPS.settlement.width).toBe(16);
    expect(MAPS.settlement.height).toBe(12);
    expect(MAPS.settlement.npcs).toHaveLength(0);
  });

  it("沈み野の出現プールは 迷い火・囁き仮面・軋み人形(レンジ2-3)", () => {
    expect(MAPS["field-2"].enemySymbols?.min).toBe(2);
    expect(MAPS["field-2"].enemySymbols?.max).toBe(3);
    expect(MAPS["field-2"].enemySymbols?.species).toEqual([
      "wisp-flame",
      "whisper-mask",
      "creaking-doll"
    ]);
  });

  it("灯還りの坑の出現プールは 蝋燭喰らい・軋み人形・錆喰い(レンジ2-6)", () => {
    expect(MAPS["dungeon-4"].enemySymbols?.min).toBe(2);
    expect(MAPS["dungeon-4"].enemySymbols?.max).toBe(6);
    expect(MAPS["dungeon-4"].enemySymbols?.species).toEqual([
      "candle-eater",
      "creaking-doll",
      "rust-eater"
    ]);
  });

  it("沈み野の採取ポイントは1-2箇所(採取kind)", () => {
    const gathers = MAPS["field-2"].objects.filter((o) => o.kind === "gather");
    expect(gathers.length).toBeGreaterThanOrEqual(1);
    expect(gathers.length).toBeLessThanOrEqual(2);
  });

  it("灯還りの坑はボス・中ボスを持たず、最奥に調べられる導管オブジェクトがある", () => {
    expect(MAPS["dungeon-4"].boss).toBeUndefined();
    expect(MAPS["dungeon-4"].midBoss).toBeUndefined();
    expect(MAPS["dungeon-4"].objects.some((o) => o.id === "d4-conduit")).toBe(true);
  });

  it("第2エリア3枚は新敵種・ボスを出現プールに混ぜない(既存8種の再利用)", () => {
    const allowed = new Set([
      "mist-wolf",
      "candle-eater",
      "creaking-doll",
      "wisp-flame",
      "whisper-mask",
      "rust-eater"
    ]);
    for (const id of ["settlement", "field-2", "dungeon-4"] as const) {
      for (const species of MAPS[id].enemySymbols?.species ?? []) {
        expect(allowed.has(species), `${id} に許可外の敵種 ${species}`).toBe(true);
      }
    }
  });
});

describe("忘れ野の西門追加(M16)による既存要件の不変(回帰)", () => {
  const field = MAPS.field;
  const gateAt = (x: number, y: number): boolean =>
    field.transitions.some((t) => t.position.x === x && t.position.y === y);

  it("北門(11,0)・南門(11,15)と敵シンボルレンジ2-3は不変", () => {
    expect(gateAt(11, 0)).toBe(true);
    expect(gateAt(11, 15)).toBe(true);
    expect(field.enemySymbols?.min).toBe(2);
    expect(field.enemySymbols?.max).toBe(3);
    expect(field.enemySymbols?.species).toEqual(["mist-wolf", "wisp-flame"]);
  });

  it("縦断路 x=11(既存E2E経路)は y=1..14 が通行可能のまま", () => {
    for (let y = 1; y <= 14; y += 1) {
      expect(isWalkable(field, { x: 11, y }), `(11,${y}) が通行不能`).toBe(true);
    }
  });

  it("西門(0,8)が追加され、沈み野の東門と相互対応する", () => {
    expect(gateAt(0, 8)).toBe(true);
    const west = field.transitions.find((t) => t.position.x === 0 && t.position.y === 8);
    expect(west?.to.mapId).toBe("field-2");
    // 沈み野側の東門が忘れ野へ戻る(双方向)
    const back = MAPS["field-2"].transitions.find((t) => t.to.mapId === "field");
    expect(back).toBeDefined();
    // 互いの到着マスが歩行可能で、到着マス自体は遷移マスでない(跳ね返り防止)
    if (west) expect(isWalkable(MAPS["field-2"], west.to.position)).toBe(true);
    if (back) expect(isWalkable(field, back.to.position)).toBe(true);
  });
});
