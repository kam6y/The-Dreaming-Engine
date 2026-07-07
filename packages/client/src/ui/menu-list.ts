import Phaser from "phaser";

import { playSe } from "../audio.js";
import { UI_FONT_FAMILY } from "./font.js";

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
  /**
   * 初期カーソル位置(省略時は先頭)。無効項目なら以降の有効項目へ送る。
   * リスト再構築(店の売買後の更新等)でカーソル位置を維持するために使う
   */
  initialIndex?: number;
}

const ROW_HEIGHT = 30;
const PADDING = 12;

/** 項目数に対するメニューの描画高さ(px)。呼び出し側の配置計算用(内部定数と一致を保つ) */
export function menuListHeight(itemCount: number): number {
  return itemCount * ROW_HEIGHT + PADDING * 2;
}

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
        fontFamily: UI_FONT_FAMILY,
        fontSize: "18px"
      });
      this.rowTexts.push(text);
      children.push(text);
    });

    this.cursor = scene.add.text(PADDING, PADDING, "▶", {
      color: "#d8c98f",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "18px"
    });
    children.push(this.cursor);

    this.container = scene.add.container(options.x, options.y, children).setVisible(false);
    parentLayer.add(this.container);

    // initialIndex(省略時は先頭)から数えて最初の有効項目にカーソルを合わせる
    const preferred = options.initialIndex ?? 0;
    let index = 0;
    for (let step = 0; step < options.items.length; step += 1) {
      const candidate = (preferred + step) % options.items.length;
      if (options.items[candidate]?.disabled !== true) {
        index = candidate;
        break;
      }
    }
    this.index = index;
    this.updateCursor();
  }

  public get isActive(): boolean {
    return this.active;
  }

  /** 現在のカーソル位置(リスト再構築時の位置維持用) */
  public get currentIndex(): number {
    return this.index;
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
        playSe(this.scene, "se-confirm");
        this.options.onSelect(item.id);
      }
    };
    on("keydown-SPACE", select);
    on("keydown-ENTER", select);
    if (this.options.onCancel !== undefined) {
      const cancel = this.options.onCancel;
      on("keydown-ESC", () => {
        playSe(this.scene, "se-cancel");
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

  /** リサイズ時などの再配置用 */
  public setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  private move(delta: number): void {
    const count = this.options.items.length;
    if (count === 0) {
      return;
    }
    const before = this.index;
    // 無効項目はスキップして次の有効項目へ
    for (let step = 1; step <= count; step += 1) {
      const next = (this.index + delta * step + count * step) % count;
      if (this.options.items[next]?.disabled !== true) {
        this.index = next;
        break;
      }
    }
    // 実際にカーソルが動いたときだけ鳴らす(有効項目が1つだけ等で不動の場合は無音)
    if (this.index !== before) {
      playSe(this.scene, "se-cursor");
    }
    this.updateCursor();
  }

  private updateCursor(): void {
    this.cursor.setY(PADDING + this.index * ROW_HEIGHT);
  }
}
