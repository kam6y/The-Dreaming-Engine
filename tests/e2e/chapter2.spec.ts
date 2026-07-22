import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createNewGameState, gameStateSchema } from "../../packages/shared/dist/index.js";
import { E2E_SAVE_DIR, E2E_SAVE_FILE } from "./e2e-save-dir.js";

// 第2章 開始〜結びの最短経路スモーク(ROADMAP M18-4)。
//
// 第1章の通しプレイを再生せず、第2章の3段階遷移(epilogue → ch2-stirring →
// ch2-vigil-song → ch2-beyond)だけを最短で検証する。各段階の直前へワープする
// フィクスチャセーブを直接書き、タイトルの「つづきから」でロードして1操作ずつ進める。
//
// 進行はすべて決定論(調べイベント/選択肢会話。AI 非依存): game-design.md
// 「メインクエスト第2章(拡張: M18)」/ session.ts interactConduit・interactWarden。
// 段階遷移は interact 応答の snapshot が #game 要素の data-main-quest-stage へ同期する
// (exploration-scene.ts syncDomState)。snapshot は dialog 列の先頭に来るため、
// dialog を消化し切る前に段階属性が更新される=Space 連打のポーリングで観測できる。
//
// 敵シンボル回避: 敵シンボルは「プレイヤーがそのマスへ移動したとき」だけ戦闘になる
// (session.ts move の findIndex。自律 world tick は無い)。本スモークは各幕で導管/番人へ
// 正対して立つフィクスチャを置き、一切移動せず Space(調べる/話す)だけで進めるため、
// つづきからロードで ?noSymbols が効かない坑内(dungeon-4)でもエンカウントは起きない
// (interactionTarget は正面マスの NPC/オブジェクトのみを見る=敵シンボルは無関係)。

const GAME = "#game";

type Stage = "epilogue" | "ch2-stirring" | "ch2-vigil-song" | "ch2-beyond";
type Facing = "up" | "down" | "left" | "right";
interface Fixture {
  stage: Exclude<Stage, "ch2-beyond">;
  mapId: "dungeon-4" | "settlement";
  x: number;
  y: number;
  facing: Facing;
}

/** #game 要素の data 属性を読む(未設定なら null) */
async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

/**
 * フィクスチャセーブを E2E_SAVE_FILE へ書く。createNewGameState を土台に
 * mainQuestStage と location だけ上書きし、SaveStore と同一の gameStateSchema.parse を
 * 通して検証してから、SaveStore と同じ形式(2スペース整形 JSON・ファイル名 save1.json)で書く。
 * parse を通すことで「zod スキーマで読める有効なセーブ」であることをスペック内で自己検証する。
 */
async function writeFixture(fx: Fixture): Promise<void> {
  const base = createNewGameState();
  const candidate = {
    ...base,
    mainQuestStage: fx.stage,
    location: { mapId: fx.mapId, position: { x: fx.x, y: fx.y }, facing: fx.facing }
  };
  // SaveStore.save と同じ検証(gameStateSchema.parse)。壊れたフィクスチャはここで落ちる
  const validated = gameStateSchema.parse(candidate);
  await mkdir(E2E_SAVE_DIR, { recursive: true });
  await writeFile(E2E_SAVE_FILE, JSON.stringify(validated, null, 2), "utf8");
}

/**
 * タイトルで「つづきから」を選び、フィクスチャをロードして探索へ入る。
 * サーバーは接続の都度ファイル存在を見る(hello の hasSave)。continue は saveStore.load で
 * ファイルを新規に読み直すため、永続 GameSession に前幕の in-memory 状態が残っていても
 * フィクスチャで確定に上書きされる。
 */
async function continueFromTitle(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  // WS 疎通の完了(接続済み)を待つ。未接続で Enter を送るとタイトルで停止する(battle.spec の申し送り)
  await expect(page.getByText("サーバー: 接続済み")).toBeVisible({ timeout: 10_000 });
  // Phaser のキーボード対象は window。入力を届けるためキャンバスへフォーカスする
  await page.locator("canvas").click();
  // hello 受信でセーブ有無が反映される。hasSave=1 で初期カーソルが「つづきから」になる(M15-3)。
  // hasSave は hello 由来で、同バッチの(前幕の)再同期 snapshot より先に届く。反映とキー受付が
  // 別フレームになるよう少し待ってから Enter を送る(save-load.spec と同じ流儀)。
  await expect.poll(() => readAttr(page, "data-has-save"), { timeout: 10_000 }).toBe("1");
  await page.waitForTimeout(250);
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
}

/**
 * Space を送って正面の導管/番人へ interact し、段階が target へ遷移するまでポーリングする。
 * 最初の Space が interact 送信、以降の Space が dialog 列の送り。interact 応答の snapshot が
 * dialog 列の先頭に来るため、dialog を消化し切る前に data-main-quest-stage が更新される。
 * awaiting 中の入力は無視されるため、150ms 間隔でゆとりを持って送る(battle.spec と同じ流儀)。
 */
async function advanceStageViaSpace(page: Page, target: Stage): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    if ((await readAttr(page, "data-main-quest-stage")) === target) break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
  }
  await expect
    .poll(() => readAttr(page, "data-main-quest-stage"), { timeout: 10_000 })
    .toBe(target);
}

// テスト専用セーブを書くため、後続スペックの新規開始が上書き確認ダイアログに塞がれないよう
// 必ず消す(失敗時も走るよう afterEach。save-load.spec と同じ流儀。.bak は第3幕の即時セーブで生じる)
test.afterEach(async () => {
  await rm(E2E_SAVE_FILE, { force: true });
  await rm(`${E2E_SAVE_FILE}.bak`, { force: true });
});

test("第2章の開始→結びの最短経路(epilogue→ch2-stirring→ch2-vigil-song→ch2-beyond)", async ({
  page
}) => {
  // 3回のページリロード(Phaser 起動込み)を含むため既定 30s では足りない。60s へ拡張する
  test.setTimeout(60_000);

  // --- 第1幕(開始): 灯還りの坑「導管の間」で脈打つ導管に気づく(epilogue → ch2-stirring) ---
  // 導管 d4-conduit=(11,17)。その北隣 (11,16) に立ち下(導管の方)を向く。
  await writeFixture({ stage: "epilogue", mapId: "dungeon-4", x: 11, y: 16, facing: "down" });
  await continueFromTitle(page);
  expect(await readAttr(page, "data-map-id")).toBe("dungeon-4");
  expect(await readAttr(page, "data-main-quest-stage")).toBe("epilogue");
  await advanceStageViaSpace(page, "ch2-stirring");

  // --- 第2幕(トワの唄): 番人トワが唄の続き「灯の還る先」を明かす(ch2-stirring → ch2-vigil-song) ---
  // 番人トワ=warden=(14,7)。その西隣 (13,7) に立ち右(トワの方)を向く。琥珀郷は安全地帯。
  await writeFixture({ stage: "ch2-stirring", mapId: "settlement", x: 13, y: 7, facing: "right" });
  await continueFromTitle(page);
  expect(await readAttr(page, "data-map-id")).toBe("settlement");
  expect(await readAttr(page, "data-main-quest-stage")).toBe("ch2-stirring");
  await advanceStageViaSpace(page, "ch2-vigil-song");

  // --- 第3幕(結び): 導管の間へ戻り確証を得る=第2章クリア(ch2-vigil-song → ch2-beyond + 即時セーブ) ---
  await writeFixture({ stage: "ch2-vigil-song", mapId: "dungeon-4", x: 11, y: 16, facing: "down" });
  await continueFromTitle(page);
  expect(await readAttr(page, "data-map-id")).toBe("dungeon-4");
  expect(await readAttr(page, "data-main-quest-stage")).toBe("ch2-vigil-song");
  await advanceStageViaSpace(page, "ch2-beyond");

  // --- 永続化の検証: 第2章クリアはサーバーが即時セーブする(session.ts interactConduit の
  //     ch2-vigil-song 分岐)。実セーブファイル(save1.json)を Node 側で読み、
  //     zod で parse が通り mainQuestStage が "ch2-beyond" で確定していることを確認する。 ---
  await expect
    .poll(
      async () => {
        try {
          const raw = await readFile(E2E_SAVE_FILE, "utf8");
          return gameStateSchema.parse(JSON.parse(raw)).mainQuestStage;
        } catch {
          return null;
        }
      },
      { timeout: 10_000 }
    )
    .toBe("ch2-beyond");
});
