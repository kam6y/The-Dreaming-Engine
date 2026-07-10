import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * 攻撃テストA 必須テストID マニフェスト + 照合メタテスト(ai-guardrails.md 220-222・315)。
 *
 * `REQUIRED_ATTACK_TEST_IDS` は spec 214-273 の攻撃項目に対応する「必須テストID一覧」。
 * メタテストは `guardrails/` 配下の全 `*.test.ts`(このファイル自身は除外)のソースを fs で読み、
 * **アクティブな**テスト(`it(` / `test(` で `[ID]` を持ち、`.skip` / `.todo` / `xit` /
 * コメントアウトでないもの)の ID 集合を抽出する。以下を機械検証し、攻撃テストの削除・skip・
 * コメントアウトによる形骸化を自動検知する:
 *  - 必須IDがすべてアクティブに存在する(欠落・skip/todo ラップは ID を列挙して失敗)。
 *  - マニフェスト外の未知ID(タイプミス等)が存在しない(同期を促す)。
 *  - 同一IDの重複、`.only` / `describe.skip` / `xdescribe`(他テストの黙殺)を検知する。
 */

// ---------------------------------------------------------------------------
// マニフェスト(必須テストID一覧。spec 214-273 の各攻撃項目に対応)
// ---------------------------------------------------------------------------

export const REQUIRED_ATTACK_TEST_IDS: readonly string[] = [
  // 第0層 サーバー境界(Origin 許可リスト・WS 同時1接続・境界イベント監査)
  "ATK-L0-origin-reject",
  "ATK-L0-ws-single-replace",
  "ATK-L0-ws-reject-preserves",
  "ATK-L0-boundary-audit",

  // 第1層 ツール許可面(6ツールのみ・フロー別許可集合・組み込み遮断・クロスフロー)
  "ATK-L1-tool-count",
  "ATK-L1-allowlist-union",
  "ATK-L1-allowlist-per-flow",
  "ATK-L1-buildflowtools",
  "ATK-L1-disallowed-list",
  "ATK-L1-builtin-blocked",
  "ATK-L1-summary-no-tools",
  "ATK-cross-flow-tool",

  // 保護イベント記録・コスト保護境界・直列化・AI_MODE フェイルセーフ
  "ATK-protect-events-audit",
  "ATK-degrade-clear",
  "ATK-cost-cooldown-greeting",
  "ATK-cost-zero-exchange-summary",
  "ATK-serialize-busy",
  "ATK-aimode-failsafe",

  // 監査ログのマスク
  "ATK-audit-mask",

  // ツール検証の上限・境界(give_item / adjust_affinity / propose_quest / world_event)
  "ATK-give-nonwhitelist",
  "ATK-limits-over",
  "ATK-give-below-affinity",
  "ATK-give-affinity-at-open",
  "ATK-give-inventory-full",
  "ATK-give-second-in-conversation",
  "ATK-affinity-daily-cap",
  "ATK-affinity-cross-npc",
  "ATK-quest-unreachable-target",
  "ATK-quest-nonexistent-target",
  "ATK-subquest-fourth",
  "ATK-propose-second-pending",
  // 新型サブクエスト(deliver/escort/survey)の却下(拡張: M19。ai-guardrails.md 259-271)
  "ATK-quest-deliver-whitelist",
  "ATK-quest-escort-whitelist",
  "ATK-quest-survey-whitelist",
  "ATK-quest-mixed-fields",
  "ATK-quest-escort-survey-count",
  "ATK-quest-newtype-limits",
  "ATK-nonpositive-count",
  "ATK-non-integer",
  "ATK-world-event-fourth",
  "ATK-display-zero-discard",

  // 悪意モードの全却下(表示系0件ターンのオール・オア・ナッシング破棄)
  "ATK-malicious-all-display-flows",
  "ATK-malicious-summary",

  // 第3層 入力の壁(切り詰め・制御文字除去・タグ無害化)
  "ATK-L3-input-truncate",
  "ATK-L3-input-control-strip",
  "ATK-L3-input-tag-neutralize",

  // 第4層 出力の壁(逸脱・ゼロ幅回避・日本語比率/記号のみ/空・長さ)
  "ATK-L4-deviation",
  "ATK-L4-zero-width-evasion",
  "ATK-L4-empty-symbol-ratio",
  "ATK-L4-too-long",

  // 二次インジェクション・憲法不変条件
  "ATK-secondary-injection",
  "ATK-constitution-invariants",
  "ATK-constitution-all-flows"
];

// ---------------------------------------------------------------------------
// ソーススキャン(アクティブ/skip の [ID] を抽出)
// ---------------------------------------------------------------------------

/** このメタテストが置かれた guardrails ディレクトリ */
const GUARDRAILS_DIR = fileURLToPath(new URL(".", import.meta.url));
/** 自身のファイル名(スキャン対象から除外する) */
const SELF_FILE = "manifest.test.ts";

/** [ID] の抽出(テスト名先頭の `[ATK-...]`) */
const ID_PATTERN = /\[([A-Za-z0-9][A-Za-z0-9_-]*)\]/;
/** アクティブなテスト宣言行(`it(` / `test(`。修飾子なし or 無害な修飾子) */
const ACTIVE_DECL = /(?:^|[^.\w])(it|test)\s*\(/;
/** アクティブなテスト宣言行(`it.each` / `test.each` 等の連鎖・only は別途検知) */
const ACTIVE_DECL_CHAINED = /(?:^|[^.\w])(it|test)\s*\.\s*(each|concurrent|fails)\s*\(/;
/** skip / todo でラップされた宣言行(`it.skip(` / `test.todo(` / `xit(` / `xtest(`) */
const SKIPPED_DECL = /(?:(?:^|[^.\w])(it|test)\s*\.\s*(skip|todo)\s*\()|(?:(?:^|[^.\w])(xit|xtest)\s*\()/;

interface FoundId {
  readonly id: string;
  readonly file: string;
  readonly line: number;
}

interface ScanResult {
  readonly active: FoundId[];
  readonly skipped: FoundId[];
  /** 攻撃テスト宣言行だが [ID] を持たないもの(ID 付与漏れの検知) */
  readonly unlabeled: { readonly file: string; readonly line: number }[];
}

/** guardrails 配下のスキャン対象テストファイル(自身を除く) */
function guardrailTestFiles(): string[] {
  return readdirSync(GUARDRAILS_DIR)
    .filter((f) => f.endsWith(".test.ts") && f !== SELF_FILE)
    .sort();
}

/** 行がコメント(行頭 // / * / /*)かどうか */
function isCommentLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

function scanGuardrails(): ScanResult {
  const active: FoundId[] = [];
  const skipped: FoundId[] = [];
  const unlabeled: { file: string; line: number }[] = [];

  for (const file of guardrailTestFiles()) {
    const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
    const lines = src.split("\n");
    lines.forEach((line, idx) => {
      if (isCommentLine(line)) return;
      const lineNo = idx + 1;
      const idMatch = ID_PATTERN.exec(line);

      if (SKIPPED_DECL.test(line)) {
        if (idMatch?.[1] !== undefined) skipped.push({ id: idMatch[1], file, line: lineNo });
        return;
      }
      if (ACTIVE_DECL.test(line) || ACTIVE_DECL_CHAINED.test(line)) {
        if (idMatch?.[1] !== undefined) {
          active.push({ id: idMatch[1], file, line: lineNo });
        } else {
          unlabeled.push({ file, line: lineNo });
        }
      }
    });
  }
  return { active, skipped, unlabeled };
}

// ---------------------------------------------------------------------------
// メタテスト
// ---------------------------------------------------------------------------

describe("攻撃テストA マニフェスト照合メタテスト", () => {
  const scan = scanGuardrails();
  const activeIds = new Set(scan.active.map((f) => f.id));
  const skippedIds = new Set(scan.skipped.map((f) => f.id));

  it("マニフェストにID重複がない", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const id of REQUIRED_ATTACK_TEST_IDS) {
      if (seen.has(id)) dupes.push(id);
      seen.add(id);
    }
    expect(dupes, `マニフェスト内の重複ID: ${dupes.join(", ")}`).toEqual([]);
  });

  it("必須テストIDがすべてアクティブに存在する(欠落・skip/todo による形骸化を検知)", () => {
    const missing: string[] = [];
    const skippedRequired: string[] = [];
    for (const id of REQUIRED_ATTACK_TEST_IDS) {
      if (activeIds.has(id)) continue;
      if (skippedIds.has(id)) skippedRequired.push(id);
      else missing.push(id);
    }
    expect(
      { missing, skippedRequired },
      `必須攻撃テストが欠落/skip されています。欠落=[${missing.join(", ")}] skip=[${skippedRequired.join(", ")}]`
    ).toEqual({ missing: [], skippedRequired: [] });
  });

  it("アクティブな [ID] はすべてマニフェストに登録済み(未知ID・タイプミスの検知)", () => {
    const manifest = new Set(REQUIRED_ATTACK_TEST_IDS);
    const unknown = [...activeIds].filter((id) => !manifest.has(id)).sort();
    expect(unknown, `マニフェスト外の未知ID(要同期): ${unknown.join(", ")}`).toEqual([]);
  });

  it("同一IDを持つアクティブテストが重複していない", () => {
    const counts = new Map<string, number>();
    for (const f of scan.active) counts.set(f.id, (counts.get(f.id) ?? 0) + 1);
    const dupes = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
    expect(dupes, `重複したアクティブID: ${dupes.join(", ")}`).toEqual([]);
  });

  it("すべての攻撃テスト宣言に [ID] が付与されている(付与漏れの検知)", () => {
    const locs = scan.unlabeled.map((u) => `${u.file}:${u.line}`);
    expect(locs, `[ID] 未付与の攻撃テスト宣言: ${locs.join(", ")}`).toEqual([]);
  });

  it("guardrails 配下に .only / describe.skip / xdescribe(他テストの黙殺)が無い", () => {
    const offenders: string[] = [];
    for (const file of guardrailTestFiles()) {
      const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      src.split("\n").forEach((line, idx) => {
        if (isCommentLine(line)) return;
        if (/(?:describe|it|test)\s*\.\s*only\s*\(/.test(line)) offenders.push(`${file}:${idx + 1} (.only)`);
        if (/(?:describe\s*\.\s*skip|xdescribe)\s*\(/.test(line)) offenders.push(`${file}:${idx + 1} (describe skip)`);
      });
    }
    expect(offenders, `黙殺の恐れ: ${offenders.join(", ")}`).toEqual([]);
  });

  it("スキャン対象の guardrails テストファイルを検出できている(空スキャンでない)", () => {
    expect(guardrailTestFiles().length).toBeGreaterThanOrEqual(5);
    expect(scan.active.length).toBeGreaterThanOrEqual(REQUIRED_ATTACK_TEST_IDS.length);
  });
});
