import { rm } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { E2E_SAVE_FILE } from "./e2e-save-dir.js";

// 難易度スモーク(M25-3)。
// 1. ?difficulty=hard(正規選択のURL入口)で新規開始 → data-difficulty="hard"
//    (?skipIntro=1 併用時は3択ステップを飛ばしURL値で開始する=既存E2Eと同じ開始手順)
// 2. 既定(フラグなし)は data-difficulty="normal"
// 3. skipIntro なしの新規ゲームでは難易度3択(data-menu="difficulty")が挟まり、
//    「むずかしい」を選ぶと hard で開始される(実プレイヤー経路の配線確認)
// 被ダメ倍率の増減方向・normal恒等・セーブ互換はユニットテスト(M25-2の14件)で担保済みのため、
// 本スモークは配線(URL/3択→options→GameState→view→data属性)の観測に専念する。

const GAME = "#game";

async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

/** タイトルから新規ゲームを開始する(?skipIntro=1 前提=3択なしで即探索へ) */
async function startNewGameSkippingIntro(page: Page, query: string): Promise<void> {
  await page.goto(query);
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
}

test("難易度: ?difficulty=hard で新規開始すると data-difficulty が hard になる", async ({
  page
}) => {
  test.setTimeout(45_000);
  await startNewGameSkippingIntro(page, "/?noSymbols=1&skipIntro=1&difficulty=hard");
  expect(await readAttr(page, "data-difficulty")).toBe("hard");
});

test("難易度: 既定の新規ゲームは ふつう(normal)で開始する", async ({ page }) => {
  test.setTimeout(45_000);
  await startNewGameSkippingIntro(page, "/?noSymbols=1&skipIntro=1");
  expect(await readAttr(page, "data-difficulty")).toBe("normal");
});

test("難易度: skipIntro なしでは3択が挟まり「むずかしい」で hard 開始できる", async ({
  page
}) => {
  test.setTimeout(60_000);

  // 残存セーブを消して「Enter=新規ゲーム」を保証する(フィクスチャ系specと同じ流儀)
  await rm(E2E_SAVE_FILE, { force: true });
  await rm(`${E2E_SAVE_FILE}.bak`, { force: true });

  await page.goto("/?noSymbols=1");
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();
  await page.keyboard.press("Enter"); // 新規ゲーム → 難易度3択が開く
  await expect.poll(() => readAttr(page, "data-menu"), { timeout: 5_000 }).toBe("difficulty");

  // 3択: やさしい/ふつう(既定カーソル)/むずかしい → 1つ下=むずかしい
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(350);
  await page.keyboard.press("Enter");

  // オープニング演出をスペースで送って探索へ(day-night.spec と同じ流儀)
  for (let i = 0; i < 8; i += 1) {
    if ((await readAttr(page, "data-scene")) === "exploration") break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(1_500);
  }
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 15_000 }).toBe("exploration");
  expect(await readAttr(page, "data-difficulty")).toBe("hard");
});
