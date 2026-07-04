import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { dungeon3Map, townMap } from "../../../packages/shared/dist/index.js";

import { E2E_SAVE_DIR } from "../e2e-save-dir.js";

// 通しプレイ E2E(ROADMAP M6-C / pnpm test:e2e:full)。
//
// 新規ゲーム →(オープニング)→ 司祭フィオルでメインクエスト開始 → 背骨道を南下して
// ダンジョン3層 → ボス「夢喰い」撃破 → エンディング → タイトル復帰 を1本で自動化する。
//
// テスト加速(ai-integration.md「レート・コスト保護」の注記=テスト時の演出スキップ/
// レベル加速は防御弱体化にあたらない)を使い、実時間で人間プレイの1-2時間を走らせない:
//   ?startLevel=8  … 開始レベル加速(mock 限定。ボス確勝。live では無視される)
//   ?noSymbols=1   … 雑魚シンボル無効(ダンジョンをまっすぐボスへ)
//   ?skipIntro=1   … オープニング演出スキップ
//   ?seed=42       … RNG 固定(決定論)
// オープニングは skipIntro なしの別ケースで1度だけ通す。
//
// 座標は shared/dist の実マップデータから導出してハードコードを避ける
// (背骨道の列 = ダンジョン3層ボスの x。司祭位置 = town の npc 定義)。
// 探索/戦闘/演出の状態は #game 要素の data 属性へ同期される。
// AI はモック(playwright.full.config.ts webServer=pnpm dev:mock)で決定論。

const GAME = "#game";

// スクリーンショットの出力先(gitignore 済みの test-results 直下。コミットしない)。
// E2E_SAVE_DIR = <repo>/test-results/e2e-saves なので、その親が test-results。
const RESULTS_DIR = path.dirname(E2E_SAVE_DIR);

/** 背骨道の列。全マップ南北貫通の x(ダンジョン3層ボスの x から導出) */
const SPINE_X = dungeon3Map.boss?.position.x ?? 11;

/** 司祭フィオル(メインクエスト進行役)の配置(town の npc 定義から導出) */
const PRIEST = townMap.npcs.find((n) => n.id === "priest");

/** #game 要素の data 属性を読む(未設定なら null) */
async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

/** 現在のプレイヤー座標を "x,y" 文字列で読む */
async function readPositionKey(page: Page): Promise<string> {
  const x = await readAttr(page, "data-player-x");
  const y = await readAttr(page, "data-player-y");
  return `${x},${y}`;
}

/** 現在のプレイヤー x 座標を数値で読む */
async function readPlayerX(page: Page): Promise<number> {
  return Number(await readAttr(page, "data-player-x"));
}

/**
 * 1歩キー入力して目標座標へ到達するまで待つ(取りこぼしは再押下・到達済みなら押さない)。
 * 移動アニメ(140ms)+サーバー往復が収まるまで待ってから判定する(既存 E2E の作法)。
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

/**
 * 下キーを長押しして背骨道を南下し、目的マップへ遷移するまで待つ(movement.spec と同じ作法)。
 * 遷移でシーンが再生成されるとキー押下状態がリセットされ、入口マス(11,1)で停止する。
 */
async function descendToMap(page: Page, targetMapId: string): Promise<void> {
  await page.keyboard.down("ArrowDown");
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 15_000 }).toBe(targetMapId);
  await page.keyboard.up("ArrowDown");
}

/** タイトルで新規ゲームを開始する(Enter=「新規ゲーム」。セーブは globalSetup で消去済み) */
async function startNewGame(page: Page, query: string): Promise<void> {
  await page.goto(query);
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  // Phaser のキーボード対象は window。入力を届けるためキャンバスへフォーカスする
  await page.locator("canvas").click();
  await page.keyboard.press("Enter");
}

test.describe("通しプレイ(新規→ボス撃破→エンディング)", () => {
  test("オープニング演出を通して探索(街)へ入れる", async ({ page }) => {
    test.setTimeout(60_000);

    // skipIntro なし: 新規ゲームはオープニング(op-1/op-2)を経由する
    await startNewGame(page, "/?seed=42");

    // 新規ゲーム要求 → snapshot 受信で title がオープニングを開始する
    await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("opening");

    // オープニングをスペースで送り切ると探索(街)へ入る(op-1:2行 + op-2:3行)
    for (let i = 0; i < 40; i += 1) {
      if ((await readAttr(page, "data-scene")) === "exploration") break;
      await page.keyboard.press("Space");
      await page.waitForTimeout(250);
    }
    await expect.poll(() => readAttr(page, "data-scene"), { timeout: 15_000 }).toBe("exploration");
    expect(await readAttr(page, "data-map-id")).toBe("town");
  });

  test("司祭でメインクエスト開始→ダンジョン攻略→夢喰い撃破→エンディング→タイトル", async ({
    page
  }) => {
    // 加速フラグ込みで通しプレイの実測は ~35s(内訳: 街到達~1s / 司祭~5s / 背骨道復帰~9s /
    // dungeon-3 到達~18s / ボス撃破~31s / タイトル復帰~35s)。余裕を持って 120s とする。
    test.setTimeout(120_000);

    expect(PRIEST, "town の npc に priest が定義されていること").toBeDefined();
    const priest = PRIEST as NonNullable<typeof PRIEST>;

    // --- WS フレーム傍受: 進行の権威的な確認に使う ---
    // canvas 内の演出は覗けないため、mainQuestStage(snapshot)と phase-change(battle-events)を
    // サーバーの送信フレームから機械検証する(ai-integration.md「narrate は WS で検証」に倣う)。
    let latestStage: string | null = null;
    let phaseChanged = false;
    page.on("websocket", (ws) => {
      ws.on("framereceived", (frame) => {
        const payload = frame.payload;
        if (typeof payload !== "string") return;
        let msg: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(payload);
          if (typeof parsed !== "object" || parsed === null) return;
          msg = parsed as Record<string, unknown>;
        } catch {
          return; // 非JSONフレームは無視
        }
        if (msg["type"] === "snapshot") {
          const view = msg["view"];
          if (typeof view === "object" && view !== null) {
            const stage = (view as Record<string, unknown>)["mainQuestStage"];
            if (typeof stage === "string") latestStage = stage;
          }
        }
        if (msg["type"] === "battle-events") {
          const events = msg["events"];
          if (Array.isArray(events)) {
            for (const e of events) {
              if (
                typeof e === "object" &&
                e !== null &&
                (e as Record<string, unknown>)["type"] === "phase-change"
              ) {
                phaseChanged = true;
              }
            }
          }
        }
      });
    });

    // --- 新規ゲーム(加速フラグ付き)→ 街「灯町」 ---
    await startNewGame(page, "/?startLevel=8&noSymbols=1&skipIntro=1&seed=42");
    await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
    expect(await readAttr(page, "data-map-id")).toBe("town");
    const start = townMap.playerStart.position;
    expect(await readPositionKey(page)).toBe(`${start.x},${start.y}`);

    // --- 司祭フィオル(16,10)の北隣(16,9)へ回り込んで正対する ---
    // 司祭と同じ y=10 の行は教会看板(town-sign-chapel: 14,10)が塞ぐため、一段上の
    // 行(y=9。町の実データで x=1..20 が全て床)を東進して司祭の真上へ回り込む。
    const approachRow = priest.position.y - 1; // 9
    await stepTo(page, "ArrowUp", start.x, approachRow); // (10,10) → (10,9)
    for (let x = start.x + 1; x <= priest.position.x; x += 1) {
      await stepTo(page, "ArrowRight", x, approachRow); // 東進して (16,9) へ
    }
    expect(await readPositionKey(page)).toBe(`${priest.position.x},${approachRow}`);
    // 下を向いて司祭(16,10)に正対する(占有マスなので位置は変わらず向きだけ下へ)
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    expect(await readPositionKey(page)).toBe(`${priest.position.x},${approachRow}`);

    // --- 司祭に話す: メインクエストを arrival → rift-revealed へ(スクリプト dialog) ---
    // 進行に必須の会話は AI 非依存の選択肢/明かし(game-design.md「メインクエスト」)。
    // interact の取りこぼしに備え、WS の mainQuestStage が rift-revealed になるまで再押下する。
    for (let i = 0; i < 8 && latestStage !== "rift-revealed"; i += 1) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(450);
    }
    expect(latestStage, "司祭の明かしでメインクエストが rift-revealed へ進む").toBe("rift-revealed");

    // --- 明かしのスクリプト dialog を消化しつつ背骨道(x=SPINE_X)へ西進して戻る ---
    // ダイアログが開いている間は移動がブロックされるためスペースで送る。誤って司祭の
    // AI 会話が開いた場合は Esc で閉じる(自己回復)。背骨道に着いたら止める。
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if ((await readPlayerX(page)) === SPINE_X) break;
      if ((await readAttr(page, "data-interaction")) === "conversation") {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        continue;
      }
      const before = await readPositionKey(page);
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(320);
      if ((await readPositionKey(page)) !== before) continue; // 1マス西進できた
      // 進めない = ダイアログが開いている。スペースで送る
      await page.keyboard.press("Space");
      await page.waitForTimeout(320);
    }
    await expect.poll(() => readPlayerX(page), { timeout: 10_000 }).toBe(SPINE_X);

    // --- 背骨道を南下: 街 → 忘れ野 → 裂け目 一層 → 二層 → 最深部 ---
    await descendToMap(page, "field");
    await descendToMap(page, "dungeon-1");
    await descendToMap(page, "dungeon-2");
    await descendToMap(page, "dungeon-3");

    // --- ダンジョン3層: 背骨道を南下してボス(11,13)へ接触 → ボス戦 ---
    // rift-revealed 済みなのでボスマーカーはアクティブ。接触で戦闘へ遷移する
    //(arrival のままならゲートされ battle にならない=ここで rift-revealed 到達も担保される)。
    await page.keyboard.down("ArrowDown");
    await expect.poll(() => readAttr(page, "data-scene"), { timeout: 20_000 }).toBe("battle");
    await page.keyboard.up("ArrowDown");
    expect(await readAttr(page, "data-battle-enemy")).toBe("dream-eater");

    // 検証用スクショ: ボス戦開始直後(コミットしない=test-results 配下・gitignore)
    mkdirSync(RESULTS_DIR, { recursive: true });
    await page.screenshot({ path: path.join(RESULTS_DIR, "full-boss.png") });

    // --- スペース連打でボス撃破(startLevel=8 で確勝。形態変化=HP50% を通過) ---
    // 上下キーは押さないのでコマンドは「たたかう」のまま。形態変化イベントもスペースで送る。
    let phase2Captured = false;
    for (let i = 0; i < 300; i += 1) {
      if ((await readAttr(page, "data-scene")) !== "battle") break; // エンディングへ遷移
      // 形態変化(phase-change)を WS で検知したら第2形態のスクショを1枚撮る
      if (phaseChanged && !phase2Captured) {
        phase2Captured = true;
        await page.screenshot({ path: path.join(RESULTS_DIR, "full-boss-phase2.png") });
      }
      await page.keyboard.press("Space");
      await page.waitForTimeout(150);
    }

    // --- 撃破後: 戦闘 → エンディング直行(探索を経由しない) ---
    await expect.poll(() => readAttr(page, "data-scene"), { timeout: 20_000 }).toBe("ending");
    await page.screenshot({ path: path.join(RESULTS_DIR, "full-ending.png") });

    // 形態変化のスクショが撮れなかった場合の記録(タイミング難ならスキップ可の仕様)
    if (!phase2Captured) {
      console.warn("[full] phase-change を検知できず full-boss-phase2.png はスキップした");
    }

    // --- エンディングをスペースで送り切るとタイトルへ戻る ---
    for (let i = 0; i < 40; i += 1) {
      if ((await readAttr(page, "data-scene")) === "title") break;
      await page.keyboard.press("Space");
      await page.waitForTimeout(250);
    }
    await expect.poll(() => readAttr(page, "data-scene"), { timeout: 15_000 }).toBe("title");
  });
});
