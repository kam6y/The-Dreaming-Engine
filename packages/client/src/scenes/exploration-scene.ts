import Phaser from "phaser";

import {
  ENEMY_DISPLAY_NAMES,
  MAPS,
  NEW_GAME_START,
  NPC_DISPLAY_NAMES,
  interactionTarget,
  sampleEnemySymbols,
  samePosition,
  tileTypeAt,
  transitionAt,
  tryMove,
  type Direction,
  type EnemyId,
  type EnemySymbolPlacement,
  type MapDefinition,
  type MapId,
  type Position,
  type TileType
} from "@dreaming-engine/shared";

import { encountersDisabled, getEncounterRng } from "../game-state.js";
import type { BattleSceneData } from "./battle-scene.js";
import { DialogBox } from "../ui/dialog-box.js";

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

interface ExplorationSceneData {
  mapId?: MapId;
  position?: Position;
  facing?: Direction;
  /**
   * 敵シンボルの残存状態(戦闘からの復帰時に引き継ぐ)。
   * 未指定ならマップ入場としてサンプリングし直す(=撃破分のリスポーン)
   */
  symbols?: EnemySymbolPlacement[];
}

/**
 * 探索シーン(見下ろしグリッド移動)。
 * - WASD / 矢印でグリッド単位移動(スムーズ補間、4方向)
 * - カメラ追従
 * - 遷移マスに乗るとマップ間遷移
 * - スペース / Enter で正面のNPC・オブジェクトを調べる(M1はプレースホルダー文言)
 * 移動・衝突・対象探索の判定はすべて shared の純ロジックに委ねる。
 */
export class ExplorationScene extends Phaser.Scene {
  private map!: MapDefinition;

  private playerPosition: Position = { x: 0, y: 0 };

  private facing: Direction = "down";

  private playerSprite!: Phaser.GameObjects.Container;

  private facingDot!: Phaser.GameObjects.Arc;

  /** マップ・キャラ等のワールド描画物(ズームされるカメラで映す) */
  private worldLayer!: Phaser.GameObjects.Container;

  /** HUD・ダイアログ等のUI描画物(等倍の専用カメラで映す) */
  private uiLayer!: Phaser.GameObjects.Container;

  private moving = false;

  /** タップ入力(短いkeydown)を取りこぼさないための予約ステップ */
  private pendingStep: Direction | null = null;

  private dialog!: DialogBox;

  private keys!: {
    up: Phaser.Input.Keyboard.Key[];
    down: Phaser.Input.Keyboard.Key[];
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
  };

  public constructor() {
    super("exploration");
  }

  private symbols: EnemySymbolPlacement[] = [];

  private symbolViews: Phaser.GameObjects.GameObject[] = [];

  private pendingSymbols: EnemySymbolPlacement[] | undefined;

  public init(data: ExplorationSceneData): void {
    const mapId = data.mapId ?? NEW_GAME_START.mapId;
    this.map = MAPS[mapId];
    this.playerPosition = data.position ?? NEW_GAME_START.position;
    this.facing = data.facing ?? NEW_GAME_START.facing;
    this.moving = false;
    this.pendingSymbols = data.symbols;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#0b0d12");

    this.worldLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0).setDepth(1000);

    // 戦闘復帰時は残存シンボルを引き継ぎ、新規入場時はサンプリング(=リスポーン)
    this.symbols =
      this.pendingSymbols ??
      (encountersDisabled() ? [] : sampleEnemySymbols(this.map, getEncounterRng(this)));

    this.drawTiles();
    this.drawTransitions();
    this.drawObjects();
    this.drawNpcs();
    this.drawBoss();
    this.drawEnemySymbols();
    this.createPlayer();
    this.setupHud();
    this.setupCamera();
    this.setupInput();

    this.dialog = new DialogBox(this, this.uiLayer);

    this.syncDomState();
    this.cameras.main.fadeIn(200, 11, 13, 18);
  }

  public override update(): void {
    if (this.moving) {
      return;
    }
    if (this.dialog.isOpen) {
      // ダイアログ中に押した移動キーが、閉じた直後の「幽霊移動」にならないよう破棄する
      this.pendingStep = null;
      return;
    }

    const direction = this.pressedDirection() ?? this.pendingStep;
    this.pendingStep = null;
    if (direction !== null) {
      this.stepTo(direction);
    }
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
            fontFamily: "serif",
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
      this.worldLayer.add(
        this.add.rectangle(x, y, TILE_SIZE - 12, TILE_SIZE - 12, color).setStrokeStyle(1, 0x0b0d12)
      );
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
            fontFamily: "serif",
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
          fontFamily: "serif",
          fontSize: "13px"
        })
        .setOrigin(0.5)
    );
  }

  private drawEnemySymbols(): void {
    this.symbolViews.forEach((view) => {
      view.destroy();
    });
    this.symbolViews = [];
    for (const symbol of this.symbols) {
      const { x, y } = this.tileCenter(symbol.position);
      const diamond = this.add
        .polygon(
          x,
          y,
          [0, -12, 12, 0, 0, 12, -12, 0],
          SYMBOL_COLORS[symbol.enemyId]
        )
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

    const { x, y } = this.tileCenter(this.playerPosition);
    this.playerSprite = this.add.container(x, y, [body, this.facingDot]).setDepth(10);
    this.worldLayer.add(this.playerSprite);
    this.updateFacingDot();
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
        fontFamily: "serif",
        fontSize: "16px",
        backgroundColor: "#0b0d12cc",
        padding: { x: 8, y: 4 }
      })
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
    const isDown = (list: Phaser.Input.Keyboard.Key[]): boolean =>
      list.some((k) => k.isDown);

    if (isDown(this.keys.up)) return "up";
    if (isDown(this.keys.down)) return "down";
    if (isDown(this.keys.left)) return "left";
    if (isDown(this.keys.right)) return "right";
    return null;
  }

  // ----------------------------------------------------------------------
  // 移動・遷移
  // ----------------------------------------------------------------------

  private stepTo(direction: Direction): void {
    this.facing = direction;
    this.updateFacingDot();

    const result = tryMove(this.map, this.playerPosition, direction);
    if (!result.moved) {
      this.syncDomState();
      return;
    }

    // 敵シンボルへの接触判定(シンボルはマップデータ外の動的存在のためここで判定)
    const symbolIndex = this.symbols.findIndex((s) => samePosition(s.position, result.position));
    if (symbolIndex >= 0) {
      this.startBattle(symbolIndex);
      return;
    }

    this.moving = true;
    this.playerPosition = result.position;

    const { x, y } = this.tileCenter(result.position);
    this.tweens.add({
      targets: this.playerSprite,
      x,
      y,
      duration: MOVE_DURATION_MS,
      onComplete: () => {
        this.moving = false;
        this.syncDomState();
        this.checkTransition();
      }
    });
  }

  private startBattle(symbolIndex: number): void {
    const symbol = this.symbols[symbolIndex];
    if (symbol === undefined) {
      return;
    }
    this.moving = true; // 遷移中の追加入力を止める
    const seed = getEncounterRng(this).int(0, 0x7fffffff);
    const data: BattleSceneData = {
      enemyId: symbol.enemyId,
      seed,
      returnTo: {
        mapId: this.map.id,
        position: this.playerPosition,
        facing: this.facing,
        symbols: this.symbols,
        symbolIndex
      }
    };
    this.cameras.main.fadeOut(240, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("battle", data);
    });
  }

  private checkTransition(): void {
    const transition = transitionAt(this.map, this.playerPosition);
    if (transition === null) {
      return;
    }

    this.moving = true;
    this.cameras.main.fadeOut(180, 11, 13, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({
        mapId: transition.to.mapId,
        position: transition.to.position,
        facing: transition.to.facing
      } satisfies ExplorationSceneData);
    });
  }

  // ----------------------------------------------------------------------
  // インタラクション(M1はプレースホルダー文言の表示まで)
  // ----------------------------------------------------------------------

  private handleInteract(): void {
    if (this.dialog.isOpen) {
      this.dialog.close();
      return;
    }
    if (this.moving) {
      return;
    }

    const target = interactionTarget(this.map, this.playerPosition, this.facing);
    if (target === null) {
      return;
    }

    if (target.kind === "npc") {
      // 会話本体はM4(DreamMaster)で実装する。M1は枠組みの確認用プレースホルダー
      this.dialog.open(
        NPC_DISPLAY_NAMES[target.npc.id],
        "……(静かにこちらを見ている。言葉が紡がれるには、まだ夢が浅すぎるようだ)"
      );
    } else if (target.kind === "object") {
      this.dialog.open(null, target.object.message);
    } else {
      this.dialog.open(
        null,
        "重い唸りのような静寂が満ちている。……近づくには、まだ力が足りない。"
      );
    }
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

  private updateFacingDot(): void {
    const offset = TILE_SIZE / 2 - 9;
    const delta: Record<Direction, { x: number; y: number }> = {
      up: { x: 0, y: -offset },
      down: { x: 0, y: offset },
      left: { x: -offset, y: 0 },
      right: { x: offset, y: 0 }
    };
    this.facingDot.setPosition(delta[this.facing].x, delta[this.facing].y);
  }

  /** E2E・デバッグ用に現在地をDOMデータ属性へ反映する(#game要素) */
  private syncDomState(): void {
    const game = document.querySelector<HTMLDivElement>("#game");
    if (game !== null) {
      game.dataset["scene"] = "exploration";
      game.dataset["mapId"] = this.map.id;
      game.dataset["playerX"] = String(this.playerPosition.x);
      game.dataset["playerY"] = String(this.playerPosition.y);
      game.dataset["symbolCount"] = String(this.symbols.length);
      delete game.dataset["battleEnemy"];
    }
  }
}
