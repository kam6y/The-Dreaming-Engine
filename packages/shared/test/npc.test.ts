import { describe, expect, it } from "vitest";

import {
  AFFINITY_MAX,
  AFFINITY_MIN,
  appendUnsummarizedExchange,
  clampAffinity,
  createDefaultNpcState,
  createDefaultNpcStates,
  DEFAULT_NPC_TOPICS,
  INITIAL_AFFINITY,
  MAX_UNSUMMARIZED_EXCHANGES,
  npcIdSchema,
  npcStatesSchema
} from "../src/index.js";
import type { NpcMemory } from "../src/index.js";

describe("clampAffinity(好感度クランプ)", () => {
  it("0-100 の範囲へクランプする", () => {
    expect(clampAffinity(-10)).toBe(AFFINITY_MIN);
    expect(clampAffinity(0)).toBe(0);
    expect(clampAffinity(45)).toBe(45);
    expect(clampAffinity(100)).toBe(100);
    expect(clampAffinity(120)).toBe(AFFINITY_MAX);
  });
});

describe("createDefaultNpcState / createDefaultNpcStates(既定状態)", () => {
  it("初期好感度30・記憶なし・NPC 別デフォルト話題を持つ", () => {
    const s = createDefaultNpcState("merchant");
    expect(s.affinity).toBe(INITIAL_AFFINITY);
    expect(s.affinity).toBe(30);
    expect(s.topic).toBe(DEFAULT_NPC_TOPICS.merchant);
    expect(s.memory).toEqual({ summary: "", recentExchanges: [] });
  });

  it("全 NPC 分の既定状態を生成する", () => {
    const all = createDefaultNpcStates();
    for (const id of npcIdSchema.options) {
      expect(all[id].affinity).toBe(INITIAL_AFFINITY);
      expect(all[id].topic).toBe(DEFAULT_NPC_TOPICS[id]);
    }
  });
});

describe("appendUnsummarizedExchange(未要約往復の追記)", () => {
  it("上限を超えると古い順に落ち、直近 MAX_UNSUMMARIZED_EXCHANGES 件を保持する", () => {
    let memory: NpcMemory = { summary: "既存の要約", recentExchanges: [] };
    for (let i = 0; i < MAX_UNSUMMARIZED_EXCHANGES + 2; i += 1) {
      memory = appendUnsummarizedExchange(memory, { player: `p${i}`, npc: `n${i}` });
    }
    expect(memory.recentExchanges).toHaveLength(MAX_UNSUMMARIZED_EXCHANGES);
    // 先頭2件(p0,p1)が落ち、p2..p11 が残る
    expect(memory.recentExchanges[0]?.player).toBe("p2");
    expect(memory.recentExchanges.at(-1)?.player).toBe(`p${MAX_UNSUMMARIZED_EXCHANGES + 1}`);
    // 要約は保持される
    expect(memory.summary).toBe("既存の要約");
  });
});

describe("npcStatesSchema(デフォルト補完・ドリフト防止)", () => {
  it("空オブジェクトを全 NPC の既定状態へ補完する", () => {
    const parsed = npcStatesSchema.parse({});
    for (const id of npcIdSchema.options) {
      expect(parsed[id].affinity).toBe(INITIAL_AFFINITY);
      expect(parsed[id].topic).toBe(DEFAULT_NPC_TOPICS[id]);
      expect(parsed[id].memory).toEqual({ summary: "", recentExchanges: [] });
    }
  });

  it("メタ: npcStatesSchema のキー集合が npcIdSchema の enum と完全一致する", () => {
    const schemaKeys = Object.keys(npcStatesSchema.shape).sort();
    const enumKeys = [...npcIdSchema.options].sort();
    expect(schemaKeys).toEqual(enumKeys);
  });
});
