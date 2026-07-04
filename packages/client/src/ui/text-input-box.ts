import Phaser from "phaser";

export interface TextInputBoxOptions {
  /** 最大文字数(会話の自由入力は200字: ai-guardrails.md第3層。サーバー側でも強制) */
  maxLength?: number;
  placeholder?: string;
  /** Enterで送信(空・空白のみは送信しない) */
  onSubmit: (text: string) => void;
  /** Escで閉じる要求(閉じる処理自体は呼び出し側が行う) */
  onCancel: () => void;
}

const DEFAULT_MAX_LENGTH = 200;

/**
 * 会話の自由入力ボックス(HTMLの<input>をキャンバス上へオーバーレイ)。
 *
 * PhaserのTextでは日本語IME入力ができないため、DOMのinput要素を使う。
 * 表示中はPhaserのキーボード処理を無効化+グローバルキャプチャを解除し、
 * スペース・矢印などがゲーム側に奪われず入力欄へ届くようにする。
 * 値はmaxLengthでクライアント側制限(サーバー側の強制切り詰めと二重)。
 */
export class TextInputBox {
  private readonly scene: Phaser.Scene;

  private readonly options: TextInputBoxOptions;

  private input: HTMLInputElement | null = null;

  public constructor(scene: Phaser.Scene, options: TextInputBoxOptions) {
    this.scene = scene;
    this.options = options;
  }

  public get isOpen(): boolean {
    return this.input !== null;
  }

  public get value(): string {
    return this.input?.value ?? "";
  }

  /** 入力欄を表示してフォーカスする(ゲーム側キー処理は停止する) */
  public open(): void {
    if (this.input !== null) {
      return;
    }
    const host = document.querySelector<HTMLDivElement>("#game");
    if (host === null) {
      return;
    }
    // #game を基準に下部中央へ重ねる
    if (host.style.position === "") {
      host.style.position = "relative";
    }

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = this.options.maxLength ?? DEFAULT_MAX_LENGTH;
    input.placeholder = this.options.placeholder ?? "";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "会話の入力");
    Object.assign(input.style, {
      position: "absolute",
      left: "50%",
      bottom: "24px",
      transform: "translateX(-50%)",
      width: "min(640px, 80%)",
      padding: "10px 14px",
      fontSize: "16px",
      fontFamily: "serif",
      color: "#f1eee4",
      background: "#0b0d12f2",
      border: "2px solid #6b6350",
      borderRadius: "2px",
      outline: "none",
      zIndex: "10"
    } satisfies Partial<CSSStyleDeclaration>);

    // Enter=送信 / Esc=キャンセル。ゲーム側のリスナーへ伝播させない
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter" && !event.isComposing) {
        const text = input.value.trim();
        if (text.length > 0) {
          input.value = "";
          this.options.onSubmit(text);
        }
      } else if (event.key === "Escape") {
        this.options.onCancel();
      }
    });
    input.addEventListener("keyup", (event) => {
      event.stopPropagation();
    });

    host.appendChild(input);
    this.input = input;

    // ゲーム側のキー処理を止める(キャプチャ解除でスペース等が入力欄へ届く)
    const keyboard = this.scene.input.keyboard;
    if (keyboard !== null) {
      keyboard.enabled = false;
      keyboard.disableGlobalCapture();
    }
    input.focus();
  }

  /** 入力欄を閉じる(ゲーム側キー処理を再開する) */
  public close(): void {
    if (this.input === null) {
      return;
    }
    this.input.remove();
    this.input = null;
    const keyboard = this.scene.input.keyboard;
    if (keyboard !== null) {
      keyboard.enabled = true;
      keyboard.enableGlobalCapture();
      keyboard.resetKeys();
    }
  }

  public destroy(): void {
    this.close();
  }
}
