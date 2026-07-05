import Phaser from "phaser";

import { fitCover } from "./cover-image.js";
import { UI_FONT_FAMILY } from "./font.js";
import { TypewriterText } from "./typewriter-text.js";

/** シネマティックの1枚(背景画像 id + その上に順に流すナレーション行) */
export interface CinematicPanel {
  /** 背景画像のテクスチャ id(PreloadScene がロード済み。未整備なら黒背景) */
  image: string;
  /** ナレーション行(1行ずつスペースで送る) */
  lines: string[];
}

/**
 * オープニング/エンディングの静止画+テキスト演出(共通ロジック)。
 * パネルを順に見せ、各行を TypewriterText で1行ずつ表示する。
 * スペース/Enter/クリックで送る(表示中なら全文スキップ、行末なら次行/次パネル、
 * 最後まで来たら onComplete)。検証済みでない外部テキストは扱わない(固定ナレーション)。
 */
export class Cinematic {
  private readonly scene: Phaser.Scene;

  private readonly panels: readonly CinematicPanel[];

  private readonly onComplete: () => void;

  private readonly background: Phaser.GameObjects.Image | null = null;

  private readonly veil: Phaser.GameObjects.Rectangle;

  private readonly narration: TypewriterText;

  private readonly prompt: Phaser.GameObjects.Text;

  private panelIndex = 0;

  private lineIndex = 0;

  private lineDone = false;

  private completed = false;

  private currentImageKey: string | null = null;

  public constructor(
    scene: Phaser.Scene,
    panels: readonly CinematicPanel[],
    onComplete: () => void
  ) {
    this.scene = scene;
    this.panels = panels;
    this.onComplete = onComplete;

    const width = scene.scale.width;
    const height = scene.scale.height;
    scene.cameras.main.setBackgroundColor("#05060a");

    const firstKey = panels[0]?.image;
    if (firstKey !== undefined && scene.textures.exists(firstKey)) {
      this.background = scene.add.image(0, 0, firstKey).setOrigin(0.5);
      fitCover(this.background, width, height);
      this.currentImageKey = firstKey;
    }
    // 下部にテキストを載せるための暗いグラデ代わりの帯(可読性確保)
    this.veil = scene.add
      .rectangle(0, height, width, Math.round(height * 0.42), 0x05060a, 0.72)
      .setOrigin(0, 1);

    this.narration = new TypewriterText(scene, scene.add.container(0, 0), {
      x: Math.round(width * 0.12),
      y: Math.round(height * 0.72),
      width: Math.round(width * 0.76),
      fontSize: "20px",
      color: "#e6e0d0",
      msPerChar: 34
    });

    this.prompt = scene.add
      .text(Math.round(width * 0.88), Math.round(height * 0.93), "▽ スペース", {
        color: "#8f96a4",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "15px"
      })
      .setOrigin(1, 0.5)
      .setVisible(false);

    this.bindInput();
    this.showCurrentLine();
  }

  public destroy(): void {
    const keyboard = this.scene.input.keyboard;
    keyboard?.off("keydown-SPACE", this.advance, this);
    keyboard?.off("keydown-ENTER", this.advance, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.advance, this);
    this.background?.destroy();
    this.veil.destroy();
    this.narration.destroy();
    this.prompt.destroy();
  }

  private bindInput(): void {
    const keyboard = this.scene.input.keyboard;
    // 開始と同一フレームのキーを拾わないよう次tickで受付
    this.scene.time.delayedCall(0, () => {
      keyboard?.on("keydown-SPACE", this.advance, this);
      keyboard?.on("keydown-ENTER", this.advance, this);
      this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.advance, this);
    });
  }

  /** スペース等での送り: 表示中なら全文スキップ、行末なら次へ */
  private advance(): void {
    if (this.completed) {
      return;
    }
    if (this.narration.isPlaying) {
      this.narration.skip();
      return;
    }
    if (!this.lineDone) {
      return;
    }
    this.lineIndex += 1;
    const panel = this.panels[this.panelIndex];
    if (panel !== undefined && this.lineIndex < panel.lines.length) {
      this.showCurrentLine();
      return;
    }
    // 次のパネルへ
    this.panelIndex += 1;
    this.lineIndex = 0;
    if (this.panelIndex >= this.panels.length) {
      this.finish();
      return;
    }
    this.swapPanelImage();
    this.showCurrentLine();
  }

  private swapPanelImage(): void {
    const key = this.panels[this.panelIndex]?.image;
    if (key === undefined || key === this.currentImageKey) {
      return;
    }
    if (this.background !== null && this.scene.textures.exists(key)) {
      this.background.setTexture(key);
      fitCover(this.background, this.scene.scale.width, this.scene.scale.height);
      this.currentImageKey = key;
      this.background.setAlpha(0);
      this.scene.tweens.add({ targets: this.background, alpha: 1, duration: 350 });
    }
  }

  private showCurrentLine(): void {
    const line = this.panels[this.panelIndex]?.lines[this.lineIndex] ?? "";
    this.lineDone = false;
    this.prompt.setVisible(false);
    this.narration.play(line, () => {
      this.lineDone = true;
      if (!this.completed) {
        this.prompt.setVisible(true);
      }
    });
  }

  private finish(): void {
    if (this.completed) {
      return;
    }
    this.completed = true;
    this.prompt.setVisible(false);
    this.onComplete();
  }
}
