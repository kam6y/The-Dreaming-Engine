import {
  GAME_TITLE,
  INITIAL_GOLD,
  INN_COST,
  INVENTORY_CAPACITY,
  NPC_DISPLAY_NAMES,
  TOWN_WAKE_POINT,
  addItem,
  countOf,
  createNewGameState,
  emptyInventory,
  samePosition,
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
    for (const symbol of view.symbols) {
      expect(symbol.enemyId).toBe("mist-wolf");
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

  it("情報屋・司祭はダイアログのみ(M3 では interaction を開かない)", async () => {
    const informant = await townSession({ x: 4, y: 9 }, "down"); // 情報屋 (4,10)
    const msgs1 = await informant.session.handle({ type: "interact" });
    expect(msgs1).toHaveLength(1);
    expect(dialogsOf(msgs1)[0]?.speaker).toBe(NPC_DISPLAY_NAMES.informant);
    expect(mustView(informant.session).interaction).toBeUndefined();

    const priest = await townSession({ x: 16, y: 9 }, "down"); // 司祭 (16,10)
    const msgs2 = await priest.session.handle({ type: "interact" });
    expect(msgs2).toHaveLength(1);
    expect(dialogsOf(msgs2)[0]?.speaker).toBe(NPC_DISPLAY_NAMES.priest);
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
