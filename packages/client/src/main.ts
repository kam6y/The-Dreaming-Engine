import Phaser from "phaser";

import "./style.css";

import { connectToServer } from "./net/connection.js";
import { ExplorationScene } from "./scenes/exploration-scene.js";
import { TitleScene } from "./scenes/title-scene.js";

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
  scene: [TitleScene, ExplorationScene]
});

connectToServer();
