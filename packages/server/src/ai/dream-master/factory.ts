import type { AiConfig } from "../config.js";
import type { AiMode } from "../mode.js";
import { createLiveDreamMaster } from "./live.js";
import { MockDreamMaster } from "./mock.js";
import type { DreamMaster } from "./types.js";

/**
 * `AiMode` に応じた DreamMaster を生成するファクトリ。
 * - `mock` → `MockDreamMaster`(実AI呼び出しなし。開発・E2E の既定)
 * - `live` → `createLiveDreamMaster`(M4-D 実装。現時点は未実装エラーを投げるプレースホルダ)
 *
 * `mode` は `resolveAiMode(env)` の結果を渡す想定(未設定・不正値は mock にフェイルセーフ済み)。
 * 悪意モードの Mock が必要なテストは `new MockDreamMaster(config, { malicious: true })` を直接使う。
 */
export function createDreamMaster(mode: AiMode, config: AiConfig): DreamMaster {
  if (mode === "mock") {
    return new MockDreamMaster(config);
  }
  return createLiveDreamMaster();
}
