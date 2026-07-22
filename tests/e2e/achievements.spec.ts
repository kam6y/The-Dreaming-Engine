import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// 実績「夢の欠片」スモーク(M24-3)。装備2点(錆びた片刃+擦り切れた外套)を購入・装備して
// traveler-outfitted(旅支度)を決定論で解除し:
// 1. data-achievements-unlocked が 0→1 に増える(解除トーストは canvas のため目視確認で担保)
// 2. data-achievement-last が "traveler-outfitted" になる(サーバーの解除順の末尾)
// 3. K で実績一覧「夢の欠片」が開閉できる(data-menu="achievements" ⇄ "none")
// 12条件それぞれの成立・不可逆性・旧セーブ互換はユニットテスト(M24-2の34件)で担保済みのため、
// 本スモークは配線(view差分→data属性→K開閉)の観測に専念する。
// 移動・店・装備の操作流儀は equipment.spec.ts と同一(在庫順・カーソル規則のコメント参照)。

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

test("夢の欠片: 装備2点で「旅支度」が解除され、Kで一覧が開閉できる", async ({ page }) => {
  test.setTimeout(90_000);

  // --- 新規ゲーム開始(資金加速つき)。実績は空から ---
  await page.goto("/?noSymbols=1&skipIntro=1&startGold=999");
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
  expect(await readAttr(page, "data-map-id")).toBe("town");
  expect(await readAttr(page, "data-achievements-unlocked")).toBe("0");
  expect(await readAttr(page, "data-achievement-last")).toBe("none");

  // --- 商人レンド(16,4)の正面 (16,5) へ移動して上を向く(equipment.spec と同じ経路) ---
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

  // --- 「買う」→ 在庫4番目「錆びた片刃」(60G)と6番目「擦り切れた外套」(50G)を購入 ---
  // 在庫順は SHOP_STOCK: 回復薬(小)/回復薬(中)/解毒薬/錆びた片刃/琥珀刃/擦り切れた外套/
  // 灯守りの帷子/灯明。購入後もカーソルは同じ行に残る(在庫リストは不変)
  await pressMenuKey(page, "Space"); // ルートメニュー先頭「買う」を決定
  await pressMenuKey(page, "ArrowDown");
  await pressMenuKey(page, "ArrowDown");
  await pressMenuKey(page, "ArrowDown"); // カーソル=錆びた片刃
  await pressMenuKey(page, "Space"); // 購入(1個)
  await expect.poll(() => readAttr(page, "data-gold"), { timeout: 5_000 }).toBe("939");
  await pressMenuKey(page, "ArrowDown");
  await pressMenuKey(page, "ArrowDown"); // カーソル=擦り切れた外套
  await pressMenuKey(page, "Space"); // 購入(1個)
  await expect.poll(() => readAttr(page, "data-gold"), { timeout: 5_000 }).toBe("889");

  // --- 店を閉じて1歩離れる(所持だけでは解除されない=両スロット装備が条件) ---
  await pressMenuKey(page, "Escape"); // 買うリスト → ルートメニュー
  await pressMenuKey(page, "Escape"); // ルートメニュー → 店を閉じる
  await stepTo(page, "ArrowDown", 16, 6);
  await expect.poll(() => readAttr(page, "data-interaction"), { timeout: 5_000 }).toBe("none");
  expect(await readAttr(page, "data-achievements-unlocked")).toBe("0");

  // --- もちものから武器→防具の順に装備する ---
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await readAttr(page, "data-menu")) === "inventory") break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => readAttr(page, "data-menu"), { timeout: 5_000 }).toBe("inventory");
  // リスト順: [武器](なし・選択不可)/[防具](なし・選択不可)/回復薬(小)/錆びた片刃/擦り切れた外套。
  // カーソルは先頭の選択可能行=回復薬(小)から始まる
  await pressMenuKey(page, "ArrowDown"); // カーソル=錆びた片刃
  await pressMenuKey(page, "Space"); // アクションメニューを開く
  await pressMenuKey(page, "Space"); // 先頭「そうびする」を決定(武器のみ=まだ解除されない)
  await expect.poll(() => readAttr(page, "data-achievements-unlocked"), { timeout: 5_000 }).toBe(
    "0"
  );
  // 装備後のリスト順: [武器]錆びた片刃/[防具](なし)/回復薬(小)/擦り切れた外套。
  // 直前のカーソル位置(3)はリスト長4のまま=擦り切れた外套の行に残る(MenuList の位置規則)
  await pressMenuKey(page, "Space"); // アクションメニューを開く
  await pressMenuKey(page, "Space"); // 先頭「そうびする」を決定(両スロット=旅支度が解除)

  // --- 解除の観測: 解除数 0→1・直近解除 id ---
  await expect.poll(() => readAttr(page, "data-achievements-unlocked"), { timeout: 5_000 }).toBe(
    "1"
  );
  expect(await readAttr(page, "data-achievement-last")).toBe("traveler-outfitted");

  // --- もちものを閉じ、K で実績一覧「夢の欠片」を開閉する ---
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await readAttr(page, "data-menu")) === "none") break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => readAttr(page, "data-menu"), { timeout: 5_000 }).toBe("none");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await readAttr(page, "data-menu")) === "achievements") break;
    await page.keyboard.press("k");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => readAttr(page, "data-menu"), { timeout: 5_000 }).toBe("achievements");
  await pressMenuKey(page, "k"); // K でとじる
  await expect.poll(() => readAttr(page, "data-menu"), { timeout: 5_000 }).toBe("none");

  // --- 一覧を閉じた後も移動できる(入力が奪われていない) ---
  await stepTo(page, "ArrowDown", 16, 7);
});
