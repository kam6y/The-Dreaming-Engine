import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// 装備スモーク(M8-4)。商人レンド(16,4)から武器「錆びた片刃」(攻+3)を購入し、
// もちものオーバーレイから装備→実効攻撃力(data-atk)が+3される→はずすと戻る、を検証する。
//
// AI はモック(playwright.config.ts webServer=pnpm dev:mock)で決定論。
// canvas 内の UI は覗けないため、#game の data 属性(data-atk / data-gold /
// data-interaction / data-menu)を同期点にする。メニュー操作はキー間に 350ms 挟む
// (同一フレーム2キーでカーソル移動が反映されない既知問題への対処。既存 E2E 参照)。
// 資金は ?startGold=999(mock 限定のテスト加速。startLevel と同じ扱い)で確保する。

const GAME = "#game";

async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

async function readPositionKey(page: Page): Promise<string> {
  const x = await readAttr(page, "data-player-x");
  const y = await readAttr(page, "data-player-y");
  return `${x},${y}`;
}

/** 1歩キー入力して目標座標へ到達するまで待つ(取りこぼし対策つき。既存 E2E と同じ) */
async function stepTo(page: Page, key: string, x: number, y: number): Promise<void> {
  const target = `${x},${y}`;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await readPositionKey(page)) === target) return;
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
  }
  expect(await readPositionKey(page)).toBe(target);
}

/** メニュー操作用: 1キー押して反映待ち */
async function pressMenuKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(350);
}

test("装備スモーク: 店で武器を買い、装備で実効攻撃力が上がり、はずすと戻る", async ({ page }) => {
  test.setTimeout(90_000);

  // --- 新規ゲーム開始(資金加速つき) ---
  await page.goto("/?noSymbols=1&skipIntro=1&startGold=999");
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
  expect(await readAttr(page, "data-map-id")).toBe("town");
  expect(await readAttr(page, "data-gold")).toBe("999");
  const baseAtk = Number(await readAttr(page, "data-atk"));
  expect(Number.isInteger(baseAtk)).toBe(true);

  // --- 商人レンド(16,4)の正面 (16,5) へ移動して上を向く ---
  // (10,10) から x=10 の列を北上して (10,5)、y=5 の行を東進して (16,5)
  for (let y = 9; y >= 5; y -= 1) {
    await stepTo(page, "ArrowUp", 10, y);
  }
  for (let x = 11; x <= 16; x += 1) {
    await stepTo(page, "ArrowRight", x, 5);
  }
  await page.keyboard.press("ArrowUp"); // 商人(16,4)は歩けない=向きだけ上になる
  await page.waitForTimeout(350);

  // --- 話しかけて店を開く(interact の取りこぼしに備えて再試行) ---
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await readAttr(page, "data-interaction")) === "shop") break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => readAttr(page, "data-interaction"), { timeout: 5_000 }).toBe("shop");

  // --- 「買う」→ 在庫4番目の「錆びた片刃」(60G)を購入 ---
  // 在庫順は SHOP_STOCK: 回復薬(小)/回復薬(中)/解毒薬/錆びた片刃/琥珀刃/擦り切れた外套/灯守りの帷子
  await pressMenuKey(page, "Space"); // ルートメニュー先頭「買う」を決定
  await pressMenuKey(page, "ArrowDown");
  await pressMenuKey(page, "ArrowDown");
  await pressMenuKey(page, "ArrowDown"); // カーソル=錆びた片刃
  await pressMenuKey(page, "Space"); // 購入(1個)
  await expect.poll(() => readAttr(page, "data-gold"), { timeout: 5_000 }).toBe("939");

  // --- 店を閉じて1歩離れる(interaction はサーバー側で移動時に解除される) ---
  await pressMenuKey(page, "Escape"); // 買うリスト → ルートメニュー
  await pressMenuKey(page, "Escape"); // ルートメニュー → 店を閉じる
  await stepTo(page, "ArrowDown", 16, 6);
  await expect.poll(() => readAttr(page, "data-interaction"), { timeout: 5_000 }).toBe("none");

  // --- もちものを開いて「錆びた片刃」を装備する ---
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await readAttr(page, "data-menu")) === "inventory") break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => readAttr(page, "data-menu"), { timeout: 5_000 }).toBe("inventory");
  // リスト順: [武器](なし・選択不可)/[防具](なし・選択不可)/回復薬(小)/錆びた片刃。
  // 空スロットは選択不可のためカーソルは回復薬(小)から始まる
  await pressMenuKey(page, "ArrowDown"); // カーソル=錆びた片刃
  await pressMenuKey(page, "Space"); // アクションメニューを開く
  await pressMenuKey(page, "Space"); // 先頭「そうびする」を決定
  await expect.poll(() => readAttr(page, "data-atk"), { timeout: 5_000 }).toBe(String(baseAtk + 3));

  // --- スロット行から「はずす」と実効攻撃力が戻る ---
  // 装備後のリスト順: [武器]錆びた片刃(攻+3)/[防具](なし)/回復薬(小)。
  // 直前のカーソル位置(3)はリスト縮小で折り返され先頭の[武器]行に合う(MenuList の初期位置規則)
  await pressMenuKey(page, "Space"); // スロット行のアクションメニューを開く
  await pressMenuKey(page, "Space"); // 先頭「はずす」を決定
  await expect.poll(() => readAttr(page, "data-atk"), { timeout: 5_000 }).toBe(String(baseAtk));

  // --- もちものを閉じて移動できることを確認 ---
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await readAttr(page, "data-menu")) === "none") break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => readAttr(page, "data-menu"), { timeout: 5_000 }).toBe("none");
  await stepTo(page, "ArrowDown", 16, 7);
});
