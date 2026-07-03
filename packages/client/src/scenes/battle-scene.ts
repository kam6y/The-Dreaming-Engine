import Phaser from "phaser";

import {
  ENEMY_DISPLAY_NAMES,
  INITIAL_SKILL_IDS,
  ITEMS,
  SKILLS,
  applyPartyWipe,
  battleCommandSchema,
  createBattle,
  encounterMessage,
  isBattleUsable,
  resolveTurn,
  toPlayerProgress,
  townMap,
  type BattleCommand,
  type BattleEvent,
  type BattleState,
  type Direction,
  type EnemyId,
  type EnemySymbolPlacement,
  type ItemId,
  type MapId,
  type Position
} from "@dreaming-engine/shared";

import { getRun, setRun } from "../game-state.js";
import { GaugeBar } from "../ui/gauge-bar.js";
import { MenuList } from "../ui/menu-list.js";

/** 戦闘終了後に探索シーンへ戻るための情報 */
export interface BattleReturnInfo {
  mapId: MapId;
  position: Position;
  facing: Direction;
  symbols: EnemySymbolPlacement[];
  /** 交戦相手のシンボルの symbols 内インデックス(勝利時に除去する) */
  symbolIndex: number;
}

export interface BattleSceneData {
  enemyId: EnemyId;
  seed: number;
  returnTo: BattleReturnInfo;
}

/** 敵種別のプレースホルダーカラー(グラフィックはM5で差し替え) */
const ENEMY_COLORS: Record<EnemyId, number> = {
  "mist-wolf": 0x9aa7b8,
  "candle-eater": 0xc9a25c,
  "creaking-doll": 0x8a7f8f,
  "dream-eater": 0x5c2431
};

type BattleUiMode = "message" | "command" | "finished";

/**
 * ターン制戦闘シーン。戦闘の解決はすべて shared の戦闘エンジンに委ね、
 * このシーンはコマンド入力とイベント列の逐次表示(スペース送り)だけを担う。
 */
export class BattleScene extends Phaser.Scene {
  private battle!: BattleState;

  private sceneData!: BattleSceneData;

  private mode: BattleUiMode = "message";

  /** 表示待ちのイベント(1件ずつスペース送りで表示する) */
  private eventQueue: BattleEvent[] = [];

  /** イベント列をすべて表示し終えたときの遷移処理 */
  private afterMessages: (() => void) | null = null;

  private messageText!: Phaser.GameObjects.Text;

  private advanceHint!: Phaser.GameObjects.Text;

  private enemySprite!: Phaser.GameObjects.Arc;

  private enemyHpBar!: GaugeBar;

  private playerHpBar!: GaugeBar;

  private playerMpBar!: GaugeBar;

  private playerLevelText!: Phaser.GameObjects.Text;

  private commandMenu!: MenuList;

  private subMenu: MenuList | null = null;

  private uiLayer!: Phaser.GameObjects.Container;

  public constructor() {
    super("battle");
  }

  public init(data: BattleSceneData): void {
    this.sceneData = data;
    this.mode = "message";
    this.eventQueue = [];
    this.afterMessages = null;
    this.subMenu = null;
    this.pendingDrops = [];
  }

  public create(): void {
    const run = getRun(this);
    this.battle = createBattle(run.progress, this.sceneData.enemyId, this.sceneData.seed);

    this.cameras.main.setBackgroundColor("#12141c");
    this.uiLayer = this.add.container(0, 0);

    this.buildEnemyView();
    this.buildPlayerPanel();
    this.buildMessageWindow();
    this.buildCommandMenu();
    this.setupKeys();
    this.syncDomState();

    // 開幕: 「◯◯が現れた。」→ スペースでコマンド選択へ
    this.showMessage(encounterMessage(this.sceneData.enemyId));
    this.afterMessages = () => {
      this.openCommandMenu();
    };

    this.cameras.main.fadeIn(200, 18, 20, 28);
  }

  // ----------------------------------------------------------------------
  // UI構築
  // ----------------------------------------------------------------------

  private buildEnemyView(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height * 0.36;
    const radius = this.battle.isBoss ? 96 : 56;

    this.enemySprite = this.add
      .circle(cx, cy, radius, ENEMY_COLORS[this.sceneData.enemyId])
      .setStrokeStyle(3, 0x0b0d12);
    this.tweens.add({
      targets: this.enemySprite,
      scale: 1.05,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    this.add
      .text(cx, cy - radius - 40, ENEMY_DISPLAY_NAMES[this.sceneData.enemyId], {
        color: "#f1eee4",
        fontFamily: "serif",
        fontSize: "22px"
      })
      .setOrigin(0.5);

    this.enemyHpBar = new GaugeBar(this, this.uiLayer, {
      x: cx - 110,
      y: cy - radius - 24,
      width: 220,
      label: "HP",
      barColor: 0xb0524f,
      max: this.battle.enemy.maxHP,
      value: this.battle.enemy.hp
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
      fontFamily: "serif",
      fontSize: "17px"
    });
    this.uiLayer.add(this.playerLevelText);

    this.playerHpBar = new GaugeBar(this, this.uiLayer, {
      x: x + 14,
      y: y + 46,
      width: width - 28,
      label: "HP",
      barColor: 0x6fa06b,
      max: this.battle.player.maxHP,
      value: this.battle.player.hp
    });
    this.playerMpBar = new GaugeBar(this, this.uiLayer, {
      x: x + 14,
      y: y + 76,
      width: width - 28,
      label: "MP",
      barColor: 0x5c7cb0,
      max: this.battle.player.maxMP,
      value: this.battle.player.mp
    });
    this.updatePlayerPanel();
  }

  private updatePlayerPanel(): void {
    this.playerLevelText.setText(`旅人  Lv${this.battle.player.level}`);
    this.playerHpBar.setValue(this.battle.player.hp, this.battle.player.maxHP);
    this.playerMpBar.setValue(this.battle.player.mp, this.battle.player.maxMP);
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
      fontFamily: "serif",
      fontSize: "18px",
      wordWrap: { width: width - 320 },
      lineSpacing: 6
    });
    this.uiLayer.add(this.messageText);

    this.advanceHint = this.add
      .text(margin + width - 16, y + height - 10, "▼ スペース", {
        color: "#a9b0ba",
        fontFamily: "serif",
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
        { id: "flee", label: "にげる", disabled: this.battle.isBoss }
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
      if (this.mode === "message") {
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
  private applyEventToView(event: BattleEvent): void {
    switch (event.type) {
      case "damage":
      case "status-tick":
        if (event.target === "enemy") {
          this.enemyHpBar.setValue(event.remainingHp);
          this.flash(this.enemySprite);
        } else {
          this.playerHpBar.setValue(event.remainingHp);
          this.cameras.main.shake(120, 0.004);
        }
        break;
      case "heal":
        if (event.target === "player") {
          this.playerHpBar.setValue(event.remainingHp);
        } else {
          this.enemyHpBar.setValue(event.remainingHp);
        }
        break;
      case "action":
        if (event.actor === "player" && event.mpCost !== undefined) {
          this.playerMpBar.setValue(this.battle.player.mp);
        }
        break;
      case "phase-change":
        // 形態変化: 靄が剥がれる暗示として一瞬白く明滅させる
        this.flash(this.enemySprite);
        this.cameras.main.flash(300, 40, 24, 32);
        break;
      case "victory":
        this.pendingDrops = [...event.drops];
        break;
      case "level-up":
        this.updatePlayerPanel();
        break;
      case "defeat":
      case "flee":
      case "item-used":
      case "status-inflicted":
      case "status-cured":
      case "status-expired":
      case "command-rejected":
        break;
    }
  }

  private flash(target: Phaser.GameObjects.Arc): void {
    this.tweens.add({ targets: target, alpha: 0.25, duration: 70, yoyo: true, repeat: 1 });
  }

  // ----------------------------------------------------------------------
  // コマンド選択
  // ----------------------------------------------------------------------

  private openCommandMenu(): void {
    if (this.battle.outcome !== "ongoing") {
      this.finishBattle();
      return;
    }
    this.mode = "command";
    this.advanceHint.setVisible(false);
    this.messageText.setText("どうする?");
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
    const items = INITIAL_SKILL_IDS.map((skillId) => {
      const skill = SKILLS[skillId];
      return {
        id: skillId,
        label: `${skill.name}(MP${skill.mpCost})`,
        disabled: this.battle.player.mp < skill.mpCost
      };
    });
    this.openSubMenu(items, (skillId) => {
      this.executeCommand({ kind: "skill", skillId });
    });
  }

  private openItemMenu(): void {
    this.commandMenu.deactivate();
    const run = getRun(this);
    const usable = run.inventory.filter((itemId) => isBattleUsable(itemId));
    if (usable.length === 0) {
      this.showMessage("使えるどうぐを持っていない。");
      this.afterMessages = () => {
        this.openCommandMenu();
      };
      return;
    }
    // 同一アイテムはまとめて個数表示する
    const counts = new Map<ItemId, number>();
    for (const itemId of usable) {
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
    const items = [...counts.entries()].map(([itemId, count]) => ({
      id: itemId,
      label: `${ITEMS[itemId].name} ×${count}`
    }));
    this.openSubMenu(items, (itemId) => {
      this.executeCommand({ kind: "item", itemId });
    });
  }

  private openSubMenu(
    items: { id: string; label: string; disabled?: boolean }[],
    onSelect: (id: string) => void
  ): void {
    this.subMenu = new MenuList(this, this.uiLayer, {
      items,
      x: 236,
      y: this.scale.height - 264,
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
  // ターン解決
  // ----------------------------------------------------------------------

  /** UI入力(メニューID等の外部入力)をzodで検証してからターンを解決する */
  private executeCommand(raw: unknown): void {
    this.commandMenu.deactivate();
    const command: BattleCommand = battleCommandSchema.parse(raw);
    const result = resolveTurn(this.battle, command);

    const first = result.events[0];
    if (first !== undefined && first.type === "command-rejected") {
      // ターンは進んでいない。メッセージ表示後にコマンド選択へ戻す
      this.showMessage(first.message);
      this.afterMessages = () => {
        this.openCommandMenu();
      };
      return;
    }

    this.battle = result.state;
    this.eventQueue = [...result.events];
    this.afterMessages = () => {
      this.openCommandMenu();
    };

    // 最初のイベントを即座に表示する(空クリック不要)
    this.mode = "message";
    this.advanceHint.setVisible(true);
    this.advanceMessage();

    // どうぐは実際に使用された場合のみ所持品から消費する
    // (敵の先手で倒れた場合などは item-used イベントが発生せず、消費しない)
    if (command.kind === "item" && result.events.some((e) => e.type === "item-used")) {
      const run = getRun(this);
      const index = run.inventory.indexOf(command.itemId);
      if (index >= 0) {
        run.inventory.splice(index, 1);
        setRun(this, run);
      }
    }
  }

  // ----------------------------------------------------------------------
  // 戦闘終了
  // ----------------------------------------------------------------------

  private finishBattle(): void {
    this.mode = "finished";
    const run = getRun(this);
    const returnTo = this.sceneData.returnTo;

    if (this.battle.outcome === "victory") {
      run.progress = toPlayerProgress(this.battle.player);
      // ドロップ品を所持品へ(所持上限はM3で導入)
      for (const event of this.collectVictoryDrops()) {
        run.inventory.push(event);
      }
      setRun(this, run);
      const remaining = returnTo.symbols.filter((_, i) => i !== returnTo.symbolIndex);
      this.returnToExploration(returnTo.mapId, returnTo.position, returnTo.facing, remaining);
      return;
    }

    if (this.battle.outcome === "fled") {
      run.progress = toPlayerProgress(this.battle.player);
      setRun(this, run);
      this.returnToExploration(returnTo.mapId, returnTo.position, returnTo.facing, returnTo.symbols);
      return;
    }

    // 全滅: ゴールド半減+全回復し、街の宿屋前で目覚める(日送りはM3のゲーム内時間で導入)
    const wiped = applyPartyWipe(run.progress);
    run.progress = wiped.progress;
    setRun(this, run);

    const innkeeper = townMap.npcs.find((npc) => npc.id === "innkeeper");
    const wakePosition: Position =
      innkeeper !== undefined
        ? { x: innkeeper.position.x, y: innkeeper.position.y + 1 }
        : { x: 10, y: 10 };

    this.messageText.setText(
      `……悪夢から覚めた。灯宿の寝台の上だった。(${wiped.goldLost}ゴールドを夢に置き忘れた)`
    );
    this.advanceHint.setVisible(true);
    this.mode = "message";
    this.eventQueue = [];
    this.afterMessages = () => {
      this.returnToExploration("town", wakePosition, "up", undefined);
    };
  }

  /** 勝利イベントからドロップ品を集める(finishBattle時点でeventQueueは消化済みのためstateから) */
  private collectVictoryDrops(): ItemId[] {
    // resolveTurn のイベントは消化済みなので、直近の victory イベントのドロップを控えておく
    return this.pendingDrops;
  }

  private pendingDrops: ItemId[] = [];

  private returnToExploration(
    mapId: MapId,
    position: Position,
    facing: Direction,
    symbols: EnemySymbolPlacement[] | undefined
  ): void {
    this.cameras.main.fadeOut(220, 11, 13, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("exploration", { mapId, position, facing, symbols });
    });
  }

  /** E2E用にDOMへ現在シーンと交戦相手を反映する */
  private syncDomState(): void {
    const game = document.querySelector<HTMLDivElement>("#game");
    if (game !== null) {
      game.dataset["scene"] = "battle";
      game.dataset["battleEnemy"] = this.sceneData.enemyId;
    }
  }
}
