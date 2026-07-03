import { serverMessageSchema, type ClientMessage } from "@dreaming-engine/shared";

const connectionStatus = document.querySelector<HTMLParagraphElement>(
  "#connection-status"
);

function setConnectionStatus(text: string): void {
  if (connectionStatus !== null) {
    connectionStatus.textContent = text;
  }
}

/** サーバーとのWebSocket接続を確立する(未接続の間は500ms間隔で再接続)。 */
export function connectToServer(): void {
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
