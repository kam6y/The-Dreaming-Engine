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
