import Phaser from "phaser";

import { MAPS, mapConnectionEdges } from "@dreaming-engine/shared";
import type { MapId, SnapshotView } from "@dreaming-engine/shared";

import { UI_FONT_FAMILY } from "./font.js";

export interface MapOverlayOptions {
  snapshot: SnapshotView;
}

const PANEL_WIDTH = 640;
const PANEL_HEIGHT = 420;

/** ノード矩形の大きさ(displayName が収まる幅。8マップ全てで確認済み) */
const NODE_WIDTH = 150;
const NODE_HEIGHT = 36;

/** 現在地の強調色(灯の琥珀。バトルUIの状態バッジと同系) */
const CURRENT_COLOR = "#c9a25c";
const CURRENT_COLOR_NUM = 0xc9a25c;

/**
 * ノード配置(パネル内の中心座標)。world-lore の地理感に沿った presentation 定数
 * (game-design.md「全体マップUI『夢の地図』」: 灯町=拠点・忘れ野=その外・裂け目=東へ層状・
 * 沈み野=忘れ野の西・琥珀郷=西の奥・灯還りの坑=西の最奥)。
 * マップは独立グリッドで共有座標系を持たないため、これは隣接(辺)とは別の見た目上の配置である。
 */
const NODE_POSITIONS: Record<MapId, { x: number; y: number }> = {
  town: { x: 320, y: 250 },
  field: { x: 320, y: 140 },
  "dungeon-1": { x: 500, y: 120 },
  "dungeon-2": { x: 500, y: 200 },
  "dungeon-3": { x: 500, y: 280 },
  "field-2": { x: 140, y: 140 },
  settlement: { x: 140, y: 230 },
  "dungeon-4": { x: 140, y: 320 }
};

/**
 * 全体マップオーバーレイ「夢の地図」(M22-3)。
 * 探索中に M で開閉し、Esc で閉じる(開閉は探索シーンが管理する。閲覧のみ=操作キーなし)。
 * 訪問済みマップの接続グラフと現在地を表示する。未訪問のマップは靄に沈めて名を伏せ、
 * 両端が訪問済みの辺だけを描く(この世界は機関が紡ぐひとつの夢=踏み込んでいない領域は見えない)。
 * 表示内容はサーバー正本のスナップショット visitedMaps / location が正。
 * 接続グラフ(mapConnectionEdges)と displayName は静的な MAPS 登録簿から引く。
 */
export class MapOverlay {
  private readonly container: Phaser.GameObjects.Container;

  private destroyed = false;

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: MapOverlayOptions
  ) {
    const visited = new Set<MapId>(options.snapshot.visitedMaps);
    const currentMapId = options.snapshot.location.mapId;
    const panelX = Math.round((scene.scale.width - PANEL_WIDTH) / 2);
    const panelY = Math.round((scene.scale.height - PANEL_HEIGHT) / 2);

    const background = scene.add
      .rectangle(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, 0x0b0d12, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x6b6350);

    const title = scene.add.text(panelX + 20, panelY + 14, "夢の地図", {
      color: "#d8c98f",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "20px"
    });

    // 辺(両端が訪問済みのもののみ描く。未踏の先は靄の中)
    const edges = scene.add.graphics();
    edges.lineStyle(2, 0x6b6350, 0.8);
    for (const [a, b] of mapConnectionEdges()) {
      if (!visited.has(a) || !visited.has(b)) continue;
      const pa = NODE_POSITIONS[a];
      const pb = NODE_POSITIONS[b];
      edges.lineBetween(panelX + pa.x, panelY + pa.y, panelX + pb.x, panelY + pb.y);
    }

    // ノード(訪問済み=名前入りの矩形・現在地=琥珀の強調枠/未訪問=靄の矩形+「?」)
    const nodes: Phaser.GameObjects.GameObject[] = [];
    for (const map of Object.values(MAPS)) {
      const pos = NODE_POSITIONS[map.id];
      const cx = panelX + pos.x;
      const cy = panelY + pos.y;
      const isVisited = visited.has(map.id);
      const isCurrent = map.id === currentMapId;

      const box = scene.add
        .rectangle(
          cx,
          cy,
          NODE_WIDTH,
          NODE_HEIGHT,
          isVisited ? 0x141824 : 0x0b0d12,
          isVisited ? 0.95 : 0.8
        )
        .setStrokeStyle(isCurrent ? 3 : 2, isCurrent ? CURRENT_COLOR_NUM : isVisited ? 0x6b6350 : 0x2a2f3a);
      nodes.push(box);

      const label = scene.add
        .text(cx, cy, isVisited ? map.displayName : "?", {
          color: isCurrent ? CURRENT_COLOR : isVisited ? "#f1eee4" : "#4a505c",
          fontFamily: UI_FONT_FAMILY,
          fontSize: "14px"
        })
        .setOrigin(0.5);
      nodes.push(label);

      if (isCurrent) {
        const marker = scene.add
          .text(cx, cy - NODE_HEIGHT / 2 - 12, "▼ いまここ", {
            color: CURRENT_COLOR,
            fontFamily: UI_FONT_FAMILY,
            fontSize: "12px"
          })
          .setOrigin(0.5);
        nodes.push(marker);
      }
    }

    const footer = scene.add.text(panelX + 20, panelY + PANEL_HEIGHT - 30, "M / Esc でとじる", {
      color: "#6f7684",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "13px"
    });

    this.container = scene.add.container(0, 0, [background, title, edges, ...nodes, footer]);
    parentLayer.add(this.container);
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.container.destroy(true);
  }
}
