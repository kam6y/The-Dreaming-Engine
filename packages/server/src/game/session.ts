import {
  ENEMY_DISPLAY_NAMES,
  GAME_TITLE,
  INN_COST,
  INVENTORY_CAPACITY,
  ITEMS,
  MAPS,
  NPC_DISPLAY_NAMES,
  TOWN_WAKE_POINT,
  addItem,
  applyPartyWipe,
  buyPriceOf,
  countOf,
  createBattle,
  createNewGameState,
  createRng,
  freeSpace,
  interactionTarget,
  isInShopStock,
  lootForChest,
  lootForGather,
  neighbor,
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
  type Direction,
  type EnemySymbolPlacement,
  type GameState,
  type ItemId,
  type LootEntry,
  type MapObject,
  type NpcId,
  type Rng,
  type ServerMessage,
  type SnapshotView,
  type ViewBattle,
  type ViewItemStack
} from "@dreaming-engine/shared";

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
}

type Mode = "exploration" | "battle";

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

  public constructor(deps: GameSessionDeps) {
    this.saveStore = deps.saveStore;
    this.clock = deps.clock ?? Date.now;
    this.defaultSeed = deps.seed;
    this.defaultNoSymbols = deps.noSymbols ?? false;
    this.noSymbols = this.defaultNoSymbols;
    this.rng = createRng(this.defaultSeed ?? 0);
    this.activeSince = this.clock();
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
      case "conversation-choose":
      case "conversation-end":
      case "quest-request":
        // 会話フローの配線は M4-E コミット2 で実装する(コミット1 では未配線のスタブ)
        return this.errorMsgs("not-in-conversation", "今は誰とも言葉を交わしていない。");
    }
  }

  // =========================================================================
  // 新規ゲーム / つづきから
  // =========================================================================

  private newGame(options?: { seed?: number | undefined; noSymbols?: boolean | undefined }): ServerMessage[] {
    const seed = options?.seed ?? this.defaultSeed ?? (this.clock() >>> 0);
    this.noSymbols = options?.noSymbols ?? this.defaultNoSymbols;
    this.rng = createRng(seed);
    this.state = createNewGameState();
    this.resetRuntime();
    this.activeSince = this.clock();
    this.enterCurrentMap();
    // 新規ゲームは既存セーブに触れない(最初の宿泊セーブで自然に上書きされる)
    return [this.snapshotMsg()];
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
    this.activeInteraction = null; // 移動で対話は解除

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

  private battleCommand(command: BattleCommand): ServerMessage[] {
    if (this.state === null) return this.errorMsgs("no-active-game", "まだ物語は始まっていない。");
    if (this.mode !== "battle" || this.battle === null) {
      return this.errorMsgs("invalid-mode", "今は戦っていない。");
    }
    const result = resolveTurn(this.battle, command);
    this.battle = result.state;
    // 勝敗を適用してから(状態を確定してから)スナップショットを組む
    const trailing = this.settleBattleOutcome(result.state, result.events);
    return [{ type: "battle-events", events: result.events }, this.snapshotMsg(), ...trailing];
  }

  private settleBattleOutcome(battle: BattleState, events: readonly BattleEvent[]): ServerMessage[] {
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
        // 撃破したシンボルを除去(再入場でリスポーン)
        if (this.battleSymbolIndex !== null) this.symbols.splice(this.battleSymbolIndex, 1);
        this.endBattle();
        if (overflowed) {
          dialogs.push(this.dialogMsg(null, "戦利品は手に余り、いくらかは夢に溶けて消えた。(持ちきれなかった)"));
        }
        return dialogs;
      }
      case "defeat": {
        // 全滅: ゴールド半減 + HP/MP全回復 + 日送り。宿屋で目覚める(セーブはしない)
        const wipe = applyPartyWipe(toPlayerProgress(battle.player));
        state.player = wipe.progress;
        state.day += 1;
        state.location = {
          mapId: TOWN_WAKE_POINT.mapId,
          position: { ...TOWN_WAKE_POINT.position },
          facing: TOWN_WAKE_POINT.facing
        };
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

  private endBattle(): void {
    this.battle = null;
    this.battleSymbolIndex = null;
    this.mode = "exploration";
    this.activeInteraction = null;
  }

  // =========================================================================
  // 調べる・話す
  // =========================================================================

  private interact(): ServerMessage[] {
    const guard = this.requireExploration();
    if (guard) return guard;
    const state = this.requireState();
    this.activeInteraction = null;

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

  private interactNpc(npcId: NpcId): ServerMessage[] {
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
        // サブクエストの受注・報告は M4(DreamMaster)。M3 はプレースホルダー
        return [this.dialogMsg(NPC_DISPLAY_NAMES.informant, "「……いい話、あるにはあるんだけどね。それはもう少し、夢が深まってからかな」")];
      case "priest":
        // メインクエスト進行は M6。M3 はプレースホルダー
        return [this.dialogMsg(NPC_DISPLAY_NAMES.priest, "「機関は、まだ祈りを聞いています。……あなたのことも、きっと」")];
    }
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
    const wasFree = cost === 0; // 宿泊費不足 → 夢シーンは定型文(M4)
    state.player.gold -= cost;

    // 手順1: HP/MP全回復
    const stats = statsForLevel(state.player.level);
    state.player.hp = stats.maxHP;
    state.player.mp = stats.maxMP;

    // 手順2: 日送り(日次カウンタのリセットは M4 で追加)
    state.day += 1;

    // 手順3: 夢シーン(AI呼び出し。M4で挿入。失敗・宿泊費不足=wasFree は定型文フォールバック・世界変化なし)
    // 手順4: 世界変化(trigger_world_event の承認分)の適用(M4で挿入)

    // 手順5: セーブ(夢・世界変化を含む状態を保存)。AI失敗時もここは必ず成立する
    this.accruePlaytime();
    await this.saveStore.save(state);

    this.activeInteraction = null; // 宿の overlay を閉じる
    const body = wasFree
      ? "「今日はお代はいらないよ。……いい夢を、とは言えないけどね」旅人は泥のように眠り、気づけば朝だった。"
      : "「ゆっくりおやすみ。悪い夢を見たって、朝には湯を沸かしておくからね」旅人は目を閉じ、機関に一日を手渡した。";
    return [this.snapshotMsg(), this.dialogMsg(NPC_DISPLAY_NAMES.innkeeper, body)];
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
