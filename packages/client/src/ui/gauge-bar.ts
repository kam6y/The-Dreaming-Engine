import Phaser from "phaser";

export interface GaugeBarOptions {
  x: number;
  y: number;
  width: number;
  label: string;
  barColor: number;
  max: number;
  value: number;
}

const BAR_HEIGHT = 10;
const LABEL_WIDTH = 34;

/** HP/MP等のゲージバー(ラベル+バー+数値)。setValueで更新する。 */
export class GaugeBar {
  private readonly barWidth: number;

  private readonly fill: Phaser.GameObjects.Rectangle;

  private readonly valueText: Phaser.GameObjects.Text;

  private max: number;

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: GaugeBarOptions
  ) {
    this.max = options.max;
    this.barWidth = options.width - LABEL_WIDTH - 64;

    const label = scene.add.text(0, -2, options.label, {
      color: "#a9b0ba",
      fontFamily: "serif",
      fontSize: "14px"
    });

    const track = scene.add
      .rectangle(LABEL_WIDTH, 0, this.barWidth, BAR_HEIGHT, 0x1c1f27)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x6b6350);

    this.fill = scene.add
      .rectangle(LABEL_WIDTH + 1, 1, this.barWidth - 2, BAR_HEIGHT - 2, options.barColor)
      .setOrigin(0, 0);

    this.valueText = scene.add
      .text(LABEL_WIDTH + this.barWidth + 8, -2, "", {
        color: "#f1eee4",
        fontFamily: "serif",
        fontSize: "14px"
      })
      .setOrigin(0, 0);

    const container = scene.add.container(options.x, options.y, [
      label,
      track,
      this.fill,
      this.valueText
    ]);
    parentLayer.add(container);

    this.setValue(options.value, options.max);
  }

  public setValue(value: number, max?: number): void {
    if (max !== undefined) {
      this.max = max;
    }
    const clamped = Math.max(0, Math.min(value, this.max));
    const ratio = this.max > 0 ? clamped / this.max : 0;
    this.fill.width = Math.max(0, (this.barWidth - 2) * ratio);
    this.valueText.setText(`${clamped}/${this.max}`);
  }
}
