import { mainQuestStageSchema } from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import { MAIN_QUEST_JOURNAL } from "../src/ui/quest-journal-overlay.js";

describe("クエストジャーナルのメインクエスト表示(M18-3)", () => {
  it("全メインクエスト段階に現況文が定義されている(段階追加漏れの検知)", () => {
    for (const stage of mainQuestStageSchema.options) {
      const line = MAIN_QUEST_JOURNAL[stage];
      expect(line, `${stage} の現況文が未定義`).toBeTypeOf("string");
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it("第2章の現況文は開示の掟を守る(核心の断定語を含まない)", () => {
    // world-lore.md 1.6「語りと開示の掟」: 地名・核心・フック#1の断定なし。
    // 「還る先」の固有の行き先を示す語が現況文に混入していないことの簡易ガード
    for (const stage of ["ch2-stirring", "ch2-vigil-song", "ch2-beyond"] as const) {
      const line = MAIN_QUEST_JOURNAL[stage];
      expect(line).not.toMatch(/正体|答えは|真実は/);
    }
  });
});
