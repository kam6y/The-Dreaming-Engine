import { mkdir, rm, writeFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createNewGameState, gameStateSchema } from "../../packages/shared/dist/index.js";
import { E2E_SAVE_DIR, E2E_SAVE_FILE } from "./e2e-save-dir.js";

// 夢の世界変化3kind(M20-3)のスモーク。翌朝の世界に演出が現れることを最短経路で観測する:
// market_shift=店の買値が市場倍率で変わる(scarcity: 20G→24G。表示と請求は同一計算)/
// npc_absence=不在NPCが data-absent-npc へ同期(スプライト非表示は目視確認で担保)/
// dream_erosion=侵食度が data-dream-erosion へ同期(暗色の帳は目視確認で担保)。
//
// 夢シーン(AI)経由の発火・検証・適用はユニット/統合テスト(M20-2の29件)でカバー済みのため、
// 本スモークは chapter2/quest-types と同じ**フィクスチャセーブ+つづきから**方式で
// world 状態を直接書き、クライアント演出の観測に専念する(番兵注入の配線を増やさない)。
//
// 敵シンボル回避: 動線は灯町(town)内で完結する。街に敵シンボルは湧かない。

const GAME = "#game";

async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

/** メニュー操作のキー(反映待ちの 250ms を挟む。equipment.spec と同じ流儀) */
async function pressMenuKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(250);
}

/**
 * フィクスチャセーブを書く: 新規状態を土台に、商人レンド(town 16,4)の正面 (16,5)・上向きと、
 * 夢の世界変化3kindの適用後 world(品薄・オルガ不在・侵食度2)を直接上書きする。
 * gameStateSchema.parse で「zod スキーマで読める有効なセーブ」であることを自己検証する。
 */
async function writeFixture(): Promise<void> {
  const base = createNewGameState();
  const candidate = {
    ...base,
    location: { mapId: "town", position: { x: 16, y: 5 }, facing: "up" },
    world: {
      ...base.world,
      marketShift: "scarcity",
      absentNpc: "innkeeper",
      dreamErosion: 2
    }
  };
  const validated = gameStateSchema.parse(candidate);
  await mkdir(E2E_SAVE_DIR, { recursive: true });
  await writeFile(E2E_SAVE_FILE, JSON.stringify(validated, null, 2), "utf8");
}

/** タイトルで「つづきから」を選んでロードする(chapter2.spec と同じ流儀) */
async function continueFromTitle(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("サーバー: 接続済み")).toBeVisible({ timeout: 10_000 });
  await page.locator("canvas").click();
  await expect.poll(() => readAttr(page, "data-has-save"), { timeout: 10_000 }).toBe("1");
  await page.waitForTimeout(250);
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
}

// テスト専用セーブは必ず消す(後続スペックの新規開始を上書き確認で塞がない)
test.afterEach(async () => {
  await rm(E2E_SAVE_FILE, { force: true });
  await rm(`${E2E_SAVE_FILE}.bak`, { force: true });
});

test("夢の世界変化: 品薄の買値(20G→24G)・不在NPC・侵食度が翌朝の世界に現れる", async ({
  page
}) => {
  test.setTimeout(60_000);

  await writeFixture();
  await continueFromTitle(page);
  expect(await readAttr(page, "data-map-id")).toBe("town");
  expect(await readAttr(page, "data-gold")).toBe("30"); // INITIAL_GOLD

  // --- 侵食度・不在NPCが view 経由で同期されている(演出の可視確認は実プレイ目視) ---
  expect(await readAttr(page, "data-dream-erosion")).toBe("2");
  expect(await readAttr(page, "data-absent-npc")).toBe("innkeeper");

  // --- market_shift: レンドの店で回復薬(小)が品薄価格 24G(20×1.2)になっている ---
  // 正面のレンドに話しかけて店を開く(interact の取りこぼしに備えて再試行)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await readAttr(page, "data-interaction")) === "shop") break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => readAttr(page, "data-interaction"), { timeout: 5_000 }).toBe("shop");

  // 「買う」→ 在庫先頭の回復薬(小)を購入。品薄(scarcity)で 20G→24G: gold 30→6。
  // 表示(stock)と請求(shopBuy)は同一計算(ai-integration.md「6b」)なので、
  // gold の減少額 24G が市場倍率の反映そのものを担保する
  await pressMenuKey(page, "Space"); // ルートメニュー先頭「買う」
  await pressMenuKey(page, "Space"); // 在庫先頭=回復薬(小)を購入(1個)
  await expect.poll(() => readAttr(page, "data-gold"), { timeout: 5_000 }).toBe("6");

  // --- 店を閉じて操作が探索へ戻る(演出が進行を阻害しない) ---
  await pressMenuKey(page, "Escape"); // 買うリスト → ルートメニュー
  await pressMenuKey(page, "Escape"); // ルートメニュー → 店を閉じる
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(400);
  await expect.poll(() => readAttr(page, "data-player-y"), { timeout: 5_000 }).toBe("6");
});
