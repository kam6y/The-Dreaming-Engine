import { z } from "zod";

import type { Equipment } from "./equipment.js";
import { midBossDefeatFlag, npcIdSchema } from "./ids.js";
import type { EnemyId, NpcId } from "./ids.js";
import { mapIdSchema } from "./map.js";
import type { MapId } from "./map.js";
import { affinityTier } from "./npc.js";
import { isStageAtOrAfter } from "./quests.js";
import type { MainQuestStage } from "./quests.js";
import type { TimeOfDay } from "./time-of-day.js";

/**
 * 実績システム「夢の欠片」(M24。仕様の正: game-design.md「実績システム『夢の欠片』(拡張: M24)」)。
 *
 * - 実績は**閲覧のみ**: 解除しても報酬・能力・進行・経済には一切影響しない
 * - 定義は本ファイルの静的登録簿 `ACHIEVEMENTS` に一元化する(id・表示名・フレーバー・判定。
 *   骨子の「実績一覧(初期セット12件)」の表が正=id・表示名・条件・フレーバーを変えない)。
 *   クライアントは `MAPS` と同流儀でこれを直接 import する(view へ定義は載せない)
 * - 判定は AI 非依存の決定論: `evaluateAchievements` は Phaser 非依存の純関数で、
 *   乱数を消費しない(シード列・エンカウント・ドロップに影響しない)
 * - 解除は不可逆: サーバーが `unlockedAchievements ∪ 評価結果` で単調更新する
 *   (`mergeUnlockedAchievements`。条件が後で満たされなくなっても——装備を外す等——解除済みのまま)
 */

// ---------------------------------------------------------------------------
// 実績 id・決定論イベント
// ---------------------------------------------------------------------------

/** 実績 id(初期セット12件。英語 kebab-case。骨子の表が正=変更・削除しない) */
export const ACHIEVEMENT_IDS = [
  "first-mourning",
  "rift-beheld",
  "dream-eater-mourned",
  "beyond-the-dream",
  "spinner-stilled",
  "seasoned-dreamer",
  "traveler-outfitted",
  "first-errand",
  "dream-atlas",
  "night-wanderer",
  "woven-morning",
  "trusted-lantern"
] as const;
export const achievementIdSchema = z.enum(ACHIEVEMENT_IDS);
export type AchievementId = z.infer<typeof achievementIdSchema>;

/**
 * 実績評価の決定論イベント(非永続シグナル2種)。永続状態(GameState)からは導出できない
 * 「当該操作でいま起きた事実」を評価に渡すための列挙。当該処理(report-quest 成功・
 * 宿泊手順4の世界変化適用)がイベントを積み、単一チョークポイント評価が消費する:
 * - sub-quest-reported  : サブクエストの報告完了が成立した(first-errand)
 * - world-event-applied : 宿泊の夢シーンで世界変化が1件以上承認・適用された(woven-morning)
 */
export const achievementEventSchema = z.enum(["sub-quest-reported", "world-event-applied"]);
export type AchievementEvent = z.infer<typeof achievementEventSchema>;

/** 夢慣れた旅人(seasoned-dreamer)の解除レベル閾値(骨子の表: Lv8以上。最大10) */
export const SEASONED_DREAMER_LEVEL = 8;

// ---------------------------------------------------------------------------
// 評価入力
// ---------------------------------------------------------------------------

/**
 * 判定に必要な GameState の部分(構造的部分型)。GameState はこの型を構造的に満たすため、
 * サーバーは GameState をそのまま渡せる(判定が読むフィールドをここで明示し、
 * 依存の広がりを防ぐ。game-state.ts への import は持たない=循環回避)。
 */
export interface AchievementStateSlice {
  /** 戦果描写済みの敵種(first-mourning: 初めて悪夢を鎮めた) */
  readonly narratedEnemies: readonly EnemyId[];
  /** メインクエスト段階(rift-beheld / dream-eater-mourned / beyond-the-dream) */
  readonly mainQuestStage: MainQuestStage;
  /** マップギミック解決状態(spinner-stilled: 中ボス撃破フラグ) */
  readonly gimmicks: readonly string[];
  /** プレイヤー状態のうちレベルのみ判定に使う(seasoned-dreamer) */
  readonly player: { readonly level: number };
  /** 装備スロット(traveler-outfitted: 両スロットが埋まっている) */
  readonly equipment: Equipment;
  /** 訪問済みマップ(dream-atlas: 全マップを含む) */
  readonly visitedMaps: readonly MapId[];
  /** NPC 状態のうち好感度のみ判定に使う(trusted-lantern: いずれかが「信頼」帯) */
  readonly npcs: Readonly<Record<NpcId, { readonly affinity: number }>>;
}

/**
 * `evaluateAchievements` の入力: 判定に必要な GameState 部分+ランタイム時間帯(`timeOfDay`)+
 * 当該操作で起きた決定論イベント列(2種)。
 */
export interface AchievementInput {
  readonly state: AchievementStateSlice;
  /** ランタイム時間帯(night-wanderer: 夜の状態で評価される。M23 の非永続ランタイム値) */
  readonly timeOfDay: TimeOfDay;
  /** 当該操作で起きた決定論イベント列(first-errand / woven-morning) */
  readonly events: readonly AchievementEvent[];
}

// ---------------------------------------------------------------------------
// 登録簿(骨子の「実績一覧(初期セット12件)」の表が正)
// ---------------------------------------------------------------------------

/** 実績1件の定義(表示名・フレーバー・判定)。判定は決定論・Phaser 非依存・乱数不使用 */
export interface AchievementDefinition {
  readonly id: AchievementId;
  /** 表示名(骨子の表が正) */
  readonly name: string;
  /** フレーバー1行(world-lore.md のトーン。数値・攻略情報は書かない。骨子の表が正) */
  readonly flavor: string;
  /**
   * 解除条件(**いま**条件を満たすか)。解除の不可逆性はここでは扱わず、
   * 呼び出し側の ∪ 単調更新(mergeUnlockedAchievements)が担う。
   */
  readonly isSatisfied: (input: AchievementInput) => boolean;
}

/** 実績の静的登録簿(初期セット12件)。クライアントは表示名・フレーバーをここから直接引く */
export const ACHIEVEMENTS: Readonly<Record<AchievementId, AchievementDefinition>> = {
  "first-mourning": {
    id: "first-mourning",
    name: "はじめての弔い",
    flavor: "討つことは、弔うことだった。",
    // 初めて悪夢を鎮める(戦果描写済みの敵種が1件以上)
    isSatisfied: ({ state }) => state.narratedEnemies.length >= 1
  },
  "rift-beheld": {
    id: "rift-beheld",
    name: "綻びの在り処",
    flavor: "司祭は静かに、夢の傷口を指し示した。",
    // mainQuestStage が rift-revealed 以降(順序判定=第2章段階でも真)
    isSatisfied: ({ state }) => isStageAtOrAfter(state.mainQuestStage, "rift-revealed")
  },
  "dream-eater-mourned": {
    id: "dream-eater-mourned",
    name: "夢喰いへの弔鐘",
    flavor: "壊れた歯車の唸りが、ようやく止んだ。",
    // mainQuestStage が dream-eater-defeated 以降
    isSatisfied: ({ state }) => isStageAtOrAfter(state.mainQuestStage, "dream-eater-defeated")
  },
  "beyond-the-dream": {
    id: "beyond-the-dream",
    name: "機関の外へ",
    flavor: "この夢の外で、まだ何かが夢を紡いでいる。",
    // mainQuestStage が ch2-beyond(第2章クリア)。現状は最終段階=以降判定と等値だが、
    // 将来の段階追記(末尾追記のみの規約)でも壊れないよう順序判定で表す
    isSatisfied: ({ state }) => isStageAtOrAfter(state.mainQuestStage, "ch2-beyond")
  },
  "spinner-stilled": {
    id: "spinner-stilled",
    name: "解けた紡ぎ",
    flavor: "紡ぎ損ないの糸は、ほどけて霧に還った。",
    // gimmicks に中ボス「紡ぎ損ない」の撃破フラグを含む(midboss:failing-spinner)
    isSatisfied: ({ state }) => state.gimmicks.includes(midBossDefeatFlag("failing-spinner"))
  },
  "seasoned-dreamer": {
    id: "seasoned-dreamer",
    name: "夢慣れた旅人",
    flavor: "夢の歩き方を、体が覚え始めている。",
    // レベル8以上(最大10)
    isSatisfied: ({ state }) => state.player.level >= SEASONED_DREAMER_LEVEL
  },
  "traveler-outfitted": {
    id: "traveler-outfitted",
    name: "旅支度",
    flavor: "夢のなかでも、備えは心を軽くする。",
    // 武器・防具の両スロットが埋まっている(解除後に外しても不可逆=∪更新が保持する)
    isSatisfied: ({ state }) => state.equipment.weapon !== null && state.equipment.armor !== null
  },
  "first-errand": {
    id: "first-errand",
    name: "最初の頼まれごと",
    flavor: "誰かの役に立った——それだけのことが、欠片になる。",
    // サブクエストの報告完了が成立する(イベント由来=非永続シグナル)
    isSatisfied: ({ events }) => events.includes("sub-quest-reported")
  },
  "dream-atlas": {
    id: "dream-atlas",
    name: "夢の地図の完成",
    flavor: "旅人の巡りが、夢のかたちをなぞり終えた。",
    // visitedMaps が全マップ(mapIdSchema の実体=全8マップ)を含む(順序は問わない)
    isSatisfied: ({ state }) => mapIdSchema.options.every((id) => state.visitedMaps.includes(id))
  },
  "night-wanderer": {
    id: "night-wanderer",
    name: "夜歩き",
    flavor: "灯りのない時間にも、夢は続いている。",
    // 時間帯が夜の状態で評価される(ランタイム由来=非永続シグナル)
    isSatisfied: ({ timeOfDay }) => timeOfDay === "night"
  },
  "woven-morning": {
    id: "woven-morning",
    name: "織り込まれた朝",
    flavor: "昨日の出来事が、翌朝の世界に薄く織り込まれていた。",
    // 宿泊の夢シーンで世界変化が1件以上承認・適用される(イベント由来=非永続シグナル。
    // AI応答の内容ではなく「承認・適用された世界変化の有無」という決定論の事実のみを見る)
    isSatisfied: ({ events }) => events.includes("world-event-applied")
  },
  "trusted-lantern": {
    id: "trusted-lantern",
    name: "信頼の灯",
    flavor: "警戒の街で、ひとつの灯が旅人へ向いた。",
    // いずれかの NPC の好感度が「信頼」帯(80以上)。境界の正は npc.ts の段階表(affinityTier)
    isSatisfied: ({ state }) =>
      npcIdSchema.options.some((id) => affinityTier(state.npcs[id].affinity) === "trusted")
  }
};

// ---------------------------------------------------------------------------
// 評価・単調更新(純関数)
// ---------------------------------------------------------------------------

/**
 * いま条件を満たす実績 id 集合を返す(純関数・決定論・乱数不使用)。
 * 解除済みかどうかは見ない(不可逆性は mergeUnlockedAchievements の ∪ 単調更新が担う)。
 * 返り値の順序は登録簿の列挙順(ACHIEVEMENT_IDS)で決定論的。
 */
export function evaluateAchievements(input: AchievementInput): AchievementId[] {
  return ACHIEVEMENT_IDS.filter((id) => ACHIEVEMENTS[id].isSatisfied(input));
}

/**
 * 解除集合の ∪ 単調更新(`unlockedAchievements ∪ 評価結果`)。
 * - 既存の解除は絶対に取り除かない(解除の不可逆性=集合は増えるのみ)
 * - 新規解除は既存の末尾へ評価結果の順(=登録簿の列挙順)で追記する(解除順の履歴を保つ)
 * - 追加が無ければ**同一参照**を返す(呼び出し側は参照比較で「変化なし」を判定できる。
 *   recordVisitedMap と同流儀)
 */
export function mergeUnlockedAchievements(
  unlocked: AchievementId[],
  satisfied: readonly AchievementId[]
): AchievementId[] {
  const added = satisfied.filter((id) => !unlocked.includes(id));
  return added.length === 0 ? unlocked : [...unlocked, ...added];
}
