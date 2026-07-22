import { API_KEY_ENV, OAUTH_TOKEN_ENV, hasCredential } from "../../src/ai/auth.js";
import { loadAiConfig } from "../../src/ai/config.js";
import { createDreamMaster, type RawToolCall } from "../../src/ai/dream-master/index.js";
import { resolveAiMode } from "../../src/ai/mode.js";
import { validateSpeak } from "../../src/ai/tool-validation/index.js";

/**
 * 実AI疎通テストの共有ヘルパー(`*.ailive.ts` からのみ import される。
 * `_` 接頭辞 + `.ts`(≠ `.ailive.ts`)なので test glob には収集されない)。
 *
 * ここに実 API 呼び出しを集約し、ガード(AI_LIVE_TEST=1 かつ AI_MODE=live かつ実キー存在)を
 * 満たさない場合は `skipped: true` を返す(サブスク枠の誤爆保護)。**Claude Code は実行しない**。
 */

/** 日本語(ひらがな・カタカナ・漢字)を1文字でも含むかの判定 */
export const APP_LEVEL_JAPANESE_PROBE = /[ぁ-ゖァ-ヺ一-鿿]/u;

export type LiveGreetingOutcome =
  | { readonly skipped: true }
  | {
      readonly skipped: false;
      readonly speakCalls: readonly RawToolCall[];
      readonly speakText: string;
      readonly outputWallOk: boolean;
    };

/** ガード条件: 明示フラグ + 実 live + 資格情報の存在(いずれか)。describe.runIf に使う */
export function shouldRunLive(env: NodeJS.ProcessEnv): boolean {
  return (
    env.AI_LIVE_TEST === "1" &&
    env.AI_MODE === "live" &&
    (hasCredential(env, OAUTH_TOKEN_ENV) || hasCredential(env, API_KEY_ENV))
  );
}

/**
 * 会話フローの挨拶を **1回だけ** 実AIに投げ、speak 生 intent と出力壁通過結果を返す。
 * ガード未達なら skip。呼び出しは最小1回(サブスク枠保護)。
 */
export async function runLiveGreeting(): Promise<LiveGreetingOutcome> {
  if (!shouldRunLive(process.env)) {
    return { skipped: true };
  }

  const config = loadAiConfig();
  const mode = resolveAiMode(process.env); // AI_MODE=live + AI_LIVE_TEST=1 → "live"
  if (mode !== "live") {
    return { skipped: true };
  }

  const dreamMaster = createDreamMaster(mode, config);
  const result = await dreamMaster.run({
    flow: "conversation",
    partnerNpcId: "innkeeper",
    playerUtterance: "こんばんは。今夜の宿はありますか?"
  });

  if (!result.ok) {
    throw new Error(
      `実AI呼び出しが失敗しました(${result.failure})。認証(${OAUTH_TOKEN_ENV}/${API_KEY_ENV})・ネットワーク・レート制限を確認してください。`
    );
  }

  const speakCalls = result.toolCalls.filter((call) => call.toolName === "speak");
  const first = speakCalls[0];
  let speakText = "";
  let outputWallOk = false;
  if (first !== undefined) {
    // 検証層と同じ経路(validateSpeak = スキーマ + 出力壁)で確認する
    const validated = validateSpeak(first.rawInput);
    outputWallOk = validated.ok;
    if (validated.ok) speakText = validated.effect.text;
  }

  return { skipped: false, speakCalls, speakText, outputWallOk };
}
