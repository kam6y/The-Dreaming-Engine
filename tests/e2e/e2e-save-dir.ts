import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * E2E専用のセーブディレクトリ(絶対パス)。
 *
 * 人間のプレイセーブ(既定の `packages/server/saves/`)をE2Eが絶対に
 * 読み書きしないよう、テスト専用の隔離ディレクトリへ切り替える
 * (game-design.md「セーブ/ロード」)。playwright.config.ts が webServer の
 * `SAVE_DIR` 環境変数に渡し、global-setup.ts が実行開始時にここを削除する。
 *
 * このモジュールは tests/e2e 配下にあるため、リポジトリ直下は `../..`。
 * 相対パスで SAVE_DIR を渡すとサーバー側 cwd(packages/server)基準に
 * なってしまうため、必ず絶対パスで解決する(resolveSaveDir は絶対パスを尊重する)。
 */
const here = path.dirname(fileURLToPath(import.meta.url));
export const E2E_SAVE_DIR = path.resolve(here, "..", "..", "test-results", "e2e-saves");

/** E2E専用セーブファイル(save1.json)の絶対パス。fsでの実在確認に使う */
export const E2E_SAVE_FILE = path.join(E2E_SAVE_DIR, "save1.json");
