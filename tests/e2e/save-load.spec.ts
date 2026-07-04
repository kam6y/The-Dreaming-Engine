import { existsSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { E2E_SAVE_FILE } from "./e2e-save-dir.js";

// セーブ/ロードスモーク(ROADMAP M3 最終項目)。
//
// 新規ゲーム → 宿屋の主人へ話しかけて宿泊(rest)→ サーバーがセーブを書く →
// リロードして「つづきから」→ 宿泊時点の状態(日数・所持金・マップ・位置)が
// 復元されることを検証する。セーブは宿泊時のみサーバーが書く仕様
// (game-design.md「セーブ/ロード」)。
//
// セーブ先は playwright.config.ts の webServer.env.SAVE_DIR でテスト専用の
// 隔離ディレクトリへ切り替えてある(人間のプレイセーブを汚さない)。この spec は
// <SAVE_DIR>/save1.json の実在も確認し、セーブが確かにテスト専用ディレクトリへ
// 落ちていること(=SAVE_DIR がサーバーへ伝わっていること)を保証する。
//
// 探索/タイトルの状態は #game 要素の data 属性へ同期される
// (exploration-scene.ts / title-scene.ts の syncDomState)。

const GAME = "#game";

/** #game 要素の data 属性を読む(未設定なら null) */
async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

/** 現在のプレイヤー座標を "x,y" 文字列で読む(位置ポーリング用) */
async function readPositionKey(page: Page): Promise<string> {
  const x = await readAttr(page, "data-player-x");
  const y = await readAttr(page, "data-player-y");
  return `${x},${y}`;
}

/** 1歩キー入力し、目標座標へ到達するまで待つ(1マスずつ確実に進める) */
async function stepTo(page: Page, key: string, x: number, y: number): Promise<void> {
  await page.keyboard.press(key);
  await expect.poll(() => readPositionKey(page), { timeout: 10_000 }).toBe(`${x},${y}`);
}

test("宿泊でセーブし、リロード→つづきからで状態が復元される", async ({ page }) => {
  test.setTimeout(60_000);

  // --- 新規ゲーム開始 → 街「灯町」 ---
  // 敵シンボルは移動の邪魔になるため無効化する(このテストは戦闘を扱わない)
  await page.goto("/?noSymbols=1");
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();

  // Phaser のキーボード対象は window。入力を届けるためキャンバスへフォーカスする
  await page.locator("canvas").click();

  // 既存セーブは globalSetup で消してあるため、Enter 一回で新規ゲームが即開始する
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
  expect(await readAttr(page, "data-map-id")).toBe("town");
  expect(await readPositionKey(page)).toBe("10,10"); // 初期位置
  expect(await readAttr(page, "data-day")).toBe("1");
  expect(await readAttr(page, "data-gold")).toBe("30");

  // --- 宿屋の主人(4,4)の正面(4,5)へ移動する ---
  // (10,10) から北へ5マス → (10,5)、西へ6マス → (4,5)。
  // y=5〜9 の行は x=1..20 まで歩行可能(town マップの実データ)。
  for (let y = 9; y >= 5; y -= 1) {
    await stepTo(page, "ArrowUp", 10, y);
  }
  for (let x = 9; x >= 4; x -= 1) {
    await stepTo(page, "ArrowLeft", x, 5);
  }
  expect(await readPositionKey(page)).toBe("4,5");

  // (4,5) で上を向く。主人のいる (4,4) は歩けないので移動はブロックされ、
  // 向きだけが上になる(位置は (4,5) のまま)。話しかけには正対が必要。
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(200);
  expect(await readPositionKey(page)).toBe("4,5");

  // --- 宿泊フロー: Space を送りながら data-day が "2" になるのを待つ ---
  // Space の意味は状態で変わる(挨拶ダイアログを開く→閉じる→宿泊確認で「泊まる」)。
  // サーバー往復のタイミングに揺れがあるため、ポーリングで確実に進める。
  //
  // 重要: data-day が "2" になったら絶対にそれ以上 Space を送らない。主人へ正対
  // したままなので、余分な入力で2泊目(day=3)が始まってしまう。そのため必ず
  // ループ先頭で日数を確認し、"2" なら押す前に脱出する。
  for (let i = 0; i < 15; i += 1) {
    if ((await readAttr(page, "data-day")) === "2") {
      break;
    }
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
  }

  // 宿泊が成立し、日数が進み宿代10Gが引かれていること
  await expect.poll(() => readAttr(page, "data-day"), { timeout: 10_000 }).toBe("2");
  expect(await readAttr(page, "data-gold")).toBe("20"); // 30 - 10(宿代)
  expect(await readPositionKey(page)).toBe("4,5");

  // セーブがテスト専用ディレクトリへ書かれていること(SAVE_DIR 分離の実証)。
  // 書き込みはサーバー側で snapshot より遅れることがあるためポーリングする。
  await expect.poll(() => existsSync(E2E_SAVE_FILE), { timeout: 10_000 }).toBe(true);

  // --- リロード → タイトル → つづきから ---
  await page.goto("/?noSymbols=1");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("title");
  await page.locator("canvas").click();

  // hello 受信でセーブ有無が反映される。hasSave=1 になってから操作する
  // (hello ハンドラがメニューを組み直しカーソルを先頭へ戻すため、この後の
  //  ArrowDown が確実に「つづきから」へ当たる)
  await expect.poll(() => readAttr(page, "data-has-save"), { timeout: 10_000 }).toBe("1");

  // カーソルを「つづきから」へ下げて決定 → 探索へ。
  // ArrowDown と Enter の間に待ちを挟むのが要点: Phaser のキーボード入力は
  // ゲーム更新フレーム単位で処理されるため、両キーが同一フレームに入ると
  // カーソル移動が決定に反映されず「新規ゲーム」のまま決定されかねない
  // (=タイトルに留まる)。人が押す程度の間隔を空けて確実に別フレームへ分ける。
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");

  // --- 復元の検証: 宿泊時点の状態が戻っていること ---
  expect(await readAttr(page, "data-day")).toBe("2");
  expect(await readAttr(page, "data-gold")).toBe("20");
  expect(await readAttr(page, "data-map-id")).toBe("town");
  expect(await readPositionKey(page)).toBe("4,5");
});
