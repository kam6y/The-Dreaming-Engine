import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import type { ServerMessage } from "@dreaming-engine/shared";
import type { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuditLog } from "../src/ai/audit-log.js";
import { loadAiConfig } from "../src/ai/config.js";
import { MockDreamMaster } from "../src/ai/dream-master/index.js";
import { AiFlowGatekeeper, AiTurnExecutor } from "../src/ai/flow-control/index.js";
import { RateLimiter } from "../src/ai/rate-limit.js";
import { GameSession } from "../src/game/session.js";
import type { LoadResult, SaveStore } from "../src/game/save.js";
import { createServer } from "../src/server.js";

/**
 * サーバー自発 push の配線(統合)。話しかけの2段階化に伴い、挨拶生成(AI)の完了は
 * サーバー直列チェーンの外の完了ハンドラで確定し、そこから現接続の WS へ [snapshot, speak] を
 * push する。実 Fastify + WebSocket を 127.0.0.1 の一時ポートで起ち上げ、
 * 接続→interact→挨拶 push が socket に届くことを機械検証する(AI は MockDreamMaster=実呼び出しなし)。
 */

const ALLOWED_ORIGIN = "http://localhost:5173";

/** セーブへ触れないインメモリ SaveStore */
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

/** MockDreamMaster を組んだ gatekeeper 付きセッションを作る(監査ログは一時ディレクトリ) */
function makeGatekeeperSession(auditDir: string): GameSession {
  const config = loadAiConfig({ sessionCallLimit: 1000 });
  const clock = (): number => Date.now();
  const auditLog = new AuditLog({ dir: auditDir });
  const executor = new AiTurnExecutor({ dreamMaster: new MockDreamMaster(config), config });
  const gatekeeper = new AiFlowGatekeeper({
    executor,
    config,
    rateLimiter: new RateLimiter(clock),
    auditLog,
    now: clock
  });
  return new GameSession({
    saveStore: new MemorySaveStore(),
    noSymbols: true,
    gatekeeper,
    playerInputMaxLength: config.playerInputMaxLength
  });
}

describe("サーバー自発 push: 話しかけの挨拶が WS で届く(統合)", () => {
  let app: FastifyInstance;
  let port: number;
  let session: GameSession;
  const openSockets: WebSocket[] = [];
  const tmpDirs: string[] = [];

  beforeEach(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "de-push-audit-"));
    tmpDirs.push(dir);
    session = makeGatekeeperSession(dir);
    // 情報屋カイの正面へ立たせておく(WS からは座標を動かせないため事前に仕込む)
    await session.handle({ type: "new-game" });
    const state = session.getState();
    if (state === null) throw new Error("new-game 後に state が null");
    state.location = { mapId: "town", position: { x: 4, y: 9 }, facing: "down" };

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
    for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  function connect(): WebSocket {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { origin: ALLOWED_ORIGIN } });
    openSockets.push(socket);
    return socket;
  }

  /** socket の受信メッセージから、述語に一致する最初のものを待つ(タイムアウト付き) */
  function waitForMessage(
    socket: WebSocket,
    predicate: (m: ServerMessage) => boolean,
    timeoutMs = 4000
  ): Promise<ServerMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("メッセージがタイムアウト")), timeoutMs);
      socket.on("message", (data) => {
        const parsed = JSON.parse(data.toString()) as ServerMessage;
        if (predicate(parsed)) {
          clearTimeout(timer);
          resolve(parsed);
        }
      });
    });
  }

  it("接続→interact で、挨拶(ai-utterance/speak)が push で届く", async () => {
    const socket = connect();
    // 接続時に hello + snapshot が届く(state が既にあるため)。snapshot を待って同期完了を確認
    await waitForMessage(socket, (m) => m.type === "snapshot");

    // interact を送ると、即時応答の snapshot(挨拶待ち)に続き、挨拶生成の完了 push で speak が届く
    socket.send(JSON.stringify({ type: "interact" }));
    const speak = await waitForMessage(
      socket,
      (m) => m.type === "ai-utterance" && m.channel === "speak"
    );

    expect(speak.type).toBe("ai-utterance");
    if (speak.type === "ai-utterance") {
      expect(speak.channel).toBe("speak");
      expect(speak.npcId).toBe("informant");
      expect(speak.text.length).toBeGreaterThan(0);
    }
  });
});
