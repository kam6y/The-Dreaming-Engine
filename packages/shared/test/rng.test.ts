import { describe, expect, it } from "vitest";

import { createRng, rngFromState } from "../src/index.js";

describe("createRng(シード可能PRNG)", () => {
  it("同一シードは同一の乱数列を生む(決定論的)", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("異なるシードは異なる乱数列を生む", () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("next() は [0, 1) を返す", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int(min,max) は両端含む範囲に収まり、端も出現する", () => {
    const rng = createRng(123);
    let sawMin = false;
    let sawMax = false;
    for (let i = 0; i < 2000; i += 1) {
      const v = rng.int(1, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      if (v === 1) sawMin = true;
      if (v === 6) sawMax = true;
    }
    expect(sawMin).toBe(true);
    expect(sawMax).toBe(true);
  });

  it("int(n,n) は常に n", () => {
    const rng = createRng(5);
    for (let i = 0; i < 50; i += 1) expect(rng.int(4, 4)).toBe(4);
  });

  it("float(min,max) は [min, max) に収まる", () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.float(0.9, 1.1);
      expect(v).toBeGreaterThanOrEqual(0.9);
      expect(v).toBeLessThan(1.1);
    }
  });
});

describe("state / rngFromState(状態の保存・復元)", () => {
  it("途中状態を保存して復元すると、以降の乱数列が一致する", () => {
    const rng = createRng(2024);
    // 数回進める
    for (let i = 0; i < 5; i += 1) rng.next();
    const saved = rng.state();
    const continuedOriginal = Array.from({ length: 10 }, () => rng.next());
    const restored = rngFromState(saved);
    const continuedRestored = Array.from({ length: 10 }, () => restored.next());
    expect(continuedRestored).toEqual(continuedOriginal);
  });
});
