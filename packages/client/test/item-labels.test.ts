import { itemIdSchema } from "@dreaming-engine/shared";
import { describe, expect, it } from "vitest";

import { itemShortLabel } from "../src/ui/item-labels.js";

describe("itemShortLabel(アイテムの短い性能表記・M15-3)", () => {
  it("装備品は攻/防ボーナスを表記する(M8-4の表記の踏襲)", () => {
    expect(itemShortLabel("worn-blade")).toBe("(攻+3)");
    expect(itemShortLabel("amber-blade")).toBe("(攻+7)");
    expect(itemShortLabel("worn-cloak")).toBe("(防+2)");
    expect(itemShortLabel("warded-mail")).toBe("(防+5)");
  });

  it("消耗品は戦闘効果(回復量・治療)を表記する", () => {
    expect(itemShortLabel("potion-small")).toBe("(HP+30)");
    expect(itemShortLabel("potion-mid")).toBe("(HP+80)");
    expect(itemShortLabel("antidote")).toBe("(毒を治す)");
  });

  it("素材・クエスト用アイテムは空文字(効果を持たない)", () => {
    expect(itemShortLabel("herb")).toBe("");
    expect(itemShortLabel("ore")).toBe("");
    expect(itemShortLabel("old-key")).toBe("");
  });

  it("全アイテムIDで例外なく文字列を返す(定義漏れの検知)", () => {
    for (const id of itemIdSchema.options) {
      expect(typeof itemShortLabel(id)).toBe("string");
    }
  });
});
