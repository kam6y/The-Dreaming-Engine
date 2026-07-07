import Phaser from "phaser";

import {
  ITEMS,
  SKILLS,
  battleCommandSchema,
  encounterMessage,
  isBattleUsable,
  skillsForLevel,
  type BattleCommand,
  type EnemyId,
  type SnapshotView,
  type ViewBattle
} from "@dreaming-engine/shared";

import { playSe, requestBgm } from "../audio.js";
import { getGameClient, type BattleEventsPayload, type GameClient } from "../net/game-client.js";
import { fitContain, fitCover } from "../ui/cover-image.js";
import { UI_FONT_FAMILY } from "../ui/font.js";
import { GaugeBar } from "../ui/gauge-bar.js";
import { MenuList, menuListHeight } from "../ui/menu-list.js";

/** 敵種別のプレースホルダーカラー(敵グラフィック未整備時のフォールバック) */
const ENEMY_COLORS: Record<EnemyId, number> = {
  "mist-wolf": 0x9aa7b8,
  "candle-eater": 0xc9a25c,
  "creaking-doll": 0x8a7f8f,
  "dream-eater": 0x5c2431,
  // M10拡張(グラフィックは M10-2。それまではこのプレースホルダー色で退避描画)
  "wisp-flame": 0x8fbfe0,
  "whisper-mask": 0xd8d2c4,
  "rust-eater": 0x8a5a3c,
  "failing-spinner": 0x6e5560
};

/** 敵グラフィックの表示スロット高さ(通常/ボス)。画像は縦横比維持で収める */
const ENEMY_SLOT_HEIGHT = 220;
const BOSS_SLOT_HEIGHT = 340;

type BattleUiMode = "message" | "command" | "finished";

type BattleEventView = BattleEventsPayload[number];

/**
 * ターン制戦闘シーン(サーバー正本)。コマンドは battle-command でサーバーへ送り、
 * battle-events(1ターン分の解決結果)を逐次表示(スペース送り)する。
 * ゲージ更新はイベントが運ぶ確定値を使い、戦闘継続中は snapshot の battle ビューで補正する。
 * 戦闘終了(snapshot.mode==="exploration")で探索シーンへ戻る。
 */
export class BattleScene extends Phaser.Scene {
  private client!: GameClient;

  /** 直近の戦闘ビュー(コマンド可否判定・パネル補正用) */
  private view!: ViewBattle;

  /** 直近のスナップショット(インベントリ参照・終了判定用) */
  private latestSnapshot!: SnapshotView;

  private mode: BattleUiMode = "message";

  /** サーバーの battle-events 応答待ち(多重送信の防止) */
  private awaiting = false;

  /** 表示待ちのイベント(1件ずつスペース送りで表示する) */
  private eventQueue: BattleEventView[] = [];

  /** イベント列をすべて表示し終えたときの遷移処理 */
  private afterMessages: (() => void) | null = null;

  /**
   * 戦果ナレーション(初見敵・ボスのみ届く ai-utterance narrate)の待避スロット。
   * サーバーは victory の burst で battle-events → snapshot(exploration)→ narrate の順に送るため、
   * snapshot での即時遷移はせず、勝利メッセージ送り完了時にこれがあれば最後に1枚表示してから終了する
   * (再戦の雑魚には narrate が来ないので、待たずに終了する)。
   */
  private pendingNarrate: string | null = null;

  /** イベント表示中のMP表示値(action イベントの mpCost を反映する) */
  private currentMp = 0;

  private messageText!: Phaser.GameObjects.Text;

  private advanceHint!: Phaser.GameObjects.Text;

  /** 敵の表示物。グラフィックがあれば Image、無ければ Arc(円)のフォールバック */
  private enemySprite!: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;

  private enemyHpBar!: GaugeBar;

  private playerHpBar!: GaugeBar;

  private playerMpBar!: GaugeBar;

  private playerLevelText!: Phaser.GameObjects.Text;

  private commandMenu!: MenuList;

  private subMenu: MenuList | null = null;

  private uiLayer!: Phaser.GameObjects.Container;

  private unsubscribes: (() => void)[] = [];

  public constructor() {
    super("battle");
  }

  public create(): void {
    const client = getGameClient();
    const snapshot = client.lastSnapshot;
    if (snapshot === null || snapshot.battle === undefined) {
      // 戦闘ビューなしで戦闘シーンへ来ることはない想定(防御的フォールバック)
      this.scene.start(snapshot === null ? "title" : "exploration");
      return;
    }
    this.client = client;
    this.latestSnapshot = snapshot;
    this.view = snapshot.battle;
    this.mode = "message";
    this.awaiting = false;
    this.eventQueue = [];
    this.afterMessages = null;
    this.pendingNarrate = null;
    this.subMenu = null;
    this.currentMp = this.view.player.mp;

    this.cameras.main.setBackgroundColor("#12141c");
    this.buildBattleBackground();
    this.uiLayer = this.add.container(0, 0);

    this.buildEnemyView();
    this.buildPlayerPanel();
    this.buildMessageWindow();
    this.buildCommandMenu();
    this.setupKeys();
    this.syncDomState();
    requestBgm(this, "bgm-battle"); // 戦闘BGM(遅延読み込み。終了時は探索シーンのcreateがマップBGMへ戻す)

    this.unsubscribes = [
      client.on("battle-events", (events) => {
        this.onBattleEvents(events);
      }),
      client.on("snapshot", (view) => {
        this.latestSnapshot = view;
        if (view.battle !== undefined) {
          this.view = view.battle;
        }
      }),
      client.on("ai-utterance", (utterance) => {
        // 戦果ナレーション(narrate)のみ待避。会話(speak)は探索シーンの担当
        if (utterance.channel === "narrate") {
          this.pendingNarrate = utterance.text;
        }
      }),
      client.on("server-error", (error) => {
        // コマンドがサーバーに受理されなかった(通信・状態不整合)。メニューへ戻す
        this.awaiting = false;
        this.showMessage(error.message);
        this.afterMessages = () => {
          this.openCommandMenu();
        };
      })
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of this.unsubscribes) {
        unsubscribe();
      }
      this.unsubscribes = [];
    });

    // 開幕: 「◯◯が現れた。」→ スペースでコマンド選択へ
    this.showMessage(encounterMessage(this.view.enemyId));
    this.afterMessages = () => {
      this.openCommandMenu();
    };

    this.cameras.main.fadeIn(200, 18, 20, 28);
  }

  // ----------------------------------------------------------------------
  // UI構築
  // ----------------------------------------------------------------------

  /** 戦闘背景(場所に応じて field/dungeon)。未整備時は単色のまま */
  private buildBattleBackground(): void {
    const mapId = this.latestSnapshot.location.mapId;
    const key = mapId.startsWith("dungeon") ? "battle-dungeon" : "battle-field";
    if (this.textures.exists(key)) {
      const bg = this.add.image(0, 0, key).setOrigin(0.5).setDepth(-10);
      fitCover(bg, this.scale.width, this.scale.height);
      // 敵・UIの視認性のため薄い暗幕を重ねる
      this.add
        .rectangle(0, 0, this.scale.width, this.scale.height, 0x0b0d12, 0.4)
        .setOrigin(0, 0)
        .setDepth(-9);
    }
  }

  private buildEnemyView(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height * 0.36;
    const radius = this.view.isBoss ? 96 : 56;
    const slotHeight = this.view.isBoss ? BOSS_SLOT_HEIGHT : ENEMY_SLOT_HEIGHT;

    if (this.textures.exists(this.view.enemyId)) {
      const sprite = this.add.image(cx, cy, this.view.enemyId).setOrigin(0.5);
      fitContain(sprite, slotHeight, slotHeight);
      this.enemySprite = sprite;
    } else {
      this.enemySprite = this.add
        .circle(cx, cy, radius, ENEMY_COLORS[this.view.enemyId])
        .setStrokeStyle(3, 0x0b0d12);
    }
    this.tweens.add({
      targets: this.enemySprite,
      scale: this.enemySprite.scale * 1.04,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    this.add
      .text(cx, cy - radius - 40, this.view.enemyName, {
        color: "#f1eee4",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "22px"
      })
      .setOrigin(0.5);

    this.enemyHpBar = new GaugeBar(this, this.uiLayer, {
      x: cx - 110,
      y: cy - radius - 24,
      width: 220,
      label: "HP",
      barColor: 0xb0524f,
      max: this.view.enemy.maxHp,
      value: this.view.enemy.hp
    });
  }

  private buildPlayerPanel(): void {
    const width = 280;
    const x = this.scale.width - width - 24;
    // メッセージ窓(下端112px)の直上に置く
    const y = this.scale.height - 240;

    const panel = this.add
      .rectangle(x, y, width, 120, 0x0b0d12, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x6b6350);
    this.uiLayer.add(panel);

    this.playerLevelText = this.add.text(x + 14, y + 10, "", {
      color: "#f1eee4",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "17px"
    });
    this.uiLayer.add(this.playerLevelText);

    this.playerHpBar = new GaugeBar(this, this.uiLayer, {
      x: x + 14,
      y: y + 46,
      width: width - 28,
      label: "HP",
      barColor: 0x6fa06b,
      max: this.view.player.maxHp,
      value: this.view.player.hp
    });
    this.playerMpBar = new GaugeBar(this, this.uiLayer, {
      x: x + 14,
      y: y + 76,
      width: width - 28,
      label: "MP",
      barColor: 0x5c7cb0,
      max: this.view.player.maxMp,
      value: this.view.player.mp
    });
    this.updatePlayerPanel();
  }

  /** 直近の戦闘ビューでプレイヤーパネルを補正する(ターン確定後に呼ぶ) */
  private updatePlayerPanel(): void {
    this.playerLevelText.setText(`旅人  Lv${this.view.player.level}`);
    this.playerHpBar.setValue(this.view.player.hp, this.view.player.maxHp);
    this.playerMpBar.setValue(this.view.player.mp, this.view.player.maxMp);
    this.currentMp = this.view.player.mp;
  }

  private buildMessageWindow(): void {
    const margin = 16;
    const height = 96;
    const width = this.scale.width - margin * 2;
    const y = this.scale.height - height - margin;

    const box = this.add
      .rectangle(margin, y, width, height, 0x0b0d12, 0.94)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x6b6350);
    this.uiLayer.add(box);

    this.messageText = this.add.text(margin + 16, y + 14, "", {
      color: "#f1eee4",
      fontFamily: UI_FONT_FAMILY,
      fontSize: "18px",
      wordWrap: { width: width - 320, useAdvancedWrap: true },
      lineSpacing: 6
    });
    this.uiLayer.add(this.messageText);

    this.advanceHint = this.add
      .text(margin + width - 16, y + height - 10, "▼ スペース", {
        color: "#a9b0ba",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "13px"
      })
      .setOrigin(1, 1);
    this.uiLayer.add(this.advanceHint);
  }

  private buildCommandMenu(): void {
    this.commandMenu = new MenuList(this, this.uiLayer, {
      items: [
        { id: "attack", label: "たたかう" },
        { id: "skill", label: "スキル" },
        { id: "item", label: "どうぐ" },
        { id: "flee", label: "にげる", disabled: this.view.isBoss }
      ],
      x: 24,
      y: this.scale.height - 264,
      width: 200,
      onSelect: (id) => {
        this.onCommandSelected(id);
      }
    });
  }

  private setupKeys(): void {
    const keyboard = this.input.keyboard;
    if (keyboard === null) {
      throw new Error("キーボード入力が利用できない");
    }
    keyboard.resetKeys();
    const advance = (): void => {
      if (this.mode === "message" && !this.awaiting) {
        this.advanceMessage();
      }
    };
    keyboard.on("keydown-SPACE", advance);
    keyboard.on("keydown-ENTER", advance);
  }

  // ----------------------------------------------------------------------
  // メッセージ送り
  // ----------------------------------------------------------------------

  private showMessage(text: string): void {
    this.mode = "message";
    this.commandMenu.deactivate();
    this.messageText.setText(text);
    this.advanceHint.setVisible(true);
  }

  private advanceMessage(): void {
    const next = this.eventQueue.shift();
    if (next !== undefined) {
      this.applyEventToView(next);
      this.messageText.setText(next.message);
      return;
    }
    const after = this.afterMessages;
    this.afterMessages = null;
    if (after !== null) {
      // 同一keydownイベント中のリスナー追加による二重発火を避けるため次tickで遷移する
      this.time.delayedCall(0, after);
    }
  }

  /** 表示中イベントの内容をゲージ・演出へ反映する(値はイベントが運ぶ確定値を使う) */
  private applyEventToView(event: BattleEventView): void {
    switch (event.type) {
      case "damage":
      case "status-tick":
        if (event.target === "enemy") {
          this.enemyHpBar.setValue(event.remainingHp);
          this.flash(this.enemySprite);
          // 直接攻撃の着弾のみ攻撃ヒット音(毒等の継続ダメージ status-tick は鳴らさない)
          if (event.type === "damage") {
            playSe(this, "se-attack");
          }
        } else {
          this.playerHpBar.setValue(event.remainingHp);
          this.cameras.main.shake(120, 0.004);
          if (event.type === "damage") {
            playSe(this, "se-damage");
          }
        }
        break;
      case "heal":
        if (event.target === "player") {
          this.playerHpBar.setValue(event.remainingHp);
        } else {
          this.enemyHpBar.setValue(event.remainingHp);
        }
        playSe(this, "se-heal");
        break;
      case "action":
        // スキル発動音(通常攻撃の着弾音は damage イベント側で鳴らす)
        if (event.actionKind === "skill") {
          playSe(this, "se-skill");
        }
        if (event.actor === "player" && event.mpCost !== undefined) {
          this.currentMp = Math.max(0, this.currentMp - event.mpCost);
          this.playerMpBar.setValue(this.currentMp);
        }
        break;
      case "phase-change": {
        // 形態変化: 靄が剥がれる暗示として一瞬白く明滅させ、第2形態グラフィックへ差し替える。
        // テクスチャは「<敵ID>-phase2」の規約で引く(dream-eater固定だと、形態変化を持つ
        // 別の敵(紡ぎ損ない等)で夢喰いの画像へ化けてしまう。M10-2で一般化)
        const phase2Key = `${this.view.enemyId}-phase2`;
        if (this.enemySprite instanceof Phaser.GameObjects.Image && this.textures.exists(phase2Key)) {
          this.enemySprite.setTexture(phase2Key);
        }
        this.flash(this.enemySprite);
        this.cameras.main.flash(300, 40, 24, 32);
        break;
      }
      case "victory":
        playSe(this, "se-victory");
        break;
      case "level-up":
        playSe(this, "se-levelup");
        break;
      case "defeat":
      case "flee":
      case "item-used":
      case "status-inflicted":
      case "status-cured":
      case "status-expired":
      case "buff-applied":
      case "buff-expired":
      case "command-rejected":
        // これらは message 表示のみ(ゲージ演出なし)。バフの視覚表現の作り込みはM9-3の範囲。
        break;
    }
  }

  private flash(target: Phaser.GameObjects.Image | Phaser.GameObjects.Arc): void {
    this.tweens.add({ targets: target, alpha: 0.25, duration: 70, yoyo: true, repeat: 1 });
  }

  // ----------------------------------------------------------------------
  // コマンド選択
  // ----------------------------------------------------------------------

  private openCommandMenu(): void {
    if (this.latestSnapshot.mode !== "battle") {
      // 戦果ナレーション(初見敵・ボスのみ)があれば最後に1枚見せてから探索へ戻る。
      // 無ければ(再戦の雑魚)待たずに終了する
      if (this.pendingNarrate !== null) {
        const narrate = this.pendingNarrate;
        this.pendingNarrate = null;
        this.showMessage(narrate);
        this.afterMessages = () => {
          this.finishBattle();
        };
        return;
      }
      this.finishBattle();
      return;
    }
    this.updatePlayerPanel();
    this.mode = "command";
    this.advanceHint.setVisible(false);
    this.messageText.setText("どうする?");
    this.syncDomState(); // ラウンド確定後の MP・状態異常を data 属性へ反映(E2E の同期点)
    this.commandMenu.activate();
  }

  private onCommandSelected(id: string): void {
    switch (id) {
      case "attack":
        this.executeCommand({ kind: "attack" });
        break;
      case "flee":
        this.executeCommand({ kind: "flee" });
        break;
      case "skill":
        this.openSkillMenu();
        break;
      case "item":
        this.openItemMenu();
        break;
      default:
        break;
    }
  }

  private openSkillMenu(): void {
    this.commandMenu.deactivate();
    // 習得済みスキルをレベルから導出(戦闘ビューの player.level が正)。習得レベル未満は列挙しない
    const items = skillsForLevel(this.view.player.level).map((skillId) => {
      const skill = SKILLS[skillId];
      return {
        id: skillId,
        label: `${skill.name}(MP${skill.mpCost})`,
        disabled: this.view.player.mp < skill.mpCost
      };
    });
    this.openSubMenu(items, (skillId) => {
      this.executeCommand({ kind: "skill", skillId });
    });
  }

  private openItemMenu(): void {
    this.commandMenu.deactivate();
    // 所持品はサーバー正本(直近snapshot)から。消費もサーバーが確定する
    const usable = this.latestSnapshot.inventory.filter((stack) => isBattleUsable(stack.itemId));
    if (usable.length === 0) {
      this.showMessage("使えるどうぐを持っていない。");
      this.afterMessages = () => {
        this.openCommandMenu();
      };
      return;
    }
    const items = usable.map((stack) => ({
      id: stack.itemId,
      label: `${ITEMS[stack.itemId].name} ×${stack.count}`
    }));
    this.openSubMenu(items, (itemId) => {
      this.executeCommand({ kind: "item", itemId });
    });
  }

  private openSubMenu(
    items: { id: string; label: string; disabled?: boolean }[],
    onSelect: (id: string) => void
  ): void {
    // メッセージ窓(下端余白16+高さ96=上端 height-112)に重ならないよう、
    // 項目数に応じて窓の上へ下詰めで配置する(スキル5種=高さ174pxで固定位置だと重なる。M9-3)
    const y = this.scale.height - 112 - menuListHeight(items.length) - 8;
    this.subMenu = new MenuList(this, this.uiLayer, {
      items,
      x: 236,
      y,
      width: 260,
      onSelect: (id) => {
        this.closeSubMenu();
        onSelect(id);
      },
      onCancel: () => {
        this.closeSubMenu();
        this.time.delayedCall(0, () => {
          this.openCommandMenu();
        });
      }
    });
    // 呼び出し元のkeydownと同一イベントでの二重発火を避けるため次tickで受付開始
    this.time.delayedCall(0, () => {
      this.subMenu?.activate();
    });
  }

  private closeSubMenu(): void {
    this.subMenu?.destroy();
    this.subMenu = null;
  }

  // ----------------------------------------------------------------------
  // ターン解決(サーバーへ送信し、battle-events を受けて表示する)
  // ----------------------------------------------------------------------

  /** UI入力(メニューID等の外部入力)をzodで検証してからサーバーへ送る */
  private executeCommand(raw: unknown): void {
    this.commandMenu.deactivate();
    const command: BattleCommand = battleCommandSchema.parse(raw);
    this.mode = "message";
    this.advanceHint.setVisible(false);
    this.awaiting = this.client.send({ type: "battle-command", command });
    if (!this.awaiting) {
      // 未接続。メニューへ戻して再試行できるようにする
      this.showMessage("機関との糸が途切れている……(接続待ち)");
      this.afterMessages = () => {
        this.openCommandMenu();
      };
    }
  }

  /** 1ターン分の解決結果。逐次表示を開始する */
  private onBattleEvents(events: BattleEventsPayload): void {
    this.awaiting = false;

    const first = events[0];
    if (first !== undefined && first.type === "command-rejected") {
      // ターンは進んでいない。メッセージ表示後にコマンド選択へ戻す
      this.showMessage(first.message);
      this.afterMessages = () => {
        this.openCommandMenu();
      };
      return;
    }

    this.eventQueue = [...events];
    this.afterMessages = () => {
      this.openCommandMenu();
    };

    // 最初のイベントを即座に表示する(空クリック不要)
    this.mode = "message";
    this.advanceHint.setVisible(true);
    this.advanceMessage();
  }

  // ----------------------------------------------------------------------
  // 戦闘終了(snapshot.mode==="exploration" を検知して探索へ戻る)
  // ----------------------------------------------------------------------

  private finishBattle(): void {
    this.mode = "finished";
    // ボス「夢喰い」撃破(mainQuestStage=dream-eater-defeated)ならエンディングへ直行する
    // (探索を経由せず、ダンジョンの一瞬の再描画と遷移レースを避ける)
    const toEnding = this.latestSnapshot.mainQuestStage === "dream-eater-defeated";
    this.cameras.main.fadeOut(220, 11, 13, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // 全滅・勝利の後日談(dialog)は探索シーンがキューから表示する
      this.scene.start(toEnding ? "ending" : "exploration");
    });
  }

  /** E2E用にDOMへ現在シーンと交戦相手を反映する */
  private syncDomState(): void {
    const game = document.querySelector<HTMLDivElement>("#game");
    if (game !== null) {
      game.dataset["scene"] = "battle";
      game.dataset["battleEnemy"] = this.view.enemyId;
      // E2E 用: スキル効果の観測(MP消費・敵の状態異常。コマンド入力フェーズ毎に更新される。M9-3)
      game.dataset["playerMp"] = String(this.view.player.mp);
      game.dataset["enemyStatus"] = this.view.enemy.statuses.map((status) => status.id).join(",");
      // E2E 用: コマンド入力フェーズの検出(メッセージ送りの Space がコマンド決定を
      // 誤発火しないよう、E2E は command になるまで「確認してから1回押す」方式を取る)
      game.dataset["battleMode"] = this.mode;
    }
  }
}
