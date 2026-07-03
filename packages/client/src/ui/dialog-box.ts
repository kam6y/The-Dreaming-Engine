import Phaser from "phaser";

const BOX_MARGIN = 16;
const BOX_HEIGHT = 128;
const PADDING = 16;

/**
 * 画面下部の会話・メッセージウィンドウ(M1のインタラクション枠組み)。
 * M4の会話UI(自由入力・選択肢)の土台になるプレースホルダー実装。
 * スペース / Enter で閉じる。
 */
export class DialogBox {
  private readonly scene: Phaser.Scene;

  /** UI専用カメラで描画されるレイヤー(ズームの影響を受けない) */
  private readonly parentLayer: Phaser.GameObjects.Container;

  private container: Phaser.GameObjects.Container | null = null;

  public constructor(scene: Phaser.Scene, parentLayer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.parentLayer = parentLayer;
  }

  public get isOpen(): boolean {
    return this.container !== null;
  }

  /** speaker が null のときは地の文(ナレーション)として表示する */
  public open(speaker: string | null, body: string): void {
    this.close();

    const width = this.scene.scale.width - BOX_MARGIN * 2;
    const x = BOX_MARGIN;
    const y = this.scene.scale.height - BOX_HEIGHT - BOX_MARGIN;

    const background = this.scene.add
      .rectangle(0, 0, width, BOX_HEIGHT, 0x0b0d12, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x6b6350);

    const children: Phaser.GameObjects.GameObject[] = [background];

    let textY = PADDING;
    if (speaker !== null) {
      const speakerText = this.scene.add.text(PADDING, textY, speaker, {
        color: "#d8c98f",
        fontFamily: "serif",
        fontSize: "18px"
      });
      children.push(speakerText);
      textY += 28;
    }

    const bodyText = this.scene.add.text(PADDING, textY, body, {
      color: "#f1eee4",
      fontFamily: "serif",
      fontSize: "17px",
      wordWrap: { width: width - PADDING * 2 },
      lineSpacing: 6
    });
    children.push(bodyText);

    const hint = this.scene.add
      .text(width - PADDING, BOX_HEIGHT - 12, "▼ スペースで閉じる", {
        color: "#a9b0ba",
        fontFamily: "serif",
        fontSize: "13px"
      })
      .setOrigin(1, 1);
    children.push(hint);

    this.container = this.scene.add.container(x, y, children);
    this.parentLayer.add(this.container);
  }

  public close(): void {
    if (this.container !== null) {
      this.container.destroy(true);
      this.container = null;
    }
  }
}
