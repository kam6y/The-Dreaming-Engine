import type { AddressInfo } from "node:net";

import type { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GameSession } from "../../src/game/session.js";
import type { LoadResult, SaveStore } from "../../src/game/save.js";
import { createServer } from "../../src/server.js";

/**
 * 第0層(サーバー境界の壁)の攻撃リグレッション統合テスト。
 * 実 Fastify + WebSocket を 127.0.0.1 の一時ポートで起ち上げ、
 * ai-guardrails.md「境界検証(第0層)」の以下を機械検証する:
 * - 許可 Origin の新規 WS 受理時に既存接続が切断され、同時接続が常に1本以下に保たれること。
 * - 許可リスト外 Origin の接続が拒否(403)されること。Origin 検証は全リクエスト共通の
 *   onRequest フックで WS ハンドラより前に短絡するため、拒否された接続は WS 単一接続の
 *   置換ロジック(activeSocket)へ到達せず、既存の正規接続を切断しない。
 *
 * AI は使わない(gatekeeper 未注入=M3 互換)。セーブは実ファイルに触れないインメモリ fake。
 */

const ALLOWED_ORIGIN = "http://localhost:5173";
const FORBIDDEN_ORIGIN = "https://evil.example.com";

/** セーブへ触れないインメモリ SaveStore(境界テストでは状態を持たない) */
class MemorySaveStore implements SaveStore {
  public exists(): Promise<boolean> {
    return Promise.resolve(false);
  }
  public load(): Promise<LoadResult> {
    return Promise.resolve({ ok: false, reason: "missing" });
  }
  public save(): Promise<void> {
    return Promise.resolve();
  }
}

/** イベントを待つ(タイムアウト付き)。close は code を解決する */
function waitEvent(
  socket: WebSocket,
  event: "open" | "close",
  timeoutMs = 4000
): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`イベント ${event} がタイムアウト`)), timeoutMs);
    if (event === "close") {
      socket.once("close", (code: number) => {
        clearTimeout(timer);
        resolve(code);
      });
      return;
    }
    socket.once("open", () => {
      clearTimeout(timer);
      resolve(0);
    });
  });
}

describe("第0層 境界の壁: WS 同時1接続 / Origin 検証(統合)", () => {
  let app: FastifyInstance;
  let port: number;
  const openSockets: WebSocket[] = [];

  beforeEach(async () => {
    const session = new GameSession({ saveStore: new MemorySaveStore() });
    app = await createServer({ session, allowedOrigins: [ALLOWED_ORIGIN] });
    await app.listen({ port: 0, host: "127.0.0.1" });
    port = (app.server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const socket of openSockets) {
      socket.removeAllListeners();
      socket.terminate();
    }
    openSockets.length = 0;
    await app.close();
  });

  function connect(origin: string): WebSocket {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { origin } });
    openSockets.push(socket);
    return socket;
  }

  it("許可 Origin の新規接続を受理する際、既存接続を切断して同時1本に保つ", async () => {
    const first = connect(ALLOWED_ORIGIN);
    await waitEvent(first, "open");

    // 2本目を受理 → 1本目が閉じられる(code 4000: replaced_by_new_connection)
    const second = connect(ALLOWED_ORIGIN);
    const closeCodePromise = waitEvent(first, "close");
    await waitEvent(second, "open");
    const closeCode = await closeCodePromise;

    expect(closeCode).toBe(4000);
    expect(second.readyState).toBe(WebSocket.OPEN);
  });

  it("許可リスト外 Origin は 403 で拒否され、既存の正規接続を切断しない", async () => {
    // 既存の正規 WS 接続を1本張っておく
    const legit = connect(ALLOWED_ORIGIN);
    await waitEvent(legit, "open");

    // 不正 Origin のリクエストは onRequest フックで 403(WS ハンドラ以前に短絡)。
    // in-process の inject を使い、置換ロジックに触れないことを確認する。
    const rejected = await app.inject({
      method: "GET",
      url: "/ws",
      headers: { origin: FORBIDDEN_ORIGIN, connection: "upgrade", upgrade: "websocket" }
    });
    expect(rejected.statusCode).toBe(403);

    // 許可 Origin なら onRequest を通過する(403 ではない=境界で弾かれない)
    const allowed = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: ALLOWED_ORIGIN }
    });
    expect(allowed.statusCode).toBe(200);

    // 不正 Origin の試行後も、既存の正規接続は生きたまま(切断されない)
    expect(legit.readyState).toBe(WebSocket.OPEN);
  });
});
