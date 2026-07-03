import websocket from "@fastify/websocket";
import {
  GAME_TITLE,
  clientMessageSchema,
  type ServerMessage
} from "@dreaming-engine/shared";
import Fastify, {
  type FastifyInstance,
  type FastifyReply
} from "fastify";
import type { WebSocket } from "ws";

import { DEFAULT_ALLOWED_ORIGINS, isAllowedOrigin } from "./origin.js";

export interface CreateServerOptions {
  allowedOrigins?: readonly string[];
}

function sendJson(socket: WebSocket, message: ServerMessage): void {
  socket.send(JSON.stringify(message));
}

function rejectForbiddenOrigin(reply: FastifyReply): void {
  reply.code(403).send({ error: "forbidden_origin" });
}

export async function createServer(
  options: CreateServerOptions = {}
): Promise<FastifyInstance> {
  const allowedOrigins = options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
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
    if (activeSocket !== undefined && activeSocket.readyState === activeSocket.OPEN) {
      activeSocket.close(4000, "replaced_by_new_connection");
    }

    activeSocket = socket;
    sendJson(socket, { type: "state", title: GAME_TITLE });

    socket.on("message", (data) => {
      const parsed = clientMessageSchema.safeParse(
        JSON.parse(data.toString()) as unknown
      );

      if (!parsed.success) {
        sendJson(socket, { type: "error", message: "不正なメッセージです" });
        return;
      }

      if (parsed.data.type === "ping") {
        sendJson(socket, {
          type: "pong",
          sentAt: parsed.data.sentAt,
          receivedAt: Date.now()
        });
      }
    });

    socket.on("close", () => {
      if (activeSocket === socket) {
        activeSocket = undefined;
      }
    });
  });

  return app;
}
