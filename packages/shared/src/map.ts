import { z } from "zod";

import { directionSchema, neighbor, positionSchema, samePosition } from "./geometry.js";
import type { Direction, Position } from "./geometry.js";
import { enemyIdSchema, npcIdSchema } from "./ids.js";

// ---------------------------------------------------------------------------
// タイル種別
// ---------------------------------------------------------------------------

/**
 * タイル種別(最小限)。プレースホルダー描画ではクライアントが種別ごとに色を割り当てる。
 * 衝突(solid)はタイル種別から一意に決まる(別配列を持たず種別が唯一の正)。
 */
export const tileTypeSchema = z.enum(["floor", "wall", "water", "road", "grass"]);
export type TileType = z.infer<typeof tileTypeSchema>;

/** マップの行文字列で使う1文字コード → タイル種別。マップは行文字列で記述する。 */
export const TILE_CHARS: Record<string, TileType | undefined> = {
  ".": "floor",
  "#": "wall",
  "~": "water",
  "=": "road",
  ",": "grass"
};

/** 通行不能(衝突)なタイル種別か。壁と水は塞ぐ。 */
export const TILE_SOLID: Record<TileType, boolean> = {
  floor: false,
  wall: true,
  water: true,
  road: false,
  grass: false
};

export function isSolidTileType(tile: TileType): boolean {
  return TILE_SOLID[tile];
}

// ---------------------------------------------------------------------------
// マップ構成要素のスキーマ
// ---------------------------------------------------------------------------

export const mapIdSchema = z.enum(["town", "field", "dungeon-1", "dungeon-2", "dungeon-3"]);
export type MapId = z.infer<typeof mapIdSchema>;

/** 遷移ポイント: このマスに立つと行き先マップの指定座標・向きへ移る */
export const transitionSchema = z.object({
  position: positionSchema,
  to: z.object({
    mapId: mapIdSchema,
    position: positionSchema,
    facing: directionSchema
  })
});
export type Transition = z.infer<typeof transitionSchema>;

/** NPC配置(占有マス。プレイヤーはこのマスに入れず、正面から話しかける) */
export const npcPlacementSchema = z.object({
  id: npcIdSchema,
  position: positionSchema,
  facing: directionSchema
});
export type NpcPlacement = z.infer<typeof npcPlacementSchema>;

/** 調べられるオブジェクトの種別(看板・宝箱・採取ポイント) */
export const mapObjectKindSchema = z.enum(["sign", "chest", "gather"]);
export type MapObjectKind = z.infer<typeof mapObjectKindSchema>;

/** 調べられるオブジェクト(占有マス。正面から「調べる」) */
export const mapObjectSchema = z.object({
  id: z.string().min(1),
  kind: mapObjectKindSchema,
  position: positionSchema,
  /** 「調べる」時のプレースホルダー文言(M1段階) */
  message: z.string().min(1)
});
export type MapObject = z.infer<typeof mapObjectSchema>;

/** ボス位置マーカー(ダンジョン最深部のみ。占有マス) */
export const bossMarkerSchema = z.object({
  position: positionSchema,
  enemyId: enemyIdSchema
});
export type BossMarker = z.infer<typeof bossMarkerSchema>;

/**
 * 敵シンボルの出現設定。数レンジの正は game-design.md「マップ構成」
 * (フィールド2-3体、ダンジョン各層2-6体)。species はこのマップに出現しうる雑魚種。
 */
export const enemySymbolsSchema = z
  .object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
    species: z.array(enemyIdSchema).min(1)
  })
  .refine((s) => s.min <= s.max, { message: "enemySymbols.min は max 以下でなければならない" });
export type EnemySymbols = z.infer<typeof enemySymbolsSchema>;

/** プレイヤー初期位置(新規ゲーム開始マップ=街のみ持つ) */
export const spawnPointSchema = z.object({
  position: positionSchema,
  facing: directionSchema
});
export type SpawnPoint = z.infer<typeof spawnPointSchema>;

// ---------------------------------------------------------------------------
// マップ定義スキーマ(整合性を superRefine で検証)
// ---------------------------------------------------------------------------

const mapDefinitionBaseSchema = z.object({
  id: mapIdSchema,
  /** 表示名(world-lore.md の固有名詞に従う) */
  displayName: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** 行文字列の配列(各文字は TILE_CHARS のキー)。rows[y] が y 行目、その x 文字目が (x,y) のタイル */
  rows: z.array(z.string()).min(1),
  /** 安全地帯(エンカウントなし)フラグ。街のみ true */
  safe: z.boolean(),
  transitions: z.array(transitionSchema),
  npcs: z.array(npcPlacementSchema),
  objects: z.array(mapObjectSchema),
  enemySymbols: enemySymbolsSchema.optional(),
  boss: bossMarkerSchema.optional(),
  /** 中ボス(固定配置マーカー。M10)。最終ボスとは別枠で、占有マス=踏み込みで戦闘開始 */
  midBoss: bossMarkerSchema.optional(),
  playerStart: spawnPointSchema.optional()
});

function tileFromRows(rows: string[], width: number, height: number, x: number, y: number): TileType | undefined {
  if (x < 0 || y < 0 || x >= width || y >= height) return undefined;
  const row = rows[y];
  if (row === undefined) return undefined;
  const ch = row[x];
  if (ch === undefined) return undefined;
  return TILE_CHARS[ch];
}

export const mapDefinitionSchema = mapDefinitionBaseSchema.superRefine((map, ctx) => {
  const addIssue = (message: string): void => {
    ctx.addIssue({ code: "custom", message });
  };

  // --- 寸法とタイル文字の検証 ---
  if (map.rows.length !== map.height) {
    addIssue(`rows の行数(${map.rows.length})が height(${map.height})と一致しない`);
  }
  map.rows.forEach((row, y) => {
    if (row.length !== map.width) {
      addIssue(`行 ${y} の幅(${row.length})が width(${map.width})と一致しない`);
    }
    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x];
      if (ch === undefined || TILE_CHARS[ch] === undefined) {
        addIssue(`(${x},${y}) に未知のタイル文字 "${ch ?? ""}" がある`);
      }
    }
  });

  const inBounds = (p: Position): boolean => p.x < map.width && p.y < map.height;
  const solidTerrain = (p: Position): boolean => {
    const t = tileFromRows(map.rows, map.width, map.height, p.x, p.y);
    return t === undefined || TILE_SOLID[t];
  };

  // --- 配置物が範囲内かつ通行可能(非solid)地形上にあるか ---
  const checkPlaceable = (p: Position, label: string): void => {
    if (!inBounds(p)) {
      addIssue(`${label} の座標 (${p.x},${p.y}) がマップ範囲外`);
      return;
    }
    if (solidTerrain(p)) {
      addIssue(`${label} の座標 (${p.x},${p.y}) が通行不能タイル上にある`);
    }
  };

  for (const t of map.transitions) checkPlaceable(t.position, "transition");
  for (const n of map.npcs) checkPlaceable(n.position, `npc:${n.id}`);
  for (const o of map.objects) checkPlaceable(o.position, `object:${o.id}`);
  if (map.boss) checkPlaceable(map.boss.position, "boss");
  if (map.midBoss) checkPlaceable(map.midBoss.position, "midBoss");
  if (map.playerStart) checkPlaceable(map.playerStart.position, "playerStart");

  // --- 占有マス(NPC/オブジェクト/ボス)の重複禁止 ---
  const occupancy: { position: Position; label: string }[] = [
    ...map.npcs.map((n) => ({ position: n.position, label: `npc:${n.id}` })),
    ...map.objects.map((o) => ({ position: o.position, label: `object:${o.id}` }))
  ];
  if (map.boss) occupancy.push({ position: map.boss.position, label: "boss" });
  if (map.midBoss) occupancy.push({ position: map.midBoss.position, label: "midBoss" });
  occupancy.forEach((a, i) => {
    for (let j = i + 1; j < occupancy.length; j += 1) {
      const b = occupancy[j];
      if (b && samePosition(a.position, b.position)) {
        addIssue(`占有マスが重複: ${a.label} と ${b.label} が (${a.position.x},${a.position.y})`);
      }
    }
  });

  // --- 占有マスが遷移マス・プレイヤー初期位置と重ならないこと ---
  for (const occ of occupancy) {
    for (const t of map.transitions) {
      if (samePosition(occ.position, t.position)) {
        addIssue(`${occ.label} が遷移マス (${t.position.x},${t.position.y}) を塞いでいる`);
      }
    }
    if (map.playerStart && samePosition(occ.position, map.playerStart.position)) {
      addIssue(`${occ.label} がプレイヤー初期位置を塞いでいる`);
    }
  }

  // --- 遷移マスの重複禁止 ---
  map.transitions.forEach((a, i) => {
    for (let j = i + 1; j < map.transitions.length; j += 1) {
      const b = map.transitions[j];
      if (b && samePosition(a.position, b.position)) {
        addIssue(`遷移マスが重複: (${a.position.x},${a.position.y})`);
      }
    }
  });

  // --- オブジェクトIDの重複禁止 ---
  const objectIds = new Set<string>();
  for (const o of map.objects) {
    if (objectIds.has(o.id)) addIssue(`オブジェクトIDが重複: ${o.id}`);
    objectIds.add(o.id);
  }

  // --- 安全地帯には敵シンボルを置かない ---
  if (map.safe && map.enemySymbols && map.enemySymbols.max > 0) {
    addIssue("安全地帯(safe)のマップに敵シンボル(max>0)を設定できない");
  }
});

export type MapDefinition = z.infer<typeof mapDefinitionSchema>;

// ---------------------------------------------------------------------------
// マップ照会・移動・インタラクションの純ロジック(Phaser非依存)
// ---------------------------------------------------------------------------

export function inBounds(map: MapDefinition, position: Position): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < map.width && position.y < map.height;
}

/** (x,y) のタイル種別。範囲外は undefined。 */
export function tileTypeAt(map: MapDefinition, position: Position): TileType | undefined {
  return tileFromRows(map.rows, map.width, map.height, position.x, position.y);
}

/** 地形が通行不能か(範囲外も通行不能扱い)。占有物は考慮しない。 */
export function isSolidAt(map: MapDefinition, position: Position): boolean {
  const tile = tileTypeAt(map, position);
  return tile === undefined || TILE_SOLID[tile];
}

export function npcAt(map: MapDefinition, position: Position): NpcPlacement | null {
  return map.npcs.find((n) => samePosition(n.position, position)) ?? null;
}

export function objectAt(map: MapDefinition, position: Position): MapObject | null {
  return map.objects.find((o) => samePosition(o.position, position)) ?? null;
}

export function bossAt(map: MapDefinition, position: Position): BossMarker | null {
  if (map.boss && samePosition(map.boss.position, position)) return map.boss;
  return null;
}

/**
 * 中ボス(固定配置マーカー)がそのマスにいるか(M10。game-design.md「敵バリエーション」)。
 * 最終ボス(bossAt)とは別枠の占有マーカー。撃破状態はセッション側(gimmicks)で管理し、
 * マップ定義上は常に存在する(撃破後も占有=非walkableのまま。側室の行き止まりのため経路を塞がない)。
 */
export function midBossAt(map: MapDefinition, position: Position): BossMarker | null {
  if (map.midBoss && samePosition(map.midBoss.position, position)) return map.midBoss;
  return null;
}

/** NPC・オブジェクト・ボス・中ボスのいずれかがマスを占有しているか */
export function isOccupied(map: MapDefinition, position: Position): boolean {
  return (
    npcAt(map, position) !== null ||
    objectAt(map, position) !== null ||
    bossAt(map, position) !== null ||
    midBossAt(map, position) !== null
  );
}

/** そのマスにプレイヤーが立てるか(範囲内・地形非solid・占有物なし) */
export function isWalkable(map: MapDefinition, position: Position): boolean {
  return inBounds(map, position) && !isSolidAt(map, position) && !isOccupied(map, position);
}

export interface MoveResult {
  /** 実際に移動できたか(不可なら位置は据え置き) */
  moved: boolean;
  position: Position;
}

/** (マップ, 現在位置, 向き) → 移動可否と移動先 */
export function tryMove(map: MapDefinition, from: Position, direction: Direction): MoveResult {
  const target = neighbor(from, direction);
  if (isWalkable(map, target)) {
    return { moved: true, position: target };
  }
  return { moved: false, position: from };
}

/** (マップ, 位置) → そのマスの遷移ポイント or null */
export function transitionAt(map: MapDefinition, position: Position): Transition | null {
  return map.transitions.find((t) => samePosition(t.position, position)) ?? null;
}

export type InteractionTarget =
  | { kind: "npc"; npc: NpcPlacement }
  | { kind: "object"; object: MapObject }
  | { kind: "boss"; boss: BossMarker };

/** (マップ, 位置, 向き) → 正面マスのNPC/オブジェクト/ボス or null */
export function interactionTarget(
  map: MapDefinition,
  position: Position,
  facing: Direction
): InteractionTarget | null {
  const front = neighbor(position, facing);
  const npc = npcAt(map, front);
  if (npc) return { kind: "npc", npc };
  const object = objectAt(map, front);
  if (object) return { kind: "object", object };
  const boss = bossAt(map, front);
  if (boss) return { kind: "boss", boss };
  return null;
}
