/**
 * AI_MODE 解決(フェイルセーフ)。ai-integration.md「レート・コスト保護」/
 * guardrails「AI_MODE フェイルセーフ」。
 *
 * - 実 AI を使うのは明示的な `AI_MODE=live` のみ。未設定・不正値(typo 等)は mock。
 * - ユニット/E2E テストの実行下では `AI_MODE=live` を起動時エラーで拒否する
 *   (設定漏れによる実 AI 誤爆とサブスク枠消費を機構で防ぐ)。
 *   例外は明示フラグ `AI_LIVE_TEST=1`(`pnpm test:ai-live` だけが立てる)。
 *
 * 注記: 既存の `src/config.ts` にも旧 `resolveAiMode` があるが、そちらは
 * `DREAMING_ENGINE_ALLOW_LIVE_AI` フラグを外部注入する設計。本モジュールは env から
 * テスト実行下を自動判定する M4 仕様の版であり、両者の統合は後続の配線タスクで行う
 * (それまでは互いに独立。共通バレルからの二重 export はしない=名前衝突回避)。
 */

export type AiMode = "mock" | "live";

/** テスト実行下かどうかを env の指標から判定する(Vitest は VITEST/NODE_ENV/VITEST_WORKER_ID を設定する) */
export function isUnderTest(env: NodeJS.ProcessEnv): boolean {
  return (
    env.VITEST !== undefined ||
    env.VITEST_WORKER_ID !== undefined ||
    env.NODE_ENV === "test"
  );
}

/** 明示的な実 AI テストフラグ(`pnpm test:ai-live` のみが立てる) */
export function isExplicitLiveTest(env: NodeJS.ProcessEnv): boolean {
  return env.AI_LIVE_TEST === "1";
}

/**
 * env から AI_MODE を解決する。
 * - `AI_MODE=live` 以外(未設定・不正値・"mock")はすべて mock(フェイルセーフ)。
 * - `AI_MODE=live` かつテスト実行下かつ明示フラグなし → 起動時エラー。
 * - `AI_MODE=live` かつ(テスト外 または 明示フラグあり)→ live。
 */
export function resolveAiMode(env: NodeJS.ProcessEnv): AiMode {
  if (env.AI_MODE !== "live") {
    return "mock";
  }

  if (isUnderTest(env) && !isExplicitLiveTest(env)) {
    throw new Error(
      "テスト実行下での AI_MODE=live は拒否されます。実 AI 疎通は pnpm test:ai-live(AI_LIVE_TEST=1)でのみ行います。"
    );
  }

  return "live";
}
