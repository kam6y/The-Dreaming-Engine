import { stripInvisible } from "./normalize.js";

/**
 * 入力の壁(guardrails 第3層)。プレイヤーの自由入力とプロンプトへ注入する
 * 全可変テキストの無害化を担う純関数群。
 */

/** 自由入力の既定最大文字数(config/ai.json playerInputMaxLength と同値。呼び出し側で上書き可) */
export const DEFAULT_PLAYER_INPUT_MAX_LENGTH = 200;

/**
 * プレイヤーの自由入力を無害化する。
 * 手順(guardrails 第3層):1) 最大長へ切り詰め → 2) 制御文字・不可視文字を除去。
 * 文字数はコードポイント単位で数える(サロゲートペアを 1 字として扱う)。
 */
export function sanitizePlayerInput(
  raw: string,
  maxLength: number = DEFAULT_PLAYER_INPUT_MAX_LENGTH
): string {
  const truncated = [...raw].slice(0, Math.max(0, maxLength)).join("");
  return stripInvisible(truncated);
}

// XML タグに使う `<` `>` を全角へ置換(タグ構造の偽造・二次インジェクション防止)
const LESS_THAN = /</g;
const GREATER_THAN = />/g;
/** 全角 less-than U+FF1C */
const FULLWIDTH_LESS_THAN = "＜";
/** 全角 greater-than U+FF1E */
const FULLWIDTH_GREATER_THAN = "＞";

/**
 * タグ無害化:`<` `>` を全角に置換する。プロンプトへ注入する**全ての可変テキスト**
 * (プレイヤー入力・会話ログ・要約・噂・クエスト文面・reason 等)に適用する
 * (guardrails 第3層「タグ無害化」)。
 */
export function neutralizeTags(text: string): string {
  return text.replace(LESS_THAN, FULLWIDTH_LESS_THAN).replace(GREATER_THAN, FULLWIDTH_GREATER_THAN);
}
