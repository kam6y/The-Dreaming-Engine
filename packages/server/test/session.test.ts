import {
  GAME_TITLE,
  INITIAL_GOLD,
  INN_COST,
  INVENTORY_CAPACITY,
  NPC_DISPLAY_NAMES,
  TOWN_WAKE_POINT,
  addItem,
  countOf,
  createEmptyEquipment,
  createNewGameState,
  emptyInventory,
  gameStateSchema,
  MAPS,
  samePosition,
  sellPriceOf,
  statsForLevel
} from "@dreaming-engine/shared";
import type {
  Direction,
  GameState,
  Position,
  ServerMessage,
  SnapshotView
} from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import type { LoadResult, SaveStore } from "../src/game/save.js";
import { GameSession } from "../src/game/session.js";

/**
 * GameSession(サーバー権威リデューサー)のテスト。
 * FS・時刻・乱数シードをすべて注入し、決定論的に検証する。
 * - セーブはインメモリの FakeSaveStore(人間のプレイセーブに触れない)
 * - 時計は手動で進める(プレイ時間の検証)
 * - 敵シンボル・戦闘は固定シード(必要なテストのみ noSymbols: false)
 */

type DialogMessage = Extract<ServerMessage, { type: "dialog" }>;
type BattleEventsMessage = Extract<ServerMessage, { type: "battle-events" }>;

/** インメモリのセーブストア(save は構造化クローンで記録する) */
class FakeSaveStore implements SaveStore {
  public saved: GameState[] = [];

  public loadResult: LoadResult = { ok: false, reason: "missing" };

  public async exists(): Promise<boolean> {
    return this.loadResult.ok;
  }

  public async load(): Promise<LoadResult> {
    return this.loadResult;
  }

  public async save(state: GameState): Promise<void> {
    this.saved.push(structuredClone(state));
  }
}

interface SessionContext {
  session: GameSession;
  store: FakeSaveStore;
  /** 注入した時計を進める(ミリ秒) */
  advance: (ms: number) => void;
}

function createSession(options?: {
  seed?: number;
  noSymbols?: boolean;
  aiMode?: "mock" | "live";
}): SessionContext {
  const store = new FakeSaveStore();
  let now = 0;
  const session = new GameSession({
    saveStore: store,
    clock: () => now,
    seed: options?.seed ?? 1,
    noSymbols: options?.noSymbols ?? true,
    ...(options?.aiMode !== undefined ? { aiMode: options.aiMode } : {})
  });
  return {
    session,
    store,
    advance: (ms: number) => {
      now += ms;
    }
  };
}

/** メッセージ列から最初の snapshot ビューを取り出す(無ければ失敗) */
function firstSnapshot(msgs: ServerMessage[]): SnapshotView {
  for (const msg of msgs) {
    if (msg.type === "snapshot") return msg.view;
  }
  throw new Error(`snapshot が含まれていない: ${JSON.stringify(msgs.map((m) => m.type))}`);
}

function dialogsOf(msgs: ServerMessage[]): DialogMessage[] {
  return msgs.filter((m): m is DialogMessage => m.type === "dialog");
}

function battleEventsOf(msgs: ServerMessage[]): BattleEventsMessage {
  const found = msgs.find((m): m is BattleEventsMessage => m.type === "battle-events");
  if (found === undefined) throw new Error("battle-events が含まれていない");
  return found;
}

/** 応答が単一の error であることと code を検証する */
function expectError(msgs: ServerMessage[], code: string): void {
  expect(msgs).toHaveLength(1);
  const msg = msgs[0];
  if (msg === undefined || msg.type !== "error") {
    throw new Error(`error を期待したが: ${JSON.stringify(msg)}`);
  }
  expect(msg.code).toBe(code);
}

function mustState(session: GameSession): GameState {
  const state = session.getState();
  if (state === null) throw new Error("GameState が null(ゲーム未開始)");
  return state;
}

function mustView(session: GameSession): SnapshotView {
  const view = session.getView();
  if (view === null) throw new Error("SnapshotView が null(ゲーム未開始)");
  return view;
}

/** フィールド上に居る状態(つづきから注入用)。位置既定 (11,8)=道 */
function fieldState(overrides?: { position?: Position; hp?: number; gold?: number }): GameState {
  const state = createNewGameState();
  state.location = {
    mapId: "field",
    position: overrides?.position ? { ...overrides.position } : { x: 11, y: 8 },
    facing: "down"
  };
  if (overrides?.hp !== undefined) state.player.hp = overrides.hp;
  if (overrides?.gold !== undefined) state.player.gold = overrides.gold;
  return state;
}

/**
 * 現マップの先頭シンボルの隣へテレポートし、踏み込んで戦闘を開始する。
 * (戦闘開始チェックは tryMove より先なので、立ち位置の地形は問わない)
 */
async function engageBattle(session: GameSession): Promise<SnapshotView> {
  const view = mustView(session);
  const symbol = view.symbols[0];
  if (symbol === undefined) throw new Error("敵シンボルが居ない");
  const candidates: { stand: Position; dir: Direction }[] = [
    { stand: { x: symbol.position.x, y: symbol.position.y + 1 }, dir: "up" },
    { stand: { x: symbol.position.x, y: symbol.position.y - 1 }, dir: "down" },
    { stand: { x: symbol.position.x - 1, y: symbol.position.y }, dir: "right" },
    { stand: { x: symbol.position.x + 1, y: symbol.position.y }, dir: "left" }
  ];
  const others = view.symbols.slice(1).map((s) => s.position);
  const spot = candidates.find((c) => !others.some((p) => samePosition(p, c.stand)));
  if (spot === undefined) throw new Error("シンボルの周囲に立ち位置がない");
  mustState(session).location.position = { ...spot.stand };
  const msgs = await session.handle({ type: "move", direction: spot.dir });
  return firstSnapshot(msgs);
}

/** フィールドで戦闘中のセッションを用意する */
async function sessionInBattle(seed = 1): Promise<SessionContext> {
  const ctx = createSession({ seed, noSymbols: false });
  ctx.store.loadResult = { ok: true, state: fieldState() };
  await ctx.session.handle({ type: "continue" });
  const snap = await engageBattle(ctx.session);
  expect(snap.mode).toBe("battle");
  return ctx;
}

// ===========================================================================
// 接続(hello・再同期)
// ===========================================================================

describe("接続", () => {
  it("セーブが無ければ hasSave=false の hello のみを返す", async () => {
    const { session } = createSession();
    const msgs = await session.connect();
    expect(msgs).toEqual([{ type: "hello", title: GAME_TITLE, hasSave: false }]);
  });

  it("セーブがあれば hasSave=true", async () => {
    const { session, store } = createSession();
    store.loadResult = { ok: true, state: createNewGameState() };
    const msgs = await session.connect();
    expect(msgs).toEqual([{ type: "hello", title: GAME_TITLE, hasSave: true }]);
  });

  it("ゲーム進行中の再接続では snapshot も送って再同期する", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    const msgs = await session.connect();
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.type).toBe("hello");
    expect(firstSnapshot(msgs).location.mapId).toBe("town");
  });
});

// ===========================================================================
// ガード(未開始・モード違い)
// ===========================================================================

describe("ガード", () => {
  it("ゲーム開始前の操作は no-active-game", async () => {
    const { session } = createSession();
    expectError(await session.handle({ type: "move", direction: "up" }), "no-active-game");
    expectError(await session.handle({ type: "use-item", itemId: "potion-small" }), "no-active-game");
    expectError(
      await session.handle({ type: "battle-command", command: { kind: "attack" } }),
      "no-active-game"
    );
    expectError(await session.handle({ type: "rest" }), "no-active-game");
  });

  it("探索中の battle-command は invalid-mode", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    const msgs = await session.handle({ type: "battle-command", command: { kind: "attack" } });
    expectError(msgs, "invalid-mode");
    expect(msgs[0]?.type === "error" && msgs[0].message).toBe("今は戦っていない。");
  });

  it("戦闘中の探索系操作は invalid-mode", async () => {
    const { session } = await sessionInBattle();
    expectError(await session.handle({ type: "move", direction: "up" }), "invalid-mode");
    expectError(await session.handle({ type: "interact" }), "invalid-mode");
    expectError(await session.handle({ type: "use-item", itemId: "potion-small" }), "invalid-mode");
    expectError(
      await session.handle({ type: "shop-buy", itemId: "potion-small", quantity: 1 }),
      "invalid-mode"
    );
    expectError(await session.handle({ type: "rest" }), "invalid-mode");
    // 戦闘は継続している
    expect(mustView(session).mode).toBe("battle");
  });
});

// ===========================================================================
// 新規ゲーム / つづきから
// ===========================================================================

describe("新規ゲーム", () => {
  it("仕様どおりの初期スナップショットを返す", async () => {
    const { session } = createSession();
    const view = firstSnapshot(await session.handle({ type: "new-game" }));
    expect(view.mode).toBe("exploration");
    expect(view.location).toEqual({ mapId: "town", position: { x: 10, y: 10 }, facing: "up" });
    expect(view.day).toBe(1);
    expect(view.playtimeSeconds).toBe(0);
    expect(view.player).toMatchObject({ level: 1, xp: 0, hp: 30, maxHp: 30, mp: 10, maxMp: 10, gold: INITIAL_GOLD });
    expect(view.inventory).toEqual([
      { itemId: "potion-small", name: "回復薬(小)", count: 2, questItem: false }
    ]);
    expect(view.questItems).toEqual([]);
    expect(view.inventoryCapacity).toBe(INVENTORY_CAPACITY);
    expect(view.inventoryUsed).toBe(2);
    expect(view.symbols).toEqual([]); // 街は安全(+noSymbols)
    expect(view.resolvedObjectIds).toEqual([]);
    expect(view.interaction).toBeUndefined();
    expect(view.battle).toBeUndefined();
  });

  it("既存セーブには触れない(セーブ書き込みが発生しない)", async () => {
    const { session, store } = createSession();
    store.loadResult = { ok: true, state: fieldState({ gold: 999 }) };
    await session.handle({ type: "new-game" });
    expect(store.saved).toHaveLength(0);
    // ストア上のセーブはそのまま残る
    expect(store.loadResult.ok).toBe(true);
  });
});

describe("つづきから", () => {
  it("セーブが無ければ no-save エラー", async () => {
    const { session } = createSession();
    const msgs = await session.handle({ type: "continue" });
    expectError(msgs, "no-save");
    expect(session.getState()).toBeNull();
  });

  it("セーブが破損していれば save-corrupted エラー(クラッシュしない)", async () => {
    const { session, store } = createSession();
    store.loadResult = { ok: false, reason: "corrupt" };
    const msgs = await session.handle({ type: "continue" });
    expectError(msgs, "save-corrupted");
    expect(session.getState()).toBeNull();
  });

  it("正常なセーブから状態を復元してスナップショットを返す", async () => {
    const { session, store } = createSession();
    const saved = fieldState({ gold: 77 });
    saved.day = 5;
    store.loadResult = { ok: true, state: saved };
    const view = firstSnapshot(await session.handle({ type: "continue" }));
    expect(view.day).toBe(5);
    expect(view.player.gold).toBe(77);
    expect(view.location.mapId).toBe("field");
  });
});

// ===========================================================================
// メインクエスト段階のスナップショット掲載・startLevel 加速フラグ(M6)
// ===========================================================================

describe("メインクエスト段階(スナップショット)", () => {
  it("新規ゲームの snapshot は arrival を載せる", async () => {
    const { session } = createSession();
    const view = firstSnapshot(await session.handle({ type: "new-game" }));
    expect(view.mainQuestStage).toBe("arrival");
  });

  it("セーブの段階をロード後の snapshot に反映する", async () => {
    const { session, store } = createSession();
    const saved = fieldState();
    saved.mainQuestStage = "rift-revealed";
    store.loadResult = { ok: true, state: saved };
    const view = firstSnapshot(await session.handle({ type: "continue" }));
    expect(view.mainQuestStage).toBe("rift-revealed");
  });
});

describe("startLevel 加速フラグ", () => {
  it("mock ではプレイヤーを指定レベルで開始する(HP/MP=statsForLevel・XP=0)", async () => {
    const { session } = createSession(); // 既定 aiMode=mock
    const view = firstSnapshot(await session.handle({ type: "new-game", options: { startLevel: 6 } }));
    const lv6 = statsForLevel(6);
    expect(view.player.level).toBe(6);
    expect(view.player.xp).toBe(0);
    expect(view.player.hp).toBe(lv6.maxHP);
    expect(view.player.maxHp).toBe(lv6.maxHP);
    expect(view.player.mp).toBe(lv6.maxMP);
    expect(view.player.maxMp).toBe(lv6.maxMP);
    // ゴールドは初期値のまま(加速はレベルのみ)
    expect(view.player.gold).toBe(INITIAL_GOLD);
    expect(mustState(session).player.level).toBe(6);
  });

  it("live では startLevel を無視して Lv1 開始を守る", async () => {
    const { session } = createSession({ aiMode: "live" });
    const view = firstSnapshot(await session.handle({ type: "new-game", options: { startLevel: 6 } }));
    expect(view.player.level).toBe(1);
    expect(view.player.hp).toBe(statsForLevel(1).maxHP);
  });
});

describe("startGold 加速フラグ(M8-4: 装備購入スモーク用)", () => {
  it("mock では開始ゴールドを指定値にする(レベル等は通常どおり)", async () => {
    const { session } = createSession(); // 既定 aiMode=mock
    const view = firstSnapshot(await session.handle({ type: "new-game", options: { startGold: 999 } }));
    expect(view.player.gold).toBe(999);
    expect(view.player.level).toBe(1);
  });

  it("live では startGold を無視して初期ゴールドを守る", async () => {
    const { session } = createSession({ aiMode: "live" });
    const view = firstSnapshot(await session.handle({ type: "new-game", options: { startGold: 999 } }));
    expect(view.player.gold).toBe(INITIAL_GOLD);
  });
});

// ===========================================================================
// 移動(検証・遷移)
// ===========================================================================

describe("移動", () => {
  it("空きマスへ移動し、向きが更新される", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    const view = firstSnapshot(await session.handle({ type: "move", direction: "right" }));
    expect(view.location.position).toEqual({ x: 11, y: 10 });
    expect(view.location.facing).toBe("right");
  });

  it("壁には移動できない(向きだけ変わる)", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    mustState(session).location.position = { x: 3, y: 4 }; // 上は宿屋の壁 (3,3)
    const view = firstSnapshot(await session.handle({ type: "move", direction: "up" }));
    expect(view.location.position).toEqual({ x: 3, y: 4 });
    expect(view.location.facing).toBe("up");
  });

  it("NPC の居るマスには移動できない", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    mustState(session).location.position = { x: 4, y: 5 }; // 上は宿屋の主人 (4,4)
    const view = firstSnapshot(await session.handle({ type: "move", direction: "up" }));
    expect(view.location.position).toEqual({ x: 4, y: 5 });
  });

  it("遷移マスに乗ると別マップへ移動する(街→フィールド)", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    await session.handle({ type: "move", direction: "right" }); // (11,10) 街道へ
    await session.handle({ type: "move", direction: "down" }); // (11,11)
    await session.handle({ type: "move", direction: "down" }); // (11,12)
    await session.handle({ type: "move", direction: "down" }); // (11,13)
    const view = firstSnapshot(await session.handle({ type: "move", direction: "down" })); // (11,14)=門
    expect(view.location).toEqual({ mapId: "field", position: { x: 11, y: 1 }, facing: "down" });
  });

  it("移動すると有効な対話(店・宿)が解除される", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    mustState(session).location.position = { x: 4, y: 5 };
    mustState(session).location.facing = "up";
    const opened = firstSnapshot(await session.handle({ type: "interact" }));
    expect(opened.interaction?.kind).toBe("inn");
    const view = firstSnapshot(await session.handle({ type: "move", direction: "down" }));
    expect(view.interaction).toBeUndefined();
  });
});

// ===========================================================================
// 敵シンボル(サンプリング)と戦闘開始
// ===========================================================================

describe("敵シンボルと戦闘開始", () => {
  it("フィールド入場でシンボルが湧く(数・種別・プレイヤー位置と非重複)", async () => {
    const { session, store } = createSession({ seed: 7, noSymbols: false });
    store.loadResult = { ok: true, state: fieldState() };
    const view = firstSnapshot(await session.handle({ type: "continue" }));
    expect(view.symbols.length).toBeGreaterThanOrEqual(2);
    expect(view.symbols.length).toBeLessThanOrEqual(3);
    // フィールドのプールは 霧狼+迷い火(M10)。敵種はプール内であることを検証する
    const fieldSpecies = MAPS.field.enemySymbols?.species ?? [];
    for (const symbol of view.symbols) {
      expect(fieldSpecies).toContain(symbol.enemyId);
      expect(samePosition(symbol.position, view.location.position)).toBe(false);
    }
  });

  it("同一シードなら同一配置(シード可能な乱数)", async () => {
    const a = createSession({ seed: 7, noSymbols: false });
    const b = createSession({ seed: 7, noSymbols: false });
    a.store.loadResult = { ok: true, state: fieldState() };
    b.store.loadResult = { ok: true, state: fieldState() };
    const viewA = firstSnapshot(await a.session.handle({ type: "continue" }));
    const viewB = firstSnapshot(await b.session.handle({ type: "continue" }));
    expect(viewA.symbols).toEqual(viewB.symbols);
  });

  it("noSymbols ならシンボルは湧かない", async () => {
    const { session, store } = createSession({ seed: 7, noSymbols: true });
    store.loadResult = { ok: true, state: fieldState() };
    const view = firstSnapshot(await session.handle({ type: "continue" }));
    expect(view.symbols).toEqual([]);
  });

  it("シンボルへの踏み込みで戦闘が始まる(移動はしない・シンボルは残る)", async () => {
    const { session, store } = createSession({ seed: 1, noSymbols: false });
    store.loadResult = { ok: true, state: fieldState() };
    await session.handle({ type: "continue" });
    const before = mustView(session).symbols.length;
    const posBefore = { ...mustState(session).location.position };
    const snap = await engageBattle(session);
    expect(snap.mode).toBe("battle");
    expect(snap.battle?.enemyId).toBe("mist-wolf");
    expect(snap.battle?.enemyName).toBe("霧狼");
    expect(snap.battle?.isBoss).toBe(false);
    expect(snap.battle?.outcome).toBe("ongoing");
    expect(snap.symbols).toHaveLength(before); // 勝利までは残る
    // engageBattle はテレポート後に踏み込むので、位置は踏み込み前のまま
    expect(mustState(session).location.position).not.toEqual(posBefore);
  });
});

// ===========================================================================
// 戦闘解決(勝利・全滅・逃走・ドロップ満杯)
// ===========================================================================

describe("戦闘解決", () => {
  it("勝利で報酬(XP・ゴールド)を得てシンボルが消え、探索へ戻る", async () => {
    const { session } = await sessionInBattle(1);
    const state = mustState(session);
    const symbolsBefore = mustView(session).symbols.length;
    let lastMsgs: ServerMessage[] = [];
    let rounds = 0;
    while (mustView(session).mode === "battle") {
      lastMsgs = await session.handle({ type: "battle-command", command: { kind: "attack" } });
      rounds += 1;
      if (rounds > 10) throw new Error("戦闘が終わらない(想定外)");
    }
    const events = battleEventsOf(lastMsgs);
    expect(events.events.some((e) => e.type === "victory")).toBe(true);
    // 霧狼: XP4・ゴールド3〜6(Lv1 の必要 XP は 8 なのでレベルは上がらない)
    expect(state.player.level).toBe(1);
    expect(state.player.xp).toBe(4);
    expect(state.player.gold).toBeGreaterThanOrEqual(INITIAL_GOLD + 3);
    expect(state.player.gold).toBeLessThanOrEqual(INITIAL_GOLD + 6);
    const view = mustView(session);
    expect(view.mode).toBe("exploration");
    expect(view.battle).toBeUndefined();
    expect(view.symbols).toHaveLength(symbolsBefore - 1); // 撃破したシンボルは除去
    expect(view.location.mapId).toBe("field");
    expect(mustState(session).day).toBe(1); // 勝利では日は進まない
  });

  it("全滅でゴールド半減・日送り・宿で全回復して目覚める", async () => {
    const { session, store } = createSession({ seed: 1, noSymbols: false });
    store.loadResult = { ok: true, state: fieldState({ hp: 1, gold: 31 }) };
    await session.handle({ type: "continue" });
    await engageBattle(session);
    let lastMsgs: ServerMessage[] = [];
    let rounds = 0;
    while (mustView(session).mode === "battle") {
      lastMsgs = await session.handle({ type: "battle-command", command: { kind: "attack" } });
      rounds += 1;
      if (rounds > 10) throw new Error("戦闘が終わらない(想定外)");
    }
    const events = battleEventsOf(lastMsgs);
    expect(events.events.some((e) => e.type === "defeat")).toBe(true);
    const state = mustState(session);
    // floor(31/2)=15 が残り、16 を失う
    expect(state.player.gold).toBe(15);
    expect(dialogsOf(lastMsgs).some((d) => d.body.includes("16のゴールド"))).toBe(true);
    expect(state.day).toBe(2); // 全滅で日送り
    expect(state.location).toEqual({
      mapId: TOWN_WAKE_POINT.mapId,
      position: { ...TOWN_WAKE_POINT.position },
      facing: TOWN_WAKE_POINT.facing
    });
    expect(state.player.hp).toBe(30); // 全回復
    expect(state.player.mp).toBe(10);
    expect(mustView(session).mode).toBe("exploration");
    expect(store.saved).toHaveLength(0); // 全滅時はセーブしない
  });

  it("逃走成功で探索へ戻り、シンボルは残る", async () => {
    const { session, store } = createSession({ seed: 1, noSymbols: false });
    store.loadResult = { ok: true, state: fieldState() };
    await session.handle({ type: "continue" });
    const symbolsBefore = mustView(session).symbols.length;
    await engageBattle(session);
    let attempts = 0;
    while (mustView(session).mode === "battle") {
      await session.handle({ type: "battle-command", command: { kind: "flee" } });
      attempts += 1;
      if (attempts > 30) throw new Error("逃走が成立しない(想定外)");
    }
    const view = mustView(session);
    // 全滅なら街へ飛ばされる。フィールドに居て日も進んでいなければ逃走成功
    expect(view.location.mapId).toBe("field");
    expect(mustState(session).day).toBe(1);
    expect(view.symbols).toHaveLength(symbolsBefore); // 逃げた敵は消えない
  });

  it("勝利ドロップで満杯なら溢れた分は破棄し、告知ダイアログを出す", async () => {
    // ドロップ(20%)はシード依存なので、複数シードを走査して発生ケースを検証する
    const lv10 = statsForLevel(10);
    let found = false;
    for (let seed = 1; seed <= 40 && !found; seed += 1) {
      const { session, store } = createSession({ seed, noSymbols: false });
      const state = fieldState();
      state.player = { level: 10, xp: 0, hp: lv10.maxHP, mp: lv10.maxMP, gold: 50 };
      state.inventory = addItem(emptyInventory(), "herb", INVENTORY_CAPACITY).inventory; // 満杯
      store.loadResult = { ok: true, state };
      await session.handle({ type: "continue" });
      while (mustView(session).symbols.length > 0 && !found) {
        await engageBattle(session);
        const msgs = await session.handle({ type: "battle-command", command: { kind: "attack" } });
        expect(mustView(session).mode).toBe("exploration"); // Lv10 は一撃で勝つ
        if (dialogsOf(msgs).some((d) => d.body.includes("戦利品は手に余り"))) {
          const s = mustState(session);
          expect(countOf(s.inventory, "potion-small")).toBe(0); // 溢れた分は破棄
          expect(mustView(session).inventoryUsed).toBe(INVENTORY_CAPACITY);
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });
});

// ===========================================================================
// 調べる・話す
// ===========================================================================

describe("調べる・話す", () => {
  async function townSession(position: Position, facing: Direction): Promise<SessionContext> {
    const ctx = createSession();
    await ctx.session.handle({ type: "new-game" });
    mustState(ctx.session).location.position = { ...position };
    mustState(ctx.session).location.facing = facing;
    return ctx;
  }

  it("目の前に何も無ければ地の文だけを返す", async () => {
    const { session } = await townSession({ x: 10, y: 10 }, "up");
    const msgs = await session.handle({ type: "interact" });
    expect(msgs).toEqual([
      { type: "dialog", speaker: null, body: "……この手が触れるものは、何もない。" }
    ]);
  });

  it("看板は本文を表示する", async () => {
    const { session } = await townSession({ x: 2, y: 5 }, "up"); // 宿の看板 (2,4)
    const dialogs = dialogsOf(await session.handle({ type: "interact" }));
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]?.body).toBe("宿屋『灯宿』。暖炉の火と、階段のきしみが迎えてくれる。");
  });

  it("商人に話すと店が開く(在庫つきの interaction)", async () => {
    const { session } = await townSession({ x: 16, y: 5 }, "up"); // 商人 (16,4)
    const msgs = await session.handle({ type: "interact" });
    const view = firstSnapshot(msgs);
    if (view.interaction?.kind !== "shop") throw new Error("shop interaction が無い");
    expect(view.interaction.npcName).toBe(NPC_DISPLAY_NAMES.merchant);
    const potion = view.interaction.stock.find((s) => s.itemId === "potion-small");
    expect(potion?.buyPrice).toBe(20);
    expect(view.interaction.stock.map((s) => s.itemId)).toEqual(
      expect.arrayContaining(["potion-small", "potion-mid", "antidote"])
    );
    expect(dialogsOf(msgs)[0]?.speaker).toBe(NPC_DISPLAY_NAMES.merchant);
  });

  it("宿屋の主人に話すと宿の interaction(宿泊費つき)が開く", async () => {
    const { session } = await townSession({ x: 4, y: 5 }, "up"); // 主人 (4,4)
    const msgs = await session.handle({ type: "interact" });
    const view = firstSnapshot(msgs);
    if (view.interaction?.kind !== "inn") throw new Error("inn interaction が無い");
    expect(view.interaction.npcName).toBe(NPC_DISPLAY_NAMES.innkeeper);
    expect(view.interaction.costGold).toBe(INN_COST);
    expect(dialogsOf(msgs)[0]?.speaker).toBe(NPC_DISPLAY_NAMES.innkeeper);
  });

  it("情報屋は gatekeeper 未注入なら定型ダイアログのみ(interaction を開かない)", async () => {
    const informant = await townSession({ x: 4, y: 9 }, "down"); // 情報屋 (4,10)
    const msgs1 = await informant.session.handle({ type: "interact" });
    expect(msgs1).toHaveLength(1);
    expect(dialogsOf(msgs1)[0]?.speaker).toBe(NPC_DISPLAY_NAMES.informant);
    expect(mustView(informant.session).interaction).toBeUndefined();
  });
});

// ===========================================================================
// メインクエスト進行(司祭スクリプト・ボス戦トリガー・撃破遷移・エンディング確認)
// ===========================================================================

describe("メインクエスト進行(司祭・ボス・エンディング)", () => {
  /** 街の司祭フィオルの正面 (16,9) 向き down に立つ(gatekeeper 未注入セッション) */
  async function priestSession(): Promise<SessionContext> {
    const ctx = createSession();
    await ctx.session.handle({ type: "new-game" });
    mustState(ctx.session).location = { mapId: "town", position: { x: 16, y: 9 }, facing: "down" };
    return ctx;
  }

  /** dungeon-3 のボス正面 (11,12) 向き down に立つセッション(段階・レベルを注入 or 完成状態を注入) */
  async function bossSession(opts?: {
    stage?: GameState["mainQuestStage"];
    level?: number;
    state?: GameState;
  }): Promise<SessionContext> {
    const ctx = createSession(); // noSymbols 既定 true → ボス以外の敵は湧かない
    let state: GameState;
    if (opts?.state !== undefined) {
      state = opts.state;
    } else {
      state = createNewGameState();
      state.location = { mapId: "dungeon-3", position: { x: 11, y: 12 }, facing: "down" };
      state.mainQuestStage = opts?.stage ?? "rift-revealed";
      const level = opts?.level ?? 10;
      const stats = statsForLevel(level);
      state.player = { level, xp: 0, hp: stats.maxHP, mp: stats.maxMP, gold: 50 };
    }
    ctx.store.loadResult = { ok: true, state };
    await ctx.session.handle({ type: "continue" });
    return ctx;
  }

  /** ボス戦を攻撃で決着まで進め、勝利を確認して最後のメッセージ列を返す(Lv10 前提) */
  async function fightBossToVictory(session: GameSession): Promise<ServerMessage[]> {
    let last: ServerMessage[] = [];
    let rounds = 0;
    while (mustView(session).mode === "battle") {
      last = await session.handle({ type: "battle-command", command: { kind: "attack" } });
      rounds += 1;
      if (rounds > 40) throw new Error("ボス戦が終わらない(想定外)");
    }
    const events = battleEventsOf(last);
    if (!events.events.some((e) => e.type === "victory")) {
      throw new Error("ボス戦に勝てなかった(Lv10 前提が崩れている)");
    }
    return last;
  }

  it("司祭(arrival)は明かしのスクリプトで rift-revealed へ進む(AI 非依存)", async () => {
    const { session } = await priestSession();
    expect(mustState(session).mainQuestStage).toBe("arrival");
    const msgs = await session.handle({ type: "interact" });
    // スナップショット(新段階)+ 司祭の明かし dialog 列
    expect(firstSnapshot(msgs).mainQuestStage).toBe("rift-revealed");
    const dialogs = dialogsOf(msgs);
    expect(dialogs.length).toBeGreaterThanOrEqual(2);
    expect(dialogs.every((d) => d.speaker === NPC_DISPLAY_NAMES.priest)).toBe(true);
    expect(dialogs.some((d) => d.body.includes("夢喰い"))).toBe(true);
    expect(mustState(session).mainQuestStage).toBe("rift-revealed");
    // スクリプト進行のため AI 会話 overlay は開かない
    expect(mustView(session).interaction).toBeUndefined();
  });

  it("司祭(rift-revealed 以降・gatekeeper 未注入)は激励のみで段階を進めない(冪等)", async () => {
    const { session } = await priestSession();
    await session.handle({ type: "interact" }); // arrival → rift-revealed
    const msgs = await session.handle({ type: "interact" }); // 2回目
    expect(msgs).toHaveLength(1);
    expect(dialogsOf(msgs)[0]?.speaker).toBe(NPC_DISPLAY_NAMES.priest);
    expect(mustState(session).mainQuestStage).toBe("rift-revealed"); // 進まない
  });

  it("ボスゲート: arrival では接触/踏み込みでも戦闘にならずスクリプトで戻す", async () => {
    const { session } = await bossSession({ stage: "arrival" });
    const msgs = await session.handle({ type: "interact" });
    const gate = dialogsOf(msgs);
    expect(gate).toHaveLength(1);
    expect(gate[0]?.body).toContain("司祭");
    expect(firstSnapshot(msgs).mode).toBe("exploration"); // snapshot は必ず返る(移動ロック解除)
    expect(mustView(session).mode).toBe("exploration");
    // move で踏み込んでも同様(ボスマスは占有=通常移動しない・位置は据え置き)
    const moved = await session.handle({ type: "move", direction: "down" });
    expect(dialogsOf(moved)).toHaveLength(1);
    expect(firstSnapshot(moved).mode).toBe("exploration");
    expect(mustView(session).mode).toBe("exploration");
    expect(mustState(session).location.position).toEqual({ x: 11, y: 12 });
  });

  it("rift-revealed では接触/踏み込みでボス戦(isBoss)が始まる", async () => {
    const viaInteract = await bossSession({ stage: "rift-revealed" });
    const snap1 = firstSnapshot(await viaInteract.session.handle({ type: "interact" }));
    expect(snap1.mode).toBe("battle");
    expect(snap1.battle?.enemyId).toBe("dream-eater");
    expect(snap1.battle?.isBoss).toBe(true);

    const viaMove = await bossSession({ stage: "rift-revealed" });
    const snap2 = firstSnapshot(await viaMove.session.handle({ type: "move", direction: "down" }));
    expect(snap2.mode).toBe("battle");
    expect(snap2.battle?.isBoss).toBe(true);
  });

  it("ボス撃破で dream-eater-defeated へ進みセーブに永続、以後は再戦不可", async () => {
    const { session, store } = await bossSession({ stage: "rift-revealed", level: 10 });
    await session.handle({ type: "interact" }); // ボス戦開始
    const last = await fightBossToVictory(session);
    const finalSnap = firstSnapshot(last);
    // 契約: mode:exploration・location=dungeon-3・mainQuestStage=dream-eater-defeated
    expect(finalSnap.mode).toBe("exploration");
    expect(finalSnap.location.mapId).toBe("dungeon-3");
    expect(finalSnap.mainQuestStage).toBe("dream-eater-defeated");
    expect(mustState(session).mainQuestStage).toBe("dream-eater-defeated");
    // セーブに永続
    expect(store.saved.length).toBeGreaterThanOrEqual(1);
    expect(store.saved[store.saved.length - 1]?.mainQuestStage).toBe("dream-eater-defeated");
    // 再接触では戦闘にならない(非アクティブ)
    const again = await session.handle({ type: "interact" });
    expect(dialogsOf(again)).toHaveLength(1);
    expect(dialogsOf(again)[0]?.body).toContain("静か");
    expect(firstSnapshot(again).mode).toBe("exploration");
    expect(mustView(session).mode).toBe("exploration");
  });

  it("リロード(save→load)後もボスは非アクティブ(段階が保持される)", async () => {
    const { session, store } = await bossSession({ stage: "rift-revealed", level: 10 });
    await session.handle({ type: "interact" });
    await fightBossToVictory(session);
    const saved = store.saved[store.saved.length - 1];
    if (saved === undefined) throw new Error("セーブが記録されていない");
    // 別セッションでロード(リロード相当)
    const reload = await bossSession({ state: structuredClone(saved) });
    expect(mustState(reload.session).mainQuestStage).toBe("dream-eater-defeated");
    const msgs = await reload.session.handle({ type: "interact" });
    expect(dialogsOf(msgs)).toHaveLength(1); // 撃破後は非アクティブ(戦闘にならない)
    expect(firstSnapshot(msgs).mode).toBe("exploration");
    expect(mustView(reload.session).mode).toBe("exploration");
  });

  it("acknowledge-ending は dream-eater-defeated を epilogue へ進めてセーブする", async () => {
    const { session, store } = await bossSession({ state: dreamEaterDefeatedState() });
    const savedBefore = store.saved.length;
    const view = firstSnapshot(await session.handle({ type: "acknowledge-ending" }));
    expect(view.mainQuestStage).toBe("epilogue");
    expect(mustState(session).mainQuestStage).toBe("epilogue");
    expect(store.saved.length).toBe(savedBefore + 1);
    expect(store.saved[store.saved.length - 1]?.mainQuestStage).toBe("epilogue");
  });

  it("acknowledge-ending はそれ以外の段階では冪等(段階もセーブも変えない)", async () => {
    const { session, store } = createSession();
    await session.handle({ type: "new-game" }); // arrival
    const view = firstSnapshot(await session.handle({ type: "acknowledge-ending" }));
    expect(view.mainQuestStage).toBe("arrival");
    expect(store.saved).toHaveLength(0);
  });

  /** dungeon-3・撃破済み(dream-eater-defeated)状態を組む(acknowledge-ending 用) */
  function dreamEaterDefeatedState(): GameState {
    const state = createNewGameState();
    state.location = { mapId: "dungeon-3", position: { x: 11, y: 12 }, facing: "down" };
    state.mainQuestStage = "dream-eater-defeated";
    return state;
  }
});

// ===========================================================================
// 中ボス「紡ぎ損ない」(M10。dungeon-2 の固定占有マーカー)
// ===========================================================================

describe("中ボス(紡ぎ損ない)", () => {
  const MID_BOSS_FLAG = "midboss:failing-spinner";

  /** dungeon-2 の中ボス (17,8) の西隣 (16,8) 向き right に立つ(踏み込みで戦闘)。noSymbols 既定 true */
  async function midBossSession(opts?: { level?: number; state?: GameState }): Promise<SessionContext> {
    const ctx = createSession();
    let state: GameState;
    if (opts?.state !== undefined) {
      state = opts.state;
    } else {
      state = createNewGameState();
      state.location = { mapId: "dungeon-2", position: { x: 16, y: 8 }, facing: "right" };
      const level = opts?.level ?? 10;
      const stats = statsForLevel(level);
      state.player = { level, xp: 0, hp: stats.maxHP, mp: stats.maxMP, gold: 50 };
    }
    ctx.store.loadResult = { ok: true, state };
    await ctx.session.handle({ type: "continue" });
    return ctx;
  }

  async function fightToVictory(session: GameSession): Promise<ServerMessage[]> {
    let last: ServerMessage[] = [];
    let rounds = 0;
    while (mustView(session).mode === "battle") {
      last = await session.handle({ type: "battle-command", command: { kind: "attack" } });
      rounds += 1;
      if (rounds > 40) throw new Error("中ボス戦が終わらない(想定外)");
    }
    if (!battleEventsOf(last).events.some((e) => e.type === "victory")) {
      throw new Error("中ボス戦に勝てなかった(Lv10 前提が崩れている)");
    }
    return last;
  }

  it("踏み込みで中ボス戦が始まる(isBoss=false・enemyId=failing-spinner)", async () => {
    const { session } = await midBossSession({ level: 10 });
    const snap = firstSnapshot(await session.handle({ type: "move", direction: "right" }));
    expect(snap.mode).toBe("battle");
    expect(snap.battle?.enemyId).toBe("failing-spinner");
    expect(snap.battle?.isBoss).toBe(false); // メインクエスト進行・エンディングを誘発しない
    // 占有マスなので位置は据え置き(通常移動しない)
    expect(mustState(session).location.position).toEqual({ x: 16, y: 8 });
  });

  it("撃破で gimmicks に記録・メインクエストは進めず・マーカー非表示・再戦不可", async () => {
    const { session } = await midBossSession({ level: 10 });
    const before = mustState(session).mainQuestStage;
    await session.handle({ type: "move", direction: "right" }); // 中ボス戦開始
    const last = await fightToVictory(session);
    const finalSnap = firstSnapshot(last);

    // 探索へ復帰・撃破フラグが gimmicks に記録される
    expect(finalSnap.mode).toBe("exploration");
    expect(mustState(session).gimmicks).toContain(MID_BOSS_FLAG);
    // メインクエストは進まない(最終ボスと違いエンディング非誘発)
    expect(mustState(session).mainQuestStage).toBe(before);
    expect(mustState(session).mainQuestStage).not.toBe("dream-eater-defeated");
    // クライアントのマーカー非表示用に resolvedObjectIds へ載る
    expect(finalSnap.resolvedObjectIds).toContain(MID_BOSS_FLAG);

    // 再接触では戦闘にならず定型 dialog で戻る(リスポーンなし)
    const again = await session.handle({ type: "move", direction: "right" });
    expect(dialogsOf(again)).toHaveLength(1);
    expect(dialogsOf(again)[0]?.body).toContain("空回り");
    expect(firstSnapshot(again).mode).toBe("exploration");
    expect(mustView(session).mode).toBe("exploration");
  });

  it("撃破済みフラグを持つセーブをロードすると最初から非アクティブ(占有dialogのみ)", async () => {
    const saved = createNewGameState();
    saved.location = { mapId: "dungeon-2", position: { x: 16, y: 8 }, facing: "right" };
    saved.gimmicks = [MID_BOSS_FLAG];
    const { session } = await midBossSession({ state: saved });
    const msgs = await session.handle({ type: "move", direction: "right" });
    expect(dialogsOf(msgs)).toHaveLength(1);
    expect(dialogsOf(msgs)[0]?.body).toContain("空回り");
    expect(firstSnapshot(msgs).mode).toBe("exploration");
    expect(firstSnapshot(msgs).resolvedObjectIds).toContain(MID_BOSS_FLAG);
  });

  it("背骨道 x=11 を塞がない(中ボスは側室 (17,8) に配置)", async () => {
    // 中ボス位置が背骨道(x=11)上でないこと=移動スモーク・通しプレイの南下を妨げない
    const midBoss = MAPS["dungeon-2"].midBoss;
    expect(midBoss?.position.x).not.toBe(11);
    expect(midBoss?.enemyId).toBe("failing-spinner");
  });
});

// ===========================================================================
// 採取・宝箱(満杯時の据え置き・リスポーン・永続開封)
// ===========================================================================

describe("採取・宝箱", () => {
  /** フィールドの薬草採取点 (6,6) の手前 (6,7) に立つ */
  async function gatherSession(state?: GameState): Promise<SessionContext> {
    const ctx = createSession();
    ctx.store.loadResult = {
      ok: true,
      state: state ?? fieldState({ position: { x: 6, y: 7 } })
    };
    await ctx.session.handle({ type: "continue" });
    mustState(ctx.session).location.facing = "up";
    return ctx;
  }

  it("採取に成功し、同一訪問中の再採取はできない", async () => {
    const { session } = await gatherSession();
    const msgs = await session.handle({ type: "interact" });
    expect(dialogsOf(msgs)[0]?.body).toBe("薬草を手に入れた。");
    expect(countOf(mustState(session).inventory, "herb")).toBe(1);
    expect(firstSnapshot(msgs).resolvedObjectIds).toContain("field-gather-herb");

    const again = await session.handle({ type: "interact" });
    expect(again).toEqual([{ type: "dialog", speaker: null, body: "もう摘み尽くしてしまった。" }]);
    expect(countOf(mustState(session).inventory, "herb")).toBe(1);
  });

  it("マップを離れて戻ると採取点はリスポーンする", async () => {
    const { session } = await gatherSession();
    await session.handle({ type: "interact" }); // 1回目の採取
    // 街道 (11,1) へ移動し、北の遷移で街へ → すぐフィールドへ戻る
    mustState(session).location.position = { x: 11, y: 1 };
    const toTown = firstSnapshot(await session.handle({ type: "move", direction: "up" }));
    expect(toTown.location.mapId).toBe("town");
    const back = firstSnapshot(await session.handle({ type: "move", direction: "down" }));
    expect(back.location.mapId).toBe("field");
    expect(back.resolvedObjectIds).toEqual([]); // リスポーン済み
    // 再び採取できる
    mustState(session).location.position = { x: 6, y: 7 };
    mustState(session).location.facing = "up";
    const msgs = await session.handle({ type: "interact" });
    expect(dialogsOf(msgs)[0]?.body).toBe("薬草を手に入れた。");
    expect(countOf(mustState(session).inventory, "herb")).toBe(2);
  });

  it("満杯時の採取は取得せず、採取点は残る(破棄しない)", async () => {
    const state = fieldState({ position: { x: 6, y: 7 } });
    state.inventory = addItem(emptyInventory(), "potion-small", INVENTORY_CAPACITY).inventory;
    const { session } = await gatherSession(state);
    const msgs = await session.handle({ type: "interact" });
    // snapshot 無しの通知のみ・resolved にも入らない
    expect(msgs).toEqual([
      { type: "dialog", speaker: null, body: "持ちきれない。今は手が塞がっている。" }
    ]);
    expect(mustView(session).resolvedObjectIds).toEqual([]);
    // 1つ手放せば採取できる
    await session.handle({ type: "discard-item", itemId: "potion-small", quantity: 1 });
    const retry = await session.handle({ type: "interact" });
    expect(dialogsOf(retry)[0]?.body).toBe("薬草を手に入れた。");
    expect(mustView(session).inventoryUsed).toBe(INVENTORY_CAPACITY);
  });

  it("宝箱は一度だけ開けられ、開封状態はセーブを跨いで永続する", async () => {
    const { session, store } = createSession();
    const state = createNewGameState();
    state.location = { mapId: "dungeon-1", position: { x: 5, y: 6 }, facing: "up" }; // 宝箱 (5,5)
    store.loadResult = { ok: true, state };
    await session.handle({ type: "continue" });

    const msgs = await session.handle({ type: "interact" });
    expect(dialogsOf(msgs)[0]?.body).toBe("回復薬(中)を手に入れた。");
    expect(countOf(mustState(session).inventory, "potion-mid")).toBe(1);
    expect(mustState(session).gimmicks).toContain("d1-chest");
    expect(firstSnapshot(msgs).resolvedObjectIds).toContain("d1-chest");

    const again = await session.handle({ type: "interact" });
    expect(dialogsOf(again)[0]?.body).toBe("空っぽの箱だ。もう何も残っていない。");

    // 開封済み状態をセーブ→ロードしても開いたまま(ギミック永続)
    store.loadResult = { ok: true, state: structuredClone(mustState(session)) };
    await session.handle({ type: "continue" });
    expect(mustView(session).resolvedObjectIds).toContain("d1-chest");
    const afterLoad = await session.handle({ type: "interact" });
    expect(dialogsOf(afterLoad)[0]?.body).toBe("空っぽの箱だ。もう何も残っていない。");
  });
});

// ===========================================================================
// アイテム使用・破棄
// ===========================================================================

describe("アイテム使用", () => {
  it("回復薬で回復し、最大HPで頭打ちになる", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    mustState(session).player.hp = 25; // Lv1 最大30・回復量30
    const msgs = await session.handle({ type: "use-item", itemId: "potion-small" });
    expect(mustState(session).player.hp).toBe(30);
    expect(countOf(mustState(session).inventory, "potion-small")).toBe(1);
    expect(dialogsOf(msgs)[0]?.body).toBe("回復薬(小)を使った。傷が少し癒えた。");
  });

  it("回復量ぴったり分だけ回復する(上限に届かない場合)", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    const state = mustState(session);
    state.player.level = 10; // 最大HP150
    state.player.hp = 100;
    await session.handle({ type: "use-item", itemId: "potion-small" }); // +30
    expect(mustState(session).player.hp).toBe(130);
  });

  it("未所持・効果なし・HP満タンはそれぞれエラーで消費しない", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    expectError(await session.handle({ type: "use-item", itemId: "potion-mid" }), "not-owned");

    const state = mustState(session);
    state.inventory = addItem(state.inventory, "herb", 1).inventory;
    expectError(await session.handle({ type: "use-item", itemId: "herb" }), "unusable-here");
    expect(countOf(mustState(session).inventory, "herb")).toBe(1);

    expectError(await session.handle({ type: "use-item", itemId: "potion-small" }), "hp-full");
    expect(countOf(mustState(session).inventory, "potion-small")).toBe(2);
  });
});

describe("アイテム破棄", () => {
  it("クエスト用アイテムは破棄できない", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    const state = mustState(session);
    state.inventory = addItem(state.inventory, "old-key", 1).inventory; // 別枠へ入る
    expectError(
      await session.handle({ type: "discard-item", itemId: "old-key", quantity: 1 }),
      "not-discardable"
    );
    expect(mustView(session).questItems).toHaveLength(1);
  });

  it("所持数を超える破棄は拒否する", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    expectError(
      await session.handle({ type: "discard-item", itemId: "potion-small", quantity: 5 }),
      "not-owned"
    );
    expect(countOf(mustState(session).inventory, "potion-small")).toBe(2);
  });

  it("破棄に成功すると所持数が減り、個数つきの文言を返す", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    const msgs = await session.handle({ type: "discard-item", itemId: "potion-small", quantity: 2 });
    expect(dialogsOf(msgs)[0]?.body).toBe("回復薬(小)×2を手放した。");
    expect(countOf(mustState(session).inventory, "potion-small")).toBe(0);
  });
});

// ===========================================================================
// 店(購入・売却)
// ===========================================================================

describe("店", () => {
  /** 商人の前に立って店を開いた状態を用意する */
  async function shopSession(): Promise<SessionContext> {
    const ctx = createSession();
    await ctx.session.handle({ type: "new-game" });
    mustState(ctx.session).location.position = { x: 16, y: 5 };
    mustState(ctx.session).location.facing = "up";
    await ctx.session.handle({ type: "interact" });
    return ctx;
  }

  it("購入でゴールドが減り、アイテムが増える(店は開いたまま)", async () => {
    const { session } = await shopSession();
    const msgs = await session.handle({ type: "shop-buy", itemId: "potion-small", quantity: 1 });
    expect(msgs).toHaveLength(1); // snapshot のみ
    const view = firstSnapshot(msgs);
    expect(view.player.gold).toBe(INITIAL_GOLD - 20);
    expect(countOf(mustState(session).inventory, "potion-small")).toBe(3);
    expect(view.interaction?.kind).toBe("shop"); // 開いたまま
  });

  it("店の外・非売品・資金不足・容量不足はそれぞれブロックする", async () => {
    const outside = createSession();
    await outside.session.handle({ type: "new-game" });
    expectError(
      await outside.session.handle({ type: "shop-buy", itemId: "potion-small", quantity: 1 }),
      "not-in-shop"
    );

    const { session } = await shopSession();
    expectError(
      await session.handle({ type: "shop-buy", itemId: "herb", quantity: 1 }),
      "not-sold"
    );
    expectError(
      await session.handle({ type: "shop-buy", itemId: "potion-mid", quantity: 1 }), // 55G > 30G
      "not-enough-gold"
    );
    // 満杯にして購入(20G ≤ 30G なので資金は足りるが容量で弾く)
    mustState(session).inventory = addItem(emptyInventory(), "herb", INVENTORY_CAPACITY).inventory;
    expectError(
      await session.handle({ type: "shop-buy", itemId: "potion-small", quantity: 1 }),
      "inventory-full"
    );
    expect(mustState(session).player.gold).toBe(INITIAL_GOLD); // 一切引かれていない
  });

  it("売却でゴールドが増え、アイテムが減る(薬草は明示価格5G)", async () => {
    const { session } = await shopSession();
    const state = mustState(session);
    state.inventory = addItem(state.inventory, "herb", 2).inventory;
    const msgs = await session.handle({ type: "shop-sell", itemId: "herb", quantity: 2 });
    expect(msgs).toHaveLength(1);
    expect(firstSnapshot(msgs).player.gold).toBe(INITIAL_GOLD + 10);
    expect(countOf(mustState(session).inventory, "herb")).toBe(0);
  });

  it("クエスト用アイテムの売却・未所持の売却は拒否する", async () => {
    const { session } = await shopSession();
    const state = mustState(session);
    state.inventory = addItem(state.inventory, "old-key", 1).inventory;
    expectError(
      await session.handle({ type: "shop-sell", itemId: "old-key", quantity: 1 }),
      "not-sellable"
    );
    expectError(
      await session.handle({ type: "shop-sell", itemId: "ore", quantity: 1 }),
      "not-owned"
    );
  });

  // --- 装備品の売買(M8-3。分岐は消耗品と共通。装備固有の観点を検証) ---

  it("装備品の購入でゴールドが減り、インベントリに入る(店は開いたまま)", async () => {
    const { session } = await shopSession();
    mustState(session).player.gold = 200; // 装備は 50〜180G。INITIAL_GOLD(30)では買えないため補充
    const msgs = await session.handle({ type: "shop-buy", itemId: "worn-blade", quantity: 1 });
    expect(msgs).toHaveLength(1); // snapshot のみ
    const view = firstSnapshot(msgs);
    expect(view.player.gold).toBe(200 - 60); // worn-blade 60G
    expect(countOf(mustState(session).inventory, "worn-blade")).toBe(1);
    expect(view.interaction?.kind).toBe("shop"); // 開いたまま
  });

  it("装備品の購入は容量不足で inventory-full ブロック(資金は足りてもゴールドは引かれない)", async () => {
    const { session } = await shopSession();
    const state = mustState(session);
    state.player.gold = 200; // 資金は十分(ゴールドチェックを先に通し、容量分岐に到達させる)
    state.inventory = addItem(emptyInventory(), "herb", INVENTORY_CAPACITY).inventory; // 満杯
    expectError(
      await session.handle({ type: "shop-buy", itemId: "warded-mail", quantity: 1 }),
      "inventory-full"
    );
    expect(mustState(session).player.gold).toBe(200); // 一切引かれていない
    expect(countOf(mustState(session).inventory, "warded-mail")).toBe(0);
  });

  it("装備品の売却で sellPrice ぶんゴールドが増え、インベントリから減る", async () => {
    const { session } = await shopSession();
    const state = mustState(session);
    state.inventory = addItem(state.inventory, "amber-blade", 1).inventory;
    const goldBefore = state.player.gold;
    const msgs = await session.handle({ type: "shop-sell", itemId: "amber-blade", quantity: 1 });
    expect(msgs).toHaveLength(1);
    expect(firstSnapshot(msgs).player.gold).toBe(goldBefore + sellPriceOf("amber-blade")); // 180/2 = 90
    expect(countOf(mustState(session).inventory, "amber-blade")).toBe(0);
  });

  it("装備中の品はスロットにありインベントリに無いため売却できない(not-owned・装備は外れない)", async () => {
    const { session } = await shopSession();
    const state = mustState(session);
    // 唯一の1個を装備 → インベントリの worn-blade は 0 になる(スロットへ移る)
    state.inventory = addItem(state.inventory, "worn-blade", 1).inventory;
    await session.handle({ type: "equip", itemId: "worn-blade" });
    expect(countOf(mustState(session).inventory, "worn-blade")).toBe(0);
    expect(mustState(session).equipment.weapon).toBe("worn-blade");
    const goldBefore = mustState(session).player.gold;
    // 装備スロットの品は売却対象にならない(誤ってスロットから売れない)
    expectError(
      await session.handle({ type: "shop-sell", itemId: "worn-blade", quantity: 1 }),
      "not-owned"
    );
    expect(mustState(session).equipment.weapon).toBe("worn-blade"); // 外れていない
    expect(mustState(session).player.gold).toBe(goldBefore); // 増えていない
  });

  // --- 好感度の段階割引(M11-1。game-design.md「好感度の段階(拡張: M11)」) ---

  /** 商人の好感度を直接設定してから店を開いた状態を用意する */
  async function shopSessionWithAffinity(affinity: number): Promise<SessionContext> {
    const ctx = createSession();
    await ctx.session.handle({ type: "new-game" });
    mustState(ctx.session).npcs.merchant.affinity = affinity;
    mustState(ctx.session).location.position = { x: 16, y: 5 };
    mustState(ctx.session).location.facing = "up";
    await ctx.session.handle({ type: "interact" });
    return ctx;
  }

  it("好感度80(信頼)で店を開くと stock の buyPrice が割引後の値になる", async () => {
    const { session } = await shopSessionWithAffinity(80);
    const view = mustView(session);
    if (view.interaction?.kind !== "shop") throw new Error("shop interaction が無い");
    const byId = new Map(view.interaction.stock.map((e) => [e.itemId, e.buyPrice]));
    expect(byId.get("potion-small")).toBe(18); // 20 - floor(20*10/100)
    expect(byId.get("worn-blade")).toBe(54); // 60 - floor(60*10/100)
  });

  it("好感度80(信頼)の購入は10%引きで請求される(表示と同額)", async () => {
    const { session } = await shopSessionWithAffinity(80);
    mustState(session).player.gold = 200;
    const msgs = await session.handle({ type: "shop-buy", itemId: "worn-blade", quantity: 1 });
    expect(firstSnapshot(msgs).player.gold).toBe(200 - 54);
    expect(countOf(mustState(session).inventory, "worn-blade")).toBe(1);
  });

  it("好感度50(打ち解けた)の購入は5%引き(境界50で割引が始まる)", async () => {
    const { session } = await shopSessionWithAffinity(50);
    const msgs = await session.handle({ type: "shop-buy", itemId: "potion-small", quantity: 1 });
    expect(firstSnapshot(msgs).player.gold).toBe(INITIAL_GOLD - 19); // 20 - floor(20*5/100)
  });

  it("好感度49(よそよそしい)までは従来価格のまま(境界の直下)", async () => {
    const { session } = await shopSessionWithAffinity(49);
    const view = mustView(session);
    if (view.interaction?.kind !== "shop") throw new Error("shop interaction が無い");
    expect(view.interaction.stock.find((e) => e.itemId === "potion-small")?.buyPrice).toBe(20);
    const msgs = await session.handle({ type: "shop-buy", itemId: "potion-small", quantity: 1 });
    expect(firstSnapshot(msgs).player.gold).toBe(INITIAL_GOLD - 20);
  });

  it("好感度80でも売却は従来価格(売値の段階増しは M11-3 で表示と同時に適用)", async () => {
    const { session } = await shopSessionWithAffinity(80);
    const state = mustState(session);
    state.inventory = addItem(state.inventory, "worn-blade", 1).inventory;
    const goldBefore = state.player.gold;
    const msgs = await session.handle({ type: "shop-sell", itemId: "worn-blade", quantity: 1 });
    // adjustedSellPrice(31G)ではなく基準売値(30G)。クライアントの売値表示と一致させる
    expect(firstSnapshot(msgs).player.gold).toBe(goldBefore + sellPriceOf("worn-blade"));
  });
});

// ===========================================================================
// 装備・解除(M8-2。探索中のみ・スナップショット反映・戦闘への反映・旧セーブ互換)
// ===========================================================================

describe("装備", () => {
  /** 武器・防具を所持した新規ゲーム(街・探索中)を用意する */
  async function equipReady(): Promise<SessionContext> {
    const ctx = createSession();
    await ctx.session.handle({ type: "new-game" });
    const state = mustState(ctx.session);
    state.inventory = addItem(state.inventory, "worn-blade", 1).inventory;
    state.inventory = addItem(state.inventory, "amber-blade", 1).inventory;
    state.inventory = addItem(state.inventory, "worn-cloak", 1).inventory;
    return ctx;
  }

  /** battle-events から「敵への damage」イベントの与ダメージ量を取り出す */
  function enemyDamageDealt(msgs: ServerMessage[]): number {
    const ev = battleEventsOf(msgs).events.find((e) => e.type === "damage" && e.target === "enemy");
    if (ev === undefined || ev.type !== "damage") throw new Error("敵への damage イベントが無い");
    return ev.amount;
  }

  it("装備成功でスナップショットに反映され、実効攻撃力が上がりインベントリが減る", async () => {
    const { session } = await equipReady();
    const before = mustView(session).player;
    const view = firstSnapshot(await session.handle({ type: "equip", itemId: "worn-blade" }));
    expect(view.player.equipment.weapon).toEqual({ itemId: "worn-blade", name: "錆びた片刃", bonus: 3 });
    expect(view.player.equipment.armor).toBeNull();
    expect(view.player.effectiveAttack).toBe(before.effectiveAttack + 3);
    expect(view.player.effectiveDefense).toBe(before.effectiveDefense); // 武器は防御に影響しない
    expect(countOf(mustState(session).inventory, "worn-blade")).toBe(0); // 1個消費
    expect(mustState(session).equipment.weapon).toBe("worn-blade");
  });

  it("防具も同様に装備でき、実効防御力が上がる", async () => {
    const { session } = await equipReady();
    const before = mustView(session).player;
    const view = firstSnapshot(await session.handle({ type: "equip", itemId: "worn-cloak" }));
    expect(view.player.equipment.armor).toEqual({ itemId: "worn-cloak", name: "擦り切れた外套", bonus: 2 });
    expect(view.player.effectiveDefense).toBe(before.effectiveDefense + 2);
    expect(view.player.effectiveAttack).toBe(before.effectiveAttack);
  });

  it("未所持の装備は not-owned で失敗し、状態は不変", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    expectError(await session.handle({ type: "equip", itemId: "amber-blade" }), "not-owned");
    expect(mustState(session).equipment.weapon).toBeNull();
  });

  it("入れ替え: 装備中に別武器を装備すると旧武器がインベントリへ戻る", async () => {
    const { session } = await equipReady();
    await session.handle({ type: "equip", itemId: "worn-blade" });
    const view = firstSnapshot(await session.handle({ type: "equip", itemId: "amber-blade" }));
    expect(view.player.equipment.weapon?.itemId).toBe("amber-blade");
    expect(countOf(mustState(session).inventory, "worn-blade")).toBe(1); // 旧武器が戻る
    expect(countOf(mustState(session).inventory, "amber-blade")).toBe(0); // 新武器は消費
  });

  it("解除でインベントリへ戻り、スロットが空になる", async () => {
    const { session } = await equipReady();
    await session.handle({ type: "equip", itemId: "worn-cloak" });
    const view = firstSnapshot(await session.handle({ type: "unequip", slot: "armor" }));
    expect(view.player.equipment.armor).toBeNull();
    expect(view.player.effectiveDefense).toBe(statsForLevel(1).defense); // 基礎値へ戻る
    expect(countOf(mustState(session).inventory, "worn-cloak")).toBe(1);
  });

  it("空スロットの解除は not-equipped で失敗", async () => {
    const { session } = await equipReady();
    expectError(await session.handle({ type: "unequip", slot: "weapon" }), "not-equipped");
  });

  it("インベントリ満杯だと解除は inventory-full で失敗し、装備は外れない", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    const state = mustState(session);
    state.equipment = { weapon: "worn-blade", armor: null };
    state.inventory = addItem(emptyInventory(), "herb", INVENTORY_CAPACITY).inventory; // 満杯
    expectError(await session.handle({ type: "unequip", slot: "weapon" }), "inventory-full");
    expect(mustState(session).equipment.weapon).toBe("worn-blade"); // 不変
  });

  it("戦闘中は装備・解除できない(invalid-mode)", async () => {
    const { session } = await sessionInBattle();
    expectError(await session.handle({ type: "equip", itemId: "worn-blade" }), "invalid-mode");
    expectError(await session.handle({ type: "unequip", slot: "weapon" }), "invalid-mode");
    expect(mustView(session).mode).toBe("battle");
  });

  it("戦闘開始時に装備込みの攻撃力が使われる(同条件で武器ありは素手より大ダメージ)", async () => {
    // 同一シード・同一状況。装備の有無だけが差(装備は this.rng を消費しないため戦闘シードは一致)
    const armed = createSession({ seed: 1, noSymbols: false });
    const bare = createSession({ seed: 1, noSymbols: false });
    const armedState = fieldState();
    armedState.equipment = { weapon: "amber-blade", armor: null };
    armed.store.loadResult = { ok: true, state: armedState };
    bare.store.loadResult = { ok: true, state: fieldState() };
    await armed.session.handle({ type: "continue" });
    await bare.session.handle({ type: "continue" });
    await engageBattle(armed.session);
    await engageBattle(bare.session);
    const dmgArmed = enemyDamageDealt(
      await armed.session.handle({ type: "battle-command", command: { kind: "attack" } })
    );
    const dmgBare = enemyDamageDealt(
      await bare.session.handle({ type: "battle-command", command: { kind: "attack" } })
    );
    expect(dmgArmed).toBeGreaterThan(dmgBare);
  });

  it("装備フィールドを持たない旧セーブをロード→装備→宿泊セーブの一連が通る", async () => {
    const { session, store } = createSession();
    const base = createNewGameState();
    // 旧セーブ相当(equipment 欠落)を default 補完で読み込む(game-state.test の互換流儀)
    const legacy = gameStateSchema.parse({
      version: base.version,
      player: base.player,
      location: { mapId: "town", position: { x: 4, y: 5 }, facing: "up" }, // 宿屋の主人の前
      inventory: addItem(base.inventory, "worn-blade", 1).inventory,
      day: base.day,
      playtimeSeconds: base.playtimeSeconds,
      gimmicks: base.gimmicks
    });
    expect(legacy.equipment).toEqual(createEmptyEquipment()); // 欠落は空装備で補完
    store.loadResult = { ok: true, state: legacy };
    await session.handle({ type: "continue" });

    // 装備 → スナップショットに反映
    const equipView = firstSnapshot(await session.handle({ type: "equip", itemId: "worn-blade" }));
    expect(equipView.player.equipment.weapon?.itemId).toBe("worn-blade");

    // 宿泊してセーブ(equipment 込みで永続化される)
    await session.handle({ type: "interact" }); // 宿を開く
    await session.handle({ type: "rest" });
    const saved = store.saved[store.saved.length - 1];
    expect(saved?.equipment.weapon).toBe("worn-blade");
  });
});

// ===========================================================================
// 宿泊(手順0→1→2→5)・日付管理・プレイ時間
// ===========================================================================

describe("宿泊", () => {
  /** 宿屋の主人の前で宿の interaction を開いた状態を用意する */
  async function innSession(): Promise<SessionContext> {
    const ctx = createSession();
    await ctx.session.handle({ type: "new-game" });
    mustState(ctx.session).location.position = { x: 4, y: 5 };
    mustState(ctx.session).location.facing = "up";
    await ctx.session.handle({ type: "interact" });
    return ctx;
  }

  it("宿泊で費用徴収→全回復→日送り→セーブが行われる", async () => {
    const { session, store } = await innSession();
    const state = mustState(session);
    state.player.hp = 3;
    state.player.mp = 1;
    const msgs = await session.handle({ type: "rest" });
    const view = firstSnapshot(msgs);
    expect(view.player.gold).toBe(INITIAL_GOLD - INN_COST); // 手順0
    expect(view.player.hp).toBe(30); // 手順1
    expect(view.player.mp).toBe(10);
    expect(view.day).toBe(2); // 手順2
    expect(store.saved).toHaveLength(1); // 手順5
    expect(store.saved[0]?.day).toBe(2);
    expect(store.saved[0]?.player.hp).toBe(30);
    expect(view.interaction).toBeUndefined(); // 宿の overlay は閉じる
    const dialog = dialogsOf(msgs)[0];
    expect(dialog?.speaker).toBe(NPC_DISPLAY_NAMES.innkeeper);
    expect(dialog?.body).toContain("ゆっくりおやすみ");
  });

  it("宿泊費不足でも拒否せず、無料で回復+日送り+セーブする", async () => {
    const { session, store } = await innSession();
    const state = mustState(session);
    state.player.gold = 5; // INN_COST=10 に満たない
    state.player.hp = 1;
    const msgs = await session.handle({ type: "rest" });
    const view = firstSnapshot(msgs);
    expect(view.player.gold).toBe(5); // 徴収しない
    expect(view.player.hp).toBe(30);
    expect(view.day).toBe(2);
    expect(store.saved).toHaveLength(1);
    expect(dialogsOf(msgs)[0]?.body).toContain("今日はお代はいらないよ");
  });

  it("宿の外での rest は拒否する", async () => {
    const { session } = createSession();
    await session.handle({ type: "new-game" });
    expectError(await session.handle({ type: "rest" }), "not-at-inn");
  });

  it("日付は宿泊のたびに進む(日付管理)", async () => {
    const { session, store } = await innSession();
    await session.handle({ type: "rest" }); // day 2
    await session.handle({ type: "interact" }); // rest で閉じた宿を開き直す
    await session.handle({ type: "rest" }); // day 3
    expect(mustState(session).day).toBe(3);
    expect(store.saved).toHaveLength(2);
  });

  it("プレイ時間はサーバー側で計測し、宿泊セーブで永続化する", async () => {
    const { session, store, advance } = await innSession();
    advance(90_000);
    expect(mustView(session).playtimeSeconds).toBe(90);
    advance(30_000);
    await session.handle({ type: "rest" });
    expect(store.saved[0]?.playtimeSeconds).toBe(120);
    // セーブ後も基点を引き継いで加算される
    advance(10_000);
    expect(mustView(session).playtimeSeconds).toBe(130);
  });
});
