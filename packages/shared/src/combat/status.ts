import { z } from "zod";

/**
 * 状態異常の種別。
 * - poison : 毎ラウンド終端に最大HPの5%(最低1)のダメージ。継続3ラウンド(M9)。
 * - dazzle : 眩惑。付与中、行動主体の攻撃が一定確率で空振りする(命中低下。M21)。
 * - dread  : 竦み。付与中、行動主体が一定確率で行動不能になる(M21)。
 *
 * dazzle/dread は「効果種」を StatusDefinition.actionEffect に持たせる一般形で表現し、
 * battle.ts は種別を決め打ちしない(STATUS_DEFS の定義から効果・確率・文言を引く)。
 */
export const statusIdSchema = z.enum(["poison", "dazzle", "dread"]);
export type StatusId = z.infer<typeof statusIdSchema>;

/** 状態異常の付与状態(BattleState 内で各戦闘員が保持する。残りターン数で管理) */
export const statusStateSchema = z.object({
  id: statusIdSchema,
  /** 残りラウンド数。ラウンド終端のtickごとに1減り、0で解除 */
  remainingTurns: z.number().int().positive()
});
export type StatusState = z.infer<typeof statusStateSchema>;

/** 毒の継続ラウンド数(付与・更新時にこの値へリセット) */
export const POISON_DURATION = 3;

/** 眩惑・竦みの継続ラウンド数(付与・更新時にこの値へリセット。毒より短い。M21) */
export const DAZZLE_DURATION = 2;
export const DREAD_DURATION = 2;

/** 眩惑中の攻撃が空振りする確率(0-1。命中低下=accuracy 効果。M21初期値) */
export const DAZZLE_MISS_CHANCE = 0.25;
/** 竦み中に行動不能になる確率(0-1。skip 効果。M21初期値) */
export const DREAD_SKIP_CHANCE = 0.3;

/** 毒の1tickダメージ = 最大HPの5%(最低1)。切り捨て。 */
export function poisonTickDamage(maxHP: number): number {
  return Math.max(1, Math.floor(maxHP * 0.05));
}

// ---------------------------------------------------------------------------
// 状態異常への耐性(=「属性」。M21-3)
// ---------------------------------------------------------------------------

/**
 * 状態異常kindごとの耐性値(0.0〜1.0)。未指定のkindは耐性0(耐性なし)扱い。
 * プレイヤーは装備由来(equipment.ts の effectiveStatusResistances)、敵は敵定義由来
 * (enemies.ts の EnemyDefinition.resistances)で決まる。戦闘中の一時状態(BattleState)で
 * のみ保持し、セーブには持たない(装備・敵定義から都度導出する。game-design.md「耐性」)。
 * 毒(poison)へは新規付与しない方針(既定0を維持=既存の毒挙動を保存する)。
 */
export type StatusResistances = Partial<Record<StatusId, number>>;

/** 耐性値を 0.0〜1.0 にクランプする(定義側の値が範囲外でも安全に扱う) */
export function clampResistance(resistance: number): number {
  return Math.min(1, Math.max(0, resistance));
}

/**
 * 実効付与確率 = 技の付与確率 ×(1 − 対象の耐性)。耐性1.0で完全無効(0)・耐性0で付与確率そのまま。
 * battle.ts の付与判定(maybeInflict)はこの値で乱数消費の要否を決める:
 *   実効>=1(=付与確率>=1 かつ 耐性0)は乱数を引かず必ず付与し、実効<=0 は乱数を引かず付与しない。
 *   その中間のときだけ乱数を1つ消費する。これにより「付与確率1.0・耐性0」の既存経路は
 *   現状どおり乱数を引かず、combat-balance.test のRNG列がバイト一致で保存される。
 */
export function effectiveInflictChance(baseChance: number, resistance: number): number {
  return baseChance * (1 - clampResistance(resistance));
}

/** 状態異常の表示名(UIメッセージ用) */
export const STATUS_DISPLAY_NAMES: Record<StatusId, string> = {
  poison: "毒",
  dazzle: "眩惑",
  dread: "竦み"
};

/**
 * 状態異常の「行動時効果」種(命中低下・行動不能)。定義側に確率と文言を集約し、
 * battle.ts はこの一般形を読むだけで種別を決め打ちしない。tickDamage(継続ダメージ)とは
 * 直交する軸(毒は tickDamage のみ・眩惑/竦みは actionEffect のみ)。
 * - accuracy: 付与中、行動主体の攻撃行動が missChance で空振りする(ダメージ0・付随状態異常も不発)。
 * - skip    : 付与中、行動主体が行動開始時に skipChance で行動不能になる(そのラウンドの行動を失う)。
 */
export type StatusActionEffect =
  | { kind: "accuracy"; missChance: number; missMessage: (actorName: string) => string }
  | { kind: "skip"; skipChance: number; skipMessage: (actorName: string) => string };

/**
 * 状態異常の定義(効果値・継続ラウンド・文言を種別ごとに集約する一般形)。
 * battle.ts は種別を決め打ちせず、この表から duration・tickダメージ・行動時効果・メッセージを引く。
 * 種を足す場合はこの表へ1件追加する(statusIdSchema・STATUS_DISPLAY_NAMES と同時に)。
 */
export interface StatusDefinition {
  id: StatusId;
  /** UI表示名(STATUS_DISPLAY_NAMES と一致) */
  displayName: string;
  /** 付与・再付与時にリセットする継続ラウンド数 */
  duration: number;
  /** 1tickの継続ダメージ(最大HPから算出。0なら継続ダメージなし)。切り捨て・最低1は各定義側で保証 */
  tickDamage: (maxHP: number) => number;
  /**
   * 行動時効果(命中低下・行動不能)。なければ行動へ干渉しない(毒はこれを持たない)。
   * battle.ts はこの有無で乱数消費を判断する(効果を持つ状態が付与された行動主体のときだけ判定)。
   */
  actionEffect?: StatusActionEffect;
  /** 付与時メッセージ(対象名を受け取る) */
  inflictMessage: (targetName: string) => string;
  /** tick(継続ダメージ)時メッセージ */
  tickMessage: (targetName: string, amount: number) => string;
  /** 失効時メッセージ */
  expireMessage: (targetName: string) => string;
}

export const STATUS_DEFS: Record<StatusId, StatusDefinition> = {
  poison: {
    id: "poison",
    displayName: STATUS_DISPLAY_NAMES.poison,
    duration: POISON_DURATION,
    tickDamage: poisonTickDamage,
    inflictMessage: (name) => `澱んだ靄が${name}の傷に染み入る。(${STATUS_DISPLAY_NAMES.poison})`,
    tickMessage: (name, amount) => `${STATUS_DISPLAY_NAMES.poison}が${name}の身を静かに蝕む。${amount}の痛手。`,
    expireMessage: (name) => `${name}の${STATUS_DISPLAY_NAMES.poison}が引いていった。`
  },
  dazzle: {
    id: "dazzle",
    displayName: STATUS_DISPLAY_NAMES.dazzle,
    duration: DAZZLE_DURATION,
    tickDamage: () => 0, // 継続ダメージなし(効果は命中低下のみ)
    actionEffect: {
      kind: "accuracy",
      missChance: DAZZLE_MISS_CHANCE,
      missMessage: (name) => `${name}の狙いが逸れ、その一撃は虚しく空を切った。`
    },
    inflictMessage: (name) => `揺らめく灯火が${name}の視界を惑わせる。(${STATUS_DISPLAY_NAMES.dazzle})`,
    tickMessage: (name) => `${name}の視界が、なお惑っている。`, // tickDamage=0 のため通常は発火しない(保険)
    expireMessage: (name) => `${name}の視界から惑いが晴れた。`
  },
  dread: {
    id: "dread",
    displayName: STATUS_DISPLAY_NAMES.dread,
    duration: DREAD_DURATION,
    tickDamage: () => 0, // 継続ダメージなし(効果は行動不能のみ)
    actionEffect: {
      kind: "skip",
      skipChance: DREAD_SKIP_CHANCE,
      skipMessage: (name) => `${name}は身が竦み、動けなかった。`
    },
    inflictMessage: (name) => `悪夢の気配に${name}の身が竦む。(${STATUS_DISPLAY_NAMES.dread})`,
    tickMessage: (name) => `${name}は、なお身を強張らせている。`, // tickDamage=0 のため通常は発火しない(保険)
    expireMessage: (name) => `${name}の身の竦みが、ようやくほどけた。`
  }
};
