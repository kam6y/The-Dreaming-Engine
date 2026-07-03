/**
 * シード可能な決定論的乱数生成器(PRNG)。
 *
 * CLAUDE.md「乱数はシード可能な実装にし、テストでは固定シードを使う」に従う。
 * アルゴリズムは mulberry32(32bit 状態・高速・十分な分布)。状態は単一の整数で
 * 表せるため、`state()` で取り出して BattleState 等に保存し、`rngFromState()` で
 * 復元することで、セーブ/ロードやターン解決をまたいだ完全な再現性を保証する。
 */

/** mulberry32 の内部状態(32bit 符号なし整数として扱う) */
export type RngState = number;

export interface Rng {
  /** [0, 1) の浮動小数を返し、内部状態を1つ進める */
  next(): number;
  /** [min, max] の整数を返す(両端を含む) */
  int(min: number, max: number): number;
  /** [min, max) の浮動小数を返す */
  float(min: number, max: number): number;
  /** 現在の内部状態(保存・復元用) */
  state(): RngState;
}

class Mulberry32 implements Rng {
  private a: number;

  constructor(state: number) {
    this.a = state | 0;
  }

  next(): number {
    this.a = (this.a + 0x6d2b79f5) | 0;
    let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    if (max < min) throw new Error(`Rng.int: max(${max}) が min(${min}) より小さい`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  state(): RngState {
    return this.a >>> 0;
  }
}

/**
 * シード値から Rng を作る。隣接シード間の相関を減らすため、初期状態を撹拌する
 * (多数シードでの統計テストで独立した乱数列を得るため)。
 */
export function createRng(seed: number): Rng {
  let s = seed | 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
  s = (s ^ (s >>> 16)) | 0;
  return new Mulberry32(s);
}

/** 保存された内部状態から Rng を復元する(撹拌はしない=完全な続き) */
export function rngFromState(state: RngState): Rng {
  return new Mulberry32(state | 0);
}
