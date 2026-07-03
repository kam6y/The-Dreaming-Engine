import Phaser from "phaser";

import { GAME_TITLE } from "@dreaming-engine/shared";

import { initializeRun } from "../game-state.js";

/**
 * タイトル画面。
 * M1時点では「新規ゲーム」のみ(「つづきから」はM3で追加)。
 * Enter / スペースで探索シーンを開始する。
 * スケールモードRESIZEのため、リサイズ時に中央へ再配置する。
 */
export class TitleScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;

  private subtitleText!: Phaser.GameObjects.Text;

  private startText!: Phaser.GameObjects.Text;

  public constructor() {
    super("title");
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#000000");

    this.titleText = this.add
      .text(0, 0, GAME_TITLE, {
        color: "#f1eee4",
        fontFamily: "serif",
        fontSize: "44px"
      })
      .setOrigin(0.5);
    this.subtitleText = this.add
      .text(0, 0, "夢見る機関は、まだ微かに動いている。", {
        color: "#a9b0ba",
        fontFamily: "serif",
        fontSize: "20px"
      })
      .setOrigin(0.5);
    this.startText = this.add
      .text(0, 0, "▶ 新規ゲーム(Enter)", {
        color: "#d8c98f",
        fontFamily: "serif",
        fontSize: "24px"
      })
      .setOrigin(0.5);

    this.layout();

    this.tweens.add({
      targets: this.startText,
      alpha: 0.45,
      duration: 900,
      yoyo: true,
      repeat: -1
    });

    const startGame = (): void => {
      initializeRun(this.game);
      this.scene.start("exploration");
    };

    this.input.keyboard?.on("keydown-ENTER", startGame);
    this.input.keyboard?.on("keydown-SPACE", startGame);

    const onResize = (): void => {
      this.layout();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  private layout(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    this.titleText.setPosition(centerX, centerY - 56);
    this.subtitleText.setPosition(centerX, centerY + 4);
    this.startText.setPosition(centerX, centerY + 114);
  }
}
