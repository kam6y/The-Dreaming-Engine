import { mkdir, rm, writeFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  DIRECTIONS,
  addItem,
  createNewGameState,
  createRng,
  emptyInventory,
  field2Map,
  gameStateSchema,
  isWalkable,
  neighbor,
  samePosition,
  sampleEnemySymbols,
  statsForLevel,
  type Direction,
  type EnemySymbolPlacement,
  type Position
} from "../../packages/shared/dist/index.js";
import { E2E_SAVE_DIR, E2E_SAVE_FILE } from "./e2e-save-dir.js";

// 状態異常のUI反映スモーク(M21-4)。プレイヤー側の状態異常バッジ(data-player-status)の
// 付与→解除を、決定論的な経路で観測する:
// - 軋み人形(creaking-doll)の rotation は [strike, poison-bite, ...] 固定で、
//   poison-bite の付与確率は 1.0(付与ロールなし)=2ラウンド目の敵行動で必ず毒が付く。
// - 眩惑・竦みの付与は確率的(0.5/0.4)なのでE2Eでは扱わず、挙動はユニットテスト
//   (status-resistance.test / status-effects.test)で担保する。本スモークは
//   「状態異常が付与されるとUI(バッジ/データ属性)へ反映され、解除で消える」の配線を毒で観測する。
// - 解除は解毒薬(cure-status)。戦闘どうぐの消費(M21-3のサーバーガード)も同時に踏む。
//
// フィクスチャ: world-events.spec と同じ「フィクスチャセーブ+つづきから」方式。
// つづきから直後の enterCurrentMap は接続オプションの seed で初期化された rng の
// 最初のサンプリングなので、sampleEnemySymbols(field2Map, createRng(SEED)) で
// 敵シンボル配置をサーバーと同一手順で再現できる(continue への seed 伝搬は M21-4 で追加)。
//
// レベル6(HP82・防13)は軋み人形(攻12)に対し被ダメージ最小で、回復薬を使いながら
// 3ラウンド生存することが確実(毒tickは4/ラウンド)。敵は攻撃しないので倒してしまうこともない。

const GAME = "#game";
const SEED = 42;
const LEVEL = 6;

const ARROW_KEY: Record<Direction, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight"
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left"
};

async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

/** メニュー操作のキー(反映待ちを挟む。skill.spec と同じ流儀) */
async function pressMenuKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(350);
}

/**
 * つづきから直後の沈み野(field2)の敵シンボル配置をサーバーと同一手順で再現し、
 * 軋み人形の隣の歩行可能マス(他シンボル不在)と、そこから軋み人形へ踏み込む方向を返す。
 */
function deriveEncounter(): { start: Position; toDoll: Direction; symbols: EnemySymbolPlacement[] } {
  const rng = createRng(SEED);
  const symbols = sampleEnemySymbols(field2Map, rng);
  const doll = symbols.find((s) => s.enemyId === "creaking-doll");
  if (doll === undefined) {
    throw new Error(`seed=${SEED} の沈み野に軋み人形が湧くこと(配置ロジック変更時はseedを選び直す)`);
  }
  for (const dir of DIRECTIONS) {
    const start = neighbor(doll.position, dir);
    const occupied = symbols.some((s) => samePosition(s.position, start));
    if (!occupied && isWalkable(field2Map, start)) {
      return { start, toDoll: OPPOSITE[dir], symbols };
    }
  }
  throw new Error("軋み人形の隣に開始できる歩行可能マスがあること");
}

/**
 * フィクスチャセーブを書く: 新規状態を土台に、レベル6(HP/MPは statsForLevel)・
 * インベントリ[回復薬(小)×3, 解毒薬×1](どうぐサブメニューの並びを固定)・
 * 沈み野の軋み人形の隣を直接上書きする。zodスキーマで自己検証する。
 */
async function writeFixture(start: Position, facing: Direction): Promise<void> {
  const base = createNewGameState();
  const stats = statsForLevel(LEVEL);
  let inventory = emptyInventory();
  inventory = addItem(inventory, "potion-small", 3).inventory;
  inventory = addItem(inventory, "antidote", 1).inventory;
  const candidate = {
    ...base,
    player: { ...base.player, level: LEVEL, xp: 0, hp: stats.maxHP, mp: stats.maxMP },
    inventory,
    location: { mapId: field2Map.id, position: start, facing }
  };
  const validated = gameStateSchema.parse(candidate);
  await mkdir(E2E_SAVE_DIR, { recursive: true });
  await writeFile(E2E_SAVE_FILE, JSON.stringify(validated, null, 2), "utf8");
}

/** タイトルで「つづきから」を選んでロードする(world-events.spec と同じ流儀。seed を URL で渡す) */
async function continueFromTitle(page: Page): Promise<void> {
  await page.goto(`/?seed=${SEED}`);
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("サーバー: 接続済み")).toBeVisible({ timeout: 10_000 });
  await page.locator("canvas").click();
  await expect.poll(() => readAttr(page, "data-has-save"), { timeout: 10_000 }).toBe("1");
  await page.waitForTimeout(250);
  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
}

/** メッセージをスペース送りしてコマンド入力フェーズまで進める(skill.spec と同じ「確認→1回押す」方式) */
async function waitCommandPhase(page: Page): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    if ((await readAttr(page, "data-battle-mode")) === "command") break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
  }
  await expect.poll(() => readAttr(page, "data-battle-mode"), { timeout: 5_000 }).toBe("command");
}

/**
 * コマンド「どうぐ」からサブメニューの subDowns 番目(0始まり)のアイテムを使う。
 * コマンドメニューのカーソルはラウンド間で持続する(MenuList はリセットしない)ため、
 * 初回のみ ↓×2(たたかう→スキル→どうぐ)で移動し、以降はカーソルが「どうぐ」に
 * 残っている前提で commandDowns=0 を渡す(サブメニューは毎回生成されカーソル0始まり)。
 */
async function useItem(page: Page, commandDowns: number, subDowns: number): Promise<void> {
  for (let i = 0; i < commandDowns; i += 1) {
    await pressMenuKey(page, "ArrowDown");
  }
  await pressMenuKey(page, "Space"); // どうぐサブメニューを開く
  for (let i = 0; i < subDowns; i += 1) {
    await pressMenuKey(page, "ArrowDown");
  }
  await pressMenuKey(page, "Space"); // 使用(ターン解決へ)
}

// テスト専用セーブは必ず消す(後続スペックの新規開始を上書き確認で塞がない)
test.afterEach(async () => {
  await rm(E2E_SAVE_FILE, { force: true });
  await rm(`${E2E_SAVE_FILE}.bak`, { force: true });
});

test("状態異常のUI反映: 軋み人形の毒がプレイヤーへ付与され、解毒薬で解除される", async ({ page }) => {
  test.setTimeout(90_000);

  const { start, toDoll } = deriveEncounter();
  await writeFixture(start, toDoll);
  await continueFromTitle(page);
  expect(await readAttr(page, "data-map-id")).toBe(field2Map.id);

  // --- 軋み人形へ踏み込んで戦闘開始 ---
  await page.keyboard.press(ARROW_KEY[toDoll]);
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("battle");
  expect(await readAttr(page, "data-battle-enemy")).toBe("creaking-doll");

  // --- 開幕: 状態異常なし ---
  await waitCommandPhase(page);
  expect(await readAttr(page, "data-player-status")).toBe("");

  // --- ラウンド1: 回復薬(敵は strike)。まだ毒は付かない ---
  await useItem(page, 2, 0); // 初回のみ ↓×2 で「どうぐ」へ
  await waitCommandPhase(page);
  expect(await readAttr(page, "data-player-status")).toBe("");

  // --- ラウンド2: 回復薬(敵は poison-bite=付与確率1.0)。毒がUIへ反映される ---
  await useItem(page, 0, 0); // カーソルは「どうぐ」に残っている
  await waitCommandPhase(page);
  await expect.poll(() => readAttr(page, "data-player-status"), { timeout: 5_000 }).toContain("poison");

  // --- ラウンド3: 解毒薬で解除(消費はサーバー正本)。毒が消える(竦みの有無は確率的なので毒のみ見る) ---
  await useItem(page, 0, 1); // サブメニュー: [回復薬(小), 解毒薬] の2番目
  await waitCommandPhase(page);
  const after = (await readAttr(page, "data-player-status")) ?? "";
  expect(after.includes("poison")).toBe(false);
});
