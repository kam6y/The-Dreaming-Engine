import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadDotEnv } from "../src/env.js";

/**
 * `.env` ローダーの単体テスト。
 *
 * - `process.env` はプロセス全体で共有される可変状態なので、フィクスチャで導入するキーは
 *   衝突しないユニークな接頭辞にし、afterEach で必ず全削除して汚染を残さない。
 * - フィクスチャの値には実キー形式(`sk-ant-` 接頭辞+長い英数字列)を**置かない**
 *   (CLAUDE.md のシークレットスキャン規約)。ここで検証したいのは「載る/上書きしない」だけ。
 */

// このテストが process.env に導入し得るキー(afterEach で全削除する)
const INTRODUCED_KEYS = [
  "DREAMING_ENGINE_ENV_TEST_LOADED",
  "DREAMING_ENGINE_ENV_TEST_EXISTING"
] as const;

afterEach(() => {
  for (const key of INTRODUCED_KEYS) {
    delete process.env[key];
  }
});

async function writeFixtureEnv(contents: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "de-env-"));
  const filePath = path.join(dir, ".env");
  await writeFile(filePath, contents, "utf8");
  return filePath;
}

describe("loadDotEnv", () => {
  it("指定した .env のキーを process.env へ載せ、読み込んだら true を返す", async () => {
    const filePath = await writeFixtureEnv(
      "DREAMING_ENGINE_ENV_TEST_LOADED=loaded-from-file\n"
    );

    const loaded = loadDotEnv(filePath);

    expect(loaded).toBe(true);
    expect(process.env.DREAMING_ENGINE_ENV_TEST_LOADED).toBe("loaded-from-file");

    await rm(path.dirname(filePath), { recursive: true, force: true });
  });

  it("既存の process.env を上書きしない(dev:mock / E2E の AI_MODE 注入を侵食しない)", async () => {
    process.env.DREAMING_ENGINE_ENV_TEST_EXISTING = "already-set-wins";
    const filePath = await writeFixtureEnv(
      "DREAMING_ENGINE_ENV_TEST_EXISTING=from-file-must-not-win\n"
    );

    loadDotEnv(filePath);

    expect(process.env.DREAMING_ENGINE_ENV_TEST_EXISTING).toBe("already-set-wins");

    await rm(path.dirname(filePath), { recursive: true, force: true });
  });

  it("存在しないパスでは例外にならず false を返す(fresh clone / CI 保護)", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "de-env-"));
    const missing = path.join(dir, "does-not-exist.env");

    let loaded: boolean | undefined;
    expect(() => {
      loaded = loadDotEnv(missing);
    }).not.toThrow();
    expect(loaded).toBe(false);

    await rm(dir, { recursive: true, force: true });
  });
});
