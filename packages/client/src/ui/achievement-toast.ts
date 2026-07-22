import Phaser from "phaser";

import { ACHIEVEMENTS } from "@dreaming-engine/shared";
import type { AchievementId } from "@dreaming-engine/shared";

import { UI_FONT_FAMILY } from "./font.js";

/** 表示時間(フェードイン→保持→フェードアウト)。入力は一切奪わない非モーダル通知 */
const FADE_IN_MS = 250;
const HOLD_MS = 2200;
const FADE_OUT_MS = 450;

const TOAST_Y = 56;

/**
 * 実績解除トーストの通知係(M24-3)。
 * スナップショット差分で検出された新規解除を enqueue で受け取り、画面上部中央へ
 * 1件ずつ順送りで数秒表示する(複数同時解除はキューで直列化)。
 * 非モーダル: キー処理・当たり判定を持たず、探索の入力・移動・E2Eのdata属性を妨げない。
 * 新規画像アセットは使わない(矩形+テキストの手続き描画のみ)。
 */
export class AchievementToaster {
  private readonly scene: Phaser.Scene;

  private readonly parentLayer: Phaser.GameObjects.Container;

  private readonly queue: AchievementId[] = [];

  private current: Phaser.GameObjects.Container | null = null;

  private destroyed = false;

  public constructor(scene: Phaser.Scene, parentLayer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.parentLayer = parentLayer;
  }

  /** 解除トーストを予約する(表示中なら順番待ちへ) */
  public enqueue(id: AchievementId): void {
    if (this.destroyed) {
      return;
    }
    this.queue.push(id);
    if (this.current === null) {
      this.showNext();
    }
  }

  private showNext(): void {
    const id = this.queue.shift();
    if (id === undefined || this.destroyed) {
      return;
    }

    const label = this.scene.add
      .text(0, -10, "― 夢の欠片 ―", {
        color: "#a9b0ba",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "11px"
      })
      .setOrigin(0.5);
    const name = this.scene.add
      .text(0, 9, ACHIEVEMENTS[id].name, {
        color: "#d8c98f",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "16px"
      })
      .setOrigin(0.5);

    const width = Math.max(label.width, name.width) + 48;
    const background = this.scene.add
      .rectangle(0, 0, width, 52, 0x0b0d12, 0.92)
      .setStrokeStyle(2, 0xc9a25c, 0.9);

    const toast = this.scene.add.container(Math.round(this.scene.scale.width / 2), TOAST_Y, [
      background,
      label,
      name
    ]);
    toast.setAlpha(0);
    this.parentLayer.add(toast);
    this.current = toast;

    // フェードイン→保持→フェードアウト→次へ(トゥイーンはシーン破棄時に自動で止まる)
    this.scene.tweens.add({
      targets: toast,
      alpha: 1,
      duration: FADE_IN_MS,
      onComplete: () => {
        this.scene.tweens.add({
          targets: toast,
          alpha: 0,
          delay: HOLD_MS,
          duration: FADE_OUT_MS,
          onComplete: () => {
            toast.destroy(true);
            if (this.current === toast) {
              this.current = null;
            }
            this.showNext();
          }
        });
      }
    });
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.queue.length = 0;
    if (this.current !== null) {
      this.current.destroy(true);
      this.current = null;
    }
  }
}
