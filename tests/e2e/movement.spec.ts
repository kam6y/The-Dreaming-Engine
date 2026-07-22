import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// 街「灯町」からダンジョン「夢喰いの裂け目」最深部(dungeon-3)まで、
// マップ遷移を跨いで移動できることを検証する移動スモーク。
// 全マップとも中央の背骨道は x=11 列で南北に貫通している(maps/*.ts の実データ)。
// 移動状態は探索シーンが #game 要素の data 属性へ同期する(exploration-scene.ts)。

const GAME = "#game";

/** #game 要素の data 属性を読む(未設定なら null) */
async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

/**
 * 下キーを長押しして背骨道を南下し、目的マップへ遷移するまで待つ。
 * 遷移でシーンが再生成されるとキー押下状態がリセットされ、プレイヤーは
 * 入口マス(11,1)で停止する。そのため各マップごとに down→ポーリング→up の
 * サイクルを回す(次の呼び出しで再度 down して南下を継続する)。
 */
async function descendTo(page: Page, targetMapId: string): Promise<void> {
  await page.keyboard.down("ArrowDown");
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 15_000 }).toBe(targetMapId);
  await page.keyboard.up("ArrowDown");
}

test("新規ゲームで街から裂け目最深部まで移動して到達できる", async ({ page }) => {
  test.setTimeout(60_000);

  // M2以降は敵シンボルがランダム配置されるため、踏破スモークではシンボルを無効化する
  await page.goto("/?noSymbols=1&skipIntro=1");
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();

  // Phaser(キーボード対象は window)へ入力を確実に届けるためキャンバスへフォーカスする
  await page.locator("canvas").click();

  // タイトルで Enter → 探索シーン開始(街「灯町」)
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 10_000 }).toBe("town");

  // 街: 初期位置 (10,10) から背骨道 (x=11) へ1マス寄せる
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => readAttr(page, "data-player-x"), { timeout: 10_000 }).toBe("11");

  // 背骨道 (x=11) を南下し、各マップを順に踏破する
  await descendTo(page, "field"); // 街 → 忘れ野
  await descendTo(page, "dungeon-1"); // 忘れ野 → 裂け目 一層
  await descendTo(page, "dungeon-2"); // 一層 → 二層
  await descendTo(page, "dungeon-3"); // 二層 → 最深部

  // 最深部への到達を確認
  await expect.poll(() => readAttr(page, "data-map-id")).toBe("dungeon-3");
});
