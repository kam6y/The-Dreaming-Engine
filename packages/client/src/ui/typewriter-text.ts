import Phaser from "phaser";

export interface TypewriterTextOptions {
  x: number;
  y: number;
  /** 折返し幅(ピクセル) */
  width: number;
  /** フォントサイズ(省略時17px) */
  fontSize?: string;
  /** 文字色(省略時 #f1eee4) */
  color?: string;
  /** 1文字あたりの表示間隔ミリ秒(省略時25ms) */
  msPerChar?: number;
}

/**
 * タイプライター演出付きテキスト(疑似ストリーミング)。
 *
 * サーバーが出力壁を通過させた「検証済み全文」を受け取ってから、クライアント側で
 * 1文字ずつ表示する(ai-guardrails.md第4層: 未検証テキストの送出はしない。
 * 見た目のストリーミングはこの演出で行う)。描画はPhaserのTextオブジェクト=
 * プレーンテキストのみ(マークアップを解釈しない: 同第4層)。
 * play中にskip()で全文即時表示。
 */
export class TypewriterText {
  private readonly scene: Phaser.Scene;

  private readonly text: Phaser.GameObjects.Text;

  private readonly msPerChar: number;

  private fullText = "";

  private shownChars = 0;

  private timer: Phaser.Time.TimerEvent | null = null;

  private onDone: (() => void) | null = null;

  public constructor(
    scene: Phaser.Scene,
    parentLayer: Phaser.GameObjects.Container,
    options: TypewriterTextOptions
  ) {
    this.scene = scene;
    this.msPerChar = options.msPerChar ?? 25;
    this.text = scene.add.text(options.x, options.y, "", {
      color: options.color ?? "#f1eee4",
      fontFamily: "serif",
      fontSize: options.fontSize ?? "17px",
      wordWrap: { width: options.width, useAdvancedWrap: true },
      lineSpacing: 6
    });
    parentLayer.add(this.text);
  }

  /** 全文を受け取り、1文字ずつの表示を開始する(既存の再生は中断して置き換え) */
  public play(fullText: string, onDone?: () => void): void {
    this.stopTimer();
    this.fullText = fullText;
    this.shownChars = 0;
    this.onDone = onDone ?? null;
    this.text.setText("");
    if (fullText.length === 0) {
      this.finish();
      return;
    }
    // Array.fromでサロゲートペア(絵文字等)を分断しない
    const chars = Array.from(fullText);
    this.timer = this.scene.time.addEvent({
      delay: this.msPerChar,
      repeat: chars.length - 1,
      callback: () => {
        this.shownChars += 1;
        this.text.setText(chars.slice(0, this.shownChars).join(""));
        if (this.shownChars >= chars.length) {
          this.finish();
        }
      }
    });
  }

  /** 演出をスキップして全文を即時表示する */
  public skip(): void {
    if (!this.isPlaying) {
      return;
    }
    this.stopTimer();
    this.text.setText(this.fullText);
    this.finish();
  }

  /** 再生中(スペース送りの分岐に使う) */
  public get isPlaying(): boolean {
    return this.timer !== null;
  }

  /** 即時で全文を表示する(演出なし) */
  public setImmediately(text: string): void {
    this.stopTimer();
    this.fullText = text;
    this.onDone = null;
    this.text.setText(text);
  }

  public clear(): void {
    this.setImmediately("");
  }

  public setPosition(x: number, y: number): void {
    this.text.setPosition(x, y);
  }

  public destroy(): void {
    this.stopTimer();
    this.text.destroy();
  }

  private finish(): void {
    this.stopTimer();
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  private stopTimer(): void {
    this.timer?.remove();
    this.timer = null;
  }
}
