import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuditLog } from "../src/ai/audit-log.js";

// トークン様フィクスチャは連結で組み立てる(実キー形式リテラルをソースに置かない)
const skToken = ["sk", "ant", "api03", "Z".repeat(40)].join("-");

describe("AuditLog", () => {
  let dir = "";
  let clockMs = Date.UTC(2026, 6, 4, 1, 0, 0); // 2026-07-04T01:00:00Z
  const now = (): Date => new Date(clockMs);

  const readLines = (): Record<string, unknown>[] => {
    const files = readdirSync(dir);
    return files
      .filter((f) => f.endsWith(".jsonl"))
      .flatMap((f) =>
        readFileSync(path.join(dir, f), "utf8")
          .split("\n")
          .filter((l) => l.length > 0)
          .map((l) => JSON.parse(l) as Record<string, unknown>)
      );
  };

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "de-audit-"));
    clockMs = Date.UTC(2026, 6, 4, 1, 0, 0);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("AI 呼び出しを即時に 1 行記録し、日付別ファイルに書く", () => {
    const log = new AuditLog({ dir, now, maskEnv: {} });
    log.logAiCall({
      flow: "conversation",
      contextHash: "abc123",
      playerInput: "こんばんは",
      responseText: "よく来たね、旅人よ。",
      toolCalls: [{ name: "speak", input: { text: "よく来たね" }, result: "approved" }],
      durationMs: 850,
      model: "claude-haiku-4-5"
    });

    expect(readdirSync(dir)).toContain("2026-07-04.jsonl");
    const lines = readLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      type: "ai_call",
      flow: "conversation",
      model: "claude-haiku-4-5",
      timestamp: "2026-07-04T01:00:00.000Z"
    });
  });

  it("失敗ターンの failureKind と usedFallback を記録する(診断性の強化)", () => {
    const log = new AuditLog({ dir, now, maskEnv: {} });
    log.logAiCall({
      flow: "conversation",
      contextHash: "h",
      playerInput: null,
      responseText: null,
      toolCalls: [],
      durationMs: 19580,
      model: "claude-haiku-4-5",
      failureKind: "display_approved_zero",
      usedFallback: true
    });
    const lines = readLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      type: "ai_call",
      flow: "conversation",
      failureKind: "display_approved_zero",
      usedFallback: true
    });
  });

  it("全フィールドに機密マスクを適用してから書く", () => {
    const log = new AuditLog({ dir, now, maskEnv: {} });
    log.logAiCall({
      flow: "conversation",
      contextHash: "h",
      playerInput: `これを保存して: ${skToken}`,
      responseText: null,
      toolCalls: [{ name: "speak", input: { text: `key=${skToken}` }, result: "rejected", reason: `bad ${skToken}` }],
      durationMs: 10,
      model: "claude-haiku-4-5"
    });
    const raw = readFileSync(path.join(dir, "2026-07-04.jsonl"), "utf8");
    expect(raw).not.toContain(skToken);
    expect(raw).toContain("[MASKED]");
  });

  it("境界イベントは flush するまで書かれない(遅延書き込み契約)", () => {
    const log = new AuditLog({ dir, now, maskEnv: {} });
    log.logBoundaryEvent({ kind: "rate_limited", reason: "会話送信レート超過" });
    expect(readLines()).toHaveLength(0); // まだ集約中
    log.flush();
    const lines = readLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ type: "boundary", kind: "rate_limited", count: 1 });
  });

  it("10 秒ウィンドウ内の同種イベントは 1 行に集約する(件数まとめ)", () => {
    const log = new AuditLog({ dir, now, maskEnv: {} });
    log.logBoundaryEvent({ kind: "origin_rejected", reason: "evil.example" });
    clockMs += 1000;
    log.logBoundaryEvent({ kind: "origin_rejected", reason: "evil.example" });
    clockMs += 2000;
    log.logBoundaryEvent({ kind: "origin_rejected", reason: "evil.example" });
    expect(log.pendingBoundaryCount()).toBe(1);
    log.flush();
    const lines = readLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ type: "boundary", kind: "origin_rejected", count: 3 });
  });

  it("ウィンドウを跨ぐ同種イベントは別行になる(期限切れで書き出し)", () => {
    const log = new AuditLog({ dir, now, maskEnv: {} });
    log.logBoundaryEvent({ kind: "cooldown_blocked", reason: "会話開始CD" }); // t0
    clockMs += 11_000; // ウィンドウ超過
    log.logBoundaryEvent({ kind: "cooldown_blocked", reason: "会話開始CD" }); // 旧を書き出し+新規
    log.flush();
    const lines = readLines().filter((l) => l.type === "boundary");
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.count === 1)).toBe(true);
  });

  it("異なる種別・理由は別ウィンドウとして併存する", () => {
    const log = new AuditLog({ dir, now, maskEnv: {} });
    log.logBoundaryEvent({ kind: "rate_limited", reason: "A" });
    log.logBoundaryEvent({ kind: "rate_limited", reason: "B" });
    log.logBoundaryEvent({ kind: "cooldown_blocked", reason: "A" });
    expect(log.pendingBoundaryCount()).toBe(3);
    log.flush();
    expect(readLines()).toHaveLength(3);
  });

  it("境界イベントの reason に含まれる機密もマスクする", () => {
    const log = new AuditLog({ dir, now, maskEnv: {} });
    log.logBoundaryEvent({ kind: "ws_rejected", reason: `token ${skToken}` });
    log.flush();
    const raw = readFileSync(path.join(dir, "2026-07-04.jsonl"), "utf8");
    expect(raw).not.toContain(skToken);
    expect(raw).toContain("[MASKED]");
  });
});
