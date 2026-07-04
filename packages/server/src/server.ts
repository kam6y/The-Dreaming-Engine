import websocket from "@fastify/websocket";
import { clientMessageSchema, type ServerMessage } from "@dreaming-engine/shared";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import type { WebSocket } from "ws";

import { AuditLog } from "./ai/audit-log.js";
import { loadAiConfig } from "./ai/config.js";
import { createDreamMaster } from "./ai/dream-master/index.js";
import { AiFlowGatekeeper, AiTurnExecutor } from "./ai/flow-control/index.js";
import { resolveAiMode } from "./ai/mode.js";
import { RateLimiter } from "./ai/rate-limit.js";
import { GameSession } from "./game/session.js";
import { FileSaveStore, resolveSaveDir } from "./game/save.js";
import { DEFAULT_ALLOWED_ORIGINS, isAllowedOrigin } from "./origin.js";

export interface CreateServerOptions {
  allowedOrigins?: readonly string[];
  /** ゲームセッションを注入する(テスト用)。未指定なら env から既定を組む */
  session?: GameSession;
}

function sendJson(socket: WebSocket, message: ServerMessage): void {
  socket.send(JSON.stringify(message));
}

function rejectForbiddenOrigin(reply: FastifyReply): void {
  reply.code(403).send({ error: "forbidden_origin" });
}

/**
 * 環境変数から既定のゲームセッションを組む(GAME_SEED / GAME_NO_SYMBOLS / SAVE_DIR / AI_MODE)。
 * AI は resolveAiMode(env)→createDreamMaster→AiTurnExecutor→AiFlowGatekeeper の順で組む。
 * mock 経路では実 AI・認証解決は一切発生しない(AI_MODE 未設定・不正値は mock フェイルセーフ)。
 */
export function createDefaultSession(env: NodeJS.ProcessEnv): GameSession {
  const saveStore = new FileSaveStore(resolveSaveDir(env));
  const seedRaw = env.GAME_SEED;
  const seed = seedRaw !== undefined && Number.isFinite(Number(seedRaw)) ? Number(seedRaw) : undefined;
  const noSymbols = env.GAME_NO_SYMBOLS === "1";

  const aiConfig = loadAiConfig();
  const clock = (): number => Date.now();
  const dreamMaster = createDreamMaster(resolveAiMode(env), aiConfig);
  const executor = new AiTurnExecutor({ dreamMaster, config: aiConfig });
  const gatekeeper = new AiFlowGatekeeper({
    executor,
    config: aiConfig,
    rateLimiter: new RateLimiter(clock),
    auditLog: new AuditLog(),
    now: clock
  });

  return new GameSession({
    saveStore,
    ...(seed !== undefined ? { seed } : {}),
    noSymbols,
    gatekeeper,
    playerInputMaxLength: aiConfig.playerInputMaxLength
  });
}

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const allowedOrigins = options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  // GameState はプロセス全体で1つ(WS再接続をまたいで保持する。ai-integration.md「全体像」)
  const session = options.session ?? createDefaultSession(process.env);
  const app = Fastify({ logger: true });
  let activeSocket: WebSocket | undefined;

  app.addHook("onRequest", (request, reply, done) => {
    if (!isAllowedOrigin(request.headers.origin, allowedOrigins)) {
      rejectForbiddenOrigin(reply);
      return;
    }
    done();
  });

  await app.register(websocket);

  app.get("/health", async () => ({ ok: true }));

  app.get("/ws", { websocket: true }, (socket) => {
    // WS同時接続は1本のみ維持(既存を切ってから新規を受ける)
    if (activeSocket !== undefined && activeSocket.readyState === activeSocket.OPEN) {
      activeSocket.close(4000, "replaced_by_new_connection");
    }
    activeSocket = socket;

    // 接続確立時: hello(セーブ有無)+ ゲーム進行中なら現スナップショットで再同期
    void session
      .connect()
      .then((messages) => {
        for (const message of messages) sendJson(socket, message);
      })
      .catch((err: unknown) => {
        app.log.error(err);
      });

    // メッセージ処理を直列化(save/load の await 中に次のメッセージが割り込まないように)
    let chain: Promise<void> = Promise.resolve();
    socket.on("message", (data) => {
      chain = chain
        .then(async () => {
          let json: unknown;
          try {
            json = JSON.parse(data.toString());
          } catch {
            sendJson(socket, { type: "error", message: "不正なメッセージです", code: "invalid-message" });
            return;
          }
          const parsed = clientMessageSchema.safeParse(json);
          if (!parsed.success) {
            sendJson(socket, { type: "error", message: "不正なメッセージです", code: "invalid-message" });
            return;
          }
          // ping は接続レベルの疎通確認としてここで応答する
          if (parsed.data.type === "ping") {
            sendJson(socket, { type: "pong", sentAt: parsed.data.sentAt, receivedAt: Date.now() });
            return;
          }
          const responses = await session.handle(parsed.data);
          for (const response of responses) sendJson(socket, response);
        })
        .catch((err: unknown) => {
          app.log.error(err);
          sendJson(socket, { type: "error", message: "夢の紡ぎに乱れが生じた。", code: "internal" });
        });
    });

    socket.on("close", () => {
      if (activeSocket === socket) {
        activeSocket = undefined;
      }
    });
  });

  return app;
}
