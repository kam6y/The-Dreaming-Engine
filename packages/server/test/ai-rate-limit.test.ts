import { beforeEach, describe, expect, it } from "vitest";

import { RateLimiter } from "../src/ai/rate-limit.js";

describe("RateLimiter", () => {
  let clock = 0;
  const limiter = (): RateLimiter => new RateLimiter(() => clock);

  beforeEach(() => {
    clock = 0;
  });

  it("初回は許可し、間隔未満の再取得は拒否する", () => {
    const rl = limiter();
    expect(rl.tryAcquire("send", 3000)).toBe(true);
    clock = 2999;
    expect(rl.tryAcquire("send", 3000)).toBe(false); // 未経過
    clock = 3000;
    expect(rl.tryAcquire("send", 3000)).toBe(true); // ちょうど経過
  });

  it("拒否時は最終実行時刻を更新しない(間隔は初回成功起点)", () => {
    const rl = limiter();
    expect(rl.tryAcquire("k", 1000)).toBe(true); // t=0
    clock = 500;
    expect(rl.tryAcquire("k", 1000)).toBe(false); // 更新されない
    clock = 1000;
    expect(rl.tryAcquire("k", 1000)).toBe(true); // t=0 起点で 1000 経過
  });

  it("msUntilReady は残り時間を返し、消費しない", () => {
    const rl = limiter();
    expect(rl.msUntilReady("cd", 10000)).toBe(0); // 未使用
    rl.tryAcquire("cd", 10000); // t=0
    clock = 4000;
    expect(rl.msUntilReady("cd", 10000)).toBe(6000);
    // 照会は消費しないので再取得はまだ拒否
    expect(rl.tryAcquire("cd", 10000)).toBe(false);
  });

  it("キーごとに独立している", () => {
    const rl = limiter();
    expect(rl.tryAcquire("talk:innkeeper", 10000)).toBe(true);
    expect(rl.tryAcquire("talk:merchant", 10000)).toBe(true); // 別 NPC は独立
    expect(rl.tryAcquire("talk:innkeeper", 10000)).toBe(false);
  });

  it("同一内容の連続送信を拒否し、内容が変われば受理する", () => {
    const rl = limiter();
    expect(rl.acceptContent("send", "こんにちは")).toBe(true);
    expect(rl.acceptContent("send", "こんにちは")).toBe(false); // 連続同一
    expect(rl.acceptContent("send", "やあ")).toBe(true); // 変化
    expect(rl.acceptContent("send", "やあ")).toBe(false);
  });

  it("reset でキー(または全体)の記録を消去する", () => {
    const rl = limiter();
    rl.tryAcquire("k", 1000);
    rl.acceptContent("k", "x");
    rl.reset("k");
    expect(rl.tryAcquire("k", 1000)).toBe(true); // 消去済みなので初回扱い
    expect(rl.acceptContent("k", "x")).toBe(true);
  });
});
