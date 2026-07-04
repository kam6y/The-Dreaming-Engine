import Phaser from "phaser";

import type { ItemId, SnapshotView } from "@dreaming-engine/shared";

import { MenuList } from "./menu-list.js";

export interface InventoryOverlayOptions {
  snapshot: SnapshotView;
  /** 使用要求(1個)。結果は snapshot / dialog / server-error で返る */
  onUse: (itemId: ItemId) => void;
  /** 破棄要求(1個) */
  onDiscard: (itemId: ItemId) => void;
  /** Esc / とじる で閉じる */
  onClose: () => void;
}

const PANEL_WIDTH = 560;
const PANEL_HEIGHT = 400;
const LIST_WIDTH = 340;

/**
 * もちものオーバーレイ(Escで開閉)。
 * - 所持品はサーバー正本(snapshot)の inventory / questItems を表示する
 * - 「使う」「すてる」は1個ずつサーバーへ要求し、結果の snapshot で表示を更新する
 * - クエスト用アイテムは別枠表示で、使う/すてるの対象にならない(選択不可)
 */
export class InventoryOverlay {
  private readonly scene: Phaser.Scene;

  private readonly parentLayer: Phaser.GameObjects.Container;

  private readonly options: InventoryOverlayOptions;

  private readonly container: Phaser.GameObjects.Container;

  private readonly headerText: Phaser.GameObjects.Text;

  private readonly messageText: Phaser.GameObjects.Text;

  private snapshot: SnapshotView;

  private listMenu: MenuList | null = null;

  private actionMenu: MenuList | null = null;

  private readonly panelX: number;

  private readonly panelY: number;

  private destroyed = false;

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: InventoryOverlayOptions
  ) {
    this.scene = scene;
    this.parentLayer = parentLayer;
    this.options = options;
    this.snapshot = options.snapshot;

    this.panelX = Math.round((scene.scale.width - PANEL_WIDTH) / 2);
    this.panelY = Math.round((scene.scale.height - PANEL_HEIGHT) / 2);

    const background = scene.add
      .rectangle(this.panelX, this.panelY, PANEL_WIDTH, PANEL_HEIGHT, 0x0b0d12, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x6b6350);

    const title = scene.add.text(this.panelX + 20, this.panelY + 14, "もちもの", {
      color: "#d8c98f",
      fontFamily: "serif",
      fontSize: "20px"
    });

    this.headerText = scene.add.text(this.panelX + 20, this.panelY + 48, "", {
      color: "#a9b0ba",
      fontFamily: "serif",
      fontSize: "15px"
    });

    this.messageText = scene.add.text(
      this.panelX + 20,
      this.panelY + PANEL_HEIGHT - 56,
      "",
      {
        color: "#f1eee4",
        fontFamily: "serif",
        fontSize: "15px",
        wordWrap: { width: PANEL_WIDTH - 40, useAdvancedWrap: true },
        lineSpacing: 4
      }
    );

    this.container = scene.add.container(0, 0, [background, title, this.headerText, this.messageText]);
    parentLayer.add(this.container);

    this.updateHeader();
    this.rebuildList();
  }

  /** 下部の通知行にメッセージを表示する(使用・破棄の結果・エラー) */
  public showMessage(text: string): void {
    this.messageText.setText(text);
  }

  /** snapshot 更新の反映(所持数・リストの再構築) */
  public refresh(snapshot: SnapshotView): void {
    this.snapshot = snapshot;
    this.updateHeader();
    // アクション選択中に個数が変わることはない(要求は選択直後に送られる)ため、
    // リスト表示中のみ再構築する
    if (this.actionMenu === null) {
      this.rebuildList();
    }
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.listMenu?.destroy();
    this.actionMenu?.destroy();
    this.container.destroy(true);
  }

  private updateHeader(): void {
    const view = this.snapshot;
    this.headerText.setText(
      `持ち物 ${view.inventoryUsed}/${view.inventoryCapacity}    所持金 ${view.player.gold}G`
    );
  }

  /** 品目リストを(再)構築する。カーソル位置は維持する */
  private rebuildList(): void {
    const keepIndex = this.listMenu?.currentIndex ?? 0;
    this.listMenu?.destroy();

    const stacks = [
      ...this.snapshot.inventory.map((stack) => ({
        id: stack.itemId,
        label: `${stack.name} ×${stack.count}`
      })),
      // クエスト用アイテムは別枠(使う/すてる不可)。存在の確認用に表示だけする
      ...this.snapshot.questItems.map((stack) => ({
        id: `quest:${stack.itemId}`,
        label: `${stack.name} ×${stack.count}(大事なもの)`,
        disabled: true
      }))
    ];
    const items =
      stacks.length > 0
        ? stacks
        : [{ id: "empty", label: "(何も持っていない)", disabled: true }];

    this.listMenu = new MenuList(this.scene, this.parentLayer, {
      items,
      x: this.panelX + 20,
      y: this.panelY + 80,
      width: LIST_WIDTH,
      initialIndex: keepIndex,
      onSelect: (id) => {
        this.openActionMenu(id as ItemId);
      },
      onCancel: () => {
        this.options.onClose();
      }
    });
    // 呼び出し元のkeydownと同一イベントでの二重発火を避けるため次tickで受付開始
    this.scene.time.delayedCall(0, () => {
      if (!this.destroyed && this.actionMenu === null) {
        this.listMenu?.activate();
      }
    });
  }

  /** 使う/すてる/やめる のアクション選択 */
  private openActionMenu(itemId: ItemId): void {
    this.listMenu?.deactivate();
    this.actionMenu = new MenuList(this.scene, this.parentLayer, {
      items: [
        { id: "use", label: "使う" },
        { id: "discard", label: "すてる" },
        { id: "cancel", label: "やめる" }
      ],
      x: this.panelX + LIST_WIDTH + 36,
      y: this.panelY + 80,
      width: 150,
      onSelect: (id) => {
        this.closeActionMenu();
        if (id === "use") {
          this.options.onUse(itemId);
        } else if (id === "discard") {
          this.options.onDiscard(itemId);
        }
      },
      onCancel: () => {
        this.closeActionMenu();
      }
    });
    this.scene.time.delayedCall(0, () => {
      if (!this.destroyed) {
        this.actionMenu?.activate();
      }
    });
  }

  private closeActionMenu(): void {
    this.actionMenu?.destroy();
    this.actionMenu = null;
    // リストへ戻る(内容が変わっている可能性があるため組み直す)
    this.rebuildList();
  }
}
