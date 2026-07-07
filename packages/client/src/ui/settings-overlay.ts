import Phaser from "phaser";

import {
  getBgmVolume,
  getSeVolume,
  isMuted,
  setBgmVolume,
  setSeVolume,
  toggleMuted
} from "../audio.js";
import { UI_FONT_FAMILY } from "./font.js";
import { MenuList, menuListHeight } from "./menu-list.js";

export interface SettingsOverlayOptions {
  /** Esc / とじる で閉じる */
  onClose: () => void;
}

const PANEL_WIDTH = 420;
/** 音量の巡回ステップ(決定のたびに1段下がり、0の次は100へ戻る) */
const VOLUME_STEPS = [1.0, 0.8, 0.6, 0.4, 0.2, 0] as const;

/** 現在値に最も近いステップの添字(表示・巡回の基準) */
function nearestStepIndex(volume: number): number {
  let best = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  VOLUME_STEPS.forEach((step, i) => {
    const diff = Math.abs(step - volume);
    if (diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  });
  return best;
}

/** 次のステップ音量(1段下げ。0まで来たら100へ戻る) */
function nextStepVolume(volume: number): number {
  const index = nearestStepIndex(volume);
  const next = VOLUME_STEPS[(index + 1) % VOLUME_STEPS.length];
  return next ?? 0;
}

/**
 * 音量・ミュートの設定オーバーレイ(M12-3。タイトルメニュー「設定」から開く)。
 * 各項目は決定(スペース/Enter)で変更する: 音量は20%刻みで巡回、ミュートはトグル。
 * 設定は audio.ts が localStorage へ永続化し、再生中のBGMへ即時反映される。
 */
export class SettingsOverlay {
  private readonly scene: Phaser.Scene;

  private readonly parentLayer: Phaser.GameObjects.Container;

  private readonly options: SettingsOverlayOptions;

  private readonly container: Phaser.GameObjects.Container;

  private menu: MenuList | null = null;

  private readonly panelX: number;

  private readonly panelY: number;

  private destroyed = false;

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: SettingsOverlayOptions
  ) {
    this.scene = scene;
    this.parentLayer = parentLayer;
    this.options = options;

    const panelHeight = menuListHeight(4) + 72;
    this.panelX = Math.round((scene.scale.width - PANEL_WIDTH) / 2);
    this.panelY = Math.round((scene.scale.height - panelHeight) / 2);

    const background = scene.add
      .rectangle(this.panelX, this.panelY, PANEL_WIDTH, panelHeight, 0x0b0d12, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x6b6350);

    const title = scene.add.text(this.panelX + 20, this.panelY + 14, "設定", {
      color: "#d8c98f",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "20px"
    });

    this.container = scene.add.container(0, 0, [background, title]);
    parentLayer.add(this.container);

    this.rebuildMenu();
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.menu?.destroy();
    this.container.destroy(true);
  }

  /** 現在の設定値でメニューを組み直す(カーソル位置は維持) */
  private rebuildMenu(): void {
    const keepIndex = this.menu?.currentIndex ?? 0;
    this.menu?.destroy();
    this.menu = new MenuList(this.scene, this.parentLayer, {
      items: [
        { id: "bgm", label: `BGM音量  ${Math.round(getBgmVolume() * 100)}%` },
        { id: "se", label: `効果音音量  ${Math.round(getSeVolume() * 100)}%` },
        { id: "mute", label: `ミュート  ${isMuted() ? "オン" : "オフ"}` },
        { id: "close", label: "とじる" }
      ],
      x: this.panelX + 20,
      y: this.panelY + 52,
      width: PANEL_WIDTH - 40,
      initialIndex: keepIndex,
      onSelect: (id) => {
        this.onSelect(id);
      },
      onCancel: () => {
        this.options.onClose();
      }
    });
    // 呼び出し元のkeydownと同一イベントでの二重発火を避けるため次tickで受付開始
    this.scene.time.delayedCall(0, () => {
      if (!this.destroyed) {
        this.menu?.activate();
      }
    });
  }

  private onSelect(id: string): void {
    if (id === "close") {
      this.options.onClose();
      return;
    }
    if (id === "bgm") {
      setBgmVolume(nextStepVolume(getBgmVolume()));
    } else if (id === "se") {
      setSeVolume(nextStepVolume(getSeVolume()));
    } else if (id === "mute") {
      toggleMuted();
    }
    // 変更後の値をラベルへ反映する(BGMは audio.ts 側で再生中の音へ即時反映済み)
    this.rebuildMenu();
  }
}
