import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  DIRECTIONS,
  createRng,
  fieldMap,
  isWalkable,
  neighbor,
  sampleEnemySymbols,
  samePosition,
  townMap,
  type Direction,
  type EnemySymbolPlacement,
  type Position
} from "../../packages/shared/dist/index.js";

// 戦闘スモーク: エンカウント → 勝利 → 探索復帰(ROADMAP M2 最終項目)。
//
// シンボル配置は ?seed=42 で固定される(?seed=N は new-game メッセージの
// options.seed としてサーバーへ渡り、サーバーが createRng(seed) を作って以後の
// サンプリングを再現可能にする)。街(town)は安全地帯で enemySymbols を持たず
// sampleEnemySymbols が RNG を消費しないため、フィールド(field)入場時の
// サンプリングが最初の乱数消費になる。そこでこの spec はサーバーと同じ
// createRng(42) → sampleEnemySymbols(fieldMap) を再現し、
// シンボル座標をハードコードせずに接触経路を導出する(seed=42 では (9,5) と (1,10))。
//
// 探索/戦闘の状態は #game 要素の data 属性へ同期される
// (exploration-scene.ts / battle-scene.ts の syncDomState)。

const GAME = "#game";
const SEED = 42;

/** #game 要素の data 属性を読む(未設定なら null) */
async function readAttr(page: Page, attr: string): Promise<string | null> {
  return page.locator(GAME).getAttribute(attr);
}

/** 現在のプレイヤー座標(data 属性)を読む */
async function readPlayerPosition(page: Page): Promise<Position> {
  const x = await readAttr(page, "data-player-x");
  const y = await readAttr(page, "data-player-y");
  return { x: Number(x), y: Number(y) };
}

/** 向き → Playwright のキー名 */
const ARROW_KEY: Record<Direction, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight"
};

/** 隣接する2マスの位置関係から進む向きを求める(BFS経路→キー入力の変換用) */
function directionBetween(from: Position, to: Position): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 0 && dy === 1) return "down";
  if (dx === 0 && dy === -1) return "up";
  throw new Error(`隣接しない2マス: (${from.x},${from.y})→(${to.x},${to.y})`);
}

const posKey = (p: Position): string => `${p.x},${p.y}`;

/**
 * start から最も近い敵シンボルまでの経路(座標列 start..symbolTile)を BFS で求める。
 * - 通行可否は shared の isWalkable(地形 solid・NPC/オブジェクト/ボス占有を除外)に委ねる
 * - シンボルのマスは「踏むと戦闘=ゴール」。通過はできない(=他シンボルは自然に迂回される)
 * 経路が見つからなければ null。
 */
function pathToNearestSymbol(
  start: Position,
  symbols: readonly EnemySymbolPlacement[]
): Position[] | null {
  const symbolKeys = new Set(symbols.map((s) => posKey(s.position)));
  const prev = new Map<string, Position>();
  const visited = new Set<string>([posKey(start)]);
  const queue: Position[] = [start];

  const rebuild = (goal: Position): Position[] => {
    const path: Position[] = [goal];
    let cursor: Position | undefined = prev.get(posKey(goal));
    while (cursor !== undefined) {
      path.push(cursor);
      cursor = prev.get(posKey(cursor));
    }
    return path.reverse();
  };

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const dir of DIRECTIONS) {
      const next = neighbor(current, dir);
      const key = posKey(next);
      if (visited.has(key)) continue;
      if (symbolKeys.has(key)) {
        // シンボルマスに到達 = ゴール。current までの経路に next を足して返す
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

test("seed=42でフィールドの霧狼に接触し、勝利して探索へ復帰する", async ({ page }) => {
  test.setTimeout(60_000);

  // --- 敵シンボル配置をクライアントと同一手順で再現(座標のハードコード回避) ---
  const rng = createRng(SEED);
  // 街入場のサンプリング(安全地帯=enemySymbols 無しのため RNG は消費されない)を忠実に再現
  expect(sampleEnemySymbols(townMap, rng)).toHaveLength(0);
  // フィールド入場のサンプリング = 最初の乱数消費。seed=42 では 霧狼2体
  const symbols = sampleEnemySymbols(fieldMap, rng);
  expect(symbols).toHaveLength(2);
  expect(symbols.every((s) => s.enemyId === "mist-wolf")).toBe(true);

  // --- 新規ゲーム開始 → 街「灯町」 ---
  await page.goto(`/?seed=${SEED}`);
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();

  // Phaser のキーボード対象は window。入力を届けるためキャンバスへフォーカスする
  await page.locator("canvas").click();

  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 10_000 }).toBe("town");

  // 街: 初期位置 (10,10) から背骨道 (x=11) へ1マス寄せる
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => readAttr(page, "data-player-x"), { timeout: 10_000 }).toBe("11");

  // 背骨道を南下してフィールドへ遷移。遷移でシーン再生成→resetKeys により
  // 押下状態が消えるため、入口マス (11,1) で停止する(movement.spec と同じ挙動)
  await page.keyboard.down("ArrowDown");
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 15_000 }).toBe("field");
  await page.keyboard.up("ArrowDown");

  // --- フィールド到達: 探索シーンで停止していることと初期シンボル数を確認 ---
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
  const countBefore = await readAttr(page, "data-symbol-count");
  expect(countBefore).toBe(String(symbols.length)); // "2"

  // 実際の停止位置から接触経路を導出(理論上 (11,1) だが DOM の実値を使う)
  const start = await readPlayerPosition(page);
  const path = pathToNearestSymbol(start, symbols);
  expect(path, "霧狼への接触経路が見つかること").not.toBeNull();
  const route = path as Position[];
  const goal = route[route.length - 1] as Position;
  expect(symbols.some((s) => samePosition(s.position, goal))).toBe(true);

  // 経路を1マスずつ進む。最後の1歩でシンボルへ踏み込み戦闘開始
  for (let i = 0; i < route.length - 1; i += 1) {
    const from = route[i] as Position;
    const to = route[i + 1] as Position;
    await page.keyboard.press(ARROW_KEY[directionBetween(from, to)]);

    if (i === route.length - 2) {
      // 最後の1歩: シンボルへ接触して戦闘へ遷移(位置は更新されない)
      await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("battle");
    } else {
      await expect
        .poll(() => readPlayerPosition(page).then(posKey), { timeout: 10_000 })
        .toBe(posKey(to));
    }
  }

  // --- 戦闘開始: 交戦相手が霧狼であること ---
  expect(await readAttr(page, "data-battle-enemy")).toBe("mist-wolf");

  // スペース連打で進める。コマンドメニューは先頭「たたかう」が選択済みのまま
  // (上下キーは押さないのでカーソルは動かず、サブメニューも開かない)。
  // Lv1 でも霧狼には数ターンで確実に勝てる(game-design 仕様)。
  // 勝利後はスペース送りで探索へ自動復帰する。
  for (let i = 0; i < 80; i += 1) {
    if ((await readAttr(page, "data-scene")) === "exploration") break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
  }

  // --- 探索復帰: マップ不変・シンボル1減を確認 ---
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
  expect(await readAttr(page, "data-map-id")).toBe("field");
  expect(await readAttr(page, "data-symbol-count")).toBe(String(symbols.length - 1)); // "1"
});

test("初見霧狼の撃破で戦果narrate(ai-utterance)が探索復帰前に届く(M4-G)", async ({ page }) => {
  test.setTimeout(60_000);

  // WS フレーム傍受: ai-utterance narrate が届いたかを記録する
  // (戦果ナレーションは canvas 表示のため、WS フレームで機械検証する: ai-integration.md)。
  let narrateReceived = false;
  page.on("websocket", (ws) => {
    ws.on("framereceived", (frame) => {
      const payload = frame.payload;
      if (typeof payload !== "string") return;
      let parsed: { type?: unknown; channel?: unknown };
      try {
        parsed = JSON.parse(payload) as { type?: unknown; channel?: unknown };
      } catch {
        return; // 非JSONフレームは無視
      }
      if (parsed.type === "ai-utterance" && parsed.channel === "narrate") {
        narrateReceived = true;
      }
    });
  });

  // 敵シンボル配置を seed=42 で再現(battle 到達手順は先頭テストと同一)
  const rng = createRng(SEED);
  expect(sampleEnemySymbols(townMap, rng)).toHaveLength(0);
  const symbols = sampleEnemySymbols(fieldMap, rng);
  expect(symbols).toHaveLength(2);

  await page.goto(`/?seed=${SEED}`);
  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click();

  await page.keyboard.press("Enter");
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 10_000 }).toBe("town");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => readAttr(page, "data-player-x"), { timeout: 10_000 }).toBe("11");
  await page.keyboard.down("ArrowDown");
  await expect.poll(() => readAttr(page, "data-map-id"), { timeout: 15_000 }).toBe("field");
  await page.keyboard.up("ArrowDown");
  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");

  const start = await readPlayerPosition(page);
  const path = pathToNearestSymbol(start, symbols);
  expect(path, "霧狼への接触経路が見つかること").not.toBeNull();
  const route = path as Position[];
  for (let i = 0; i < route.length - 1; i += 1) {
    const from = route[i] as Position;
    const to = route[i + 1] as Position;
    await page.keyboard.press(ARROW_KEY[directionBetween(from, to)]);
    if (i === route.length - 2) {
      await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("battle");
    } else {
      await expect
        .poll(() => readPlayerPosition(page).then(posKey), { timeout: 10_000 })
        .toBe(posKey(to));
    }
  }
  expect(await readAttr(page, "data-battle-enemy")).toBe("mist-wolf");

  // 勝利まで Space 送り。narrate が「戦闘中(探索復帰前)」に届くことを確認する:
  // ループ先頭で data-scene が battle のうちに narrate 受信していれば探索復帰前の到達となる。
  let narrateWhileInBattle = false;
  for (let i = 0; i < 80; i += 1) {
    const scene = await readAttr(page, "data-scene");
    if (scene === "exploration") break;
    if (scene === "battle" && narrateReceived) narrateWhileInBattle = true;
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
  }

  await expect.poll(() => readAttr(page, "data-scene"), { timeout: 10_000 }).toBe("exploration");
  // narrate は戦闘勝利のバースト内(探索復帰前=シーンが battle のうち)に届いている
  expect(narrateReceived).toBe(true);
  expect(narrateWhileInBattle).toBe(true);
});
