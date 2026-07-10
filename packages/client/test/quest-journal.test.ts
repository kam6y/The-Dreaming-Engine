import { mainQuestStageSchema, subQuestTypeSchema } from "@dreaming-engine/shared";
import type { SubQuestView } from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import {
  describeSubQuestObjective,
  MAIN_QUEST_JOURNAL,
  SUB_QUEST_KIND_LABELS
} from "../src/ui/quest-journal-overlay.js";

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

describe("サブクエストの型別表示(M19-4)", () => {
  const baseView = {
    id: "q-1",
    targetName: "対象",
    progress: 0,
    count: 1,
    rewardGold: 20,
    title: "題",
    description: "説明",
    status: "active",
    reportReady: false
  } as const;

  it("全サブクエスト型に見出しラベルが定義されている(型追加漏れの検知)", () => {
    for (const type of subQuestTypeSchema.options) {
      const label = SUB_QUEST_KIND_LABELS[type];
      expect(label, `${type} の見出しラベルが未定義`).toBeTypeOf("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("全サブクエスト型に遂行内容1行が定義され、対象名を含む", () => {
    for (const type of subQuestTypeSchema.options) {
      const quest: SubQuestView = { ...baseView, type };
      const objective = describeSubQuestObjective(quest);
      expect(objective.length, `${type} の遂行内容が空`).toBeGreaterThan(0);
      expect(objective, `${type} の遂行内容に対象名が無い`).toContain("対象");
    }
  });
});
