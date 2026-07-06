import { z } from "zod";

/**
 * スキル識別子。M9でレベル習得により5種へ拡充する(game-design.md「スキル(拡張: M9)」)。
 * 縦切りの起点は攻撃1種+回復1種(いずれもLv1習得)。新規3種の効果種はM9-2で追加する
 * (追加時にこの enum・SKILLS・skillIdSchema へ id を足す。skillsForLevel/検証は一般形で不変)。
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
  /** 習得レベル(このレベル以上で使用可能)。レベルから純粋に導出しセーブには持たない */
  learnLevel: number;
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
  /** 習得レベル(このレベル以上で使用可能)。レベルから純粋に導出しセーブには持たない */
  learnLevel: number;
  mpCost: number;
  /** 回復するHP量 */
  healAmount: number;
  description: string;
}

export type SkillDefinition = AttackSkillDefinition | HealSkillDefinition;

/**
 * スキル定義表(識別子 → 定義)。効果値はClaude Codeの裁量(バランステストで担保)。
 * 習得レベルと数値は game-design.md「スキル(拡張: M9)」の表が正。
 * 新規3種(murk-cleave/warding-stance/blaze-ender)の効果種はM9-2でここに追加する。
 */
export const SKILLS: Record<SkillId, SkillDefinition> = {
  "ember-strike": {
    id: "ember-strike",
    kind: "attack",
    name: "焔の一閃",
    learnLevel: 1,
    mpCost: 4,
    power: 1.8,
    description: "忘れられた願いの残り火を刃に纏わせ、一息に斬り払う。"
  },
  "soothing-light": {
    id: "soothing-light",
    kind: "heal",
    name: "安らぎの灯",
    learnLevel: 1,
    mpCost: 5,
    healAmount: 45,
    description: "小さな灯をかざし、傷んだ身をそっと温めて癒す。"
  }
};

/**
 * スキルの定義順(習得判定の同レベル内タイブレーク・一覧表示の正準順)。
 * skillIdSchema の宣言順に一致し、id を足せば自動で追随する。
 */
export const SKILL_ORDER: readonly SkillId[] = skillIdSchema.options;

/** 指定レベルでそのスキルを習得済みか(習得レベル以上なら true) */
export function isSkillLearned(id: SkillId, level: number): boolean {
  return level >= SKILLS[id].learnLevel;
}

/**
 * 指定レベルで習得済みのスキル一覧を返す(習得レベル昇順→同レベルは定義順)。
 * レベルは内部状態由来。範囲外でも例外は投げず、条件を満たすものだけ返す(level<1 は空配列)。
 * 習得状態はレベルから一意に導けるためセーブには持たない(game-design.md「スキル(拡張: M9)」)。
 */
export function skillsForLevel(level: number): SkillId[] {
  return SKILL_ORDER.filter((id) => isSkillLearned(id, level)).sort(
    (a, b) => SKILLS[a].learnLevel - SKILLS[b].learnLevel
  );
}

/** 主人公が初期(Lv1)から使えるスキル一覧(skillsForLevel(1) と一致。UIのコマンド列挙用) */
export const INITIAL_SKILL_IDS: readonly SkillId[] = skillsForLevel(1);
