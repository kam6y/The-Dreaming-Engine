import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * リポジトリ直下の `.env` をサーバー起動時に process.env へ読み込む小モジュール。
 *
 * サーバーは `.env` を暗黙には読まないため、認証トークン(既定 `CLAUDE_CODE_OAUTH_TOKEN`、
 * 代替 `ANTHROPIC_API_KEY`: CLAUDE.md「実行環境の前提」)等を `.env` に置くだけで live 起動
 * できるようにする。`index.ts` の**最初**(loadRuntimeConfig / createServer が env を読む前)で
 * `loadDotEnv()` を呼ぶ。
 *
 * 安全性の根拠(既存 env が優先されること):
 * - Node ネイティブの `process.loadEnvFile`(= `--env-file` と同じパーサ)は、既に
 *   `process.env` に存在するキーを**上書きしない**(実測確認済み。環境変数が `.env` より優先)。
 * - このため `pnpm dev:mock`(`AI_MODE=mock` を注入)や E2E(Playwright webServer が
 *   `AI_MODE=mock` を注入)は、`.env` に `AI_MODE=live` があっても侵食されず mock のまま。
 *   フェイルセーフ(未設定・不正値=mock / テスト実行下の live 拒否)を壊さない。
 * - CLAUDE.md の規約により、値の読み出し・ログ出力・件数の出力はしない。
 */

/**
 * リポジトリ直下 `.env` の絶対パス。本モジュールは src(テスト時)/ dist(実行時=
 * `packages/server/dist/env.js`)いずれも `packages/server/<src|dist>` 配下にあり、
 * リポジトリ直下はどちらからも3つ上(`../../../.env`)。
 */
export function repoEnvPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "..", ".env");
}

/** `NodeJS.ErrnoException`(`code` を持つ Error)かを判定する型ガード */
function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

/**
 * 指定ファイル(既定=リポジトリ直下 `.env`)を process.env へ読み込む。
 *
 * @param filePath 読み込む `.env` のパス(テスト注入用に差し替え可能)。既定はリポジトリ直下。
 * @returns 実際に読み込んだら `true`、ファイルが存在せずスキップしたら `false`。
 *
 * 欠落(ENOENT)は正常系として黙ってスキップする(fresh clone・mock 開発・CI では `.env` 不要)。
 * それ以外の失敗(権限エラー等)は握りつぶさず投げ直す。
 */
export function loadDotEnv(filePath: string = repoEnvPath()): boolean {
  try {
    process.loadEnvFile(filePath);
    return true;
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return false; // .env が無い(mock 開発・CI など)。何もしない
    }
    throw error;
  }
}
