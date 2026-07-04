import { normalizeForDisplay } from "./normalize.js";

/**
 * 出力の壁(guardrails 第4層)。表示系テキスト(speak/narrate/rumor/クエスト文面/要約)に
 * 適用する後処理フィルタ。純関数。
 *
 * 手順:
 *  1. 照合前正規化(不可視/制御文字除去 + NFKC)。表示・保存にも normalized を用いる。
 *  2. 最小長:空白除去後 1 字以上。
 *  3. 長さ上限超過は却下(切り詰めない)。
 *  4. 世界観逸脱パターン(ブロックリスト)に該当したら却下。
 *  5. 日本語比率:判定対象文字(記号・数字・空白を除いた文字)の 70% 以上が
 *     ひらがな・カタカナ・漢字であること。分母 0(記号のみ)は却下。
 */

/** 却下理由(監査ログにのみ記録。AI・プレイヤーには露出しない) */
export type OutputRejectReason =
  | "empty"
  | "too_long"
  | "deviation"
  | "symbols_only"
  | "low_japanese_ratio";

export type OutputCheckResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: OutputRejectReason };

export interface OutputCheckOptions {
  /** ツール別の長さ上限(例: speak=400 / narrate=300 / 要約=200)。正規化後の文字数で判定 */
  maxLength: number;
}

/** 日本語比率の閾値(%)。ひらがな・カタカナ・漢字がこの割合以上必要 */
export const JAPANESE_RATIO_THRESHOLD_PERCENT = 70;

/**
 * 世界観逸脱パターン(既知パターンの回帰防止リスト。テストと共に育てる)。
 * 主たる防御は第1層・第2層であり、本リストは網羅検出を意図しない(guardrails 第4層)。
 * NFKC 後に照合するため、全角化(Ｃｌａｕｄｅ)やゼロ幅挿入は正規化で吸収済み。
 */
export const DEVIATION_PATTERNS: readonly RegExp[] = [
  /AIとして/,
  /言語モデル/,
  /システムプロンプト/,
  /プロンプト(を|の)(表示|開示|教え)/,
  /claude/i,
  /anthropic/i,
  /申し訳(ありません|ございません)が、?その(要求|お願い|ご要望|ような)/,
  // 英語まじりの崩れた定型 AI 応答
  /as an ai\b/i,
  /\bi am an ai\b/i,
  /language model/i,
  /\bi(?:'m| am) sorry,? but\b/i,
  /\bi can(?:no|')?t (?:help|assist|comply|provide|do that)\b/i,
  /\bi cannot (?:help|assist|comply|provide|fulfill)\b/i,
  /\bdeveloper mode\b/i,
  /\bsystem prompt\b/i
];

// 日本語(ひらがな・カタカナ・漢字 + 長音符・繰り返し記号)の 1 文字判定
const JAPANESE_CHAR =
  /[ぁ-ゖァ-ヺー々㐀-䶿一-鿿豈-﫿]/u;
// Unicode「文字」(数字・記号・句読点・空白を除いた判定対象の分母)
const LETTER_CHAR = /\p{L}/u;

/** 空白(JS \s: 半角/全角スペース・タブ・改行・NBSP 等)を除いた文字数 */
function nonSpaceLength(text: string): number {
  return text.replace(/\s/g, "").length;
}

interface RatioCounts {
  japanese: number;
  letters: number;
}

function countRatio(text: string): RatioCounts {
  let japanese = 0;
  let letters = 0;
  for (const ch of text) {
    if (LETTER_CHAR.test(ch)) {
      letters += 1;
      if (JAPANESE_CHAR.test(ch)) japanese += 1;
    }
  }
  return { japanese, letters };
}

/**
 * 表示系テキストを検査する。通過時は normalized(正規化後・表示/保存用)を返す。
 * 却下時は理由を返す。
 */
export function checkDisplayText(text: string, options: OutputCheckOptions): OutputCheckResult {
  // 1. 照合前正規化(以降の判定・返却はすべて normalized に対して行う)
  const normalized = normalizeForDisplay(text);

  // 2. 最小長(空白除去後 1 字以上)
  if (nonSpaceLength(normalized) < 1) {
    return { ok: false, reason: "empty" };
  }

  // 3. 長さ上限(超過は切り詰めではなく却下)。コードポイント単位で数える
  if ([...normalized].length > options.maxLength) {
    return { ok: false, reason: "too_long" };
  }

  // 4. 世界観逸脱パターン
  for (const pattern of DEVIATION_PATTERNS) {
    if (pattern.test(normalized)) {
      return { ok: false, reason: "deviation" };
    }
  }

  // 5. 日本語比率(記号・数字・空白は分母から除外。分母 0 は却下)
  const { japanese, letters } = countRatio(normalized);
  if (letters === 0) {
    return { ok: false, reason: "symbols_only" };
  }
  // 70% 以上を整数比較で判定(浮動小数を避ける): japanese/letters >= 70/100
  if (japanese * 100 < letters * JAPANESE_RATIO_THRESHOLD_PERCENT) {
    return { ok: false, reason: "low_japanese_ratio" };
  }

  return { ok: true, normalized };
}
