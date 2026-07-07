import Phaser from "phaser";

import { ITEMS, isEquipment } from "@dreaming-engine/shared";
import type { EquipmentSlot, ItemId, SnapshotView, ViewEquipmentSlot } from "@dreaming-engine/shared";

import { UI_FONT_FAMILY } from "./font.js";
import { MenuList } from "./menu-list.js";

export interface InventoryOverlayOptions {
  snapshot: SnapshotView;
  /** 使用要求(1個)。結果は snapshot / dialog / server-error で返る */
  onUse: (itemId: ItemId) => void;
  /** 破棄要求(1個) */
  onDiscard: (itemId: ItemId) => void;
  /** 装備要求(M8-4)。結果は snapshot / server-error で返る */
  onEquip: (itemId: ItemId) => void;
  /** 装備解除要求(M8-4) */
  onUnequip: (slot: EquipmentSlot) => void;
  /** Esc / とじる で閉じる */
  onClose: () => void;
}

/** 装備品のボーナス表記(武器=攻、防具=防)。装備品以外は空文字 */
function bonusLabelOf(itemId: ItemId): string {
  const def = ITEMS[itemId];
  if (def.slot === "weapon") {
    return `(攻+${def.atkBonus ?? 0})`;
  }
  if (def.slot === "armor") {
    return `(防+${def.defBonus ?? 0})`;
  }
  return "";
}

/** 装備スロット行のラベル(空スロットは「(なし)」) */
function slotRowLabel(prefix: string, equipped: ViewEquipmentSlot | null): string {
  if (equipped === null) {
    return `${prefix} (なし)`;
  }
  return `${prefix} ${equipped.name}${bonusLabelOf(equipped.itemId)}`;
}

const PANEL_WIDTH = 560;
const PANEL_HEIGHT = 400;
const LIST_WIDTH = 340;
/** リスト上端(パネル相対)。ヘッダー2行(所持枠/実効攻防)の下から始める */
const LIST_TOP = 104;

/**
 * もちものオーバーレイ(Escで開閉)。
 * - 所持品はサーバー正本(snapshot)の inventory / questItems を表示する
 * - 「使う」「すてる」は1個ずつサーバーへ要求し、結果の snapshot で表示を更新する
 * - クエスト用アイテムは別枠表示で、使う/すてるの対象にならない(選択不可)
 * - 装備(M8-4): リスト先頭に武器・防具のスロット行を置く(選択で「はずす」)。
 *   装備品アイテムのアクションには「そうびする」が付く。ヘッダーに実効攻防を表示する
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
      fontFamily: UI_FONT_FAMILY,
      fontSize: "20px"
    });

    this.headerText = scene.add.text(this.panelX + 20, this.panelY + 48, "", {
      color: "#a9b0ba",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "15px"
    });

    this.messageText = scene.add.text(
      this.panelX + 20,
      this.panelY + PANEL_HEIGHT - 56,
      "",
      {
        color: "#f1eee4",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "15px",
        wordWrap: { width: PANEL_WIDTH - 40, useAdvancedWrap: true },
        lineSpacing: 4
      }
    );

    // 操作ヒント(タイトル行の右肩。オーバーレイ間で表記を統一: M15-2)
    const hint = scene.add
      .text(this.panelX + PANEL_WIDTH - 16, this.panelY + 18, "スペース / Enter: 決定 ・ Esc: とじる", {
        color: "#a9b0ba",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "13px"
      })
      .setOrigin(1, 0);

    this.container = scene.add.container(0, 0, [background, title, this.headerText, this.messageText, hint]);
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
    // 1行目: 所持枠と所持金 / 2行目: 実効攻防(装備込み。M8-4)
    this.headerText.setText(
      `持ち物 ${view.inventoryUsed}/${view.inventoryCapacity}    所持金 ${view.player.gold}G\n` +
        `攻撃 ${view.player.effectiveAttack}    防御 ${view.player.effectiveDefense}`
    );
  }

  /** 品目リストを(再)構築する。カーソル位置は維持する */
  private rebuildList(): void {
    const keepIndex = this.listMenu?.currentIndex ?? 0;
    this.listMenu?.destroy();

    const equipment = this.snapshot.player.equipment;
    const stacks = [
      // 装備スロット行(M8-4)。選択で「はずす」。空スロットは選択不可
      {
        id: "slot:weapon",
        label: slotRowLabel("[武器]", equipment.weapon),
        disabled: equipment.weapon === null
      },
      {
        id: "slot:armor",
        label: slotRowLabel("[防具]", equipment.armor),
        disabled: equipment.armor === null
      },
      ...this.snapshot.inventory.map((stack) => ({
        id: stack.itemId,
        label: `${stack.name}${bonusLabelOf(stack.itemId)} ×${stack.count}`
      })),
      // クエスト用アイテムは別枠(使う/すてる不可)。存在の確認用に表示だけする
      ...this.snapshot.questItems.map((stack) => ({
        id: `quest:${stack.itemId}`,
        label: `${stack.name} ×${stack.count}(大事なもの)`,
        disabled: true
      }))
    ];
    if (this.snapshot.inventory.length === 0 && this.snapshot.questItems.length === 0) {
      stacks.push({ id: "empty", label: "(何も持っていない)", disabled: true });
    }

    this.listMenu = new MenuList(this.scene, this.parentLayer, {
      items: stacks,
      x: this.panelX + 20,
      y: this.panelY + LIST_TOP,
      width: LIST_WIDTH,
      initialIndex: keepIndex,
      onSelect: (id) => {
        if (id === "slot:weapon") {
          this.openSlotActionMenu("weapon");
          return;
        }
        if (id === "slot:armor") {
          this.openSlotActionMenu("armor");
          return;
        }
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

  /** アイテムのアクション選択(装備品は「そうびする」、消耗品は「使う」が先頭) */
  private openActionMenu(itemId: ItemId): void {
    this.listMenu?.deactivate();
    const actions = isEquipment(itemId)
      ? [
          { id: "equip", label: "そうびする" },
          { id: "discard", label: "すてる" },
          { id: "cancel", label: "やめる" }
        ]
      : [
          { id: "use", label: "使う" },
          { id: "discard", label: "すてる" },
          { id: "cancel", label: "やめる" }
        ];
    this.actionMenu = new MenuList(this.scene, this.parentLayer, {
      items: actions,
      x: this.panelX + LIST_WIDTH + 36,
      y: this.panelY + LIST_TOP,
      width: 150,
      onSelect: (id) => {
        this.closeActionMenu();
        if (id === "use") {
          this.options.onUse(itemId);
        } else if (id === "equip") {
          this.options.onEquip(itemId);
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

  /** 装備スロット行のアクション選択(はずす/やめる) */
  private openSlotActionMenu(slot: EquipmentSlot): void {
    this.listMenu?.deactivate();
    this.actionMenu = new MenuList(this.scene, this.parentLayer, {
      items: [
        { id: "unequip", label: "はずす" },
        { id: "cancel", label: "やめる" }
      ],
      x: this.panelX + LIST_WIDTH + 36,
      y: this.panelY + LIST_TOP,
      width: 150,
      onSelect: (id) => {
        this.closeActionMenu();
        if (id === "unequip") {
          this.options.onUnequip(slot);
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
