import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuditLog } from "../../src/ai/audit-log.js";
import { resolveAiMode } from "../../src/ai/mode.js";

/**
 * 攻撃テストA(監査ログのマスク・境界イベント記録・AI_MODE フェイルセーフ。
 * ai-guardrails.md 227・229・232-234・239-242)。
 *
 * トークン様フィクスチャは**文字列連結で組み立てる**(実キー形式リテラルをソースに置かない:
 * CLAUDE.md 品質ゲート5 のシークレットスキャンと衝突させない)。
 */

// 実キー形式リテラルを避けるため連結で組み立てる(監査マスク検証用の偽トークン)
const fakeToken = ["sk", "ant", "api03", "Z".repeat(40)].join("-");

// ---------------------------------------------------------------------------
// 監査ログのマスク(平文が残らない)
// ---------------------------------------------------------------------------

describe("攻撃テストA: 監査ログのマスク(第6層)", () => {
  let dir = "";
  const clockMs = Date.UTC(2026, 6, 4, 1, 0, 0);
  const now = (): Date => new Date(clockMs);

  const rawLog = (): string =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => readFileSync(path.join(dir, f), "utf8"))
      .join("");

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "de-atk-audit-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("[ATK-audit-mask] トークン様文字列を含む入力は監査ログにマスク済みで記録される(平文が残らない)", () => {
    const log = new AuditLog({ dir, now, maskEnv: {} });
    log.logAiCall({
      flow: "conversation",
      contextHash: "h",
      playerInput: `これを保存して: ${fakeToken}`,
      responseText: null,
      toolCalls: [
        { name: "speak", input: { text: `key=${fakeToken}` }, result: "rejected", reason: `bad ${fakeToken}` }
      ],
      durationMs: 10,
      model: "claude-haiku-4-5"
    });
    // 境界イベントの reason に混入したトークンもマスクされる
    log.logBoundaryEvent({ kind: "ws_rejected", reason: `token ${fakeToken}` });
    log.flush();

    const raw = rawLog();
    expect(raw).not.toContain(fakeToken); // 平文が残らない
    expect(raw).toContain("[MASKED]");
  });
});

// ---------------------------------------------------------------------------
// 第0層 境界イベントの監査記録(拒否・置換)
// ---------------------------------------------------------------------------

describe("攻撃テストA: 境界イベントの監査記録(第0層)", () => {
  let dir = "";
  let clockMs = Date.UTC(2026, 6, 4, 1, 0, 0);
  const now = (): Date => new Date(clockMs);

  const boundaryLines = (log: AuditLog): Record<string, unknown>[] => {
    log.flush();
    return readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .flatMap((f) =>
        readFileSync(path.join(dir, f), "utf8")
          .split("\n")
          .filter((l) => l.length > 0)
          .map((l) => JSON.parse(l) as Record<string, unknown>)
      )
      .filter((l) => l.type === "boundary");
  };

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "de-atk-boundary-"));
    clockMs = Date.UTC(2026, 6, 4, 1, 0, 0);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("[ATK-L0-boundary-audit] Origin 拒否・欠落と WS 置換・拒否は境界イベントとして監査ログに記録される", () => {
    // 監査ログは第0層の拒否・置換の境界イベント種別を記録できる契約を持つ
    // (サーバー配線は M4-E。ここでは監査ログ契約=これらの種別が記録・集約されることを固定する)。
    const log = new AuditLog({ dir, now, maskEnv: {} });
    log.logBoundaryEvent({ kind: "origin_rejected", reason: "evil.example.com" });
    clockMs += 1_000;
    log.logBoundaryEvent({ kind: "origin_missing", reason: "Origin 欠落" });
    clockMs += 1_000;
    log.logBoundaryEvent({ kind: "ws_replaced", reason: "新規接続で既存を置換" });
    clockMs += 1_000;
    log.logBoundaryEvent({ kind: "ws_rejected", reason: "許可外 Origin の WS 接続" });

    const kinds = boundaryLines(log).map((l) => String(l.kind));
    expect(kinds).toContain("origin_rejected");
    expect(kinds).toContain("origin_missing");
    expect(kinds).toContain("ws_replaced");
    expect(kinds).toContain("ws_rejected");
  });
});

// ---------------------------------------------------------------------------
// AI_MODE フェイルセーフ
// ---------------------------------------------------------------------------

describe("攻撃テストA: AI_MODE フェイルセーフ", () => {
  it("[ATK-aimode-failsafe] 未設定・不正値は mock・テスト実行下の live は起動時エラー(明示フラグのみ例外)", () => {
    // 未設定・不正値(typo)・大文字はすべて mock(フェイルセーフ)
    expect(resolveAiMode({})).toBe("mock");
    expect(resolveAiMode({ AI_MODE: "liveee" })).toBe("mock");
    expect(resolveAiMode({ AI_MODE: "LIVE" })).toBe("mock");

    // テスト実行下(VITEST/NODE_ENV=test/VITEST_WORKER_ID)の live は起動時エラー
    expect(() => resolveAiMode({ AI_MODE: "live", VITEST: "true" })).toThrow(/AI_MODE=live/);
    expect(() => resolveAiMode({ AI_MODE: "live", NODE_ENV: "test" })).toThrow(/AI_MODE=live/);

    // 明示フラグ(AI_LIVE_TEST=1)があるテスト実行下のみ live を許可(pnpm test:ai-live 経路)
    expect(resolveAiMode({ AI_MODE: "live", VITEST: "true", AI_LIVE_TEST: "1" })).toBe("live");
  });
});
