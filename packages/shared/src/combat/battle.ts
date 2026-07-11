import { z } from "zod";

import { createEmptyEquipment, effectiveStats, effectiveStatusResistances } from "../equipment.js";
import type { Equipment } from "../equipment.js";
import { ENEMY_DISPLAY_NAMES, enemyIdSchema } from "../ids.js";
import type { EnemyId } from "../ids.js";
import { createRng, rngFromState } from "../rng.js";
import type { Rng, RngState } from "../rng.js";
import { ENEMIES, ENEMY_MOVES } from "./enemies.js";
import type { EnemyBehaviorPhase } from "./enemies.js";
import { ITEMS } from "./items.js";
import { itemIdSchema } from "./items.js";
import type { ItemId } from "./items.js";
import { isSkillLearned, SKILLS } from "./skills.js";
import { skillIdSchema } from "./skills.js";
import type { BuffSkillDefinition } from "./skills.js";
import { statsForLevel, xpToNext, MAX_LEVEL } from "./stats.js";
import { effectiveInflictChance, STATUS_DEFS, STATUS_DISPLAY_NAMES, statusIdSchema, statusStateSchema } from "./status.js";
import type { StatusId, StatusResistances, StatusState } from "./status.js";

// ---------------------------------------------------------------------------
// プレイヤーの永続進行状態(戦闘の入出力。セーブ対象の一部)
// ---------------------------------------------------------------------------

export const playerProgressSchema = z.object({
  level: z.number().int().min(1).max(MAX_LEVEL),
  xp: z.number().int().nonnegative(),
  hp: z.number().int().nonnegative(),
  mp: z.number().int().nonnegative(),
  gold: z.number().int().nonnegative()
});
/** 戦闘に持ち込む/戦闘から持ち帰るプレイヤー状態。ステータスはレベルから導出する。 */
export type PlayerProgress = z.infer<typeof playerProgressSchema>;

// ---------------------------------------------------------------------------
// 戦闘コマンド(UIからの外部入力。zodで検証してから resolveTurn に渡す)
// ---------------------------------------------------------------------------

export const battleCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("attack") }),
  z.object({ kind: z.literal("skill"), skillId: skillIdSchema }),
  z.object({ kind: z.literal("item"), itemId: itemIdSchema }),
  z.object({ kind: z.literal("flee") })
]);
export type BattleCommand = z.infer<typeof battleCommandSchema>;

// ---------------------------------------------------------------------------
// 戦闘状態(不変更新。rngStateを内包し、同一state+同一コマンドで完全再現可能)
// ---------------------------------------------------------------------------

export type Combatant = "player" | "enemy";
export type BattleOutcome = "ongoing" | "victory" | "defeat" | "fled";

/** バフ種別。縦切りでは防御バフのみ(灯守りの構え)。将来種を足す場合はここへ追加する。 */
export type BuffKind = "defense";

/**
 * 一時的な防御バフの状態(灯守りの構え。BattlePlayerState が保持)。
 * 実効防御へ amount を加算し、ラウンド終端の tickBuffs で remainingTurns を1減らす。
 * remainingTurns が0になると失効する(buff-expired イベント)。付与ラウンドを1ターン目として数える。
 */
export interface DefenseBuffState {
  amount: number;
  remainingTurns: number;
}

export interface BattlePlayerState {
  level: number;
  xp: number;
  gold: number;
  hp: number;
  mp: number;
  maxHP: number;
  maxMP: number;
  attack: number;
  defense: number;
  speed: number;
  statuses: StatusState[];
  /**
   * 状態異常への耐性(装備由来。M21-3)。付与時に (1 − 耐性) 倍される。戦闘生成時に装備から導出し、
   * 戦闘中は不変(装備は戦闘中に変えられない)。セーブには持たない(装備から都度導出)。
   */
  resistances: StatusResistances;
  /** 発動中の防御バフ(なければ null)。実効防御へ加算される(M9-2 灯守りの構え) */
  defenseBuff: DefenseBuffState | null;
}

export interface BattleEnemyState {
  enemyId: EnemyId;
  hp: number;
  maxHP: number;
  attack: number;
  defense: number;
  speed: number;
  statuses: StatusState[];
  /** 状態異常への耐性(敵定義由来。M21-3)。付与時に (1 − 耐性) 倍される。 */
  resistances: StatusResistances;
  /** 現在の行動フェーズ(enemies の phases インデックス)。HP減少で前進のみ */
  phaseIndex: number;
  /** 現フェーズ内のローテーション位置(行動ごとに +1) */
  rotationStep: number;
}

export interface BattleState {
  seed: number;
  rngState: RngState;
  /** resolveTurn 呼び出し回数(コマンドが受理されたラウンド数) */
  turn: number;
  isBoss: boolean;
  outcome: BattleOutcome;
  /**
   * 戦闘開始時のプレイヤー装備(M8-2)。戦闘中は不変。レベルアップ時に実効攻撃力・
   * 実効防御力を装備込みで再導出する(applyLevelUps)ために保持する。
   */
  equipment: Equipment;
  player: BattlePlayerState;
  enemy: BattleEnemyState;
}

// ---------------------------------------------------------------------------
// 戦闘イベント(判別可能union。UIがそのまま日本語メッセージ化できる情報を持つ)
// ---------------------------------------------------------------------------

export type CommandRejectReason =
  | "battle-over" // 戦闘は既に終了している
  | "not-enough-mp" // MP不足
  | "flee-not-allowed" // ボス戦は逃走不可
  | "unusable-item" // 戦闘で使えないアイテム
  | "unknown-skill" // 未知のスキルID
  | "skill-not-learned"; // 習得レベル未満のスキル(未習得。M9)

export type BattleEvent =
  | { type: "action"; actor: Combatant; actionKind: "attack" | "skill"; actionName: string; mpCost?: number; message: string }
  | { type: "item-used"; itemId: ItemId; itemName: string; message: string }
  | { type: "damage"; target: Combatant; amount: number; remainingHp: number; message: string }
  | { type: "heal"; target: Combatant; hpRestored: number; remainingHp: number; message: string }
  | { type: "status-inflicted"; target: Combatant; status: StatusId; message: string }
  | { type: "status-tick"; target: Combatant; status: StatusId; amount: number; remainingHp: number; message: string }
  | { type: "status-cured"; target: Combatant; status: StatusId; message: string }
  | { type: "status-expired"; target: Combatant; status: StatusId; message: string }
  | { type: "attack-missed"; actor: Combatant; status: StatusId; message: string }
  | { type: "action-skipped"; actor: Combatant; status: StatusId; message: string }
  | { type: "buff-applied"; target: Combatant; buff: BuffKind; amount: number; remainingTurns: number; message: string }
  | { type: "buff-expired"; target: Combatant; buff: BuffKind; message: string }
  | { type: "phase-change"; enemyId: EnemyId; phaseIndex: number; message: string }
  | { type: "flee"; success: boolean; message: string }
  | { type: "victory"; xpGained: number; goldGained: number; drops: ItemId[]; message: string }
  | { type: "level-up"; fromLevel: number; toLevel: number; message: string }
  | { type: "defeat"; message: string }
  | { type: "command-rejected"; reason: CommandRejectReason; message: string };

export interface ResolveTurnResult {
  state: BattleState;
  events: BattleEvent[];
}

// ---------------------------------------------------------------------------
// 戦闘イベントの zod スキーマ(server→client の battle-events メッセージ検証用)。
// 手書きの BattleEvent 型と構造を一致させる(双方向の代入可能性をテストで担保)。
// ---------------------------------------------------------------------------

export const combatantSchema = z.enum(["player", "enemy"]);
export const battleOutcomeSchema = z.enum(["ongoing", "victory", "defeat", "fled"]);
export const buffKindSchema = z.enum(["defense"]);
export const commandRejectReasonSchema = z.enum([
  "battle-over",
  "not-enough-mp",
  "flee-not-allowed",
  "unusable-item",
  "unknown-skill",
  "skill-not-learned"
]);

export const battleEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("action"),
    actor: combatantSchema,
    actionKind: z.enum(["attack", "skill"]),
    actionName: z.string(),
    mpCost: z.number().int().optional(),
    message: z.string()
  }),
  z.object({ type: z.literal("item-used"), itemId: itemIdSchema, itemName: z.string(), message: z.string() }),
  z.object({
    type: z.literal("damage"),
    target: combatantSchema,
    amount: z.number().int(),
    remainingHp: z.number().int(),
    message: z.string()
  }),
  z.object({
    type: z.literal("heal"),
    target: combatantSchema,
    hpRestored: z.number().int(),
    remainingHp: z.number().int(),
    message: z.string()
  }),
  z.object({ type: z.literal("status-inflicted"), target: combatantSchema, status: statusIdSchema, message: z.string() }),
  z.object({
    type: z.literal("status-tick"),
    target: combatantSchema,
    status: statusIdSchema,
    amount: z.number().int(),
    remainingHp: z.number().int(),
    message: z.string()
  }),
  z.object({ type: z.literal("status-cured"), target: combatantSchema, status: statusIdSchema, message: z.string() }),
  z.object({ type: z.literal("status-expired"), target: combatantSchema, status: statusIdSchema, message: z.string() }),
  z.object({ type: z.literal("attack-missed"), actor: combatantSchema, status: statusIdSchema, message: z.string() }),
  z.object({ type: z.literal("action-skipped"), actor: combatantSchema, status: statusIdSchema, message: z.string() }),
  z.object({
    type: z.literal("buff-applied"),
    target: combatantSchema,
    buff: buffKindSchema,
    amount: z.number().int(),
    remainingTurns: z.number().int(),
    message: z.string()
  }),
  z.object({ type: z.literal("buff-expired"), target: combatantSchema, buff: buffKindSchema, message: z.string() }),
  z.object({ type: z.literal("phase-change"), enemyId: enemyIdSchema, phaseIndex: z.number().int(), message: z.string() }),
  z.object({ type: z.literal("flee"), success: z.boolean(), message: z.string() }),
  z.object({
    type: z.literal("victory"),
    xpGained: z.number().int(),
    goldGained: z.number().int(),
    drops: z.array(itemIdSchema),
    message: z.string()
  }),
  z.object({ type: z.literal("level-up"), fromLevel: z.number().int(), toLevel: z.number().int(), message: z.string() }),
  z.object({ type: z.literal("defeat"), message: z.string() }),
  z.object({ type: z.literal("command-rejected"), reason: commandRejectReasonSchema, message: z.string() })
]);

/** 戦闘中の戦闘員(プレイヤー/敵)の表示用状態(スナップショット用) */
export const battleUnitViewSchema = z.object({
  hp: z.number().int(),
  maxHp: z.number().int(),
  statuses: z.array(statusStateSchema)
});

// ---------------------------------------------------------------------------
// ダメージ・逃走・行動順(game-design.md「ターン制戦闘」の式を厳守)
// ---------------------------------------------------------------------------

/**
 * ダメージ式: max(1, floor(攻撃力 × multiplier × rand(0.9..1.1)) - floor(防御力 / 2))。
 * 通常攻撃は multiplier=1(仕様の式そのもの)。スキルは倍率のみを乗せる拡張。
 */
export function computeDamage(attack: number, defense: number, multiplier: number, rng: Rng): number {
  const variance = rng.float(0.9, 1.1);
  const raw = Math.floor(attack * multiplier * variance);
  return Math.max(1, raw - Math.floor(defense / 2));
}

/** にげる成功率 = 50% + (自素早さ - 敵素早さ) × 2%(10%-90%にクランプ) */
export function fleeChance(playerSpeed: number, enemySpeed: number): number {
  const raw = 0.5 + (playerSpeed - enemySpeed) * 0.02;
  return Math.min(0.9, Math.max(0.1, raw));
}

/** 行動順: 素早さ降順(同値は乱数)。先手・後手の配列を返す。 */
export function turnOrder(playerSpeed: number, enemySpeed: number, rng: Rng): Combatant[] {
  if (playerSpeed > enemySpeed) return ["player", "enemy"];
  if (enemySpeed > playerSpeed) return ["enemy", "player"];
  return rng.next() < 0.5 ? ["player", "enemy"] : ["enemy", "player"];
}

// ---------------------------------------------------------------------------
// 戦闘の生成
// ---------------------------------------------------------------------------

/**
 * 1対1の戦闘を生成する(パーティは主人公1人)。プレイヤーのステータスはレベル基礎値に
 * 装備ボーナスを加えた実効値(effectiveStats)から導出し、HP/MP は progress の値を最大値で
 * クランプする。equipment 省略時は空装備扱いで、実効値は statsForLevel と完全同値になる
 * (装備なしなら従来と同じ挙動: game-design.md「装備(拡張: M8)」)。
 */
export function createBattle(
  progress: PlayerProgress,
  enemyId: EnemyId,
  seed: number,
  equipment: Equipment = createEmptyEquipment()
): BattleState {
  const parsed = playerProgressSchema.parse(progress);
  const def = ENEMIES[enemyId];
  // 実効ステータス(装備込み)。maxHP/maxMP/speed は装備の影響を受けず基礎値と同値。
  const stats = effectiveStats(parsed.level, equipment);
  const rng = createRng(seed);

  const player: BattlePlayerState = {
    level: parsed.level,
    xp: parsed.xp,
    gold: parsed.gold,
    hp: Math.min(parsed.hp, stats.maxHP),
    mp: Math.min(parsed.mp, stats.maxMP),
    maxHP: stats.maxHP,
    maxMP: stats.maxMP,
    attack: stats.attack,
    defense: stats.defense,
    speed: stats.speed,
    statuses: [],
    // 装備由来の状態異常耐性(空装備なら全0=従来と同一挙動)。
    resistances: effectiveStatusResistances(equipment),
    defenseBuff: null
  };

  const enemy: BattleEnemyState = {
    enemyId,
    hp: def.stats.maxHP,
    maxHP: def.stats.maxHP,
    attack: def.stats.attack,
    defense: def.stats.defense,
    speed: def.stats.speed,
    statuses: [],
    // 敵定義由来の状態異常耐性(省略時は全0)。参照共有を避けて浅くコピーする。
    resistances: { ...(def.resistances ?? {}) },
    phaseIndex: 0,
    rotationStep: 0
  };

  return {
    seed,
    rngState: rng.state(),
    turn: 0,
    isBoss: def.isBoss,
    outcome: "ongoing",
    equipment,
    player,
    enemy
  };
}

/** 戦闘開始時の演出メッセージ(UIの「敵が現れた」表示用。イベントではなくヘルパー) */
export function encounterMessage(enemyId: EnemyId): string {
  const name = ENEMY_DISPLAY_NAMES[enemyId];
  return ENEMIES[enemyId].isBoss
    ? `${name}が、飢えたまなざしを向けてくる。`
    : `${name}が現れた。`;
}

/** BattleState のプレイヤー状態を PlayerProgress(セーブ形)へ射影する */
export function toPlayerProgress(player: BattlePlayerState): PlayerProgress {
  return { level: player.level, xp: player.xp, hp: player.hp, mp: player.mp, gold: player.gold };
}

// ---------------------------------------------------------------------------
// 状態異常ヘルパー
// ---------------------------------------------------------------------------

function findStatus(statuses: StatusState[], id: StatusId): StatusState | undefined {
  return statuses.find((s) => s.id === id);
}

function combatantName(target: Combatant, enemyId: EnemyId): string {
  return target === "player" ? "旅人" : ENEMY_DISPLAY_NAMES[enemyId];
}

/** プレイヤーの実効防御(基礎防御 + 発動中の防御バフ)。被ダメージ計算はこの値を使う。 */
function playerEffectiveDefense(player: BattlePlayerState): number {
  return player.defense + (player.defenseBuff ? player.defenseBuff.amount : 0);
}

/**
 * 行動開始時の行動不能判定(竦み等の skip 効果。M21)。
 * 行動主体に skip 効果を持つ状態異常が付与されているときだけ乱数を1つ消費する。
 * 効果を持つ状態が無ければ乱数を引かず false を返す(=状態異常が絡まない戦闘の RNG 列を保存する要)。
 * 行動不能なら action-skipped イベントを積んで true を返す(呼び出し側はその行動主体の行動を丸ごと失う)。
 */
function rollActionIncapacitated(next: BattleState, actor: Combatant, rng: Rng, events: BattleEvent[]): boolean {
  const unit = actor === "player" ? next.player : next.enemy;
  const skip = unit.statuses.find((s) => STATUS_DEFS[s.id].actionEffect?.kind === "skip");
  if (!skip) return false; // 行動不能効果を持つ状態が無い → 乱数を引かない
  const effect = STATUS_DEFS[skip.id].actionEffect;
  if (effect?.kind !== "skip") return false; // 型絞り込み(実際には到達しない)
  if (rng.next() >= effect.skipChance) return false;
  const name = combatantName(actor, next.enemy.enemyId);
  events.push({ type: "action-skipped", actor, status: skip.id, message: effect.skipMessage(name) });
  return true;
}

/**
 * 攻撃時の命中判定(眩惑等の accuracy 効果。M21)。攻撃行動専用。
 * 攻撃主体に accuracy 効果を持つ状態異常が付与されているときだけ乱数を1つ消費する。
 * 効果を持つ状態が無ければ乱数を引かず false(=命中)を返す(RNG 列を保存する要)。
 * 空振り時は attack-missed イベントを積んで true を返す(呼び出し側はダメージ・付随状態異常を不発にする)。
 */
function rollAttackMiss(next: BattleState, actor: Combatant, rng: Rng, events: BattleEvent[]): boolean {
  const unit = actor === "player" ? next.player : next.enemy;
  const dazzle = unit.statuses.find((s) => STATUS_DEFS[s.id].actionEffect?.kind === "accuracy");
  if (!dazzle) return false; // 命中低下効果を持つ状態が無い → 乱数を引かない
  const effect = STATUS_DEFS[dazzle.id].actionEffect;
  if (effect?.kind !== "accuracy") return false; // 型絞り込み(実際には到達しない)
  if (rng.next() >= effect.missChance) return false;
  const name = combatantName(actor, next.enemy.enemyId);
  events.push({ type: "attack-missed", actor, status: dazzle.id, message: effect.missMessage(name) });
  return true;
}

/** 対象の状態異常kindへの耐性(0-1。未設定は0)。M21-3 */
function statusResistanceOf(unit: BattlePlayerState | BattleEnemyState, status: StatusId): number {
  return unit.resistances[status] ?? 0;
}

/**
 * 付与確率と対象の耐性に従って状態異常を付与する(M21)。
 * 実効付与確率 = chance ×(1 − 対象の耐性)(effectiveInflictChance)。
 * - 実効>=1(=付与確率>=1 かつ 耐性0)なら付与ロールをせず必ず付与する(乱数を引かない=
 *   既存の毒付与技・スキルの挙動を保存し、combat-balance.test のRNG列をバイト一致で保つ)。
 * - 実効<=0(=耐性1.0で完全無効、または付与確率0)なら乱数を引かず付与しない。
 * - その中間のときだけ乱数を1つ消費して付与判定する。
 */
function maybeInflict(
  next: BattleState,
  target: Combatant,
  status: StatusId,
  chance: number,
  rng: Rng,
  events: BattleEvent[]
): void {
  const unit = target === "player" ? next.player : next.enemy;
  const effective = effectiveInflictChance(chance, statusResistanceOf(unit, status));
  if (effective >= 1) {
    inflictStatus(next, target, status, events);
    return;
  }
  if (effective <= 0) return; // 完全耐性 or 付与確率0 → ロールなし・付与なし
  if (rng.next() < effective) {
    inflictStatus(next, target, status, events);
  }
}

// ---------------------------------------------------------------------------
// フェーズ選択(HP割合から、有効な最進行フェーズのインデックスを返す)
// ---------------------------------------------------------------------------

function selectPhaseIndex(phases: EnemyBehaviorPhase[], hpRatio: number): number {
  let index = 0;
  for (let i = 0; i < phases.length; i += 1) {
    const phase = phases[i];
    if (phase && hpRatio <= phase.hpThreshold) index = i;
  }
  return index;
}

// ---------------------------------------------------------------------------
// resolveTurn: 1ラウンドを解決(プレイヤーコマンド + 敵行動 + 状態異常tick)
// ---------------------------------------------------------------------------

/**
 * 1ラウンド分を解決する。元 state は破壊せず、更新後の新しい state と発生イベント列を返す。
 * コマンドが不正(MP不足・ボス戦逃走・使えないアイテム等)な場合はラウンドを進めず、
 * command-rejected イベントのみを返す(state は変更しない)。
 */
export function resolveTurn(state: BattleState, command: BattleCommand): ResolveTurnResult {
  // --- コマンド検証(ラウンドを進める前に) ---
  const reject = validateCommand(state, command);
  if (reject) {
    return { state, events: [{ type: "command-rejected", reason: reject, message: rejectMessage(reject) }] };
  }

  const next = structuredClone(state);
  next.turn += 1;
  const rng = rngFromState(next.rngState);
  const events: BattleEvent[] = [];

  // --- 行動順を決めて順に実行 ---
  const order = turnOrder(next.player.speed, next.enemy.speed, rng);
  for (const actor of order) {
    if (next.outcome !== "ongoing") break;
    // 行動不能判定(竦み等の skip 効果)。行動主体に該当状態が付与されているときだけ乱数を消費する。
    // 行動不能ならその行動主体の行動を丸ごと失う(敵はローテーションを進めない/プレイヤーは
    // 選択コマンド不発=MP・アイテム消費なし)。付与されていなければ乱数を引かず素通りする。
    if (rollActionIncapacitated(next, actor, rng, events)) continue;
    if (actor === "player") {
      const fled = executePlayerCommand(next, command, rng, events);
      if (fled) break;
      if (next.enemy.hp <= 0) {
        resolveVictory(next, rng, events);
        break;
      }
    } else {
      executeEnemyAction(next, rng, events);
      if (next.player.hp <= 0) {
        resolveDefeat(next, events);
        break;
      }
    }
  }

  // --- 状態異常tick + バフ減衰(ラウンド終端。戦闘続行時のみ) ---
  if (next.outcome === "ongoing") {
    tickStatuses(next, events);
    if (next.enemy.hp <= 0) resolveVictory(next, rng, events);
    else if (next.player.hp <= 0) resolveDefeat(next, events);
    else tickBuffs(next, events); // 戦闘続行時のみ減衰(勝敗確定後のバフは無意味)
  }

  next.rngState = rng.state();
  return { state: next, events };
}

function validateCommand(state: BattleState, command: BattleCommand): CommandRejectReason | null {
  if (state.outcome !== "ongoing") return "battle-over";
  switch (command.kind) {
    case "attack":
      return null;
    case "skill": {
      const skill = SKILLS[command.skillId];
      if (!skill) return "unknown-skill";
      // 判定順: 未知ID → 未習得(習得レベル未満)→ MP不足(未習得・MP不足なら未習得を優先)
      if (!isSkillLearned(command.skillId, state.player.level)) return "skill-not-learned";
      if (state.player.mp < skill.mpCost) return "not-enough-mp";
      return null;
    }
    case "item": {
      const item = ITEMS[command.itemId];
      if (!item.battleEffect) return "unusable-item";
      return null;
    }
    case "flee":
      if (state.isBoss) return "flee-not-allowed";
      return null;
  }
}

function rejectMessage(reason: CommandRejectReason): string {
  switch (reason) {
    case "battle-over":
      return "戦いはもう終わっている。";
    case "not-enough-mp":
      return "灯が足りない。(MP不足)";
    case "flee-not-allowed":
      return "退くことは、できない。";
    case "unusable-item":
      return "それは今、使えそうにない。";
    case "unknown-skill":
      return "そのような術は知らない。";
    case "skill-not-learned":
      return "その術は、まだ会得していない。";
  }
}

/** プレイヤーコマンドを実行。逃走成功なら true(以降の行動を打ち切る) */
function executePlayerCommand(next: BattleState, command: BattleCommand, rng: Rng, events: BattleEvent[]): boolean {
  switch (command.kind) {
    case "attack": {
      events.push({ type: "action", actor: "player", actionKind: "attack", actionName: "たたかう", message: "旅人は刃を振るった。" });
      // 眩惑中は空振りしうる(付与されていなければ乱数を引かず必ず命中扱い)。
      if (!rollAttackMiss(next, "player", rng, events)) {
        dealDamage(next, "enemy", next.player.attack, next.enemy.defense, 1, rng, events);
      }
      return false;
    }
    case "skill": {
      const skill = SKILLS[command.skillId];
      next.player.mp -= skill.mpCost;
      events.push({
        type: "action",
        actor: "player",
        actionKind: "skill",
        actionName: skill.name,
        mpCost: skill.mpCost,
        message: `旅人は${skill.name}を放った。`
      });
      switch (skill.kind) {
        case "attack":
          // 眩惑中は空振りしうる。空振り時はダメージも付随状態異常も不発(MPは消費済み)。
          if (!rollAttackMiss(next, "player", rng, events)) {
            dealDamage(next, "enemy", next.player.attack, next.enemy.defense, skill.power, rng, events);
            // 命中後、敵が生存していれば付随の状態異常を付与(倒しきった相手には付与しない)。
            // 付与確率は既定1.0(その場合ロールなし=既存挙動不変)。
            if (skill.inflicts && next.enemy.hp > 0) {
              maybeInflict(next, "enemy", skill.inflicts, skill.inflictChance ?? 1, rng, events);
            }
          }
          break;
        case "heal":
          healTarget(next, "player", skill.healAmount, events, "安らぎの灯が、旅人の傷をそっと照らした。");
          break;
        case "buff":
          applyDefenseBuff(next, skill, events);
          break;
      }
      return false;
    }
    case "item": {
      applyItem(next, command.itemId, events);
      return false;
    }
    case "flee": {
      const chance = fleeChance(next.player.speed, next.enemy.speed);
      if (rng.next() < chance) {
        next.outcome = "fled";
        events.push({ type: "flee", success: true, message: "旅人は霧の中へ身を退いた。" });
        return true;
      }
      events.push({ type: "flee", success: false, message: "――退こうとしたが、足がすくんで動けない。" });
      return false;
    }
  }
}

/** 敵の行動を実行(決定論的にフェーズ・技を選び、命中させる) */
function executeEnemyAction(next: BattleState, rng: Rng, events: BattleEvent[]): void {
  const def = ENEMIES[next.enemy.enemyId];
  const ratio = next.enemy.hp / next.enemy.maxHP;
  const newPhase = selectPhaseIndex(def.phases, ratio);
  if (newPhase > next.enemy.phaseIndex) {
    next.enemy.phaseIndex = newPhase;
    next.enemy.rotationStep = 0;
    const phase = def.phases[newPhase];
    if (phase?.transition) {
      events.push({ type: "phase-change", enemyId: next.enemy.enemyId, phaseIndex: newPhase, message: phase.transition.message });
    }
  }

  const phase = def.phases[next.enemy.phaseIndex];
  if (!phase || phase.rotation.length === 0) return; // 保険(データ健全性は enemies.ts で担保)
  const moveId = phase.rotation[next.enemy.rotationStep % phase.rotation.length];
  next.enemy.rotationStep += 1;
  const move = moveId ? ENEMY_MOVES[moveId] : undefined;
  if (!move) return;

  const enemyName = ENEMY_DISPLAY_NAMES[next.enemy.enemyId];
  events.push({ type: "action", actor: "enemy", actionKind: "attack", actionName: move.id, message: `${enemyName}${move.flavor}` });
  // 眩惑中は空振りしうる。空振り時はダメージも付随状態異常も不発(付与されていなければ乱数を引かない)。
  if (!rollAttackMiss(next, "enemy", rng, events)) {
    // 被ダメージには実効防御(基礎 + 灯守りの構えのバフ)を用いる
    dealDamage(next, "player", next.enemy.attack, playerEffectiveDefense(next.player), move.powerMultiplier, rng, events);
    // 付与確率は既定1.0(その場合ロールなし=既存の毒付与技の挙動不変)
    if (move.inflicts && next.player.hp > 0) {
      maybeInflict(next, "player", move.inflicts, move.inflictChance ?? 1, rng, events);
    }
  }
}

// ---------------------------------------------------------------------------
// ダメージ・回復・状態異常の適用(イベントを積む)
// ---------------------------------------------------------------------------

function dealDamage(
  next: BattleState,
  target: Combatant,
  attack: number,
  defense: number,
  multiplier: number,
  rng: Rng,
  events: BattleEvent[]
): void {
  const dmg = computeDamage(attack, defense, multiplier, rng);
  const unit = target === "player" ? next.player : next.enemy;
  unit.hp = Math.max(0, unit.hp - dmg);
  const message =
    target === "player"
      ? `旅人は${dmg}の痛手を負った。`
      : `${ENEMY_DISPLAY_NAMES[next.enemy.enemyId]}に${dmg}の痛手を与えた。`;
  events.push({ type: "damage", target, amount: dmg, remainingHp: unit.hp, message });
}

function healTarget(next: BattleState, target: Combatant, amount: number, events: BattleEvent[], message: string): void {
  const unit = target === "player" ? next.player : next.enemy;
  const before = unit.hp;
  unit.hp = Math.min(unit.maxHP, unit.hp + amount);
  const restored = unit.hp - before;
  events.push({ type: "heal", target, hpRestored: restored, remainingHp: unit.hp, message });
}

function inflictStatus(next: BattleState, target: Combatant, status: StatusId, events: BattleEvent[]): void {
  const unit = target === "player" ? next.player : next.enemy;
  const def = STATUS_DEFS[status];
  const existing = findStatus(unit.statuses, status);
  if (existing) {
    existing.remainingTurns = def.duration; // 再付与は継続ラウンドを定義値へリセット
  } else {
    unit.statuses.push({ id: status, remainingTurns: def.duration });
  }
  const name = combatantName(target, next.enemy.enemyId);
  events.push({ type: "status-inflicted", target, status, message: def.inflictMessage(name) });
}

/** 自身に防御バフを付与する(灯守りの構え)。再使用は量・残ターンを定義値へリセット(スタックしない)。 */
function applyDefenseBuff(next: BattleState, skill: BuffSkillDefinition, events: BattleEvent[]): void {
  // 重ねがけ(裁量): amount を加算せず、amount と remainingTurns を毎回定義値へ上書きする。
  // 付与ラウンドを1ターン目として数える(remainingTurns=durationTurns)。tickBuffs で減衰・失効。
  next.player.defenseBuff = { amount: skill.defenseBonus, remainingTurns: skill.durationTurns };
  events.push({
    type: "buff-applied",
    target: "player",
    buff: "defense",
    amount: skill.defenseBonus,
    remainingTurns: skill.durationTurns,
    message: `旅人の周りに守りの帳が満ちる。(防御+${skill.defenseBonus})`
  });
}

function applyItem(next: BattleState, itemId: ItemId, events: BattleEvent[]): void {
  const item = ITEMS[itemId];
  events.push({ type: "item-used", itemId, itemName: item.name, message: `旅人は${item.name}を使った。` });
  const effect = item.battleEffect;
  if (!effect) return; // validateCommand で弾かれるため到達しない
  switch (effect.kind) {
    case "heal-hp":
      healTarget(next, "player", effect.amount, events, `${item.name}が、旅人の傷を癒した。`);
      break;
    case "cure-status":
      cureStatus(next, effect.status, events);
      break;
    case "cure-statuses":
      // 複数の状態異常をまとめて鎮める(灯明=眩惑・竦み。M21-3)。各kindごとに単一治療と同じ流儀で
      // status-cured を積む(付与中は「鎮まった」・非付与は「巣食っていなかった」)。付随イベントは既存型のみ。
      for (const status of effect.statuses) cureStatus(next, status, events);
      break;
  }
}

/** 単一の状態異常を治す(付与中なら除去+status-cured、なければ「巣食っていなかった」旨を出す)。M21-3で共通化 */
function cureStatus(next: BattleState, status: StatusId, events: BattleEvent[]): void {
  const unit = next.player;
  const existing = findStatus(unit.statuses, status);
  if (existing) {
    unit.statuses = unit.statuses.filter((s) => s.id !== status);
    events.push({ type: "status-cured", target: "player", status, message: `${STATUS_DISPLAY_NAMES[status]}が鎮まった。` });
  } else {
    events.push({ type: "status-cured", target: "player", status, message: `だが、${STATUS_DISPLAY_NAMES[status]}は巣食っていなかった。` });
  }
}

/**
 * ラウンド終端の状態異常tick(継続ダメージ)。両戦闘員の生存分に適用し、継続を1減らす。
 * 効果値・文言は STATUS_DEFS(status.ts)から引く一般形(毒を決め打ちしない)。
 */
function tickStatuses(next: BattleState, events: BattleEvent[]): void {
  const targets: Combatant[] = ["player", "enemy"];
  for (const target of targets) {
    const unit = target === "player" ? next.player : next.enemy;
    if (unit.hp <= 0) continue;
    const remaining: StatusState[] = [];
    for (const status of unit.statuses) {
      const def = STATUS_DEFS[status.id];
      // 先行tickで倒れた場合は以降のtickを適用しない(生存判定を各tickで見る)
      if (unit.hp > 0) {
        const dmg = def.tickDamage(unit.maxHP);
        if (dmg > 0) {
          unit.hp = Math.max(0, unit.hp - dmg);
          const name = combatantName(target, next.enemy.enemyId);
          events.push({
            type: "status-tick",
            target,
            status: status.id,
            amount: dmg,
            remainingHp: unit.hp,
            message: def.tickMessage(name, dmg)
          });
        }
      }
      const left = status.remainingTurns - 1;
      if (left > 0) {
        remaining.push({ id: status.id, remainingTurns: left });
      } else {
        const name = combatantName(target, next.enemy.enemyId);
        events.push({ type: "status-expired", target, status: status.id, message: def.expireMessage(name) });
      }
    }
    unit.statuses = remaining;
  }
}

/**
 * ラウンド終端のバフ減衰(戦闘続行時のみ呼ぶ)。残ターンを1減らし、0で失効イベントを出す。
 * 付与ラウンドを1ターン目として数えるため、durationTurns=3 なら付与ラウンド+続く2ラウンドの
 * 被ダメージを軽減し、3ラウンド目の終端で失効する(game-design.md「スキル(拡張: M9)」注記)。
 */
function tickBuffs(next: BattleState, events: BattleEvent[]): void {
  const buff = next.player.defenseBuff;
  if (!buff) return;
  const left = buff.remainingTurns - 1;
  if (left > 0) {
    next.player.defenseBuff = { amount: buff.amount, remainingTurns: left };
  } else {
    next.player.defenseBuff = null;
    events.push({ type: "buff-expired", target: "player", buff: "defense", message: "守りの帳が、静かにほどけて消えた。" });
  }
}

// ---------------------------------------------------------------------------
// 勝敗の解決(報酬・レベルアップ・全滅)
// ---------------------------------------------------------------------------

function resolveVictory(next: BattleState, rng: Rng, events: BattleEvent[]): void {
  next.outcome = "victory";
  const def = ENEMIES[next.enemy.enemyId];
  const xpGained = def.reward.xp;
  const goldGained = rng.int(def.reward.gold.min, def.reward.gold.max);
  const drops: ItemId[] = [];
  if (def.reward.drop && rng.next() < def.reward.drop.chance) {
    drops.push(def.reward.drop.itemId);
  }
  next.player.gold += goldGained;
  next.player.xp += xpGained;

  events.push({
    type: "victory",
    xpGained,
    goldGained,
    drops,
    message: def.isBoss
      ? `${def.displayName}は静かに崩れ、飢えは終わりを迎えた。`
      : `${def.displayName}は声もなく崩れ、風に溶けて消えた。`
  });

  applyLevelUps(next, events);
}

/** 経験値に応じてレベルアップ(複数レベル一気上がりも処理)。max/current を更新。 */
function applyLevelUps(next: BattleState, events: BattleEvent[]): void {
  const p = next.player;
  while (p.level < MAX_LEVEL) {
    const need = xpToNext(p.level);
    if (need === null || p.xp < need) break;
    p.xp -= need;
    const fromLevel = p.level;
    p.level += 1;
    const oldMaxHP = p.maxHP;
    const oldMaxMP = p.maxMP;
    // 装備込みの実効値で再導出(装備ボーナスがレベルアップで消えないようにする)。
    // maxHP/maxMP/speed は装備の影響を受けず基礎値と同値なので、実質 attack/defense のみ影響。
    const stats = effectiveStats(p.level, next.equipment);
    p.maxHP = stats.maxHP;
    p.maxMP = stats.maxMP;
    p.attack = stats.attack;
    p.defense = stats.defense;
    p.speed = stats.speed;
    // 成長分だけ現在HP/MPを回復する(全回復はしない=戦闘間の消耗を残す)
    p.hp = Math.min(p.maxHP, p.hp + (p.maxHP - oldMaxHP));
    p.mp = Math.min(p.maxMP, p.mp + (p.maxMP - oldMaxMP));
    events.push({ type: "level-up", fromLevel, toLevel: p.level, message: `旅人は Lv${p.level} に成長した。` });
  }
}

function resolveDefeat(next: BattleState, events: BattleEvent[]): void {
  next.outcome = "defeat";
  events.push({ type: "defeat", message: "旅人は悪夢に飲まれ、意識を手放した……" });
}

// ---------------------------------------------------------------------------
// 全滅時処理(純関数)。所持ゴールド半減(切り捨て)+ HP/MP全回復。
// 日送り・宿屋帰還の適用は呼び出し側(game-design.md「全滅時」「ゲーム内時間」)。
// ---------------------------------------------------------------------------

export interface PartyWipeResult {
  progress: PlayerProgress;
  /** 失ったゴールド(演出用) */
  goldLost: number;
}

export function applyPartyWipe(progress: PlayerProgress): PartyWipeResult {
  const parsed = playerProgressSchema.parse(progress);
  const stats = statsForLevel(parsed.level);
  const remainingGold = Math.floor(parsed.gold / 2);
  return {
    progress: {
      level: parsed.level,
      xp: parsed.xp,
      hp: stats.maxHP,
      mp: stats.maxMP,
      gold: remainingGold
    },
    goldLost: parsed.gold - remainingGold
  };
}

// ---------------------------------------------------------------------------
// 戦闘アイテムの消費判定(サーバーのインベントリ減算ガード。M21-3)
// ---------------------------------------------------------------------------

/**
 * どうぐコマンドの結果イベント列から、インベントリから減らすべきアイテムIDを返す(消費なしは null)。
 *
 * 戦闘エンジンは「アイテムが実際に使われた」ときだけ item-used イベントを積む(applyItem 内)。
 * 竦み(dread)で行動不能=不発のとき(rollActionIncapacitated が true で行動を丸ごと失う)や、
 * コマンド却下(command-rejected)のときは applyItem を呼ばないため item-used が出ない。
 * よって「該当 itemId の item-used が存在する」ことを消費の正確な信号とする
 * (= action-skipped/command-rejected では消費しない)。サーバー(session.ts)はこの判定に
 * 従ってインベントリ数量を1つ減らす。エンジン外の状態(インベントリ)はサーバーが唯一の正本。
 */
export function battleItemToConsume(command: BattleCommand, events: readonly BattleEvent[]): ItemId | null {
  if (command.kind !== "item") return null;
  const used = events.some((e) => e.type === "item-used" && e.itemId === command.itemId);
  return used ? command.itemId : null;
}
