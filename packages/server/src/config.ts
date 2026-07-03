export type AiMode = "mock" | "live";

export interface ResolveAiModeOptions {
  allowLive: boolean;
}

export function resolveAiMode(
  rawMode: string | undefined,
  options: ResolveAiModeOptions
): AiMode {
  if (rawMode !== "live") {
    return "mock";
  }

  if (!options.allowLive) {
    throw new Error(
      "AI_MODE=live は通常の開発・テスト実行では拒否されます。実AI疎通は pnpm test:ai-live でのみ行います。"
    );
  }

  return "live";
}

export interface RuntimeConfig {
  aiMode: AiMode;
  host: string;
  port: number;
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  const allowLive = env.DREAMING_ENGINE_ALLOW_LIVE_AI === "1";

  return {
    aiMode: resolveAiMode(env.AI_MODE, { allowLive }),
    host: "127.0.0.1",
    port: Number.parseInt(env.PORT ?? "3000", 10)
  };
}
