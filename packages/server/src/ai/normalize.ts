/**
 * テキスト正規化の共通ヘルパー(入力の壁・出力の壁が共有する)。
 *
 * 制御文字・不可視文字(ゼロ幅スペース・BOM・方向制御・行/段落区切り等)を除去する。
 * 両壁で同一の除去集合を使うことで、「ゼロ幅文字を挟んでブロックリスト/比率判定を
 * すり抜ける」回避に一貫した穴を作らないことを保証する(guardrails 第3層・第4層)。
 *
 * ソースへ制御文字/不可視文字のリテラルを埋め込まないよう、正規表現ではなく
 * コードポイント範囲の判定で除去する(no-control-regex 回避・可読性)。
 */

/** 除去対象のコードポイントか(制御文字・不可視文字) */
function isInvisibleOrControl(cp: number): boolean {
  return (
    (cp >= 0x00 && cp <= 0x1f) || // C0 制御文字
    (cp >= 0x7f && cp <= 0x9f) || // DEL + C1 制御文字
    cp === 0x00ad || // ソフトハイフン
    cp === 0x180e || // モンゴル母音区切り
    (cp >= 0x200b && cp <= 0x200f) || // ゼロ幅スペース/ZWNJ/ZWJ/LRM/RLM
    (cp >= 0x2028 && cp <= 0x202e) || // 行/段落区切り + 双方向埋め込み/上書き
    (cp >= 0x2060 && cp <= 0x2064) || // ワードジョイナ + 不可視演算子
    (cp >= 0x2066 && cp <= 0x2069) || // 双方向アイソレート
    cp === 0xfeff // BOM / ゼロ幅ノーブレークスペース
  );
}

/** 制御文字・不可視文字を除去する(コードポイント単位で走査) */
export function stripInvisible(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined || !isInvisibleOrControl(cp)) {
      out += ch;
    }
  }
  return out;
}

/**
 * 照合前正規化:不可視/制御文字を除去し、互換正規化(NFKC)を行う。
 * パターン照合・日本語比率判定の前段で使い、表示・保存にもこの結果を用いる
 * (guardrails 第4層「照合前正規化」)。
 */
export function normalizeForDisplay(text: string): string {
  return stripInvisible(text).normalize("NFKC");
}
