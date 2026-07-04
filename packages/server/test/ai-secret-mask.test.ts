import { describe, expect, it } from "vitest";

import { MASK_PLACEHOLDER, maskDeep, maskSecrets } from "../src/ai/secret-mask.js";

// トークン様のフィクスチャは文字列連結で動的に組み立てる(実キー形式のリテラルを
// ソースに置かない: CLAUDE.md 品質ゲート5 / シークレットスキャンと衝突させない)。
const skAntToken = ["sk", "ant", "api03", "A".repeat(40)].join("-");
const skToken = ["sk", "x".repeat(24)].join("-");
const fakeAuthValue = ["tok", "0".repeat(30)].join("_");

describe("maskSecrets", () => {
  it("sk-ant- 形式のトークン様文字列を伏せる", () => {
    const masked = maskSecrets(`鍵は ${skAntToken} です`);
    expect(masked).not.toContain(skAntToken);
    expect(masked).toContain(MASK_PLACEHOLDER);
  });

  it("sk- 形式のトークン様文字列を伏せる", () => {
    const masked = maskSecrets(`token=${skToken}`);
    expect(masked).not.toContain(skToken);
    expect(masked).toContain(MASK_PLACEHOLDER);
  });

  it("Authorization ヘッダ(Bearer 付き)を伏せる", () => {
    const masked = maskSecrets(`Authorization: Bearer ${fakeAuthValue}`);
    expect(masked).not.toContain(fakeAuthValue);
    expect(masked).toBe(`Authorization: ${MASK_PLACEHOLDER}`);
  });

  it("Authorization ヘッダ(Bearer なし)も伏せる", () => {
    const masked = maskSecrets(`authorization=${fakeAuthValue}`);
    expect(masked).not.toContain(fakeAuthValue);
    expect(masked).toContain(MASK_PLACEHOLDER);
  });

  it("注入された env の認証系実値を伏せる", () => {
    const secret = ["oauth", "9".repeat(40)].join("-");
    const masked = maskSecrets(`貼り付け: ${secret} 以上`, {
      env: { CLAUDE_CODE_OAUTH_TOKEN: secret }
    });
    expect(masked).not.toContain(secret);
    expect(masked).toContain(MASK_PLACEHOLDER);
  });

  it("短すぎる env 値(8字未満)は誤爆させない", () => {
    const text = "ok あいうえお";
    const masked = maskSecrets(text, { env: { ANTHROPIC_API_KEY: "abc" } });
    expect(masked).toBe(text);
  });

  it("機密を含まない通常の日本語はそのまま", () => {
    const text = "旅人よ、今宵はよく眠りな。";
    expect(maskSecrets(text, { env: {} })).toBe(text);
  });
});

describe("maskDeep", () => {
  it("ネストした全文字列フィールドを再帰的にマスクし、非文字列は保つ", () => {
    const record = {
      playerInput: `これを渡す: ${skToken}`,
      durationMs: 1234,
      approved: true,
      toolCalls: [{ name: "give_item", reason: `key ${skAntToken}` }],
      nothing: null
    };
    const masked = maskDeep(record, { env: {} }) as typeof record;
    expect(masked.playerInput).not.toContain(skToken);
    expect(masked.playerInput).toContain(MASK_PLACEHOLDER);
    expect(masked.toolCalls[0]?.reason).not.toContain(skAntToken);
    // 非文字列はそのまま
    expect(masked.durationMs).toBe(1234);
    expect(masked.approved).toBe(true);
    expect(masked.nothing).toBeNull();
  });
});
