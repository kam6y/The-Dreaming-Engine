import { describe, expect, it } from "vitest";

import { loadRuntimeConfig, resolveAiMode } from "../src/config.js";

describe("resolveAiMode", () => {
  it("falls back to mock when AI_MODE is missing or invalid", () => {
    expect(resolveAiMode(undefined, { allowLive: false })).toBe("mock");
    expect(resolveAiMode("typo", { allowLive: false })).toBe("mock");
  });

  it("rejects live mode in normal test execution", () => {
    expect(() => resolveAiMode("live", { allowLive: false })).toThrow(
      /AI_MODE=live/
    );
  });

  it("allows live mode only for explicit live AI checks", () => {
    expect(resolveAiMode("live", { allowLive: true })).toBe("live");
  });

  it("always binds the server to 127.0.0.1 even if HOST is set", () => {
    expect(loadRuntimeConfig({ HOST: "0.0.0.0" }).host).toBe("127.0.0.1");
  });
});
