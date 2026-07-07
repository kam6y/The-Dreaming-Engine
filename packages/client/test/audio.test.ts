import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SE_VOLUME,
  getSeVolume,
  playSe,
  seAssetPath,
  setSeVolume,
  SE_IDS,
  type SeId,
  type SoundScene
} from "../src/audio.js";

/**
 * フェイクの Scene(sound/cache)を組み立てる。exists・locked を差し替えて
 * フェイルセーフ経路を検証する。play は呼び出しを記録するモック。
 */
function makeFakeScene(options: {
  exists?: boolean;
  locked?: boolean;
}): { scene: SoundScene; play: ReturnType<typeof vi.fn>; exists: ReturnType<typeof vi.fn> } {
  const play = vi.fn((): boolean => true);
  const exists = vi.fn((): boolean => options.exists ?? true);
  const scene: SoundScene = {
    sound: { locked: options.locked ?? false, play },
    cache: { audio: { exists } }
  };
  return { scene, play, exists };
}

describe("SE_IDS / seAssetPath", () => {
  it("台帳の 12 種の SE id を持つ", () => {
    expect(SE_IDS).toHaveLength(12);
    // 台帳(assets/audio/README.md)の id と一致する主要どころ
    expect(SE_IDS).toContain("se-cursor");
    expect(SE_IDS).toContain("se-coin");
    expect(SE_IDS).toContain("se-victory");
    // 重複が無い
    expect(new Set(SE_IDS).size).toBe(SE_IDS.length);
  });

  it("配信パスは assets/audio/se/<id>.ogg", () => {
    expect(seAssetPath("se-door")).toBe("assets/audio/se/se-door.ogg");
    for (const id of SE_IDS) {
      expect(seAssetPath(id)).toBe(`assets/audio/se/${id}.ogg`);
    }
  });
});

describe("音量状態", () => {
  afterEach(() => {
    setSeVolume(DEFAULT_SE_VOLUME);
  });

  it("既定音量は DEFAULT_SE_VOLUME", () => {
    expect(getSeVolume()).toBe(DEFAULT_SE_VOLUME);
  });

  it("setSeVolume は [0,1] に丸める", () => {
    setSeVolume(0.3);
    expect(getSeVolume()).toBe(0.3);
    setSeVolume(2);
    expect(getSeVolume()).toBe(1);
    setSeVolume(-1);
    expect(getSeVolume()).toBe(0);
    setSeVolume(Number.NaN);
    expect(getSeVolume()).toBe(0);
  });
});

describe("playSe(フェイルセーフ)", () => {
  afterEach(() => {
    setSeVolume(DEFAULT_SE_VOLUME);
    vi.restoreAllMocks();
  });

  it("(a) キャッシュに音が無い場合は play を呼ばない", () => {
    const { scene, play } = makeFakeScene({ exists: false });
    playSe(scene, "se-cursor");
    expect(play).not.toHaveBeenCalled();
  });

  it("WebAudio ロック中は play を呼ばない", () => {
    const { scene, play } = makeFakeScene({ locked: true });
    playSe(scene, "se-confirm");
    expect(play).not.toHaveBeenCalled();
  });

  it("scene が無い(音声無効環境)場合も例外を投げず何もしない", () => {
    expect(() => {
      playSe(undefined, "se-cursor");
      playSe(null, "se-cursor");
    }).not.toThrow();
  });

  it("(c) ロード済み・非ロック時は現在の音量で play を呼ぶ", () => {
    const { scene, play } = makeFakeScene({});
    setSeVolume(0.4);
    playSe(scene, "se-coin");
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith("se-coin", { volume: 0.4 });
  });

  it("音量 0 の場合は play を呼ばない", () => {
    const { scene, play } = makeFakeScene({});
    setSeVolume(0);
    playSe(scene, "se-attack");
    expect(play).not.toHaveBeenCalled();
  });

  it("(b) play が例外を投げても呼び出し元へ伝播しない", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const play = vi.fn((): boolean => {
      throw new Error("WebAudio failure");
    });
    const scene: SoundScene = {
      sound: { locked: false, play },
      cache: { audio: { exists: () => true } }
    };
    expect(() => {
      playSe(scene, "se-victory");
    }).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it("cache.audio.exists には再生 id をそのまま渡す", () => {
    const { scene, exists } = makeFakeScene({});
    const id: SeId = "se-levelup";
    playSe(scene, id);
    expect(exists).toHaveBeenCalledWith(id);
  });
});
