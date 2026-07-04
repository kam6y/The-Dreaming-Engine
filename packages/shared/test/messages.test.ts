import { describe, expect, it } from "vitest";

import {
  GAME_TITLE,
  clientMessageSchema,
  createNewGameState,
  serverMessageSchema
} from "../src/index.js";
import type { SnapshotView } from "../src/index.js";

describe("WebSocket message schemas", () => {
  it("accepts a client ping message", () => {
    const parsed = clientMessageSchema.parse({ type: "ping", sentAt: 1 });

    expect(parsed).toEqual({ type: "ping", sentAt: 1 });
  });

  it("rejects an unknown client message type", () => {
    expect(() => clientMessageSchema.parse({ type: "dream" })).toThrow();
  });

  it("accepts the server state and pong messages used by the M0 smoke path", () => {
    expect(serverMessageSchema.parse({ type: "state", title: GAME_TITLE })).toEqual({
      type: "state",
      title: GAME_TITLE
    });
    expect(
      serverMessageSchema.parse({ type: "pong", sentAt: 1, receivedAt: 2 })
    ).toEqual({ type: "pong", sentAt: 1, receivedAt: 2 });
  });
});

describe("クライアント→サーバー 操作メッセージ(M3)", () => {
  it("new-gameはオプション無し・有りの両方をパースできる", () => {
    expect(clientMessageSchema.parse({ type: "new-game" })).toEqual({ type: "new-game" });
    const withOptions = clientMessageSchema.parse({
      type: "new-game",
      options: { seed: 42, noSymbols: true }
    });
    expect(withOptions).toEqual({ type: "new-game", options: { seed: 42, noSymbols: true } });
  });

  it("continue / interact / restは追加フィールド無しでパースできる", () => {
    expect(clientMessageSchema.parse({ type: "continue" })).toEqual({ type: "continue" });
    expect(clientMessageSchema.parse({ type: "interact" })).toEqual({ type: "interact" });
    expect(clientMessageSchema.parse({ type: "rest" })).toEqual({ type: "rest" });
  });

  it("moveは4方向のみ受け付ける", () => {
    expect(clientMessageSchema.parse({ type: "move", direction: "up" })).toEqual({
      type: "move",
      direction: "up"
    });
    expect(() => clientMessageSchema.parse({ type: "move", direction: "north" })).toThrow();
    expect(() => clientMessageSchema.parse({ type: "move" })).toThrow();
  });

  it("battle-commandは戦闘コマンドスキーマで検証する", () => {
    expect(
      clientMessageSchema.parse({ type: "battle-command", command: { kind: "attack" } })
    ).toEqual({ type: "battle-command", command: { kind: "attack" } });
    expect(
      clientMessageSchema.parse({ type: "battle-command", command: { kind: "flee" } })
    ).toEqual({ type: "battle-command", command: { kind: "flee" } });
    expect(() =>
      clientMessageSchema.parse({ type: "battle-command", command: { kind: "dance" } })
    ).toThrow();
  });

  it("use-itemは既知のitemIdのみ受け付ける", () => {
    expect(clientMessageSchema.parse({ type: "use-item", itemId: "potion-small" })).toEqual({
      type: "use-item",
      itemId: "potion-small"
    });
    expect(() => clientMessageSchema.parse({ type: "use-item", itemId: "excalibur" })).toThrow();
  });

  it("discard-itemのquantityは省略時1・0以下は拒否", () => {
    expect(clientMessageSchema.parse({ type: "discard-item", itemId: "herb" })).toEqual({
      type: "discard-item",
      itemId: "herb",
      quantity: 1
    });
    expect(
      clientMessageSchema.parse({ type: "discard-item", itemId: "herb", quantity: 3 })
    ).toEqual({ type: "discard-item", itemId: "herb", quantity: 3 });
    expect(() =>
      clientMessageSchema.parse({ type: "discard-item", itemId: "herb", quantity: 0 })
    ).toThrow();
    expect(() =>
      clientMessageSchema.parse({ type: "discard-item", itemId: "herb", quantity: -1 })
    ).toThrow();
  });

  it("shop-buy / shop-sellは正の整数quantityが必須", () => {
    expect(
      clientMessageSchema.parse({ type: "shop-buy", itemId: "potion-small", quantity: 2 })
    ).toEqual({ type: "shop-buy", itemId: "potion-small", quantity: 2 });
    expect(
      clientMessageSchema.parse({ type: "shop-sell", itemId: "herb", quantity: 1 })
    ).toEqual({ type: "shop-sell", itemId: "herb", quantity: 1 });
    expect(() =>
      clientMessageSchema.parse({ type: "shop-buy", itemId: "potion-small" })
    ).toThrow();
    expect(() =>
      clientMessageSchema.parse({ type: "shop-sell", itemId: "herb", quantity: 1.5 })
    ).toThrow();
    expect(() =>
      clientMessageSchema.parse({ type: "shop-buy", itemId: "potion-small", quantity: 0 })
    ).toThrow();
  });
});

describe("サーバー→クライアント メッセージ(M3)", () => {
  /** テスト用の最小スナップショットビューを組み立てる */
  function sampleView(): SnapshotView {
    const state = createNewGameState();
    return {
      mode: "exploration",
      mainQuestStage: state.mainQuestStage,
      player: {
        level: state.player.level,
        xp: state.player.xp,
        xpToNext: 8,
        hp: state.player.hp,
        maxHp: state.player.hp,
        mp: state.player.mp,
        maxMp: state.player.mp,
        gold: state.player.gold
      },
      day: state.day,
      playtimeSeconds: 0,
      location: state.location,
      inventory: [{ itemId: "potion-small", name: "回復薬(小)", count: 2, questItem: false }],
      questItems: [],
      inventoryCapacity: 20,
      inventoryUsed: 2,
      symbols: [{ position: { x: 5, y: 5 }, enemyId: "mist-wolf" }],
      resolvedObjectIds: [],
      subQuests: []
    };
  }

  it("helloはタイトルとセーブ有無を持つ", () => {
    expect(serverMessageSchema.parse({ type: "hello", title: GAME_TITLE, hasSave: true })).toEqual(
      { type: "hello", title: GAME_TITLE, hasSave: true }
    );
    expect(() =>
      serverMessageSchema.parse({ type: "hello", title: "別のゲーム", hasSave: false })
    ).toThrow();
  });

  it("snapshotは権威ビューを内包する", () => {
    const view = sampleView();
    const parsed = serverMessageSchema.parse({ type: "snapshot", view });
    expect(parsed).toEqual({ type: "snapshot", view });
    // 必須フィールド欠落は拒否
    const broken: Record<string, unknown> = { ...view };
    delete broken.symbols;
    expect(() => serverMessageSchema.parse({ type: "snapshot", view: broken })).toThrow();
  });

  it("dialogはspeaker=null(地の文)を許容し、空bodyは拒否する", () => {
    expect(
      serverMessageSchema.parse({ type: "dialog", speaker: null, body: "……静かだ。" })
    ).toEqual({ type: "dialog", speaker: null, body: "……静かだ。" });
    expect(
      serverMessageSchema.parse({ type: "dialog", speaker: "オルガ", body: "おやすみ。" })
    ).toEqual({ type: "dialog", speaker: "オルガ", body: "おやすみ。" });
    expect(() => serverMessageSchema.parse({ type: "dialog", speaker: null, body: "" })).toThrow();
  });

  it("battle-eventsはイベント列を持ち、errorはcodeを省略できる", () => {
    expect(serverMessageSchema.parse({ type: "battle-events", events: [] })).toEqual({
      type: "battle-events",
      events: []
    });
    expect(
      serverMessageSchema.parse({
        type: "battle-events",
        events: [{ type: "flee", success: true, message: "旅人は霧の中へ身を退いた。" }]
      }).type
    ).toBe("battle-events");
    expect(serverMessageSchema.parse({ type: "error", message: "だめ", code: "no-save" })).toEqual(
      { type: "error", message: "だめ", code: "no-save" }
    );
    expect(serverMessageSchema.parse({ type: "error", message: "だめ" })).toEqual({
      type: "error",
      message: "だめ"
    });
    expect(() => serverMessageSchema.parse({ type: "error", message: "" })).toThrow();
  });
});
