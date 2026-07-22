# 対話系AI応答のストリーミング化(ストリーム+事後検証・撤回)実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 会話(conversation)・サブクエスト生成(questGeneration)の `speak` 応答を、生成中に増分でクライアントへ先行表示し、完了時の検証結果(検証済み全文 or 定型文)で必ず置換する。

**Architecture:** Agent SDK の `includePartialMessages: true` で `stream_event` を購読し、`speak` ツール入力の `text` を増分JSONパーサで抽出 → `SpeakStreamSink` 経由でセッション層が `ai-stream-start`/`ai-stream-delta` を push する。最終正文は**従来どおり `ai-utterance` が運び、ストリームの end/abort を兼ねる**(成功=検証済み全文/失敗=定型文で表示を撤回)。検証・監査・履歴・キャッシュ・縮退の意味論は一切変えない。

**Tech Stack:** pnpm workspace / TypeScript strict / zod / Vitest / Phaser 3 / `@anthropic-ai/claude-agent-sdk` 0.3.200

**設計書(正):** `docs/superpowers/specs/2026-07-12-dialog-streaming-design.md`

## Global Constraints

- 作業ブランチは現行ブランチ(`cluade/loop`)。`main` への直接コミット・push 禁止(CLAUDE.md)
- 各コミット前に `pnpm check` 緑(typecheck+lint+unit+build+シークレットスキャン)。`pnpm test:e2e`(スモーク)は Task 10 完了後と Task 12 で実行して緑を確認する
- TypeScript strict・`any` 原則禁止。UIテキスト・コメントは日本語、識別子は英語
- **防御アサート・既存テストを緩めない**。`ai-guardrails.md` の改定は「オーナー指示 2026-07-12」の明記必須・本計画記載の例外追記のみ(それ以外の弱体化禁止)
- ストリーミング対象は conversation / questGeneration の `speak` のみ。夢・戦果描写・要約・キャッシュヒット・縮退・クールダウン経路ではストリームを発生させない
- 未検証テキストは表示専用。永続化(会話履歴・要約・キャッシュ・セーブ・監査 responseText)には検証済みテキストのみ(従来どおり)
- 新しい攻撃テストにはテストID を付け、`packages/server/test/guardrails/manifest.test.ts` の `REQUIRED_ATTACK_TEST_IDS` へ登録する
- コミットメッセージは `feat:`/`test:`/`docs:` プレフィックス+日本語要約

---

### Task 1: shared — ストリームWSメッセージ2種の追加

**Files:**
- Modify: `packages/shared/src/messages.ts`(`serverSleepStartMessageSchema` の直後に追記、union に追加)
- Test: `packages/shared/test/messages.test.ts`

**Interfaces:**
- Produces: `serverAiStreamStartMessageSchema` = `{ type: "ai-stream-start", npcId?: NpcId }`、`serverAiStreamDeltaMessageSchema` = `{ type: "ai-stream-delta", text: string(min 1) }`。`ServerMessage` union に両者が加わる(後続タスクは `{ type: "ai-stream-start", npcId }` / `{ type: "ai-stream-delta", text }` を構築して push する)

- [ ] **Step 1: 失敗するテストを書く**

`packages/shared/test/messages.test.ts` に追記(既存の serverMessage パーステストの流儀に合わせる):

```ts
describe("対話ストリーミングメッセージ(オーナー指示 2026-07-12)", () => {
  it("ai-stream-start をパースできる(npcId は省略可)", () => {
    expect(serverMessageSchema.parse({ type: "ai-stream-start", npcId: "informant" })).toEqual({
      type: "ai-stream-start",
      npcId: "informant"
    });
    expect(serverMessageSchema.parse({ type: "ai-stream-start" })).toEqual({ type: "ai-stream-start" });
  });

  it("ai-stream-delta をパースできる(空文字は拒否)", () => {
    expect(serverMessageSchema.parse({ type: "ai-stream-delta", text: "「よく" })).toEqual({
      type: "ai-stream-delta",
      text: "「よく"
    });
    expect(() => serverMessageSchema.parse({ type: "ai-stream-delta", text: "" })).toThrow();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter @dreaming-engine/shared test -- messages`
Expected: FAIL(unknown discriminator "ai-stream-start")

- [ ] **Step 3: スキーマを実装**

`packages/shared/src/messages.ts` の `serverSleepStartMessageSchema` の直後に:

```ts
/**
 * 対話AI応答のストリーミング先行表示(オーナー指示 2026-07-12。設計書
 * docs/superpowers/specs/2026-07-12-dialog-streaming-design.md)。
 * conversation/questGeneration の speak 生成中に、**未検証の増分テキスト**を
 * 画面表示専用に先行送出するチャンネル。最終正文は従来どおり ai-utterance が運び、
 * ストリームの end/abort を兼ねる(成功=検証済み全文/失敗=定型フォールバック文で置換)。
 * 表示の最終状態は常に検証済み全文または定型文であり、未検証テキストは残存しない。
 */
export const serverAiStreamStartMessageSchema = z.object({
  type: z.literal("ai-stream-start"),
  /** 発話中の NPC(会話相手)。クライアントは表示中のストリームバッファをクリアする */
  npcId: npcIdSchema.optional()
});

/** ストリームの増分テキスト(未検証。表示専用) */
export const serverAiStreamDeltaMessageSchema = z.object({
  type: z.literal("ai-stream-delta"),
  text: z.string().min(1)
});
```

`serverMessageSchema` の discriminatedUnion に `serverAiStreamStartMessageSchema, serverAiStreamDeltaMessageSchema` を追加。あわせて `serverAiUtteranceMessageSchema` の JSDoc に1行追記: 「対話ストリーミング(ai-stream-start/delta)の end/abort も兼ねる(受信時にストリームバッファを本文で置換する)」。

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter @dreaming-engine/shared test -- messages`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/shared/src/messages.ts packages/shared/test/messages.test.ts
git commit -m "feat: 対話ストリーミングのWSメッセージ2種(ai-stream-start/delta)を追加"
```

---

### Task 2: server — speak入力の増分テキスト抽出器(純TS)

**Files:**
- Create: `packages/server/src/ai/dream-master/speak-stream.ts`
- Test: `packages/server/test/ai-speak-stream.test.ts`

**Interfaces:**
- Produces:
  - `class JsonTextFieldExtractor { push(partialJson: string): string }` — `{"text":"..."}` 形式の増分JSONを受け、新たに確定した `text` 値の増分(デコード済み)を返す
  - `class SpeakStreamParser { constructor(speakToolName: string, onDelta: (delta: string) => void); handle(event: unknown): void }` — SDK の `BetaRawMessageStreamEvent`(unknown)列から speak ツールの text 増分を取り出して onDelta へ渡す。解釈不能イベントは無視(絶対に throw しない)

- [ ] **Step 1: 失敗するテストを書く**

`packages/server/test/ai-speak-stream.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { JsonTextFieldExtractor, SpeakStreamParser } from "../src/ai/dream-master/speak-stream.js";

describe("JsonTextFieldExtractor", () => {
  it("複数チャンクに割れた text 値を増分で取り出す", () => {
    const ex = new JsonTextFieldExtractor();
    expect(ex.push('{"te')).toBe("");
    expect(ex.push('xt": "こん')).toBe("こん");
    expect(ex.push("にちは")).toBe("にちは");
    expect(ex.push('"}')).toBe("");
  });

  it("チャンク境界で切れたエスケープを保留して復元する(\\n / \\u)", () => {
    const ex = new JsonTextFieldExtractor();
    expect(ex.push('{"text": "a\\')).toBe("a"); // 「\」は未完 → 保留
    expect(ex.push('nb\\u30')).toBe("\nb"); // \n 確定、\u30 は未完 → 保留
    expect(ex.push('42c"}')).toBe("あc"); // あ = あ
  });

  it("閉じ引用符以降は無視する(done 後の push は空)", () => {
    const ex = new JsonTextFieldExtractor();
    expect(ex.push('{"text": "や"}')).toBe("や");
    expect(ex.push("garbage")).toBe("");
  });

  it("エスケープされた引用符で終端しない", () => {
    const ex = new JsonTextFieldExtractor();
    expect(ex.push('{"text": "a\\"b"}')).toBe('a"b');
  });

  it("text キーが現れるまで何も返さない(不正入力でも投げない)", () => {
    const ex = new JsonTextFieldExtractor();
    expect(ex.push("{}")).toBe("");
    expect(ex.push("!!!")).toBe("");
  });
});

describe("SpeakStreamParser", () => {
  const speakName = "mcp__dream__speak";

  function startEvent(index: number, name: string): unknown {
    return { type: "content_block_start", index, content_block: { type: "tool_use", name } };
  }
  function deltaEvent(index: number, partialJson: string): unknown {
    return { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: partialJson } };
  }

  it("speak ブロックの input_json_delta から text 増分を発火する", () => {
    const got: string[] = [];
    const parser = new SpeakStreamParser(speakName, (d) => got.push(d));
    parser.handle(startEvent(1, speakName));
    parser.handle(deltaEvent(1, '{"text": "おはよ'));
    parser.handle(deltaEvent(1, 'う"}'));
    parser.handle({ type: "content_block_stop", index: 1 });
    expect(got.join("")).toBe("おはよう");
  });

  it("speak 以外のツールブロックは無視する", () => {
    const got: string[] = [];
    const parser = new SpeakStreamParser(speakName, (d) => got.push(d));
    parser.handle(startEvent(0, "mcp__dream__adjust_affinity"));
    parser.handle(deltaEvent(0, '{"npcId": "informant"'));
    expect(got).toEqual([]);
  });

  it("複数の speak ブロックを順に処理する(stop で区切り)", () => {
    const got: string[] = [];
    const parser = new SpeakStreamParser(speakName, (d) => got.push(d));
    parser.handle(startEvent(0, speakName));
    parser.handle(deltaEvent(0, '{"text": "一言目"}'));
    parser.handle({ type: "content_block_stop", index: 0 });
    parser.handle(startEvent(2, speakName));
    parser.handle(deltaEvent(2, '{"text": "二言目"}'));
    expect(got.join("")).toBe("一言目二言目");
  });

  it("解釈不能なイベントで throw しない", () => {
    const parser = new SpeakStreamParser(speakName, () => {});
    expect(() => {
      parser.handle(null);
      parser.handle("text");
      parser.handle({ type: "message_start" });
      parser.handle({ type: "content_block_delta", index: 9, delta: { type: "text_delta", text: "x" } });
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter @dreaming-engine/server test -- ai-speak-stream`
Expected: FAIL(モジュールが存在しない)

- [ ] **Step 3: 実装**

`packages/server/src/ai/dream-master/speak-stream.ts`:

```ts
/**
 * speak ツール入力 `{"text":"..."}` の増分JSONから text 値の増分を取り出す(対話ストリーミング。
 * オーナー指示 2026-07-12。設計書 docs/superpowers/specs/2026-07-12-dialog-streaming-design.md)。
 *
 * 表示専用の先行経路であり、ここで取り出したテキストは**未検証**。最終正文はターン完了後の
 * 検証済み全文(ai-utterance)が置換するため、本パーサの取りこぼし・ずれは表示の最終状態に
 * 影響しない(だからこそ throw せず黙って無視する方針で書く)。
 */

/** \x 形式の単純エスケープの対応表 */
const SIMPLE_ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t"
};

export class JsonTextFieldExtractor {
  private buffer = "";
  private pos = 0;
  private state: "seeking" | "inString" | "done" = "seeking";

  /** 増分JSONを与え、新たに確定した text 値の増分(デコード済み)を返す(なければ空文字) */
  public push(partialJson: string): string {
    if (this.state === "done") return "";
    this.buffer += partialJson;
    if (this.state === "seeking") {
      // speak の入力スキーマは { text } の単一キーのため、最初の "text": " を値の開始とみなす
      const match = /"text"\s*:\s*"/.exec(this.buffer);
      if (match === null) return "";
      this.state = "inString";
      this.pos = match.index + match[0].length;
    }
    return this.decodeAvailable();
  }

  /** buffer[pos..] からデコード可能なぶんを取り出す。未完のエスケープは次回まで保留 */
  private decodeAvailable(): string {
    let out = "";
    while (this.pos < this.buffer.length) {
      const ch = this.buffer.charAt(this.pos);
      if (ch === '"') {
        this.state = "done";
        break;
      }
      if (ch !== "\\") {
        out += ch;
        this.pos += 1;
        continue;
      }
      if (this.pos + 1 >= this.buffer.length) break; // 「\」のみ=未完 → 保留
      const esc = this.buffer.charAt(this.pos + 1);
      if (esc === "u") {
        if (this.pos + 6 > this.buffer.length) break; // \uXXXX 未完 → 保留
        const code = Number.parseInt(this.buffer.slice(this.pos + 2, this.pos + 6), 16);
        // サロゲート半片も fromCharCode でそのまま連結する(後続半片と合成される)
        out += Number.isNaN(code) ? "" : String.fromCharCode(code);
        this.pos += 6;
        continue;
      }
      out += SIMPLE_ESCAPES[esc] ?? esc;
      this.pos += 2;
    }
    return out;
  }
}

/** stream_event の中身(BetaRawMessageStreamEvent)を緩く覗くための構造型 */
interface StreamEventLike {
  readonly type?: unknown;
  readonly index?: unknown;
  readonly content_block?: { readonly type?: unknown; readonly name?: unknown } | null;
  readonly delta?: { readonly type?: unknown; readonly partial_json?: unknown } | null;
}

/**
 * SDK の raw ストリームイベント列から speak ツール入力 text の増分を取り出す。
 * 解釈できないイベントは黙って無視する(drain を壊さない)。
 */
export class SpeakStreamParser {
  private activeIndex: number | null = null;
  private extractor: JsonTextFieldExtractor | null = null;

  public constructor(
    private readonly speakToolName: string,
    private readonly onDelta: (delta: string) => void
  ) {}

  public handle(event: unknown): void {
    if (typeof event !== "object" || event === null) return;
    const e = event as StreamEventLike;
    if (e.type === "content_block_start") {
      const block = e.content_block;
      if (
        typeof e.index === "number" &&
        block !== undefined &&
        block !== null &&
        block.type === "tool_use" &&
        block.name === this.speakToolName
      ) {
        this.activeIndex = e.index;
        this.extractor = new JsonTextFieldExtractor();
      }
      return;
    }
    if (e.type === "content_block_delta") {
      if (this.activeIndex === null || e.index !== this.activeIndex || this.extractor === null) return;
      const delta = e.delta;
      if (delta === undefined || delta === null || delta.type !== "input_json_delta") return;
      if (typeof delta.partial_json !== "string") return;
      const text = this.extractor.push(delta.partial_json);
      if (text.length > 0) this.onDelta(text);
      return;
    }
    if (e.type === "content_block_stop" && e.index === this.activeIndex) {
      this.activeIndex = null;
      this.extractor = null;
    }
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter @dreaming-engine/server test -- ai-speak-stream`
Expected: PASS(全ケース)

- [ ] **Step 5: コミット**

```bash
git add packages/server/src/ai/dream-master/speak-stream.ts packages/server/test/ai-speak-stream.test.ts
git commit -m "feat: speakツール入力の増分JSONテキスト抽出器(対話ストリーミングの土台)"
```

---

### Task 3: server — DreamMaster IF拡張と LiveDreamMaster のストリーム購読

**Files:**
- Modify: `packages/server/src/ai/dream-master/types.ts:161-163`(`DreamMasterRunOptions`)
- Modify: `packages/server/src/ai/dream-master/live.ts`(`SdkMessageLike`・`DrainDeps`・`drainStream`・`run`)
- Test: `packages/server/test/ai-live-dream-master.test.ts`

**Interfaces:**
- Consumes: Task 2 の `SpeakStreamParser`
- Produces: `DreamMasterRunOptions.onSpeakDelta?: (delta: string) => void`(Live は conversation/questGeneration かつコールバック指定時のみ `includePartialMessages: true` を設定し、speak の text 増分を発火する)。`SdkMessageLike` に `readonly event?: unknown` が加わる。`DrainDeps.onStreamEvent?: (message: SdkMessageLike) => void`

- [ ] **Step 1: 失敗するテストを書く**

`packages/server/test/ai-live-dream-master.test.ts` に追記(既存の偽 query / 偽 async iterable の流儀に合わせる。既存ヘルパーがあれば流用する):

```ts
describe("対話ストリーミング(オーナー指示 2026-07-12)", () => {
  /** stream_event → result(success) の順で流す偽ストリーム */
  function makeStreamingQuery(events: unknown[], captured: { options?: Options }): QueryFn {
    return (params) => {
      captured.options = params.options;
      return (async function* () {
        for (const event of events) {
          yield { type: "stream_event", event } as SdkMessageLike;
        }
        yield { type: "result", subtype: "success", result: "" } as SdkMessageLike;
      })();
    };
  }

  const speakEvents: unknown[] = [
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", name: "mcp__dream__speak" } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"text": "やあ、' } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '旅人"}' } },
    { type: "content_block_stop", index: 0 }
  ];

  it("conversation + onSpeakDelta で includePartialMessages が設定され、text 増分が発火する", async () => {
    const captured: { options?: Options } = {};
    const dm = new LiveDreamMaster({ config, env: FAKE_ENV, query: makeStreamingQuery(speakEvents, captured) });
    const got: string[] = [];
    const result = await dm.run(
      { flow: "conversation", partnerNpcId: "informant", playerUtterance: "" },
      { onSpeakDelta: (d) => got.push(d) }
    );
    expect(result.ok).toBe(true);
    expect(got.join("")).toBe("やあ、旅人");
    expect(captured.options?.includePartialMessages).toBe(true);
  });

  it("battleResult では onSpeakDelta があってもストリームを購読しない", async () => {
    const captured: { options?: Options } = {};
    const dm = new LiveDreamMaster({ config, env: FAKE_ENV, query: makeStreamingQuery(speakEvents, captured) });
    const got: string[] = [];
    const result = await dm.run({ flow: "battleResult", enemyId: "mist-wolf" }, { onSpeakDelta: (d) => got.push(d) });
    expect(result.ok).toBe(true);
    expect(got).toEqual([]);
    expect(captured.options?.includePartialMessages).toBeUndefined();
  });

  it("onSpeakDelta 未指定なら includePartialMessages を設定しない(従来挙動)", async () => {
    const captured: { options?: Options } = {};
    const dm = new LiveDreamMaster({ config, env: FAKE_ENV, query: makeStreamingQuery(speakEvents, captured) });
    const result = await dm.run({ flow: "conversation", partnerNpcId: "informant", playerUtterance: "" });
    expect(result.ok).toBe(true);
    expect(captured.options?.includePartialMessages).toBeUndefined();
  });

  it("onSpeakDelta が例外を投げても run は成功する(表示専用経路の隔離)", async () => {
    const dm = new LiveDreamMaster({ config, env: FAKE_ENV, query: makeStreamingQuery(speakEvents, {}) });
    const result = await dm.run(
      { flow: "conversation", partnerNpcId: "informant", playerUtterance: "" },
      {
        onSpeakDelta: () => {
          throw new Error("表示側の例外");
        }
      }
    );
    expect(result.ok).toBe(true);
  });

  it("全体タイムアウトでストリーム途中でも失敗として確定する(デルタは途中まで届いてよい)", async () => {
    // 既存の drainStream タイムアウトテストのタイマ注入(StreamTimers のフェイク)流儀を流用する:
    // stream_event を2件 yield した後 result を返さず待ち続ける偽ストリームに対し、
    // 全体タイムアウトのタイマを発火 → result は { ok: false, failure: "timeout_total" }。
    // got には途中までのデルタが入っていてよい(最終正文はターン側が定型文で確定する)。
  });
});
```

※ `config` / `FAKE_ENV` / `Options` / `QueryFn` / `SdkMessageLike` / `LiveDreamMaster` は既存テストの import・フィクスチャに合わせて調整する。

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter @dreaming-engine/server test -- ai-live-dream-master`
Expected: FAIL(onSpeakDelta が型に存在しない / includePartialMessages 未設定)

- [ ] **Step 3: 実装**

(a) `types.ts` の `DreamMasterRunOptions` に追記:

```ts
export interface DreamMasterRunOptions {
  readonly signal?: AbortSignal;
  /**
   * speak ツール入力 text の増分コールバック(対話ストリーミング表示。オーナー指示 2026-07-12)。
   * **未検証の生テキスト増分**が渡る(画面表示専用の先行経路)。検証・最終正文の確定は
   * 従来どおりターン完了後(turn-executor)。Live は conversation/questGeneration のみ発火、
   * Mock は同2フローで決定論チャンクを発火、他フロー・未指定時は従来どおり。
   */
  readonly onSpeakDelta?: (delta: string) => void;
}
```

(b) `live.ts`:
- import に `SpeakStreamParser` を追加(`./speak-stream.js`)
- `SdkMessageLike` に `readonly event?: unknown;` を追加
- `DrainDeps` に `readonly onStreamEvent?: (message: SdkMessageLike) => void;` を追加
- `drainStream` の for-await ループ内、`firstReceived` 処理の直後に:

```ts
if (message.type === "stream_event") {
  try {
    deps.onStreamEvent?.(message);
  } catch {
    // 表示専用の先行経路の例外で drain を壊さない(最終正文が置換するため無害)
  }
}
```

- `run()` 内、options 構築の前に:

```ts
const onSpeakDelta = runOptions?.onSpeakDelta;
const streaming =
  onSpeakDelta !== undefined && (flow === "conversation" || flow === "questGeneration");
```

options に `...(streaming ? { includePartialMessages: true } : {})` を追加。drainDeps 構築に:

```ts
const parser = streaming ? new SpeakStreamParser(mcpToolName("speak"), onSpeakDelta) : null;
const drainDeps: DrainDeps = {
  // ...既存フィールド...
  ...(parser !== null ? { onStreamEvent: (m: SdkMessageLike) => parser.handle(m.event) } : {})
};
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter @dreaming-engine/server test -- ai-live-dream-master`
Expected: PASS(既存テスト含む全緑)

- [ ] **Step 5: コミット**

```bash
git add packages/server/src/ai/dream-master/types.ts packages/server/src/ai/dream-master/live.ts packages/server/test/ai-live-dream-master.test.ts
git commit -m "feat: LiveDreamMasterがspeak入力のストリーム増分をonSpeakDeltaで発火(対話2フローのみ)"
```

---

### Task 4: server — MockDreamMaster の決定論チャンク発火

**Files:**
- Modify: `packages/server/src/ai/dream-master/mock.ts:436-449`(`run`)
- Test: `packages/server/test/ai-dream-master.test.ts`

**Interfaces:**
- Consumes: Task 3 の `DreamMasterRunOptions.onSpeakDelta`
- Produces: Mock は conversation/questGeneration かつ onSpeakDelta 指定時、speak テキストを**前半+後半の2チャンク**で発火してから結果を解決する(各チャンクの前に `await Promise.resolve()` を挟む=呼び出し元の同期継続より後に発火)

- [ ] **Step 1: 失敗するテストを書く**

`packages/server/test/ai-dream-master.test.ts` に追記:

```ts
describe("MockDreamMaster の対話ストリーミング(オーナー指示 2026-07-12)", () => {
  it("conversation で speak テキストを2チャンクで発火し、連結が全文に一致する", async () => {
    const dm = new MockDreamMaster(config);
    const got: string[] = [];
    const result = await dm.run(
      { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "" },
      { onSpeakDelta: (d) => got.push(d) }
    );
    expect(result.ok).toBe(true);
    expect(got.length).toBe(2);
    if (result.ok) {
      const speak = result.toolCalls.find((tc) => tc.toolName === "speak");
      expect(got.join("")).toBe((speak?.rawInput as { text: string }).text);
    }
  });

  it("battleResult / dream / summary では発火しない", async () => {
    const dm = new MockDreamMaster(config);
    const got: string[] = [];
    await dm.run({ flow: "battleResult", enemyId: "mist-wolf" }, { onSpeakDelta: (d) => got.push(d) });
    await dm.run({ flow: "dream", recentPlay: "静かな一日" }, { onSpeakDelta: (d) => got.push(d) });
    expect(got).toEqual([]);
  });

  it("悪意モードの conversation(speak なし)では発火しない", async () => {
    const dm = new MockDreamMaster(config, { malicious: true });
    const got: string[] = [];
    await dm.run(
      { flow: "conversation", partnerNpcId: "innkeeper", playerUtterance: "" },
      { onSpeakDelta: (d) => got.push(d) }
    );
    expect(got).toEqual([]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter @dreaming-engine/server test -- ai-dream-master`
Expected: FAIL(got が空)

- [ ] **Step 3: 実装**

`mock.ts` の `run` を差し替え(import に `DreamMasterRunOptions` を追加):

```ts
  public run(
    context: DreamMasterContext,
    options?: DreamMasterRunOptions
  ): Promise<DreamMasterResult> {
    const spec = resolveFlowSpec(context.flow, this.config);
    const built = this.malicious
      ? buildMaliciousToolCalls(context)
      : buildNormalToolCalls(context);
    return this.emitDeltasAndResolve(context, built, spec.model, options);
  }

  /**
   * 対話2フローで onSpeakDelta があれば、speak テキストを決定論の2チャンクで発火してから解決する
   * (対話ストリーミングのモック。オーナー指示 2026-07-12)。発火は必ずマイクロタスク後=
   * Live と同じく「呼び出し元の同期継続(interaction 構築等)より後」に届く順序を保つ。
   */
  private async emitDeltasAndResolve(
    context: DreamMasterContext,
    built: { toolCalls: RawToolCall[]; text: string | null },
    model: string,
    options?: DreamMasterRunOptions
  ): Promise<DreamMasterResult> {
    const onDelta = options?.onSpeakDelta;
    if (
      onDelta !== undefined &&
      (context.flow === "conversation" || context.flow === "questGeneration")
    ) {
      for (const tc of built.toolCalls) {
        if (tc.toolName !== "speak") continue;
        const text = (tc.rawInput as { text?: unknown }).text;
        if (typeof text !== "string" || text.length === 0) continue;
        const chars = Array.from(text);
        const mid = Math.ceil(chars.length / 2);
        await Promise.resolve();
        onDelta(chars.slice(0, mid).join(""));
        await Promise.resolve();
        onDelta(chars.slice(mid).join(""));
      }
    }
    return {
      ok: true,
      flow: context.flow,
      toolCalls: built.toolCalls,
      text: built.text,
      meta: { mode: this.mode, model }
    };
  }
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter @dreaming-engine/server test -- ai-dream-master`
Expected: PASS(既存テスト含む全緑)

- [ ] **Step 5: コミット**

```bash
git add packages/server/src/ai/dream-master/mock.ts packages/server/test/ai-dream-master.test.ts
git commit -m "feat: MockDreamMasterが対話2フローでspeakテキストを決定論2チャンク発火"
```

---

### Task 5: server — turn-executor の SpeakStreamSink 配線と streamed フラグ

**Files:**
- Modify: `packages/server/src/ai/flow-control/turn-executor.ts`(`AiTurnInput`・`AiTurnResult`・`executeTurn`・`invokeWithLimit`)
- Test: `packages/server/test/ai-turn-executor.test.ts`

**Interfaces:**
- Consumes: Task 3/4 の `DreamMasterRunOptions.onSpeakDelta`
- Produces:
  ```ts
  export interface SpeakStreamSink {
    onAttemptStart(): void; // 各試行の最初のデルタ直前(リトライで再度呼ばれ得る)
    onDelta(delta: string): void; // 未検証増分
  }
  ```
  `AiTurnInput.speakStream?: SpeakStreamSink`、`AiTurnResult.streamed?: boolean`(デルタを1件以上転送したターン)。意味論(リトライ1回・display_zero・オール・オア・ナッシング・縮退・キャッシュ・セッション上限)は不変

- [ ] **Step 1: 失敗するテストを書く**

`packages/server/test/ai-turn-executor.test.ts` に追記(既存の偽 DreamMaster 構築の流儀に合わせる):

```ts
describe("対話ストリーミングの sink 配線(オーナー指示 2026-07-12)", () => {
  /** run 時に onSpeakDelta へ chunks を発火してから結果を返す偽 DreamMaster */
  function streamingDm(chunks: string[], results: DreamMasterResult[]): DreamMaster {
    let call = 0;
    return {
      mode: "mock",
      run: async (_ctx, options) => {
        for (const chunk of chunks) {
          await Promise.resolve();
          options?.onSpeakDelta?.(chunk);
        }
        const result = results[Math.min(call, results.length - 1)]!;
        call += 1;
        return result;
      }
    };
  }

  function sinkRecorder(): { sink: SpeakStreamSink; starts: number; deltas: string[] } {
    const rec = { starts: 0, deltas: [] as string[] } as { sink: SpeakStreamSink; starts: number; deltas: string[] };
    rec.sink = {
      onAttemptStart: () => {
        rec.starts += 1;
      },
      onDelta: (d) => {
        rec.deltas.push(d);
      }
    };
    return rec;
  }

  it("成功ターン: onAttemptStart 1回→デルタ転送、result.streamed=true", async () => {
    const ok = okConversationResult('「ようこそ」'); // 既存ヘルパー流儀で speak 1件の成功結果を作る
    const executor = new AiTurnExecutor({ dreamMaster: streamingDm(["「よう", "こそ」"], [ok]), config });
    const rec = sinkRecorder();
    const result = await executor.executeTurn({ ...conversationInput(), speakStream: rec.sink });
    expect(rec.starts).toBe(1);
    expect(rec.deltas.join("")).toBe("「ようこそ」");
    expect(result.streamed).toBe(true);
    expect(result.usedFallback).toBe(false);
  });

  it("リトライ: 各試行の最初のデルタで onAttemptStart が呼び直される(計2回)", async () => {
    const fail: DreamMasterResult = { ok: false, flow: "conversation", failure: "api_error", meta: META };
    const ok = okConversationResult('「ようこそ」');
    const executor = new AiTurnExecutor({ dreamMaster: streamingDm(["半端"], [fail, ok]), config });
    const rec = sinkRecorder();
    const result = await executor.executeTurn({ ...conversationInput(), speakStream: rec.sink });
    expect(rec.starts).toBe(2);
    expect(result.streamed).toBe(true);
  });

  it("ストリーム後に出力壁却下(display_zero 確定)→ usedFallback=true かつ streamed=true", async () => {
    const bad = okConversationResult("As an AI language model, I cannot."); // 出力壁で却下される speak
    const executor = new AiTurnExecutor({ dreamMaster: streamingDm(["As an AI"], [bad, bad]), config });
    const rec = sinkRecorder();
    const result = await executor.executeTurn({ ...conversationInput(), speakStream: rec.sink });
    expect(result.usedFallback).toBe(true);
    expect(result.failureKind).toBe("display_approved_zero");
    expect(result.streamed).toBe(true);
  });

  it("空デルタは転送しない・sink 未指定でも従来どおり動く", async () => {
    const ok = okConversationResult('「ようこそ」');
    const executor = new AiTurnExecutor({ dreamMaster: streamingDm(["", "「ようこそ」"], [ok]), config });
    const rec = sinkRecorder();
    const result = await executor.executeTurn({ ...conversationInput(), speakStream: rec.sink });
    expect(rec.deltas).toEqual(['「ようこそ」']);
    expect(result.streamed).toBe(true);
    // sink 未指定
    const executor2 = new AiTurnExecutor({ dreamMaster: streamingDm([], [ok]), config });
    const result2 = await executor2.executeTurn(conversationInput());
    expect(result2.streamed).not.toBe(true);
  });

  it("キャッシュヒット・縮退中は sink に触れない", async () => {
    // 既存のキャッシュヒットテスト・縮退テストの構築流儀を流用し、sink を渡して
    // starts=0 / deltas=[] を検証する(battleResult キャッシュ格納→2回目ヒット等)
  });
});
```

※ `okConversationResult` / `conversationInput` / `META` / `config` は既存テストのヘルパー・フィクスチャ名に合わせて調整する(存在しない場合は既存テスト内の同等構築コードを最小ヘルパーに抽出してよい)。

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter @dreaming-engine/server test -- ai-turn-executor`
Expected: FAIL(speakStream が型に存在しない)

- [ ] **Step 3: 実装**

`turn-executor.ts`:

(a) 型を追加(`AiTurnInput` の直前):

```ts
/**
 * 対話ストリーミングの受け口(セッション層が実装。オーナー指示 2026-07-12)。
 * ターン実行器は各試行の最初のデルタ直前に onAttemptStart を呼ぶ
 * (リトライ時に再度呼ばれる=クライアントは表示バッファをクリアして再開する)。
 */
export interface SpeakStreamSink {
  onAttemptStart(): void;
  onDelta(delta: string): void;
}
```

(b) `AiTurnInput` に `readonly speakStream?: SpeakStreamSink;` を追加。
(c) `AiTurnResult` に追加:

```ts
  /** 対話ストリーミングで未検証増分を1件以上先行転送したか(監査の streamed/retracted 用) */
  readonly streamed?: boolean;
```

(d) `executeTurn` のリトライループを次の形に(縮退・キャッシュの早期リターンは現状のまま=sink に触れない):

```ts
    let streamed = false;
    const sink = input.speakStream;
    for (let attempt = 0; attempt <= RETRY_LIMIT_PER_TRIGGER; attempt += 1) {
      let attemptStarted = false;
      const runOptions: DreamMasterRunOptions | undefined =
        sink === undefined
          ? undefined
          : {
              onSpeakDelta: (delta): void => {
                if (delta.length === 0) return;
                if (!attemptStarted) {
                  attemptStarted = true;
                  sink.onAttemptStart();
                }
                streamed = true;
                sink.onDelta(delta);
              }
            };
      const invoked = await this.invokeWithLimit(input.dmContext, runOptions);
      if (invoked.blocked) {
        const blockedResult = this.fallbackResult(flow, {
          failedTurn: false,
          failureKind: null,
          degradationActivated: invoked.justActivated ? "session_limit" : null,
          aiInvoked: attempt > 0
        });
        return streamed ? { ...blockedResult, streamed: true } : blockedResult;
      }
      const outcome = this.evaluateResult(flow, input, invoked.result);
      const retryable = outcome.kind === "dm_failure" || outcome.kind === "display_zero";
      if (retryable && attempt < RETRY_LIMIT_PER_TRIGGER) continue;
      const finalized = this.finalizeOutcome(flow, outcome);
      const result = streamed ? { ...finalized, streamed: true } : finalized;
      if (cacheKey !== null) this.maybeStoreTurn(cacheKey, result);
      return result;
    }
```

(e) `invokeWithLimit` にオプションを素通しさせる:

```ts
  private async invokeWithLimit(
    ctx: DreamMasterContext,
    runOptions?: DreamMasterRunOptions
  ): Promise<...> {  // 戻り値型は現状のまま
    ...
    const result = await this.dreamMaster.run(ctx, runOptions);
    ...
  }
```

import に `DreamMasterRunOptions` を追加。

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter @dreaming-engine/server test -- ai-turn-executor`
Expected: PASS(既存テスト含む全緑)

- [ ] **Step 5: コミット**

```bash
git add packages/server/src/ai/flow-control/turn-executor.ts packages/server/test/ai-turn-executor.test.ts
git commit -m "feat: ターン実行器にSpeakStreamSinkを配線(試行毎のattempt-start・streamedフラグ。意味論不変)"
```

---

### Task 6: server — gatekeeper の sink 素通しと監査 streamed/retracted

**Files:**
- Modify: `packages/server/src/ai/audit-log.ts:54-72`(`AiCallRecord`)
- Modify: `packages/server/src/ai/flow-control/gatekeeper.ts`(3入力型・`runGuardedTurn`・`auditTurn`)
- Test: `packages/server/test/ai-flow-gatekeeper.test.ts`

**Interfaces:**
- Consumes: Task 5 の `SpeakStreamSink` / `AiTurnResult.streamed`
- Produces: `OpenConversationInput` / `SendConversationInput` / `GenerateQuestInput` に `readonly speakStream?: SpeakStreamSink;`。監査の `ai_call` 行に `streamed: boolean` / `retracted: boolean`(retracted = streamed かつ usedFallback)

- [ ] **Step 1: 失敗するテストを書く**

`packages/server/test/ai-flow-gatekeeper.test.ts` に追記(既存の gatekeeper 構築・監査ログ読み取りの流儀に合わせる):

```ts
describe("対話ストリーミングの素通しと監査(オーナー指示 2026-07-12)", () => {
  it("openConversation の speakStream が DreamMaster まで届き、デルタが転送される", async () => {
    // MockDreamMaster(Task 4 で2チャンク発火)で組んだ gatekeeper に sink を渡す
    const deltas: string[] = [];
    let starts = 0;
    const result = await gk.openConversation({
      npcId: "innkeeper",
      affinityAtOpen: 30,
      persistent,
      speakStream: {
        onAttemptStart: () => {
          starts += 1;
        },
        onDelta: (d) => {
          deltas.push(d);
        }
      }
    });
    expect(starts).toBe(1);
    expect(deltas.join("")).toBe(result.displayText); // Mock は検証を通るため最終正文と一致
  });

  it("ai_call 監査行に streamed/retracted が記録される(成功=retracted:false)", async () => {
    // 上と同様に実行後、auditLog.flush() → jsonl を読み、
    // ai_call 行に streamed: true, retracted: false があることを検証
  });

  it("ストリーム後フォールバック確定のターンは retracted: true で記録される", async () => {
    // 出力壁で却下される speak を返す偽 DreamMaster(Task 5 の streamingDm 流儀)で組み、
    // sendConversation 実行後の ai_call 行に streamed: true, retracted: true を検証
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter @dreaming-engine/server test -- ai-flow-gatekeeper`
Expected: FAIL(speakStream が型に存在しない)

- [ ] **Step 3: 実装**

(a) `audit-log.ts` の `AiCallRecord` に追記:

```ts
  /** 対話ストリーミングで未検証増分を先行表示したか(オーナー指示 2026-07-12) */
  streamed?: boolean;
  /** ストリーム表示後にターンが失敗し、表示を定型文へ撤回したか(streamed かつ usedFallback) */
  retracted?: boolean;
```

(b) `gatekeeper.ts`:
- import に `SpeakStreamSink` を追加(`./turn-executor.js`)
- `OpenConversationInput` / `SendConversationInput` / `GenerateQuestInput` に `readonly speakStream?: SpeakStreamSink;` を追加
- `openConversation` / `sendConversation` / `generateQuest` の `runGuardedTurn` 呼び出しに `speakStream: input.speakStream` を渡す(`runGuardedTurn` の spec 型に `speakStream?: SpeakStreamSink` を追加し、`executor.executeTurn({ ..., ...(spec.speakStream !== undefined ? { speakStream: spec.speakStream } : {}) })` で素通し。dream/battleResult/summary の呼び出しは渡さない=現状のまま)
- `auditTurn` の `logAiCall` に追記:

```ts
        streamed: turn.streamed === true,
        retracted: turn.streamed === true && turn.usedFallback,
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter @dreaming-engine/server test -- ai-flow-gatekeeper ai-audit-log`
Expected: PASS(既存テスト含む全緑)

- [ ] **Step 5: コミット**

```bash
git add packages/server/src/ai/audit-log.ts packages/server/src/ai/flow-control/gatekeeper.ts packages/server/test/ai-flow-gatekeeper.test.ts
git commit -m "feat: gatekeeperのsink素通しと監査ai_call行へのstreamed/retracted記録"
```

---

### Task 7: server — session.ts の配線(3呼び出し点で push)

**Files:**
- Modify: `packages/server/src/game/session.ts`(`openConversation` 1071行付近・`conversationSend` 1106行付近・`questRequest` 1237行付近+ヘルパー追加)
- Test: `packages/server/test/session-ai.test.ts`

**Interfaces:**
- Consumes: Task 1 のWSメッセージ、Task 6 の `speakStream` 入力
- Produces: 会話開始・自由入力送信・クエスト生成の実行中に `{type:"ai-stream-start", npcId}` → `{type:"ai-stream-delta", text}`… が `pushSender` 経由で送出される。最終の `[snapshot, ai-utterance]` は従来どおり(変更なし)

- [ ] **Step 1: 失敗するテストを書く**

`packages/server/test/session-ai.test.ts` に追記(`makeAiSession` と挨拶 push テストの既存流儀に合わせる。push の収集は `session.setPushSender((msgs) => pushed.push(...msgs))`、非同期整定は既存の flush ヘルパーか `await new Promise((r) => setTimeout(r, 0))` を複数回):

```ts
describe("対話ストリーミングの push 配線(オーナー指示 2026-07-12)", () => {
  it("挨拶生成: ai-stream-start → delta×2 → [snapshot, ai-utterance] の順で届き、デルタ連結=最終正文", async () => {
    const { session } = makeAiSession(); // MockDreamMaster(通常モード)
    const pushed: ServerMessage[] = [];
    session.setPushSender((msgs) => pushed.push(...msgs));
    await session.handle({ type: "new-game", options: {} }); // 既存テストの開始手順に合わせる
    // 情報屋の正面へ移動して interact(既存の会話テストヘルパーを流用)
    await talkToNpc(session, "informant");
    await flushAsync(); // 完了ハンドラの push まで整定
    const types = pushed.map((m) => m.type);
    expect(types.indexOf("ai-stream-start")).toBeGreaterThanOrEqual(0);
    expect(types.indexOf("ai-stream-start")).toBeLessThan(types.indexOf("ai-utterance"));
    const deltas = pushed.filter((m) => m.type === "ai-stream-delta");
    const final = pushed.find((m) => m.type === "ai-utterance");
    expect(deltas.map((d) => (d as { text: string }).text).join("")).toBe(
      (final as { text: string }).text
    );
  });

  it("自由入力送信でもストリームが届く(送信結果の ai-utterance と一致)", async () => {
    // talkToNpc 後、クールダウンを advanceClock で越え、conversation-send を handle。
    // pushed に ai-stream-start/delta があり、戻り値の ai-utterance テキストと連結一致を検証
  });

  it("撤回: 出力壁で却下される speak を流す DreamMaster では、最終 ai-utterance が定型文になり
      会話記憶に未検証テキストが残らない", async () => {
    // 偽 DreamMaster: onSpeakDelta で "As an AI" を発火し、speak(逸脱テキスト)を返す
    // (makeAiSession の dreamMaster 差し替え口を使う。無ければ opts に追加する)
    // 検証: (1) pushed に ai-stream-start が2回(リトライで再スタート)
    //        (2) 最終 ai-utterance.text === fallbackTextForFlow("conversation") 相当の定型文
    //        (3) 会話記憶(state.npcs[npcId].memory.recentExchanges)の npc 側テキストに
    //            "As an AI" が含まれない(定型文が記録される)
  });

  it("会話を即終了した後に完了したストリームは push されない(ガード)", async () => {
    // talkToNpc → 整定を待たずに conversation-end を handle → flushAsync
    // pushed に ai-stream-start / ai-stream-delta が存在しないことを検証
  });

  it("pushSender 未設定(切断中)でもストリーミングターンが完走する", async () => {
    // setPushSender(null) のまま talkToNpc → flushAsync → 例外なく完了し状態が壊れないこと
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter @dreaming-engine/server test -- session-ai`
Expected: FAIL(ai-stream-start が push されない)

- [ ] **Step 3: 実装**

`session.ts` にヘルパーを追加(`aiUtteranceMsg` の近く):

```ts
  /**
   * 対話ストリーミングの sink を組む(オーナー指示 2026-07-12。設計書
   * docs/superpowers/specs/2026-07-12-dialog-streaming-design.md)。
   * 未検証増分の**画面表示専用**の先行 push。世代印・同一NPC会話継続のガードを通る間だけ送る。
   * 最終正文/定型文は従来どおり ai-utterance が運ぶ(ストリームの end/abort を兼ねる)。
   * ai-stream-start は各試行の最初のデルタ直前に届く(turn-executor が制御)=
   * リトライ時はクライアントが表示バッファをクリアして再開する。
   */
  private buildSpeakStreamSink(npcId: NpcId, generation: number): SpeakStreamSink {
    const inConversation = (): boolean =>
      this.gameGeneration === generation &&
      this.state !== null &&
      this.activeInteraction?.kind === "conversation" &&
      this.activeInteraction.npcId === npcId;
    return {
      onAttemptStart: (): void => {
        if (inConversation()) this.push([{ type: "ai-stream-start", npcId }]);
      },
      onDelta: (delta): void => {
        if (inConversation()) this.push([{ type: "ai-stream-delta", text: delta }]);
      }
    };
  }
```

import に `SpeakStreamSink`(`../ai/flow-control/index.js` から。エクスポートされていなければ `flow-control/index.ts` に追加)を足す。

3呼び出し点に配線:
- `openConversation`(1078行付近): `gk.openConversation({ ..., speakStream: this.buildSpeakStreamSink(npcId, generation) })`
- `conversationSend`(1116行付近): `const generation = this.gameGeneration;` を await の前に取り、`gk.sendConversation({ ..., speakStream: this.buildSpeakStreamSink(npcId, generation) })`
- `questRequest`(1249行付近): 同様に `speakStream: this.buildSpeakStreamSink(npcId, generation)`

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter @dreaming-engine/server test -- session-ai`
Expected: PASS(既存テスト含む全緑)

- [ ] **Step 5: pnpm check で全体緑を確認してコミット**

Run: `pnpm check`
Expected: 緑

```bash
git add packages/server/src/game/session.ts packages/server/src/ai/flow-control/index.ts packages/server/test/session-ai.test.ts
git commit -m "feat: セッション層の対話ストリーミング配線(挨拶・自由入力・クエスト生成のpush送出)"
```

---

### Task 8: server — 攻撃テストA追加(ストリーム撤回・非永続化)

**Files:**
- Modify: `packages/server/test/guardrails/attack-a.test.ts`
- Modify: `packages/server/test/guardrails/manifest.test.ts`(`REQUIRED_ATTACK_TEST_IDS` に2件追加)

**Interfaces:**
- Consumes: Task 5-7 の全配線
- Produces: 必須テストID `ATK-stream-retract-display` / `ATK-stream-no-persist`

- [ ] **Step 1: マニフェストに ID を追加(先に追加してメタテストを失敗させる)**

`manifest.test.ts` の `REQUIRED_ATTACK_TEST_IDS` 末尾グループに:

```ts
  // 対話ストリーミングの撤回(第4層の例外規定の必須条件。オーナー指示 2026-07-12)
  "ATK-stream-retract-display",
  "ATK-stream-no-persist",
```

Run: `pnpm --filter @dreaming-engine/server test -- guardrails/manifest`
Expected: FAIL(必須IDがアクティブに存在しない)

- [ ] **Step 2: 攻撃テストを書く**

`attack-a.test.ts` に追記(既存のセッション/実行器リグの流儀に合わせる。偽 DreamMaster は Task 5 の `streamingDm` と同型):

```ts
describe("対話ストリーミングの撤回(オーナー指示 2026-07-12)", () => {
  it("[ATK-stream-retract-display] ストリーム済み speak が出力壁で却下されたターンは、" +
     "表示が定型文へ差し替えられ監査に streamed/retracted が残る", async () => {
    // 逸脱テキスト("As an AI language model...")をデルタ発火+speak で返す偽 DreamMaster で
    // セッションを組み、会話送信を実行。検証:
    // (1) 最終 ai-utterance のテキストが定型フォールバック文(fallbackTextForFlow("conversation"))
    // (2) 逸脱テキストが最終表示メッセージ(ai-utterance)に現れない
    // (3) 監査 ai_call 行: streamed=true, retracted=true, usedFallback=true
  });

  it("[ATK-stream-no-persist] 撤回ターンの未検証テキストが会話記憶・キャッシュ・セーブに残らない", async () => {
    // 同リグで会話送信→会話終了→セーブまで実行。検証:
    // (1) state.npcs[npcId].memory.recentExchanges の npc 側に逸脱テキストが含まれない
    // (2) executor.getCacheStats().stores が増えない(フォールバックターンは記憶されない)
    // (3) セーブファイル(テスト用ディレクトリ)の生JSONに逸脱テキストが含まれない
  });
});
```

- [ ] **Step 3: テストが通ることを確認(マニフェスト照合含む)**

Run: `pnpm --filter @dreaming-engine/server test -- guardrails`
Expected: PASS(manifest メタテスト含む全緑)

- [ ] **Step 4: コミット**

```bash
git add packages/server/test/guardrails/attack-a.test.ts packages/server/test/guardrails/manifest.test.ts
git commit -m "test: 攻撃テストA=ストリーム撤回の表示差し替えと未検証テキスト非永続化(マニフェスト登録)"
```

---

### Task 9: client — game-client のイベント2種

**Files:**
- Modify: `packages/client/src/net/game-client.ts`(イベント型・EventMap・handlers 初期化・dispatch switch)
- Test: `packages/client/test/game-client.test.ts`

**Interfaces:**
- Consumes: Task 1 のWSメッセージ
- Produces: `GameClientEventMap` に `"ai-stream-start": AiStreamStartEvent`(`{ npcId?: NpcId }`)と `"ai-stream-delta": AiStreamDeltaEvent`(`{ text: string }`)が加わり、`client.on("ai-stream-start", ...)` / `client.on("ai-stream-delta", ...)` で購読できる

- [ ] **Step 1: 失敗するテストを書く**

`packages/client/test/game-client.test.ts` に追記(sleep-start テスト 240行付近の流儀):

```ts
  it("ai-stream-start / ai-stream-delta(対話ストリーミング)をイベントとして発火する", () => {
    const { client, fakes } = makeClient(); // 既存ヘルパー流儀
    const starts: AiStreamStartEvent[] = [];
    const deltas: string[] = [];
    client.on("ai-stream-start", (e) => starts.push(e));
    client.on("ai-stream-delta", (e) => deltas.push(e.text));
    client.connect();
    requireSocket(fakes, 0).emitMessage(JSON.stringify({ type: "ai-stream-start", npcId: "informant" }));
    requireSocket(fakes, 0).emitMessage(JSON.stringify({ type: "ai-stream-delta", text: "「やあ" }));
    expect(starts).toEqual([{ npcId: "informant" }]);
    expect(deltas).toEqual(["「やあ"]);
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter @dreaming-engine/client test -- game-client`
Expected: FAIL(イベント型が存在しない)

- [ ] **Step 3: 実装**

`game-client.ts`:

```ts
/** 対話ストリーミングの開始(表示バッファをクリアして増分表示を始める) */
export interface AiStreamStartEvent {
  readonly npcId?: NpcId;
}

/** 対話ストリーミングの増分(未検証テキスト。最終正文は ai-utterance が置換する) */
export interface AiStreamDeltaEvent {
  readonly text: string;
}
```

- `GameClientEventMap` に `"ai-stream-start": AiStreamStartEvent;` と `"ai-stream-delta": AiStreamDeltaEvent;` を追加
- `handlers` 初期化オブジェクトに `"ai-stream-start": new Set(), "ai-stream-delta": new Set(),` を追加
- メッセージ dispatch の switch に case を追加(sleep-start と同じ流儀):

```ts
      case "ai-stream-start":
        this.emit("ai-stream-start", message.npcId !== undefined ? { npcId: message.npcId } : {});
        break;
      case "ai-stream-delta":
        this.emit("ai-stream-delta", { text: message.text });
        break;
```

(網羅 switch の場合は case 追加だけで型が閉じる。emit の実装流儀は既存に合わせる)

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter @dreaming-engine/client test -- game-client`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/client/src/net/game-client.ts packages/client/test/game-client.test.ts
git commit -m "feat: game-clientにai-stream-start/deltaイベントを追加"
```

---

### Task 10: client — 会話オーバーレイの増分表示と exploration-scene 配線

**Files:**
- Modify: `packages/client/src/ui/conversation-overlay.ts`(`beginStream`/`appendStream` 追加・`playUtterance` の置換分岐)
- Modify: `packages/client/src/scenes/exploration-scene.ts`(ストリームバッファ・購読・overlay 生成時の流し込み・クリア)

**Interfaces:**
- Consumes: Task 9 のイベント2種
- Produces: `ConversationOverlay.beginStream(): void` / `appendStream(delta: string): void`。`playUtterance(text)` はストリーム中なら `setImmediately(text)` で置換(タイプライターなし)、非ストリームなら従来どおり `play(text)`

- [ ] **Step 1: conversation-overlay を実装**

フィールド追加: `private streamBuffer: string | null = null;`

```ts
  /**
   * 対話ストリーミングの開始(ai-stream-start。オーナー指示 2026-07-12)。
   * 表示中のバッファをクリアし、応答待ちのまま増分表示モードへ入る
   * (リトライ時は再度呼ばれ「消えて再開」になる)。表示されるのは未検証テキストであり、
   * 最終正文(検証済み全文/定型文)は playUtterance が必ず置換する。
   */
  public beginStream(): void {
    if (this.destroyed) return;
    this.awaiting = true;
    this.hintText.setText("");
    this.streamBuffer = "";
    this.utterance.setImmediately("");
  }

  /** ストリーム増分の追記表示(ai-stream-delta)。start 前に届いたら begin から始める */
  public appendStream(delta: string): void {
    if (this.destroyed) return;
    if (this.streamBuffer === null) this.beginStream();
    this.streamBuffer = (this.streamBuffer ?? "") + delta;
    this.utterance.setImmediately(this.streamBuffer);
  }
```

`playUtterance` を修正:

```ts
  public playUtterance(text: string): void {
    if (this.destroyed) return;
    this.awaiting = false;
    this.hintText.setText("");
    if (this.streamBuffer !== null) {
      // ストリーム済み: 最終正文(検証済み全文または定型文)で即置換(タイプライター不使用)
      this.streamBuffer = null;
      this.utterance.setImmediately(text);
    } else {
      this.utterance.play(text);
    }
    if (this.input === null) this.rebuildMenu();
  }
```

- [ ] **Step 2: exploration-scene を配線**

フィールド追加(`stashedSpeak` の近く):

```ts
  /**
   * 対話ストリームの受信バッファ(オーナー指示 2026-07-12)。overlay 未生成の間も受け、
   * overlay 生成時に流し込む(stashedSpeak と同じ到着順非依存の流儀)。
   * null=ストリーム非進行。ai-utterance(最終正文)受信でクリアする。
   */
  private streamingSpeak: string | null = null;
```

`client.on("ai-utterance", ...)` の購読箇所(351行付近)に追加:

```ts
      client.on("ai-stream-start", () => {
        this.streamingSpeak = "";
        this.conversationOverlay?.beginStream();
      });
      client.on("ai-stream-delta", (delta) => {
        if (this.streamingSpeak === null) this.streamingSpeak = "";
        this.streamingSpeak += delta.text;
        this.conversationOverlay?.appendStream(delta.text);
      });
```

`handleAiUtterance` の speak 分岐(982行付近)の先頭に `this.streamingSpeak = null;` を追加(最終正文到着=ストリーム終了)。

会話 overlay の生成箇所(stashedSpeak を流し込んでいる 680-690行付近)で、stash 流し込みの前に:

```ts
      if (this.streamingSpeak !== null && this.stashedSpeak === null) {
        // 進行中ストリームを新しい overlay へ流し込む(最終正文が届けば置換される)
        this.conversationOverlay.beginStream();
        if (this.streamingSpeak.length > 0) this.conversationOverlay.appendStream(this.streamingSpeak);
      }
```

会話 overlay を閉じる箇所(`closeConversationOverlay`)で `this.streamingSpeak = null;` を追加。

- [ ] **Step 3: 型・ビルドの確認**

Run: `pnpm check`
Expected: 緑(overlay/scene は Phaser 依存のためユニットテストなし=既存流儀。表示は E2E スモークと実プレイで確認する)

- [ ] **Step 4: E2E スモークで会話フローの無回帰を確認**

Run: `pnpm test:e2e`
Expected: 24/24 緑(conversation.spec / quest.spec / quest-types.spec が対話フローを通る。既存アサートは data 属性と最終状態のみ=ストリーミングと両立)

- [ ] **Step 5: コミット**

```bash
git add packages/client/src/ui/conversation-overlay.ts packages/client/src/scenes/exploration-scene.ts
git commit -m "feat: 会話オーバーレイのストリーム増分表示と最終正文置換(撤回対応)"
```

---

### Task 11: docs — 仕様改定(オーナー指示の明記)と設計書の注記

**Files:**
- Modify: `docs/spec/ai-guardrails.md`(第4層・実装チェックリスト・攻撃テストA一覧)
- Modify: `docs/spec/ai-integration.md`(speak 効果欄・新節)
- Modify: `docs/superpowers/specs/2026-07-12-dialog-streaming-design.md`(WSメッセージ簡素化の注記)

- [ ] **Step 1: ai-guardrails.md 第4層に例外を追記**

第4層の最初の箇条書き(「プレイヤーに表示してよいのは…疑似ストリーミング…」)の直後に追加:

```markdown
- **例外: 対話ストリーミングの先行表示(オーナー指示 2026-07-12 による改定)**。
  会話(conversation)・サブクエスト生成(questGeneration)の `speak` に限り、
  生成中のツール入力 `text` の増分を**画面表示のみ**へ先行送出してよい
  (`ai-stream-start` / `ai-stream-delta`。実装は `ai-integration.md`「対話応答のストリーミング表示」)。
  ただし次の4点を必須とする(いずれかを欠く実装は本例外の対象外=上記の従来規定に従う):
  1. ターン完了時に出力壁のフルセットを**全文へ従来どおり実行**する(検証の省略・緩和はしない)
  2. 却下・失敗時はクライアント表示を定型フォールバック文で**撤回(置換)**する。
     表示の最終状態は常に「検証済み全文」または「定型文」であり、未検証テキストは残存しない
  3. 未検証テキストは**いかなる経路にも永続化しない**(会話履歴・要約・噂・キャッシュ・セーブ。
     監査ログの responseText も従来どおり検証後の値)
  4. 監査ログの `ai_call` 行に `streamed` / `retracted` を記録する
  他フロー(夢・戦果描写・要約)と永続化経路の扱いは従来どおり(本例外の対象外)。
```

- [ ] **Step 2: 実装チェックリストと攻撃テストA一覧を追記**

チェックリストの出力の壁の項の末尾に「(例外: 第4層「対話ストリーミングの先行表示」の条件を満たす `speak` の増分先行表示は許可)」を追記。攻撃テストAの一覧に追加:

```markdown
- 対話ストリーミングの撤回(オーナー指示 2026-07-12): ストリーム済みの `speak` が出力壁で
  却下されたターンで、表示が定型文へ差し替えられ(`retracted` 記録)、会話記憶・キャッシュ・
  セーブに未検証テキストが残らないこと
```

- [ ] **Step 3: ai-integration.md を追記**

speak の効果欄(1節の表)の末尾に追記: 「**拡張(オーナー指示 2026-07-12)**: 会話・サブクエスト生成では生成中の `text` 増分を画面表示のみへ先行送出してよい(条件・撤回は `ai-guardrails.md` 第4層の例外規定。下記「対話応答のストリーミング表示」)」。

「AI応答キャッシュ・先行生成(拡張: M26)」の後に新節:

```markdown
## 対話応答のストリーミング表示(拡張: オーナー指示 2026-07-12)

会話(conversation)・サブクエスト生成(questGeneration)の `speak` を、生成中に増分で
クライアントへ先行表示する(設計書: `docs/superpowers/specs/2026-07-12-dialog-streaming-design.md`)。
防御上の位置づけ・必須条件(完了時の全文検証・撤回・非永続化・監査)は `ai-guardrails.md`
第4層の例外規定が正。

- **WSメッセージ**: `ai-stream-start {npcId}`(試行開始=表示バッファのクリア。各試行の最初の
  増分の直前に遅延送出)→ `ai-stream-delta {text}`(未検証増分)→ 従来の `ai-utterance`
  (最終正文=検証済み全文/定型文。ストリームの end/abort を兼ねる)
- **意味論は不変**: 直列化・クールダウン・送信レート・リトライ1回(リトライ時は
  `ai-stream-start` の再送でクライアント表示が消えて再開)・表示系承認0件・
  オール・オア・ナッシング・縮退・セッション総数上限・キャッシュ(ヒット時はストリーム無しで
  即時全文)は従来どおり
- **状態変更 effect の適用・効果表示は従来どおり最終検証後のみ**(ストリーム中に適用される
  状態変更は存在しない)
- 増分が1件も出ないまま失敗した試行では start を送らない(従来どおり定型文の `ai-utterance` のみ)
- 監査: `ai_call` 行に `streamed`(増分を1件以上転送)/ `retracted`(streamed かつフォールバック確定)
```

- [ ] **Step 4: 設計書に実装注記を追記**

`docs/superpowers/specs/2026-07-12-dialog-streaming-design.md` の 3.2 節末尾に:

```markdown
> **実装注記(計画時の精緻化)**: `dialog-stream-end` / `dialog-stream-abort` は新設せず、
> **既存の `ai-utterance` が end/abort を兼ねる**(成功=検証済み全文/失敗=定型文で置換)。
> メッセージ名は既存の `ai-utterance` 系に合わせ `ai-stream-start` / `ai-stream-delta` とする。
> 置換・撤回・残存しない、の意味論は本設計のとおり。
```

- [ ] **Step 5: pnpm check(シークレットスキャン含む)を確認してコミット**

Run: `pnpm check`
Expected: 緑

```bash
git add docs/spec/ai-guardrails.md docs/spec/ai-integration.md docs/superpowers/specs/2026-07-12-dialog-streaming-design.md
git commit -m "docs: 対話ストリーミングの仕様改定=guardrails第4層の例外規定とai-integration新節(オーナー指示)"
```

---

### Task 12: 仕上げ — 全体検証と JOURNAL 記録

**Files:**
- Modify: `docs/progress/JOURNAL.md`(新エントリ追記)

- [ ] **Step 1: 全体の品質ゲートを通す**

Run: `pnpm check`
Expected: 緑

Run: `pnpm test:e2e`
Expected: 24/24 緑(Task 10 で実行済みでも、docs 変更後の最終確認として再実行)

- [ ] **Step 2: JOURNAL エントリを追記**

`docs/progress/JOURNAL.md` 末尾に `[90]`(番号は既存最終+1)として追記。含めるべき内容:
- オーナー指示(2026-07-12)による対話ストリーミング化の実装(ストリーム+事後検証・撤回)
- guardrails 第4層へ例外規定を追記した事実(オーナー指示による改定であることを明記)
- 実装の要点(SpeakStreamParser / SpeakStreamSink / ai-stream-start・delta / ai-utterance が end/abort 兼務 / streamed・retracted 監査)
- 裁量で決めたこと(メッセージ名の精緻化=end/abort を ai-utterance が兼ねる、Mock の2チャンク発火、等)
- 検証結果(unit 件数・E2E 24/24)
- 人間確認待ち: `AI_MODE=live` での体感確認(`pnpm test:ai-live` と実プレイ。モックではレイテンシ差を観測できない)

- [ ] **Step 3: ROADMAP/BACKLOG の整合確認**

`docs/progress/ROADMAP.md` に本件のタスクは存在しない(マイルストーン外のオーナー指示)ため変更不要を確認。BACKLOG に関連項目があれば注記(なければ何もしない)。

- [ ] **Step 4: コミット**

```bash
git add docs/progress/JOURNAL.md
git commit -m "docs: 対話ストリーミング実装の完了記録=JOURNAL(オーナー指示)"
```
