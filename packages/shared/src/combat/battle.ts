import { z } from "zod";

import { ENEMY_DISPLAY_NAMES, enemyIdSchema } from "../ids.js";
import type { EnemyId } from "../ids.js";
import { createRng, rngFromState } from "../rng.js";
import type { Rng, RngState } from "../rng.js";
import { ENEMIES, ENEMY_MOVES } from "./enemies.js";
import type { EnemyBehaviorPhase } from "./enemies.js";
import { ITEMS } from "./items.js";
import { itemIdSchema } from "./items.js";
import type { ItemId } from "./items.js";
import { SKILLS } from "./skills.js";
import { skillIdSchema } from "./skills.js";
import { statsForLevel, xpToNext, MAX_LEVEL } from "./stats.js";
import { POISON_DURATION, poisonTickDamage, STATUS_DISPLAY_NAMES, statusIdSchema, statusStateSchema } from "./status.js";
import type { StatusId, StatusState } from "./status.js";

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
}

export interface BattleEnemyState {
  enemyId: EnemyId;
  hp: number;
  maxHP: number;
  attack: number;
  defense: number;
  speed: number;
  statuses: StatusState[];
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
  | "unknown-skill"; // 未知のスキルID

export type BattleEvent =
  | { type: "action"; actor: Combatant; actionKind: "attack" | "skill"; actionName: string; mpCost?: number; message: string }
  | { type: "item-used"; itemId: ItemId; itemName: string; message: string }
  | { type: "damage"; target: Combatant; amount: number; remainingHp: number; message: string }
  | { type: "heal"; target: Combatant; hpRestored: number; remainingHp: number; message: string }
  | { type: "status-inflicted"; target: Combatant; status: StatusId; message: string }
  | { type: "status-tick"; target: Combatant; status: StatusId; amount: number; remainingHp: number; message: string }
  | { type: "status-cured"; target: Combatant; status: StatusId; message: string }
  | { type: "status-expired"; target: Combatant; status: StatusId; message: string }
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
export const commandRejectReasonSchema = z.enum([
  "battle-over",
  "not-enough-mp",
  "flee-not-allowed",
  "unusable-item",
  "unknown-skill"
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
 * 1対1の戦闘を生成する(パーティは主人公1人)。プレイヤーのステータスはレベルから導出し、
 * HP/MP は progress の値を最大値でクランプする。
 */
export function createBattle(progress: PlayerProgress, enemyId: EnemyId, seed: number): BattleState {
  const parsed = playerProgressSchema.parse(progress);
  const def = ENEMIES[enemyId];
  const stats = statsForLevel(parsed.level);
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
    statuses: []
  };

  const enemy: BattleEnemyState = {
    enemyId,
    hp: def.stats.maxHP,
    maxHP: def.stats.maxHP,
    attack: def.stats.attack,
    defense: def.stats.defense,
    speed: def.stats.speed,
    statuses: [],
    phaseIndex: 0,
    rotationStep: 0
  };

  return {
    seed,
    rngState: rng.state(),
    turn: 0,
    isBoss: def.isBoss,
    outcome: "ongoing",
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

  // --- 状態異常tick(ラウンド終端。戦闘続行時のみ) ---
  if (next.outcome === "ongoing") {
    tickStatuses(next, events);
    if (next.enemy.hp <= 0) resolveVictory(next, rng, events);
    else if (next.player.hp <= 0) resolveDefeat(next, events);
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
  }
}

/** プレイヤーコマンドを実行。逃走成功なら true(以降の行動を打ち切る) */
function executePlayerCommand(next: BattleState, command: BattleCommand, rng: Rng, events: BattleEvent[]): boolean {
  switch (command.kind) {
    case "attack": {
      events.push({ type: "action", actor: "player", actionKind: "attack", actionName: "たたかう", message: "旅人は刃を振るった。" });
      dealDamage(next, "enemy", next.player.attack, next.enemy.defense, 1, rng, events);
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
      if (skill.kind === "attack") {
        dealDamage(next, "enemy", next.player.attack, next.enemy.defense, skill.power, rng, events);
      } else {
        healTarget(next, "player", skill.healAmount, events, "安らぎの灯が、旅人の傷をそっと照らした。");
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
  dealDamage(next, "player", next.enemy.attack, next.player.defense, move.powerMultiplier, rng, events);
  if (move.inflicts && next.player.hp > 0) {
    inflictStatus(next, "player", move.inflicts, events);
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
  const existing = findStatus(unit.statuses, status);
  const duration = POISON_DURATION;
  if (existing) {
    existing.remainingTurns = duration; // 再付与は継続ラウンドをリセット
  } else {
    unit.statuses.push({ id: status, remainingTurns: duration });
  }
  const name = combatantName(target, next.enemy.enemyId);
  const message = status === "poison" ? `澱んだ靄が${name}の傷に染み入る。(${STATUS_DISPLAY_NAMES[status]})` : `${name}は${STATUS_DISPLAY_NAMES[status]}に冒された。`;
  events.push({ type: "status-inflicted", target, status, message });
}

function applyItem(next: BattleState, itemId: ItemId, events: BattleEvent[]): void {
  const item = ITEMS[itemId];
  events.push({ type: "item-used", itemId, itemName: item.name, message: `旅人は${item.name}を使った。` });
  const effect = item.battleEffect;
  if (!effect) return; // validateCommand で弾かれるため到達しない
  if (effect.kind === "heal-hp") {
    healTarget(next, "player", effect.amount, events, `${item.name}が、旅人の傷を癒した。`);
  } else {
    const unit = next.player;
    const existing = findStatus(unit.statuses, effect.status);
    if (existing) {
      unit.statuses = unit.statuses.filter((s) => s.id !== effect.status);
      events.push({ type: "status-cured", target: "player", status: effect.status, message: `${STATUS_DISPLAY_NAMES[effect.status]}が鎮まった。` });
    } else {
      events.push({ type: "status-cured", target: "player", status: effect.status, message: `だが、${STATUS_DISPLAY_NAMES[effect.status]}は巣食っていなかった。` });
    }
  }
}

/** ラウンド終端の状態異常tick(毒ダメージ)。両戦闘員の生存分に適用し、継続を1減らす。 */
function tickStatuses(next: BattleState, events: BattleEvent[]): void {
  const targets: Combatant[] = ["player", "enemy"];
  for (const target of targets) {
    const unit = target === "player" ? next.player : next.enemy;
    if (unit.hp <= 0) continue;
    const remaining: StatusState[] = [];
    for (const status of unit.statuses) {
      if (status.id === "poison" && unit.hp > 0) {
        const dmg = poisonTickDamage(unit.maxHP);
        unit.hp = Math.max(0, unit.hp - dmg);
        const name = combatantName(target, next.enemy.enemyId);
        events.push({
          type: "status-tick",
          target,
          status: "poison",
          amount: dmg,
          remainingHp: unit.hp,
          message: `毒が${name}の身を静かに蝕む。${dmg}の痛手。`
        });
      }
      const left = status.remainingTurns - 1;
      if (left > 0) {
        remaining.push({ id: status.id, remainingTurns: left });
      } else {
        const name = combatantName(target, next.enemy.enemyId);
        events.push({ type: "status-expired", target, status: status.id, message: `${name}の${STATUS_DISPLAY_NAMES[status.id]}が引いていった。` });
      }
    }
    unit.statuses = remaining;
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
    const stats = statsForLevel(p.level);
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
