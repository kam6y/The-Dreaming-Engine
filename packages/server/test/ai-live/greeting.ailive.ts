import { describe, expect, it } from "vitest";

import { APP_LEVEL_JAPANESE_PROBE, runLiveGreeting, shouldRunLive } from "./_shared.js";

/**
 * 実AI疎通の最小テスト(攻撃テストB とは別。ai-integration.md 42 /
 * ai-guardrails.md「実装チェックリスト」の実AI疎通に対応)。
 *
 * ============================================================================
 * 【人間向け実行手順】※ Claude Code は絶対に実行しない(サブスク枠保護)
 *   1. `.env` に CLAUDE_CODE_OAUTH_TOKEN(既定)または ANTHROPIC_API_KEY を設定
 *      (発行は `claude setup-token`。詳細は `.env.example` を参照)。
 *   2. `pnpm test:ai-live` を実行(AI_LIVE_TEST=1 AI_MODE=live が自動で立つ)。
 *   3. 動かない・レート制限が問題なら env を ANTHROPIC_API_KEY に差し替えて再実行
 *      (コード変更不要。認証抽象が env1つの差し替えで切り替える)。
 * ============================================================================
 *
 * 目的: 会話フローの挨拶を **1回だけ** 実AIに投げ、(1) speak ツールが出る、
 * (2) その全文が出力壁を通過する、(3) 日本語である、ことを確認する。
 * サブスク枠保護のため呼び出しは最小(1回)に限る。
 *
 * ガード: AI_LIVE_TEST=1 かつ AI_MODE=live かつ実キー存在時のみ実行(describe.runIf)。
 * それ以外では skip(通常の `pnpm check` からは include 対象外なので、そもそも収集されない)。
 */

describe.runIf(shouldRunLive(process.env))("実AI疎通(会話フローの挨拶を1回)", () => {
  it(
    "speak ツールが出て・出力壁を通過し・日本語である",
    async () => {
      const outcome = await runLiveGreeting();
      // ここに到達する時点でガードは通過済み(runIf)。skip は保険。
      if (outcome.skipped) return;

      // (1) 会話フローで speak の生 intent が最低1件出ていること
      expect(outcome.speakCalls.length).toBeGreaterThanOrEqual(1);

      // (2) speak 全文が出力壁(長さ・逸脱パターン・日本語比率)を通過すること
      expect(outcome.outputWallOk).toBe(true);

      // (3) 日本語であること(ひらがな・カタカナ・漢字を含む)
      expect(APP_LEVEL_JAPANESE_PROBE.test(outcome.speakText)).toBe(true);
    },
    55_000
  );
});
