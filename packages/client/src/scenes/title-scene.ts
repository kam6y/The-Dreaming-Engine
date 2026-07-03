import Phaser from "phaser";

import { GAME_TITLE } from "@dreaming-engine/shared";

import { initializeRun } from "../game-state.js";
import { MenuList } from "../ui/menu-list.js";

/**
 * タイトル画面。「新規ゲーム」と「つづきから」のメニューを持つ。
 * 「つづきから」はサーバーのセーブ有無で有効化する(M3のサーバー配線で接続。
 * 配線されるまでは無効表示)。
 * スケールモードRESIZEのため、リサイズ時に中央へ再配置する。
 */
export class TitleScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;

  private subtitleText!: Phaser.GameObjects.Text;

  private menu!: MenuList;

  private uiLayer!: Phaser.GameObjects.Container;

  public constructor() {
    super("title");
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#000000");
    this.uiLayer = this.add.container(0, 0);

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

    this.menu = new MenuList(this, this.uiLayer, {
      items: [
        { id: "new-game", label: "新規ゲーム" },
        // M3のサーバー配線でセーブ有無に応じて有効化する
        { id: "continue", label: "つづきから", disabled: true }
      ],
      x: 0,
      y: 0,
      width: 240,
      onSelect: (id) => {
        this.onMenuSelected(id);
      }
    });

    this.layout();
    this.menu.activate();

    const onResize = (): void => {
      this.layout();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  private onMenuSelected(id: string): void {
    if (id === "new-game") {
      // 既存セーブがある場合の上書き確認はサーバー配線時に追加する
      this.startNewGame();
    }
  }

  private startNewGame(): void {
    this.menu.deactivate();
    initializeRun(this.game);
    this.scene.start("exploration");
  }

  private layout(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    this.titleText.setPosition(centerX, centerY - 96);
    this.subtitleText.setPosition(centerX, centerY - 36);
    this.menu.setPosition(centerX - 120, centerY + 48);
  }
}
