import { describe, expect, it } from "vitest";

import {
  GAME_TITLE,
  clientMessageSchema,
  serverMessageSchema
} from "../src/index.js";

describe("WebSocket message schemas", () => {
  it("accepts a client ping message", () => {
    const parsed = clientMessageSchema.parse({ type: "ping", sentAt: 1 });

    expect(parsed).toEqual({ type: "ping", sentAt: 1 });
  });

  it("rejects an unknown client message type", () => {
    expect(() => clientMessageSchema.parse({ type: "dream" })).toThrow();
  });

  it("accepts the server state and pong messages used by the M0 smoke path", () => {
    expect(serverMessageSchema.parse({ type: "state", title: GAME_TITLE })).toEqual({
      type: "state",
      title: GAME_TITLE
    });
    expect(
      serverMessageSchema.parse({ type: "pong", sentAt: 1, receivedAt: 2 })
    ).toEqual({ type: "pong", sentAt: 1, receivedAt: 2 });
  });
});
