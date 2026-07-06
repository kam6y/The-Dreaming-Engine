import { describe, expect, it } from "vitest";

import {
  combatantStatsSchema,
  ENEMIES,
  ENEMY_DISPLAY_NAMES,
  ENEMY_MOVES,
  enemyIdSchema,
  enemyMoveIdSchema,
  getEnemy,
  HUNT_TARGET_IDS,
  itemIdSchema,
  MID_BOSS_ENEMY_IDS,
  RESPAWNABLE_ENEMY_IDS,
  statusIdSchema,
  isMidBossEnemyId
} from "../src/index.js";
import type { EnemyId } from "../src/index.js";

// 敵定義(ENEMIES / ENEMY_MOVES)の妥当性。M10 の新敵4種を含む全敵を横断検証する。

const ALL_ENEMY_IDS = enemyIdSchema.options as readonly EnemyId[];

describe("ENEMY_MOVES(技カタログ)", () => {
  it("全技: id が一致・powerMultiplier は正・inflicts は実在の状態異常", () => {
    for (const moveId of enemyMoveIdSchema.options) {
      const move = ENEMY_MOVES[moveId];
      expect(move.id).toBe(moveId);
      expect(move.powerMultiplier).toBeGreaterThan(0);
      expect(move.flavor.length).toBeGreaterThan(0);
      if (move.inflicts !== undefined) {
        expect(statusIdSchema.safeParse(move.inflicts).success).toBe(true);
      }
    }
  });
});

describe("ENEMIES(敵定義表)", () => {
  it("enemyIdSchema の全 id に定義があり、キーが余分でない", () => {
    expect(Object.keys(ENEMIES).sort()).toEqual([...ALL_ENEMY_IDS].sort());
  });

  for (const id of ALL_ENEMY_IDS) {
    describe(`${id}`, () => {
      const def = ENEMIES[id];

      it("id・表示名が ids.ts と整合する", () => {
        expect(def.id).toBe(id);
        expect(def.displayName).toBe(ENEMY_DISPLAY_NAMES[id]);
        expect(getEnemy(id)).toBe(def);
      });

      it("ステータスが正の値(zod スキーマを満たす)", () => {
        expect(combatantStatsSchema.safeParse(def.stats).success).toBe(true);
        expect(def.stats.maxHP).toBeGreaterThan(0);
        expect(def.stats.attack).toBeGreaterThan(0);
      });

      it("フェーズが妥当(非空・hpThreshold 降順・初期は 1.0・rotation は実在技)", () => {
        expect(def.phases.length).toBeGreaterThanOrEqual(1);
        expect(def.phases[0]?.hpThreshold).toBe(1.0);
        for (let i = 1; i < def.phases.length; i += 1) {
          const prev = def.phases[i - 1];
          const cur = def.phases[i];
          if (!prev || !cur) throw new Error("欠落");
          expect(cur.hpThreshold).toBeLessThan(prev.hpThreshold);
        }
        for (const phase of def.phases) {
          expect(phase.rotation.length).toBeGreaterThanOrEqual(1);
          for (const moveId of phase.rotation) {
            expect(ENEMY_MOVES[moveId]).toBeDefined();
            expect(enemyMoveIdSchema.safeParse(moveId).success).toBe(true);
          }
        }
      });

      it("報酬が妥当(xp>0・gold は 0<=min<=max・drop は実在アイテム/確率0-1)", () => {
        expect(def.reward.xp).toBeGreaterThan(0);
        expect(def.reward.gold.min).toBeGreaterThanOrEqual(0);
        expect(def.reward.gold.max).toBeGreaterThanOrEqual(def.reward.gold.min);
        if (def.reward.drop !== undefined) {
          expect(itemIdSchema.safeParse(def.reward.drop.itemId).success).toBe(true);
          expect(def.reward.drop.chance).toBeGreaterThan(0);
          expect(def.reward.drop.chance).toBeLessThanOrEqual(1);
        }
      });
    });
  }
});

describe("M10 拡張敵の定義", () => {
  it("新敵4種が正しい表示名で存在する(world-lore.md 4.1節)", () => {
    expect(ENEMIES["wisp-flame"].displayName).toBe("迷い火");
    expect(ENEMIES["whisper-mask"].displayName).toBe("囁き仮面");
    expect(ENEMIES["rust-eater"].displayName).toBe("錆喰い");
    expect(ENEMIES["failing-spinner"].displayName).toBe("紡ぎ損ない");
  });

  it("新雑魚3種は雑魚(isBoss=false)で、リスポーンプール(RESPAWNABLE)に含まれる", () => {
    for (const id of ["wisp-flame", "whisper-mask", "rust-eater"] as const) {
      expect(ENEMIES[id].isBoss).toBe(false);
      expect(RESPAWNABLE_ENEMY_IDS).toContain(id);
    }
  });

  it("中ボス『紡ぎ損ない』は isBoss=false・2フェーズ・中ボス集合に属し、出現/hunt プール外", () => {
    const mid = ENEMIES["failing-spinner"];
    expect(mid.isBoss).toBe(false); // メインクエスト進行・エンディングを誘発しない
    expect(mid.phases.length).toBe(2); // HP50%以下で行動変化
    expect(mid.phases[1]?.hpThreshold).toBe(0.5);
    expect(mid.phases[1]?.transition?.message.length ?? 0).toBeGreaterThan(0);
    expect(isMidBossEnemyId("failing-spinner")).toBe(true);
    expect(MID_BOSS_ENEMY_IDS).toContain("failing-spinner");
    // 固定配置・リスポーンなし: 出現プールにも hunt 対象にも入れない
    expect(RESPAWNABLE_ENEMY_IDS).not.toContain("failing-spinner");
    expect(HUNT_TARGET_IDS as readonly string[]).not.toContain("failing-spinner");
  });

  it("中ボス以外(雑魚・最終ボス)は isMidBossEnemyId=false", () => {
    for (const id of ["mist-wolf", "candle-eater", "creaking-doll", "dream-eater", "wisp-flame"] as const) {
      expect(isMidBossEnemyId(id)).toBe(false);
    }
  });
});
