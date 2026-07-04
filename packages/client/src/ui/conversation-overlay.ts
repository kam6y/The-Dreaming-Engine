import Phaser from "phaser";

import type {
  ActiveInteraction,
  ConversationAction,
  PendingProposalView,
  SnapshotView
} from "@dreaming-engine/shared";

import { MenuList } from "./menu-list.js";
import { TextInputBox } from "./text-input-box.js";
import { TypewriterText } from "./typewriter-text.js";

type ConversationInteraction = Extract<ActiveInteraction, { kind: "conversation" }>;

export interface ConversationOverlayOptions {
  interaction: ConversationInteraction;
  snapshot: SnapshotView;
  /** 自由入力の送信(空・空白は送らない)。結果は ai-utterance / snapshot で返る */
  onSend: (text: string) => void;
  /** 提案中サブクエストの受諾/辞退 */
  onChoose: (choice: "accept" | "decline") => void;
  /** 情報屋への「仕事はあるか」 */
  onQuestRequest: () => void;
  /** 会話の終了(要約フローへ)。overlay を閉じる */
  onEnd: () => void;
}

const PANEL_WIDTH = 880;
const PANEL_HEIGHT = 300;
const MENU_WIDTH = 240;

/** アクション種別 → メニュー表示ラベルと表示順(server が options で可否を決める) */
const ACTION_LABELS: Record<ConversationAction, string> = {
  "quest-request": "仕事はあるか尋ねる",
  send: "話しかける",
  accept: "引き受ける",
  decline: "断る",
  end: "立ち去る"
};
const ACTION_ORDER: readonly ConversationAction[] = [
  "quest-request",
  "send",
  "accept",
  "decline",
  "end"
];

/**
 * 会話オーバーレイ(情報屋・司祭との会話)。
 * - NPC の発話は検証済み全文の ai-utterance(speak)を TypewriterText で疑似ストリーミング表示する
 *   (未検証テキストは表示しない: ai-guardrails.md 第4層)
 * - 取りうるアクションはサーバーの interaction.options が正(受諾/辞退は提案中のみ現れる)
 * - 「話しかける」は TextInputBox(IME 対応)で自由入力し、送信後は応答待ち状態にする
 * - 提案(pendingProposal)があれば内容を提示し、受諾/辞退を選べる
 */
export class ConversationOverlay {
  private readonly scene: Phaser.Scene;

  private readonly parentLayer: Phaser.GameObjects.Container;

  private readonly options: ConversationOverlayOptions;

  private readonly container: Phaser.GameObjects.Container;

  private readonly headerText: Phaser.GameObjects.Text;

  private readonly proposalText: Phaser.GameObjects.Text;

  private readonly hintText: Phaser.GameObjects.Text;

  private readonly utterance: TypewriterText;

  private readonly panelX: number;

  private readonly panelY: number;

  private interaction: ConversationInteraction;

  private menu: MenuList | null = null;

  private input: TextInputBox | null = null;

  /** 送信後、NPC の応答(ai-utterance)を待っている間は再送・メニューを止める */
  private awaiting = false;

  private destroyed = false;

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: ConversationOverlayOptions
  ) {
    this.scene = scene;
    this.parentLayer = parentLayer;
    this.options = options;
    this.interaction = options.interaction;

    this.panelX = Math.round((scene.scale.width - PANEL_WIDTH) / 2);
    this.panelY = scene.scale.height - PANEL_HEIGHT - 24;

    const background = scene.add
      .rectangle(this.panelX, this.panelY, PANEL_WIDTH, PANEL_HEIGHT, 0x0b0d12, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x6b6350);

    this.headerText = scene.add.text(
      this.panelX + 24,
      this.panelY + 16,
      this.interaction.npcName,
      { color: "#d8c98f", fontFamily: "serif", fontSize: "20px" }
    );

    // 発話本文(左カラム。メニュー幅を除いた領域に折り返す)
    const bodyWidth = PANEL_WIDTH - MENU_WIDTH - 72;
    this.utterance = new TypewriterText(scene, parentLayer, {
      x: this.panelX + 24,
      y: this.panelY + 56,
      width: bodyWidth,
      fontSize: "18px"
    });

    // 提案の内容(あるときだけ表示)
    this.proposalText = scene.add.text(this.panelX + 24, this.panelY + 168, "", {
      color: "#c9b98f",
      fontFamily: "serif",
      fontSize: "15px",
      wordWrap: { width: bodyWidth, useAdvancedWrap: true },
      lineSpacing: 4
    });

    // 下部のヒント/通知行(応答待ち・エラー等)
    this.hintText = scene.add.text(this.panelX + 24, this.panelY + PANEL_HEIGHT - 34, "", {
      color: "#a9b0ba",
      fontFamily: "serif",
      fontSize: "14px",
      wordWrap: { width: PANEL_WIDTH - 48, useAdvancedWrap: true }
    });

    this.container = scene.add.container(0, 0, [
      background,
      this.headerText,
      this.proposalText,
      this.hintText
    ]);
    parentLayer.add(this.container);

    this.updateProposal();
    this.rebuildMenu();
  }

  /**
   * 検証済み NPC 発話を再生する(scene が ai-utterance(speak)受信時に呼ぶ)。
   * 応答待ちを解除し、メニューを組み直す(受諾/辞退の可否が変わり得るため)。
   */
  public playUtterance(text: string): void {
    if (this.destroyed) {
      return;
    }
    this.awaiting = false;
    this.hintText.setText("");
    this.utterance.play(text);
  }

  /** interaction / snapshot 更新の反映(options・提案の変化) */
  public refresh(view: SnapshotView): void {
    if (this.destroyed) {
      return;
    }
    const interaction = view.interaction;
    if (interaction === undefined || interaction.kind !== "conversation") {
      return;
    }
    this.interaction = interaction;
    this.headerText.setText(interaction.npcName);
    this.updateProposal();
    // 入力中・応答待ちの間はメニューを組み直さない(状態を壊さない)
    if (this.input === null && !this.awaiting) {
      this.rebuildMenu();
    }
  }

  /** 下部の通知行にメッセージを表示する(server-error 等) */
  public showMessage(text: string): void {
    if (this.destroyed) {
      return;
    }
    this.awaiting = false;
    this.hintText.setText(text);
    if (this.input === null) {
      this.rebuildMenu();
    }
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.menu?.destroy();
    this.input?.destroy();
    this.utterance.destroy();
    this.container.destroy(true);
  }

  private updateProposal(): void {
    const proposal = this.interaction.pendingProposal;
    if (proposal === undefined) {
      this.proposalText.setText("");
      return;
    }
    this.proposalText.setText(this.describeProposal(proposal));
  }

  private describeProposal(proposal: PendingProposalView): string {
    const kind = proposal.type === "hunt" ? "討伐" : "調達";
    const reward =
      proposal.rewardItem !== undefined
        ? `${proposal.rewardGold}G と ${proposal.rewardItem.name}`
        : `${proposal.rewardGold}G`;
    return `【依頼・${kind}】${proposal.title}\n${proposal.description}\n目標 ${proposal.count} / 報酬 ${reward}`;
  }

  /** interaction.options を表示順に並べてアクションメニューを組む */
  private rebuildMenu(): void {
    this.menu?.destroy();
    const available = new Set(this.interaction.options);
    const items = ACTION_ORDER.filter((action) => available.has(action)).map((action) => ({
      id: action,
      label: ACTION_LABELS[action]
    }));
    if (items.length === 0) {
      this.menu = null;
      return;
    }

    this.menu = new MenuList(this.scene, this.parentLayer, {
      items,
      x: this.panelX + PANEL_WIDTH - MENU_WIDTH - 24,
      y: this.panelY + 56,
      width: MENU_WIDTH,
      onSelect: (id) => {
        this.onAction(id as ConversationAction);
      }
    });
    // 呼び出し元の keydown と同一イベントでの二重発火を避けるため次 tick で受付開始
    this.scene.time.delayedCall(0, () => {
      if (!this.destroyed && this.input === null && !this.awaiting) {
        this.menu?.activate();
      }
    });
  }

  private onAction(action: ConversationAction): void {
    switch (action) {
      case "send":
        this.openInput();
        break;
      case "quest-request":
        this.setAwaiting("……(仕事の話を切り出した)");
        this.options.onQuestRequest();
        break;
      case "accept":
        this.setAwaiting("……(依頼を引き受けた)");
        this.options.onChoose("accept");
        break;
      case "decline":
        this.setAwaiting("……(依頼を断った)");
        this.options.onChoose("decline");
        break;
      case "end":
        this.options.onEnd();
        break;
    }
  }

  /** 自由入力ボックスを開く(送信でサーバーへ。閉じたらメニューへ戻す) */
  private openInput(): void {
    this.menu?.deactivate();
    this.input = new TextInputBox(this.scene, {
      placeholder: "話しかける言葉を入力(Enterで送る / Escでやめる)",
      onSubmit: (text) => {
        this.closeInput();
        this.setAwaiting("……(言葉を待っている)");
        this.options.onSend(text);
      },
      onCancel: () => {
        this.closeInput();
        this.rebuildMenu();
      }
    });
    this.input.open();
  }

  private closeInput(): void {
    this.input?.close();
    this.input = null;
  }

  /** 応答待ち状態にする(再送・メニューを止め、待ちヒントを出す) */
  private setAwaiting(hint: string): void {
    this.awaiting = true;
    this.menu?.deactivate();
    this.menu?.destroy();
    this.menu = null;
    this.hintText.setText(hint);
  }
}
