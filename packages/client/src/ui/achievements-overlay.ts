import Phaser from "phaser";

import { ACHIEVEMENTS, ACHIEVEMENT_IDS } from "@dreaming-engine/shared";
import type { AchievementId, SnapshotView } from "@dreaming-engine/shared";

import { UI_FONT_FAMILY } from "./font.js";

export interface AchievementsOverlayOptions {
  snapshot: SnapshotView;
}

const PANEL_WIDTH = 640;
const PANEL_HEIGHT = 420;

/** 一覧のグリッド(12件=2列x6行)。エントリ矩形の大きさと余白 */
const COLUMNS = 2;
const ENTRY_WIDTH = 296;
const ENTRY_HEIGHT = 50;
const ENTRY_GAP = 6;
const GRID_TOP = 52;

/** 解除済みの見出し色(灯の琥珀。夢の地図の現在地強調と同系) */
const UNLOCKED_NAME_COLOR = "#d8c98f";

/**
 * 実績一覧オーバーレイ「夢の欠片」(M24-3)。
 * 探索中に K で開閉し、Esc で閉じる(開閉は探索シーンが管理する。閲覧のみ=操作キーなし)。
 * 登録簿 ACHIEVEMENTS の全12件を列挙し、解除済み=表示名+フレーバー、
 * 未解除=名を伏せた靄(暗い枠+「……」。条件・フレーバーも出さない=ネタバレ防止)。
 * 解除状態はサーバー正本のスナップショット unlockedAchievements が正。
 * 定義(表示名・フレーバー・総数)は静的な ACHIEVEMENTS 登録簿から引く(viewは解除id配列のみ)。
 */
export class AchievementsOverlay {
  private readonly container: Phaser.GameObjects.Container;

  private destroyed = false;

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: AchievementsOverlayOptions
  ) {
    const unlocked = new Set<AchievementId>(options.snapshot.unlockedAchievements);
    const panelX = Math.round((scene.scale.width - PANEL_WIDTH) / 2);
    const panelY = Math.round((scene.scale.height - PANEL_HEIGHT) / 2);

    const background = scene.add
      .rectangle(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, 0x0b0d12, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x6b6350);

    const title = scene.add.text(panelX + 20, panelY + 14, "夢の欠片", {
      color: UNLOCKED_NAME_COLOR,
      fontFamily: UI_FONT_FAMILY,
      fontSize: "20px"
    });

    // ヘッダ「欠片 n/12」(収集の進み。総数は登録簿から引く)
    const header = scene.add
      .text(
        panelX + PANEL_WIDTH - 20,
        panelY + 18,
        `欠片 ${unlocked.size}/${ACHIEVEMENT_IDS.length}`,
        {
          color: "#a9b0ba",
          fontFamily: UI_FONT_FAMILY,
          fontSize: "14px"
        }
      )
      .setOrigin(1, 0);

    // エントリ(登録簿の列挙順で2列x6行。解除済み=名+フレーバー/未解除=靄の「……」)
    const entries: Phaser.GameObjects.GameObject[] = [];
    ACHIEVEMENT_IDS.forEach((id, index) => {
      const column = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const x = panelX + 16 + column * (ENTRY_WIDTH + 16);
      const y = panelY + GRID_TOP + row * (ENTRY_HEIGHT + ENTRY_GAP);
      const isUnlocked = unlocked.has(id);

      const box = scene.add
        .rectangle(
          x,
          y,
          ENTRY_WIDTH,
          ENTRY_HEIGHT,
          isUnlocked ? 0x141824 : 0x0b0d12,
          isUnlocked ? 0.95 : 0.8
        )
        .setOrigin(0, 0)
        .setStrokeStyle(isUnlocked ? 2 : 1, isUnlocked ? 0x6b6350 : 0x2a2f3a);
      entries.push(box);

      if (isUnlocked) {
        const definition = ACHIEVEMENTS[id];
        entries.push(
          scene.add.text(x + 10, y + 7, definition.name, {
            color: UNLOCKED_NAME_COLOR,
            fontFamily: UI_FONT_FAMILY,
            fontSize: "13px"
          })
        );
        entries.push(
          scene.add.text(x + 10, y + 28, definition.flavor, {
            color: "#a9b0ba",
            fontFamily: UI_FONT_FAMILY,
            fontSize: "10px"
          })
        );
      } else {
        // 未解除は名を伏せた靄(条件・フレーバーも出さない)
        entries.push(
          scene.add
            .text(x + ENTRY_WIDTH / 2, y + ENTRY_HEIGHT / 2, "……", {
              color: "#4a505c",
              fontFamily: UI_FONT_FAMILY,
              fontSize: "14px"
            })
            .setOrigin(0.5)
        );
      }
    });

    const footer = scene.add.text(panelX + 20, panelY + PANEL_HEIGHT - 28, "K / Esc でとじる", {
      color: "#6f7684",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "13px"
    });

    this.container = scene.add.container(0, 0, [background, title, header, ...entries, footer]);
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
