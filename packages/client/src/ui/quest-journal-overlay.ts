import Phaser from "phaser";

import type { SnapshotView, SubQuestView } from "@dreaming-engine/shared";

import { UI_FONT_FAMILY } from "./font.js";

export interface QuestJournalOverlayOptions {
  snapshot: SnapshotView;
}

const PANEL_WIDTH = 640;
const PANEL_HEIGHT = 420;

/** 受注中サブクエストの状態表示(proposed/reported は subQuests に載らない) */
const STATUS_LABELS: Record<string, string> = {
  active: "進行中",
  completed: "達成・報告待ち"
};

/**
 * クエストジャーナル(受注中サブクエストの一覧。読み取り専用)。
 * 探索中に Q で開閉し、Esc で閉じる(開閉は探索シーンが管理する)。
 * 表示内容はサーバー正本のスナップショット subQuests が正。
 */
export class QuestJournalOverlay {
  private readonly scene: Phaser.Scene;

  private readonly container: Phaser.GameObjects.Container;

  private readonly bodyText: Phaser.GameObjects.Text;

  private destroyed = false;

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: QuestJournalOverlayOptions
  ) {
    this.scene = scene;
    const panelX = Math.round((scene.scale.width - PANEL_WIDTH) / 2);
    const panelY = Math.round((scene.scale.height - PANEL_HEIGHT) / 2);

    const background = scene.add
      .rectangle(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, 0x0b0d12, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x6b6350);

    const title = scene.add.text(panelX + 20, panelY + 14, "クエストジャーナル", {
      color: "#d8c98f",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "20px"
    });

    this.bodyText = scene.add.text(panelX + 20, panelY + 54, this.describe(options.snapshot.subQuests), {
      color: "#f1eee4",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "15px",
      wordWrap: { width: PANEL_WIDTH - 40, useAdvancedWrap: true },
      lineSpacing: 5
    });

    const footer = scene.add.text(panelX + 20, panelY + PANEL_HEIGHT - 30, "Esc / Q でとじる", {
      color: "#6f7684",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "13px"
    });

    this.container = scene.add.container(0, 0, [background, title, this.bodyText, footer]);
    parentLayer.add(this.container);
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.container.destroy(true);
  }

  private describe(subQuests: readonly SubQuestView[]): string {
    if (subQuests.length === 0) {
      return "受注中の依頼はない。\n\n情報屋(カイ)に「仕事はあるか」と尋ねてみよう。";
    }
    return subQuests.map((quest) => this.describeQuest(quest)).join("\n\n");
  }

  private describeQuest(quest: SubQuestView): string {
    const kind = quest.type === "hunt" ? "討伐" : "調達";
    const status = STATUS_LABELS[quest.status] ?? quest.status;
    const objective =
      quest.type === "hunt"
        ? `${quest.targetName} を ${quest.progress}/${quest.count} 討伐`
        : `${quest.targetName} を ${quest.count}個 集めて情報屋へ報告`;
    const reward =
      quest.rewardItem !== undefined
        ? `${quest.rewardGold}G と ${quest.rewardItem.name}`
        : `${quest.rewardGold}G`;
    return `【${kind}・${status}】${quest.title}\n  ${objective}\n  報酬 ${reward}\n  ${quest.description}`;
  }
}
