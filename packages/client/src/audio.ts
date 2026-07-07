/**
 * 効果音(SE)の再生基盤(M12-2)。
 *
 * 台帳 `assets/audio/README.md` の 12 種の SE を id で扱う。id はファイル名(拡張子なし)と
 * 一致し、`assets/audio/se/<id>.ogg` を直接パスで読み込む(manifest 対象外)。
 *
 * フェイルセーフ思想(asset-pipeline.md「音声アセットの方針」): 音声はあくまで演出であり、
 * 未ロード・WebAudio ロック中(ユーザー操作前)・音声無効環境でも **例外を投げず無音で続行** する。
 * try/catch で握るだけでなく、存在確認(cache)・ロック確認をしてから鳴らす。
 *
 * BGM・音量設定 UI は M12-3 で扱う。本モジュールの音量状態は setter で可変化できる形にしておく。
 */

/**
 * 効果音 ID(`assets/audio/README.md` の台帳表と一致)。
 * クライアントはこの id でロード・再生する。
 */
export const SE_IDS = [
  "se-cursor", // メニューカーソル移動
  "se-confirm", // 決定
  "se-cancel", // キャンセル/戻る
  "se-error", // 操作の拒否(MP不足・満杯・資金不足等)
  "se-attack", // 攻撃ヒット
  "se-skill", // スキル発動
  "se-damage", // 被ダメージ
  "se-heal", // 回復(アイテム・スキル)
  "se-coin", // 売買成立
  "se-door", // マップ遷移
  "se-levelup", // レベルアップ
  "se-victory" // 戦闘勝利
] as const;

/** 効果音 ID の型(台帳 12 種のいずれか) */
export type SeId = (typeof SE_IDS)[number];

/** 効果音ファイルの配信パス(直接パス。manifest 対象外) */
export function seAssetPath(id: SeId): string {
  return `assets/audio/se/${id}.ogg`;
}

/**
 * SE の既定音量(0〜1)。M12-3 の設定 UI で可変化する前提の初期値。
 * 聴感の最終確認は人間プレイ待ち(README)。ジングル系(levelup/victory)も同一音量で始め、
 * 個別バランスは人間確認後 or M12-3 で調整する。
 */
export const DEFAULT_SE_VOLUME = 0.5;

/** 現在の SE 音量(0〜1)。setSeVolume で変更する(M12-3 の音量 UI の受け皿) */
let seVolume = DEFAULT_SE_VOLUME;

/** 値を [0, 1] に丸める */
function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

/** 現在の SE 音量(0〜1)を返す */
export function getSeVolume(): number {
  return seVolume;
}

/**
 * SE 音量(0〜1)を設定する。範囲外・NaN は丸める。
 * 音量設定 UI(M12-3)がこの setter で変更し、localStorage へ永続化する。
 */
export function setSeVolume(value: number): void {
  seVolume = clamp01(value);
  saveSettings();
}

// ===========================================================================
// BGM(M12-3)。台帳 assets/audio/README.md の bgm/ 節が正
// ===========================================================================

/** BGM ID(台帳表と一致。id はファイル名(拡張子なし)) */
export const BGM_IDS = [
  "bgm-title", // タイトル(オープニングにも流し続ける)
  "bgm-town", // 街(灯町)
  "bgm-field", // フィールド(忘れ野)
  "bgm-dungeon", // ダンジョン(裂け目 全層)
  "bgm-battle" // 戦闘
] as const;

/** BGM ID の型(台帳 5 種のいずれか) */
export type BgmId = (typeof BGM_IDS)[number];

/** BGM ファイルの配信パス(直接パス。manifest 対象外) */
export function bgmAssetPath(id: BgmId): string {
  return `assets/audio/bgm/${id}.mp3`;
}

/** BGM の既定音量(0〜1)。環境音として控えめに始める(聴感の最終確認は人間プレイ待ち) */
export const DEFAULT_BGM_VOLUME = 0.4;

/** 現在の BGM 音量(0〜1) */
let bgmVolume = DEFAULT_BGM_VOLUME;

/** ミュート(SE・BGM 共通のマスター)。オンの間は実効音量 0 として扱う */
let muted = false;

/** 現在の BGM 音量(0〜1)を返す */
export function getBgmVolume(): number {
  return bgmVolume;
}

/** BGM 音量(0〜1)を設定し、再生中の BGM へ即時反映する */
export function setBgmVolume(value: number): void {
  bgmVolume = clamp01(value);
  applyBgmVolume();
  saveSettings();
}

/** ミュート中か */
export function isMuted(): boolean {
  return muted;
}

/** ミュート(SE・BGM 共通)を設定し、再生中の BGM へ即時反映する */
export function setMuted(value: boolean): void {
  muted = value;
  applyBgmVolume();
  saveSettings();
}

/** ミュートを反転して新しい状態を返す(設定 UI のトグル用) */
export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

// ---------------------------------------------------------------------------
// 設定の永続化(localStorage。非ブラウザ環境・失敗時は黙って既定値のまま)
// ---------------------------------------------------------------------------

const AUDIO_SETTINGS_KEY = "dreaming-engine.audio";

/** 現在の音量・ミュート設定を localStorage へ保存する(失敗は無害) */
function saveSettings(): void {
  try {
    globalThis.localStorage?.setItem(
      AUDIO_SETTINGS_KEY,
      JSON.stringify({ seVolume, bgmVolume, muted })
    );
  } catch {
    // プライベートモード等で保存できなくても進行に影響しない
  }
}

/** localStorage から音量・ミュート設定を読み込む(型が崩れていても既定値で続行) */
function loadSettings(): void {
  try {
    const raw = globalThis.localStorage?.getItem(AUDIO_SETTINGS_KEY);
    if (raw === null || raw === undefined) {
      return;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record["seVolume"] === "number") {
      seVolume = clamp01(record["seVolume"]);
    }
    if (typeof record["bgmVolume"] === "number") {
      bgmVolume = clamp01(record["bgmVolume"]);
    }
    if (typeof record["muted"] === "boolean") {
      muted = record["muted"];
    }
  } catch {
    // 壊れた保存値は無視して既定値で続行
  }
}

// モジュール読み込み時に一度だけ復元する(非ブラウザ環境ではガードにより何もしない)
loadSettings();

/**
 * playSe が必要とする Phaser Scene の最小構造。
 * Phaser.Scene が構造的に適合する(sound/cache を持つ)ため、シーンからは `playSe(this, id)` で呼べる。
 * テストではこの構造のフェイクを注入して検証する(font.ts の FontLoader と同じ注入方式)。
 */
export interface SoundScene {
  sound: {
    /** WebAudio がユーザー操作前でロックされている間は true。ロック中は鳴らさない */
    readonly locked: boolean;
    /** 効果音を再生する(config.volume は 0〜1) */
    play(key: string, config?: { volume?: number }): boolean;
  };
  cache: {
    audio: {
      /** 指定 id の音声がキャッシュに存在するか(ロード成功しているか) */
      exists(key: string): boolean;
    };
  };
}

/**
 * 効果音を鳴らす(フェイルセーフ)。以下のいずれでも **例外を投げず無音で返す**:
 * - scene/sound/cache が無い(音声無効環境・テスト外の想定外呼び出し)
 * - 音声が未ロード(ロード失敗・キャッシュに無い)
 * - WebAudio がロック中(初回ユーザー操作前)
 * - 音量が 0(ミュート相当)
 * 連打時の多重再生は Phaser の既定に従い許容する。
 */
export function playSe(scene: SoundScene | undefined | null, id: SeId): void {
  try {
    if (scene === undefined || scene === null) {
      return;
    }
    const { sound, cache } = scene;
    if (sound === undefined || cache === undefined) {
      return;
    }
    // 未ロード(ロード失敗・音声無効環境)は無音で続行
    if (!cache.audio.exists(id)) {
      return;
    }
    // WebAudio ロック中(初回ユーザー操作前)は鳴らさない(警告・例外を避ける)
    if (sound.locked) {
      return;
    }
    const volume = muted ? 0 : clamp01(seVolume);
    if (volume <= 0) {
      return;
    }
    sound.play(id, { volume });
  } catch (error) {
    // 演出である SE の失敗はゲーム進行を止めない(画像プレースホルダーと同じ思想)
    console.warn(`[audio] 効果音の再生に失敗しました: ${id}`, error);
  }
}

// ---------------------------------------------------------------------------
// BGM の再生(ループ・フェードイン・シーン跨ぎの一元管理)
// ---------------------------------------------------------------------------

/** playBgm が扱う BGM サウンドの最小構造(Phaser.Sound.BaseSound が適合する) */
export interface BgmSound {
  play(): unknown;
  stop(): unknown;
  setVolume(value: number): unknown;
}

/**
 * playBgm が必要とする Phaser Scene の最小構造(SoundScene の拡張)。
 * Phaser.Scene が構造的に適合する。テストではフェイクを注入する。
 */
export interface BgmScene {
  sound: {
    readonly locked: boolean;
    /** ループ再生する BGM サウンドを生成する */
    add(key: string, config?: { loop?: boolean; volume?: number }): BgmSound;
    /** WebAudio のロック解除(初回ユーザー操作)を一度だけ待つ */
    once(event: "unlocked", handler: () => void): unknown;
  };
  cache: {
    audio: {
      exists(key: string): boolean;
    };
  };
  /** フェードイン用(シーン破棄で止まっても実害がないため任意) */
  tweens?: {
    add(config: {
      targets: unknown;
      volume: number;
      duration: number;
      ease?: string;
    }): unknown;
  };
}

/** 再生中の BGM(サウンドマネージャはゲーム全体で共有のため、モジュールで一元管理する) */
let currentBgm: { id: BgmId; sound: BgmSound } | null = null;

/** ミュートを織り込んだ BGM の実効音量 */
function effectiveBgmVolume(): number {
  return muted ? 0 : clamp01(bgmVolume);
}

/** 音量・ミュート変更を再生中の BGM へ反映する(未再生なら何もしない) */
function applyBgmVolume(): void {
  try {
    currentBgm?.sound.setVolume(effectiveBgmVolume());
  } catch {
    // 破棄済みサウンドへの適用失敗は無害
  }
}

/**
 * BGM を切り替える(フェイルセーフ)。同じ id が再生中なら何もしない。
 * 未ロード・音声無効環境では無音で続行し、WebAudio ロック中は解除時に再生を開始する。
 * 切替は旧BGMを即停止し、新BGMを音量0から実効音量へ短くフェードインする
 * (フェードは tweens が使える場合のみ。シーン破棄でフェードが止まっても音量は setVolume 済み想定で無害)。
 */
export function playBgm(scene: BgmScene | undefined | null, id: BgmId): void {
  try {
    if (scene === undefined || scene === null) {
      return;
    }
    if (currentBgm?.id === id) {
      applyBgmVolume();
      return;
    }
    const { sound, cache } = scene;
    if (sound === undefined || cache === undefined) {
      return;
    }
    stopBgm();
    if (!cache.audio.exists(id)) {
      return;
    }
    const bgm = sound.add(id, { loop: true, volume: effectiveBgmVolume() });
    currentBgm = { id, sound: bgm };
    const start = (): void => {
      try {
        // 停止→開始の間に別BGMへ切り替わっていたら開始しない(ロック解除待ちの古い予約)
        if (currentBgm?.sound !== bgm) {
          return;
        }
        bgm.play();
        // 短いフェードイン(tweens が無い環境では即時に実効音量)
        const target = effectiveBgmVolume();
        if (scene.tweens !== undefined && target > 0) {
          bgm.setVolume(0);
          scene.tweens.add({ targets: bgm, volume: target, duration: 600, ease: "Linear" });
        }
      } catch (error) {
        console.warn(`[audio] BGMの再生に失敗しました: ${id}`, error);
      }
    };
    if (sound.locked) {
      // 初回ユーザー操作(ロック解除)後に開始する
      sound.once("unlocked", start);
      return;
    }
    start();
  } catch (error) {
    console.warn(`[audio] BGMの切替に失敗しました: ${id}`, error);
  }
}

/** BGM を停止する(未再生なら何もしない。失敗は無害) */
export function stopBgm(): void {
  try {
    currentBgm?.sound.stop();
  } catch {
    // 破棄済みサウンドの停止失敗は無害
  }
  currentBgm = null;
}

/** 再生中の BGM id(テスト・デバッグ用。未再生なら null) */
export function currentBgmId(): BgmId | null {
  return currentBgm?.id ?? null;
}

// ---------------------------------------------------------------------------
// BGM の遅延読み込み(preload をブロックしない。M12-3)
// ---------------------------------------------------------------------------

/**
 * requestBgm が必要とするローダーの最小構造(Phaser.Scene の load が適合する)。
 * BGM はデコードが重い(headless E2E で preload を数十秒塞いだ実績)ため、
 * 起動時の preload では読み込まず、シーンが要求した時にバックグラウンドで読み込む。
 */
export interface BgmLoaderScene extends BgmScene {
  load: {
    audio(key: string, url: string): unknown;
    once(event: string, handler: () => void): unknown;
    start(): unknown;
  };
}

/**
 * 最後に要求された BGM id。読み込み完了時に「まだこの曲が望まれているか」を確認する
 * (読み込み中にシーンが変わって別の曲が要求されたら、古い完了通知では再生しない)。
 */
let desiredBgm: BgmId | null = null;

/**
 * BGM を要求する(シーンからの入口)。読み込み済みなら即再生、未読み込みなら
 * バックグラウンドで読み込み、完了時にまだ要求が生きていれば再生する。
 * すべてフェイルセーフ(失敗・音声無効環境では無音のままゲームを続行する)。
 */
export function requestBgm(scene: BgmLoaderScene | undefined | null, id: BgmId): void {
  try {
    if (scene === undefined || scene === null) {
      return;
    }
    desiredBgm = id;
    if (scene.cache?.audio.exists(id)) {
      playBgm(scene, id);
      return;
    }
    // 未読み込み: シーンのローダーで非同期に読み込む(create 後でも start() で走る)
    scene.load.once(`filecomplete-audio-${id}`, () => {
      if (desiredBgm === id) {
        playBgm(scene, id);
      }
    });
    scene.load.audio(id, bgmAssetPath(id));
    scene.load.start();
  } catch (error) {
    console.warn(`[audio] BGMの読み込み要求に失敗しました: ${id}`, error);
  }
}
