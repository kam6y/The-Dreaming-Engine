import { z } from "zod";

// ---------------------------------------------------------------------------
// 難易度設定(M25。game-design.md「難易度設定(拡張: M25)」)
//
// - 3段階(やさしい/ふつう/むずかしい)。難易度が動かすのは**プレイヤーの被ダメージ倍率のみ**。
//   与ダメ・XP/ゴールド・ドロップ・命中・状態異常付与確率・逃走率・経済・敵定義は非依存。
// - ふつう=係数1.0=恒等(現行挙動と完全一致)。normal の係数は 1.0 固定(緩めるも強めるも禁止)。
//   これは combat-balance.test の統計(勝率・全滅率・決着ターン)をバイト一致で保存する絶対条件。
// - 係数は戦闘実行時のランタイム適用(dealDamage のプレイヤー被弾分岐で max(1, floor(dmg × 係数)))。
//   乱数を消費しないため乱数列・消費順序は不変。敵定義・データテーブルには焼き込まない。
// - AI(DreamMaster)へは波及しない(決定論の戦闘内部係数。<world_state>・防御仕様に触れない)。
//
// クライアントは MAPS / ACHIEVEMENTS と同流儀で本モジュール(表示名・並び)を直接 import する
// (表示名を view へ載せない)。view / new-game options は難易度 id のみを運ぶ。
// ---------------------------------------------------------------------------

/** 難易度 id(英語 enum)。既定は normal(ふつう) */
export const difficultySchema = z.enum(["easy", "normal", "hard"]);
export type DifficultyId = z.infer<typeof difficultySchema>;

/** 既定の難易度(新規カーソル既定・旧セーブ補完値・options 省略時のフォールバック) */
export const DEFAULT_DIFFICULTY: DifficultyId = "normal";

/** 難易度の選択順(新規ゲーム3択の並び。裁量: やさしい→ふつう→むずかしい) */
export const DIFFICULTY_ORDER: readonly DifficultyId[] = ["easy", "normal", "hard"];

/** 難易度の日本語表示名(UI はここから引く。表示名は view に載せない) */
export const DIFFICULTY_DISPLAY_NAMES: Record<DifficultyId, string> = {
  easy: "やさしい",
  normal: "ふつう",
  hard: "むずかしい"
};

/**
 * 難易度ごとのプレイヤー被ダメージ倍率(裁量初期値)。
 * - `normal` は 1.0 固定(恒等=combat-balance.test バイト一致保存の絶対条件。変更禁止)。
 * - dealDamage のプレイヤー被弾分岐で `max(1, floor(dmg × 係数))` として適用する(RNG 非消費)。
 * - 敵の被ダメージ(与ダメージ)には掛けない(敵側は難易度非依存)。
 */
export const DIFFICULTY_COEFFICIENTS: Record<DifficultyId, number> = {
  easy: 0.75,
  normal: 1.0,
  hard: 1.4
};
