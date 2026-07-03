import Phaser from "phaser";

export interface MenuListOptions {
  /** メニュー項目(表示順) */
  items: readonly { id: string; label: string; disabled?: boolean }[];
  x: number;
  y: number;
  width: number;
  /** 決定時(スペース/Enter) */
  onSelect: (id: string) => void;
  /** キャンセル時(Esc)。省略時はキャンセル不可 */
  onCancel?: () => void;
}

const ROW_HEIGHT = 30;
const PADDING = 12;

/**
 * カーソル選択式の縦メニュー(戦闘コマンド・スキル/どうぐ選択・タイトル等で共用)。
 * 上下キーでカーソル移動、スペース/Enterで決定、Escでキャンセル。
 * キーリスナーはactivate/deactivateで明示的に付け外しする
 * (シーン内に複数メニューがある場合の競合を防ぐ)。
 */
export class MenuList {
  private readonly scene: Phaser.Scene;

  private readonly options: MenuListOptions;

  private container: Phaser.GameObjects.Container;

  private cursor: Phaser.GameObjects.Text;

  private rowTexts: Phaser.GameObjects.Text[] = [];

  private index = 0;

  private active = false;

  private readonly keyHandlers: { event: string; handler: () => void }[] = [];

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: MenuListOptions
  ) {
    this.scene = scene;
    this.options = options;

    const height = options.items.length * ROW_HEIGHT + PADDING * 2;
    const background = scene.add
      .rectangle(0, 0, options.width, height, 0x0b0d12, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x6b6350);

    const children: Phaser.GameObjects.GameObject[] = [background];
    options.items.forEach((item, i) => {
      const text = scene.add.text(PADDING + 22, PADDING + i * ROW_HEIGHT, item.label, {
        color: item.disabled === true ? "#5c6068" : "#f1eee4",
        fontFamily: "serif",
        fontSize: "18px"
      });
      this.rowTexts.push(text);
      children.push(text);
    });

    this.cursor = scene.add.text(PADDING, PADDING, "▶", {
      color: "#d8c98f",
      fontFamily: "serif",
      fontSize: "18px"
    });
    children.push(this.cursor);

    this.container = scene.add.container(options.x, options.y, children).setVisible(false);
    parentLayer.add(this.container);

    // 最初の有効項目にカーソルを合わせる
    this.index = Math.max(
      0,
      options.items.findIndex((i) => i.disabled !== true)
    );
    this.updateCursor();
  }

  public get isActive(): boolean {
    return this.active;
  }

  /** メニューを表示してキー入力の受付を開始する */
  public activate(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    this.container.setVisible(true);

    const keyboard = this.scene.input.keyboard;
    if (keyboard === null) {
      return;
    }
    const on = (event: string, handler: () => void): void => {
      keyboard.on(event, handler);
      this.keyHandlers.push({ event, handler });
    };
    on("keydown-UP", () => {
      this.move(-1);
    });
    on("keydown-W", () => {
      this.move(-1);
    });
    on("keydown-DOWN", () => {
      this.move(1);
    });
    on("keydown-S", () => {
      this.move(1);
    });
    const select = (): void => {
      const item = this.options.items[this.index];
      if (item !== undefined && item.disabled !== true) {
        this.options.onSelect(item.id);
      }
    };
    on("keydown-SPACE", select);
    on("keydown-ENTER", select);
    if (this.options.onCancel !== undefined) {
      const cancel = this.options.onCancel;
      on("keydown-ESC", () => {
        cancel();
      });
    }
  }

  /** キー入力の受付を止めてメニューを隠す */
  public deactivate(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.container.setVisible(false);
    const keyboard = this.scene.input.keyboard;
    if (keyboard !== null) {
      for (const { event, handler } of this.keyHandlers) {
        keyboard.off(event, handler);
      }
    }
    this.keyHandlers.length = 0;
  }

  public destroy(): void {
    this.deactivate();
    this.container.destroy(true);
  }

  private move(delta: number): void {
    const count = this.options.items.length;
    if (count === 0) {
      return;
    }
    // 無効項目はスキップして次の有効項目へ
    for (let step = 1; step <= count; step += 1) {
      const next = (this.index + delta * step + count * step) % count;
      if (this.options.items[next]?.disabled !== true) {
        this.index = next;
        break;
      }
    }
    this.updateCursor();
  }

  private updateCursor(): void {
    this.cursor.setY(PADDING + this.index * ROW_HEIGHT);
  }
}
