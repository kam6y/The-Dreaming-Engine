import Phaser from "phaser";

import type { MainQuestStage, SnapshotView, SubQuestView } from "@dreaming-engine/shared";

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
 * メインクエスト段階の現況1行(M18-3。全段階を網羅=テストで欠落を検知)。
 * 第2章(ch2-*)は開示の掟(world-lore.md 1.6: 地名・核心・フック#1の断定なし)に従い、
 * 次の行き先の示唆までに留める。
 */
export const MAIN_QUEST_JOURNAL: Record<MainQuestStage, string> = {
  arrival: "記憶を失い、灯町に流れ着いた。教会『灯守堂』の司祭が、何かを知っているようだ。",
  "rift-revealed":
    "夢の綻びの源は、裂け目の最深部に巣食う『夢喰い』。ダンジョンを降り、これを討つ。",
  "dream-eater-defeated": "夢喰いは崩れて消えた。灯は、わずかに戻りはじめている。",
  epilogue: "夢喰いとの戦いは終わり、街には静かな日々が戻った。……機関の夢には、まだ続きがある気がする。",
  "ch2-stirring":
    "灯還りの坑・導管の間の導管が、脈打ちはじめた。坑口の番人トワが、唄の続きを知っているかもしれない。",
  "ch2-vigil-song":
    "トワの唄は『灯の還る先』を語った。導管の間へ戻り、あの脈動にもう一度向き合おう。",
  "ch2-beyond":
    "確証を得た――機関の外に、まだ夢を紡ぐ何かがある。旅の続きは、まだ誰も歌っていない。"
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

    this.bodyText = scene.add.text(panelX + 20, panelY + 54, this.describe(options.snapshot), {
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

  private describe(snapshot: SnapshotView): string {
    // メインクエストの現況を先頭に常設する(M18-3。段階の正はサーバーの mainQuestStage)
    const main = `【メインクエスト】\n  ${MAIN_QUEST_JOURNAL[snapshot.mainQuestStage]}`;
    return `${main}\n\n${this.describeSubQuests(snapshot.subQuests)}`;
  }

  private describeSubQuests(subQuests: readonly SubQuestView[]): string {
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
