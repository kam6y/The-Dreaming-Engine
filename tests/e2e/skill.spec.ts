import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  DIRECTIONS,
  SKILLS,
  createRng,
  fieldMap,
  isWalkable,
  neighbor,
  sampleEnemySymbols,
  samePosition,
  statsForLevel,
  townMap,
  type Direction,
  type EnemySymbolPlacement,
  type Position
} from "../../packages/shared/dist/index.js";

// スキルスモーク(M9-3)。startLevel=3(mock限定のテスト加速)で「澱み斬り」(Lv3習得・
// 攻×1.3+毒付与・MP5)を霧狼(HP20)へ使い、MP消費と敵への毒付与を検証する。
// Lv3攻撃12の×1.3ダメージは13-16で霧狼は確実に生存する=毒付与が決定論で観測できる。
//
// シンボル配置の再現(seed=42)と接触経路の導出は battle.spec.ts と同じ方式。
// 戦闘の状態は #game の data 属性(battle-scene.ts の syncDomState)を同期点にする:
// data-player-mp / data-enemy-status はラウンド確定後のコマンド入力フェーズ毎に更新される。

const GAME = "#game";
const SEED = 42;
const START_LEVEL = 3;

async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

async function readPlayerPosition(page: Page): Promise<Position> {
  const x = await readAttr(page, "data-player-x");
  const y = await readAttr(page, "data-player-y");
  return { x: Number(x), y: Number(y) };
}

const ARROW_KEY: Record<Direction, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight"
};

function directionBetween(from: Position, to: Position): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 0 && dy === 1) return "down";
  if (dx === 0 && dy === -1) return "up";
  throw new Error(`隣接していない: ${from.x},${from.y} -> ${to.x},${to.y}`);
}

function posKey(p: Position): string {
  return `${p.x},${p.y}`;
}

/** BFSで最寄りの敵シンボルへの経路(開始位置含む)を求める(battle.spec.ts と同じ) */
function pathToNearestSymbol(
  start: Position,
  symbols: readonly EnemySymbolPlacement[]
): Position[] | null {
  const isSymbol = (p: Position): boolean => symbols.some((s) => samePosition(s.position, p));
  const queue: Position[] = [start];
  const visited = new Set<string>([posKey(start)]);
  const prev = new Map<string, Position>();
  const rebuild = (goal: Position): Position[] => {
    const path: Position[] = [goal];
    let cur = goal;
    while (!samePosition(cur, start)) {
      const p = prev.get(posKey(cur));
      if (p === undefined) break;
      path.unshift(p);
      cur = p;
    }
    return path;
  };
  while (queue.length > 0) {
    const current = queue.shift() as Position;
    for (const dir of DIRECTIONS) {
      const next = neighbor(current, dir);
      const key = posKey(next);
      if (visited.has(key)) continue;
      if (isSymbol(next)) {
        prev.set(key, current);
        return rebuild(next);
      }
      if (!isWalkable(fieldMap, next)) continue;
      visited.add(key);
      prev.set(key, current);
      queue.push(next);
    }
  }
  return null;
}

/** メニュー操作用: 1キー押して反映待ち(同一フレーム2キー問題への対処。既存E2E参照) */
async function pressMenuKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(350);
}

test("スキルスモーク: 澱み斬りでMPを消費し、霧狼に毒を付与する", async ({ page }) => {
  test.setTimeout(90_000);

  // --- 敵シンボル配置をサーバーと同一手順で再現(battle.spec.ts と同じ) ---
  const rng = createRng(SEED);
  expect(sampleEnemySymbols(townMap, rng)).toHaveLength(0);
  const symbols = sampleEnemySymbols(fieldMap, rng);
  expect(symbols.length).toBeGreaterThan(0);

  // --- 新規ゲーム開始(Lv3加速)→ フィールドへ南下 ---
  await page.goto(`/?seed=${SEED}&skipIntro=1&startLevel=${START_LEVEL}`);
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();
  await page.keyboard.press("Enter");
  // 先行スペックがセーブを残していた場合は上書き確認ダイアログが出る。
  // 読み込み中の空押しを避けるため、待ってから未到達のときのみ Space(新しく始める)を押す
  for (let i = 0; i < 5; i += 1) {
    await page.waitForTimeout(1_500);
    if ((await readAttr(page, "data-map-id")) === "town") break;
    await page.keyboard.press("Space");
  }
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 10_000 }).toBe("town");
  expect(await readAttr(page, "data-level")).toBe(String(START_LEVEL));

  await page.keyboard.press("ArrowRight");
  await expect.poll(() => readAttr(page, "data-player-x"), { timeout: 10_000 }).toBe("11");
  await page.keyboard.down("ArrowDown");
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 15_000 }).toBe("field");
  await page.keyboard.up("ArrowDown");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");

  // --- 最寄りの霧狼へ接触して戦闘開始 ---
  const start = await readPlayerPosition(page);
  const route = pathToNearestSymbol(start, symbols);
  expect(route, "霧狼への接触経路が見つかること").not.toBeNull();
  const path = route as Position[];
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = path[i] as Position;
    const to = path[i + 1] as Position;
    await page.keyboard.press(ARROW_KEY[directionBetween(from, to)]);
    if (i === path.length - 2) {
      await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("battle");
    } else {
      await expect
        .poll(() => readPlayerPosition(page).then(posKey), { timeout: 10_000 })
        .toBe(posKey(to));
    }
  }
  expect(await readAttr(page, "data-battle-enemy")).toBe("mist-wolf");

  // --- 開幕時点のMPを確認(Lv3の最大MP)し、毒はまだ付いていない ---
  const maxMp = statsForLevel(START_LEVEL).maxMP;
  await expect.poll(() => readAttr(page, "data-player-mp"), { timeout: 10_000 }).toBe(String(maxMp));
  expect(await readAttr(page, "data-enemy-status")).toBe("");

  // --- コマンド「スキル」→「澱み斬り」を選択 ---
  // 開幕メッセージをスペース送りしてコマンド入力フェーズへ。command になったら押さない
  // (押しすぎると先頭「たたかう」を誤発火するため、確認→未達なら1回押す方式)
  for (let i = 0; i < 10; i += 1) {
    if ((await readAttr(page, "data-battle-mode")) === "command") break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
  }
  await expect.poll(() => readAttr(page, "data-battle-mode"), { timeout: 5_000 }).toBe("command");
  // 習得済みは [焔の一閃, 安らぎの灯, 澱み斬り](習得Lv昇順→同Lvは定義順)なので
  // コマンド: ↓1回で「スキル」、サブメニュー: ↓2回で「澱み斬り」
  await pressMenuKey(page, "ArrowDown"); // たたかう → スキル
  await pressMenuKey(page, "Space"); // スキルサブメニューを開く
  await pressMenuKey(page, "ArrowDown");
  await pressMenuKey(page, "ArrowDown"); // カーソル=澱み斬り
  await pressMenuKey(page, "Space"); // 実行

  // --- ラウンド進行をスペース送りし、MP消費と毒付与を確認 ---
  const expectedMp = maxMp - SKILLS["murk-cleave"].mpCost;
  for (let i = 0; i < 30; i += 1) {
    if ((await readAttr(page, "data-player-mp")) === String(expectedMp)) break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
  }
  await expect
    .poll(() => readAttr(page, "data-player-mp"), { timeout: 10_000 })
    .toBe(String(expectedMp));
  await expect
    .poll(() => readAttr(page, "data-enemy-status"), { timeout: 10_000 })
    .toContain("poison");
});
