/**
 * ゲーム全体の基本フォント。ダークファンタジーの雰囲気に合う明朝体
 * 「しっぽり明朝」(SIL OFL 1.1。実体とライセンスは assets/fonts/ に同梱)を第一候補とし、
 * 未読込・読込失敗時はブラウザ既定の明朝系(serif)へ退避する。
 * `@font-face` の宣言は style.css にある。
 */
export const UI_FONT_FAMILY = '"Shippori Mincho", serif';

/** `document.fonts`(FontFaceSet)のうち本モジュールが使う部分 */
export interface FontLoader {
  load(font: string, text?: string): Promise<unknown>;
}

/**
 * 基本フォントの読み込み完了を待つ。Phaser の Text は生成時に自前キャンバスへ描画するため、
 * フォント確定前にシーンが描画するとフォールバック字形のまま残る。起動時(プリロード)に
 * これを待ってからタイトルへ遷移する。非ブラウザ環境・読込失敗・タイムアウトでも必ず
 * 解決してゲーム起動を阻害しない(その場合は serif 退避のまま表示を継続する)。
 */
export async function waitForUiFont(
  loader: FontLoader | undefined = globalThis.document?.fonts,
  timeoutMs = 5000
): Promise<void> {
  if (!loader) {
    return;
  }
  try {
    await Promise.race([
      loader.load(`16px ${UI_FONT_FAMILY}`, "夢見る機関"),
      new Promise((resolve) => setTimeout(resolve, timeoutMs))
    ]);
  } catch {
    // 読込失敗は致命ではない(@font-face のフォールバックで表示は継続する)
  }
}
