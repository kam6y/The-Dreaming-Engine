import Phaser from "phaser";

import {
  GAME_TITLE,
  serverMessageSchema,
  type ClientMessage
} from "@dreaming-engine/shared";

import "./style.css";

const connectionStatus = document.querySelector<HTMLParagraphElement>(
  "#connection-status"
);

function setConnectionStatus(text: string): void {
  if (connectionStatus !== null) {
    connectionStatus.textContent = text;
  }
}

class TitleScene extends Phaser.Scene {
  public constructor() {
    super("title");
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#000000");
    this.add
      .text(480, 244, GAME_TITLE, {
        color: "#f1eee4",
        fontFamily: "serif",
        fontSize: "44px"
      })
      .setOrigin(0.5);
    this.add
      .text(480, 304, "夢見る機関は、まだ微かに動いている。", {
        color: "#a9b0ba",
        fontFamily: "serif",
        fontSize: "20px"
      })
      .setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#000000",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [TitleScene]
});

function connectToServer(): void {
  const socket = new WebSocket("ws://127.0.0.1:3000/ws");
  let connected = false;

  socket.addEventListener("open", () => {
    setConnectionStatus("サーバー: 接続中");
    const message: ClientMessage = { type: "ping", sentAt: Date.now() };
    socket.send(JSON.stringify(message));
  });

  socket.addEventListener("message", (event: MessageEvent<string>) => {
    const parsed = serverMessageSchema.safeParse(JSON.parse(event.data) as unknown);

    if (!parsed.success) {
      setConnectionStatus("サーバー: 応答異常");
      return;
    }

    if (parsed.data.type === "pong") {
      connected = true;
      setConnectionStatus("サーバー: 接続済み");
    }
  });

  socket.addEventListener("close", () => {
    if (!connected) {
      setConnectionStatus("サーバー: 再接続中");
      window.setTimeout(connectToServer, 500);
      return;
    }

    setConnectionStatus("サーバー: 切断");
  });

  socket.addEventListener("error", () => {
    setConnectionStatus("サーバー: 接続失敗");
  });
}

connectToServer();
