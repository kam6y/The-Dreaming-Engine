import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { z } from "zod";

/**
 * AI 設定(`packages/server/config/ai.json`)の zod スキーマとローダー。
 *
 * - 時間系フィールドは秒単位で保持する(仕様 ai-integration.md の記載と 1:1 対応させ、
 *   設定スナップショットテストが仕様値をそのまま照合できるようにする)。
 * - **本番デフォルト値は config/ai.json が唯一の正**。テストで値を差し替えたい場合は
 *   `loadAiConfig(overrides)` の部分上書きで与え、JSON 自体は書き換えない
 *   (guardrails「設定デフォルトの不変条件」/「レート・コスト保護」)。
 */

const turnLimitsSchema = z.object({
  /** 1 呼び出しのターン数上限(SDK ループ反復) */
  maxTurns: z.number().int().positive(),
  /** 出力トークン上限 */
  maxOutputTokens: z.number().int().positive()
});

const timeoutPairSchema = z.object({
  /** 初回トークン受信までの上限(秒) */
  firstTokenSeconds: z.number().positive(),
  /** 呼び出し開始から完了までの総時間上限(秒) */
  totalSeconds: z.number().positive()
});

export const aiConfigSchema = z.object({
  /** フロー区分別のモデル名(初期値: haiku=claude-haiku-4-5 / sonnet=claude-sonnet-5) */
  models: z.object({
    haiku: z.string().min(1),
    sonnet: z.string().min(1)
  }),
  /** 区分別のターン数・出力トークン上限(会話 / GM 処理) */
  limits: z.object({
    conversation: turnLimitsSchema,
    gm: turnLimitsSchema
  }),
  /** フロー別タイムアウト(初回 / 全体、秒) */
  timeouts: z.object({
    conversation: timeoutPairSchema,
    questGeneration: timeoutPairSchema,
    dream: timeoutPairSchema,
    battleResult: timeoutPairSchema,
    summary: timeoutPairSchema
  }),
  /** シーン別クールダウン(秒)。会話開始は同一 NPC につき */
  cooldowns: z.object({
    conversationStartSeconds: z.number().nonnegative(),
    dreamSeconds: z.number().nonnegative(),
    questGenerationSeconds: z.number().nonnegative()
  }),
  /** 会話送信レート(秒に 1 回) */
  conversationSendRateSeconds: z.number().positive(),
  /** サーバー起動(セッション)ごとの AI 呼び出し総数上限 */
  sessionCallLimit: z.number().int().positive(),
  /** 自由入力の最大文字数 */
  playerInputMaxLength: z.number().int().positive()
});

export type AiConfig = z.infer<typeof aiConfigSchema>;

/** 再帰的な部分型(テストでの部分上書き用) */
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/** 本番設定ファイル(config/ai.json)の絶対パス。src / dist いずれから見ても同一に解決する */
export const AI_CONFIG_PATH = fileURLToPath(new URL("../../config/ai.json", import.meta.url));

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** base を patch で再帰上書きしたオブジェクトを返す(配列・プリミティブは patch 優先の置換) */
function deepMerge(base: unknown, patch: unknown): unknown {
  if (isPlainObject(base) && isPlainObject(patch)) {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      result[key] = key in base ? deepMerge(base[key], value) : value;
    }
    return result;
  }
  return patch;
}

/** 設定ファイルを読み込み zod 検証して返す(検証済みのみ) */
function readAiConfigFile(configPath: string): AiConfig {
  const raw = readFileSync(configPath, "utf8");
  return aiConfigSchema.parse(JSON.parse(raw));
}

/**
 * AI 設定を読み込む。`overrides` を与えると本番設定へ部分上書きしてから再検証する
 * (テスト用。本番デフォルト値は書き換えない)。
 */
export function loadAiConfig(overrides?: DeepPartial<AiConfig>, configPath: string = AI_CONFIG_PATH): AiConfig {
  const base = readAiConfigFile(configPath);
  if (overrides === undefined) return base;
  return aiConfigSchema.parse(deepMerge(base, overrides));
}
