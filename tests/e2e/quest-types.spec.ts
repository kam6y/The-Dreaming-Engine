import { mkdir, rm, writeFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createNewGameState, gameStateSchema } from "../../packages/shared/dist/index.js";
import { E2E_SAVE_DIR, E2E_SAVE_FILE } from "./e2e-save-dir.js";

// サブクエスト3型スモーク(ROADMAP M19-4)。配達(deliver)型を最短経路で通す:
// 受注(預かり品の別枠受領)→受取NPCへの話しかけ納品(決定論)→ジャーナルからの報告
// (Enter。報酬 20G)までを、data-quest-count / data-gold で観測する。
//
// 提案型の誘発: MockDreamMaster は情報屋の topic がテスト専用の番兵値のとき対応する型の
// propose_quest を返す(packages/server/src/ai/dream-master/mock.ts の
// MOCK_QUEST_TOPIC_BY_TYPE。既定は hunt=既存 quest.spec の前提は不変)。
// フィクスチャセーブで npcs.informant.topic に番兵値を書き、「つづきから」でロードする
// (chapter2.spec と同じフィクスチャ+つづきから方式)。
//
// 敵シンボル回避: 動線は灯町(town)内で完結する。街に敵シンボルは湧かない。

const GAME = "#game";

/** mock.ts MOCK_QUEST_TOPIC_BY_TYPE.deliver と一致(番兵値。ドリフトすれば本テストが落ちる) */
const DELIVER_TOPIC_SENTINEL = "__mock_quest_deliver__";

async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

async function readPositionKey(page: Page): Promise<string> {
  const x = await readAttr(page, "data-player-x");
  const y = await readAttr(page, "data-player-y");
  return `${x},${y}`;
}

/** 1歩キー入力して目標座標へ到達するまで待つ(取りこぼしは再押下。quest.spec と同じ流儀) */
async function stepTo(page: Page, key: string, x: number, y: number): Promise<void> {
  const target = `${x},${y}`;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await readPositionKey(page)) === target) return;
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
  }
  expect(await readPositionKey(page)).toBe(target);
}

/**
 * フィクスチャセーブを書く: 新規状態を土台に、情報屋の topic を deliver 番兵値へ、
 * 現在地を情報屋カイ(town 4,10)の東隣 (5,10)・左向き(正対)へ上書きする。
 * gameStateSchema.parse で「zod スキーマで読める有効なセーブ」であることを自己検証する。
 */
async function writeFixture(): Promise<void> {
  const base = createNewGameState();
  const candidate = {
    ...base,
    location: { mapId: "town", position: { x: 5, y: 10 }, facing: "left" },
    npcs: {
      ...base.npcs,
      informant: { ...base.npcs.informant, topic: DELIVER_TOPIC_SENTINEL }
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

/** 正面のNPCへ話しかける(interact の取りこぼしに備え、会話開始まで再試行。quest.spec と同じ) */
async function talkTo(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await readAttr(page, "data-interaction")) === "conversation") return;
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => readAttr(page, "data-interaction"), { timeout: 5_000 }).toBe("conversation");
}

/** Esc で会話を終える(quest.spec と同じ流儀) */
async function endConversation(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await readAttr(page, "data-interaction")) === "none") return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => readAttr(page, "data-interaction"), { timeout: 5_000 }).toBe("none");
}

// テスト専用セーブは必ず消す(後続スペックの新規開始を上書き確認で塞がない。chapter2.spec と同じ)
test.afterEach(async () => {
  await rm(E2E_SAVE_FILE, { force: true });
  await rm(`${E2E_SAVE_FILE}.bak`, { force: true });
});

test("配達(deliver)サブクエスト: 受注→オルガへ納品→ジャーナルから報告(gold +20)", async ({
  page
}) => {
  test.setTimeout(60_000);

  await writeFixture();
  await continueFromTitle(page);
  expect(await readAttr(page, "data-map-id")).toBe("town");
  expect(await readAttr(page, "data-gold")).toBe("30"); // INITIAL_GOLD

  // --- 受注: カイに「仕事はあるか」→ deliver 提案(番兵 topic)→ 引き受ける ---
  await talkTo(page);
  expect(await readAttr(page, "data-quest-count")).toBe("0");
  await page.waitForTimeout(800);
  await page.keyboard.press("Space"); // 「仕事はあるか尋ねる」(index 0)

  // 提案生成 + speak + メニュー再構築(受諾/辞退の出現)を待つ
  await page.waitForTimeout(1000);
  // [仕事はあるか尋ねる, 話しかける, 引き受ける, 断る, 立ち去る] → 「引き受ける」(index 2)
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");
  await expect.poll(() => readAttr(page, "data-quest-count"), { timeout: 10_000 }).toBe("1");

  // 受諾ダイアログ(「恩に着るよ…」+「封緘の文を預かった。」)を消化して会話終了
  await page.waitForTimeout(600);
  await endConversation(page);

  // --- 納品: 受取NPC=オルガ(灯宿・town 4,4)。北へ 6 歩 → 西を向いて話しかける ---
  for (let y = 9; y >= 4; y -= 1) {
    await stepTo(page, "ArrowUp", 5, y);
  }
  await page.keyboard.press("ArrowLeft"); // (4,4) はオルガのマス=移動はブロックされ向きだけ変わる
  await page.waitForTimeout(350);
  expect(await readPositionKey(page)).toBe("5,4");

  // 話しかけ → 納品(決定論)の手渡し dialog 2件+宿の挨拶 dialog が続く。Space で消化する
  // (open のときだけ送る。閉じている間は innConfirm や次の dialog の出現を待つ)
  await page.keyboard.press("Space");
  for (let i = 0; i < 12; i += 1) {
    if ((await readAttr(page, "data-dialog")) === "open") {
      await page.keyboard.press("Space");
    }
    await page.waitForTimeout(300);
  }
  // 宿の確認(泊まるか?)は dialog をすべて消化し終えた後に開く。Esc=やめる で断る
  // (納品はこの前段で完了済み。Esc が confirm 出現前に空振りしても後段のリトライで回復する)
  await expect.poll(() => readAttr(page, "data-dialog"), { timeout: 5_000 }).toBe("closed");
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // 納品はインベントリ操作のみ(gold 不変・クエストは達成として受注枠を占有し続ける)
  expect(await readAttr(page, "data-quest-count")).toBe("1");
  expect(await readAttr(page, "data-gold")).toBe("30");

  // --- 報告: ジャーナル(Q)から Enter で報告(先頭=当該クエスト・報告可) ---
  // 宿確認が残っている間 Q はガードされるため、data-menu=journal になるまでリトライする
  // (開かなければ Esc で残った confirm/overlay を閉じてから次周の Q で開く)
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.keyboard.press("q");
    await page.waitForTimeout(400);
    if ((await readAttr(page, "data-menu")) === "journal") break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  expect(await readAttr(page, "data-menu")).toBe("journal");
  await page.keyboard.press("Enter");

  // 報告成立: 受注枠が空き、報酬 20G(30→50)。応答のカイの台詞 dialog が開く
  await expect.poll(() => readAttr(page, "data-quest-count"), { timeout: 10_000 }).toBe("0");
  await expect.poll(() => readAttr(page, "data-gold"), { timeout: 5_000 }).toBe("50");
});
