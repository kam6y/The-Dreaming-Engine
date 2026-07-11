import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// 全体マップ「夢の地図」のスモーク(M22-3)。
// 新規ゲーム(seed固定・noSymbols=敵シンボル無効で動線を安定化)で:
// 1. 街スタート時点の訪問数=1(data-visited-count。visitedMaps=["town"])
// 2. M で「夢の地図」が開く(data-menu="map")・Esc で閉じる(data-menu="none")
// 3. 忘れ野へ遷移すると訪問数が2へ増える(enterCurrentMap の記録=M22-2の機構をUI観測点で確認)
// 4. 再度 M で開閉できる(Mトグル)
// ノードの見た目(靄・現在地の琥珀強調)は canvas 描画のため目視確認で担保し、
// E2E は data 属性(syncDomState)を観測点にする(既存スモークと同じ流儀)。

const GAME = "#game";
const SEED = 42;

async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

/** キー1押し+反映待ち(オーバーレイ開閉の同期。quest.spec と同じ流儀) */
async function pressKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(300);
}

test("夢の地図: Mで開閉でき、忘れ野への遷移で訪問済みマップ数が増える", async ({ page }) => {
  test.setTimeout(60_000);

  // --- 新規ゲーム開始(敵シンボル無効=移動の安定化) ---
  await page.goto(`/?seed=${SEED}&noSymbols=1&skipIntro=1`);
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();
  await page.keyboard.press("Enter");
  // 先行スペックがセーブを残していた場合の上書き確認(skill.spec と同じ扱い)
  for (let i = 0; i < 5; i += 1) {
    await page.waitForTimeout(1_500);
    if ((await readAttr(page, "data-map-id")) === "town") break;
    await page.keyboard.press("Space");
  }
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 10_000 }).toBe("town");

  // --- 開始時点: 訪問済みは灯町の1枚(visitedMaps=["town"]) ---
  expect(await readAttr(page, "data-visited-count")).toBe("1");
  expect(await readAttr(page, "data-menu")).toBe("none");

  // --- M で「夢の地図」が開き、Esc で閉じる ---
  await pressKey(page, "m");
  await expect.poll(() => readAttr(page, "data-menu"), { timeout: 5_000 }).toBe("map");
  await pressKey(page, "Escape");
  await expect.poll(() => readAttr(page, "data-menu"), { timeout: 5_000 }).toBe("none");

  // --- 忘れ野へ遷移(movement.spec と同じ動線: x=11 の背骨道を南下) ---
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => readAttr(page, "data-player-x"), { timeout: 10_000 }).toBe("11");
  await page.keyboard.down("ArrowDown");
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 15_000 }).toBe("field");
  await page.keyboard.up("ArrowDown");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");

  // --- 訪問済みが2枚に増えている(town + field) ---
  await expect.poll(() => readAttr(page, "data-visited-count"), { timeout: 5_000 }).toBe("2");

  // --- 再度 M で開閉(トグル) ---
  await pressKey(page, "m");
  await expect.poll(() => readAttr(page, "data-menu"), { timeout: 5_000 }).toBe("map");
  await pressKey(page, "m");
  await expect.poll(() => readAttr(page, "data-menu"), { timeout: 5_000 }).toBe("none");
});
