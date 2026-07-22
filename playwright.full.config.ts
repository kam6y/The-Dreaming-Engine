import { defineConfig } from "@playwright/test";

import { E2E_SAVE_DIR } from "./tests/e2e/e2e-save-dir.js";

// 通しプレイ E2E(pnpm test:e2e:full)専用の設定。
//
// コミット毎のスモーク(playwright.config.ts / pnpm test:e2e)とはスイートを分離する
// (ROADMAP M6:「pnpm test:e2e:full として分離し、コミット毎の test:e2e スモークには
// 含めない」)。この設定は tests/e2e/full 配下の *.full.spec.ts のみを実行し、スモーク側は
// testIgnore で full/** を除外して通しspecを拾わない。
//
// globalSetup(セーブ隔離ディレクトリの初期化)・webServer(AI_MODE=mock・SAVE_DIR 注入)・
// workers=1(WS同時1接続の直列実行)はスモーク設定から流用する。通しプレイは長いため
// テスト個別 timeout はスモーク(30s)より長い 240s とする(実時間は加速フラグで短縮する)。
export default defineConfig({
  testDir: "tests/e2e/full",
  testMatch: "**/*.full.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  webServer: {
    command: "pnpm dev:mock",
    url: "http://127.0.0.1:5173",
    // 人間のプレイセーブ(既定 saves/)を汚さないよう、セーブ先をテスト専用の絶対パスへ
    env: { SAVE_DIR: E2E_SAVE_DIR },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    // 通しプレイは1テストで数百アクション(キー送り・data 属性ポーリング)に及ぶ。
    // trace を採ると context 破棄時のトレース確定に数分かかりテスト timeout を圧迫するため
    // 無効化する(失敗時は撮影済みスクショ+エラーで足りる。スモークの trace は据え置き)。
    trace: "off"
  }
});
