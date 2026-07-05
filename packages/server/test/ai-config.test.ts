import { describe, expect, it } from "vitest";

import { aiConfigSchema, loadAiConfig, type AiConfig } from "../src/ai/config.js";

/**
 * 本番デフォルト設定(config/ai.json)が ai-integration.md の仕様値と一致することの
 * スナップショット(guardrails「設定デフォルトの不変条件」)。
 * 防御デフォルトの弱体化(短縮・引き上げ)を自動検知する。
 */
const SPEC_DEFAULTS: AiConfig = {
  models: {
    haiku: "claude-haiku-4-5",
    sonnet: "claude-sonnet-5"
  },
  limits: {
    conversation: { maxTurns: 6, maxOutputTokens: 1000 },
    gm: { maxTurns: 8, maxOutputTokens: 2000 }
  },
  timeouts: {
    conversation: { firstTokenSeconds: 15, totalSeconds: 45 },
    questGeneration: { firstTokenSeconds: 30, totalSeconds: 90 },
    dream: { firstTokenSeconds: 30, totalSeconds: 90 },
    battleResult: { firstTokenSeconds: 10, totalSeconds: 30 },
    summary: { firstTokenSeconds: 15, totalSeconds: 45 }
  },
  cooldowns: {
    conversationStartSeconds: 10,
    dreamSeconds: 60,
    questGenerationSeconds: 30
  },
  conversationSendRateSeconds: 3,
  sessionCallLimit: 200,
  playerInputMaxLength: 200
};

describe("loadAiConfig(本番デフォルトの不変条件)", () => {
  it("config/ai.json が仕様値と完全に一致する", () => {
    expect(loadAiConfig()).toEqual(SPEC_DEFAULTS);
  });

  it("読み込んだ設定は zod スキーマを満たす", () => {
    expect(aiConfigSchema.safeParse(loadAiConfig()).success).toBe(true);
  });
});

describe("loadAiConfig(テスト用の部分上書き)", () => {
  it("トップレベル値を上書きしてもデフォルトは変わらない", () => {
    const overridden = loadAiConfig({ sessionCallLimit: 99999 });
    expect(overridden.sessionCallLimit).toBe(99999);
    // 上書きしていない値は据え置き
    expect(overridden.playerInputMaxLength).toBe(200);
    // 元のデフォルトは不変(再読込で仕様値)
    expect(loadAiConfig().sessionCallLimit).toBe(200);
  });

  it("ネストした値を深く上書きできる(クールダウンの短縮など)", () => {
    const overridden = loadAiConfig({
      cooldowns: { conversationStartSeconds: 0 },
      timeouts: { conversation: { totalSeconds: 1 } }
    });
    expect(overridden.cooldowns.conversationStartSeconds).toBe(0);
    // 同じ枝の未指定フィールドは維持
    expect(overridden.cooldowns.dreamSeconds).toBe(60);
    expect(overridden.timeouts.conversation.totalSeconds).toBe(1);
    expect(overridden.timeouts.conversation.firstTokenSeconds).toBe(15);
  });
});
