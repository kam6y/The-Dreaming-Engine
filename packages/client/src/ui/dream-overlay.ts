import Phaser from "phaser";

import { TypewriterText } from "./typewriter-text.js";

export interface DreamOverlayOptions {
  /** 夢の情景(検証済み全文の ai-utterance narrate) */
  text: string;
  /** 「目を覚ます」= overlay を閉じて翌朝の探索へ戻る */
  onWake: () => void;
}

/**
 * 夢シーン演出(宿泊後)。画面全体を暗幕で覆い、夢の情景を中央に
 * TypewriterText で疑似ストリーミング表示する(検証済み全文のみ・プレーンテキスト:
 * ai-guardrails.md 第4層)。テキスト表示が終わると「目を覚ます」プロンプトを出し、
 * スペース/Enter で翌朝の探索へ戻る(表示中のスペースは全文スキップ)。
 * 世界変化はサーバー側で既に翌朝の状態へ適用済み(このオーバーレイは演出のみ)。
 */
export class DreamOverlay {
  private readonly scene: Phaser.Scene;

  private readonly options: DreamOverlayOptions;

  private readonly container: Phaser.GameObjects.Container;

  private readonly narration: TypewriterText;

  private readonly wakePrompt: Phaser.GameObjects.Text;

  private readonly keyHandlers: { event: string; handler: () => void }[] = [];

  private finished = false;

  private destroyed = false;

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: DreamOverlayOptions
  ) {
    this.scene = scene;
    this.options = options;

    const width = scene.scale.width;
    const height = scene.scale.height;

    const veil = scene.add
      .rectangle(0, 0, width, height, 0x05060a, 0.92)
      .setOrigin(0, 0);

    const title = scene.add
      .text(width / 2, height * 0.22, "― 夢 ―", {
        color: "#8f86b0",
        fontFamily: "serif",
        fontSize: "22px"
      })
      .setOrigin(0.5);

    this.wakePrompt = scene.add
      .text(width / 2, height * 0.8, "▽ 目を覚ます(スペース)", {
        color: "#6f6890",
        fontFamily: "serif",
        fontSize: "15px"
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.container = scene.add.container(0, 0, [veil, title, this.wakePrompt]);
    parentLayer.add(this.container);

    // 本文は container(暗幕)より後に parentLayer へ足し、必ず暗幕の前面に描画する
    // (TypewriterText は自身を parentLayer に add する=生成順が描画順。container より
    // 先に生成すると暗幕が本文の上へ被り、ほぼ読めなくなる。conversation-overlay と同じ流儀)
    const bodyWidth = Math.min(720, width * 0.72);
    this.narration = new TypewriterText(scene, parentLayer, {
      x: Math.round((width - bodyWidth) / 2),
      y: Math.round(height * 0.34),
      width: bodyWidth,
      fontSize: "19px",
      color: "#c7bfe0",
      msPerChar: 32
    });

    this.narration.play(options.text, () => {
      this.finished = true;
      if (!this.destroyed) {
        this.wakePrompt.setVisible(true);
      }
    });

    // 開いた同フレームのキー入力を拾わないよう次 tick で受付開始する
    scene.time.delayedCall(0, () => {
      if (!this.destroyed) {
        this.bindKeys();
      }
    });
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    const keyboard = this.scene.input.keyboard;
    if (keyboard !== null) {
      for (const { event, handler } of this.keyHandlers) {
        keyboard.off(event, handler);
      }
    }
    this.keyHandlers.length = 0;
    this.narration.destroy();
    this.container.destroy(true);
  }

  private bindKeys(): void {
    const keyboard = this.scene.input.keyboard;
    if (keyboard === null) {
      return;
    }
    const advance = (): void => {
      if (!this.finished && this.narration.isPlaying) {
        // 表示中は全文スキップ(finish コールバックが wakePrompt を出す)
        this.narration.skip();
        return;
      }
      this.options.onWake();
    };
    const on = (event: string, handler: () => void): void => {
      keyboard.on(event, handler);
      this.keyHandlers.push({ event, handler });
    };
    on("keydown-SPACE", advance);
    on("keydown-ENTER", advance);
  }
}
