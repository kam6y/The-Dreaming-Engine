import Phaser from "phaser";

import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_DISPLAY_NAMES,
  DIFFICULTY_ORDER,
  GAME_TITLE,
  difficultySchema,
  type ClientMessage
} from "@dreaming-engine/shared";

import { requestBgm } from "../audio.js";
import { clearDialogQueue } from "../dialog-queue.js";
import { getGameClient } from "../net/game-client.js";
import { ConfirmDialog } from "../ui/confirm-dialog.js";
import { fitCover } from "../ui/cover-image.js";
import { UI_FONT_FAMILY } from "../ui/font.js";
import { MenuList } from "../ui/menu-list.js";
import { SettingsOverlay } from "../ui/settings-overlay.js";
import { continueOptionsFromUrl, newGameOptionsFromUrl, shouldSkipIntro } from "../url-flags.js";

/**
 * タイトル画面。「新規ゲーム」と「つづきから」のメニューを持つ。
 * - 「つづきから」はサーバーの hello(セーブ有無)で有効化する
 * - 既存セーブがあるときの「新規ゲーム」は上書き確認を挟む(実際の上書きは
 *   新規開始後の最初の宿泊セーブ時: game-design.md「セーブ/ロード」)
 * - 新規ゲームは難易度3択(やさしい/ふつう/むずかしい。M25)を1ステップ挟む。
 *   ?skipIntro=1(テスト専用の手順スキップ)のときは選択を飛ばし、URLの ?difficulty=
 *   (未指定なら normal)で開始する(既存E2Eの開始手順を変えないための決定論経路)
 * - 探索への遷移は自分が要求した new-game / continue への snapshot でのみ行う
 *   (再接続時の再同期 snapshot では遷移しない)
 * スケールモードRESIZEのため、リサイズ時に中央へ再配置する。
 */
export class TitleScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;

  private subtitleText!: Phaser.GameObjects.Text;

  private statusText!: Phaser.GameObjects.Text;

  /** 操作キーの常設ヘルプ(画面下端。M15-2: 操作説明の不在への対処) */
  private keyHelpText!: Phaser.GameObjects.Text;

  private menu: MenuList | null = null;

  private uiLayer!: Phaser.GameObjects.Container;

  /** タイトル背景画像(未整備時は null=黒背景のまま) */
  private background: Phaser.GameObjects.Image | null = null;

  /** 背景の上に敷く暗幕(タイトル文字の可読性確保) */
  private veil: Phaser.GameObjects.Rectangle | null = null;

  private confirm: ConfirmDialog | null = null;

  /** 音量・ミュートの設定オーバーレイ(「設定」で開閉。M12-3) */
  private settings: SettingsOverlay | null = null;

  /** 難易度3択メニュー(新規ゲームの1ステップ。Esc でタイトルへ戻る。M25-3) */
  private difficultyMenu: MenuList | null = null;

  /** 難易度選択の見出し(メニューと同時に出し入れする) */
  private difficultyPrompt: Phaser.GameObjects.Text | null = null;

  /** 接続確立前に選択された場合に接続後へ持ち越す送信待ちメッセージ */
  private pendingMessage: ClientMessage | null = null;

  /** 自分の要求(new-game / continue)に対する snapshot 待ちか */
  private requested = false;

  /** 待っている要求が new-game か(true=遷移先はオープニング、false=探索へ直行) */
  private requestedNewGame = false;

  private unsubscribes: (() => void)[] = [];

  public constructor() {
    super("title");
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#000000");
    // 背景画像(あれば)を最背面に敷く。可読性のため上に薄い暗幕を重ねる
    this.background = null;
    this.veil = null;
    if (this.textures.exists("title-background")) {
      this.background = this.add.image(0, 0, "title-background").setOrigin(0.5).setDepth(-10);
      this.veil = this.add
        .rectangle(0, 0, this.scale.width, this.scale.height, 0x0b0d12, 0.45)
        .setOrigin(0, 0)
        .setDepth(-9);
    }
    // メニュー・確認ダイアログはタイトル文字より前面に描画する
    this.uiLayer = this.add.container(0, 0).setDepth(10);
    this.confirm = null;
    this.settings = null;
    this.difficultyMenu = null;
    this.difficultyPrompt = null;
    this.pendingMessage = null;
    this.requested = false;

    // タイトルBGM(遅延読み込み: preloadを塞がない。ロック中はaudio.ts側で解除後に開始)
    requestBgm(this, "bgm-title");

    this.titleText = this.add
      .text(0, 0, GAME_TITLE, {
        color: "#f1eee4",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "44px"
      })
      .setOrigin(0.5);
    this.subtitleText = this.add
      .text(0, 0, "夢見る機関は、まだ微かに動いている。", {
        color: "#a9b0ba",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "20px"
      })
      .setOrigin(0.5);
    this.statusText = this.add
      .text(0, 0, "", {
        color: "#c98f9a",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "16px"
      })
      .setOrigin(0.5);
    this.keyHelpText = this.add
      .text(0, 0, "移動 ↑↓←→ / WASD ・ 調べる/決定 スペース ・ もちもの Esc ・ クエスト Q", {
        color: "#a9b0ba",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "14px"
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.85);

    this.buildMenu();

    const client = getGameClient();
    this.unsubscribes = [
      // hello(セーブ有無)で「つづきから」の有効/無効を反映する
      client.on("hello", () => {
        this.buildMenu();
        this.syncDomState();
      }),
      client.on("snapshot", () => {
        if (this.requested) {
          this.startExploration();
        }
      }),
      client.on("server-error", (error) => {
        // つづきから失敗(no-save / save-corrupted)等。メニューへ戻す
        if (this.requested || this.pendingMessage !== null) {
          this.requested = false;
          this.pendingMessage = null;
          this.statusText.setText(error.message);
          this.menu?.activate();
        }
      })
    ];

    this.layout();
    this.menu?.activate();
    this.syncDomState();

    const onResize = (): void => {
      this.layout();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      for (const unsubscribe of this.unsubscribes) {
        unsubscribe();
      }
      this.unsubscribes = [];
    });
  }

  public override update(): void {
    // 接続確立前に選択された操作を、送信できるようになった時点で送る
    if (this.pendingMessage !== null && getGameClient().send(this.pendingMessage)) {
      this.pendingMessage = null;
    }
  }

  /** セーブ有無に応じてメニューを組み直す(hello 受信時に呼ばれる) */
  private buildMenu(): void {
    const wasActive = this.menu?.isActive ?? false;
    this.menu?.destroy();
    const hasSave = getGameClient().hasSave === true;
    this.menu = new MenuList(this, this.uiLayer, {
      items: [
        { id: "new-game", label: "新規ゲーム" },
        { id: "continue", label: "つづきから", disabled: !hasSave },
        { id: "settings", label: "設定" }
      ],
      x: 0,
      y: 0,
      width: 240,
      // セーブがあるときは「つづきから」を初期選択にする(M15-3: 復帰プレイヤーの期待)
      initialIndex: hasSave ? 1 : 0,
      onSelect: (id) => {
        this.onMenuSelected(id);
      }
    });
    this.layout();
    if (wasActive || this.scene.isActive()) {
      // 確認ダイアログ・設定表示中・要求送信中はメニューを受け付けない
      if (
        this.confirm === null &&
        this.settings === null &&
        this.difficultyMenu === null &&
        !this.requested &&
        this.pendingMessage === null
      ) {
        this.menu.activate();
      }
    }
  }

  private onMenuSelected(id: string): void {
    if (id === "new-game") {
      if (getGameClient().hasSave === true) {
        this.openOverwriteConfirm();
        return;
      }
      this.proceedNewGame();
      return;
    }
    if (id === "continue") {
      this.request({ type: "continue", options: continueOptionsFromUrl() });
    }
    if (id === "settings") {
      this.openSettings();
    }
  }

  /** 音量・ミュートの設定を開く(閉じるとメニューへ戻る。M12-3) */
  private openSettings(): void {
    this.menu?.deactivate();
    this.settings = new SettingsOverlay(this, this.uiLayer, {
      onClose: () => {
        this.settings?.destroy();
        this.settings = null;
        this.time.delayedCall(0, () => {
          this.menu?.activate();
        });
      }
    });
  }

  /** 既存セーブがある場合の新規ゲーム上書き確認 */
  private openOverwriteConfirm(): void {
    this.menu?.deactivate();
    this.confirm = new ConfirmDialog(this, this.uiLayer, {
      message:
        "すでに記録された夢がある。\n新しく始めると、次に宿で休んだとき、古い記録は上書きされる。\nそれでも新しい夢を見るか?",
      yesLabel: "新しく始める",
      noLabel: "やめる",
      onResult: (yes) => {
        this.confirm = null;
        if (yes) {
          this.proceedNewGame();
        } else {
          this.menu?.activate();
        }
      }
    });
  }

  /**
   * 新規ゲームへ進む(M25-3)。通常は難易度3択を1ステップ挟む。
   * ?skipIntro=1(テスト専用の手順スキップ)のときは選択を飛ばし、URLの ?difficulty=
   * (未指定なら normal)で即開始する(既存E2Eの「新規ゲーム→即探索待ち」手順を壊さない。
   * skipIntro 無しの実プレイでは必ず3択を通る)。
   */
  private proceedNewGame(): void {
    if (shouldSkipIntro()) {
      this.request({ type: "new-game", options: newGameOptionsFromUrl() });
      return;
    }
    this.openDifficultySelect();
  }

  /** 難易度3択(M25-3)。既定カーソル=ふつう。Esc でタイトルメニューへ戻る */
  private openDifficultySelect(): void {
    this.menu?.deactivate();
    this.difficultyPrompt = this.add
      .text(0, 0, "挑む夢の重さを選ぶ", {
        color: "#d8c98f",
        fontFamily: UI_FONT_FAMILY,
        fontSize: "18px"
      })
      .setOrigin(0.5);
    this.uiLayer.add(this.difficultyPrompt);
    this.difficultyMenu = new MenuList(this, this.uiLayer, {
      items: DIFFICULTY_ORDER.map((id) => ({ id, label: DIFFICULTY_DISPLAY_NAMES[id] })),
      x: 0,
      y: 0,
      width: 240,
      initialIndex: DIFFICULTY_ORDER.indexOf(DEFAULT_DIFFICULTY),
      onSelect: (id) => {
        const parsed = difficultySchema.parse(id);
        this.closeDifficultySelect();
        // 選択値が正(URLの ?difficulty= より優先)。それ以外のURLフラグは従来どおり運ぶ
        this.request({ type: "new-game", options: { ...newGameOptionsFromUrl(), difficulty: parsed } });
      },
      onCancel: () => {
        this.closeDifficultySelect();
        this.menu?.activate();
      }
    });
    this.layout();
    this.difficultyMenu.activate();
    this.syncDomState(); // data-menu=difficulty を反映
  }

  private closeDifficultySelect(): void {
    this.difficultyMenu?.destroy();
    this.difficultyMenu = null;
    this.difficultyPrompt?.destroy();
    this.difficultyPrompt = null;
    this.syncDomState(); // data-menu を消す
  }

  /** new-game / continue をサーバーへ要求し、snapshot での遷移を待つ */
  private request(message: ClientMessage): void {
    this.menu?.deactivate();
    this.statusText.setText("");
    this.requested = true;
    // 新規ゲームはオープニングを経由し、つづきからは保存地点(探索)へ直行する。
    // 判定は要求(=新規ゲームの操作)で行い、snapshot の段階には依存しない
    // (再接続の再同期 snapshot でオープニングが再生されないようにする)
    this.requestedNewGame = message.type === "new-game";
    if (!getGameClient().send(message)) {
      // 未接続なら update() で接続確立後に再送する
      this.pendingMessage = message;
    }
  }

  private startExploration(): void {
    // 新規ゲームはオープニングを経由(?skipIntro=1 のときは演出を飛ばして探索へ直行)
    const toOpening = this.requestedNewGame && !shouldSkipIntro();
    this.requested = false;
    this.requestedNewGame = false;
    this.pendingMessage = null;
    // 前のプレイの未表示ダイアログを持ち越さない
    clearDialogQueue();
    this.menu?.deactivate();
    this.scene.start(toOpening ? "opening" : "exploration");
  }

  private layout(): void {
    if (this.background !== null) {
      fitCover(this.background, this.scale.width, this.scale.height);
    }
    this.veil?.setSize(this.scale.width, this.scale.height);
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    this.titleText.setPosition(centerX, centerY - 96);
    this.subtitleText.setPosition(centerX, centerY - 36);
    this.statusText.setPosition(centerX, centerY + 24);
    this.menu?.setPosition(centerX - 120, centerY + 48);
    this.difficultyPrompt?.setPosition(centerX, centerY + 24);
    this.difficultyMenu?.setPosition(centerX - 120, centerY + 48);
    this.keyHelpText.setPosition(centerX, this.scale.height - 16);
  }

  /** E2E・デバッグ用にタイトル状態をDOMデータ属性へ反映する(#game要素) */
  private syncDomState(): void {
    const game = document.querySelector<HTMLDivElement>("#game");
    if (game === null) {
      return;
    }
    game.dataset["scene"] = "title";
    game.dataset["hasSave"] = getGameClient().hasSave === true ? "1" : "0";
    // E2E 用: 難易度3択の開閉(M25-3。開いていないときは前シーンの残留値ごと消す)
    if (this.difficultyMenu !== null) {
      game.dataset["menu"] = "difficulty";
    } else {
      delete game.dataset["menu"];
    }
    delete game.dataset["mapId"];
    delete game.dataset["playerX"];
    delete game.dataset["playerY"];
    delete game.dataset["symbolCount"];
    delete game.dataset["battleEnemy"];
  }
}
