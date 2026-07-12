import {
  serverMessageSchema,
  type ClientMessage,
  type NpcId,
  type ServerMessage,
  type SnapshotView
} from "@dreaming-engine/shared";

// ===========================================================================
// GameClient — サーバー正本のスナップショット駆動へ移行するための型付き WS クライアント。
//
// Phaser 非依存・DOM 非依存の純 TS。受信は必ず serverMessageSchema でパースし、
// メッセージ種別ごとにイベントを発火する。DOM 更新・時刻・タイマー・ソケット生成は
// すべてコールバック注入にしてユニットテストで決定論的に検証できるようにする。
// (M0の ping/pong 疎通を踏襲しつつ、スナップショット駆動へ拡張)
// ===========================================================================

/** WebSocket の受信メッセージ(本プロジェクトの通信は常に文字列 JSON) */
export interface SocketMessageEvent {
  readonly data: string;
}

/** WebSocket のクローズイベント(コード/理由) */
export interface SocketCloseEvent {
  readonly code: number;
  readonly reason: string;
}

/**
 * WebSocket の最小インターフェース(テストでフェイクを注入するため)。
 * ブラウザの WebSocket は addEventListener が汎用イベント型で型付けされているため、
 * 本インターフェースへは既定ファクトリで unknown 経由の型変換を挟んで適合させる。
 */
export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "message", listener: (event: SocketMessageEvent) => void): void;
  addEventListener(type: "close", listener: (event: SocketCloseEvent) => void): void;
  addEventListener(type: "error", listener: () => void): void;
}

/** ダイアログイベントのペイロード(話者が地の文なら speaker=null) */
export interface DialogEvent {
  readonly speaker: string | null;
  readonly body: string;
}

/** サーバーエラーイベントのペイロード(code は省略され得る) */
export interface ServerErrorEvent {
  readonly message: string;
  readonly code?: string;
}

/**
 * 検証済み AI 発話/ナレーションのペイロード(疑似ストリーミング表示用)。
 * channel=speak は NPC 発話(npcId 付き)、narrate は情景・夢・戦果(npcId 省略)。
 */
export interface AiUtteranceEvent {
  readonly channel: "speak" | "narrate";
  readonly npcId?: NpcId;
  readonly text: string;
}

/**
 * battle-events の events 型はスキーマから直接導出する。
 * (exactOptionalPropertyTypes 下で、パース結果と手書き型の省略プロパティ差異を避けるため)
 */
export type BattleEventsPayload = Extract<ServerMessage, { type: "battle-events" }>["events"];

/** クローズイベントのペイロード */
export interface CloseEvent {
  readonly code: number;
  readonly reason: string;
}

/**
 * GameClient が発火するイベントとそのペイロードの対応表。
 * シーンはこれらを購読して UI を再構築する。
 */
export interface GameClientEventMap {
  /** ソケットが開いた(ping 送出済み。pong 受信前) */
  open: void;
  /** ソケットが閉じた(再接続の有無は code 依存) */
  close: CloseEvent;
  /** 接続直後の hello(セーブ有無) */
  hello: { readonly hasSave: boolean };
  /** 権威スナップショット(毎操作後のクライアント向けビュー全体) */
  snapshot: SnapshotView;
  /** ダイアログ表示 */
  dialog: DialogEvent;
  /** 1ターン分の戦闘イベント列 */
  "battle-events": BattleEventsPayload;
  /** 検証済み AI 発話/ナレーション(疑似ストリーミング表示) */
  "ai-utterance": AiUtteranceEvent;
  /** 宿泊の入眠合図(M26-3)。夢の顕現(narrate)まで入眠演出で待つ */
  "sleep-start": void;
  /** サーバーからの明示エラー */
  "server-error": ServerErrorEvent;
}

export type GameClientEventHandler<K extends keyof GameClientEventMap> = (
  payload: GameClientEventMap[K]
) => void;

export interface GameClientOptions {
  url: string;
  /** 省略時は new WebSocket(url)。テストではフェイクを注入 */
  createSocket?: (url: string) => WebSocketLike;
  /** 接続状態テキストの表示先(DOM 更新はコールバック注入。省略可) */
  setStatusText?: (text: string) => void;
  /** 再接続のスケジューラ(省略時 setTimeout)。テストで手動発火するため注入可能に */
  scheduleReconnect?: (fn: () => void, delayMs: number) => void;
  /** 再接続までの待機時間。既定 500ms */
  reconnectDelayMs?: number;
  /** ping の sentAt に使う時刻(省略時 Date.now)。テスト決定論用 */
  now?: () => number;
}

/** 新接続への置換により旧接続が切られるときのクローズコード(server.ts と一致) */
const REPLACED_CLOSE_CODE = 4000;

/** WS の受信・状態管理・再接続を司る型付きクライアント。 */
export class GameClient {
  private readonly url: string;
  private readonly createSocket: (url: string) => WebSocketLike;
  private readonly setStatusText: ((text: string) => void) | undefined;
  private readonly scheduleReconnect: (fn: () => void, delayMs: number) => void;
  private readonly reconnectDelayMs: number;
  private readonly now: () => number;

  private readonly handlers: {
    [K in keyof GameClientEventMap]: Set<GameClientEventHandler<K>>;
  } = {
    open: new Set(),
    close: new Set(),
    hello: new Set(),
    snapshot: new Set(),
    dialog: new Set(),
    "battle-events": new Set(),
    "ai-utterance": new Set(),
    "sleep-start": new Set(),
    "server-error": new Set()
  };

  private socket: WebSocketLike | undefined;
  private socketOpen = false;
  private pongReceived = false;
  private helloHasSave: boolean | null = null;
  private snapshot: SnapshotView | null = null;

  constructor(options: GameClientOptions) {
    this.url = options.url;
    // 既定ファクトリはブラウザの WebSocket を用いる。DOM の WebSocket は addEventListener の
    // イベント型が本インターフェースより広いため、unknown 経由で WebSocketLike に適合させる。
    this.createSocket =
      options.createSocket ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
    this.setStatusText = options.setStatusText;
    this.scheduleReconnect =
      options.scheduleReconnect ??
      ((fn, delayMs) => {
        setTimeout(fn, delayMs);
      });
    this.reconnectDelayMs = options.reconnectDelayMs ?? 500;
    this.now = options.now ?? (() => Date.now());
  }

  /** サーバーとの接続を確立する。open 時に ping を1回送って疎通を確認する。 */
  connect(): void {
    this.socketOpen = false;
    this.pongReceived = false;
    const socket = this.createSocket(this.url);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.handleOpen();
    });
    socket.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });
    socket.addEventListener("close", (event) => {
      this.handleClose(event);
    });
    socket.addEventListener("error", () => {
      this.setStatusText?.("サーバー: 接続失敗");
    });
  }

  /**
   * 操作メッセージを送信する。open 中なら JSON 化して送り true、未接続なら送らず false。
   * (未接続時に例外を投げず false を返すことで、呼び出し側の分岐を単純にする)
   */
  send(message: ClientMessage): boolean {
    if (!this.socketOpen || this.socket === undefined) {
      return false;
    }
    this.socket.send(JSON.stringify(message));
    return true;
  }

  /** イベントを購読する。戻り値は購読解除関数。 */
  on<K extends keyof GameClientEventMap>(event: K, handler: GameClientEventHandler<K>): () => void {
    this.handlers[event].add(handler);
    return () => {
      this.off(event, handler);
    };
  }

  /** イベント購読を解除する。 */
  off<K extends keyof GameClientEventMap>(event: K, handler: GameClientEventHandler<K>): void {
    this.handlers[event].delete(handler);
  }

  /** pong 受信済みかつソケットが開いているか。 */
  get isConnected(): boolean {
    return this.pongReceived && this.socketOpen;
  }

  /** セーブ有無(hello 受信前は null。hello 毎に更新)。 */
  get hasSave(): boolean | null {
    return this.helloHasSave;
  }

  /** 直近に受信した権威スナップショット(未受信は null)。 */
  get lastSnapshot(): SnapshotView | null {
    return this.snapshot;
  }

  private handleOpen(): void {
    this.socketOpen = true;
    this.setStatusText?.("サーバー: 接続中");
    // 疎通確認の ping を1回だけ送る(pong で「接続済み」に遷移する)
    this.socket?.send(JSON.stringify({ type: "ping", sentAt: this.now() } satisfies ClientMessage));
    this.emit("open", undefined);
  }

  private handleMessage(raw: string): void {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      this.setStatusText?.("サーバー: 応答異常");
      return;
    }
    const parsed = serverMessageSchema.safeParse(json);
    if (!parsed.success) {
      this.setStatusText?.("サーバー: 応答異常");
      return;
    }
    const message = parsed.data;
    switch (message.type) {
      case "pong":
        this.pongReceived = true;
        this.setStatusText?.("サーバー: 接続済み");
        break;
      case "hello":
        this.helloHasSave = message.hasSave;
        this.emit("hello", { hasSave: message.hasSave });
        break;
      case "snapshot":
        this.snapshot = message.view;
        this.emit("snapshot", message.view);
        break;
      case "dialog":
        this.emit("dialog", { speaker: message.speaker, body: message.body });
        break;
      case "battle-events":
        this.emit("battle-events", message.events);
        break;
      case "ai-utterance":
        this.emit(
          "ai-utterance",
          message.npcId === undefined
            ? { channel: message.channel, text: message.text }
            : { channel: message.channel, npcId: message.npcId, text: message.text }
        );
        break;
      case "sleep-start":
        this.emit("sleep-start", undefined);
        break;
      case "error":
        this.emit(
          "server-error",
          message.code === undefined
            ? { message: message.message }
            : { message: message.message, code: message.code }
        );
        break;
      case "state":
        // レガシー(M0 由来の state)は無視する
        break;
      default: {
        // 網羅性チェック(将来メッセージ追加時にコンパイルエラーで気付けるように)
        const exhaustive: never = message;
        void exhaustive;
      }
    }
  }

  private handleClose(event: SocketCloseEvent): void {
    this.socketOpen = false;
    this.pongReceived = false;
    this.socket = undefined;
    this.emit("close", { code: event.code, reason: event.reason });
    if (event.code === REPLACED_CLOSE_CODE) {
      // 新接続への置換。別画面が接続を奪ったので再接続しない
      this.setStatusText?.("サーバー: 別画面に接続されました");
      return;
    }
    // それ以外は常時再接続(初回接続前・接続後を問わない)
    this.setStatusText?.("サーバー: 再接続中");
    this.scheduleReconnect(() => {
      this.connect();
    }, this.reconnectDelayMs);
  }

  private emit<K extends keyof GameClientEventMap>(event: K, payload: GameClientEventMap[K]): void {
    // 反復中の購読解除に備えてコピーしてから呼ぶ
    for (const handler of [...this.handlers[event]]) {
      handler(payload);
    }
  }
}

// ===========================================================================
// モジュールシングルトン。main.ts / シーンから単一の GameClient を共有する。
// (組み込み(setGameClient 呼び出し)はオーケストレーターが行う)
// ===========================================================================

let currentClient: GameClient | null = null;

/** 共有 GameClient を設定する。 */
export function setGameClient(client: GameClient): void {
  currentClient = client;
}

/** 共有 GameClient を取得する。未設定なら明示的にエラーを投げる。 */
export function getGameClient(): GameClient {
  if (currentClient === null) {
    throw new Error(
      "GameClient が未初期化です。setGameClient() で先にクライアントを登録してください。"
    );
  }
  return currentClient;
}
