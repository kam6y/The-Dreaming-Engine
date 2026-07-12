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
