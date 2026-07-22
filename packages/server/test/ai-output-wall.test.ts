import { describe, expect, it } from "vitest";

import { checkDisplayText } from "../src/ai/output-wall.js";

// ゼロ幅スペースはエスケープで組み立てる
const ZWSP = "\u200B";
const SPEAK = { maxLength: 400 };

/** 通過時の normalized を取り出す(型を絞る) */
function passed(result: ReturnType<typeof checkDisplayText>): string {
  if (!result.ok) throw new Error(`expected ok, got reject: ${result.reason}`);
  return result.normalized;
}

describe("checkDisplayText: 正常系", () => {
  it("句読点・数字混在の自然な日本語文が通過する", () => {
    const r = checkDisplayText("旅人よ、今宵はよく眠りな。灯は3つ残っている。", SPEAK);
    expect(r.ok).toBe(true);
    expect(passed(r)).toBe("旅人よ、今宵はよく眠りな。灯は3つ残っている。");
  });

  it("normalized は NFKC 済み(全角英数字は畳まれる)", () => {
    const r = checkDisplayText("灯が１つ消えた。あと２つ。", SPEAK);
    expect(passed(r)).toBe("灯が1つ消えた。あと2つ。");
  });
});

describe("checkDisplayText: 最小長・長さ", () => {
  it("空文字・空白のみ・全角空白のみは empty で却下", () => {
    expect(checkDisplayText("", SPEAK)).toEqual({ ok: false, reason: "empty" });
    expect(checkDisplayText("   ", SPEAK)).toEqual({ ok: false, reason: "empty" });
    expect(checkDisplayText("　　", SPEAK)).toEqual({ ok: false, reason: "empty" });
  });

  it("不可視文字だけの入力も empty(除去後 0 字)", () => {
    expect(checkDisplayText(ZWSP + ZWSP, SPEAK)).toEqual({ ok: false, reason: "empty" });
  });

  it("長さ上限ちょうどは通過、超過は too_long で却下(切り詰めない)", () => {
    const five = { maxLength: 5 };
    expect(checkDisplayText("あいうえお", five).ok).toBe(true); // ちょうど 5
    expect(checkDisplayText("あいうえおか", five)).toEqual({ ok: false, reason: "too_long" });
  });
});

describe("checkDisplayText: 世界観逸脱パターン", () => {
  it("メタ発話(私はAIとして…)を deviation で却下", () => {
    expect(checkDisplayText("私はAIとして、その願いには応えられません。", SPEAK)).toEqual({
      ok: false,
      reason: "deviation"
    });
  });

  it("固有名詞(Claude / Anthropic)を却下", () => {
    expect(checkDisplayText("私はClaudeという言語モデルです。", SPEAK).ok).toBe(false);
    expect(checkDisplayText("Anthropicが作りました。", SPEAK).ok).toBe(false);
  });

  it("全角化した固有名詞(Ｃｌａｕｄｅ)も NFKC 正規化で却下", () => {
    const r = checkDisplayText("わたしはＣｌａｕｄｅです、旅人よ。", SPEAK);
    expect(r).toEqual({ ok: false, reason: "deviation" });
  });

  it("ゼロ幅文字を挟んだ回避(Cl[ZWSP]aude)が正規化で却下される", () => {
    const evasion = `わたしはCl${ZWSP}audeと呼ばれる者、旅人よ。`;
    const r = checkDisplayText(evasion, SPEAK);
    expect(r).toEqual({ ok: false, reason: "deviation" });
  });
});

describe("checkDisplayText: 日本語比率", () => {
  it("空白挿入(C l a u d e)は日本語比率で却下", () => {
    const r = checkDisplayText("C l a u d e", SPEAK);
    expect(r).toEqual({ ok: false, reason: "low_japanese_ratio" });
  });

  it("記号のみ(……)は分母 0 で symbols_only 却下", () => {
    expect(checkDisplayText("……", SPEAK)).toEqual({ ok: false, reason: "symbols_only" });
    expect(checkDisplayText("！？、。「」", SPEAK)).toEqual({ ok: false, reason: "symbols_only" });
  });

  it("比率ちょうど 70% は通過、70% 未満は却下(境界)", () => {
    // 日本語 7 + ラテン 3 = 判定対象 10 → 70% ちょうど(以上で通過)
    expect(checkDisplayText("あいうえおかきabc", SPEAK).ok).toBe(true);
    // 日本語 6 + ラテン 4 = 60% → 却下
    expect(checkDisplayText("あいうえおかabcd", SPEAK)).toEqual({
      ok: false,
      reason: "low_japanese_ratio"
    });
  });

  it("数字・記号は分母から除外される(日本語のみの文は 100%)", () => {
    // 数字と記号が多くても、判定対象は日本語文字のみ → 通過
    expect(checkDisplayText("灯は3、影は7。……", SPEAK).ok).toBe(true);
  });
});
