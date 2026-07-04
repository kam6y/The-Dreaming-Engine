import { resolveAiMode, type AiMode } from "./ai/mode.js";

export type { AiMode };

export interface RuntimeConfig {
  aiMode: AiMode;
  host: string;
  port: number;
}

/**
 * 実行時設定を env から解決する。
 * host は常に `127.0.0.1` に固定する(外部公開しない: ai-guardrails.md 第0層)。
 */
export function loadRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  return {
    aiMode: resolveAiMode(env),
    host: "127.0.0.1",
    port: Number.parseInt(env.PORT ?? "3000", 10)
  };
}
