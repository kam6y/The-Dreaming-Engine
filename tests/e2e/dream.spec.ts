import { rm } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { E2E_SAVE_FILE } from "./e2e-save-dir.js";

// 夢シーンスモーク(M4-G)。宿屋オルガ(4,4)へ話しかけ→宿泊「泊まる」→
// data-day +1 / data-gold -10 / HP は満タンのまま(全回復)→おやすみダイアログを閉じ→
// 夢演出後にスペースで目覚め、探索で移動できることを検証する。
//
// AI はモック(決定論)。宿泊するとサーバーがセーブを書くため、後続スペック
// (movement 等は「セーブ無し=Enter一発で新規」を前提)を壊さないよう afterEach で
// テスト専用セーブを消す。夢 overlay(canvas)は覗けないため、目覚めの判定は
// 「探索へ復帰して移動できる」ことで担保する。

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

// 宿泊はテスト専用セーブを書く。後続スペックのため必ず消す(失敗時も走るよう afterEach)。
test.afterEach(async () => {
  await rm(E2E_SAVE_FILE, { force: true });
  await rm(`${E2E_SAVE_FILE}.bak`, { force: true });
});

test("宿屋で宿泊: 日送り+宿代徴収+HP全回復→夢→目覚めて探索復帰", async ({ page }) => {
  test.setTimeout(60_000);

  // --- 新規ゲーム開始 → 街「灯町」 ---
  await page.goto("/?noSymbols=1");
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
  expect(await readAttr(page, "data-map-id")).toBe("town");
  expect(await readPositionKey(page)).toBe("10,10");
  expect(await readAttr(page, "data-day")).toBe("1");
  expect(await readAttr(page, "data-gold")).toBe("30");
  const hpFull = await readAttr(page, "data-hp"); // 新規は満タン(=Lv1 の最大HP)

  // --- 宿屋の主人(4,4)の正面(4,5)へ移動して上を向く ---
  for (let y = 9; y >= 5; y -= 1) {
    await stepTo(page, "ArrowUp", 10, y);
  }
  for (let x = 9; x >= 4; x -= 1) {
    await stepTo(page, "ArrowLeft", x, 5);
  }
  expect(await readPositionKey(page)).toBe("4,5");
  await page.keyboard.press("ArrowUp"); // 主人(4,4)は歩けない=向きだけ上になる
  await page.waitForTimeout(250);
  expect(await readPositionKey(page)).toBe("4,5");

  // --- 宿泊フロー: Space で 挨拶→宿泊確認「泊まる」まで進める。day が 2 になったら止める ---
  for (let i = 0; i < 15; i += 1) {
    if ((await readAttr(page, "data-day")) === "2") break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
  }

  // 宿泊成立: 日送り + 宿代10G徴収 + HP 全回復(満タン維持)
  await expect.poll(() => readAttr(page, "data-day"), { timeout: 10_000 }).toBe("2");
  expect(await readAttr(page, "data-gold")).toBe("20"); // 30 - 10(宿代)
  expect(await readAttr(page, "data-hp")).toBe(hpFull); // 全回復(新規時の最大HPと一致)
  expect(await readPositionKey(page)).toBe("4,5");

  // --- おやすみダイアログ → 夢演出 → 目覚め ---
  // おやすみダイアログが開くのを待ってから、Space で「ダイアログ閉じ→夢スキップ→目覚め」を進める。
  // 目覚めるまでは移動できない(ダイアログ・夢 overlay 表示中)。各反復で下移動を試み、
  // (4,6) へ動けたら目覚めて探索に復帰した証左とみなす(それ以上 Space は押さない)。
  await page.waitForTimeout(600);
  let awake = false;
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    if ((await readPositionKey(page)) === "4,6") {
      awake = true;
      break;
    }
  }
  expect(awake).toBe(true);

  // 探索へ復帰しており、翌朝(day=2)のまま移動を継続できる
  expect(await readAttr(page, "data-scene")).toBe("exploration");
  expect(await readAttr(page, "data-day")).toBe("2");
  await stepTo(page, "ArrowDown", 4, 7);
});
