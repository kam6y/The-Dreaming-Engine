import Phaser from "phaser";

import {
  ENEMY_DISPLAY_NAMES,
  MAPS,
  NPC_DISPLAY_NAMES,
  samePosition,
  tileTypeAt,
  type ActiveInteraction,
  type Direction,
  type EnemyId,
  type ItemId,
  type MapDefinition,
  type Position,
  type SnapshotView,
  type TileType
} from "@dreaming-engine/shared";

import type { AiUtteranceEvent } from "../net/game-client.js";

import { dequeueDialog, enqueueDialog, hasPendingDialog } from "../dialog-queue.js";
import { getGameClient, type GameClient } from "../net/game-client.js";
import { ConfirmDialog } from "../ui/confirm-dialog.js";
import { ConversationOverlay } from "../ui/conversation-overlay.js";
import { DialogBox } from "../ui/dialog-box.js";
import { DreamOverlay } from "../ui/dream-overlay.js";
import { UI_FONT_FAMILY } from "../ui/font.js";
import { InventoryOverlay } from "../ui/inventory-overlay.js";
import { QuestJournalOverlay } from "../ui/quest-journal-overlay.js";
import { ShopOverlay } from "../ui/shop-overlay.js";

/** タイル1マスのピクセルサイズ(game-design.md「マップ構成」) */
const TILE_SIZE = 32;
/** 1マス移動のスムーズ補間時間(ミリ秒)。仕様にない細部のため裁量値 */
const MOVE_DURATION_MS = 140;

/** プレースホルダータイルの種別別カラー(単色+簡易パターン) */
const TILE_COLORS: Record<TileType, number> = {
  floor: 0x363b46,
  wall: 0x14161c,
  water: 0x24405c,
  road: 0x494235,
  grass: 0x2c3b2e
};

/** NPCのプレースホルダーカラー */
const NPC_COLOR = 0x8fb0d8;
/** オブジェクト種別のプレースホルダーカラー */
const OBJECT_COLORS: Record<string, number> = {
  sign: 0x9a8f76,
  chest: 0xb08d3f,
  gather: 0x6fa06b
};

/** 敵シンボルのプレースホルダーカラー(敵種別。グラフィックはM5) */
const SYMBOL_COLORS: Record<EnemyId, number> = {
  "mist-wolf": 0x9aa7b8,
  "candle-eater": 0xc9a25c,
  "creaking-doll": 0x8a7f8f,
  "dream-eater": 0x5c2431
};

type ConversationInteraction = Extract<ActiveInteraction, { kind: "conversation" }>;

/**
 * 探索シーン(見下ろしグリッド移動)。サーバー正本のスナップショット駆動:
 * - 移動・調べる等の操作は GameClient でサーバーへ送り、snapshot を受けて描画を更新する
 * - マップ遷移・戦闘開始も snapshot(mapId 変化 / mode==="battle")で検知する
 * - dialog はグローバルキュー(dialog-queue)から表示可能なタイミングで順に表示する
 * 描画そのもの(タイル・NPC・シンボル)はプレースホルダーのまま(M5で差し替え)。
 */
export class ExplorationScene extends Phaser.Scene {
  private client!: GameClient;

  /** 直近に処理したスナップショット(描画の正) */
  private snapshot!: SnapshotView;

  private map!: MapDefinition;

  /** 現在描画されているプレイヤーの座標(補間の起点) */
  private renderedPosition: Position = { x: 0, y: 0 };

  private playerSprite!: Phaser.GameObjects.Container;

  private facingDot!: Phaser.GameObjects.Arc;

  /** マップ・キャラ等のワールド描画物(ズームされるカメラで映す) */
  private worldLayer!: Phaser.GameObjects.Container;

  /** HUD・ダイアログ等のUI描画物(等倍の専用カメラで映す) */
  private uiLayer!: Phaser.GameObjects.Container;

  /** 補間移動中(完了までは次の操作を送らない) */
  private moving = false;

  /** サーバー応答(snapshot / dialog / error)待ち */
  private awaiting = false;

  /** シーン遷移(マップ移動・戦闘開始)中 */
  private transitioning = false;

  /** タップ入力(短いkeydown)を取りこぼさないための予約ステップ */
  private pendingStep: Direction | null = null;

  private dialog!: DialogBox;

  /** 宿の確認ダイアログ(表示中は移動・調べるをブロック) */
  private innConfirm: ConfirmDialog | null = null;

  /** 宿の対話を受信済みで、先行ダイアログの表示完了を待っている状態 */
  private pendingInn: { npcName: string; costGold: number } | null = null;

  /** 商店オーバーレイ(interaction===shop の間表示) */
  private shopOverlay: ShopOverlay | null = null;

  /** もちものオーバーレイ(Escで開閉) */
  private inventoryOverlay: InventoryOverlay | null = null;

  /** 会話オーバーレイ(interaction===conversation の間表示) */
  private conversationOverlay: ConversationOverlay | null = null;

  /**
   * 会話 overlay を開く前に届いた ai-utterance(speak)の待避スロット。
   * サーバーは snapshot→utterance の順で送るため通常は overlay 生成後に届くが、
   * 到着順に依存しないよう1件だけ待避し、overlay 生成時に流し込む。
   */
  private stashedSpeak: string | null = null;

  /** 夢シーン演出のオーバーレイ(宿泊後・表示中) */
  private dreamOverlay: DreamOverlay | null = null;

  /**
   * 夢の情景(ai-utterance narrate)の待避スロット。宿屋のおやすみダイアログを
   * 表示し終えてから夢 overlay を開く(pendingInn と同じ「先行ダイアログ待ち」)。
   */
  private pendingDream: string | null = null;

  /** クエストジャーナル(Qで開閉) */
  private questJournal: QuestJournalOverlay | null = null;

  /** オブジェクトの描画物(解決済み反映のため id で引けるようにする) */
  private objectViews = new Map<string, Phaser.GameObjects.Rectangle[]>();

  private symbolViews: Phaser.GameObjects.GameObject[] = [];

  /** 描画済みシンボルのキー(差分がある時だけ再描画する) */
  private symbolsKey = "";

  private hudStatusText!: Phaser.GameObjects.Text;

  private unsubscribes: (() => void)[] = [];

  private keys!: {
    up: Phaser.Input.Keyboard.Key[];
    down: Phaser.Input.Keyboard.Key[];
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
  };

  public constructor() {
    super("exploration");
  }

  public create(): void {
    const client = getGameClient();
    const snapshot = client.lastSnapshot;
    if (snapshot === null) {
      // スナップショット未受信で探索へ来ることはない想定(防御的フォールバック)
      this.scene.start("title");
      return;
    }
    this.client = client;
    this.snapshot = snapshot;
    this.map = MAPS[snapshot.location.mapId];
    this.renderedPosition = { ...snapshot.location.position };
    this.moving = false;
    this.awaiting = false;
    this.transitioning = false;
    this.pendingStep = null;
    this.innConfirm = null;
    this.pendingInn = null;
    this.shopOverlay = null;
    this.inventoryOverlay = null;
    this.conversationOverlay = null;
    this.stashedSpeak = null;
    this.dreamOverlay = null;
    this.pendingDream = null;
    this.questJournal = null;
    this.objectViews.clear();
    this.symbolViews = [];
    this.symbolsKey = "";

    this.cameras.main.setBackgroundColor("#0b0d12");

    this.worldLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0).setDepth(1000);

    this.drawTiles();
    this.drawTransitions();
    this.drawObjects();
    this.drawNpcs();
    this.drawBoss();
    this.updateEnemySymbols();
    this.updateResolvedObjects();
    this.createPlayer();
    this.setupHud();
    this.setupCamera();
    this.setupInput();

    this.dialog = new DialogBox(this, this.uiLayer);

    this.unsubscribes = [
      client.on("snapshot", (view) => {
        this.handleSnapshot(view);
      }),
      // dialog は snapshot を伴わずに来る応答終端でもある(立て札・空振り・満杯など。
      // dialog そのものは main.ts がグローバルキューへ積む)。awaiting は snapshot / dialog /
      // error のいずれかで必ず解除する契約(この変数の定義コメント参照)。dialog-only 応答で
      // awaiting が解除されないと以後 move が送れず「調べた後に移動不能」になるため、ここで解除する
      client.on("dialog", () => {
        this.awaiting = false;
      }),
      client.on("ai-utterance", (utterance) => {
        this.handleAiUtterance(utterance);
      }),
      client.on("server-error", (error) => {
        this.handleServerError(error.message);
      })
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of this.unsubscribes) {
        unsubscribe();
      }
      this.unsubscribes = [];
      this.closeShopOverlay();
      this.closeInventoryOverlay();
      this.closeConversationOverlay();
      this.closeDreamOverlay();
      this.closeQuestJournal();
    });

    this.updateHud();
    this.syncDomState();
    this.cameras.main.fadeIn(200, 11, 13, 18);
  }

  public override update(): void {
    if (this.transitioning) {
      return;
    }

    // グローバルキューのダイアログを表示可能なタイミングで1件ずつ表示する。
    // オーバーレイ表示中は、その通知行へ流す(挨拶・売買/使用の結果)
    if (hasPendingDialog()) {
      if (this.shopOverlay !== null || this.inventoryOverlay !== null) {
        const next = dequeueDialog();
        if (next !== undefined) {
          this.shopOverlay?.showMessage(next.body);
          this.inventoryOverlay?.showMessage(next.body);
        }
      } else if (this.conversationOverlay !== null) {
        // 会話中に届く NPC 台詞(受諾/辞退の確認など、サーバーが dialog で送る定型)は
        // 会話 overlay の発話として流す。地の文(speaker=null)は下部の通知行へ
        const next = dequeueDialog();
        if (next !== undefined) {
          if (next.speaker !== null) {
            this.conversationOverlay.playUtterance(next.body);
          } else {
            this.conversationOverlay.showMessage(next.body);
          }
        }
      } else if (this.dreamOverlay !== null || this.questJournal !== null) {
        // 夢・ジャーナル中はダイアログを保留する(overlay を上書きしない。閉じた後に表示)
      } else if (!this.dialog.isOpen && this.innConfirm === null) {
        const next = dequeueDialog();
        if (next !== undefined) {
          this.dialog.open(next.speaker, next.body);
          this.syncDomState(); // data-dialog=open を反映(snapshot を伴わない開閉のため)
        }
      }
    }

    // 宿の確認は先行ダイアログ(宿屋の主人の挨拶)をすべて表示し終えてから開く
    if (
      this.pendingInn !== null &&
      !this.dialog.isOpen &&
      !hasPendingDialog() &&
      this.innConfirm === null
    ) {
      this.openInnConfirm(this.pendingInn);
    }

    // 夢シーンは宿屋のおやすみダイアログをすべて表示し終えてから開く(先行ダイアログ待ち)
    if (
      this.pendingDream !== null &&
      !this.dialog.isOpen &&
      !hasPendingDialog() &&
      this.dreamOverlay === null &&
      this.conversationOverlay === null &&
      this.shopOverlay === null &&
      this.inventoryOverlay === null &&
      this.questJournal === null
    ) {
      const text = this.pendingDream;
      this.pendingDream = null;
      this.openDreamOverlay(text);
    }

    if (this.moving || this.awaiting) {
      return;
    }
    if (
      this.dialog.isOpen ||
      this.innConfirm !== null ||
      this.pendingInn !== null ||
      this.shopOverlay !== null ||
      this.inventoryOverlay !== null ||
      this.conversationOverlay !== null ||
      this.dreamOverlay !== null ||
      this.questJournal !== null
    ) {
      // ダイアログ・オーバーレイ中に押した移動キーが、閉じた直後の「幽霊移動」に
      // ならないよう破棄する
      this.pendingStep = null;
      return;
    }

    const direction = this.pressedDirection() ?? this.pendingStep;
    this.pendingStep = null;
    if (direction !== null) {
      this.awaiting = this.client.send({ type: "move", direction });
    }
  }

  // ----------------------------------------------------------------------
  // スナップショット・エラーの反映
  // ----------------------------------------------------------------------

  private handleSnapshot(view: SnapshotView): void {
    this.awaiting = false;
    if (this.transitioning) {
      // 遷移中の更新は保存のみ(次のシーンが lastSnapshot から読む)
      this.snapshot = view;
      return;
    }

    // 戦闘開始
    if (view.mode === "battle") {
      this.snapshot = view;
      this.startBattleTransition();
      return;
    }

    // マップ遷移
    if (view.location.mapId !== this.map.id) {
      this.snapshot = view;
      this.startMapTransition();
      return;
    }

    // 同一マップ内の更新
    this.snapshot = view;
    this.applyFacing(view.location.facing);
    if (!samePosition(view.location.position, this.renderedPosition)) {
      this.tweenPlayerTo(view.location.position);
    }
    this.updateEnemySymbols();
    this.updateResolvedObjects();
    this.updateInteraction(view);
    this.shopOverlay?.refresh(view);
    this.inventoryOverlay?.refresh(view);
    this.updateHud();
    this.syncDomState();
  }

  private handleServerError(message: string): void {
    this.awaiting = false;
    // オーバーレイ中の操作エラー(金不足・満杯等)はオーバーレイの通知行へ、
    // それ以外は地の文ダイアログとして表示する
    if (this.shopOverlay !== null) {
      this.shopOverlay.showMessage(message);
      return;
    }
    if (this.inventoryOverlay !== null) {
      this.inventoryOverlay.showMessage(message);
      return;
    }
    if (this.conversationOverlay !== null) {
      this.conversationOverlay.showMessage(message);
      return;
    }
    enqueueDialog({ speaker: null, body: message });
  }

  /** 対話(店/宿/会話)の開始・終了を snapshot の interaction から反映する */
  private updateInteraction(view: SnapshotView): void {
    const interaction = view.interaction;
    if (interaction === undefined) {
      this.pendingInn = null;
      this.closeShopOverlay();
      this.closeConversationOverlay();
      return;
    }
    // conversation(会話): overlay を開き、以後 snapshot 毎に refresh する
    if (interaction.kind === "conversation") {
      this.closeShopOverlay();
      if (this.conversationOverlay === null) {
        this.openConversationOverlay(view, interaction);
      } else {
        this.conversationOverlay.refresh(view);
      }
      return;
    }
    // 以降は shop / inn。会話 overlay が残っていれば閉じる
    this.closeConversationOverlay();
    if (interaction.kind === "inn") {
      if (this.innConfirm === null && this.pendingInn === null) {
        this.pendingInn = { npcName: interaction.npcName, costGold: interaction.costGold };
      }
      return;
    }
    // shop: オーバーレイを開く(開いている間は snapshot 毎に refresh される)
    if (this.shopOverlay === null) {
      this.closeInventoryOverlay();
      this.shopOverlay = new ShopOverlay(this, this.uiLayer, {
        interaction,
        snapshot: view,
        onBuy: (itemId: ItemId) => {
          this.awaiting = this.client.send({ type: "shop-buy", itemId, quantity: 1 });
        },
        onSell: (itemId: ItemId) => {
          this.awaiting = this.client.send({ type: "shop-sell", itemId, quantity: 1 });
        },
        onClose: () => {
          this.closeShopOverlay();
        }
      });
    }
  }

  private closeShopOverlay(): void {
    // サーバー側の interaction は次の move / interact で自然に解除される
    this.shopOverlay?.destroy();
    this.shopOverlay = null;
  }

  private closeInventoryOverlay(): void {
    this.inventoryOverlay?.destroy();
    this.inventoryOverlay = null;
  }

  /** 会話 overlay を開く(interaction===conversation を受けたとき) */
  private openConversationOverlay(view: SnapshotView, interaction: ConversationInteraction): void {
    this.closeInventoryOverlay();
    this.conversationOverlay = new ConversationOverlay(this, this.uiLayer, {
      interaction,
      snapshot: view,
      // 第一声(speak)が snapshot より先に届いていなければ挨拶待ちで開く
      awaitGreeting: this.stashedSpeak === null,
      onSend: (text) => {
        this.client.send({ type: "conversation-send", text });
      },
      onChoose: (choice) => {
        this.client.send({ type: "conversation-choose", choice });
      },
      onQuestRequest: () => {
        this.client.send({ type: "quest-request" });
      },
      onEnd: () => {
        this.closeConversationOverlay();
        this.client.send({ type: "conversation-end" });
      }
    });
    // overlay 生成前に届いていた挨拶(stash)があれば流し込む
    if (this.stashedSpeak !== null) {
      const text = this.stashedSpeak;
      this.stashedSpeak = null;
      this.conversationOverlay.playUtterance(text);
    }
  }

  private closeConversationOverlay(): void {
    // サーバー側の interaction は conversation-end / 次の move・interact で解除される
    this.conversationOverlay?.destroy();
    this.conversationOverlay = null;
    this.stashedSpeak = null;
  }

  /** 夢シーン overlay を開く(宿泊後・先行ダイアログ表示後に update から呼ぶ) */
  private openDreamOverlay(text: string): void {
    this.dreamOverlay = new DreamOverlay(this, this.uiLayer, {
      text,
      onWake: () => {
        this.closeDreamOverlay();
      }
    });
  }

  private closeDreamOverlay(): void {
    this.dreamOverlay?.destroy();
    this.dreamOverlay = null;
  }

  /** クエストジャーナルを開く(Q。他の overlay/ダイアログが無いときのみ) */
  private openQuestJournal(): void {
    if (
      this.transitioning ||
      this.moving ||
      this.awaiting ||
      this.dialog.isOpen ||
      this.innConfirm !== null ||
      this.pendingInn !== null ||
      this.shopOverlay !== null ||
      this.inventoryOverlay !== null ||
      this.conversationOverlay !== null ||
      this.dreamOverlay !== null ||
      this.questJournal !== null
    ) {
      return;
    }
    this.questJournal = new QuestJournalOverlay(this, this.uiLayer, { snapshot: this.snapshot });
  }

  private closeQuestJournal(): void {
    this.questJournal?.destroy();
    this.questJournal = null;
  }

  /**
   * 検証済み AI 発話/ナレーション(ai-utterance)を受ける。
   * - speak: 会話 overlay へ(未生成なら stash して生成時に流し込む)
   * - narrate: 探索で届く narrate は宿泊後の夢の情景。宿屋のおやすみダイアログを
   *   表示し終えてから夢 overlay を開くため、ここでは stash するだけにする
   *   (戦果 narrate は戦闘シーン側が担当するのでここには来ない)
   */
  private handleAiUtterance(utterance: AiUtteranceEvent): void {
    if (utterance.channel === "speak") {
      if (this.conversationOverlay !== null) {
        this.conversationOverlay.playUtterance(utterance.text);
      } else {
        this.stashedSpeak = utterance.text;
      }
      return;
    }
    // narrate(夢): 先行ダイアログの後に開くため待避する(update で開く)
    this.pendingDream = utterance.text;
  }

  /** Esc: もちものオーバーレイの開閉(各オーバーレイ表示中は自身のEscが処理する) */
  private handleEscape(): void {
    if (this.transitioning || this.moving || this.awaiting) {
      return;
    }
    if (this.dialog.isOpen) {
      this.dialog.close();
      this.syncDomState(); // data-dialog=closed を反映
      return;
    }
    // 会話中の Esc は会話を終える(自由入力中は入力欄側が Esc を処理する)
    if (this.conversationOverlay !== null) {
      this.closeConversationOverlay();
      this.client.send({ type: "conversation-end" });
      return;
    }
    // クエストジャーナルは Esc で閉じる
    if (this.questJournal !== null) {
      this.closeQuestJournal();
      return;
    }
    // 夢はスペースで目覚める(Esc は無視する)
    if (this.dreamOverlay !== null) {
      return;
    }
    if (
      this.shopOverlay !== null ||
      this.inventoryOverlay !== null ||
      this.innConfirm !== null ||
      this.pendingInn !== null
    ) {
      return;
    }
    this.inventoryOverlay = new InventoryOverlay(this, this.uiLayer, {
      snapshot: this.snapshot,
      onUse: (itemId: ItemId) => {
        this.awaiting = this.client.send({ type: "use-item", itemId });
      },
      onDiscard: (itemId: ItemId) => {
        this.awaiting = this.client.send({ type: "discard-item", itemId, quantity: 1 });
      },
      onClose: () => {
        this.closeInventoryOverlay();
      }
    });
  }

  private openInnConfirm(inn: { npcName: string; costGold: number }): void {
    this.pendingInn = null;
    this.innConfirm = new ConfirmDialog(this, this.uiLayer, {
      message: `一晩 ${inn.costGold}ゴールド。今夜はここで休むか?\n(休むと、今日までの歩みが機関に記録される)`,
      yesLabel: "泊まる",
      noLabel: "やめる",
      onResult: (yes) => {
        this.innConfirm = null;
        if (yes) {
          this.awaiting = this.client.send({ type: "rest" });
        }
      }
    });
  }

  private tweenPlayerTo(position: Position): void {
    this.moving = true;
    this.renderedPosition = { ...position };
    const { x, y } = this.tileCenter(position);
    this.tweens.add({
      targets: this.playerSprite,
      x,
      y,
      duration: MOVE_DURATION_MS,
      onComplete: () => {
        this.moving = false;
      }
    });
  }

  private startBattleTransition(): void {
    this.transitioning = true;
    this.cameras.main.fadeOut(240, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("battle");
    });
  }

  private startMapTransition(): void {
    this.transitioning = true;
    this.cameras.main.fadeOut(180, 11, 13, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // create() が client.lastSnapshot(遷移後の状態)から組み直す
      this.scene.restart();
    });
  }

  // ----------------------------------------------------------------------
  // 描画(プレースホルダー: 単色+簡易パターン)
  // ----------------------------------------------------------------------

  private drawTiles(): void {
    const graphics = this.add.graphics();
    this.worldLayer.add(graphics);

    for (let y = 0; y < this.map.height; y += 1) {
      for (let x = 0; x < this.map.width; x += 1) {
        const tile = tileTypeAt(this.map, { x, y });
        if (tile === undefined) {
          continue;
        }
        graphics.fillStyle(TILE_COLORS[tile], 1);
        graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // 簡易パターン: 薄いグリッド線で「タイル」であることを示す
    graphics.lineStyle(1, 0x000000, 0.18);
    for (let x = 0; x <= this.map.width; x += 1) {
      graphics.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, this.map.height * TILE_SIZE);
    }
    for (let y = 0; y <= this.map.height; y += 1) {
      graphics.lineBetween(0, y * TILE_SIZE, this.map.width * TILE_SIZE, y * TILE_SIZE);
    }
  }

  private drawTransitions(): void {
    for (const transition of this.map.transitions) {
      const { x, y } = this.tileCenter(transition.position);
      this.worldLayer.add(
        this.add
          .rectangle(x, y, TILE_SIZE - 6, TILE_SIZE - 6, 0xd8c98f, 0.25)
          .setStrokeStyle(1, 0xd8c98f, 0.7)
      );
      this.worldLayer.add(
        this.add
          .text(x, y, "▽", {
            color: "#d8c98f",
            fontFamily: UI_FONT_FAMILY,
            fontSize: "16px"
          })
          .setOrigin(0.5)
          .setAlpha(0.85)
      );
    }
  }

  private drawObjects(): void {
    for (const object of this.map.objects) {
      const { x, y } = this.tileCenter(object.position);
      const color = OBJECT_COLORS[object.kind] ?? 0x9a8f76;
      const view = this.add
        .rectangle(x, y, TILE_SIZE - 12, TILE_SIZE - 12, color)
        .setStrokeStyle(1, 0x0b0d12);
      this.worldLayer.add(view);
      this.objectViews.set(object.id, [view]);
    }
  }

  /** 解決済み(開封済み宝箱・採取済み採取点)のオブジェクトを非表示にする */
  private updateResolvedObjects(): void {
    const resolved = new Set(this.snapshot.resolvedObjectIds);
    for (const [id, views] of this.objectViews) {
      const visible = !resolved.has(id);
      for (const view of views) {
        view.setVisible(visible);
      }
    }
  }

  private drawNpcs(): void {
    for (const npc of this.map.npcs) {
      const { x, y } = this.tileCenter(npc.position);
      this.worldLayer.add(
        this.add.circle(x, y, TILE_SIZE / 2 - 6, NPC_COLOR).setStrokeStyle(2, 0x0b0d12)
      );
      this.worldLayer.add(
        this.add
          .text(x, y - TILE_SIZE + 8, NPC_DISPLAY_NAMES[npc.id], {
            color: "#a9b0ba",
            fontFamily: UI_FONT_FAMILY,
            fontSize: "13px"
          })
          .setOrigin(0.5)
      );
    }
  }

  private drawBoss(): void {
    if (this.map.boss === undefined) {
      return;
    }
    // ボスマーカーは rift-revealed(司祭に会い夢喰いを知った後)のみ描画・アクティブ。
    // arrival では未出現、撃破後(dream-eater-defeated/epilogue)は非表示にする
    // (戦闘可否のゲート自体はサーバーが mainQuestStage で権威的に行う)
    if (this.snapshot.mainQuestStage !== "rift-revealed") {
      return;
    }
    const { x, y } = this.tileCenter(this.map.boss.position);
    const bossCircle = this.add.circle(x, y, TILE_SIZE - 10, 0x5c2431).setStrokeStyle(2, 0x2a0f16);
    this.worldLayer.add(bossCircle);
    this.tweens.add({
      targets: bossCircle,
      scale: 1.08,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.worldLayer.add(
      this.add
        .text(x, y - TILE_SIZE - 6, ENEMY_DISPLAY_NAMES[this.map.boss.enemyId], {
          color: "#c98f9a",
          fontFamily: UI_FONT_FAMILY,
          fontSize: "13px"
        })
        .setOrigin(0.5)
    );
  }

  /** snapshot の敵シンボルを描画へ反映する(差分がある時だけ再構築) */
  private updateEnemySymbols(): void {
    const key = this.snapshot.symbols
      .map((s) => `${s.enemyId}@${s.position.x},${s.position.y}`)
      .join("|");
    if (key === this.symbolsKey) {
      return;
    }
    this.symbolsKey = key;
    this.symbolViews.forEach((view) => {
      view.destroy();
    });
    this.symbolViews = [];
    for (const symbol of this.snapshot.symbols) {
      const { x, y } = this.tileCenter(symbol.position);
      const diamond = this.add
        .polygon(x, y, [0, -12, 12, 0, 0, 12, -12, 0], SYMBOL_COLORS[symbol.enemyId])
        .setStrokeStyle(2, 0x0b0d12);
      this.tweens.add({
        targets: diamond,
        scale: 1.15,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      this.worldLayer.add(diamond);
      this.symbolViews.push(diamond);
    }
  }

  private createPlayer(): void {
    const body = this.add
      .rectangle(0, 0, TILE_SIZE - 8, TILE_SIZE - 8, 0xd8c98f)
      .setStrokeStyle(2, 0x0b0d12);
    this.facingDot = this.add.circle(0, 0, 3, 0x0b0d12);

    const { x, y } = this.tileCenter(this.renderedPosition);
    this.playerSprite = this.add.container(x, y, [body, this.facingDot]).setDepth(10);
    this.worldLayer.add(this.playerSprite);
    this.applyFacing(this.snapshot.location.facing);
  }

  private setupCamera(): void {
    const camera = this.cameras.main;
    camera.startFollow(this.playerSprite, true, 0.15, 0.15);
    // UIはズームの影響を受けない専用カメラで等倍描画する
    camera.ignore(this.uiLayer);
    const uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    uiCamera.ignore(this.worldLayer);

    this.applyWorldZoom();
    const onResize = (): void => {
      this.applyWorldZoom();
      uiCamera.setSize(this.scale.width, this.scale.height);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  /**
   * マップ全体がウィンドウ内に収まる(見切れない)ズーム倍率を適用する。
   * アスペクト比が合わない軸にだけ余白が出る(contain方式)。
   * カメラのboundsがマップ矩形のため、余った視界はPhaserがマップを中央寄せする
   */
  private applyWorldZoom(): void {
    const mapPixelWidth = this.map.width * TILE_SIZE;
    const mapPixelHeight = this.map.height * TILE_SIZE;
    const containZoom = Math.min(
      this.scale.width / mapPixelWidth,
      this.scale.height / mapPixelHeight
    );
    const camera = this.cameras.main;
    camera.setZoom(containZoom);

    // Phaserのbounds clampは左上寄せのため、余白が出る軸はboundsを対称に
    // 広げてマップを画面中央に置く
    const viewWorldWidth = this.scale.width / containZoom;
    const viewWorldHeight = this.scale.height / containZoom;
    const marginX = Math.max(0, (viewWorldWidth - mapPixelWidth) / 2);
    const marginY = Math.max(0, (viewWorldHeight - mapPixelHeight) / 2);
    camera.setBounds(
      -marginX,
      -marginY,
      mapPixelWidth + marginX * 2,
      mapPixelHeight + marginY * 2
    );
  }

  private setupHud(): void {
    this.uiLayer.add(
      this.add.text(12, 10, this.map.displayName, {
        color: "#f1eee4",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "16px",
        backgroundColor: "#0b0d12cc",
        padding: { x: 8, y: 4 }
      })
    );
    this.hudStatusText = this.add.text(12, 42, "", {
      color: "#a9b0ba",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "14px",
      backgroundColor: "#0b0d12cc",
      padding: { x: 8, y: 4 }
    });
    this.uiLayer.add(this.hudStatusText);
  }

  private updateHud(): void {
    const p = this.snapshot.player;
    this.hudStatusText.setText(
      `${this.snapshot.day}日目  Lv${p.level}  HP ${p.hp}/${p.maxHp}  MP ${p.mp}/${p.maxMp}  ${p.gold}G`
    );
  }

  // ----------------------------------------------------------------------
  // 入力
  // ----------------------------------------------------------------------

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (keyboard === null) {
      throw new Error("キーボード入力が利用できない");
    }

    // ページ再読み込み等でキーの押下状態が残留した場合の自走を防ぐ
    keyboard.resetKeys();

    const key = (code: keyof typeof Phaser.Input.Keyboard.KeyCodes): Phaser.Input.Keyboard.Key =>
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[code]);

    this.keys = {
      up: [key("UP"), key("W")],
      down: [key("DOWN"), key("S")],
      left: [key("LEFT"), key("A")],
      right: [key("RIGHT"), key("D")]
    };

    const interact = (): void => {
      this.handleInteract();
    };
    keyboard.on("keydown-SPACE", interact);
    keyboard.on("keydown-ENTER", interact);
    keyboard.on("keydown-ESC", () => {
      this.handleEscape();
    });
    // Q: クエストジャーナルの開閉(受注中サブクエスト一覧)
    keyboard.on("keydown-Q", () => {
      if (this.questJournal !== null) {
        this.closeQuestJournal();
      } else {
        this.openQuestJournal();
      }
    });

    // ポーリング(長押し)に加えてkeydownでも1歩を予約する。
    // 短いタップがフレーム間に落ちてisDownで拾えなくても確実に1歩動く
    const queueStep = (direction: Direction) => (): void => {
      this.pendingStep = direction;
    };
    keyboard.on("keydown-UP", queueStep("up"));
    keyboard.on("keydown-W", queueStep("up"));
    keyboard.on("keydown-DOWN", queueStep("down"));
    keyboard.on("keydown-S", queueStep("down"));
    keyboard.on("keydown-LEFT", queueStep("left"));
    keyboard.on("keydown-A", queueStep("left"));
    keyboard.on("keydown-RIGHT", queueStep("right"));
    keyboard.on("keydown-D", queueStep("right"));
  }

  private pressedDirection(): Direction | null {
    const isDown = (list: Phaser.Input.Keyboard.Key[]): boolean => list.some((k) => k.isDown);

    if (isDown(this.keys.up)) return "up";
    if (isDown(this.keys.down)) return "down";
    if (isDown(this.keys.left)) return "left";
    if (isDown(this.keys.right)) return "right";
    return null;
  }

  // ----------------------------------------------------------------------
  // インタラクション(サーバーへ送信し、dialog / snapshot で結果を受ける)
  // ----------------------------------------------------------------------

  private handleInteract(): void {
    if (this.transitioning || this.moving) {
      return;
    }
    if (this.dialog.isOpen) {
      this.dialog.close();
      this.syncDomState(); // data-dialog=closed を反映
      return;
    }
    if (
      this.innConfirm !== null ||
      this.pendingInn !== null ||
      this.shopOverlay !== null ||
      this.inventoryOverlay !== null ||
      this.conversationOverlay !== null ||
      this.dreamOverlay !== null ||
      this.questJournal !== null
    ) {
      // 各オーバーレイ側(MenuList・夢の目覚まし)が入力を処理する
      return;
    }
    if (this.awaiting) {
      return;
    }
    this.awaiting = this.client.send({ type: "interact" });
  }

  // ----------------------------------------------------------------------
  // ヘルパー
  // ----------------------------------------------------------------------

  private tileCenter(position: Position): { x: number; y: number } {
    return {
      x: position.x * TILE_SIZE + TILE_SIZE / 2,
      y: position.y * TILE_SIZE + TILE_SIZE / 2
    };
  }

  private applyFacing(facing: Direction): void {
    const offset = TILE_SIZE / 2 - 9;
    const delta: Record<Direction, { x: number; y: number }> = {
      up: { x: 0, y: -offset },
      down: { x: 0, y: offset },
      left: { x: -offset, y: 0 },
      right: { x: offset, y: 0 }
    };
    this.facingDot.setPosition(delta[facing].x, delta[facing].y);
  }

  /** E2E・デバッグ用に現在状態をDOMデータ属性へ反映する(#game要素) */
  private syncDomState(): void {
    const game = document.querySelector<HTMLDivElement>("#game");
    if (game === null) {
      return;
    }
    const view = this.snapshot;
    game.dataset["scene"] = "exploration";
    game.dataset["mapId"] = view.location.mapId;
    game.dataset["playerX"] = String(view.location.position.x);
    game.dataset["playerY"] = String(view.location.position.y);
    game.dataset["symbolCount"] = String(view.symbols.length);
    game.dataset["day"] = String(view.day);
    game.dataset["gold"] = String(view.player.gold);
    game.dataset["level"] = String(view.player.level);
    game.dataset["hp"] = String(view.player.hp);
    // E2E 用: 現在の対話種別(shop/inn/conversation/none)と受注中クエスト数
    game.dataset["interaction"] = view.interaction?.kind ?? "none";
    game.dataset["questCount"] = String(view.subQuests.length);
    // E2E 用: 地の文/NPC ダイアログの開閉(dialog-only 応答は snapshot を伴わないため
    // これで開閉を観測して移動可否の回帰を決定論的にテストする)
    game.dataset["dialog"] = this.dialog.isOpen ? "open" : "closed";
    delete game.dataset["battleEnemy"];
  }
}
