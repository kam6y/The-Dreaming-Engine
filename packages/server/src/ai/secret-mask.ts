/**
 * 機密マスク(純関数)。監査ログ・セーブ永続化など、平文が焼き込まれ得る全経路の
 * 手前で適用する(ai-integration.md「監査ログ」/ guardrails 第5層)。
 *
 * マスク対象(既知の機密パターン):
 *  1. 認証系環境変数の値(注入された env から実値を拾って伏せる)
 *  2. Authorization ヘッダ(`Authorization: Bearer ...` の資格情報部)
 *  3. `sk-` / `sk-ant-` 形式のトークン様文字列
 *
 * 実キー形式のリテラルはソースに置かない(接頭辞・パターンのみ。CLAUDE.md 品質ゲート5)。
 */

/** マスク後の置換文字列 */
export const MASK_PLACEHOLDER = "[MASKED]";

/** 実値を伏せる認証系環境変数のキー名(値そのものは読み書きしない: CLAUDE.md 禁止事項) */
export const AUTH_ENV_KEYS = [
  "CLAUDE_CODE_OAUTH_TOKEN",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "AWS_BEARER_TOKEN_BEDROCK"
] as const;

/** env 実値マスクで対象にする最小長(短すぎる値の誤爆を避ける) */
const MIN_ENV_VALUE_LENGTH = 8;

// Authorization / Proxy-Authorization ヘッダの資格情報部(Bearer 有無どちらも)を伏せる
const AUTH_HEADER_PATTERN = /((?:proxy-)?authorization)(\s*[:=]\s*)(?:bearer\s+)?\S+/gi;

// sk- / sk-ant- 形式のトークン様文字列(接頭辞+英数字列。実キーリテラルではない)
const SK_TOKEN_PATTERN = /\bsk-(?:ant-)?[A-Za-z0-9_-]{8,}/g;

export interface MaskOptions {
  /** 認証系環境変数の実値を拾う env(既定 process.env)。テストで注入可能 */
  env?: NodeJS.ProcessEnv;
}

/** 全ての正規表現特殊文字をエスケープ(env 実値をリテラル検索するため) */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 入力文字列から既知の機密を [MASKED] に置換する。副作用なし・純関数。
 * env 実値 → Authorization ヘッダ → sk トークンの順で適用する。
 */
export function maskSecrets(input: string, options: MaskOptions = {}): string {
  const env = options.env ?? process.env;
  let out = input;

  // 1. 認証系環境変数の実値をリテラル一致で伏せる
  for (const key of AUTH_ENV_KEYS) {
    const value = env[key];
    if (value !== undefined && value.length >= MIN_ENV_VALUE_LENGTH) {
      out = out.replace(new RegExp(escapeRegExp(value), "g"), MASK_PLACEHOLDER);
    }
  }

  // 2. Authorization ヘッダの資格情報部
  out = out.replace(AUTH_HEADER_PATTERN, `$1$2${MASK_PLACEHOLDER}`);

  // 3. sk- / sk-ant- トークン様文字列
  out = out.replace(SK_TOKEN_PATTERN, MASK_PLACEHOLDER);

  return out;
}

/**
 * 任意の値(文字列・配列・オブジェクト)を再帰的に走査し、含まれる全ての文字列へ
 * `maskSecrets` を適用したコピーを返す。監査ログの「全フィールド無条件マスク」に使う。
 * 数値・真偽値・null 等はそのまま返す。
 */
export function maskDeep(value: unknown, options: MaskOptions = {}): unknown {
  if (typeof value === "string") {
    return maskSecrets(value, options);
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskDeep(item, options));
  }
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = maskDeep(item, options);
    }
    return result;
  }
  return value;
}
