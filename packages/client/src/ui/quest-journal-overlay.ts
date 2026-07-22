import Phaser from "phaser";

import type { MainQuestStage, SnapshotView, SubQuestView } from "@dreaming-engine/shared";

import { UI_FONT_FAMILY } from "./font.js";

export interface QuestJournalOverlayOptions {
  snapshot: SnapshotView;
  /** 選択中サブクエストの報告(reportReady のときのみ呼ばれる。server の report-quest へ) */
  onReport: (questId: string) => void;
  /** 選択中サブクエストの放棄(確認はシーン側の ConfirmDialog が行う。server の abandon-quest へ) */
  onAbandon: (questId: string) => void;
}

const PANEL_WIDTH = 640;
const PANEL_HEIGHT = 420;

/** 受注中サブクエストの状態表示(proposed/reported は subQuests に載らない) */
const STATUS_LABELS: Record<string, string> = {
  active: "進行中",
  completed: "達成・報告待ち"
};

/** サブクエスト型の見出しラベル(M19-4。全5型を網羅=テストで欠落を検知) */
export const SUB_QUEST_KIND_LABELS: Record<SubQuestView["type"], string> = {
  hunt: "討伐",
  fetch: "調達",
  deliver: "配達",
  escort: "護衛",
  survey: "調査"
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

/** サブクエストの遂行内容1行(型別。ジャーナルの現況表示。M19-4) */
export function describeSubQuestObjective(quest: SubQuestView): string {
  switch (quest.type) {
    case "hunt":
      return `${quest.targetName} を ${quest.progress}/${quest.count} 討伐`;
    case "fetch":
      return `${quest.targetName} を ${quest.count}個 集めて情報屋へ報告`;
    case "deliver":
      return `${quest.targetName} へ 預かり品を届ける(×${quest.count})`;
    case "escort":
      return `${quest.targetName} まで連れを送り届ける`;
    case "survey":
      return `${quest.targetName} を調べる`;
  }
}

/**
 * クエストジャーナル(受注中サブクエストの一覧と報告・放棄の操作。M19-4)。
 * 探索中に Q で開閉し、Esc で閉じる(開閉は探索シーンが管理する)。
 * ↑↓ でサブクエストを選び、Enter で報告(reportReady のもののみ)、X で放棄
 * (放棄の確認と server への送信はシーン側 onReport/onAbandon の責務。
 * いずれの操作もシーンがジャーナルを閉じてから server の応答 dialog を表示する)。
 * 表示内容はサーバー正本のスナップショット subQuests が正。
 */
export class QuestJournalOverlay {
  private readonly scene: Phaser.Scene;

  private readonly options: QuestJournalOverlayOptions;

  private readonly container: Phaser.GameObjects.Container;

  private readonly bodyText: Phaser.GameObjects.Text;

  private readonly hintText: Phaser.GameObjects.Text;

  private readonly subQuests: readonly SubQuestView[];

  private cursor = 0;

  private keysActive = false;

  private destroyed = false;

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: QuestJournalOverlayOptions
  ) {
    this.scene = scene;
    this.options = options;
    this.subQuests = options.snapshot.subQuests;
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

    // 操作の結果ヒント(未達成の報告など、送らずに分かる注意をここへ出す)
    this.hintText = scene.add.text(panelX + 20, panelY + PANEL_HEIGHT - 52, "", {
      color: "#c9b98f",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "13px"
    });

    const footer = scene.add.text(panelX + 20, panelY + PANEL_HEIGHT - 30, this.footerHint(), {
      color: "#6f7684",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "13px"
    });

    this.container = scene.add.container(0, 0, [
      background,
      title,
      this.bodyText,
      this.hintText,
      footer
    ]);
    parentLayer.add(this.container);

    // Q 開閉と同一 keydown の二重発火を避けるため、次 tick からキー受付を始める
    scene.time.delayedCall(0, () => {
      if (!this.destroyed) {
        this.activateKeys();
      }
    });
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.deactivateKeys();
    this.container.destroy(true);
  }

  /** ↑↓(カーソル)・Enter(報告)・X(放棄)のキー受付。Q/Esc(閉じる)はシーン側が処理する */
  private activateKeys(): void {
    const keyboard = this.scene.input.keyboard;
    if (keyboard === null || this.keysActive) {
      return;
    }
    this.keysActive = true;
    keyboard.on("keydown-UP", this.onCursorUp, this);
    keyboard.on("keydown-DOWN", this.onCursorDown, this);
    keyboard.on("keydown-ENTER", this.onReportKey, this);
    keyboard.on("keydown-X", this.onAbandonKey, this);
  }

  private deactivateKeys(): void {
    const keyboard = this.scene.input.keyboard;
    if (keyboard === null || !this.keysActive) {
      return;
    }
    this.keysActive = false;
    keyboard.off("keydown-UP", this.onCursorUp, this);
    keyboard.off("keydown-DOWN", this.onCursorDown, this);
    keyboard.off("keydown-ENTER", this.onReportKey, this);
    keyboard.off("keydown-X", this.onAbandonKey, this);
  }

  private onCursorUp(): void {
    this.moveCursor(-1);
  }

  private onCursorDown(): void {
    this.moveCursor(1);
  }

  private moveCursor(delta: number): void {
    if (this.subQuests.length === 0) {
      return;
    }
    const next = this.cursor + delta;
    if (next < 0 || next >= this.subQuests.length) {
      return;
    }
    this.cursor = next;
    this.hintText.setText("");
    this.rerender();
  }

  private onReportKey(): void {
    const quest = this.selectedQuest();
    if (quest === undefined) {
      return;
    }
    if (!quest.reportReady) {
      // 未達成の報告は server へ送らずヒントで返す(判定の正は server の isReportReady = view.reportReady)
      this.hintText.setText("まだ報告できる首尾ではない。依頼を果たしてから、カイのもとへ。");
      return;
    }
    this.options.onReport(quest.id);
  }

  private onAbandonKey(): void {
    const quest = this.selectedQuest();
    if (quest === undefined) {
      return;
    }
    this.options.onAbandon(quest.id);
  }

  private selectedQuest(): SubQuestView | undefined {
    return this.subQuests[this.cursor];
  }

  private rerender(): void {
    this.bodyText.setText(this.describe(this.options.snapshot));
  }

  private footerHint(): string {
    if (this.subQuests.length === 0) {
      return "Esc / Q でとじる";
    }
    return "↑↓ えらぶ / Enter カイへ報告 / X あきらめる / Esc・Q とじる";
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
    return subQuests.map((quest, index) => this.describeQuest(quest, index)).join("\n\n");
  }

  private describeQuest(quest: SubQuestView, index: number): string {
    const kind = SUB_QUEST_KIND_LABELS[quest.type];
    const status = STATUS_LABELS[quest.status] ?? quest.status;
    // fetch は所持が揃うと active のまま報告可になる(達成表示と別に「報告可」を明示する)
    const ready = quest.reportReady && quest.status === "active" ? "・報告可" : "";
    const cursor = index === this.cursor ? "▶" : "　";
    const objective = describeSubQuestObjective(quest);
    const reward =
      quest.rewardItem !== undefined
        ? `${quest.rewardGold}G と ${quest.rewardItem.name}`
        : `${quest.rewardGold}G`;
    return `${cursor}【${kind}・${status}${ready}】${quest.title}\n  ${objective}\n  報酬 ${reward}\n  ${quest.description}`;
  }
}
