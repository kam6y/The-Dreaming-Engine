import { z } from "zod";

import { checkDisplayText } from "../output-wall.js";
import {
  NARRATE_MAX_LENGTH,
  SPEAK_MAX_LENGTH,
  type NarrateEffect,
  type SpeakEffect,
  type ValidationResult
} from "./types.js";

/**
 * speak / narrate: 状態変更なしの表示系ツール。
 * スキーマ検証(text が文字列)→ 出力壁(空白除去後1字以上・上限以内・世界観逸脱/日本語比率)。
 * 空文字・最小長・長さ上限の判定はすべて checkDisplayText が担う。
 */

const textInputSchema = z.object({ text: z.string() });

export function validateSpeak(rawInput: unknown): ValidationResult<SpeakEffect> {
  const parsed = textInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, reason: "speak: 入力スキーマ検証に失敗" };
  const checked = checkDisplayText(parsed.data.text, { maxLength: SPEAK_MAX_LENGTH });
  if (!checked.ok) return { ok: false, reason: `speak: 出力壁却下(${checked.reason})` };
  return { ok: true, effect: { kind: "speak", text: checked.normalized } };
}

export function validateNarrate(rawInput: unknown): ValidationResult<NarrateEffect> {
  const parsed = textInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, reason: "narrate: 入力スキーマ検証に失敗" };
  const checked = checkDisplayText(parsed.data.text, { maxLength: NARRATE_MAX_LENGTH });
  if (!checked.ok) return { ok: false, reason: `narrate: 出力壁却下(${checked.reason})` };
  return { ok: true, effect: { kind: "narrate", text: checked.normalized } };
}
