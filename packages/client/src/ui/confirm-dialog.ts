import Phaser from "phaser";

import { MenuList } from "./menu-list.js";

export interface ConfirmDialogOptions {
  /** 問いかけの本文 */
  message: string;
  /** はい側のラベル(既定「はい」) */
  yesLabel?: string;
  /** いいえ側のラベル(既定「いいえ」) */
  noLabel?: string;
  onResult: (yes: boolean) => void;
}

const WIDTH = 420;

/**
 * はい/いいえの確認ダイアログ(画面中央)。
 * 新規ゲームの上書き確認・宿泊確認などで共用する。
 * Escは「いいえ」扱い。
 */
export class ConfirmDialog {
  private readonly container: Phaser.GameObjects.Container;

  private readonly menu: MenuList;

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: ConfirmDialogOptions
  ) {
    const centerX = scene.scale.width / 2;
    const centerY = scene.scale.height / 2;

    const text = scene.add
      .text(0, 0, options.message, {
        color: "#f1eee4",
        fontFamily: "serif",
        fontSize: "18px",
        align: "center",
        // 日本語(スペース区切りなし)を折り返すため useAdvancedWrap を使う
        wordWrap: { width: WIDTH - 48, useAdvancedWrap: true },
        lineSpacing: 6
      })
      .setOrigin(0.5, 0);

    const textHeight = text.height;
    const boxHeight = textHeight + 48;

    const background = scene.add
      .rectangle(0, -24, WIDTH, boxHeight, 0x0b0d12, 0.96)
      .setOrigin(0.5, 0)
      .setStrokeStyle(2, 0x6b6350);

    this.container = scene.add.container(centerX, centerY - boxHeight / 2 - 40, [
      background,
      text
    ]);
    parentLayer.add(this.container);

    const finish = (yes: boolean): void => {
      this.destroy();
      options.onResult(yes);
    };

    this.menu = new MenuList(scene, parentLayer, {
      items: [
        { id: "yes", label: options.yesLabel ?? "はい" },
        { id: "no", label: options.noLabel ?? "いいえ" }
      ],
      x: centerX - 90,
      y: centerY + boxHeight / 2 - 20,
      width: 180,
      onSelect: (id) => {
        finish(id === "yes");
      },
      onCancel: () => {
        finish(false);
      }
    });

    // 呼び出し元のkeydownと同一イベントでの二重発火を避けるため次tickで受付開始
    scene.time.delayedCall(0, () => {
      this.menu.activate();
    });
  }

  public destroy(): void {
    this.menu.destroy();
    this.container.destroy(true);
  }
}
