import type { MapId, TileType } from "@dreaming-engine/shared";

/**
 * CC0タイルセット(Kenney Roguelike/RPG pack)のフレーム割当。
 * シートの仕様(16pxタイル+1px間隔・57列x31行)と出典は assets/tiles/README.md が正。
 * フレーム番号は左上起点の行優先(frame = 行 * 57 + 列)。
 */
export const TILESET_KEY = "tileset";
export const TILESET_PATH = "assets/tiles/roguelike-sheet-transparent.png";
/** シートの原寸タイルサイズ(px)。ゲームの32pxグリッドへは2倍で表示する */
export const TILESET_TILE_PX = 16;
export const TILESET_COLUMNS = 57;
export const TILESET_ROWS = 31;
/** Phaser の load.spritesheet へ渡す切り出し設定(外周マージンなし・間隔1px) */
export const TILESET_FRAME_CONFIG = {
  frameWidth: TILESET_TILE_PX,
  frameHeight: TILESET_TILE_PX,
  margin: 0,
  spacing: 1
} as const;

/** マップの見た目区分。ダンジョン3層は同一トーンで揃える */
type MapCategory = "town" | "field" | "dungeon";

function categoryOf(mapId: MapId): MapCategory {
  return mapId === "town" || mapId === "field" ? mapId : "dungeon";
}

/** 列・行からフレーム番号を計算する(シート目視で選定した座標を可読に保つ) */
function frameAt(column: number, row: number): number {
  return row * TILESET_COLUMNS + column;
}

/**
 * マップ区分 x タイル種別 → フレーム番号。
 * 選定基準: 街=石畳と土壁の拠点、フィールド=土と岩壁の荒野、
 * ダンジョン=石床と青灰壁の裂け目。ダークファンタジーへのトーン調整(暗色化)は
 * 描画側の tint で行う(M7-3)。
 */
const TILE_FRAMES: Record<MapCategory, Record<TileType, number>> = {
  town: {
    floor: frameAt(6, 3), // 灰色の石畳
    wall: frameAt(17, 16), // 土色の壁面
    water: frameAt(0, 0), // 揺らめきの入った水面
    road: frameAt(5, 2), // 茶色の煉瓦敷き
    grass: frameAt(5, 1) // 斑点入りの草地
  },
  field: {
    floor: frameAt(6, 1), // 斑点入りの土
    wall: frameAt(21, 16), // 灰色の岩壁
    water: frameAt(0, 0),
    road: frameAt(8, 1), // 砂色の踏み分け道
    grass: frameAt(5, 1)
  },
  dungeon: {
    floor: frameAt(7, 1), // 斑点入りの石床
    wall: frameAt(28, 16), // 青灰色の壁面
    water: frameAt(0, 0),
    road: frameAt(5, 2),
    grass: frameAt(5, 1)
  }
};

/** マップとタイル種別からタイルセットのフレーム番号を返す */
export function tileFrame(mapId: MapId, tile: TileType): number {
  return TILE_FRAMES[categoryOf(mapId)][tile];
}
