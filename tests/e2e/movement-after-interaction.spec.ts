import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// 対話・調べる操作の後に移動できることを保証する回帰スモーク。
//
// 背景(バグ): サーバーの interact 応答には snapshot を伴わず dialog のみを返す経路が
// ある(立て札・空振り=正面に何も無い・空箱など)。探索シーンの移動ロック `awaiting` は
// snapshot / dialog / error のいずれかで解除される契約だが、以前は dialog を購読しておらず
// snapshot / error でしか解除していなかった。そのため dialog-only 応答の後は awaiting が
// true のまま固着し、以後 move を送れず「調べた後にたまに移動不能」になっていた
// (どの操作でも起きるわけではなく dialog-only の操作でだけ固着するため「たまに」に見える)。
// 修正: 探索シーンが dialog を購読して awaiting を解除する(exploration-scene.ts)。

const GAME = "#game";
async function attr(page: Page, a: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(a);
}

/** 新規ゲームで街「灯町」の初期位置(10,10)まで入る */
async function startTown(page: Page, query: string): Promise<void> {
  await page.goto(query);
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();
  await page.keyboard.press("Enter");
  await expect.poll(() => attr(page, "data-map-id"), { timeout: 15_000 }).toBe("town");
  await expect.poll(() => attr(page, "data-player-y")).toBe("10");
}

test("調べた後も移動できる(dialog-only応答でawaitingが固着しない)", async ({ page }) => {
  test.setTimeout(30_000);
  await startTown(page, "/?skipIntro=1");

  // スポーン(10,10)は facing up。正面(10,9)は空き床なので interact は
  // 「……この手が触れるものは、何もない。」の dialog-only 応答になる(= バグ再現条件)
  await page.keyboard.press("Space");
  await expect.poll(() => attr(page, "data-dialog"), { timeout: 5_000 }).toBe("open");
  await page.keyboard.press("Space"); // ダイアログを閉じる
  await expect.poll(() => attr(page, "data-dialog"), { timeout: 5_000 }).toBe("closed");

  // 上へ1歩移動できる。修正前は awaiting 固着で move が送れず y=10 のまま固まっていた
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => attr(page, "data-player-y"), { timeout: 5_000 }).toBe("9");
});

test("会話の後も移動できる(自由入力→送信→終了→移動)", async ({ page }) => {
  test.setTimeout(30_000);
  await startTown(page, "/?skipIntro=1&noSymbols=1");

  // 情報屋カイ(4,10)へ。(10,10)から左へ1マスずつ歩き(5,10)で facing left にする
  for (let x = 10; x > 5; x -= 1) {
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => attr(page, "data-player-x")).toBe(String(x - 1));
  }
  // data-player-x は snapshot 時点で 5 になるが、直後は移動 tween(moving)が残り
  // interact が無視され得る。tween(140ms)の収束を待ってから話しかける
  await page.waitForTimeout(300);
  await page.keyboard.press("Space"); // 情報屋に話しかける → 会話 overlay
  await expect.poll(() => attr(page, "data-interaction"), { timeout: 10_000 }).toBe("conversation");

  // 「話しかける」を選び(メニュー[仕事/話しかける/立ち去る]の2番目)、自由入力欄で送信する。
  // 自由入力は DOM の <input> にフォーカスを移すため、閉じた後にゲーム側キー入力へ確実に戻る
  // ことも併せて確認する(会話後の移動不能が起きないこと)
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200); // メニュー活性化(delayedCall)の待ち
  await page.keyboard.press("Space"); // 「話しかける」→ 入力欄オープン
  await page.waitForTimeout(300);
  await page.keyboard.type("こんにちは");
  await page.keyboard.press("Enter"); // 送信
  await page.waitForTimeout(600); // 応答(疑似ストリーミング)

  // 会話を終える(Esc)。interaction が none へ戻る
  await page.keyboard.press("Escape");
  await expect.poll(() => attr(page, "data-interaction"), { timeout: 10_000 }).toBe("none");

  // 会話後も移動できる
  await expect.poll(() => attr(page, "data-player-y")).toBe("10");
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => attr(page, "data-player-y"), { timeout: 5_000 }).toBe("9");
});
