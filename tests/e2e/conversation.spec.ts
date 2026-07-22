import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// 会話スモーク(M4-G)。情報屋カイ(4,10)へ話しかけ→会話 overlay 開始→
// 「話しかける」で自由入力欄(#game input)を開いてテキスト送信→入力欄が閉じ会話継続→
// Esc で会話終了(data-interaction が none へ戻る)を検証する。
//
// AI はモック(playwright.config.ts webServer=pnpm dev:mock)で決定論。
// canvas 内の会話 UI は覗けないため、#game の data 属性(data-interaction)と
// DOM の自由入力欄 #game input を同期点にする。メニュー操作はキー間に 250ms 挟む
// (同一フレーム2キーでカーソル移動が反映されない既知問題への対処。既存 E2E 参照)。

const GAME = "#game";

async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

async function readPositionKey(page: Page): Promise<string> {
  const x = await readAttr(page, "data-player-x");
  const y = await readAttr(page, "data-player-y");
  return `${x},${y}`;
}

/**
 * 1歩キー入力して目標座標へ到達するまで待つ(取りこぼし対策つき)。
 * 移動アニメ(140ms)+サーバー往復が収まるまで待ってから判定し、未到達なら再押下する
 * (既に到達したマスへは押さないので進みすぎない)。
 */
async function stepTo(page: Page, key: string, x: number, y: number): Promise<void> {
  const target = `${x},${y}`;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await readPositionKey(page)) === target) return;
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
  }
  expect(await readPositionKey(page)).toBe(target);
}

/** 新規ゲームを開始して街(灯町)の探索へ入る */
async function startNewGame(page: Page): Promise<void> {
  await page.goto("/?noSymbols=1&skipIntro=1");
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
  expect(await readAttr(page, "data-map-id")).toBe("town");
  expect(await readPositionKey(page)).toBe("10,10");
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
  // (10,10) から西へ5マス → (5,10)。y=10 の行は x=1..20 まで歩行可能(town の実データ)。
  for (let x = 9; x >= 5; x -= 1) {
    await stepTo(page, "ArrowLeft", x, 10);
  }
  // 西進で到達したため向きは左=情報屋 (4,10) に正対している(追加の向き変更は不要)
  expect(await readPositionKey(page)).toBe("5,10");
}

test("情報屋との会話: 話しかけ→自由入力送信→会話継続→Escで終了", async ({ page }) => {
  test.setTimeout(60_000);

  await startNewGame(page);
  await faceInformant(page);

  // 話しかける(interact)→ 会話 overlay 開始(Space 取りこぼしに備えて開始まで再試行)
  await talkTo(page);

  // 挨拶(speak)受信 → メニュー活性化(サーバー往復+次tick)を待つ
  await page.waitForTimeout(800);

  // メニューは [仕事はあるか尋ねる, 話しかける, 立ち去る]。「話しかける」(index 1)へ下げて決定
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");

  // 自由入力欄(#game input)が出現する
  await expect(page.locator(`${GAME} input`)).toHaveCount(1, { timeout: 10_000 });

  // テキストを入力して Enter 送信 → 入力欄が閉じる
  await page.locator(`${GAME} input`).fill("こんばんは、カイ。何か掴んだかい");
  await page.locator(`${GAME} input`).press("Enter");
  await expect(page.locator(`${GAME} input`)).toHaveCount(0, { timeout: 10_000 });

  // 送信後も会話は継続している(interaction は conversation のまま)
  expect(await readAttr(page, "data-interaction")).toBe("conversation");

  // NPC 応答(speak)を待ってから Esc で会話を終える → interaction が none へ戻る
  await page.waitForTimeout(600);
  await endConversation(page);
});
