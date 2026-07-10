import {
  DREAM_FALLBACK_TEXT,
  ENEMY_DISPLAY_NAMES,
  GAME_TITLE,
  INVENTORY_CAPACITY,
  ITEMS,
  MAPS,
  NPC_DISPLAY_NAMES,
  TOWN_WAKE_POINT,
  acceptProposal,
  addItem,
  advanceDay,
  applyPartyWipe,
  bossAt,
  midBossAt,
  isMidBossEnemyId,
  midBossDefeatFlag,
  adjustedSellPrice,
  affinityTier,
  countOf,
  createBattle,
  createNewGameState,
  createRng,
  discountedBuyPrice,
  effectiveStats,
  equipItem,
  freeSpace,
  hasNarratedEnemy,
  innFeeFor,
  interactionTarget,
  isInShopStock,
  isStageAtOrAfter,
  lootForChest,
  lootForGather,
  neighbor,
  recordHuntKill,
  recordNarratedEnemy,
  removeItem,
  resolveTurn,
  sampleEnemySymbols,
  samePosition,
  shopStockEntries,
  statsForLevel,
  toPlayerProgress,
  transitionAt,
  tryMove,
  unequipItem,
  usedSpace,
  xpToNext,
  type ActiveInteraction,
  type BattleCommand,
  type BattleEvent,
  type BattleState,
  type BossMarker,
  type ClientMessage,
  type ConversationAction,
  type Direction,
  type EnemyId,
  type EnemySymbolPlacement,
  type EquipmentItemId,
  type EquipmentSlot,
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
  type ViewEquipmentSlot,
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

/** gatekeeper 未注入時(AI 無効)の情報屋の定型ダイアログ(M3 互換フォールバック) */
const PLACEHOLDER_INFORMANT_LINE =
  "「……いい話、あるにはあるんだけどね。それはもう少し、夢が深まってからかな」";

/** gatekeeper 未注入時(AI 無効)の番人トワの定型ダイアログ(M3 互換フォールバック。world-lore 3.8) */
const PLACEHOLDER_WARDEN_LINE =
  "「唄はね……もう少し、夢が深まってから聞かせよう、とさ」";

/** 店の開店挨拶(店 NPC 別。world-lore 3.3=レンド / 3.7=ガロ の口調)。既存文言はテスト回帰のため不変 */
const SHOP_GREETINGS: Partial<Record<NpcId, string>> = {
  merchant: "「いらっしゃい。旅の道具は命の続きです。ゆっくり見ておいきなさい」",
  artisan: "「売り物は選んで置いてる。安心して買っていけ」"
};

/** 宿の案内挨拶(宿 NPC 別。world-lore 3.2=オルガ / 3.6=イルマ の口調)。既存文言はテスト回帰のため不変 */
const INN_GREETINGS: Partial<Record<NpcId, string>> = {
  innkeeper: "「おや、疲れた顔だね。今夜は泊まっておいき。腹が減ってちゃ悪夢も見れやしないよ」",
  caretaker: "「遠くから来なさったね。今夜の火の番は、わたしがしますよ。ゆっくりお休みなさい」"
};

/**
 * 宿泊完了時の描写(宿 NPC 別。paid=宿代を払った / free=無銭で泊めた)。
 * 夢シーン・世界変化・セーブの機構は灯宿と同一(rest が共通処理)で、ここは締めの台詞だけを差し替える。
 * 既存(灯宿)の文言はテスト回帰のため不変。
 */
const INN_REST_LINES: Partial<Record<NpcId, { paid: string; free: string }>> = {
  innkeeper: {
    paid: "「ゆっくりおやすみ。悪い夢を見たって、朝には湯を沸かしておくからね」旅人は目を閉じ、機関に一日を手渡した。",
    free: "「今日はお代はいらないよ。……いい夢を、とは言えないけどね」旅人は泥のように眠り、気づけば朝だった。"
  },
  caretaker: {
    paid: "「今夜の火の番は、わたしがしますよ。ゆっくりお眠りなさい」旅人は囲炉裏のそばで目を閉じ、機関に一日を手渡した。",
    free: "「お代はいりませんよ。……よい夢を、とは言えませんけれどねえ」旅人は泥のように眠り、気づけば朝だった。"
  }
};

/**
 * 司祭フィオルによるメインクエストの明かし(AI 非依存のスクリプト。game-design.md 74 行:
 * 進行に必須の会話は選択肢=決定論で進める)。arrival で一度だけ提示し rift-revealed へ進める。
 * 文面は world-lore.md 3.5(フィオル)/ 1.2(夢喰い)の典拠に沿う。
 */
const PRIEST_REVEAL_LINES: readonly string[] = [
  "「よく、この灯守堂まで来られました。……あなたの夢には、どこか継ぎ目の匂いがする」",
  "「夢の綻びの源は、裂け目のいちばん奥――『夢喰い』と呼ばれるものに根があります」",
  "「あれは飢えた機関の歯車の成れの果て。悲しむべきは敵ではなく、飢えそのもの。……それでも、止めねばならないのです」"
];

/** rift-revealed 以降に司祭へ話しかけた時の短い激励(gatekeeper 未注入時のスクリプト) */
const PRIEST_ENCOURAGE_LINE =
  "「裂け目の奥へ。……どうか、無事で。祈ることしかできぬ身が、それでも祈っています」";

/** ボス戦ゲート未達(arrival)でボスへ近づいた時のスクリプト(司祭へ誘導) */
const BOSS_GATE_LINE =
  "重い唸りのような静寂が満ちている。……まだ、近づくには早い。まず、灯守堂の司祭に会うべきだ。";

/** 撃破後にボスの在った場所へ近づいた時のスクリプト(再戦不可) */
const BOSS_DEFEATED_LINE = "裂け目の奥は、もう静かだ。飢えは終わり、ただ青灰の凪だけが残っている。";

/** 中ボス撃破後にその場所へ近づいた時のスクリプト(再戦不可。M10) */
const MID_BOSS_DEFEATED_LINE =
  "崩れた織機の残骸が、糸を垂らしたまま動かない。空回りは、もう止まっている。";

// ---------------------------------------------------------------------------
// メインクエスト第2章「灯の還る先」の決定論スクリプト(M18-2)
// 物語的な正: world-lore.md 1.6 / game-design.md「メインクエスト第2章(拡張: M18)」。
// すべて選択肢会話・調べイベントの決定論で運ぶ(AI 非依存。司祭 PRIEST_REVEAL_LINES と同方式)。
// 開示の高度はフック#2(「灯の還る先」が在るという確証)まで。トワ個人の最奥(3.8 の70以上)・
// フック#1(旅人の正体)は匂わせを越えない。トーンは6節の語りのトーンガイドに従う。
// ---------------------------------------------------------------------------

/** 灯還りの坑「導管の間」の調べオブジェクト id(第2章の起点/結び。dungeon4.ts と一致) */
const CONDUIT_OBJECT_ID = "d4-conduit";

/** 【第2章開始】epilogue で導管の間を再訪して調べた時の気づき(ch2-stirring へ) */
const CONDUIT_STIRRING_LINES: readonly string[] = [
  "以前はただ「かすかに温かい」だけだった導管が、脈打っている。ひとつ、またひとつと、闇の奥へ熱を送り出している。",
  "この温もりは、ここで生まれているのではない。どこかへ運ばれ、どこかで受け取られている――そう、確かに感じる。",
  "坑の異変を知る者がいるとすれば、坑口の番人トワだろう。あの唄には、まだ続きがある気がする。"
];

/** ch2-stirring で導管を再び調べた時(段階は進めない=トワの唄待ちへ促す) */
const CONDUIT_AWAIT_SONG_LINE =
  "導管は変わらず脈打ち、遠い彼方へ温もりを送り続けている。この行き先を知るには、まず坑口のトワの唄を聴くべきだ。";

/** 【第2章クリア】ch2-vigil-song でトワの唄を胸に導管の間へ戻った時の結び(ch2-beyond へ+即時セーブ) */
const CONDUIT_BEYOND_LINES: readonly string[] = [
  "トワの唄を胸に導管の前に立つと、脈打つ導管は問いに応えるように、いっそう強く温もりを送り出した。",
  "得られたのは答えではなく、確証だった。灯町も、琥珀郷も、裂け目も、機関が紡ぐ夢のごく一部に過ぎない。",
  "その外に、まだ夢を紡ぐ何かが確かにある。どこへ通じ、その先で誰が夢を見ているのかは、まだわからない。",
  "旅人は予感だけを胸に、導管の間を後にした。灯は、還るべき先へ還っていく。"
];

/** 第2章クリア後(ch2-beyond)に導管を再び調べた時の余韻(段階不変・章は再発しない) */
const CONDUIT_AFTERGLOW_LINE =
  "導管は今も、静かに脈打っている。灯は還るべき先へ還り、その先でなお、誰かが夢を見ている。";

/** ch2-stirring でトワに話しかけた時、唄の続き「灯の還る先」を明かす(ch2-vigil-song へ) */
const WARDEN_VIGIL_SONG_LINES: readonly string[] = [
  "「坑の奥が、脈を打ちはじめた。……あんたも、あれに気づいたんだね」",
  "「なら、誰も歌わなくなった唄の続きを、あんたにだけ聴かせよう。『灯の還る先』――そういう節さ」",
  "「消えた灯は、この郷でも、あの裂け目でもない、どこかへ還る。そこでは今も夢が紡がれている……と、唄はそう伝えている」",
  "「どこの、とは唄わない。誰も知らないからね。あたしはただ、坑の奥のまだ温かいものを、静かに見ているだけ」",
  "「導管の間へお戻り。あの脈動が、唄が本当かどうかを、あんたに答えてくれるはずだよ」"
];

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

  /**
   * ゲーム世代(new-game/continue のたびに +1)。非同期化した会話要約の完了ハンドラが、
   * 立ち去り後にリセット/ロードされた**別のゲーム**の GameState へ誤って書き戻すのを防ぐ印。
   * conversationEnd で控えた世代と、完了時点の世代が一致するときのみ memory を更新する。
   */
  private gameGeneration = 0;

  /**
   * サーバー直列チェーンの外で走る完了ハンドラから、接続中の WS へ自発 push する送信手段。
   * server.ts が WS 接続確立時に注入し、切断時に null へ戻す。未設定(切断中)の push は黙って破棄する
   * (再接続時は connect() の snapshot 再同期が正を配るため、失われても不整合にならない)。
   */
  private pushSender: ((messages: ServerMessage[]) => void) | null = null;

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

  /**
   * 自発 push の送信手段を登録/解除する(server.ts が WS 接続確立時に注入、切断時に null)。
   * 直列チェーンの外(AI 完了ハンドラ)から現接続の socket へ配信するために使う。
   */
  public setPushSender(sender: ((messages: ServerMessage[]) => void) | null): void {
    this.pushSender = sender;
  }

  /**
   * 直列チェーンの外(挨拶生成の完了ハンドラ等)からクライアントへ自発 push する。
   * sender 未設定(切断中)なら黙って破棄する。送信例外は握って無害化する
   * (切断直後の送信等でプロセスを落とさない)。
   */
  private push(messages: ServerMessage[]): void {
    const sender = this.pushSender;
    if (sender === null) return;
    try {
      sender(messages);
    } catch {
      // 送信例外は握って無害化(切断直後の socket へ書いた等)
    }
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
      case "equip":
        return this.equip(message.itemId);
      case "unequip":
        return this.unequip(message.slot);
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
      case "acknowledge-ending":
        return this.acknowledgeEnding();
    }
  }

  // =========================================================================
  // 新規ゲーム / つづきから
  // =========================================================================

  private newGame(options?: {
    seed?: number | undefined;
    noSymbols?: boolean | undefined;
    startLevel?: number | undefined;
    startGold?: number | undefined;
  }): ServerMessage[] {
    const seed = options?.seed ?? this.defaultSeed ?? (this.clock() >>> 0);
    this.noSymbols = options?.noSymbols ?? this.defaultNoSymbols;
    this.rng = createRng(seed);
    this.state = createNewGameState();
    // テスト加速: startLevel / startGold(mock 限定)。live では無視して通常の開始を守る
    if (options?.startLevel !== undefined && this.aiMode !== "live") {
      this.applyStartLevel(options.startLevel);
    }
    if (options?.startGold !== undefined && this.aiMode !== "live") {
      // 装備購入スモーク(M8-4)等の資金確保。startLevel と同じテスト加速の扱い
      this.state.player.gold = options.startGold;
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
    // 新規/ロードで世代を進める。進行中の非同期要約が完了しても、リセット/ロード後の
    // 別ゲームへは書き戻さない(conversationEnd の完了ハンドラが世代不一致で破棄する)。
    // 呼び出し元は newGame / continueGame のみ(いずれも新しいゲーム文脈の確立点)。
    this.gameGeneration += 1;
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

    // ボスマーカーへの踏み込み = ゲート付きボス戦(占有マスなので通常移動はしない)
    const boss = bossAt(map, target);
    if (boss !== null) return this.approachBoss(boss);

    // 中ボスマーカーへの踏み込み = 中ボス戦(占有マス。撃破済みなら定型 dialog。M10)
    const midBoss = midBossAt(map, target);
    if (midBoss !== null) return this.approachMidBoss(midBoss);

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
    this.battle = createBattle(state.player, symbol.enemyId, seed, state.equipment);
    this.battleSymbolIndex = symbolIndex;
    this.mode = "battle";
    this.activeInteraction = null;
  }

  /**
   * ボスマーカーへの接触/interact 時のゲート処理(接触=move も interact も同一経路):
   * - 撃破済み(dream-eater-defeated 以降): 非アクティブ。スクリプト dialog で戻す(再戦不可)
   * - arrival(司祭未面会): ゲートで戻す(スクリプト dialog。司祭へ誘導)
   * - rift-revealed: ボス戦(isBoss)を開始する
   */
  private approachBoss(boss: BossMarker): ServerMessage[] {
    // approachBoss は move からも呼ばれる。クライアントの移動ロック(awaiting)は snapshot/error
    // でのみ解除されるため、ゲート/撃破済みでも snapshot を必ず先に返す(dialog のみだと移動が固まる)。
    if (this.isBossDefeated()) return [this.snapshotMsg(), this.dialogMsg(null, BOSS_DEFEATED_LINE)];
    if (this.requireState().mainQuestStage === "arrival") {
      return [this.snapshotMsg(), this.dialogMsg(null, BOSS_GATE_LINE)];
    }
    this.beginBossBattle(boss.enemyId);
    return [this.snapshotMsg()];
  }

  /**
   * 中ボスマーカーへの接触処理(M10。最終ボスと別枠):
   * - 撃破済み(gimmicks に記録あり): 非アクティブ。定型 dialog で戻す(再戦不可)
   * - 未撃破: 中ボス戦を開始(beginBossBattle と同経路。isBoss=false なのでメインクエスト進行・
   *   エンディングは誘発しない。逃走は敵定義どおり可能)
   * approachBoss と同様、move からの呼び出しで移動ロックが固まらないよう snapshot を必ず先に返す。
   */
  private approachMidBoss(midBoss: BossMarker): ServerMessage[] {
    const state = this.requireState();
    if (state.gimmicks.includes(midBossDefeatFlag(midBoss.enemyId))) {
      return [this.snapshotMsg(), this.dialogMsg(null, MID_BOSS_DEFEATED_LINE)];
    }
    this.beginBossBattle(midBoss.enemyId);
    return [this.snapshotMsg()];
  }

  /** ボス戦を開始する(シンボル由来ではないので battleSymbolIndex は null。isBoss は敵定義由来) */
  private beginBossBattle(enemyId: EnemyId): void {
    const state = this.requireState();
    const seed = this.rng.int(0, 0x7fffffff);
    this.battle = createBattle(state.player, enemyId, seed, state.equipment);
    this.battleSymbolIndex = null;
    this.mode = "battle";
    this.activeInteraction = null;
  }

  /**
   * ボス撃破済みか(dream-eater-defeated 以降。ボスマーカーの非アクティブ判定に使う)。
   * 第2章段階(ch2-*)を epilogue の後ろへ足したため、等値ではなく**順序判定**で
   * 「dream-eater-defeated 以降」を表す(さもないと第2章中にボスマーカーが再活性化する:
   * game-design.md「メインクエスト第2章」実装上の要注意点)。
   */
  private isBossDefeated(): boolean {
    return isStageAtOrAfter(this.requireState().mainQuestStage, "dream-eater-defeated");
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
        // 中ボス撃破: gimmicks に記録(リスポーンなし)。isBoss=false なのでメインクエストは進めない。
        // 永続化は次回セーブ時(宝箱の開封と同じ扱い。game-design.md「敵バリエーション(拡張: M10)」)。
        if (isMidBossEnemyId(enemyId) && !state.gimmicks.includes(midBossDefeatFlag(enemyId))) {
          state.gimmicks.push(midBossDefeatFlag(enemyId));
        }
        this.endBattle();
        if (overflowed) {
          dialogs.push(this.dialogMsg(null, "戦利品は手に余り、いくらかは夢に溶けて消えた。(持ちきれなかった)"));
        }
        // 戦果描写: 初見(未描写)のみ AI ナレーション・既見は定型(いずれも ai-utterance narrate)
        dialogs.push(...(await this.narrateBattle(enemyId)));
        // ボス撃破: メインクエストを dream-eater-defeated へ進めてセーブに永続化する。
        // 以後ボスマーカーは非アクティブ(再戦不可)。リロード(continue)後もこの段階が保たれる。
        // クライアント(M6-B)はこのスナップショット(mode:exploration・dungeon-3・
        // mainQuestStage:dream-eater-defeated)を検出してエンディングへ直行する。
        if (battle.isBoss && !this.isBossDefeated()) {
          this.state = { ...this.requireState(), mainQuestStage: "dream-eater-defeated" };
          this.accruePlaytime();
          await this.saveStore.save(this.requireState());
        }
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
    // boss: メインクエスト段階でゲートし、rift-revealed のみボス戦へ
    return this.approachBoss(target.boss);
  }

  private async interactNpc(npcId: NpcId): Promise<ServerMessage[]> {
    switch (npcId) {
      case "merchant":
      case "artisan":
        // 店(渡り物屋=レンド / 琥珀工房=ガロ)。品揃え・割引は店主の好感度で決まる
        return this.openShop(npcId);
      case "innkeeper":
      case "caretaker":
        // 宿(灯宿=オルガ / 寄り屋=イルマ)。宿代は宿NPC別(innFeeFor)、処理順序は共通(rest)
        return this.openInn(npcId);
      case "informant":
        // 情報屋カイ。gatekeeper 注入時は AI 会話、未注入(M3 互換)なら定型ダイアログ。
        if (this.gatekeeper === null) {
          return [this.dialogMsg(NPC_DISPLAY_NAMES.informant, PLACEHOLDER_INFORMANT_LINE)];
        }
        return this.openConversation("informant");
      case "warden":
        // 番人トワ。第2章 ch2-stirring では唄の続きを決定論スクリプトで明かす。それ以外は従来の会話。
        return this.interactWarden();
      case "priest":
        // 司祭フィオル(メインクエスト進行役)。arrival はスクリプトの明かしで rift-revealed へ。
        return this.interactPriest();
    }
  }

  /**
   * 店を開く(店 NPC 共通=レンド/ガロ)。品揃え(shopStockEntries)と割引は店主の好感度で計算する。
   * 開いている間は好感度が変わらない(adjust_affinity は会話 interaction 中のみ)ため、開店時の値で一貫する。
   */
  private openShop(npcId: NpcId): ServerMessage[] {
    const affinity = this.requireState().npcs[npcId].affinity;
    this.activeInteraction = {
      kind: "shop",
      npcId,
      npcName: NPC_DISPLAY_NAMES[npcId],
      stock: shopStockEntries(npcId, affinity),
      // 売値表示をクライアントがサーバーと同一計算するための店主好感度(M11-3。フィールド名は既存互換)
      merchantAffinity: affinity
    };
    const greeting = SHOP_GREETINGS[npcId] ?? "「……ゆっくり見ておいき」";
    return [this.snapshotMsg(), this.dialogMsg(NPC_DISPLAY_NAMES[npcId], greeting)];
  }

  /**
   * 宿を開く(宿 NPC 共通=オルガ/イルマ)。宿代は宿NPC別(innFeeFor: 灯宿10G・寄り屋5G)。
   * 宿泊の処理順序・無銭時の扱い・夢シーン・セーブは rest が共通に担う。
   */
  private openInn(npcId: NpcId): ServerMessage[] {
    this.activeInteraction = {
      kind: "inn",
      npcId,
      npcName: NPC_DISPLAY_NAMES[npcId],
      costGold: innFeeFor(npcId)
    };
    const greeting = INN_GREETINGS[npcId] ?? "「今夜は、ここでお休みなさい」";
    return [this.snapshotMsg(), this.dialogMsg(NPC_DISPLAY_NAMES[npcId], greeting)];
  }

  /**
   * 司祭フィオルへの interact。メインクエスト進行の要:
   * - arrival: スクリプトの明かし(AI 非依存の dialog 列)を返し mainQuestStage を rift-revealed へ進める(冪等)
   * - rift-revealed 以降: AI 会話(gatekeeper 注入時)/ 未注入なら短い激励スクリプト
   * 進行に必須の会話は AI 生成に依存させない(game-design.md「メインクエスト」)。
   */
  private async interactPriest(): Promise<ServerMessage[]> {
    const state = this.requireState();
    if (state.mainQuestStage === "arrival") {
      // 決定論の進行。スナップショットで新段階(rift-revealed)を先に伝え、明かしの dialog 列を続ける
      this.state = { ...state, mainQuestStage: "rift-revealed" };
      return [
        this.snapshotMsg(),
        ...PRIEST_REVEAL_LINES.map((line) => this.dialogMsg(NPC_DISPLAY_NAMES.priest, line))
      ];
    }
    if (this.gatekeeper === null) {
      return [this.dialogMsg(NPC_DISPLAY_NAMES.priest, PRIEST_ENCOURAGE_LINE)];
    }
    return this.openConversation("priest");
  }

  /**
   * 番人トワへの interact。店・宿は持たず会話のみ(サブクエスト窓口は従来どおりカイのみ)。
   * - ch2-stirring(第2章): 唄の続き「灯の還る先」を決定論スクリプト(AI 非依存)で明かし
   *   mainQuestStage を ch2-vigil-song へ進める。司祭リビールと同じ「snapshot 先出し→dialog 列」方式。
   * - それ以外の段階: 従来どおり(gatekeeper 未注入=定型ダイアログ / 注入=AI 会話)。
   *   進行済み(ch2-vigil-song 以降)でも唄は再発しない=AI 会話へ戻る(章の主線は決定論・深部は好感度会話)。
   */
  private interactWarden(): ServerMessage[] {
    const state = this.requireState();
    if (state.mainQuestStage === "ch2-stirring") {
      // 決定論の進行。スナップショットで新段階(ch2-vigil-song)を先に伝え、唄の続きの dialog 列を続ける
      this.state = { ...state, mainQuestStage: "ch2-vigil-song" };
      return [
        this.snapshotMsg(),
        ...WARDEN_VIGIL_SONG_LINES.map((line) => this.dialogMsg(NPC_DISPLAY_NAMES.warden, line))
      ];
    }
    if (this.gatekeeper === null) {
      return [this.dialogMsg(NPC_DISPLAY_NAMES.warden, PLACEHOLDER_WARDEN_LINE)];
    }
    return this.openConversation("warden");
  }

  // =========================================================================
  // 会話フロー(AI。gatekeeper 注入時のみ)
  // =========================================================================

  /**
   * NPC へ話しかけて会話を開始する(挨拶=1ターン。クールダウン中は定型挨拶)。**2段階化**:
   *
   * - 即時: 会話 interaction を張って snapshot だけ返し、クライアントを会話画面(挨拶待ち表示)へ
   *   即切替える。挨拶生成 AI(live で約10秒)の完了は**待たない**(探索画面での固着を防ぐ)。
   * - 非同期: 挨拶生成の完了ハンドラ(サーバー直列チェーンの外で走る)で、まだ同一 NPC と会話中なら
   *   options/提案を反映して interaction を再構築し、[snapshot, ai-utterance(speak)] を push する。
   *   クールダウン定型挨拶・busy・フォールバックも同経路(displayText を speak として push する契約は共通)。
   *
   * 完了ハンドラは conversationEnd と同流儀で **await を挟まず同期のみ**・例外は握る:
   * - 世代印(gameGeneration)が変わっていたら全破棄(リセット/ロード後の別ゲームを汚さない)
   * - 承認 effect(挨拶ターンの好感度+1等)は AI ターンとして成立=会話が既に閉じられていても適用する
   * - まだ同一 NPC と会話中のときのみ push する(待たずに立ち去っていたら発話は破棄)
   */
  private openConversation(npcId: NpcId): ServerMessage[] {
    const gk = this.requireGatekeeper();
    const npc = this.requireState().npcs[npcId];
    // 完了時にゲームがリセット/ロードされていたら書き戻さないための世代印
    const generation = this.gameGeneration;

    // 挨拶生成 AI は await せずに開始する(話しかけには即応答)。完了ハンドラは同期のみ・例外は握る
    void gk
      .openConversation({
        npcId,
        affinityAtOpen: npc.affinity,
        persistent: this.buildPersistentContext(),
        ...(npc.topic.length > 0 ? { topic: npc.topic } : {}),
        ...(npc.memory.summary.length > 0 ? { memorySummary: npc.memory.summary } : {})
      })
      .then((result) => {
        if (this.gameGeneration !== generation || this.state === null) return; // リセット/ロード後: 破棄
        // 挨拶ターンの承認 effect(Mock 通常は +1 好感度)を適用しカウンタを閉じる(会話終了後でも成立)
        this.applyApprovedEffects(result.approvedEffects);
        // まだ同一 NPC と会話中のときのみ options/提案を反映して再構築し、発話を push する
        if (this.activeInteraction?.kind === "conversation" && this.activeInteraction.npcId === npcId) {
          this.activeInteraction = this.buildConversationInteraction(npcId);
          this.push([this.snapshotMsg(), this.aiUtteranceMsg("speak", result.displayText, npcId)]);
        }
      })
      .catch(() => {
        // 挨拶生成時の例外は握って無害化(unhandled rejection にしない・プロセスを落とさない)
      });

    // 即時: 会話画面へ切替え(挨拶待ち表示)。挨拶は上の完了ハンドラが届き次第 push する
    this.activeInteraction = this.buildConversationInteraction(npcId);
    return [this.snapshotMsg()];
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

  /**
   * 会話終了 → 要約フロー(非同期化)。要約 AI(live で数秒〜数十秒)の完了を**待たず**に
   * 即座に snapshot を返し、クライアントの awaiting をすぐ解除する(立ち去り直後の移動固着を防ぐ)。
   *
   * 要約は fire-and-forget で開始し、完了ハンドラ(サーバーの直列処理チェーンの外で走る)で
   * memory を更新する。ハンドラは **await を挟まず同期のみ** で状態を読み書きし、次の点を守る:
   * - 要約成功(summaryText != null)時のみ、**完了時点の**最新 memory の summary を差し替え、
   *   要約に渡した先頭 N 往復(N=開始時スナップショットの件数)だけを除去する。要約中に積まれた
   *   新しい往復は失わない(通常は空。同一NPC再会話は gatekeeper が要約完了まで待つため実際上0件)
   * - 失敗(summaryText === null)なら memory 不変(既存仕様)
   * - 立ち去り→即タイトル→ロード等でゲームがリセット/ロードされていたら世代印で破棄(別ゲームを汚さない)
   * - 例外は握って無害化(unhandled rejection でプロセスを落とさない)
   */
  private conversationEnd(): ServerMessage[] {
    const guard = this.requireExploration();
    if (guard) return guard;
    if (this.activeInteraction?.kind !== "conversation") {
      return this.errorMsgs("not-in-conversation", "今は誰とも言葉を交わしていない。");
    }
    const gk = this.requireGatekeeper();
    const npcId = this.activeInteraction.npcId;
    const memory = this.requireState().npcs[npcId].memory;
    // 要約入力のスナップショット(配列コピー)。要約に渡す往復数 N を控える
    const exchangesSnapshot = [...memory.recentExchanges];
    const summarizedCount = exchangesSnapshot.length;
    const existingSummary = memory.summary;
    const persistent = this.buildPersistentContext();
    // 完了時にゲームがリセット/ロードされていたら書き戻さないための世代印
    const generation = this.gameGeneration;

    // 要約 AI は await せずに開始する(立ち去りには即応答)。完了ハンドラは同期のみ・例外は握る
    void gk
      .summarizeConversation({ npcId, persistent, existingSummary, exchanges: exchangesSnapshot })
      .then((result) => {
        if (result.summaryText === null) return; // 要約失敗/スキップ: memory 不変
        const state = this.state;
        if (this.gameGeneration !== generation || state === null) return; // リセット/ロード後: 破棄
        const current = state.npcs[npcId].memory;
        this.setNpcMemory(npcId, {
          summary: maskSummaryForStorage(result.summaryText, this.maskEnv),
          // 要約に渡した先頭 N 往復のみ除去(要約中に積まれた新しい往復は残す。通常は空になる)
          recentExchanges: current.recentExchanges.slice(summarizedCount)
        });
      })
      .catch(() => {
        // 要約実行時の例外は握って無害化(プロセスを落とさない・unhandled rejection にしない)
      });

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

  /**
   * エンディング視聴の確認(クライアントがエンディング演出を見せ終えた合図)。
   * dream-eater-defeated → epilogue へ進めてセーブに永続化する。それ以外の段階では冪等に無視する。
   * プレイヤーは動かさない(段階を進めて保存するだけ。M6-B のエンディング契約の締め)。
   */
  private async acknowledgeEnding(): Promise<ServerMessage[]> {
    const guard = this.requireExploration();
    if (guard) return guard;
    const state = this.requireState();
    if (state.mainQuestStage !== "dream-eater-defeated") {
      return [this.snapshotMsg()];
    }
    this.state = { ...state, mainQuestStage: "epilogue" };
    this.accruePlaytime();
    await this.saveStore.save(this.requireState());
    return [this.snapshotMsg()];
  }

  private async interactObject(object: MapObject): Promise<ServerMessage[]> {
    const state = this.requireState();
    switch (object.kind) {
      case "sign":
        // 灯還りの坑「導管の間」の導管は第2章の起点/結び(調べイベント)。それ以外の看板は既存どおり。
        if (object.id === CONDUIT_OBJECT_ID) return this.interactConduit(object.message);
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
   * 導管の間の導管(d4-conduit)を調べた時の第2章進行(決定論。段階で分岐):
   * - epilogue      : 【第2章開始】ch2-stirring へ進め、脈打つ導管への気づきを dialog 列で返す(snapshot 先出し)
   * - ch2-stirring  : トワの唄待ち(段階不変)。トワへ促す1行を返す
   * - ch2-vigil-song: 【第2章クリア】ch2-beyond へ進め、確証の結びを返す+即時セーブ(acknowledgeEnding の先例)
   * - ch2-beyond    : クリア後の余韻1行(段階不変・章は再発しない=BOSS_DEFEATED_LINE と同運用)
   * - それ以前(arrival/rift-revealed/dream-eater-defeated): 既存の定型文(map の message)のまま(第2章は始まらない)
   */
  private async interactConduit(defaultMessage: string): Promise<ServerMessage[]> {
    const state = this.requireState();
    switch (state.mainQuestStage) {
      case "epilogue":
        this.state = { ...state, mainQuestStage: "ch2-stirring" };
        return [
          this.snapshotMsg(),
          ...CONDUIT_STIRRING_LINES.map((line) => this.dialogMsg(null, line))
        ];
      case "ch2-stirring":
        return [this.dialogMsg(null, CONDUIT_AWAIT_SONG_LINE)];
      case "ch2-vigil-song":
        this.state = { ...state, mainQuestStage: "ch2-beyond" };
        // 第2章クリアは即時セーブでフリープレイへ確定する(acknowledgeEnding と同じ締め方)
        this.accruePlaytime();
        await this.saveStore.save(this.requireState());
        return [
          this.snapshotMsg(),
          ...CONDUIT_BEYOND_LINES.map((line) => this.dialogMsg(null, line))
        ];
      case "ch2-beyond":
        return [this.dialogMsg(null, CONDUIT_AFTERGLOW_LINE)];
      default:
        // arrival / rift-revealed / dream-eater-defeated: 既存の定型文のまま(第2章は始まらない)
        return [this.dialogMsg(null, defaultMessage)];
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
    // HP 回復の上限に使うのは maxHP のみ。装備は maxHP に影響しないため基礎値(statsForLevel)で正しい
    // (effectiveStats を使っても maxHP は同値)。
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
  // 装備・解除(探索中。game-design.md「装備(拡張: M8)」)
  // =========================================================================

  /**
   * 装備品をスロットへ装備する(探索中のみ)。shared の純ロジック equipItem を使い、
   * 成功時は inventory/equipment を差し替えてスナップショットを返す。
   * 失敗(未所持)は shopBuy のブロック流儀に合わせて error+code を返す
   * (itemId は zod で装備可能 ID に限定済みなので、失敗は未所持のみ)。
   */
  private equip(itemId: EquipmentItemId): ServerMessage[] {
    const guard = this.requireExploration();
    if (guard) return guard;
    const state = this.requireState();
    const result = equipItem(state.inventory, state.equipment, itemId);
    if (!result.ok) {
      // 装備不可 ID は zod で弾かれるため、ここに来る失敗は未所持のみ
      return this.errorMsgs("not-owned", "それは持っていない。");
    }
    state.inventory = result.inventory;
    state.equipment = result.equipment;
    return [this.snapshotMsg()];
  }

  /**
   * スロットの装備を解除してインベントリへ戻す(探索中のみ)。
   * 失敗は 2 種を区別して error+code を返す:
   * - 空スロット: not-equipped(何も帯びていない)
   * - インベントリ満杯で戻せない: inventory-full(shopBuy と同じ流儀・文言)
   */
  private unequip(slot: EquipmentSlot): ServerMessage[] {
    const guard = this.requireExploration();
    if (guard) return guard;
    const state = this.requireState();
    if (state.equipment[slot] === null) {
      return this.errorMsgs("not-equipped", "そこには、何も帯びていない。");
    }
    const result = unequipItem(state.inventory, state.equipment, slot);
    if (!result.ok) {
      // 空スロットは上で弾いているため、ここに来る失敗は満杯で戻せない場合のみ
      return this.errorMsgs("inventory-full", "そんなに持ちきれない。");
    }
    state.inventory = result.inventory;
    state.equipment = result.equipment;
    return [this.snapshotMsg()];
  }

  // =========================================================================
  // 店(購入・売却)
  // =========================================================================

  private shopBuy(itemId: ItemId, quantity: number): ServerMessage[] {
    const guard = this.requireExploration();
    if (guard) return guard;
    const state = this.requireState();
    if (this.activeInteraction?.kind !== "shop") return this.errorMsgs("not-in-shop", "ここには店がない。");
    // 品揃えはこの店(店主 NPC)のものに限る。表示されていない品(別の店の在庫)は買えない
    if (!isInShopStock(this.activeInteraction.npcId, itemId)) {
      return this.errorMsgs("not-sold", "それは、この店では扱っていない。");
    }
    // 店主(商人)の好感度による段階割引を適用(0-49 は従来価格と完全同値。
    // stock の表示価格と同じ関数・同じ好感度で計算するため、表示と請求は常に一致する)
    const cost = discountedBuyPrice(itemId, state.npcs[this.activeInteraction.npcId].affinity) * quantity;
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
    // 売値の段階増し(信頼のみ+5%。買い戻し増殖防止クランプ込み)。クライアントの売値表示も
    // interaction.merchantAffinity から同じ関数で計算するため、表示と実受取は常に一致する(M11-3)
    const gain =
      adjustedSellPrice(itemId, state.npcs[this.activeInteraction.npcId].affinity) * quantity;
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

    // 宿NPC(灯宿=オルガ / 寄り屋=イルマ)。宿代・締めの台詞は NPC 別、それ以外の処理順序は共通
    const innNpcId = this.activeInteraction.npcId;
    const fee = this.activeInteraction.costGold; // 宿代(innFeeFor: 灯宿10G・寄り屋5G)

    // 手順0: 宿泊費の徴収(不足でも拒否しない=無料で泊める)
    const cost = state.player.gold >= fee ? fee : 0;
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
    // 締めの台詞は宿NPC別(灯宿=オルガ / 寄り屋=イルマ)。夢シーン・世界変化・セーブは上で共通に済ませてある
    // (innNpcId は宿NPC=innkeeper|caretaker のいずれかで必ず lines を持つ。?? は型・スキーマ保険の非空文字列)
    const lines = INN_REST_LINES[innNpcId];
    const body = wasFree
      ? (lines?.free ?? "旅人は泥のように眠り、気づけば朝だった。")
      : (lines?.paid ?? "旅人は目を閉じ、機関に一日を手渡した。");
    return [this.snapshotMsg(), this.dialogMsg(NPC_DISPLAY_NAMES[innNpcId], body), ...dreamMsgs];
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
        priest: state.npcs.priest.affinity,
        caretaker: state.npcs.caretaker.affinity,
        artisan: state.npcs.artisan.affinity,
        warden: state.npcs.warden.affinity
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
      // 関係性の暗示表示用の段階(M11-3)。snapshot 毎に組み直されるため、
      // 会話中の adjust_affinity で段階が変われば表示も追従する(数値は送らない)
      affinityTier: affinityTier(this.requireState().npcs[npcId].affinity),
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
    // 実効ステータス(装備込み)。maxHP/maxMP は装備の影響を受けないため、下の player.maxHp/maxMp は
    // 基礎値(stats)のままで正しい(effectiveStats の maxHP/maxMP と同値。基礎値であることを明示する)。
    const effective = effectiveStats(state.player.level, state.equipment);
    const equipmentSlotView = (slot: EquipmentSlot): ViewEquipmentSlot | null => {
      const id = state.equipment[slot];
      if (id === null) return null;
      const def = ITEMS[id];
      const bonus = slot === "weapon" ? def.atkBonus ?? 0 : def.defBonus ?? 0;
      return { itemId: id, name: def.name, bonus };
    };
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
        gold: state.player.gold,
        equipment: {
          weapon: equipmentSlotView("weapon"),
          armor: equipmentSlotView("armor")
        },
        effectiveAttack: effective.attack,
        effectiveDefense: effective.defense
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
      symbols: this.symbols.map((s) => ({ position: { ...s.position }, enemyId: s.enemyId, facing: s.facing })),
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
    // 中ボス撃破フラグも載せる(クライアントが中ボスマーカーを非表示にするため。M10)
    if (map.midBoss && state.gimmicks.includes(midBossDefeatFlag(map.midBoss.enemyId))) {
      ids.push(midBossDefeatFlag(map.midBoss.enemyId));
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
