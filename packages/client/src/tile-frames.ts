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

/**
 * 壁の「上面・内部」フレーム(M14: 壁の向き差分)。壁が下方向にも続く
 * (南隣も壁扱い)マスで使う。シートの15行目=縁取りの石ブロック
 * (12行目のボーダー付きブロックは縦積みで横縞に見えたため差し替え。
 * 候補比較と全マップ合成プレビューの目視で選定: M14-2)。
 */
const WALL_TOP_FRAMES: Record<MapCategory, number> = {
  town: frameAt(14, 15),
  field: frameAt(21, 15),
  dungeon: frameAt(28, 15)
};

/**
 * 壁タイルのフレーム番号を、南隣が壁扱いか否かで切り替える(M14: 向き差分)。
 * 南が非壁(下に床が見える)= 壁の正面(TILE_FRAMES の現行フレーム)、
 * 南も壁 = 壁の上面・内部(WALL_TOP_FRAMES)。正面は tileFrame と単一の出所を共有する。
 */
export function wallFrame(mapId: MapId, southIsWall: boolean): number {
  const category = categoryOf(mapId);
  return southIsWall ? WALL_TOP_FRAMES[category] : TILE_FRAMES[category].wall;
}

/**
 * マップ区分ごとの暗色トーン(乗算tint)。原色寄りのCC0タイルを
 * ダークファンタジーの沈んだ色調(青灰と琥珀の対比: asset-pipeline.md)へ寄せる。
 * 街=夕暮れの青灰、フィールド=くすんだ荒野、ダンジョン=冷たい青灰。
 * 値はタイル合成プレビューの目視で選定(JOURNAL[27])。
 */
const TILE_TINTS: Record<MapCategory, number> = {
  town: 0xaaa6b4,
  field: 0x8f9480,
  dungeon: 0x7d84a0
};

/** マップに応じたタイルの乗算tintを返す */
export function tileTint(mapId: MapId): number {
  return TILE_TINTS[categoryOf(mapId)];
}
