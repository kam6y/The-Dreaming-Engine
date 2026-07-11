import { createNewGameState, type SnapshotView } from "@dreaming-engine/shared";
import { describe, expect, it, vi } from "vitest";

import {
  GameClient,
  getGameClient,
  setGameClient,
  type GameClientOptions,
  type SocketCloseEvent,
  type SocketMessageEvent,
  type WebSocketLike
} from "../src/net/game-client.js";

// ---------------------------------------------------------------------------
// テスト用フェイク WebSocket。emit* で open/message/close/error を手動発火する。
// ---------------------------------------------------------------------------
class FakeWebSocket implements WebSocketLike {
  readonly sent: string[] = [];
  closed = false;

  private readonly openListeners: Array<() => void> = [];
  private readonly messageListeners: Array<(event: SocketMessageEvent) => void> = [];
  private readonly closeListeners: Array<(event: SocketCloseEvent) => void> = [];
  private readonly errorListeners: Array<() => void> = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "message", listener: (event: SocketMessageEvent) => void): void;
  addEventListener(type: "close", listener: (event: SocketCloseEvent) => void): void;
  addEventListener(type: "error", listener: () => void): void;
  addEventListener(
    type: "open" | "message" | "close" | "error",
    listener:
      | (() => void)
      | ((event: SocketMessageEvent) => void)
      | ((event: SocketCloseEvent) => void)
  ): void {
    switch (type) {
      case "open":
        this.openListeners.push(listener as () => void);
        break;
      case "message":
        this.messageListeners.push(listener as (event: SocketMessageEvent) => void);
        break;
      case "close":
        this.closeListeners.push(listener as (event: SocketCloseEvent) => void);
        break;
      case "error":
        this.errorListeners.push(listener as () => void);
        break;
    }
  }

  emitOpen(): void {
    for (const listener of [...this.openListeners]) listener();
  }

  emitMessage(data: string): void {
    for (const listener of [...this.messageListeners]) listener({ data });
  }

  emitClose(code: number, reason = ""): void {
    for (const listener of [...this.closeListeners]) listener({ code, reason });
  }

  emitError(): void {
    for (const listener of [...this.errorListeners]) listener();
  }
}

/** 生成順の i 番目のフェイクを取り出す(noUncheckedIndexedAccess 対策) */
function requireSocket(fakes: readonly FakeWebSocket[], index: number): FakeWebSocket {
  const socket = fakes[index];
  if (socket === undefined) {
    throw new Error(`socket[${index}] が未生成です`);
  }
  return socket;
}

interface Harness {
  client: GameClient;
  fakes: FakeWebSocket[];
  statusTexts: string[];
  reconnects: Array<{ fn: () => void; delayMs: number }>;
}

function setup(overrides: Partial<GameClientOptions> = {}): Harness {
  const fakes: FakeWebSocket[] = [];
  const statusTexts: string[] = [];
  const reconnects: Array<{ fn: () => void; delayMs: number }> = [];
  const client = new GameClient({
    url: "ws://test.invalid/ws",
    createSocket: () => {
      const socket = new FakeWebSocket();
      fakes.push(socket);
      return socket;
    },
    setStatusText: (text) => {
      statusTexts.push(text);
    },
    scheduleReconnect: (fn, delayMs) => {
      reconnects.push({ fn, delayMs });
    },
    reconnectDelayMs: 500,
    now: () => 12345,
    ...overrides
  });
  return { client, fakes, statusTexts, reconnects };
}

/** battleEventSchema を満たす最小の戦闘イベント(逃走成功) */
const sampleBattleEvent = { type: "flee", success: true, message: "旅人は霧の中へ身を退いた。" };

/** snapshotViewSchema を満たす最小のスナップショットビュー */
function sampleView(): SnapshotView {
  const state = createNewGameState();
  return {
    mode: "exploration",
    mainQuestStage: state.mainQuestStage,
    player: {
      level: state.player.level,
      xp: state.player.xp,
      xpToNext: 8,
      hp: state.player.hp,
      maxHp: state.player.hp,
      mp: state.player.mp,
      maxMp: state.player.mp,
      gold: state.player.gold,
      equipment: { weapon: null, armor: null },
      effectiveAttack: 8,
      effectiveDefense: 5
    },
    day: state.day,
    // 時間帯(M23。view 必須フィールド追従)。新規ゲームは昼開始
    timeOfDay: "day",
    playtimeSeconds: 0,
    location: state.location,
    inventory: [{ itemId: "potion-small", name: "回復薬(小)", count: 2, questItem: false }],
    questItems: [],
    inventoryCapacity: 20,
    inventoryUsed: 2,
    symbols: [{ position: { x: 5, y: 5 }, enemyId: "mist-wolf", facing: "left" }],
    resolvedObjectIds: [],
    subQuests: [],
    // 世界状態の表示情報(M20-3)。既定=平常(市場なし・全員在席・侵食0)
    world: { marketShift: null, absentNpc: null, dreamErosion: 0 },
    // 訪問済みマップ(M22。view 必須フィールド追従)。開始マップのみ訪問済み
    visitedMaps: state.visitedMaps,
    // 解除済み実績(M24。view 必須フィールド追従)。新規ゲームは空
    unlockedAchievements: state.unlockedAchievements
  };
}

describe("GameClient — 疎通(ping/pong)", () => {
  it("open 時に ping を1回だけ送り、接続中→接続済みへ遷移する", () => {
    const { client, fakes, statusTexts } = setup();
    client.connect();
    const socket = requireSocket(fakes, 0);
    socket.emitOpen();

    // ping はちょうど1回、sentAt は注入した now() の値
    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(requireSocket(fakes, 0).sent[0] ?? "")).toEqual({ type: "ping", sentAt: 12345 });
    expect(statusTexts).toContain("サーバー: 接続中");
    expect(client.isConnected).toBe(false); // pong 未受信

    socket.emitMessage(JSON.stringify({ type: "pong", sentAt: 12345, receivedAt: 99 }));
    expect(statusTexts.at(-1)).toBe("サーバー: 接続済み");
    expect(client.isConnected).toBe(true);
  });
});

describe("GameClient — hello / snapshot の受信と状態保持", () => {
  it("hello 受信で hasSave を更新しイベントを発火する(true/false 両方)", () => {
    const { client, fakes } = setup();
    const received: boolean[] = [];
    client.on("hello", ({ hasSave }) => received.push(hasSave));
    client.connect();
    const socket = requireSocket(fakes, 0);
    socket.emitOpen();

    expect(client.hasSave).toBeNull();
    socket.emitMessage(JSON.stringify({ type: "hello", title: "The Dreaming Engine", hasSave: true }));
    expect(client.hasSave).toBe(true);
    socket.emitMessage(JSON.stringify({ type: "hello", title: "The Dreaming Engine", hasSave: false }));
    expect(client.hasSave).toBe(false);
    expect(received).toEqual([true, false]);
  });

  it("snapshot 受信で lastSnapshot を保持し view をそのまま発火する", () => {
    const { client, fakes } = setup();
    const view = sampleView();
    const seen: SnapshotView[] = [];
    client.on("snapshot", (payload) => seen.push(payload));
    client.connect();
    const socket = requireSocket(fakes, 0);
    socket.emitOpen();

    socket.emitMessage(JSON.stringify({ type: "snapshot", view }));
    expect(client.lastSnapshot).toEqual(view);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual(view);
  });
});

describe("GameClient — dialog / battle-events / server-error", () => {
  it("dialog を speaker/body で発火する", () => {
    const { client, fakes } = setup();
    const handler = vi.fn();
    client.on("dialog", handler);
    client.connect();
    requireSocket(fakes, 0).emitOpen();
    requireSocket(fakes, 0).emitMessage(
      JSON.stringify({ type: "dialog", speaker: "オルガ", body: "おやすみ。" })
    );
    expect(handler).toHaveBeenCalledWith({ speaker: "オルガ", body: "おやすみ。" });
  });

  it("battle-events をイベント配列で発火する", () => {
    const { client, fakes } = setup();
    const handler = vi.fn();
    client.on("battle-events", handler);
    client.connect();
    requireSocket(fakes, 0).emitOpen();
    requireSocket(fakes, 0).emitMessage(
      JSON.stringify({ type: "battle-events", events: [sampleBattleEvent] })
    );
    expect(handler).toHaveBeenCalledWith([sampleBattleEvent]);
  });

  it("error を server-error として発火する(code 有り/無し)", () => {
    const { client, fakes } = setup();
    const handler = vi.fn();
    client.on("server-error", handler);
    client.connect();
    requireSocket(fakes, 0).emitOpen();
    requireSocket(fakes, 0).emitMessage(
      JSON.stringify({ type: "error", message: "セーブがありません", code: "no-save" })
    );
    requireSocket(fakes, 0).emitMessage(JSON.stringify({ type: "error", message: "夢が乱れた" }));
    expect(handler).toHaveBeenNthCalledWith(1, { message: "セーブがありません", code: "no-save" });
    expect(handler).toHaveBeenNthCalledWith(2, { message: "夢が乱れた" });
  });
});

describe("GameClient — 異常入力は応答異常にしイベントを発火しない", () => {
  it("不正な JSON は『応答異常』にしイベントを発火しない", () => {
    const { client, fakes, statusTexts } = setup();
    const snapshotHandler = vi.fn();
    client.on("snapshot", snapshotHandler);
    client.connect();
    requireSocket(fakes, 0).emitOpen();
    requireSocket(fakes, 0).emitMessage("これはJSONではない{");
    expect(statusTexts.at(-1)).toBe("サーバー: 応答異常");
    expect(snapshotHandler).not.toHaveBeenCalled();
  });

  it("スキーマ不一致は『応答異常』にしイベントを発火しない", () => {
    const { client, fakes, statusTexts } = setup();
    const helloHandler = vi.fn();
    client.on("hello", helloHandler);
    client.connect();
    requireSocket(fakes, 0).emitOpen();
    requireSocket(fakes, 0).emitMessage(JSON.stringify({ type: "unknown-kind", foo: 1 }));
    expect(statusTexts.at(-1)).toBe("サーバー: 応答異常");
    expect(helloHandler).not.toHaveBeenCalled();
  });
});

describe("GameClient — send", () => {
  it("open 中は送信して true、未接続では送らず false", () => {
    const { client, fakes } = setup();
    // 接続前
    expect(client.send({ type: "interact" })).toBe(false);

    client.connect();
    const socket = requireSocket(fakes, 0);
    socket.emitOpen();
    // open 直後(ping 済み)。送信は true で、ping に続いてメッセージが積まれる
    expect(client.send({ type: "interact" })).toBe(true);
    expect(JSON.parse(socket.sent.at(-1) ?? "")).toEqual({ type: "interact" });

    // close 後は再び false
    socket.emitClose(1006);
    expect(client.send({ type: "interact" })).toBe(false);
  });
});

describe("GameClient — 再接続", () => {
  it("code 1006 の切断で再接続をスケジュールし、再接続後に ping を送り直す", () => {
    const { client, fakes, statusTexts, reconnects } = setup();
    client.connect();
    requireSocket(fakes, 0).emitOpen();
    requireSocket(fakes, 0).emitClose(1006, "abnormal");

    expect(statusTexts).toContain("サーバー: 再接続中");
    expect(reconnects).toHaveLength(1);
    expect(reconnects[0]?.delayMs).toBe(500);

    // 再接続を発火 → 新しいソケットが生成される
    reconnects[0]?.fn();
    const reconnected = requireSocket(fakes, 1);
    reconnected.emitOpen();
    expect(reconnected.sent).toHaveLength(1);
    expect(JSON.parse(reconnected.sent[0] ?? "")).toEqual({ type: "ping", sentAt: 12345 });
  });

  it("code 4000(別接続への置換)では再接続しない", () => {
    const { client, fakes, statusTexts, reconnects } = setup();
    client.connect();
    requireSocket(fakes, 0).emitOpen();
    requireSocket(fakes, 0).emitClose(4000, "replaced_by_new_connection");

    expect(reconnects).toHaveLength(0);
    expect(statusTexts.at(-1)).toBe("サーバー: 別画面に接続されました");
  });

  it("ソケットエラーで『接続失敗』を表示する", () => {
    const { client, fakes, statusTexts } = setup();
    client.connect();
    requireSocket(fakes, 0).emitError();
    expect(statusTexts).toContain("サーバー: 接続失敗");
  });
});

describe("GameClient — 購読解除", () => {
  it("on の戻り値と off で購読解除できる", () => {
    const { client, fakes } = setup();
    const viaUnsub = vi.fn();
    const viaOff = vi.fn();
    const unsubscribe = client.on("hello", viaUnsub);
    client.on("hello", viaOff);

    client.connect();
    const socket = requireSocket(fakes, 0);
    socket.emitOpen();

    unsubscribe();
    client.off("hello", viaOff);
    socket.emitMessage(JSON.stringify({ type: "hello", title: "The Dreaming Engine", hasSave: true }));
    expect(viaUnsub).not.toHaveBeenCalled();
    expect(viaOff).not.toHaveBeenCalled();
  });
});

describe("GameClient — モジュールシングルトン", () => {
  it("未設定時は getGameClient が例外、設定後は同じインスタンスを返す", () => {
    expect(() => getGameClient()).toThrow();
    const { client } = setup();
    setGameClient(client);
    expect(getGameClient()).toBe(client);
  });
});
