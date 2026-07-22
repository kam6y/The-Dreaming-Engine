import { describe, expect, it } from "vitest";

import {
  API_KEY_ENV,
  OAUTH_TOKEN_ENV,
  hasCredential,
  resolveAiAuth
} from "../src/ai/auth.js";

/**
 * 認証抽象(OAuth 優先)のユニットテスト(ai-integration.md 32-44 / CLAUDE.md「実行環境の前提」)。
 *
 * - **値は使わずダミー名で検証**(実キー形式リテラルをソースに置かない: 品質ゲート5)。
 * - 判定はキー名の「有無」のみ。採用結果と、SDK へ渡す env の取捨(非採用資格情報の除去)を検証する。
 */

// ダミー値(実キー形式 sk-ant- 等に該当しない無害な文字列)
const DUMMY_OAUTH = "dummy-oauth-token-value";
const DUMMY_API_KEY = "dummy-api-key-value";

describe("hasCredential: キー名の有無のみを判定(空白のみは未設定)", () => {
  it("非空文字列は存在扱い", () => {
    expect(hasCredential({ [OAUTH_TOKEN_ENV]: DUMMY_OAUTH }, OAUTH_TOKEN_ENV)).toBe(true);
  });

  it("未設定・空文字・空白のみは未設定扱い", () => {
    expect(hasCredential({}, OAUTH_TOKEN_ENV)).toBe(false);
    expect(hasCredential({ [OAUTH_TOKEN_ENV]: "" }, OAUTH_TOKEN_ENV)).toBe(false);
    expect(hasCredential({ [OAUTH_TOKEN_ENV]: "   " }, OAUTH_TOKEN_ENV)).toBe(false);
  });
});

describe("resolveAiAuth: 採用結果と env の取捨", () => {
  it("OAuth のみ → oauth を採用。env に OAuth を残し API キーは含まない", () => {
    const { kind, env } = resolveAiAuth({ [OAUTH_TOKEN_ENV]: DUMMY_OAUTH, PATH: "/usr/bin" });
    expect(kind).toBe("oauth");
    expect(env[OAUTH_TOKEN_ENV]).toBe(DUMMY_OAUTH);
    expect(env[API_KEY_ENV]).toBeUndefined();
    // ベース env(PATH 等)は引き継ぐ(SDK は options.env を完全置換するため)
    expect(env.PATH).toBe("/usr/bin");
  });

  it("API キーのみ → api_key を採用。env に API キーを残し OAuth は含まない", () => {
    const { kind, env } = resolveAiAuth({ [API_KEY_ENV]: DUMMY_API_KEY });
    expect(kind).toBe("api_key");
    expect(env[API_KEY_ENV]).toBe(DUMMY_API_KEY);
    expect(env[OAUTH_TOKEN_ENV]).toBeUndefined();
  });

  it("両方あり → OAuth を優先し、非採用の API キーを env から外す(native 優先を無効化)", () => {
    const { kind, env } = resolveAiAuth({
      [OAUTH_TOKEN_ENV]: DUMMY_OAUTH,
      [API_KEY_ENV]: DUMMY_API_KEY
    });
    expect(kind).toBe("oauth");
    expect(env[OAUTH_TOKEN_ENV]).toBe(DUMMY_OAUTH);
    // 優先制御: 採用しなかった API キーは SDK へ渡さない
    expect(env[API_KEY_ENV]).toBeUndefined();
  });

  it("OAuth が空・API キーあり → env1つの差し替えで api_key へ切り替わる", () => {
    const { kind, env } = resolveAiAuth({ [OAUTH_TOKEN_ENV]: "", [API_KEY_ENV]: DUMMY_API_KEY });
    expect(kind).toBe("api_key");
    expect(env[API_KEY_ENV]).toBe(DUMMY_API_KEY);
    expect(env[OAUTH_TOKEN_ENV]).toBeUndefined();
  });

  it("どちらも無ければエラー(メッセージに値を含めない)", () => {
    expect(() => resolveAiAuth({})).toThrow(OAUTH_TOKEN_ENV);
    // 値(ダミー)を渡していないので、当然メッセージに値は現れない(キー名のみ案内)
    try {
      resolveAiAuth({ PATH: "/usr/bin" });
      throw new Error("should have thrown");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain(OAUTH_TOKEN_ENV);
      expect(message).toContain(API_KEY_ENV);
    }
  });

  it("env は元オブジェクトを破壊しない(コピーを返す)", () => {
    const source = { [OAUTH_TOKEN_ENV]: DUMMY_OAUTH, [API_KEY_ENV]: DUMMY_API_KEY };
    resolveAiAuth(source);
    // 元の env は変更されない(delete はコピーに対して行う)
    expect(source[API_KEY_ENV]).toBe(DUMMY_API_KEY);
  });
});
