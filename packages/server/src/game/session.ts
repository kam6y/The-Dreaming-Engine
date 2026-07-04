import {
  DREAM_FALLBACK_TEXT,
  ENEMY_DISPLAY_NAMES,
  GAME_TITLE,
  INN_COST,
  INVENTORY_CAPACITY,
  ITEMS,
  MAPS,
  NPC_DISPLAY_NAMES,
  TOWN_WAKE_POINT,
  acceptProposal,
  addItem,
  advanceDay,
  applyPartyWipe,
  buyPriceOf,
  countOf,
  createBattle,
  createNewGameState,
  createRng,
  freeSpace,
  hasNarratedEnemy,
  interactionTarget,
  isInShopStock,
  lootForChest,
  lootForGather,
  neighbor,
  recordHuntKill,
  recordNarratedEnemy,
  removeItem,
  resolveTurn,
  sampleEnemySymbols,
  samePosition,
  sellPriceOf,
  shopStockEntries,
  statsForLevel,
  toPlayerProgress,
  transitionAt,
  tryMove,
  usedSpace,
  xpToNext,
  type ActiveInteraction,
  type BattleCommand,
  type BattleEvent,
  type BattleState,
  type ClientMessage,
  type ConversationAction,
  type Direction,
  type EnemyId,
  type EnemySymbolPlacement,
  type GameState,
  type ItemId,
  type LootEntry,
  type MapObject,
  type NpcId,
  type NpcMemory,
  type PendingProposalView,
  type Rng,
  type ServerMessage,
  type SnapshotView,
  type SubQuest,
  type ViewBattle,
  type ViewItemStack
} from "@dreaming-engine/shared";

import type { AiFlowGatekeeper } from "../ai/flow-control/index.js";
import type { StateChangeEffect } from "../ai/flow-control/turn-executor.js";
import type { AiMode } from "../ai/mode.js";
import type { PersistentStateContext } from "../ai/tool-validation/types.js";
import { DEFAULT_PLAYER_INPUT_MAX_LENGTH, sanitizePlayerInput } from "../ai/input-wall.js";
import { applyStateChangeEffect } from "./ai-effects.js";
import { appendMaskedExchange, maskSummaryForStorage } from "./conversation-memory.js";
import type { SaveStore } from "./save.js";

/**
 * サーバー権威の GameState ストア + 操作リデューサー(1プロセスに1つ)。
 *
 * クライアントの操作イベント(ClientMessage)を受け、shared の純ロジックで決定論的に適用して
 * ServerMessage 列(snapshot / dialog / battle-events / error)を返す。ゲーム状態の正本は
 * ここが保持し、宿泊時にのみ SaveStore で永続化する(ai-integration.md「全体像」/ game-design.md)。
 *
 * FS I/O(save/load)・時刻・乱数シードは注入し、ユニットテストで再現可能にする。
 */

export interface GameSessionDeps {
  saveStore: SaveStore;
  /** 現在時刻(ミリ秒)。既定 Date.now。プレイ時間計測に使う */
  clock?: () => number;
  /** 敵シンボル/戦闘シードの既定シード(GAME_SEED)。new-game の options.seed で上書き可 */
  seed?: number;
  /** 敵シンボルを無効化するか(GAME_NO_SYMBOLS)。new-game の options.noSymbols で上書き可 */
  noSymbols?: boolean;
  /**
   * AIフロー制御ゲートキーパー(会話/夢/戦果/クエスト生成の配線)。
   * 未指定なら AI 機能は無効化され、会話対応 NPC は定型ダイアログ・宿泊は夢シーンなしで進む
   * (M3 互換のフォールバック)。createDefaultSession は resolveAiMode→createDreamMaster→gatekeeper を組む。
   */
  gatekeeper?: AiFlowGatekeeper;
  /** 自由入力の最大文字数(config playerInputMaxLength)。既定 200 */
  playerInputMaxLength?: number;
  /** 機密マスクの env(既定 process.env)。テストで注入可能 */
  maskEnv?: NodeJS.ProcessEnv;
  /**
   * AI モード(resolveAiMode(env) の結果)。既定 mock。
   * new-game の startLevel 加速フラグを **live では無視** するゲートに使う
   * (テスト実行時の進行加速は防御弱体化にあたらない: ai-integration.md「レート・コスト保護」)。
   */
  aiMode?: AiMode;
}

type Mode = "exploration" | "battle";

/** gatekeeper 未注入時(AI 無効)の会話対応 NPC の定型ダイアログ(M3 互換フォールバック) */
const PLACEHOLDER_NPC_LINES: Record<"informant" | "priest", string> = {
  informant: "「……いい話、あるにはあるんだけどね。それはもう少し、夢が深まってからかな」",
  priest: "「機関は、まだ祈りを聞いています。……あなたのことも、きっと」"
};

export class GameSession {
  private readonly saveStore: SaveStore;

  private readonly clock: () => number;

  private readonly defaultSeed: number | undefined;

  private readonly defaultNoSymbols: boolean;

  /** GameState の正本。null = まだゲームが始まっていない */
  private state: GameState | null = null;

  private mode: Mode = "exploration";

  private battle: BattleState | null = null;

  /** 戦闘中の敵シンボルの this.symbols 上のインデックス(勝利で除去する) */
  private battleSymbolIndex: number | null = null;

  /** 現マップの敵シンボル(runtime。マップ入場でサンプリング、再訪でリスポーン) */
  private symbols: EnemySymbolPlacement[] = [];

  /** 今回の訪問で採取済みの採取点 id(マップ離脱でクリア=リスポーン) */
  private readonly gatheredThisVisit = new Set<string>();

  /** 有効な対話(店/宿)。interact で設定、move 等で解除 */
  private activeInteraction: ActiveInteraction | null = null;

  /** 敵シンボル/戦闘シード用の RNG(new-game/continue でシード) */
  private rng: Rng;

  private noSymbols: boolean;

  /** プレイ時間の計測起点(ミリ秒)。state.playtimeSeconds を基点に加算する */
  private activeSince: number;

  /** AIフロー制御(未注入なら null=AI 機能無効) */
  private readonly gatekeeper: AiFlowGatekeeper | null;

  /** 自由入力の最大長(会話 sanitize に使う) */
  private readonly playerInputMaxLength: number;

  /** 機密マスクの env(会話履歴の永続化前マスクに使う) */
  private readonly maskEnv: NodeJS.ProcessEnv;

  /** AI モード(startLevel 加速フラグの live 無効化ゲートに使う) */
  private readonly aiMode: AiMode;

  /** 提案サブクエストの id 採番カウンタ(プロセス内で単調増加。ロード時に既存 id を跨いで補正) */
  private aiQuestSeq = 0;

  public constructor(deps: GameSessionDeps) {
    this.saveStore = deps.saveStore;
    this.clock = deps.clock ?? Date.now;
    this.defaultSeed = deps.seed;
    this.defaultNoSymbols = deps.noSymbols ?? false;
    this.noSymbols = this.defaultNoSymbols;
    this.rng = createRng(this.defaultSeed ?? 0);
    this.activeSince = this.clock();
    this.gatekeeper = deps.gatekeeper ?? null;
    this.playerInputMaxLength = deps.playerInputMaxLength ?? DEFAULT_PLAYER_INPUT_MAX_LENGTH;
    this.maskEnv = deps.maskEnv ?? process.env;
    this.aiMode = deps.aiMode ?? "mock";
  }

  // =========================================================================
  // 接続時: hello(セーブ有無)+ ゲーム進行中なら現スナップショットで再同期
  // =========================================================================

  public async connect(): Promise<ServerMessage[]> {
    const hasSave = await this.saveStore.exists();
    const msgs: ServerMessage[] = [{ type: "hello", title: GAME_TITLE, hasSave }];
    if (this.state !== null) msgs.push(this.snapshotMsg());
    return msgs;
  }

  /** 操作イベントを処理し ServerMessage 列を返す(ping は server.ts が処理する) */
  public async handle(message: ClientMessage): Promise<ServerMessage[]> {
    switch (message.type) {
      case "ping":
        return [];
      case "new-game":
        return this.newGame(message.options);
      case "continue":
        return this.continueGame();
      case "move":
        return this.move(message.direction);
      case "interact":
        return this.interact();
      case "battle-command":
        return this.battleCommand(message.command);
      case "use-item":
        return this.useItem(message.itemId);
      case "discard-item":
        return this.discardItem(message.itemId, message.quantity);
      case "shop-buy":
        return this.shopBuy(message.itemId, message.quantity);
      case "shop-sell":
        return this.shopSell(message.itemId, message.quantity);
      case "rest":
        return this.rest();
      case "conversation-send":
        return this.conversationSend(message.text);
      case "conversation-choose":
        return this.conversationChoose(message.choice);
      case "conversation-end":
        return this.conversationEnd();
      case "quest-request":
        return this.questRequest();
    }
  }

  // =========================================================================
  // 新規ゲーム / つづきから
  // =========================================================================

  private newGame(options?: {
    seed?: number | undefined;
    noSymbols?: boolean | undefined;
    startLevel?: number | undefined;
  }): ServerMessage[] {
    const seed = options?.seed ?? this.defaultSeed ?? (this.clock() >>> 0);
    this.noSymbols = options?.noSymbols ?? this.defaultNoSymbols;
    this.rng = createRng(seed);
    this.state = createNewGameState();
    // テスト加速: startLevel(mock 限定)。live では無視して通常の Lv1 開始を守る
    if (options?.startLevel !== undefined && this.aiMode !== "live") {
      this.applyStartLevel(options.startLevel);
    }
    this.syncQuestSeq();
    this.resetRuntime();
    this.activeSince = this.clock();
    this.enterCurrentMap();
    // 新規ゲームは既存セーブに触れない(最初の宿泊セーブで自然に上書きされる)
    return [this.snapshotMsg()];
  }

  /**
   * テスト加速フラグ: プレイヤーを指定レベルで開始させる(HP/MP は statsForLevel、
   * XP は当該レベル到達直後の 0、ゴールドは初期値のまま)。mock 限定で newGame が呼ぶ。
   */
  private applyStartLevel(startLevel: number): void {
    const state = this.requireState();
    const stats = statsForLevel(startLevel);
    state.player = {
      ...state.player,
      level: startLevel,
      xp: 0,
      hp: stats.maxHP,
      mp: stats.maxMP
    };
  }

  private async continueGame(): Promise<ServerMessage[]> {
    const result = await this.saveStore.load();
    if (!result.ok) {
      if (result.reason === "missing") {
        return this.errorMsgs("no-save", "記録された夢は、まだない。");
      }
      return this.errorMsgs("save-corrupted", "記録が霧に滲んでいる……新しく始めるほかないようだ。");
    }
    this.state = result.state;
    this.syncQuestSeq();
    this.noSymbols = this.defaultNoSymbols;
    this.rng = createRng(this.defaultSeed ?? (this.clock() >>> 0));
    this.resetRuntime();
    this.activeSince = this.clock();
    this.enterCurrentMap();
    return [this.snapshotMsg()];
  }

  private resetRuntime(): void {
    this.mode = "exploration";
    this.battle = null;
    this.battleSymbolIndex = null;
    this.activeInteraction = null;
    this.gatheredThisVisit.clear();
  }

  /** 現在地のマップに入場する: 敵シンボルをサンプリングし、採取状態と対話をリセットする */
  private enterCurrentMap(): void {
    const state = this.requireState();
    this.gatheredThisVisit.clear();
    this.activeInteraction = null;
    const map = MAPS[state.location.mapId];
    const sampled = this.noSymbols ? [] : sampleEnemySymbols(map, this.rng);
    // プレイヤーの現在マスに湧いたシンボルは除去(入場即戦闘を避ける)
    this.symbols = sampled.filter((s) => !samePosition(s.position, state.location.position));
  }

  // =========================================================================
  // 移動
  // =========================================================================

  private move(direction: Direction): ServerMessage[] {
    const guard = this.requireExploration();
    if (guard) return guard;
    const state = this.requireState();

    state.location.facing = direction;
    this.clearInteraction(); // 移動で対話は解除(会話中なら要約せず破棄)

    const map = MAPS[state.location.mapId];
    const target = neighbor(state.location.position, direction);

    // 敵シンボルへの踏み込み = 戦闘開始(移動はしない)
    const symbolIndex = this.symbols.findIndex((s) => samePosition(s.position, target));
    if (symbolIndex >= 0) {
      this.beginBattle(symbolIndex);
      return [this.snapshotMsg()];
    }

    const result = tryMove(map, state.location.position, direction);
    if (result.moved) {
      state.location.position = result.position;
      const transition = transitionAt(map, result.position);
      if (transition) {
        state.location = {
          mapId: transition.to.mapId,
          position: { ...transition.to.position },
          facing: transition.to.facing
        };
        this.enterCurrentMap();
      }
    }
    return [this.snapshotMsg()];
  }

  private beginBattle(symbolIndex: number): void {
    const state = this.requireState();
    const symbol = this.symbols[symbolIndex];
    if (symbol === undefined) return;
    const seed = this.rng.int(0, 0x7fffffff);
    this.battle = createBattle(state.player, symbol.enemyId, seed);
    this.battleSymbolIndex = symbolIndex;
    this.mode = "battle";
    this.activeInteraction = null;
  }

  // =========================================================================
  // 戦闘
  // =========================================================================

  private async battleCommand(command: BattleCommand): Promise<ServerMessage[]> {
    if (this.state === null) return this.errorMsgs("no-active-game", "まだ物語は始まっていない。");
    if (this.mode !== "battle" || this.battle === null) {
      return this.errorMsgs("invalid-mode", "今は戦っていない。");
    }
    const result = resolveTurn(this.battle, command);
    this.battle = result.state;
    // 勝敗を適用してから(状態を確定してから)スナップショットを組む
    const trailing = await this.settleBattleOutcome(result.state, result.events);
    return [{ type: "battle-events", events: result.events }, this.snapshotMsg(), ...trailing];
  }

  private async settleBattleOutcome(
    battle: BattleState,
    events: readonly BattleEvent[]
  ): Promise<ServerMessage[]> {
    const state = this.requireState();
    const dialogs: ServerMessage[] = [];

    switch (battle.outcome) {
      case "ongoing":
        return [];
      case "victory": {
        // 報酬(ゴールド・XP・レベル・HP/MP)は戦闘エンジンが battle.player に反映済み
        state.player = toPlayerProgress(battle.player);
        // ドロップ品をインベントリへ。満杯なら入らない分は破棄(通知)
        const victory = events.find((e) => e.type === "victory");
        const drops = victory && victory.type === "victory" ? victory.drops : [];
        let overflowed = false;
        for (const itemId of drops) {
          const added = addItem(state.inventory, itemId, 1);
          state.inventory = added.inventory;
          if (added.overflow > 0) overflowed = true;
        }
        // hunt 進行: 受注中 hunt サブクエストの対象討伐をカウント
        const enemyId = battle.enemy.enemyId;
        state.subQuests = recordHuntKill(state.subQuests, enemyId);
        // 撃破したシンボルを除去(再入場でリスポーン)
        if (this.battleSymbolIndex !== null) this.symbols.splice(this.battleSymbolIndex, 1);
        this.endBattle();
        if (overflowed) {
          dialogs.push(this.dialogMsg(null, "戦利品は手に余り、いくらかは夢に溶けて消えた。(持ちきれなかった)"));
        }
        // 戦果描写: 初見(未描写)のみ AI ナレーション・既見は定型(いずれも ai-utterance narrate)
        dialogs.push(...(await this.narrateBattle(enemyId)));
        return dialogs;
      }
      case "defeat": {
        // 全滅: ゴールド半減 + HP/MP全回復 + 日送り。宿屋で目覚める(セーブはしない)
        const wipe = applyPartyWipe(toPlayerProgress(battle.player));
        state.player = wipe.progress;
        state.location = {
          mapId: TOWN_WAKE_POINT.mapId,
          position: { ...TOWN_WAKE_POINT.position },
          facing: TOWN_WAKE_POINT.facing
        };
        // 日送り(advanceDay: 日付+1・aiDaily/話題/street_event リセット)+ 縮退解除フック
        this.state = advanceDay(this.requireState());
        this.gatekeeper?.onDayAdvanced();
        this.endBattle();
        this.enterCurrentMap();
        const body =
          wipe.goldLost > 0
            ? `悪夢から覚めた。旅人は灯宿の寝台にいた。……${wipe.goldLost}のゴールドを、夢のどこかに落としてきたらしい。`
            : "悪夢から覚めた。旅人は灯宿の寝台にいた。";
        dialogs.push(this.dialogMsg(null, body));
        return dialogs;
      }
      case "fled":
        // 逃走: シンボルは残す(逃げた敵は消えない)
        this.endBattle();
        return dialogs;
    }
  }

  /** 戦果描写: 初見のみ AI ナレーション、既見は定型(いずれも gatekeeper 経由)。未注入なら何もしない */
  private async narrateBattle(enemyId: EnemyId): Promise<ServerMessage[]> {
    if (this.gatekeeper === null) return [];
    const already = hasNarratedEnemy(this.requireState(), enemyId);
    const result = await this.gatekeeper.battleResult({
      enemyId,
      persistent: this.buildPersistentContext(),
      alreadyNarrated: already
    });
    if (!already) this.state = recordNarratedEnemy(this.requireState(), enemyId);
    return [this.aiUtteranceMsg("narrate", result.displayText)];
  }

  private endBattle(): void {
    this.battle = null;
    this.battleSymbolIndex = null;
    this.mode = "exploration";
    this.activeInteraction = null;
  }

  // =========================================================================
  // 調べる・話す
  // =========================================================================

  private async interact(): Promise<ServerMessage[]> {
    const guard = this.requireExploration();
    if (guard) return guard;
    const state = this.requireState();
    this.clearInteraction();

    const map = MAPS[state.location.mapId];
    const target = interactionTarget(map, state.location.position, state.location.facing);
    if (target === null) {
      return [this.dialogMsg(null, "……この手が触れるものは、何もない。")];
    }
    if (target.kind === "npc") return this.interactNpc(target.npc.id);
    if (target.kind === "object") return this.interactObject(target.object);
    // boss(M6でメインクエストと配線)
    return [this.dialogMsg(null, "重い唸りのような静寂が満ちている。……近づくには、まだ力が足りない。")];
  }

  private async interactNpc(npcId: NpcId): Promise<ServerMessage[]> {
    switch (npcId) {
      case "merchant": {
        this.activeInteraction = {
          kind: "shop",
          npcId: "merchant",
          npcName: NPC_DISPLAY_NAMES.merchant,
          stock: shopStockEntries()
        };
        return [
          this.snapshotMsg(),
          this.dialogMsg(NPC_DISPLAY_NAMES.merchant, "「いらっしゃい。旅の道具は命の続きです。ゆっくり見ておいきなさい」")
        ];
      }
      case "innkeeper": {
        this.activeInteraction = {
          kind: "inn",
          npcId: "innkeeper",
          npcName: NPC_DISPLAY_NAMES.innkeeper,
          costGold: INN_COST
        };
        return [
          this.snapshotMsg(),
          this.dialogMsg(NPC_DISPLAY_NAMES.innkeeper, "「おや、疲れた顔だね。今夜は泊まっておいき。腹が減ってちゃ悪夢も見れやしないよ」")
        ];
      }
      case "informant":
      case "priest": {
        // 会話対応 NPC(情報屋カイ・司祭フィオル)。gatekeeper 注入時は AI 会話を開始する。
        // 未注入(M3 互換)なら定型ダイアログにフォールバックする。
        if (this.gatekeeper === null) {
          return [this.dialogMsg(NPC_DISPLAY_NAMES[npcId], PLACEHOLDER_NPC_LINES[npcId])];
        }
        return this.openConversation(npcId);
      }
    }
  }

  // =========================================================================
  // 会話フロー(AI。gatekeeper 注入時のみ)
  // =========================================================================

  /** NPC へ話しかけて会話を開始する(挨拶=1ターン。クールダウン中は定型挨拶) */
  private async openConversation(npcId: NpcId): Promise<ServerMessage[]> {
    const gk = this.requireGatekeeper();
    const npc = this.requireState().npcs[npcId];
    const result = await gk.openConversation({
      npcId,
      affinityAtOpen: npc.affinity,
      persistent: this.buildPersistentContext(),
      ...(npc.topic.length > 0 ? { topic: npc.topic } : {}),
      ...(npc.memory.summary.length > 0 ? { memorySummary: npc.memory.summary } : {})
    });
    // 挨拶ターンの承認 effect(Mock 通常は +1 好感度)を適用しカウンタを閉じる
    this.applyApprovedEffects(result.approvedEffects);
    this.activeInteraction = this.buildConversationInteraction(npcId);
    return [this.snapshotMsg(), this.aiUtteranceMsg("speak", result.displayText, npcId)];
  }

  /** 自由入力の送信 → NPC 応答。承認 effect を適用し、往復を(マスクして)会話記憶へ記録する */
  private async conversationSend(rawText: string): Promise<ServerMessage[]> {
    const guard = this.requireExploration();
    if (guard) return guard;
    if (this.activeInteraction?.kind !== "conversation") {
      return this.errorMsgs("not-in-conversation", "今は誰とも言葉を交わしていない。");
    }
    const gk = this.requireGatekeeper();
    const npcId = this.activeInteraction.npcId;
    const utterance = sanitizePlayerInput(rawText, this.playerInputMaxLength);
    const npc = this.requireState().npcs[npcId];
    const result = await gk.sendConversation({
      npcId,
      utterance,
      persistent: this.buildPersistentContext(),
      ...(npc.topic.length > 0 ? { topic: npc.topic } : {}),
      ...(npc.memory.summary.length > 0 ? { memorySummary: npc.memory.summary } : {})
    });
    // 承認 effect(give_item/adjust_affinity 等)を GameState へ適用(永続カウンタを閉じる)
    this.applyApprovedEffects(result.approvedEffects);
    // 実ターン(AI 応答)のみ会話記憶へ往復を記録する。プレイヤー入力はマスクして保存(第5層)
    if (result.outcome === "ai") {
      const memory = this.requireState().npcs[npcId].memory;
      const updated = appendMaskedExchange(memory, { player: utterance, npc: result.displayText }, this.maskEnv);
      this.setNpcMemory(npcId, updated);
    }
    this.activeInteraction = this.buildConversationInteraction(npcId);
    return [this.snapshotMsg(), this.aiUtteranceMsg("speak", result.displayText, npcId)];
  }

  /** 提案の受諾/辞退(AI を呼ばないゲーム操作) */
  private conversationChoose(choice: "accept" | "decline"): ServerMessage[] {
    const guard = this.requireExploration();
    if (guard) return guard;
    if (this.activeInteraction?.kind !== "conversation") {
      return this.errorMsgs("not-in-conversation", "今は誰とも言葉を交わしていない。");
    }
    const gk = this.requireGatekeeper();
    const npcId = this.activeInteraction.npcId;
    const session = gk.getSession();
    const proposal = session?.getPendingProposal() ?? null;
    if (proposal === null) {
      this.activeInteraction = this.buildConversationInteraction(npcId);
      return [this.snapshotMsg()];
    }
    if (choice === "decline") {
      session?.clearPendingProposal();
      this.activeInteraction = this.buildConversationInteraction(npcId);
      return [
        this.snapshotMsg(),
        this.dialogMsg(NPC_DISPLAY_NAMES[npcId], "「そうかい。気が向いたら、また声をかけておくれ」")
      ];
    }
    // accept: 受諾して subQuests へ。未受諾提案スロットは常にクリアする
    const state = this.requireState();
    const res = acceptProposal(proposal, state.subQuests);
    session?.clearPendingProposal();
    if (!res.ok) {
      this.activeInteraction = this.buildConversationInteraction(npcId);
      return [
        this.snapshotMsg(),
        this.dialogMsg(NPC_DISPLAY_NAMES[npcId], "「あんたはもう手一杯のようだね。今の依頼を片付けてから、また来ておくれ」")
      ];
    }
    this.state = { ...state, subQuests: res.quests };
    this.activeInteraction = this.buildConversationInteraction(npcId);
    return [
      this.snapshotMsg(),
      this.dialogMsg(NPC_DISPLAY_NAMES[npcId], "「恩に着るよ。……無理だけはしないようにね」")
    ];
  }

  /** 会話終了 → 要約フロー。要約成功時のみ memory を(マスクして)更新し、往復をクリアする */
  private async conversationEnd(): Promise<ServerMessage[]> {
    const guard = this.requireExploration();
    if (guard) return guard;
    if (this.activeInteraction?.kind !== "conversation") {
      return this.errorMsgs("not-in-conversation", "今は誰とも言葉を交わしていない。");
    }
    const gk = this.requireGatekeeper();
    const npcId = this.activeInteraction.npcId;
    const memory = this.requireState().npcs[npcId].memory;
    const result = await gk.summarizeConversation({
      npcId,
      persistent: this.buildPersistentContext(),
      existingSummary: memory.summary,
      exchanges: memory.recentExchanges
    });
    if (result.summaryText !== null) {
      this.setNpcMemory(npcId, {
        summary: maskSummaryForStorage(result.summaryText, this.maskEnv),
        recentExchanges: []
      });
    }
    gk.closeConversation();
    this.activeInteraction = null;
    return [this.snapshotMsg()];
  }

  /** 情報屋への「仕事はある?」→ サブクエスト生成。承認提案は pendingProposal に反映される */
  private async questRequest(): Promise<ServerMessage[]> {
    const guard = this.requireExploration();
    if (guard) return guard;
    if (this.activeInteraction?.kind !== "conversation") {
      return this.errorMsgs("not-in-conversation", "今は誰とも言葉を交わしていない。");
    }
    const npcId = this.activeInteraction.npcId;
    if (npcId !== "informant") {
      return this.errorMsgs("no-quests-here", "その相手に頼める仕事はなさそうだ。");
    }
    const gk = this.requireGatekeeper();
    const topic = this.requireState().npcs.informant.topic;
    const result = await gk.generateQuest({
      npcId,
      persistent: this.buildPersistentContext(),
      ...(topic.length > 0 ? { topic } : {})
    });
    // propose_quest の承認で aiDaily の発行数カウンタを閉じる(提案自体はセッションが保持)
    this.applyApprovedEffects(result.approvedEffects);
    this.advanceQuestSeqIfProposed();
    this.activeInteraction = this.buildConversationInteraction(npcId);
    return [this.snapshotMsg(), this.aiUtteranceMsg("speak", result.displayText, npcId)];
  }

  private interactObject(object: MapObject): ServerMessage[] {
    const state = this.requireState();
    switch (object.kind) {
      case "sign":
        return [this.dialogMsg(null, object.message)];
      case "chest": {
        if (state.gimmicks.includes(object.id)) {
          return [this.dialogMsg(null, "空っぽの箱だ。もう何も残っていない。")];
        }
        return this.collectLoot(lootForChest(object.id), () => {
          state.gimmicks.push(object.id);
        });
      }
      case "gather": {
        if (this.gatheredThisVisit.has(object.id)) {
          return [this.dialogMsg(null, "もう摘み尽くしてしまった。")];
        }
        return this.collectLoot(lootForGather(object.id), () => {
          this.gatheredThisVisit.add(object.id);
        });
      }
    }
  }

  /**
   * マップ上の取得(宝箱・採取)。満杯なら取得せず対象を残す(破棄しない: game-design.md)。
   * markResolved は取得成立時のみ呼ぶ(宝箱=永続開封 / 採取=今回訪問で消費)。
   */
  private collectLoot(contents: readonly LootEntry[], markResolved: () => void): ServerMessage[] {
    const state = this.requireState();
    if (contents.length === 0) {
      markResolved();
      return [this.snapshotMsg(), this.dialogMsg(null, "だが、中には何も残っていなかった。")];
    }
    // 通常アイテムに必要な空き枠(クエスト用アイテムは別枠で常に入る)
    const neededNormal = contents
      .filter((c) => !ITEMS[c.itemId].questItem)
      .reduce((sum, c) => sum + c.count, 0);
    if (freeSpace(state.inventory) < neededNormal) {
      return [this.dialogMsg(null, "持ちきれない。今は手が塞がっている。")];
    }
    const names: string[] = [];
    for (const entry of contents) {
      const added = addItem(state.inventory, entry.itemId, entry.count);
      state.inventory = added.inventory;
      names.push(entry.count > 1 ? `${ITEMS[entry.itemId].name}×${entry.count}` : ITEMS[entry.itemId].name);
    }
    markResolved();
    return [this.snapshotMsg(), this.dialogMsg(null, `${names.join("、")}を手に入れた。`)];
  }

  // =========================================================================
  // アイテム使用・破棄(探索中)
  // =========================================================================

  private useItem(itemId: ItemId): ServerMessage[] {
    const guard = this.requireExploration();
    if (guard) return guard;
    const state = this.requireState();
    if (countOf(state.inventory, itemId) <= 0) return this.errorMsgs("not-owned", "それは持っていない。");
    const effect = ITEMS[itemId].battleEffect;
    if (!effect || effect.kind !== "heal-hp") {
      return this.errorMsgs("unusable-here", "それは今、使っても意味がない。");
    }
    const stats = statsForLevel(state.player.level);
    if (state.player.hp >= stats.maxHP) return this.errorMsgs("hp-full", "これ以上、癒せる傷はない。");
    state.player.hp = Math.min(stats.maxHP, state.player.hp + effect.amount);
    state.inventory = removeItem(state.inventory, itemId, 1).inventory;
    return [this.snapshotMsg(), this.dialogMsg(null, `${ITEMS[itemId].name}を使った。傷が少し癒えた。`)];
  }

  private discardItem(itemId: ItemId, quantity: number): ServerMessage[] {
    const guard = this.requireExploration();
    if (guard) return guard;
    const state = this.requireState();
    if (ITEMS[itemId].questItem) {
      return this.errorMsgs("not-discardable", "それは、手放してはいけない気がする。");
    }
    if (countOf(state.inventory, itemId) < quantity) {
      return this.errorMsgs("not-owned", "そんなには持っていない。");
    }
    state.inventory = removeItem(state.inventory, itemId, quantity).inventory;
    const label = quantity > 1 ? `${ITEMS[itemId].name}×${quantity}` : ITEMS[itemId].name;
    return [this.snapshotMsg(), this.dialogMsg(null, `${label}を手放した。`)];
  }

  // =========================================================================
  // 店(購入・売却)
  // =========================================================================

  private shopBuy(itemId: ItemId, quantity: number): ServerMessage[] {
    const guard = this.requireExploration();
    if (guard) return guard;
    const state = this.requireState();
    if (this.activeInteraction?.kind !== "shop") return this.errorMsgs("not-in-shop", "ここには店がない。");
    if (!isInShopStock(itemId)) return this.errorMsgs("not-sold", "それは、この店では扱っていない。");
    const cost = buyPriceOf(itemId) * quantity;
    if (state.player.gold < cost) return this.errorMsgs("not-enough-gold", "持ち合わせが足りない。");
    // 事前に容量チェックし、不足なら購入をブロック(game-design.md「成長・経済」)
    if (freeSpace(state.inventory) < quantity) return this.errorMsgs("inventory-full", "そんなに持ちきれない。");
    state.player.gold -= cost;
    state.inventory = addItem(state.inventory, itemId, quantity).inventory;
    return [this.snapshotMsg()]; // 店は開いたまま
  }

  private shopSell(itemId: ItemId, quantity: number): ServerMessage[] {
    const guard = this.requireExploration();
    if (guard) return guard;
    const state = this.requireState();
    if (this.activeInteraction?.kind !== "shop") return this.errorMsgs("not-in-shop", "ここには店がない。");
    if (ITEMS[itemId].questItem) return this.errorMsgs("not-sellable", "これは、売れるものではない。");
    if (countOf(state.inventory, itemId) < quantity) return this.errorMsgs("not-owned", "そんなには持っていない。");
    const gain = sellPriceOf(itemId) * quantity;
    state.inventory = removeItem(state.inventory, itemId, quantity).inventory;
    state.player.gold += gain;
    return [this.snapshotMsg()];
  }

  // =========================================================================
  // 宿泊(game-design.md「宿泊の処理順序」)
  // =========================================================================

  private async rest(): Promise<ServerMessage[]> {
    const guard = this.requireExploration();
    if (guard) return guard;
    const state = this.requireState();
    if (this.activeInteraction?.kind !== "inn") return this.errorMsgs("not-at-inn", "ここは宿ではない。");

    // 手順0: 宿泊費の徴収(不足でも拒否しない=無料で泊める)
    const cost = state.player.gold >= INN_COST ? INN_COST : 0;
    const wasFree = cost === 0; // 宿泊費不足 → 夢シーンは定型文・世界変化なし(コスト保護)
    state.player.gold -= cost;

    // 手順1: HP/MP全回復
    const stats = statsForLevel(state.player.level);
    state.player.hp = stats.maxHP;
    state.player.mp = stats.maxMP;

    // 手順2: 日送り(日付+1・aiDaily/話題/street_event リセット)
    this.state = advanceDay(this.requireState());
    // 手順2直後: 縮退解除フック(通常縮退のみ解除。セッション上限縮退は残す)
    this.gatekeeper?.onDayAdvanced();

    // 手順3-4: 夢シーン(AI)+ 世界変化 effect の適用。
    // AI 失敗(タイムアウト/表示系0件/悪意)・クールダウン・縮退でもフォールバックで進行し、
    // 世界変化が無いだけでセーブと日送りは必ず成立する。宿泊費不足(wasFree)は AI を呼ばず定型。
    const dreamMsgs: ServerMessage[] = [];
    if (this.gatekeeper !== null) {
      if (wasFree) {
        dreamMsgs.push(this.aiUtteranceMsg("narrate", DREAM_FALLBACK_TEXT));
      } else {
        const result = await this.gatekeeper.dreamScene({
          persistent: this.buildPersistentContext(),
          recentPlay: this.buildRecentPlay(),
          world: this.requireState().world
        });
        // 世界変化(dream_world_events)を GameState へ適用(承認分のみ)
        this.applyApprovedEffects(result.approvedEffects);
        dreamMsgs.push(this.aiUtteranceMsg("narrate", result.displayText));
      }
    }

    // 手順5: セーブ(夢・世界変化を含む状態を保存)。AI 失敗時もここは必ず成立し日付は進む
    this.accruePlaytime();
    await this.saveStore.save(this.requireState());

    this.activeInteraction = null; // 宿の overlay を閉じる
    const body = wasFree
      ? "「今日はお代はいらないよ。……いい夢を、とは言えないけどね」旅人は泥のように眠り、気づけば朝だった。"
      : "「ゆっくりおやすみ。悪い夢を見たって、朝には湯を沸かしておくからね」旅人は目を閉じ、機関に一日を手渡した。";
    return [this.snapshotMsg(), this.dialogMsg(NPC_DISPLAY_NAMES.innkeeper, body), ...dreamMsgs];
  }

  // =========================================================================
  // プレイ時間
  // =========================================================================

  private currentPlaytimeSeconds(): number {
    if (this.state === null) return 0;
    const delta = Math.max(0, Math.floor((this.clock() - this.activeSince) / 1000));
    return this.state.playtimeSeconds + delta;
  }

  private accruePlaytime(): void {
    if (this.state === null) return;
    this.state.playtimeSeconds = this.currentPlaytimeSeconds();
    this.activeSince = this.clock();
  }

  // =========================================================================
  // ビュー構築・メッセージヘルパー
  // =========================================================================

  private snapshotMsg(): ServerMessage {
    return { type: "snapshot", view: this.buildView() };
  }

  private dialogMsg(speaker: string | null, body: string): ServerMessage {
    return { type: "dialog", speaker, body };
  }

  private errorMsgs(code: string, message: string): ServerMessage[] {
    return [{ type: "error", message, code }];
  }

  // =========================================================================
  // AIフロー配線ヘルパー(gatekeeper 注入時)
  // =========================================================================

  private requireGatekeeper(): AiFlowGatekeeper {
    if (this.gatekeeper === null) {
      throw new Error("AIゲートキーパーが注入されていない(会話フローには必須。内部不変条件違反)");
    }
    return this.gatekeeper;
  }

  /** 検証層/フロー制御へ渡す永続スナップショット(GameState 由来。読み取り専用) */
  private buildPersistentContext(): PersistentStateContext {
    const state = this.requireState();
    return {
      aiDaily: state.aiDaily,
      affinityByNpc: {
        innkeeper: state.npcs.innkeeper.affinity,
        merchant: state.npcs.merchant.affinity,
        informant: state.npcs.informant.affinity,
        priest: state.npcs.priest.affinity
      },
      inventory: state.inventory,
      subQuests: state.subQuests,
      dungeonSymbolCounts: state.world.dungeonSymbolCounts,
      nextQuestId: this.peekQuestId()
    };
  }

  /** 承認済み状態変更 effect を GameState へ適用する(永続カウンタの書き戻しループを閉じる) */
  private applyApprovedEffects(effects: readonly StateChangeEffect[]): void {
    if (effects.length === 0) return;
    let state = this.requireState();
    for (const effect of effects) state = applyStateChangeEffect(state, effect);
    this.state = state;
  }

  /** 1 NPC の会話記憶を差し替える(往復記録・要約更新に使う) */
  private setNpcMemory(npcId: NpcId, memory: NpcMemory): void {
    const state = this.requireState();
    const npcs = { ...state.npcs };
    npcs[npcId] = { ...npcs[npcId], memory };
    this.state = { ...state, npcs };
  }

  /** 会話 ActiveInteraction を組む(pendingProposal と取りうる options を現状から算出) */
  private buildConversationInteraction(npcId: NpcId): ActiveInteraction {
    const proposal = this.gatekeeper?.getSession()?.getPendingProposal() ?? null;
    const options: ConversationAction[] = ["send", "end"];
    if (npcId === "informant") options.push("quest-request");
    if (proposal !== null) options.push("accept", "decline");
    return {
      kind: "conversation",
      npcId,
      npcName: NPC_DISPLAY_NAMES[npcId],
      options,
      ...(proposal !== null ? { pendingProposal: this.pendingProposalView(proposal) } : {})
    };
  }

  /** 提案中サブクエストの表示情報を組む */
  private pendingProposalView(quest: SubQuest): PendingProposalView {
    return {
      type: quest.type,
      title: quest.title,
      description: quest.description,
      count: quest.count,
      rewardGold: quest.rewardGold,
      ...(quest.rewardItemId !== undefined
        ? { rewardItem: { itemId: quest.rewardItemId, name: ITEMS[quest.rewardItemId].name } }
        : {})
    };
  }

  /** 検証済み AI 発話/ナレーションのメッセージを組む */
  private aiUtteranceMsg(channel: "speak" | "narrate", text: string, npcId?: NpcId): ServerMessage {
    return npcId === undefined
      ? { type: "ai-utterance", channel, text }
      : { type: "ai-utterance", channel, npcId, text };
  }

  /** 対話を解除する。会話中なら gatekeeper のセッションも破棄する(要約はしない=歩き去り等) */
  private clearInteraction(): void {
    if (this.activeInteraction?.kind === "conversation") {
      this.gatekeeper?.closeConversation();
    }
    this.activeInteraction = null;
  }

  /** 提案サブクエスト id の次候補(採番は承認確定時に advanceQuestSeqIfProposed で進める) */
  private peekQuestId(): string {
    return `pq-${this.aiQuestSeq}`;
  }

  /** 直近のフローで新規提案が採用されていれば採番カウンタを進める(id 衝突回避) */
  private advanceQuestSeqIfProposed(): void {
    const proposal = this.gatekeeper?.getSession()?.getPendingProposal() ?? null;
    if (proposal !== null && proposal.id === this.peekQuestId()) {
      this.aiQuestSeq += 1;
    }
  }

  /** ロード/新規時に既存 subQuest の pq-<n> id を跨いで採番カウンタを補正する(衝突回避) */
  private syncQuestSeq(): void {
    if (this.state === null) return;
    let max = -1;
    for (const quest of this.state.subQuests) {
      const matched = /^pq-(\d+)$/.exec(quest.id);
      if (matched !== null && matched[1] !== undefined) max = Math.max(max, Number(matched[1]));
    }
    this.aiQuestSeq = max + 1;
  }

  /** 夢シーンの <recent_play> 用の当日サマリ(Live prompt が使う。Mock は内容非依存) */
  private buildRecentPlay(): string {
    const state = this.requireState();
    return `旅人は${Math.max(1, state.day - 1)}日目の探索を終え、灯町の宿で一日を手放した。`;
  }

  private buildView(): SnapshotView {
    const state = this.requireState();
    const stats = statsForLevel(state.player.level);
    const toView = (s: { itemId: ItemId; count: number }): ViewItemStack => ({
      itemId: s.itemId,
      name: ITEMS[s.itemId].name,
      count: s.count,
      questItem: ITEMS[s.itemId].questItem
    });

    const base: SnapshotView = {
      mode: this.mode,
      mainQuestStage: state.mainQuestStage,
      player: {
        level: state.player.level,
        xp: state.player.xp,
        xpToNext: xpToNext(state.player.level),
        hp: state.player.hp,
        maxHp: stats.maxHP,
        mp: state.player.mp,
        maxMp: stats.maxMP,
        gold: state.player.gold
      },
      day: state.day,
      playtimeSeconds: this.currentPlaytimeSeconds(),
      location: {
        mapId: state.location.mapId,
        position: { ...state.location.position },
        facing: state.location.facing
      },
      inventory: state.inventory.items.map(toView),
      questItems: state.inventory.questItems.map(toView),
      inventoryCapacity: INVENTORY_CAPACITY,
      inventoryUsed: usedSpace(state.inventory),
      symbols: this.symbols.map((s) => ({ position: { ...s.position }, enemyId: s.enemyId })),
      resolvedObjectIds: this.resolvedObjectIdsForCurrentMap(),
      subQuests: this.buildSubQuestViews()
    };

    return {
      ...base,
      ...(this.activeInteraction ? { interaction: this.activeInteraction } : {}),
      ...(this.mode === "battle" && this.battle ? { battle: this.buildBattleView(this.battle) } : {})
    };
  }

  private buildBattleView(battle: BattleState): ViewBattle {
    return {
      enemyId: battle.enemy.enemyId,
      enemyName: ENEMY_DISPLAY_NAMES[battle.enemy.enemyId],
      isBoss: battle.isBoss,
      turn: battle.turn,
      outcome: battle.outcome,
      player: {
        level: battle.player.level,
        hp: battle.player.hp,
        maxHp: battle.player.maxHP,
        mp: battle.player.mp,
        maxMp: battle.player.maxMP,
        statuses: battle.player.statuses.map((s) => ({ ...s }))
      },
      enemy: {
        hp: battle.enemy.hp,
        maxHp: battle.enemy.maxHP,
        statuses: battle.enemy.statuses.map((s) => ({ ...s }))
      }
    };
  }

  /** 受注中サブクエストの表示情報(クエストジャーナル)。target は type 別の表示名で解決する */
  private buildSubQuestViews(): SnapshotView["subQuests"] {
    const state = this.requireState();
    return state.subQuests.map((q) => ({
      id: q.id,
      type: q.type,
      targetName: q.type === "hunt" ? ENEMY_DISPLAY_NAMES[q.targetId] : ITEMS[q.targetId].name,
      progress: q.progress,
      count: q.count,
      rewardGold: q.rewardGold,
      ...(q.rewardItemId !== undefined
        ? { rewardItem: { itemId: q.rewardItemId, name: ITEMS[q.rewardItemId].name } }
        : {}),
      title: q.title,
      description: q.description,
      status: q.status
    }));
  }

  /** 現マップで解決/消費済みのオブジェクト id(開封済み宝箱 + 今回訪問の採取済み) */
  private resolvedObjectIdsForCurrentMap(): string[] {
    const state = this.requireState();
    const map = MAPS[state.location.mapId];
    const ids: string[] = [];
    for (const object of map.objects) {
      if (object.kind === "chest" && state.gimmicks.includes(object.id)) ids.push(object.id);
      else if (object.kind === "gather" && this.gatheredThisVisit.has(object.id)) ids.push(object.id);
    }
    return ids;
  }

  // =========================================================================
  // ガード
  // =========================================================================

  /** state 非 null を保証(呼び出し側でガード済みの箇所用。内部不変条件) */
  private requireState(): GameState {
    if (this.state === null) throw new Error("GameState が初期化されていない(内部不変条件違反)");
    return this.state;
  }

  /** 探索中のゲームがあるか。無ければ error 列を返す(呼び出し側は非 null なら早期 return) */
  private requireExploration(): ServerMessage[] | null {
    if (this.state === null) return this.errorMsgs("no-active-game", "まだ物語は始まっていない。");
    if (this.mode !== "exploration") return this.errorMsgs("invalid-mode", "今はそれをする時ではない。");
    return null;
  }

  // --- テスト用アクセサ(読み取り専用スナップショット取得) ---

  /** 現在の権威スナップショットビューを取得する(テスト・デバッグ用) */
  public getView(): SnapshotView | null {
    return this.state === null ? null : this.buildView();
  }

  /** 現在の GameState(セーブ形)を取得する(テスト用。undefined なら未開始) */
  public getState(): GameState | null {
    return this.state;
  }
}
