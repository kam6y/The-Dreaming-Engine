import { describe, expect, it } from "vitest";

import { loadRuntimeConfig } from "../src/config.js";

/**
 * `loadRuntimeConfig` の単体テスト。
 *
 * AI モード解決は `src/ai/mode.ts` の `resolveAiMode(env)` に一元委譲された
 * (旧 `config.ts` 版 resolveAiMode と `DREAMING_ENGINE_ALLOW_LIVE_AI` フラグは撤去済み)。
 * ここでは委譲が効いていること=フェイルセーフとテスト実行下の live 拒否ガードが
 * loadRuntimeConfig 経由でも保たれることを検証する(モード判定の網羅は ai-mode.test.ts /
 * guardrails/audit-and-mode.test.ts が担う。ここで重複させない)。
 */
describe("loadRuntimeConfig", () => {
  it("AI_MODE 未設定・不正値は mock(フェイルセーフを委譲経由でも維持)", () => {
    expect(loadRuntimeConfig({}).aiMode).toBe("mock");
    expect(loadRuntimeConfig({ AI_MODE: "typo" }).aiMode).toBe("mock");
  });

  it("テスト指標を含まない env の AI_MODE=live は live(例: pnpm dev)", () => {
    // 渡す env に VITEST 等の指標を含めないため isUnderTest=false → throw しない
    expect(loadRuntimeConfig({ AI_MODE: "live" }).aiMode).toBe("live");
  });

  it("テスト実行下の AI_MODE=live は起動時エラーで拒否(防御ガードが委譲後も生きている)", () => {
    expect(() => loadRuntimeConfig({ AI_MODE: "live", VITEST: "true" })).toThrow(
      /AI_MODE=live/
    );
  });

  it("host は HOST が設定されても常に 127.0.0.1 に固定する", () => {
    expect(loadRuntimeConfig({ HOST: "0.0.0.0" }).host).toBe("127.0.0.1");
  });

  it("PORT を解釈し、未設定なら 3000 を既定にする", () => {
    expect(loadRuntimeConfig({ PORT: "4321" }).port).toBe(4321);
    expect(loadRuntimeConfig({}).port).toBe(3000);
  });
});
