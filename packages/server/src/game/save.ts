import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { gameStateSchema, type GameState } from "@dreaming-engine/shared";

/**
 * セーブ/ロード(game-design.md「セーブ/ロード」厳守)。
 *
 * - 保存先は `<SAVE_DIR>/save1.json`(既定は cwd の `saves/`。環境変数 SAVE_DIR でテスト専用へ切替)。
 * - 原子的置換: 一時ファイルに書いてから rename で置き換える。
 * - 置換時に直前のセーブを `save1.json.bak` として1世代保持する。
 * - ロードは zod 検証。壊れていれば `.bak` から復旧を試み、両方駄目なら新規開始を促す。
 * - version 不一致も破損と同扱い(gameStateSchema が version をリテラル検証するため parse 失敗になる)。
 */

/** ロード結果(壊れていてもクラッシュせず理由を返す) */
export type LoadResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: "missing" | "corrupt" };

export interface SaveStore {
  /** セーブ(または .bak)が存在するか(hello の hasSave 用) */
  exists(): Promise<boolean>;
  /** ロード。壊れていれば .bak を試み、両方駄目なら reason を返す */
  load(): Promise<LoadResult>;
  /** 原子的にセーブ(直前セーブを .bak へ退避) */
  save(state: GameState): Promise<void>;
}

/** 単一ファイルの読み取り試行の結果 */
type ReadAttempt = { status: "ok"; state: GameState } | { status: "absent" } | { status: "bad" };

async function tryRead(filePath: string): Promise<ReadAttempt> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { status: "absent" };
    // 読み取り不能(権限等)は破損と同扱い(クラッシュさせない)
    return { status: "bad" };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { status: "bad" };
  }
  const parsed = gameStateSchema.safeParse(json);
  if (!parsed.success) return { status: "bad" };
  return { status: "ok", state: parsed.data };
}

export class FileSaveStore implements SaveStore {
  private readonly dir: string;

  public constructor(dir: string) {
    this.dir = dir;
  }

  private get savePath(): string {
    return path.join(this.dir, "save1.json");
  }

  private get bakPath(): string {
    return path.join(this.dir, "save1.json.bak");
  }

  public async exists(): Promise<boolean> {
    return existsSync(this.savePath) || existsSync(this.bakPath);
  }

  public async load(): Promise<LoadResult> {
    const primary = await tryRead(this.savePath);
    if (primary.status === "ok") return { ok: true, state: primary.state };

    // save1.json が壊れている/無い → .bak から復旧を試みる
    const backup = await tryRead(this.bakPath);
    if (backup.status === "ok") return { ok: true, state: backup.state };

    // 両方駄目: どちらも存在しないなら missing、それ以外(壊れている)は corrupt
    if (primary.status === "absent" && backup.status === "absent") {
      return { ok: false, reason: "missing" };
    }
    return { ok: false, reason: "corrupt" };
  }

  public async save(state: GameState): Promise<void> {
    // 検証済みの状態のみを永続化する(内部状態でも念のため通す)
    const validated = gameStateSchema.parse(state);
    await mkdir(this.dir, { recursive: true });

    // 1) 一時ファイルへ書く(ユニーク名で並行や残骸との衝突を避ける)
    const tmpPath = path.join(this.dir, `save1.json.tmp-${process.pid}-${randomBytes(4).toString("hex")}`);
    await writeFile(tmpPath, JSON.stringify(validated, null, 2), "utf8");

    try {
      // 2) 既存セーブがあれば .bak へ退避(1世代保持)。tmp を先に rename すると .bak が壊れるため順序厳守
      if (existsSync(this.savePath)) {
        await rename(this.savePath, this.bakPath);
      }
      // 3) 一時ファイルを本命へ原子的に置き換える
      await rename(tmpPath, this.savePath);
    } catch (err) {
      // 失敗時は一時ファイルを掃除してから投げ直す(既存セーブ・.bak は壊さない)
      await unlink(tmpPath).catch(() => undefined);
      throw err;
    }
  }
}

/** 既定のセーブディレクトリ(cwd の saves/)。環境変数 SAVE_DIR があればそれを使う */
export function resolveSaveDir(env: NodeJS.ProcessEnv): string {
  const override = env.SAVE_DIR;
  if (override !== undefined && override.length > 0) return path.resolve(override);
  return path.resolve(process.cwd(), "saves");
}
