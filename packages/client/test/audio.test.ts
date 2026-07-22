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

// ===========================================================================
// BGM(M12-3)
// ===========================================================================

import {
  BGM_IDS,
  bgmAssetPath,
  currentBgmId,
  DEFAULT_BGM_VOLUME,
  getBgmVolume,
  isMuted,
  playBgm,
  requestBgm,
  setBgmVolume,
  setMuted,
  stopBgm,
  toggleMuted,
  type BgmScene,
  type BgmSound
} from "../src/audio.js";

/** フェイクの BgmScene。add したサウンドの play/stop/setVolume 呼び出しを記録する */
function makeFakeBgmScene(options: { exists?: boolean; locked?: boolean }): {
  scene: BgmScene;
  sounds: { play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; setVolume: ReturnType<typeof vi.fn> }[];
  unlockedHandlers: (() => void)[];
} {
  const sounds: {
    play: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    setVolume: ReturnType<typeof vi.fn>;
  }[] = [];
  const unlockedHandlers: (() => void)[] = [];
  const scene: BgmScene = {
    sound: {
      locked: options.locked ?? false,
      add: (): BgmSound => {
        const sound = { play: vi.fn(), stop: vi.fn(), setVolume: vi.fn() };
        sounds.push(sound);
        return sound;
      },
      once: (_event, handler): void => {
        unlockedHandlers.push(handler);
      }
    },
    cache: { audio: { exists: (): boolean => options.exists ?? true } }
  };
  return { scene, sounds, unlockedHandlers };
}

describe("BGM_IDS / bgmAssetPath", () => {
  it("台帳の 5 種の BGM id を持ち、配信パスは assets/audio/bgm/<id>.mp3", () => {
    expect(BGM_IDS).toHaveLength(5);
    expect(new Set(BGM_IDS).size).toBe(BGM_IDS.length);
    for (const id of BGM_IDS) {
      expect(bgmAssetPath(id)).toBe(`assets/audio/bgm/${id}.mp3`);
    }
  });
});

describe("playBgm / stopBgm", () => {
  afterEach(() => {
    stopBgm();
    setBgmVolume(DEFAULT_BGM_VOLUME);
    setMuted(false);
  });

  it("キャッシュに無い BGM は再生しない(無音で続行)", () => {
    const { scene, sounds } = makeFakeBgmScene({ exists: false });
    playBgm(scene, "bgm-title");
    expect(sounds).toHaveLength(0);
    expect(currentBgmId()).toBeNull();
  });

  it("再生開始し、同じ id の再要求では作り直さない", () => {
    const { scene, sounds } = makeFakeBgmScene({});
    playBgm(scene, "bgm-town");
    expect(sounds).toHaveLength(1);
    expect(sounds[0]?.play).toHaveBeenCalledTimes(1);
    expect(currentBgmId()).toBe("bgm-town");
    playBgm(scene, "bgm-town");
    expect(sounds).toHaveLength(1); // add は増えない
  });

  it("別の id へ切り替えると旧 BGM を停止して新 BGM を再生する", () => {
    const { scene, sounds } = makeFakeBgmScene({});
    playBgm(scene, "bgm-town");
    playBgm(scene, "bgm-battle");
    expect(sounds).toHaveLength(2);
    expect(sounds[0]?.stop).toHaveBeenCalled();
    expect(sounds[1]?.play).toHaveBeenCalledTimes(1);
    expect(currentBgmId()).toBe("bgm-battle");
  });

  it("WebAudio ロック中は解除時に再生を開始する", () => {
    const { scene, sounds, unlockedHandlers } = makeFakeBgmScene({ locked: true });
    playBgm(scene, "bgm-title");
    expect(sounds).toHaveLength(1);
    expect(sounds[0]?.play).not.toHaveBeenCalled();
    expect(unlockedHandlers).toHaveLength(1);
    unlockedHandlers[0]?.();
    expect(sounds[0]?.play).toHaveBeenCalledTimes(1);
  });

  it("ロック解除前に別 BGM へ切り替わった場合、古い予約は再生しない", () => {
    const { scene, sounds, unlockedHandlers } = makeFakeBgmScene({ locked: true });
    playBgm(scene, "bgm-title");
    playBgm(scene, "bgm-town");
    // 先に積まれた bgm-title の解除ハンドラが発火しても、現行(bgm-town)でないため無視される
    unlockedHandlers[0]?.();
    expect(sounds[0]?.play).not.toHaveBeenCalled();
  });

  it("setBgmVolume / setMuted は再生中の BGM へ即時反映される", () => {
    const { scene, sounds } = makeFakeBgmScene({});
    playBgm(scene, "bgm-dungeon");
    setBgmVolume(0.8);
    expect(sounds[0]?.setVolume).toHaveBeenCalledWith(0.8);
    setMuted(true);
    expect(sounds[0]?.setVolume).toHaveBeenCalledWith(0);
    expect(isMuted()).toBe(true);
  });

  it("toggleMuted は反転した状態を返し、ミュート中の playSe は鳴らさない", () => {
    expect(toggleMuted()).toBe(true);
    const { scene, play } = makeFakeScene({});
    playSe(scene, "se-confirm");
    expect(play).not.toHaveBeenCalled();
    expect(toggleMuted()).toBe(false);
  });

  it("getBgmVolume の既定は DEFAULT_BGM_VOLUME", () => {
    expect(getBgmVolume()).toBe(DEFAULT_BGM_VOLUME);
  });
});

describe("requestBgm(遅延読み込み)", () => {
  afterEach(() => {
    stopBgm();
  });

  it("未読み込みならローダーで読み込み、完了時にまだ要求が生きていれば再生する", () => {
    const sounds: { play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; setVolume: ReturnType<typeof vi.fn> }[] = [];
    let loaded = false;
    const completions: (() => void)[] = [];
    const loadAudio = vi.fn();
    const scene = {
      sound: {
        locked: false,
        add: (): BgmSound => {
          const s = { play: vi.fn(), stop: vi.fn(), setVolume: vi.fn() };
          sounds.push(s);
          return s;
        },
        once: (): void => {}
      },
      cache: { audio: { exists: (): boolean => loaded } },
      load: {
        audio: loadAudio,
        once: (_event: string, handler: () => void): void => {
          completions.push(handler);
        },
        start: vi.fn()
      }
    };
    requestBgm(scene, "bgm-town");
    expect(loadAudio).toHaveBeenCalledWith("bgm-town", "assets/audio/bgm/bgm-town.mp3");
    expect(sounds).toHaveLength(0); // まだ再生しない
    loaded = true;
    completions[0]?.();
    expect(sounds).toHaveLength(1);
    expect(sounds[0]?.play).toHaveBeenCalledTimes(1);
  });

  it("読み込み中に別の BGM が要求されたら、古い完了通知では再生しない", () => {
    const sounds: BgmSound[] = [];
    let townLoaded = false;
    const completions = new Map<string, () => void>();
    const makeScene = (existsFn: (key: string) => boolean) => ({
      sound: {
        locked: false,
        add: (): BgmSound => {
          const s = { play: vi.fn(), stop: vi.fn(), setVolume: vi.fn() };
          sounds.push(s);
          return s;
        },
        once: (): void => {}
      },
      cache: { audio: { exists: existsFn } },
      load: {
        audio: vi.fn(),
        once: (event: string, handler: () => void): void => {
          completions.set(event, handler);
        },
        start: vi.fn()
      }
    });
    const scene = makeScene((key) => (key === "bgm-town" ? townLoaded : true));
    requestBgm(scene, "bgm-town"); // 読み込み待ちへ
    requestBgm(scene, "bgm-battle"); // 読み込み済み=即再生・要求を上書き
    expect(sounds).toHaveLength(1); // bgm-battle のみ
    townLoaded = true;
    completions.get("filecomplete-audio-bgm-town")?.(); // 古い完了通知
    expect(sounds).toHaveLength(1); // bgm-town は再生されない
  });
});
