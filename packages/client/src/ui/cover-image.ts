import Phaser from "phaser";

/**
 * 画像を CSS の `background-size: cover` 相当でビューポートに敷き詰める
 * (縦横比を保ちつつ全体を覆い、はみ出しは切れる)。リサイズ時も呼べるよう
 * 元テクスチャの frame 寸法(スケール非依存)から倍率を計算する。
 * 呼び出し前に `setOrigin(0.5)` 済みであること(中央合わせ)。
 */
export function fitCover(image: Phaser.GameObjects.Image, viewWidth: number, viewHeight: number): void {
  const srcWidth = image.frame.width;
  const srcHeight = image.frame.height;
  if (srcWidth === 0 || srcHeight === 0) {
    return;
  }
  const scale = Math.max(viewWidth / srcWidth, viewHeight / srcHeight);
  image.setPosition(viewWidth / 2, viewHeight / 2).setScale(scale);
}

/**
 * 画像を縦横比を保ってスロット矩形に収める(`object-fit: contain` 相当。
 * 全体が見え、余白ができる)。立ち絵・敵グラフィックの配置に使う。
 * 返り値は適用後の表示寸法(配置微調整用)。
 */
export function fitContain(
  image: Phaser.GameObjects.Image,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const srcWidth = image.frame.width;
  const srcHeight = image.frame.height;
  if (srcWidth === 0 || srcHeight === 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  image.setScale(scale);
  return { width: srcWidth * scale, height: srcHeight * scale };
}
