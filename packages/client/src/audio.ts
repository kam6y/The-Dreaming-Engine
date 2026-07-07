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
 * M12-3 の音量設定 UI がこの setter で可変化する(BGM は別系統で追加予定)。
 */
export function setSeVolume(value: number): void {
  seVolume = clamp01(value);
}

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
    const volume = clamp01(seVolume);
    if (volume <= 0) {
      return;
    }
    sound.play(id, { volume });
  } catch (error) {
    // 演出である SE の失敗はゲーム進行を止めない(画像プレースホルダーと同じ思想)
    console.warn(`[audio] 効果音の再生に失敗しました: ${id}`, error);
  }
}
