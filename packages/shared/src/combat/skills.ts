import { z } from "zod";

/**
 * スキル識別子。縦切りでは主人公に攻撃1種+回復1種(game-design.md「ターン制戦闘」)。
 * 名称はClaude Codeの裁量(ゲーム内スキル名。world-lore.md 用語集への追記は不要と判断)。
 * - ember-strike : 攻撃スキル「焔の一閃(ほむらのいっせん)」。MP消費・高倍率の一撃。
 * - soothing-light: 回復スキル「安らぎの灯(やすらぎのともしび)」。MP消費でHP回復。
 */
export const skillIdSchema = z.enum(["ember-strike", "soothing-light"]);
export type SkillId = z.infer<typeof skillIdSchema>;

/** 攻撃スキル: 攻撃力 × power の倍率でダメージ(ダメージ式は battle.ts の computeDamage) */
export interface AttackSkillDefinition {
  id: SkillId;
  kind: "attack";
  name: string;
  mpCost: number;
  /** 攻撃力にかける倍率(通常攻撃=1.0 に対する高倍率) */
  power: number;
  description: string;
}

/** 回復スキル: HP を固定量回復(最大HPを超えない) */
export interface HealSkillDefinition {
  id: SkillId;
  kind: "heal";
  name: string;
  mpCost: number;
  /** 回復するHP量 */
  healAmount: number;
  description: string;
}

export type SkillDefinition = AttackSkillDefinition | HealSkillDefinition;

/** スキル定義表(識別子 → 定義)。効果値はClaude Codeの裁量(バランステストで担保)。 */
export const SKILLS: Record<SkillId, SkillDefinition> = {
  "ember-strike": {
    id: "ember-strike",
    kind: "attack",
    name: "焔の一閃",
    mpCost: 4,
    power: 1.8,
    description: "忘れられた願いの残り火を刃に纏わせ、一息に斬り払う。"
  },
  "soothing-light": {
    id: "soothing-light",
    kind: "heal",
    name: "安らぎの灯",
    mpCost: 5,
    healAmount: 45,
    description: "小さな灯をかざし、傷んだ身をそっと温めて癒す。"
  }
};

/** 主人公が初期から使えるスキル一覧(UIのコマンド列挙用) */
export const INITIAL_SKILL_IDS: readonly SkillId[] = ["ember-strike", "soothing-light"];
