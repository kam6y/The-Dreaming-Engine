import Phaser from "phaser";

import { clearDialogQueue } from "../dialog-queue.js";
import { getGameClient } from "../net/game-client.js";
import { Cinematic, type CinematicPanel } from "../ui/cinematic.js";

/**
 * エンディング(ボス「夢喰い」撃破後)。静止画+ナレーションで討伐の弔いと、
 * 綻びが繕われた束の間の凪を描く(game-design.md「メインクエスト」5 / world-lore.md 3節)。
 * 送り終えるとタイトルへ戻る。battle-scene が mainQuestStage=dream-eater-defeated を
 * 検出してこのシーンへ直行する。
 */
const ENDING_PANELS: readonly CinematicPanel[] = [
  {
    image: "ed-1",
    lines: [
      "夢喰いは、砕けた歯車のように崩れ落ちた。",
      "それは外から来た侵略者ではなく、飢えに壊れた機関自身の一部。",
      "討つことは勝利であり、同時に、声にならぬ苦しみへの弔いでもあった。"
    ]
  },
  {
    image: "ed-2",
    lines: [
      "裂け目の底に、久しぶりの凪が満ちる。消えかけていた灯が、また一つ、確かに灯った。",
      "綻びのひとつは繕われた。だが機関の夢は広く、まだ癒えぬ場所も残されている——あなたの失われた記憶と共に。",
      "それでも今宵、灯町の灯りは、帰る場所のように瞬いていた。"
    ]
  }
];

export class EndingScene extends Phaser.Scene {
  private cinematic: Cinematic | null = null;

  public constructor() {
    super("ending");
  }

  public create(): void {
    this.syncDomState();
    // シーン跨ぎの残ダイアログ(戦果ナレーション等)は持ち越さない
    clearDialogQueue();
    // エンディング到達を確定(サーバーが dream-eater-defeated → epilogue にしてセーブへ刻む)
    getGameClient().send({ type: "acknowledge-ending" });
    this.cinematic = new Cinematic(this, ENDING_PANELS, () => {
      this.toTitle();
    });
    this.cameras.main.fadeIn(800, 5, 6, 10);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cinematic?.destroy();
      this.cinematic = null;
    });
  }

  private toTitle(): void {
    this.cameras.main.fadeOut(700, 5, 6, 10);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("title");
    });
  }

  private syncDomState(): void {
    const game = document.querySelector<HTMLDivElement>("#game");
    if (game !== null) {
      game.dataset["scene"] = "ending";
    }
  }
}
