import { rm } from "node:fs/promises";

import { E2E_SAVE_DIR } from "./e2e-save-dir.js";

/**
 * E2E実行開始時のクリーンアップ。
 *
 * テスト専用セーブディレクトリを毎回まっさらにする。これが無いと、前回実行で
 * 残ったセーブにより hello の hasSave=true となり、タイトルで Enter 一回=新規
 * ゲーム即開始を前提とする既存スペック(battle / movement)が「上書き確認
 * ダイアログ」に阻まれて壊れる。hasSave は接続の都度ファイル存在を見るため、
 * ディレクトリ削除だけで十分(reuseExistingServer でサーバープロセスが残っても
 * よい)。
 */
export default async function globalSetup(): Promise<void> {
  await rm(E2E_SAVE_DIR, { recursive: true, force: true });
}
