import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// 昼夜サイクルのスモーク(M23-3)。
// mock限定の時間帯固定ピン(?timeOfDay=night。startLevel同流儀)で開始直後から夜を再現し:
// 1. data-time-of-day="night"(HUDの「夜」表示・夜の帳はcanvasのため目視確認で担保)
// 2. 商人レンドが夜配置(7,11)に居て、そこで店が開く(data-interaction="shop")=
//    npcPlacementsForTime の描画とサーバーの正面インタラクションが一致することの実地確認
// 3. 既定(ピンなし)の新規ゲームは昼開始(data-time-of-day="day")
// 昼→夜の歩数進行(40歩)・宿泊/全滅/ロードの昼リセットはユニットテスト(M23-2の20件)で
// 担保済みのため、本スモークは固定ピンで配線(view→描画→当たり判定)の観測に専念する。

const GAME = "#game";
const SEED = 42;

async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

async function readPosKey(page: Page): Promise<string> {
  const x = await readAttr(page, "data-player-x");
  const y = await readAttr(page, "data-player-y");
  return `${x},${y}`;
}

/** 1歩移動して着地を確認する(equipment.spec と同じ流儀) */
async function stepTo(page: Page, key: string, x: number, y: number): Promise<void> {
  await page.keyboard.press(key);
  await expect.poll(() => readPosKey(page), { timeout: 10_000 }).toBe(`${x},${y}`);
}

/** 新規ゲームを開始して灯町に立つ(先行スペックの残存セーブの上書き確認にも対応) */
async function startNewGame(page: Page, extraFlags: string): Promise<void> {
  await page.goto(`/?seed=${SEED}&noSymbols=1&skipIntro=1${extraFlags}`);
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();
  await page.keyboard.press("Enter");
  for (let i = 0; i < 5; i += 1) {
    await page.waitForTimeout(1_500);
    if ((await readAttr(page, "data-map-id")) === "town") break;
    await page.keyboard.press("Space");
  }
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 10_000 }).toBe("town");
}

test("夜固定ピン: 夜開始になり、商人が夜配置(酒場脇)で店を開く", async ({ page }) => {
  test.setTimeout(60_000);

  await startNewGame(page, "&timeOfDay=night");
  await expect.poll(() => readAttr(page, "data-time-of-day"), { timeout: 5_000 }).toBe("night");

  // --- 商人の夜配置 (7,11) の隣 (8,11) へ移動して左を向く ---
  // (10,10) から左へ2歩 → (8,10)、下へ1歩 → (8,11)。夜の商人へ左向きで正対する
  await stepTo(page, "ArrowLeft", 9, 10);
  await stepTo(page, "ArrowLeft", 8, 10);
  await stepTo(page, "ArrowDown", 8, 11);
  await page.keyboard.press("ArrowLeft"); // (7,11)=夜の商人。歩けない=向きだけ左になる
  await page.waitForTimeout(350);

  // --- 話しかけて店が開く(=夜配置の描画とサーバー判定が一致している) ---
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await readAttr(page, "data-interaction")) === "shop") break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => readAttr(page, "data-interaction"), { timeout: 5_000 }).toBe("shop");
});

test("既定の新規ゲームは昼開始(時間帯ピンなし)", async ({ page }) => {
  test.setTimeout(45_000);

  await startNewGame(page, "");
  await expect.poll(() => readAttr(page, "data-time-of-day"), { timeout: 5_000 }).toBe("day");
});
