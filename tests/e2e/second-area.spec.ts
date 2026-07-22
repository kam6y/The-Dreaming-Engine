import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// 第2エリア到達スモーク(ROADMAP M16-4)。
// 灯町 → 忘れ野 → 西門(0,8) → 沈み野 → 北門(11,0) → 琥珀郷 の遷移を検証する。
// 経路はマップ実データ(maps/field.ts の横枝道 y=8・maps/field2.ts のL字道)に従う。
// 移動状態は探索シーンが #game 要素の data 属性へ同期する(exploration-scene.ts)。

const GAME = "#game";

/** #game 要素の data 属性を読む(未設定なら null) */
async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

/**
 * 1マスずつ確定歩行する(キー押下→期待座標のポーリング)。
 * 長押し+座標ポーリングは行き過ぎ(オーバーシュート)で門を外すことがあるため、
 * 門へ正確に立つ必要がある本スモークでは1歩ずつ検証しながら進む。
 */
async function stepTo(page: Page, key: string, attr: "data-player-x" | "data-player-y", expected: number): Promise<void> {
  await page.keyboard.press(key);
  await expect.poll(() => readAttr(page, attr), { timeout: 10_000 }).toBe(String(expected));
}

/** 門マスへ踏み込み、マップ遷移を待つ */
async function stepIntoGate(page: Page, key: string, targetMapId: string): Promise<void> {
  await page.keyboard.press(key);
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 10_000 }).toBe(targetMapId);
}

test("第2エリア到達: 灯町→忘れ野→西門→沈み野→琥珀郷", async ({ page }) => {
  test.setTimeout(90_000);

  // 踏破スモークのため敵シンボルを無効化(movement.spec と同じ)
  await page.goto("/?noSymbols=1&skipIntro=1");
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();

  // タイトルで Enter → 探索シーン開始(街「灯町」)
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 10_000 }).toBe("town");

  // 街: 初期位置 (10,10) → 背骨道 x=11 → 南門から忘れ野へ
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => readAttr(page, "data-player-x"), { timeout: 10_000 }).toBe("11");
  await page.keyboard.down("ArrowDown");
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 15_000 }).toBe("field");
  await page.keyboard.up("ArrowDown");

  // 忘れ野: 入口 (11,1) → 横枝道の高さ y=8 まで南下
  for (let y = 2; y <= 8; y += 1) {
    await stepTo(page, "ArrowDown", "data-player-y", y);
  }
  // 横枝道を西進(x=10..1)し、西門 (0,8) から沈み野へ
  for (let x = 10; x >= 1; x -= 1) {
    await stepTo(page, "ArrowLeft", "data-player-x", x);
  }
  await stepIntoGate(page, "ArrowLeft", "field-2");

  // 沈み野: 入口 (22,8) → 横道を西進して縦道 x=11 へ → 北門 (11,0) から琥珀郷へ
  await expect.poll(() => readAttr(page, "data-player-x")).toBe("22");
  for (let x = 21; x >= 11; x -= 1) {
    await stepTo(page, "ArrowLeft", "data-player-x", x);
  }
  for (let y = 7; y >= 1; y -= 1) {
    await stepTo(page, "ArrowUp", "data-player-y", y);
  }
  await stepIntoGate(page, "ArrowUp", "settlement");

  // 琥珀郷への到達を確認(南門の一つ内側 (8,10) に立つ)
  await expect.poll(() => readAttr(page, "data-map-id")).toBe("settlement");
  await expect.poll(() => readAttr(page, "data-player-x")).toBe("8");
  await expect.poll(() => readAttr(page, "data-player-y")).toBe("10");
});
