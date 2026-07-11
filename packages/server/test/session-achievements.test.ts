import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  addItem,
  createNewGameState,
  gameStateSchema,
  mapIdSchema,
  midBossDefeatFlag,
  statsForLevel,
  type GameState,
  type ServerMessage,
  type SnapshotView,
  type SubQuest
} from "@dreaming-engine/shared";
import { afterEach, describe, expect, it } from "vitest";

import { AuditLog } from "../src/ai/audit-log.js";
import { loadAiConfig } from "../src/ai/config.js";
import { MockDreamMaster } from "../src/ai/dream-master/index.js";
import { AiFlowGatekeeper, AiTurnExecutor } from "../src/ai/flow-control/index.js";
import { RateLimiter } from "../src/ai/rate-limit.js";
import type { LoadResult, SaveStore } from "../src/game/save.js";
import { GameSession } from "../src/game/session.js";

/**
 * 実績「夢の欠片」(M24)のサーバー統合テスト。
 * 仕様の正: game-design.md「実績システム『夢の欠片』(拡張: M24)」判定・解除フロー。
 * - 単一チョークポイント(snapshot 構築前の評価)で解除されること
 * - 宿泊は手順4(世界変化適用)後・手順5(セーブ)前に評価され、解除が当該セーブに載ること
 * - 旧セーブ(unlockedAchievements 欠落)のロードで永続状態由来の実績が最初の評価で再解除されること
 * - 解除で dialog を送らないこと
 */

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

/** メッセージ列から最初の snapshot ビューを取り出す(無ければ失敗) */
function firstSnapshot(msgs: ServerMessage[]): SnapshotView {
  for (const msg of msgs) {
    if (msg.type === "snapshot") return msg.view;
  }
  throw new Error(`snapshot が含まれていない: ${JSON.stringify(msgs.map((m) => m.type))}`);
}

/** AI なし(gatekeeper 未注入)のセッション。実績評価は AI 非依存なのでこちらが基本形 */
function createSession(): { session: GameSession; store: FakeSaveStore } {
  const store = new FakeSaveStore();
  let now = 0;
  const session = new GameSession({
    saveStore: store,
    clock: () => {
      now += 1;
      return now;
    },
    seed: 1,
    noSymbols: true
  });
  return { session, store };
}

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
});

/**
 * MockDreamMaster 系で gatekeeper を組んだ AI セッション(session-ai.test.ts と同構成)。
 * 宿泊の夢シーン=世界変化適用(woven-morning)の検証に使う。
 */
function createAiSession(opts?: { malicious?: boolean }): {
  session: GameSession;
  store: FakeSaveStore;
} {
  const now = 0; // 本テストは実時間に依存しない(クールダウンを跨がない)ため固定クロックでよい
  const clock = (): number => now;
  const config = loadAiConfig({ sessionCallLimit: 1000 });
  const dir = mkdtempSync(path.join(tmpdir(), "de-achv-audit-"));
  tmpDirs.push(dir);
  const auditLog = new AuditLog({ dir, now: () => new Date(now) });
  const dreamMaster = new MockDreamMaster(config, { malicious: opts?.malicious ?? false });
  const executor = new AiTurnExecutor({ dreamMaster, config });
  const gatekeeper = new AiFlowGatekeeper({
    executor,
    config,
    rateLimiter: new RateLimiter(clock),
    auditLog,
    now: clock
  });
  const store = new FakeSaveStore();
  const session = new GameSession({
    saveStore: store,
    clock,
    seed: 1,
    noSymbols: true,
    gatekeeper,
    playerInputMaxLength: config.playerInputMaxLength,
    maskEnv: {} as NodeJS.ProcessEnv
  });
  return { session, store };
}

/** 報告可能(達成済み)の hunt サブクエスト(count=progress=1) */
function readyHunt(id = "pq-0"): SubQuest {
  return {
    type: "hunt",
    id,
    targetId: "mist-wolf",
    count: 1,
    progress: 1,
    rewardGold: 10,
    title: "霧狼をひとつ鎮める",
    description: "忘れ野の霧狼を一体、鎮めてほしい。",
    status: "completed"
  };
}

describe("単一チョークポイントでの解除(装備2点=traveler-outfitted)", () => {
  it("装備が両スロット揃った直後の snapshot で解除され、dialog は送られない", async () => {
    const { session, store } = createSession();
    const state = createNewGameState();
    state.inventory = addItem(state.inventory, "worn-blade", 1).inventory;
    state.inventory = addItem(state.inventory, "worn-cloak", 1).inventory;
    store.loadResult = { ok: true, state };
    await session.handle({ type: "continue" });

    // 武器のみ: まだ解除されない
    const afterWeapon = firstSnapshot(await session.handle({ type: "equip", itemId: "worn-blade" }));
    expect(afterWeapon.unlockedAchievements).not.toContain("traveler-outfitted");

    // 防具も装備: 同じ操作の snapshot で解除。応答は snapshot のみ(dialog を送らない)
    const msgs = await session.handle({ type: "equip", itemId: "worn-cloak" });
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.type).toBe("snapshot");
    expect(firstSnapshot(msgs).unlockedAchievements).toContain("traveler-outfitted");
  });

  it("解除は不可逆: 装備を外しても解除済みのまま", async () => {
    const { session, store } = createSession();
    const state = createNewGameState();
    state.equipment = { weapon: "worn-blade", armor: "worn-cloak" };
    store.loadResult = { ok: true, state };
    const loaded = firstSnapshot(await session.handle({ type: "continue" }));
    expect(loaded.unlockedAchievements).toContain("traveler-outfitted");

    const afterUnequip = firstSnapshot(await session.handle({ type: "unequip", slot: "weapon" }));
    expect(afterUnequip.unlockedAchievements).toContain("traveler-outfitted");
  });
});

describe("時間帯由来の解除(night-wanderer)", () => {
  it("夜(mock 限定の固定ピン)で開始すると最初の snapshot で解除される", async () => {
    const { session } = createSession();
    const snap = firstSnapshot(
      await session.handle({ type: "new-game", options: { timeOfDay: "night" } })
    );
    expect(snap.timeOfDay).toBe("night");
    expect(snap.unlockedAchievements).toContain("night-wanderer");
  });

  it("既定の新規ゲーム(昼)では解除されない", async () => {
    const { session } = createSession();
    const snap = firstSnapshot(await session.handle({ type: "new-game" }));
    expect(snap.unlockedAchievements).toEqual([]);
  });
});

describe("イベント由来の解除(sub-quest-reported=first-errand)", () => {
  it("report-quest 成功の snapshot で解除される", async () => {
    const { session, store } = createSession();
    const state = createNewGameState();
    state.subQuests = [readyHunt()];
    store.loadResult = { ok: true, state };
    const before = firstSnapshot(await session.handle({ type: "continue" }));
    expect(before.unlockedAchievements).not.toContain("first-errand");

    const snap = firstSnapshot(await session.handle({ type: "report-quest", questId: "pq-0" }));
    expect(snap.unlockedAchievements).toContain("first-errand");
  });

  it("報告が失敗(未達成)ならイベントは積まれず、後続の snapshot でも解除されない", async () => {
    const { session, store } = createSession();
    const state = createNewGameState();
    state.location = { mapId: "field", position: { x: 11, y: 8 }, facing: "down" };
    state.subQuests = [{ ...readyHunt(), progress: 0, count: 3, status: "active" }];
    store.loadResult = { ok: true, state };
    await session.handle({ type: "continue" });

    const failed = await session.handle({ type: "report-quest", questId: "pq-0" });
    expect(failed[0]?.type).toBe("error");

    // 後続操作(移動)の snapshot でも first-errand は解除されない
    const snap = firstSnapshot(await session.handle({ type: "move", direction: "down" }));
    expect(snap.unlockedAchievements).not.toContain("first-errand");
  });
});

describe("宿泊の評価順序(世界変化適用=woven-morning が当該セーブに載る)", () => {
  it("夢の世界変化(weather)承認・適用で解除され、手順5のセーブにそのまま載る", async () => {
    const { session, store } = createAiSession();
    await session.handle({ type: "new-game" });
    // 灯宿オルガ(4,4)の正面(4,5)から話しかけて宿を開き、宿泊する
    const state = session.getState();
    if (state === null) throw new Error("GameState が null");
    state.location = { mapId: "town", position: { x: 4, y: 5 }, facing: "up" };
    await session.handle({ type: "interact" });
    const msgs = await session.handle({ type: "rest" });

    // Mock の正常な夢は weather:fog を承認・適用する → 手順4後・手順5前の評価で解除
    expect(firstSnapshot(msgs).unlockedAchievements).toContain("woven-morning");
    expect(store.saved).toHaveLength(1);
    expect(store.saved[0]?.world.weather).toBe("fog");
    // 解除が当該セーブ(手順5)に載っている(評価がセーブの前=game-design.md「判定・解除フロー」)
    expect(store.saved[0]?.unlockedAchievements).toContain("woven-morning");
  });

  it("夢が失敗(悪意モード=表示系0件)なら世界変化なし=woven-morning は解除されない", async () => {
    const { session, store } = createAiSession({ malicious: true });
    await session.handle({ type: "new-game" });
    const state = session.getState();
    if (state === null) throw new Error("GameState が null");
    state.location = { mapId: "town", position: { x: 4, y: 5 }, facing: "up" };
    await session.handle({ type: "interact" });
    const msgs = await session.handle({ type: "rest" });

    expect(firstSnapshot(msgs).unlockedAchievements).not.toContain("woven-morning");
    expect(store.saved[0]?.unlockedAchievements).not.toContain("woven-morning");
  });
});

describe("旧セーブ互換(unlockedAchievements 欠落のロード)", () => {
  it("永続状態由来の実績はロード後最初の評価(continue の snapshot)で再解除される", async () => {
    // 進行の進んだ状態を組み、unlockedAchievements を欠落させた「旧セーブ」を作る
    const progressed = createNewGameState();
    const stats = statsForLevel(8);
    progressed.player = { level: 8, xp: 0, hp: stats.maxHP, mp: stats.maxMP, gold: 100 };
    progressed.mainQuestStage = "ch2-beyond";
    progressed.equipment = { weapon: "amber-blade", armor: "warded-mail" };
    progressed.narratedEnemies = ["mist-wolf"];
    progressed.gimmicks = [midBossDefeatFlag("failing-spinner")];
    progressed.visitedMaps = [...mapIdSchema.options];
    progressed.npcs.priest.affinity = 85;
    const raw: Record<string, unknown> = structuredClone(progressed);
    delete raw.unlockedAchievements;
    const oldSave = gameStateSchema.parse(raw);
    expect(oldSave.unlockedAchievements).toEqual([]); // default([]) で読めている

    const { session, store } = createSession();
    store.loadResult = { ok: true, state: oldSave };
    const snap = firstSnapshot(await session.handle({ type: "continue" }));

    // 永続状態由来の9件が登録簿の列挙順で再解除される(イベント/時間帯由来の3件は再獲得待ち)
    expect(snap.unlockedAchievements).toEqual([
      "first-mourning",
      "rift-beheld",
      "dream-eater-mourned",
      "beyond-the-dream",
      "spinner-stilled",
      "seasoned-dreamer",
      "traveler-outfitted",
      "dream-atlas",
      "trusted-lantern"
    ]);
  });
});
