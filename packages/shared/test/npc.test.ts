import { describe, expect, it } from "vitest";

import {
  AFFINITY_MAX,
  AFFINITY_MIN,
  AFFINITY_TIERS,
  affinityTier,
  affinityTierDefinition,
  affinityTierSchema,
  appendUnsummarizedExchange,
  clampAffinity,
  createDefaultNpcState,
  createDefaultNpcStates,
  DEFAULT_NPC_TOPICS,
  GIVE_ITEM_AFFINITY_THRESHOLD,
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

describe("affinityTier(好感度の段階。game-design.md「好感度の段階(拡張: M11)」)", () => {
  it("段階境界で正しく切り替わる(19/20・49/50・79/80)", () => {
    expect(affinityTier(0)).toBe("wary");
    expect(affinityTier(19)).toBe("wary");
    expect(affinityTier(20)).toBe("distant");
    expect(affinityTier(49)).toBe("distant");
    expect(affinityTier(50)).toBe("friendly");
    expect(affinityTier(79)).toBe("friendly");
    expect(affinityTier(80)).toBe("trusted");
    expect(affinityTier(100)).toBe("trusted");
  });

  it("初期好感度30は第2段階(よそよそしい)", () => {
    expect(affinityTier(INITIAL_AFFINITY)).toBe("distant");
  });

  it("give_item の解禁閾値50が段階境界と一致する(50=打ち解けたの下限)", () => {
    expect(affinityTier(GIVE_ITEM_AFFINITY_THRESHOLD)).toBe("friendly");
    expect(affinityTier(GIVE_ITEM_AFFINITY_THRESHOLD - 1)).toBe("distant");
    const friendly = affinityTierDefinition("friendly");
    expect(friendly.min).toBe(GIVE_ITEM_AFFINITY_THRESHOLD);
  });

  it("範囲外の値はクランプして判定する(頑健性)", () => {
    expect(affinityTier(-10)).toBe("wary");
    expect(affinityTier(120)).toBe("trusted");
  });

  it("メタ: 段階表は 0-100 を昇順・隙間なく被覆し、表示名(日本語)を持つ", () => {
    expect(AFFINITY_TIERS[0]?.min).toBe(AFFINITY_MIN);
    expect(AFFINITY_TIERS.at(-1)?.max).toBe(AFFINITY_MAX);
    for (let i = 1; i < AFFINITY_TIERS.length; i += 1) {
      expect(AFFINITY_TIERS[i]?.min).toBe((AFFINITY_TIERS[i - 1]?.max ?? Number.NaN) + 1);
    }
    // 仕様表の名称と一致(4段階)
    expect(AFFINITY_TIERS.map((t) => t.label)).toEqual(["警戒", "よそよそしい", "打ち解けた", "信頼"]);
    // enum(affinityTierSchema)と表の id 集合が一致
    expect(AFFINITY_TIERS.map((t) => t.id)).toEqual([...affinityTierSchema.options]);
  });

  it("全好感度0-100で、段階の min/max と affinityTier の結果が一致する", () => {
    for (let a = AFFINITY_MIN; a <= AFFINITY_MAX; a += 1) {
      const tier = affinityTierDefinition(affinityTier(a));
      expect(a).toBeGreaterThanOrEqual(tier.min);
      expect(a).toBeLessThanOrEqual(tier.max);
    }
  });
});
