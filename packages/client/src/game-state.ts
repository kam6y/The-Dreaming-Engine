import Phaser from "phaser";

import {
  createRng,
  statsForLevel,
  type ItemId,
  type PlayerProgress,
  type Rng
} from "@dreaming-engine/shared";

/**
 * クライアント側のラン状態(1プレイ分の進行)。
 * M2時点ではクライアント保持とし、M3(セーブ/ロード)でサーバー正本へ移行する。
 */
export interface RunState {
  progress: PlayerProgress;
  /** 所持品(M2最小限: ItemIdの配列。所持上限・スタック管理はM3) */
  inventory: ItemId[];
}

/** 新規ゲーム開始時の初期ゴールド(裁量値。JOURNALに記録) */
const INITIAL_GOLD = 30;

/** 新規ゲーム開始時の所持品(裁量: 回復薬(小)2個。店実装(M3)までの緩衝) */
const INITIAL_INVENTORY: ItemId[] = ["potion-small", "potion-small"];

export function createNewRun(): RunState {
  const stats = statsForLevel(1);
  return {
    progress: {
      level: 1,
      xp: 0,
      hp: stats.maxHP,
      mp: stats.maxMP,
      gold: INITIAL_GOLD
    },
    inventory: [...INITIAL_INVENTORY]
  };
}

const RUN_KEY = "run";
const RNG_KEY = "encounterRng";

/** 新規ゲームのラン状態とエンカウント用RNGをregistryへ初期化する */
export function initializeRun(game: Phaser.Game): void {
  game.registry.set(RUN_KEY, createNewRun());
  // E2E・デバッグで再現できるよう ?seed= でシード固定可能にする(未指定は時刻由来)
  const param = new URLSearchParams(window.location.search).get("seed");
  const seed = param !== null && Number.isFinite(Number(param)) ? Number(param) : Date.now() >>> 0;
  game.registry.set(RNG_KEY, createRng(seed));
}

export function getRun(scene: Phaser.Scene): RunState {
  const run = scene.registry.get(RUN_KEY) as RunState | undefined;
  if (run === undefined) {
    throw new Error("ラン状態が初期化されていない(新規ゲームを経由していない)");
  }
  return run;
}

export function setRun(scene: Phaser.Scene, run: RunState): void {
  scene.registry.set(RUN_KEY, run);
}

/** エンカウント・戦闘シード用RNG(状態を共有し、呼ぶたびに進む) */
export function getEncounterRng(scene: Phaser.Scene): Rng {
  const rng = scene.registry.get(RNG_KEY) as Rng | undefined;
  if (rng === undefined) {
    throw new Error("エンカウントRNGが初期化されていない");
  }
  return rng;
}

/**
 * テスト用: ?noSymbols=1 で敵シンボルの出現を無効化する。
 * E2E移動スモーク(街→最深部の踏破)がランダム配置のシンボルと
 * 衝突して不安定にならないようにするための開発・テスト専用フラグ
 */
export function encountersDisabled(): boolean {
  return new URLSearchParams(window.location.search).has("noSymbols");
}
