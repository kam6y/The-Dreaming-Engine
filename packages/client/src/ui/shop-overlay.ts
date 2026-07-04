import Phaser from "phaser";

import {
  ITEMS,
  sellPriceOf,
  type ActiveInteraction,
  type ItemId,
  type SnapshotView
} from "@dreaming-engine/shared";

import { MenuList } from "./menu-list.js";

type ShopInteraction = Extract<ActiveInteraction, { kind: "shop" }>;

export interface ShopOverlayOptions {
  interaction: ShopInteraction;
  snapshot: SnapshotView;
  /** 購入要求(1個)。結果は snapshot / dialog / server-error で返る */
  onBuy: (itemId: ItemId) => void;
  /** 売却要求(1個) */
  onSell: (itemId: ItemId) => void;
  /** 「やめる」/ Esc で閉じる */
  onClose: () => void;
}

const PANEL_WIDTH = 640;
const PANEL_HEIGHT = 400;
const LIST_WIDTH = 380;

type ShopMode = "root" | "buy" | "sell";

/**
 * 商店オーバーレイ(購入・売却)。
 * - 在庫はサーバーの interaction(shop)の stock、所持品・所持金は snapshot が正
 * - 買う/売るは1個ずつサーバーへ要求し、結果の snapshot で表示を更新する
 * - 満杯・金不足などの拒否は server-error のメッセージを下部の通知行に表示する
 */
export class ShopOverlay {
  private readonly scene: Phaser.Scene;

  private readonly parentLayer: Phaser.GameObjects.Container;

  private readonly options: ShopOverlayOptions;

  private readonly container: Phaser.GameObjects.Container;

  private readonly headerText: Phaser.GameObjects.Text;

  private readonly messageText: Phaser.GameObjects.Text;

  private snapshot: SnapshotView;

  private mode: ShopMode = "root";

  private rootMenu: MenuList | null = null;

  private listMenu: MenuList | null = null;

  private readonly panelX: number;

  private readonly panelY: number;

  private destroyed = false;

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: ShopOverlayOptions
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

    const title = scene.add.text(
      this.panelX + 20,
      this.panelY + 14,
      `商店 — ${options.interaction.npcName}`,
      {
        color: "#d8c98f",
        fontFamily: "serif",
        fontSize: "20px"
      }
    );

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
    this.openRootMenu();
  }

  /** 下部の通知行にメッセージを表示する(挨拶・売買結果・エラー) */
  public showMessage(text: string): void {
    this.messageText.setText(text);
  }

  /** snapshot 更新の反映(所持金・所持数・リストの再構築) */
  public refresh(snapshot: SnapshotView): void {
    this.snapshot = snapshot;
    this.updateHeader();
    if (this.mode === "buy") {
      this.rebuildList("buy");
    } else if (this.mode === "sell") {
      this.rebuildList("sell");
    }
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.rootMenu?.destroy();
    this.listMenu?.destroy();
    this.container.destroy(true);
  }

  private updateHeader(): void {
    const view = this.snapshot;
    this.headerText.setText(
      `所持金 ${view.player.gold}G    持ち物 ${view.inventoryUsed}/${view.inventoryCapacity}`
    );
  }

  private openRootMenu(): void {
    this.listMenu?.destroy();
    this.listMenu = null;
    this.rootMenu?.destroy();
    this.mode = "root";
    this.rootMenu = new MenuList(this.scene, this.parentLayer, {
      items: [
        { id: "buy", label: "買う" },
        { id: "sell", label: "売る" },
        { id: "close", label: "やめる" }
      ],
      x: this.panelX + 20,
      y: this.panelY + 80,
      width: 160,
      onSelect: (id) => {
        if (id === "close") {
          this.options.onClose();
          return;
        }
        this.rootMenu?.deactivate();
        this.rebuildList(id === "buy" ? "buy" : "sell");
      },
      onCancel: () => {
        this.options.onClose();
      }
    });
    // 呼び出し元のkeydownと同一イベントでの二重発火を避けるため次tickで受付開始
    this.scene.time.delayedCall(0, () => {
      if (!this.destroyed && this.mode === "root") {
        this.rootMenu?.activate();
      }
    });
  }

  /** 買う/売るの品目リストを(再)構築する。カーソル位置は維持する */
  private rebuildList(mode: "buy" | "sell"): void {
    const keepIndex = this.mode === mode ? (this.listMenu?.currentIndex ?? 0) : 0;
    this.listMenu?.destroy();
    this.mode = mode;

    const items = mode === "buy" ? this.buildBuyItems() : this.buildSellItems();
    if (items.length === 0) {
      // 売るものが無い場合はモード選択へ戻す
      this.showMessage("売れるものは持っていない。");
      this.openRootMenu();
      return;
    }

    this.listMenu = new MenuList(this.scene, this.parentLayer, {
      items,
      x: this.panelX + 220,
      y: this.panelY + 80,
      width: LIST_WIDTH,
      initialIndex: keepIndex,
      onSelect: (id) => {
        const itemId = id as ItemId;
        if (mode === "buy") {
          this.options.onBuy(itemId);
        } else {
          this.options.onSell(itemId);
        }
      },
      onCancel: () => {
        this.openRootMenu();
      }
    });
    this.scene.time.delayedCall(0, () => {
      if (!this.destroyed && this.mode === mode) {
        this.listMenu?.activate();
      }
    });
  }

  private buildBuyItems(): { id: string; label: string; disabled?: boolean }[] {
    return this.options.interaction.stock.map((entry) => {
      const owned = this.snapshot.inventory.find((s) => s.itemId === entry.itemId)?.count ?? 0;
      return {
        id: entry.itemId,
        label: `${entry.name}  ${entry.buyPrice}G(所持${owned})`
      };
    });
  }

  private buildSellItems(): { id: string; label: string; disabled?: boolean }[] {
    // クエスト用アイテムは別枠(questItems)のためここには現れない=売却対象は inventory 全件
    return this.snapshot.inventory.map((stack) => ({
      id: stack.itemId,
      label: `${ITEMS[stack.itemId].name} ×${stack.count}  売値${sellPriceOf(stack.itemId)}G`
    }));
  }
}
