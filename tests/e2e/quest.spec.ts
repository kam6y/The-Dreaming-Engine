import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// クエスト受注スモーク(M4-G)。情報屋カイと会話→「仕事はあるか尋ねる」で提案生成→
// 「引き受ける」で受注成立(data-quest-count が 0→1)→会話終了→Q でクエストジャーナルが
// 開閉できる(開くと移動が止まり、閉じると移動できる)ことを検証する。
//
// AI はモック(決定論)。提案の内容(canvas 内)は覗けないため、data-quest-count の
// 増加で受注成立を担保する。メニュー操作はキー間に 250ms 挟む(既存 E2E 参照)。

const GAME = "#game";

async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

async function readPositionKey(page: Page): Promise<string> {
  const x = await readAttr(page, "data-player-x");
  const y = await readAttr(page, "data-player-y");
  return `${x},${y}`;
}

/** 1歩キー入力して目標座標へ到達するまで待つ(取りこぼしは再押下。進みすぎない) */
async function stepTo(page: Page, key: string, x: number, y: number): Promise<void> {
  const target = `${x},${y}`;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await readPositionKey(page)) === target) return;
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
  }
  expect(await readPositionKey(page)).toBe(target);
}

async function startNewGame(page: Page): Promise<void> {
  await page.goto("/?noSymbols=1");
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
  expect(await readAttr(page, "data-map-id")).toBe("town");
}

/** 正面のNPCへ話しかける(interact の取りこぼしに備え、会話開始まで再試行する) */
async function talkTo(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await readAttr(page, "data-interaction")) === "conversation") return;
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => readAttr(page, "data-interaction"), { timeout: 5_000 }).toBe("conversation");
}

/** Esc で会話を終える(Esc 取りこぼしに備え、none へ戻るまで再試行。none になったら押さない) */
async function endConversation(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await readAttr(page, "data-interaction")) === "none") return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => readAttr(page, "data-interaction"), { timeout: 5_000 }).toBe("none");
}

/** 情報屋カイ(4,10)の東隣 (5,10) へ移動する(西進なので到達時点で左を向いている) */
async function faceInformant(page: Page): Promise<void> {
  for (let x = 9; x >= 5; x -= 1) {
    await stepTo(page, "ArrowLeft", x, 10);
  }
  expect(await readPositionKey(page)).toBe("5,10");
}

test("情報屋からサブクエストを受注する(quest-count 0→1)とジャーナル開閉", async ({ page }) => {
  test.setTimeout(60_000);

  await startNewGame(page);
  await faceInformant(page);

  // 話しかけ → 会話開始(Space 取りこぼしに備えて開始まで再試行)
  await talkTo(page);
  expect(await readAttr(page, "data-quest-count")).toBe("0");

  // メニュー活性化を待つ。「仕事はあるか尋ねる」は先頭(index 0)なので Space で決定
  await page.waitForTimeout(800);
  await page.keyboard.press("Space");

  // 提案(propose_quest)生成 + 応答 speak + メニュー再構築(受諾/辞退が現れる)を待つ
  await page.waitForTimeout(1000);

  // メニューは [仕事はあるか尋ねる, 話しかける, 引き受ける, 断る, 立ち去る]。
  // 「引き受ける」(index 2)へ2つ下げて決定
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");

  // 受注成立: 受注中サブクエスト数が 0 → 1
  await expect.poll(() => readAttr(page, "data-quest-count"), { timeout: 10_000 }).toBe("1");

  // 受諾ダイアログを会話 overlay で消化してから Esc で会話終了 → interaction が none へ
  await page.waitForTimeout(600);
  await endConversation(page);
  expect(await readPositionKey(page)).toBe("5,10");

  // Q でクエストジャーナルを開く → 開いている間は移動できない(キー操作が overlay に通る)
  await page.waitForTimeout(300);
  await page.keyboard.press("q");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  expect(await readPositionKey(page)).toBe("5,10"); // ジャーナル表示中は移動が止まる

  // Q で閉じる → 移動できるようになる(探索操作に復帰)
  await page.keyboard.press("q");
  await page.waitForTimeout(300);
  await stepTo(page, "ArrowRight", 6, 10);
});
