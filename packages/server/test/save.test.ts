import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createNewGameState, gameStateSchema } from "@dreaming-engine/shared";
import type { GameState } from "@dreaming-engine/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileSaveStore, resolveSaveDir } from "../src/game/save.js";

/**
 * セーブ/ロードのテスト(game-design.md「セーブ/ロード」)。
 * 一時ディレクトリを使い、人間のプレイセーブには触れない。
 */

let dir: string;
let store: FileSaveStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dreaming-save-test-"));
  store = new FileSaveStore(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function sampleState(day = 1): GameState {
  const state = createNewGameState();
  return { ...state, day };
}

const savePath = (): string => path.join(dir, "save1.json");
const bakPath = (): string => path.join(dir, "save1.json.bak");

describe("FileSaveStore: 保存(原子的置換)", () => {
  it("初回セーブでsave1.jsonが作られ、そのままロードできる", async () => {
    const state = sampleState();
    await store.save(state);

    const raw = JSON.parse(await readFile(savePath(), "utf8")) as unknown;
    expect(gameStateSchema.parse(raw)).toEqual(state);

    const loaded = await store.load();
    expect(loaded).toEqual({ ok: true, state });
  });

  it("2回目のセーブで直前セーブが.bakへ退避される(1世代)", async () => {
    const first = sampleState(1);
    const second = sampleState(2);
    await store.save(first);
    await store.save(second);

    const primary = gameStateSchema.parse(JSON.parse(await readFile(savePath(), "utf8")));
    const backup = gameStateSchema.parse(JSON.parse(await readFile(bakPath(), "utf8")));
    expect(primary.day).toBe(2);
    expect(backup.day).toBe(1);
  });

  it("セーブ後に一時ファイルの残骸を残さない", async () => {
    await store.save(sampleState(1));
    await store.save(sampleState(2));
    const files = (await readdir(dir)).sort();
    expect(files).toEqual(["save1.json", "save1.json.bak"]);
  });

  it("スキーマに合わない状態のセーブは拒否され、既存セーブを壊さない", async () => {
    await store.save(sampleState(1));
    const broken = { ...sampleState(2), day: -1 } as GameState;
    await expect(store.save(broken)).rejects.toThrow();
    const primary = gameStateSchema.parse(JSON.parse(await readFile(savePath(), "utf8")));
    expect(primary.day).toBe(1);
  });
});

describe("FileSaveStore: ロード(.bak復旧・破損フォールバック)", () => {
  it("両方存在しなければmissing(新規開始を促す)", async () => {
    expect(await store.load()).toEqual({ ok: false, reason: "missing" });
    expect(await store.exists()).toBe(false);
  });

  it("save1.jsonが壊れたJSONなら.bakから復旧する", async () => {
    const first = sampleState(1);
    await store.save(first);
    await store.save(sampleState(2));
    await writeFile(savePath(), "{ こわれた json", "utf8");

    const loaded = await store.load();
    expect(loaded).toEqual({ ok: true, state: first });
  });

  it("save1.jsonがスキーマ不一致でも.bakから復旧する", async () => {
    const first = sampleState(1);
    await store.save(first);
    await store.save(sampleState(2));
    await writeFile(savePath(), JSON.stringify({ hello: "world" }), "utf8");

    const loaded = await store.load();
    expect(loaded).toEqual({ ok: true, state: first });
  });

  it("両方壊れていればcorrupt(クラッシュしない)", async () => {
    await writeFile(savePath(), "garbage", "utf8");
    await writeFile(bakPath(), "{}", "utf8");
    expect(await store.load()).toEqual({ ok: false, reason: "corrupt" });
  });

  it("version不一致は破損と同扱い(corrupt)", async () => {
    const state = sampleState();
    await writeFile(savePath(), JSON.stringify({ ...state, version: 2 }), "utf8");
    expect(await store.load()).toEqual({ ok: false, reason: "corrupt" });
  });

  it(".bakのみ存在する場合もexists=trueでロードできる", async () => {
    const state = sampleState();
    await writeFile(bakPath(), JSON.stringify(state), "utf8");
    expect(await store.exists()).toBe(true);
    expect(await store.load()).toEqual({ ok: true, state });
  });

  it("save1.jsonが正常なら.bakより優先する", async () => {
    const primary = sampleState(3);
    const backup = sampleState(1);
    await writeFile(savePath(), JSON.stringify(primary), "utf8");
    await writeFile(bakPath(), JSON.stringify(backup), "utf8");
    expect(await store.load()).toEqual({ ok: true, state: primary });
  });
});

describe("resolveSaveDir", () => {
  it("SAVE_DIRがあればそれを絶対パスに解決する", () => {
    expect(resolveSaveDir({ SAVE_DIR: "/tmp/dreaming-saves" })).toBe(
      path.resolve("/tmp/dreaming-saves")
    );
    expect(resolveSaveDir({ SAVE_DIR: "relative/saves" })).toBe(path.resolve("relative/saves"));
  });

  it("SAVE_DIRが未設定・空ならcwdのsaves/を使う", () => {
    expect(resolveSaveDir({})).toBe(path.resolve(process.cwd(), "saves"));
    expect(resolveSaveDir({ SAVE_DIR: "" })).toBe(path.resolve(process.cwd(), "saves"));
  });
});
