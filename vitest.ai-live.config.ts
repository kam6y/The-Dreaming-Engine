import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * リポジトリ直下 `.env` を process.env へ読み込む(この config は Node/Vite が評価するため
 * ここが `pnpm test:ai-live` の env 読み込み点になる)。認証トークン(既定
 * `CLAUDE_CODE_OAUTH_TOKEN`)を `.env` に置くだけで資格情報ガードの skip が解消される。
 *
 * - 既存 env は上書きしない(`process.loadEnvFile` 既定=環境変数が優先)。よって
 *   `pnpm test:ai-live` が立てる `AI_MODE=live` / `AI_LIVE_TEST=1` は `.env` より優先される。
 * - `.env` 欠落(ENOENT)は正常系として無視する(無いと config 評価が壊れるのを防ぐ)。
 * - server 側 `packages/server/src/env.ts` と同方針の最小重複(ルート config から
 *   packages 配下の src を直接 import しないため、数行を複製する)。
 */
const repoEnvPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".env"
);
try {
  process.loadEnvFile(repoEnvPath);
} catch (error: unknown) {
  if (
    !(error instanceof Error) ||
    (error as NodeJS.ErrnoException).code !== "ENOENT"
  ) {
    throw error;
  }
}

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
