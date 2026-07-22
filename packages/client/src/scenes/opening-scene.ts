import Phaser from "phaser";

import { Cinematic, type CinematicPanel } from "../ui/cinematic.js";

/**
 * オープニング(新規ゲーム時のみ)。静止画+ナレーションで、記憶を失った旅人が
 * 街に流れ着くまでを描く(game-design.md「メインクエスト」1 / world-lore.md 3節)。
 * 送り終えると探索(街)へ入る。「つづきから」はこのシーンを経由しない
 * (title-scene が continue では直接 exploration へ向かう)。
 */
const OPENING_PANELS: readonly CinematicPanel[] = [
  {
    image: "op-1",
    lines: [
      "霧の切れ間に、見知らぬ街の灯りが滲んでいた。",
      "あなたは自分の名も、来し方も思い出せない。ただ胸の奥で、古い機関の低い唸りだけが響いている。"
    ]
  },
  {
    image: "op-2",
    lines: [
      "夢見る機関——忘れられた願いを灯に変え、世界という一つの夢を紡ぐ古い仕掛け。",
      "だが灯は一つ、また一つと消え、夢は綻びはじめている。",
      "機関の夢にどこにも属さぬ旅人よ。あなたはその綻びの際に、流れ着いた。"
    ]
  }
];

export class OpeningScene extends Phaser.Scene {
  private cinematic: Cinematic | null = null;

  public constructor() {
    super("opening");
  }

  public create(): void {
    this.syncDomState();
    this.cinematic = new Cinematic(this, OPENING_PANELS, () => {
      this.startExploration();
    });
    this.cameras.main.fadeIn(600, 5, 6, 10);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cinematic?.destroy();
      this.cinematic = null;
    });
  }

  private startExploration(): void {
    this.cameras.main.fadeOut(500, 5, 6, 10);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("exploration");
    });
  }

  private syncDomState(): void {
    const game = document.querySelector<HTMLDivElement>("#game");
    if (game !== null) {
      game.dataset["scene"] = "opening";
    }
  }
}
