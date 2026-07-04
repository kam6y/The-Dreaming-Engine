import { defineConfig } from "@playwright/test";

import { E2E_SAVE_DIR } from "./tests/e2e/e2e-save-dir.js";

export default defineConfig({
  testDir: "tests/e2e",
  // 通しプレイ E2E(tests/e2e/full 配下)はコミット毎のスモークに含めない。
  // 専用設定 playwright.full.config.ts で pnpm test:e2e:full として実行する
  // (ROADMAP M6)。testDir は再帰探索するため full/** を明示除外する。
  testIgnore: "**/full/**",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  // 実行開始時にテスト専用セーブディレクトリを空にする(残存セーブ由来の
  // hasSave=true で新規ゲーム前提の既存スペックが壊れるのを防ぐ)
  globalSetup: "./tests/e2e/global-setup.ts",
  webServer: {
    command: "pnpm dev:mock",
    url: "http://127.0.0.1:5173",
    // 人間のプレイセーブ(既定 saves/)を汚さないよう、サーバーのセーブ先を
    // テスト専用の絶対パスへ切り替える(game-design.md「セーブ/ロード」)
    env: { SAVE_DIR: E2E_SAVE_DIR },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure"
  }
});
