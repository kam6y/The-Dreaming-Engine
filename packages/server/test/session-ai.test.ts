import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BATTLE_RESULT_FALLBACK_TEXT,
  DREAM_FALLBACK_TEXT,
  NPC_DISPLAY_NAMES,
  countOf,
  createNewGameState,
  samePosition,
  type Direction,
  type GameState,
  type NpcId,
  type Position,
  type ServerMessage,
  type SnapshotView,
  type SubQuest
} from "@dreaming-engine/shared";
import { afterEach, describe, expect, it } from "vitest";

import { AuditLog } from "../src/ai/audit-log.js";
import { loadAiConfig, type AiConfig, type DeepPartial } from "../src/ai/config.js";
import { MockDreamMaster } from "../src/ai/dream-master/index.js";
import type {
  DreamMaster,
  DreamMasterContext,
  DreamMasterResult,
  RawToolCall
} from "../src/ai/dream-master/index.js";
import { AiFlowGatekeeper, AiTurnExecutor } from "../src/ai/flow-control/index.js";
import { RateLimiter } from "../src/ai/rate-limit.js";
import { FileSaveStore, type LoadResult, type SaveStore } from "../src/game/save.js";
import { GameSession } from "../src/game/session.js";

/**
 * GameState レベルの統合テスト(MockDreamMaster 系で組んだ gatekeeper を注入)。
 *
 * ここが M4-E の「バグの巣」= カウンタ書き戻しループの実証帯:
 * 検証層単体では検証層が手でカウンタを設定するため上限テストが通ってしまう。閉ループは
 * GameSession→applyStateChangeEffect→GameState.aiDaily の往復でのみ証明される。
 */

const META = { mode: "mock" as const, model: "claude-haiku-4-5" };

/** 注入クロックを進める補助(makeAiSession が session ごとに登録する) */
const advanceRegistry = new WeakMap<GameSession, (ms: number) => void>();
function advanceClock(session: GameSession, ms: number): void {
  const fn = advanceRegistry.get(session);
  if (fn === undefined) throw new Error("advance が登録されていない");
  fn(ms);
}

function okResult(
  ctx: DreamMasterContext,
  toolCalls: RawToolCall[],
  text: string | null = null
): DreamMasterResult {
  return { ok: true, flow: ctx.flow, toolCalls, text, meta: META };
}

/** 送信(自由入力あり)時のみ give_item を出す会話 DreamMaster(日次上限ループの検証用) */
class GivingDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    if (ctx.flow === "conversation") {
      const calls: RawToolCall[] = [{ toolName: "speak", rawInput: { text: "「よい旅を、旅人さん」" } }];
      if (ctx.playerUtterance.length > 0) {
        calls.push({ toolName: "give_item", rawInput: { itemId: "potion-small", quantity: 1, reason: "旅の労い" } });
      }
      return Promise.resolve(okResult(ctx, calls));
    }
    if (ctx.flow === "summary") return Promise.resolve(okResult(ctx, [], "旅人と司祭は穏やかに語り合った。"));
    return Promise.resolve(okResult(ctx, [{ toolName: "narrate", rawInput: { text: "静かな夜が更けていく。" } }]));
  }
}

/** 送信時のみ adjust_affinity(+2)を出す会話 DreamMaster(会話内上限ループの検証用) */
class AdjustingDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    if (ctx.flow === "conversation") {
      const calls: RawToolCall[] = [{ toolName: "speak", rawInput: { text: "「……ふむ、なるほど」" } }];
      if (ctx.playerUtterance.length > 0) {
        calls.push({
          toolName: "adjust_affinity",
          rawInput: { npcId: ctx.partnerNpcId, delta: 2, reason: "打ち解けたため" }
        });
      }
      return Promise.resolve(okResult(ctx, calls));
    }
    if (ctx.flow === "summary") return Promise.resolve(okResult(ctx, [], "旅人と語り合った。"));
    return Promise.resolve(okResult(ctx, [{ toolName: "narrate", rawInput: { text: "夜。" } }]));
  }
}

/** run() 呼び出しをフロー別に数える薄いラッパ(初見/既見の AI 呼び出し有無の検証用) */
class CountingDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  public readonly calls: Record<string, number> = {};
  public constructor(private readonly inner: DreamMaster) {}
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    this.calls[ctx.flow] = (this.calls[ctx.flow] ?? 0) + 1;
    return this.inner.run(ctx);
  }
}

/** 要約完了非同期化の検証で使う要約テキスト(マスク後も同一の平文) */
const DEFERRED_SUMMARY_TEXT = "旅人と司祭は静かに語り合った。";

/**
 * 会話は即応答(speak)、要約(summary)は test 側が releaseSummary() を呼ぶまで**保留**する
 * DreamMaster。会話終了の snapshot が要約完了を待たずに返ることの検証に使う。
 */
class DeferredSummaryDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  public summaryStarted = false;
  private resolveSummary: (() => void) | null = null;
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    if (ctx.flow === "summary") {
      this.summaryStarted = true;
      return new Promise<DreamMasterResult>((resolve) => {
        this.resolveSummary = () => resolve(okResult(ctx, [], DEFERRED_SUMMARY_TEXT));
      });
    }
    if (ctx.flow === "conversation") {
      return Promise.resolve(okResult(ctx, [{ toolName: "speak", rawInput: { text: "「……なるほど、旅人さん」" } }]));
    }
    return Promise.resolve(okResult(ctx, [{ toolName: "narrate", rawInput: { text: "夜。" } }]));
  }
  /** 保留中の要約を完了させる */
  public releaseSummary(): void {
    if (this.resolveSummary === null) throw new Error("要約がまだ開始していない");
    this.resolveSummary();
    this.resolveSummary = null;
  }
}

/** 会話は即応答、要約は text=null(出力壁却下 → summaryText null)を返す DreamMaster(要約失敗の検証用) */
class FailingSummaryDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    if (ctx.flow === "summary") return Promise.resolve(okResult(ctx, [])); // text=null → 出力壁却下
    if (ctx.flow === "conversation") {
      return Promise.resolve(okResult(ctx, [{ toolName: "speak", rawInput: { text: "「……はい」" } }]));
    }
    return Promise.resolve(okResult(ctx, [{ toolName: "narrate", rawInput: { text: "夜。" } }]));
  }
}

/** 挨拶(会話 flow)を test 側が releaseGreeting() を呼ぶまで**保留**する DreamMaster。
 *  話しかけの即時応答が挨拶生成を待たずに返ること・完了前の立ち去り/新規ゲームの検証に使う。
 *  挨拶では speak + adjust_affinity(+1)を出し、承認 effect の適用有無を好感度で観測できるようにする。 */
class DeferredGreetingDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;
  private resolveGreeting: (() => void) | null = null;
  private started = false;
  public run(ctx: DreamMasterContext): Promise<DreamMasterResult> {
    if (ctx.flow === "conversation") {
      this.started = true;
      return new Promise<DreamMasterResult>((resolve) => {
        this.resolveGreeting = (): void =>
          resolve(
            okResult(ctx, [
              { toolName: "speak", rawInput: { text: "「よく来たね、旅人さん」" } },
              { toolName: "adjust_affinity", rawInput: { npcId: ctx.partnerNpcId, delta: 1, reason: "挨拶" } }
            ])
          );
      });
    }
    if (ctx.flow === "summary") return Promise.resolve(okResult(ctx, [], "語り合った。"));
    return Promise.resolve(okResult(ctx, [{ toolName: "narrate", rawInput: { text: "夜。" } }]));
  }
  /** 挨拶生成が開始済みか(話しかけで gk.openConversation が走ったか) */
  public get greetingStarted(): boolean {
    return this.started;
  }
  /** 保留中の挨拶生成を完了させる */
  public releaseGreeting(): void {
    if (this.resolveGreeting === null) throw new Error("挨拶がまだ開始していない");
    this.resolveGreeting();
    this.resolveGreeting = null;
  }
}

/** マイクロタスクを十分に流す(非同期要約の完了ハンドラ適用を待つ。gatekeeper.test の tick を踏襲) */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

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

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
});

interface AiSession {
  session: GameSession;
  store: FakeSaveStore;
  dreamMaster: DreamMaster;
  advance: (ms: number) => void;
}

function makeAiSession(opts?: {
  dreamMaster?: (config: AiConfig) => DreamMaster;
  configOverrides?: DeepPartial<AiConfig>;
  seed?: number;
  noSymbols?: boolean;
}): AiSession {
  let now = 0;
  const clock = (): number => now;
  const config = loadAiConfig({ sessionCallLimit: 1000, ...opts?.configOverrides });
  const dir = mkdtempSync(path.join(tmpdir(), "de-audit-"));
  tmpDirs.push(dir);
  const auditLog = new AuditLog({ dir, now: () => new Date(now) });
  const dreamMaster = opts?.dreamMaster ? opts.dreamMaster(config) : new MockDreamMaster(config);
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
    seed: opts?.seed ?? 1,
    noSymbols: opts?.noSymbols ?? true,
    gatekeeper,
    playerInputMaxLength: config.playerInputMaxLength,
    maskEnv: {} as NodeJS.ProcessEnv
  });
  const advance = (ms: number): void => {
    now += ms;
  };
  advanceRegistry.set(session, advance);
  return { session, store, dreamMaster, advance };
}

const NPC_APPROACH: Partial<Record<NpcId, { pos: Position; facing: Direction }>> = {
  innkeeper: { pos: { x: 4, y: 5 }, facing: "up" },
  merchant: { pos: { x: 16, y: 5 }, facing: "up" },
  informant: { pos: { x: 4, y: 9 }, facing: "down" },
  priest: { pos: { x: 16, y: 9 }, facing: "down" }
};

function mustState(session: GameSession): GameState {
  const state = session.getState();
  if (state === null) throw new Error("GameState が null");
  return state;
}

function mustView(session: GameSession): SnapshotView {
  const view = session.getView();
  if (view === null) throw new Error("SnapshotView が null");
  return view;
}

/**
 * 街の対象 NPC の正面へテレポートして話しかける。**即時応答(挨拶待ち snapshot)を返す**。
 * AI 会話 NPC(情報屋/rift-revealed 以降の司祭)の挨拶生成は非同期化されたため、続く送信/依頼が
 * gatekeeper の inFlight に当たらないよう、返す前に tick() で挨拶生成の完了を待つ
 * (クライアントが speak 到着でメニューを活性するのを模す。店/宿/司祭 arrival は即応答なので tick は無害)。
 */
async function talkTo(session: GameSession, npcId: NpcId): Promise<ServerMessage[]> {
  const approach = NPC_APPROACH[npcId];
  if (approach === undefined) throw new Error(`talkTo: ${npcId} は街の対象NPCでない`);
  mustState(session).location = { mapId: "town", position: { ...approach.pos }, facing: approach.facing };
  const msgs = await session.handle({ type: "interact" });
  await tick(); // 非同期の挨拶生成が完了するまで待つ(inFlight を跨ぐ)
  return msgs;
}

function narrations(msgs: ServerMessage[]): string[] {
  return msgs
    .filter((m): m is Extract<ServerMessage, { type: "ai-utterance" }> => m.type === "ai-utterance")
    .filter((m) => m.channel === "narrate")
    .map((m) => m.text);
}

function fieldState(mutate?: (s: GameState) => void): GameState {
  const s = createNewGameState();
  s.location = { mapId: "field", position: { x: 11, y: 8 }, facing: "down" };
  mutate?.(s);
  return s;
}

/** 現マップの先頭シンボルへ踏み込んで戦闘を開始する(session.test の手法を踏襲) */
async function engageBattle(session: GameSession): Promise<void> {
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
  if (spot === undefined) throw new Error("立ち位置がない");
  mustState(session).location.position = { ...spot.stand };
  await session.handle({ type: "move", direction: spot.dir });
  if (mustView(session).mode !== "battle") throw new Error("戦闘が開始しなかった");
}

/** 攻撃で決着まで戦う。最後のメッセージ列を返す */
async function fightToEnd(session: GameSession): Promise<ServerMessage[]> {
  let last: ServerMessage[] = [];
  let rounds = 0;
  while (mustView(session).mode === "battle") {
    last = await session.handle({ type: "battle-command", command: { kind: "attack" } });
    rounds += 1;
    if (rounds > 12) throw new Error("戦闘が終わらない(想定外)");
  }
  return last;
}

function activeHunt(id: string, count: number): SubQuest {
  return {
    type: "hunt",
    targetId: "mist-wolf",
    id,
    count,
    progress: 0,
    rewardGold: 20,
    title: "霧狼狩り",
    description: "忘れ野の霧狼を討つ。",
    status: "active"
  };
}

// ===========================================================================
// 会話: 開始→送信→提案→受諾/辞退/未受諾終了
// ===========================================================================

describe("会話フロー(提案の受諾・辞退・破棄)", () => {
  it("会話 interaction は好感度の段階を含む(初期30=よそよそしい/80=信頼。M11-3)", async () => {
    const { session } = makeAiSession();
    await session.handle({ type: "new-game" });
    await talkTo(session, "informant");
    const view = mustView(session);
    if (view.interaction?.kind !== "conversation") throw new Error("会話 interaction がない");
    expect(view.interaction.affinityTier).toBe("distant"); // 初期好感度30

    // 往復0回の終了は要約をスキップするため、すぐ再会話できる(0往復スキップ)
    await session.handle({ type: "conversation-end" });
    mustState(session).npcs.informant.affinity = 80;
    await talkTo(session, "informant");
    const view2 = mustView(session);
    if (view2.interaction?.kind !== "conversation") throw new Error("会話 interaction がない");
    expect(view2.interaction.affinityTier).toBe("trusted");
  });

  it("情報屋で提案生成→受諾で subQuests へ、pendingProposal クリア・発行カウンタ増加", async () => {
    const { session } = makeAiSession();
    await session.handle({ type: "new-game" });
    await talkTo(session, "informant");

    const afterReq = await session.handle({ type: "quest-request" });
    const reqView = mustView(session);
    if (reqView.interaction?.kind !== "conversation") throw new Error("会話 interaction がない");
    expect(reqView.interaction.pendingProposal).toBeDefined();
    expect(reqView.interaction.pendingProposal?.type).toBe("hunt");
    expect(reqView.interaction.pendingProposal?.count).toBe(3);
    expect(reqView.interaction.options).toContain("accept");
    expect(reqView.interaction.options).toContain("decline");
    expect(afterReq.some((m) => m.type === "ai-utterance")).toBe(true);
    // 提案の発行で日次カウンタが閉じている(書き戻しループ)
    expect(mustState(session).aiDaily.proposeQuestCount).toBe(1);

    await session.handle({ type: "conversation-choose", choice: "accept" });
    const st = mustState(session);
    expect(st.subQuests).toHaveLength(1);
    expect(st.subQuests[0]?.status).toBe("active");
    expect(st.subQuests[0]?.type).toBe("hunt");
    const acceptedView = mustView(session);
    expect(acceptedView.interaction?.kind === "conversation" && acceptedView.interaction.pendingProposal).toBeUndefined();
    expect(acceptedView.subQuests).toHaveLength(1); // クエストジャーナルに反映
  });

  it("辞退で提案は破棄され subQuests は増えない", async () => {
    const { session } = makeAiSession();
    await session.handle({ type: "new-game" });
    await talkTo(session, "informant");
    await session.handle({ type: "quest-request" });
    await session.handle({ type: "conversation-choose", choice: "decline" });
    expect(mustState(session).subQuests).toHaveLength(0);
    const view = mustView(session);
    expect(view.interaction?.kind === "conversation" && view.interaction.pendingProposal).toBeUndefined();
  });

  it("未受諾のまま会話終了すると提案は破棄される", async () => {
    const { session } = makeAiSession();
    await session.handle({ type: "new-game" });
    await talkTo(session, "informant");
    await session.handle({ type: "quest-request" });
    await session.handle({ type: "conversation-end" });
    expect(mustState(session).subQuests).toHaveLength(0);
    expect(mustView(session).interaction).toBeUndefined();
  });
});

// ===========================================================================
// カウンタ書き戻しループ(GameSession 経由での実証)
// ===========================================================================

describe("give_item の日次上限(GameSession 経由の書き戻しループ)", () => {
  it("同一ゲーム内日に give_item ×3 まで通り、4回目は拒否される", async () => {
    const { session } = makeAiSession({
      dreamMaster: () => new GivingDreamMaster(),
      configOverrides: {
        cooldowns: { conversationStartSeconds: 0, dreamSeconds: 0, questGenerationSeconds: 0 }
      }
    });
    await session.handle({ type: "new-game" });
    // 司祭は arrival だとスクリプトの明かしを返す(AI 会話にならない)。rift-revealed 以降で AI 会話
    mustState(session).mainQuestStage = "rift-revealed";
    mustState(session).npcs.priest.affinity = 60; // give_item 解禁(会話開始時点の閾値50以上)
    const before = countOf(mustState(session).inventory, "potion-small");

    // 会話ごとに1回 give(会話内上限1)。送信レート(3秒)を跨ぐためクロックを進める
    for (let i = 1; i <= 3; i += 1) {
      await talkTo(session, "priest");
      advanceClock(session, 3001);
      await session.handle({ type: "conversation-send", text: `贈り物をくれ${i}` });
      await session.handle({ type: "conversation-end" });
    }
    expect(mustState(session).aiDaily.giveItemCount).toBe(3);
    expect(countOf(mustState(session).inventory, "potion-small")).toBe(before + 3);

    // 4回目: 拒否(speak は返るが give は却下 → インベントリ・カウンタ不変)
    await talkTo(session, "priest");
    advanceClock(session, 3001);
    await session.handle({ type: "conversation-send", text: "もうひとつくれ" });
    expect(mustState(session).aiDaily.giveItemCount).toBe(3);
    expect(countOf(mustState(session).inventory, "potion-small")).toBe(before + 3);
  });
});

describe("adjust_affinity の会話内上限(会話内カウンタループ)", () => {
  it("同一会話で adjust ×2 まで通り、3回目は拒否(好感度が動かない)", async () => {
    const { session } = makeAiSession({ dreamMaster: () => new AdjustingDreamMaster() });
    await session.handle({ type: "new-game" });
    // 司祭は rift-revealed 以降で AI 会話になる(arrival はスクリプトの明かし)
    mustState(session).mainQuestStage = "rift-revealed";
    await talkTo(session, "priest"); // 挨拶(調整なし)
    expect(mustState(session).npcs.priest.affinity).toBe(30);

    advanceClock(session, 3001);
    await session.handle({ type: "conversation-send", text: "一つめ" });
    expect(mustState(session).npcs.priest.affinity).toBe(32);

    advanceClock(session, 3001);
    await session.handle({ type: "conversation-send", text: "二つめ" });
    expect(mustState(session).npcs.priest.affinity).toBe(34);

    advanceClock(session, 3001);
    await session.handle({ type: "conversation-send", text: "三つめ" });
    // 3回目の adjust は会話内上限(2)で却下 → 好感度は動かない
    expect(mustState(session).npcs.priest.affinity).toBe(34);
    expect(mustState(session).aiDaily.affinityDeltaByNpc.priest).toBe(4);
  });
});

// ===========================================================================
// 宿泊 → 夢(順序・失敗時のセーブ成立・クールダウン)
// ===========================================================================

describe("宿泊と夢シーン", () => {
  it("夢が失敗(悪意モードで表示系0件)してもセーブは成立し日付は進む(世界変化なし)", async () => {
    const { session, store } = makeAiSession({
      dreamMaster: (config) => new MockDreamMaster(config, { malicious: true })
    });
    await session.handle({ type: "new-game" });
    await talkTo(session, "innkeeper");
    const msgs = await session.handle({ type: "rest" });

    expect(mustState(session).day).toBe(2); // 日送りは必ず成立
    expect(store.saved).toHaveLength(1);
    expect(store.saved[0]?.day).toBe(2);
    expect(mustState(session).world.weather).toBe("clear"); // 悪意 narrate は却下=世界変化なし
    // 夢のナレーションは定型フォールバックで返る
    expect(narrations(msgs)).toContain(DREAM_FALLBACK_TEXT);
  });

  it("正常な夢は世界変化(weather:fog)を適用する", async () => {
    const { session, store } = makeAiSession();
    await session.handle({ type: "new-game" });
    await talkTo(session, "innkeeper");
    const msgs = await session.handle({ type: "rest" });
    expect(mustState(session).world.weather).toBe("fog");
    expect(store.saved[0]?.world.weather).toBe("fog");
    expect(narrations(msgs).some((t) => t !== DREAM_FALLBACK_TEXT)).toBe(true);
  });

  it("夢クールダウン中は宿泊処理は通常・夢は定型・世界変化なし", async () => {
    const { session, store } = makeAiSession(); // dreamSeconds=60(既定)
    await session.handle({ type: "new-game" });
    await talkTo(session, "innkeeper");
    await session.handle({ type: "rest" }); // 1泊目: 夢実行 → fog
    expect(mustState(session).world.weather).toBe("fog");

    // クロックを進めずに再度宿泊 → 夢クールダウン中
    await talkTo(session, "innkeeper");
    const msgs2 = await session.handle({ type: "rest" });
    expect(mustState(session).day).toBe(3); // 宿泊処理は通常(日送り)
    expect(store.saved).toHaveLength(2); // セーブも通常
    expect(narrations(msgs2)).toContain(DREAM_FALLBACK_TEXT); // 夢は定型
    expect(mustState(session).world.weather).toBe("fog"); // 世界変化なし(1泊目の値のまま)
  });
});

// ===========================================================================
// 戦闘勝利: 戦果描写(初見/既見)と hunt 進行
// ===========================================================================

describe("戦闘勝利の戦果描写と hunt 進行", () => {
  it("初見敵は narrate(AI 1回)+ narratedEnemies 記録、hunt 進行も反映", async () => {
    const { session, store, dreamMaster } = makeAiSession({
      dreamMaster: (config) => new CountingDreamMaster(new MockDreamMaster(config)),
      noSymbols: false
    });
    store.loadResult = {
      ok: true,
      state: fieldState((s) => {
        s.subQuests = [activeHunt("pq-9", 2)];
      })
    };
    await session.handle({ type: "continue" });
    await engageBattle(session);
    const msgs = await fightToEnd(session);

    const counting = dreamMaster as CountingDreamMaster;
    expect(counting.calls.battleResult).toBe(1); // 初見のみ AI
    expect(mustState(session).narratedEnemies).toContain("mist-wolf");
    expect(narrations(msgs).some((t) => t.includes("霧狼"))).toBe(true);
    // hunt 進行(受注中 hunt の対象討伐カウント)
    expect(mustState(session).subQuests[0]?.progress).toBe(1);
    expect(mustState(session).subQuests[0]?.status).toBe("active");
  });

  it("既見敵は定型でAIを呼ばない", async () => {
    const { session, store, dreamMaster } = makeAiSession({
      dreamMaster: (config) => new CountingDreamMaster(new MockDreamMaster(config)),
      noSymbols: false
    });
    store.loadResult = {
      ok: true,
      state: fieldState((s) => {
        s.narratedEnemies = ["mist-wolf"];
      })
    };
    await session.handle({ type: "continue" });
    await engageBattle(session);
    const msgs = await fightToEnd(session);

    const counting = dreamMaster as CountingDreamMaster;
    expect(counting.calls.battleResult ?? 0).toBe(0); // AI を呼ばない
    expect(narrations(msgs)).toContain(BATTLE_RESULT_FALLBACK_TEXT); // 定型
  });
});

// ===========================================================================
// セーブ往復(拡張 GameState)+ 会話履歴のマスク済み保存
// ===========================================================================

describe("セーブ往復とマスク", () => {
  it("拡張 GameState(npcs/subQuests/world/narratedEnemies/aiDaily)がセーブ→ロードで保持される", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "de-save-"));
    tmpDirs.push(dir);
    const store = new FileSaveStore(dir);

    const state = createNewGameState();
    state.npcs.priest.affinity = 72;
    state.npcs.priest.memory = {
      summary: "旅人と司祭は幾度も言葉を交わした。",
      recentExchanges: [{ player: "この街のことを教えて", npc: "「灯は揺れている」" }]
    };
    state.subQuests = [activeHunt("pq-3", 2)];
    state.world = { weather: "fog", activeStreetEvents: ["black-cat"], dungeonSymbolCounts: { 1: 5, 2: 4, 3: 3 } };
    state.narratedEnemies = ["mist-wolf", "candle-eater"];
    state.aiDaily = {
      giveItemCount: 2,
      proposeQuestCount: 1,
      rewardItemProposalCount: 1,
      affinityDeltaByNpc: { innkeeper: 0, merchant: 0, informant: 3, priest: 5, caretaker: 0, artisan: 0, warden: 0 }
    };

    await store.save(state);
    const loaded = await store.load();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.state).toEqual(state);
  });

  it("会話履歴のプレイヤー入力はマスクして永続化される(トークン様文字列が平文で残らない)", async () => {
    const fakeToken = "sk-" + "ant-" + "api03-" + "aA0-_".repeat(20);
    const { session, store } = makeAiSession();
    await session.handle({ type: "new-game" });
    mustState(session).mainQuestStage = "rift-revealed"; // 司祭を AI 会話モードへ(arrival はスクリプト)
    await talkTo(session, "priest");
    advanceClock(session, 3001);
    await session.handle({ type: "conversation-send", text: `僕の鍵は${fakeToken}だ` });
    // 会話を閉じずに宿へ移り(記憶は要約されず保持される)、宿泊でセーブする
    await talkTo(session, "innkeeper");
    await session.handle({ type: "rest" });

    const saved = store.saved[0];
    expect(saved).toBeDefined();
    const stored = saved?.npcs.priest.memory.recentExchanges[0]?.player;
    expect(stored).toBeDefined();
    expect(stored).not.toContain(fakeToken);
  });
});

// ===========================================================================
// メインクエスト・司祭(gatekeeper 注入時もスクリプト進行が AI 会話に優先する)
// ===========================================================================

describe("メインクエスト・司祭(スクリプトと AI 会話の併存)", () => {
  it("司祭(arrival)は gatekeeper 注入時もスクリプトで rift-revealed へ進める(AI 会話を開かない)", async () => {
    const { session } = makeAiSession();
    await session.handle({ type: "new-game" });
    const msgs = await talkTo(session, "priest");
    expect(mustState(session).mainQuestStage).toBe("rift-revealed");
    // AI 会話 overlay は開かず、スクリプトの dialog 列で明かす(進行は AI 非依存)
    expect(mustView(session).interaction).toBeUndefined();
    const dialogs = msgs.filter((m) => m.type === "dialog");
    expect(dialogs.length).toBeGreaterThanOrEqual(2);
  });

  it("司祭(rift-revealed 以降)は AI 会話 overlay を開く", async () => {
    const { session } = makeAiSession();
    await session.handle({ type: "new-game" });
    await talkTo(session, "priest"); // arrival → rift-revealed(スクリプト)
    await talkTo(session, "priest"); // 2回目 → AI 会話
    const view = mustView(session);
    expect(view.interaction?.kind).toBe("conversation");
    if (view.interaction?.kind === "conversation") {
      expect(view.interaction.npcId).toBe("priest");
    }
  });
});

// ===========================================================================
// 会話終了の要約非同期化(立ち去り直後の移動固着を防ぐ)
// ===========================================================================

describe("会話終了の要約非同期化", () => {
  /** 司祭(rift-revealed)と AI 会話を開き、1往復送る(memory.recentExchanges が1件になる) */
  async function priestConversationWithOneExchange(session: GameSession): Promise<void> {
    mustState(session).mainQuestStage = "rift-revealed";
    await talkTo(session, "priest"); // 挨拶(0往復)
    advanceClock(session, 3001); // 送信レートを跨ぐ
    await session.handle({ type: "conversation-send", text: "この街のことを教えてくれ" });
  }

  it("会話終了の snapshot は要約完了を待たずに即返る(要約は開始済みだが memory 未更新)", async () => {
    const { session, dreamMaster } = makeAiSession({
      dreamMaster: () => new DeferredSummaryDreamMaster()
    });
    const dm = dreamMaster as DeferredSummaryDreamMaster;
    await session.handle({ type: "new-game" });
    await priestConversationWithOneExchange(session);
    expect(mustState(session).npcs.priest.memory.recentExchanges).toHaveLength(1);

    const msgs = await session.handle({ type: "conversation-end" });

    // 応答は snapshot 1件のみで即返る(要約 AI の完了を待たない)
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.type).toBe("snapshot");
    expect(mustView(session).interaction).toBeUndefined(); // 会話 overlay は閉じた
    // 要約は開始済み(fire-and-forget)だが未完了 → memory はまだ更新されていない
    expect(dm.summaryStarted).toBe(true);
    expect(mustState(session).npcs.priest.memory.summary).toBe("");
    expect(mustState(session).npcs.priest.memory.recentExchanges).toHaveLength(1);
  });

  it("要約完了後に memory が更新される(summary 差し替え + 渡した往復の除去)", async () => {
    const { session, dreamMaster } = makeAiSession({
      dreamMaster: () => new DeferredSummaryDreamMaster()
    });
    const dm = dreamMaster as DeferredSummaryDreamMaster;
    await session.handle({ type: "new-game" });
    await priestConversationWithOneExchange(session);
    await session.handle({ type: "conversation-end" });

    dm.releaseSummary();
    await tick();

    const memory = mustState(session).npcs.priest.memory;
    expect(memory.summary).toContain("語り合った");
    expect(memory.recentExchanges).toHaveLength(0);
  });

  it("[防御的] 要約中に積まれた新しい往復は完了時に失われない(先頭 N 件のみ除去)", async () => {
    // 実際は同一NPC再会話を gatekeeper が要約完了までブロックするため到達しない経路。
    // 完了ハンドラの slice(N) が「渡した先頭 N 件だけを除く」ことを直接検証する防御テスト。
    const { session, dreamMaster } = makeAiSession({
      dreamMaster: () => new DeferredSummaryDreamMaster()
    });
    const dm = dreamMaster as DeferredSummaryDreamMaster;
    await session.handle({ type: "new-game" });
    await priestConversationWithOneExchange(session); // N=1
    await session.handle({ type: "conversation-end" });

    // 要約完了前に新しい往復が memory へ積まれた状況を模擬(直接差し替え)
    const before = mustState(session).npcs.priest.memory;
    const injected = { player: "要約中に届いた発言", npc: "「うむ」" };
    mustState(session).npcs.priest.memory = {
      summary: before.summary,
      recentExchanges: [...before.recentExchanges, injected]
    };

    dm.releaseSummary();
    await tick();

    const memory = mustState(session).npcs.priest.memory;
    expect(memory.summary).toContain("語り合った"); // 要約は反映される
    expect(memory.recentExchanges).toEqual([injected]); // 先頭1件(要約済み)のみ除去、新往復は残る
  });

  it("要約失敗(summaryText null)時は memory 不変", async () => {
    const { session } = makeAiSession({ dreamMaster: () => new FailingSummaryDreamMaster() });
    await session.handle({ type: "new-game" });
    await priestConversationWithOneExchange(session);
    const before = structuredClone(mustState(session).npcs.priest.memory);

    await session.handle({ type: "conversation-end" });
    await tick();

    const memory = mustState(session).npcs.priest.memory;
    expect(memory.summary).toBe(before.summary); // ""(不変)
    expect(memory.recentExchanges).toEqual(before.recentExchanges); // 往復は残る(要約されていない)
  });

  it("0往復(送信なし)で会話終了すると要約 AI を呼ばず memory 不変", async () => {
    const { session, dreamMaster } = makeAiSession({
      dreamMaster: () => new DeferredSummaryDreamMaster()
    });
    const dm = dreamMaster as DeferredSummaryDreamMaster;
    await session.handle({ type: "new-game" });
    mustState(session).mainQuestStage = "rift-revealed";
    await talkTo(session, "priest"); // 挨拶のみ(0往復)

    await session.handle({ type: "conversation-end" });
    await tick();

    expect(dm.summaryStarted).toBe(false); // 要約 AI は呼ばれない(0往復スキップ)
    expect(mustState(session).npcs.priest.memory.summary).toBe("");
    expect(mustState(session).npcs.priest.memory.recentExchanges).toHaveLength(0);
    expect(mustView(session).interaction).toBeUndefined(); // 会話は閉じる
  });

  it("立ち去り→ロードでゲームが替わった後に要約が完了しても別ゲームの memory を汚さない", async () => {
    const { session, store, dreamMaster } = makeAiSession({
      dreamMaster: () => new DeferredSummaryDreamMaster()
    });
    const dm = dreamMaster as DeferredSummaryDreamMaster;
    await session.handle({ type: "new-game" });
    await priestConversationWithOneExchange(session);
    await session.handle({ type: "conversation-end" }); // 要約は保留のまま

    // 別のセーブをロード(ゲーム世代が進む)。ロード先の司祭 memory は既定(空)
    store.loadResult = { ok: true, state: fieldState() };
    await session.handle({ type: "continue" });
    const priestBefore = structuredClone(mustState(session).npcs.priest.memory);

    dm.releaseSummary(); // 前ゲームの要約が今ごろ完了
    await tick();

    const priestAfter = mustState(session).npcs.priest.memory;
    expect(priestAfter).toEqual(priestBefore); // ロード後の memory は書き換わらない
    expect(priestAfter.summary).toBe(""); // 別ゲームに前ゲームの要約は焼き込まれない
  });
});

// ===========================================================================
// 話しかけの2段階化(挨拶生成を待たず会話画面へ切替え、挨拶は届き次第 push)
// ===========================================================================

describe("話しかけの挨拶生成非同期化(会話画面へ即切替え + 挨拶 push)", () => {
  /** 情報屋カイの正面へテレポートする(話しかけの直前状態を作る。arrival ゲート等の無い NPC) */
  function faceInformant(session: GameSession): void {
    const approach = NPC_APPROACH.informant;
    mustState(session).location = { mapId: "town", position: { ...approach.pos }, facing: approach.facing };
  }

  it("話しかけの応答は挨拶生成の完了前に返り、interaction=conversation の snapshot のみを含む(speak なし)", async () => {
    // 挨拶生成を保留する DreamMaster を使い、応答時点で AI が未完了であることを保証する
    const { session, dreamMaster } = makeAiSession({ dreamMaster: () => new DeferredGreetingDreamMaster() });
    const dm = dreamMaster as DeferredGreetingDreamMaster;
    await session.handle({ type: "new-game" });
    faceInformant(session);

    const msgs = await session.handle({ type: "interact" });

    // 応答は snapshot 1件のみ(挨拶=speak は含まない=AI 完了を待たない)
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.type).toBe("snapshot");
    expect(msgs.some((m) => m.type === "ai-utterance")).toBe(false);
    // 会話画面へ即切替わっている(挨拶待ち表示)
    const view = mustView(session);
    expect(view.interaction?.kind).toBe("conversation");
    if (view.interaction?.kind === "conversation") expect(view.interaction.npcId).toBe("informant");
    // 挨拶生成は開始済みだが未完了
    expect(dm.greetingStarted).toBe(true);
  });

  it("挨拶生成の完了後に pushSender へ [snapshot, ai-utterance(speak)] が届く", async () => {
    const { session } = makeAiSession(); // 既定 MockDreamMaster(挨拶で speak を出す)
    await session.handle({ type: "new-game" });
    const pushed: ServerMessage[][] = [];
    session.setPushSender((m) => pushed.push(m));
    faceInformant(session);

    await session.handle({ type: "interact" });
    await tick(); // 挨拶生成の完了ハンドラが走る

    expect(pushed).toHaveLength(1);
    const batch = pushed[0];
    if (batch === undefined) throw new Error("push が届いていない");
    expect(batch[0]?.type).toBe("snapshot");
    const speak = batch.find((m): m is Extract<ServerMessage, { type: "ai-utterance" }> => m.type === "ai-utterance");
    expect(speak).toBeDefined();
    expect(speak?.channel).toBe("speak");
    expect(speak?.npcId).toBe("informant");
    expect((speak?.text.length ?? 0) > 0).toBe(true);
  });

  it("挨拶生成の完了前に会話終了(立ち去り)した場合、speak は push されず承認 effect は適用される", async () => {
    const { session, dreamMaster } = makeAiSession({ dreamMaster: () => new DeferredGreetingDreamMaster() });
    const dm = dreamMaster as DeferredGreetingDreamMaster;
    await session.handle({ type: "new-game" });
    const pushed: ServerMessage[][] = [];
    session.setPushSender((m) => pushed.push(m));
    faceInformant(session);
    const beforeAffinity = mustState(session).npcs.informant.affinity;

    await session.handle({ type: "interact" }); // 挨拶生成は保留中
    expect(dm.greetingStarted).toBe(true);
    // 挨拶到着前に会話終了(0往復なので要約はスキップされる)
    await session.handle({ type: "conversation-end" });
    expect(mustView(session).interaction).toBeUndefined();

    dm.releaseGreeting(); // 挨拶生成が今ごろ完了
    await tick();

    expect(pushed).toHaveLength(0); // 会話は閉じているので speak は push されない(発話は破棄)
    // 承認 effect(挨拶ターンの好感度+1)は AI ターンとして成立し、会話終了後でも適用される
    expect(mustState(session).npcs.informant.affinity).toBe(beforeAffinity + 1);
  });

  it("挨拶生成の完了前に新規ゲームを始めた場合、世代印で push も effect 適用もされない", async () => {
    const { session, dreamMaster } = makeAiSession({ dreamMaster: () => new DeferredGreetingDreamMaster() });
    const dm = dreamMaster as DeferredGreetingDreamMaster;
    await session.handle({ type: "new-game" });
    const pushed: ServerMessage[][] = [];
    session.setPushSender((m) => pushed.push(m));
    faceInformant(session);

    await session.handle({ type: "interact" }); // 挨拶生成は保留中
    expect(dm.greetingStarted).toBe(true);
    // 別ゲームを開始(世代印が進む)
    await session.handle({ type: "new-game" });
    const affinityAfterNew = mustState(session).npcs.informant.affinity;

    dm.releaseGreeting(); // 前ゲームの挨拶が今ごろ完了
    await tick();

    expect(pushed).toHaveLength(0); // 別ゲームへは push しない
    expect(mustState(session).npcs.informant.affinity).toBe(affinityAfterNew); // effect も適用されない
  });

  it("pushSender 未設定(切断中)でも挨拶完了でクラッシュせず、会話は開いたまま", async () => {
    const { session } = makeAiSession(); // pushSender は設定しない
    await session.handle({ type: "new-game" });
    faceInformant(session);

    await session.handle({ type: "interact" });
    await tick(); // 挨拶完了 → push は破棄される(sender 未設定)

    // クラッシュせず(ここまで到達)、会話は開いたまま(挨拶が反映されている)
    expect(mustView(session).interaction?.kind).toBe("conversation");
  });
});

// ===========================================================================
// 番人トワ(第2エリア。M16): 店・宿を持たず会話のみ。サブクエスト窓口はカイのみ
// ===========================================================================

describe("番人トワ(第2エリア)の会話(M16。gatekeeper 注入時)", () => {
  it("トワに話しかけると会話が開き(quest-request なし)、send で Mock の speak が warden として返る", async () => {
    const { session } = makeAiSession();
    await session.handle({ type: "new-game" });
    // 坑口傍 (13,7) から東の warden (14,7) へ話しかける
    mustState(session).location = { mapId: "settlement", position: { x: 13, y: 7 }, facing: "right" };
    await session.handle({ type: "interact" });
    await tick(); // 非同期の挨拶生成の完了を待つ(inFlight を跨ぐ)

    const view = mustView(session);
    if (view.interaction?.kind !== "conversation") throw new Error("conversation interaction が無い");
    expect(view.interaction.npcId).toBe("warden");
    expect(view.interaction.npcName).toBe(NPC_DISPLAY_NAMES.warden);
    // サブクエスト窓口は従来どおりカイのみ=トワには quest-request を付けない
    expect(view.interaction.options).toContain("send");
    expect(view.interaction.options).toContain("end");
    expect(view.interaction.options).not.toContain("quest-request");

    // 汎用会話フローに乗る: send で Mock の定型 speak が warden 名義で返る
    const send = await session.handle({ type: "conversation-send", text: "唄を聞かせて" });
    const speak = send.find(
      (m): m is Extract<ServerMessage, { type: "ai-utterance" }> => m.type === "ai-utterance"
    );
    expect(speak?.channel).toBe("speak");
    expect(speak?.npcId).toBe("warden");
  });

  it("トワへの quest-request は拒否される(サブクエスト窓口はカイのみ)", async () => {
    const { session } = makeAiSession();
    await session.handle({ type: "new-game" });
    mustState(session).location = { mapId: "settlement", position: { x: 13, y: 7 }, facing: "right" };
    await session.handle({ type: "interact" });
    await tick();
    const res = await session.handle({ type: "quest-request" });
    expect(res).toHaveLength(1);
    const msg = res[0];
    expect(msg?.type).toBe("error");
    if (msg?.type === "error") expect(msg.code).toBe("no-quests-here");
  });
});
