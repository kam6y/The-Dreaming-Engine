/**
 * ゲーム内AIの認証抽象(ai-integration.md「認証は環境変数で抽象化」32-44 /
 * CLAUDE.md「実行環境の前提」)。
 *
 * 方針(セキュリティ最優先):
 * - **値は一切読まない・出力しない・転記しない**。判定するのはキー名の「有無」だけ
 *   (空文字・空白のみは「未設定」とみなす。`.env.example` の `KEY=` は未設定扱い)。
 * - 既定は `CLAUDE_CODE_OAUTH_TOKEN`(サブスクの OAuth トークン)。無ければ
 *   `ANTHROPIC_API_KEY`。**両方ある場合は OAuth を優先**(CLAUDE.md)。
 * - Agent SDK / CLI 本体は native には `ANTHROPIC_API_KEY` を優先するため、優先制御は
 *   本抽象側で行う: **採用しなかった資格情報をサブプロセスへ渡す env から外す**ことで、
 *   SDK に「採用した資格情報だけ」を見せる(ai-integration.md 36-38)。
 * - env 変数1つの差し替え(OAuth を消して API キーを残す等)だけで切り替わる。
 * - どちらも無い場合は明快なエラー(値は出さない)。呼び出しは Live 構築時のみで、
 *   mock 経路では発生しない(factory が mock では Live を new しない)。
 */

/** 既定の OAuth 認証(サブスク)。`claude setup-token` で発行 */
export const OAUTH_TOKEN_ENV = "CLAUDE_CODE_OAUTH_TOKEN";
/** 代替の API キー認証 */
export const API_KEY_ENV = "ANTHROPIC_API_KEY";

/** 採用した資格情報の種別 */
export type AiCredentialKind = "oauth" | "api_key";

/** 認証解決の結果。`env` は query の `options.env` にそのまま渡すサブプロセス環境変数 */
export interface AiAuthResolution {
  /** 採用した資格情報の種別(監査・ログ表示用。値は含まない) */
  readonly kind: AiCredentialKind;
  /**
   * SDK サブプロセスへ渡す環境変数一式。ベースの env を引き継ぎつつ、
   * **採用しなかった資格情報だけを取り除いた**もの(優先制御)。
   * SDK は options.env をサブプロセス環境として「完全置換」するため、
   * PATH/HOME 等を含むベース env を引き継ぐ必要がある(sdk.d.ts Options.env)。
   */
  readonly env: Record<string, string>;
}

/** キー名の「有無」だけを判定する(値の内容は一切参照しない。空白のみは未設定扱い) */
export function hasCredential(env: NodeJS.ProcessEnv, name: string): boolean {
  const value = env[name];
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * env から採用する資格情報を決め、SDK へ渡す env を組み立てる。
 * OAuth 優先。どちらも無ければエラー(値は出さない)。
 */
export function resolveAiAuth(env: NodeJS.ProcessEnv = process.env): AiAuthResolution {
  const hasOauth = hasCredential(env, OAUTH_TOKEN_ENV);
  const hasApiKey = hasCredential(env, API_KEY_ENV);

  if (!hasOauth && !hasApiKey) {
    // 値は出さない。キー名のみで復旧手順を案内する。
    throw new Error(
      `実AIの認証情報が見つかりません。${OAUTH_TOKEN_ENV}(既定)または ${API_KEY_ENV} を .env に設定してください。`
    );
  }

  const kind: AiCredentialKind = hasOauth ? "oauth" : "api_key";

  // ベース env(定義済みの文字列値のみ)をコピーする。値の内容は参照しない。
  const passthrough: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") passthrough[key] = value;
  }

  // 採用しなかった資格情報を取り除く(SDK/CLI の native 優先順位を無効化し、優先制御を成立させる)。
  if (kind === "oauth") {
    delete passthrough[API_KEY_ENV];
  } else {
    delete passthrough[OAUTH_TOKEN_ENV];
  }

  return { kind, env: passthrough };
}
