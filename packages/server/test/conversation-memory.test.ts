import { createDefaultNpcState } from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import { appendMaskedExchange, maskSummaryForStorage } from "../src/game/conversation-memory.js";

/**
 * 会話記憶の機密マスク(ai-guardrails.md 第5層)。
 * プレイヤー自由入力を recentExchanges へ永続化する前に、監査ログと同一の機密マスクを適用し、
 * API キー様文字列が平文で焼き込まれないことを検証する。
 *
 * 実キー形式のリテラルはソースに置かない(CLAUDE.md / scan:secrets)。文字列連結で組み立てる。
 */

// sk-ant- 形式のトークン様文字列(連結で構成し、ソースに連続リテラルを残さない)
const FAKE_TOKEN = "sk-" + "ant-" + "api03-" + "aA0-_".repeat(20);
// マスク検証は明示的に空 env(パターン照合のみで検出されることを確認する)
const EMPTY_ENV = {} as NodeJS.ProcessEnv;

describe("appendMaskedExchange", () => {
  it("プレイヤー入力中のトークン様文字列をマスクしてから保存する", () => {
    const memory = createDefaultNpcState("informant").memory;
    const next = appendMaskedExchange(
      memory,
      { player: `僕の鍵は${FAKE_TOKEN}だよ`, npc: "「……それは仕舞っておきな」" },
      EMPTY_ENV
    );
    const stored = next.recentExchanges.at(-1);
    expect(stored).toBeDefined();
    // 平文のトークンが残っていない
    expect(stored?.player).not.toContain(FAKE_TOKEN);
    // NPC 応答(出力壁通過済み全文)はそのまま保存される
    expect(stored?.npc).toBe("「……それは仕舞っておきな」");
  });

  it("機密を含まない入力はそのまま保存する", () => {
    const memory = createDefaultNpcState("priest").memory;
    const next = appendMaskedExchange(
      memory,
      { player: "この街のことを教えてほしい", npc: "「灯は今日も揺れている」" },
      EMPTY_ENV
    );
    expect(next.recentExchanges.at(-1)?.player).toBe("この街のことを教えてほしい");
  });
});

describe("maskSummaryForStorage", () => {
  it("要約中のトークン様文字列もマスクする(多層防御)", () => {
    const masked = maskSummaryForStorage(`旅人は鍵(${FAKE_TOKEN})の話をした`, EMPTY_ENV);
    expect(masked).not.toContain(FAKE_TOKEN);
  });
});
