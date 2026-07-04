import Phaser from "phaser";

import "./style.css";

import { enqueueDialog } from "./dialog-queue.js";
import { GameClient, setGameClient } from "./net/game-client.js";
import { BattleScene } from "./scenes/battle-scene.js";
import { ExplorationScene } from "./scenes/exploration-scene.js";
import { PreloadScene } from "./scenes/preload-scene.js";
import { TitleScene } from "./scenes/title-scene.js";

// サーバー正本のスナップショット駆動: 単一の GameClient を全シーンで共有する
const connectionStatus = document.querySelector<HTMLParagraphElement>("#connection-status");
const client = new GameClient({
  url: "ws://127.0.0.1:3000/ws",
  setStatusText: (text) => {
    if (connectionStatus !== null) {
      connectionStatus.textContent = text;
    }
  }
});
// dialog はシーン遷移(戦闘→探索など)を跨いで届き得るため、グローバルキューに積み
// 探索シーンが表示可能なタイミングで順に表示する
client.on("dialog", (dialog) => {
  enqueueDialog(dialog);
});
setGameClient(client);
client.connect();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#000000",
  scale: {
    // キャンバスをウィンドウ全体に一致させる(レターボックスを作らない)。
    // マップの被覆は探索シーン側がカメラズームで保証する
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [PreloadScene, TitleScene, ExplorationScene, BattleScene]
});
