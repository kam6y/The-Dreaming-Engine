import { defineConfig } from "vitest/config";

/**
 * 実AI疎通テスト専用の Vitest 設定(`pnpm test:ai-live` からのみ使用)。
 *
 * - 対象は `.ailive.ts` サフィックス(通常の `.test.ts` とは別)であり、
 *   通常の `pnpm check` / `pnpm test`(vitest.config.ts の include は `.test.ts` のみ)からは
 *   完全に除外される(実AI誤爆・サブスク枠消費の防止)。
 * - 実行は人間が明示的に `pnpm test:ai-live` を叩いたときだけ(AI_LIVE_TEST=1 AI_MODE=live)。
 * - 資格情報が無い・AI_LIVE_TEST 未設定なら各テストはガードで skip する。
 * - 実 API はレイテンシがあるためテストタイムアウトを延長する。
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/server/test/ai-live/**/*.ailive.ts"],
    // ガードで全テストが skip されても失敗にしない(資格情報未設定時の保護)
    passWithNoTests: true,
    testTimeout: 60_000,
    hookTimeout: 60_000
  }
});
