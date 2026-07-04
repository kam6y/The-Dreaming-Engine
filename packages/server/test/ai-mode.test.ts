import { describe, expect, it } from "vitest";

import { resolveAiMode } from "../src/ai/mode.js";

describe("resolveAiMode(env)", () => {
  it("AI_MODE 未設定は mock(フェイルセーフ)", () => {
    expect(resolveAiMode({})).toBe("mock");
  });

  it("不正値(typo)は mock", () => {
    expect(resolveAiMode({ AI_MODE: "liveee" })).toBe("mock");
    expect(resolveAiMode({ AI_MODE: "LIVE" })).toBe("mock");
    expect(resolveAiMode({ AI_MODE: "mock" })).toBe("mock");
  });

  it("テスト外の AI_MODE=live は live", () => {
    // VITEST 等のテスト指標を含まない env
    expect(resolveAiMode({ AI_MODE: "live" })).toBe("live");
  });

  it("テスト実行下の AI_MODE=live は起動時エラー", () => {
    expect(() => resolveAiMode({ AI_MODE: "live", VITEST: "true" })).toThrow(/AI_MODE=live/);
    expect(() => resolveAiMode({ AI_MODE: "live", NODE_ENV: "test" })).toThrow(/AI_MODE=live/);
    expect(() => resolveAiMode({ AI_MODE: "live", VITEST_WORKER_ID: "0" })).toThrow(/AI_MODE=live/);
  });

  it("テスト実行下 + 明示フラグ(AI_LIVE_TEST=1)は live", () => {
    expect(
      resolveAiMode({ AI_MODE: "live", VITEST: "true", AI_LIVE_TEST: "1" })
    ).toBe("live");
  });

  it("明示フラグがあっても AI_MODE!=live なら mock のまま", () => {
    expect(resolveAiMode({ AI_LIVE_TEST: "1", VITEST: "true" })).toBe("mock");
  });
});
