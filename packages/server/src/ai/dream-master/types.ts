import type { ConversationExchange, EnemyId, NpcId, SubQuest, WorldState } from "@dreaming-engine/shared";

import type { AiMode } from "../mode.js";
import type { ToolFlow, ToolName } from "../tool-validation/types.js";

/**
 * DreamMaster(ゲーム内AI)の抽象インターフェースと入出力型(ai-integration.md
 * 「呼び出しフロー別仕様」220-273 / 「MockDreamMaster」323-332)。
 *
 * 設計の要点:
 * - `AI_MODE` に依らず Mock と(将来の)Live が実装する **単一インターフェース** `DreamMaster`。
 * - 各呼び出しは「AIが行おうとしたツール呼び出しの **生の意図**(`RawToolCall[]`)+ 任意の最終テキスト
 *   + メタ(使用モデル名等)」を返す。**検証・適用は行わない**(それは M4-C2 のフロー制御が
 *   `tool-validation` で行う)。生の意図の `toolName` は `ToolName` 型なので、C2 は
 *   `validateToolCall(flow, toolName, rawInput, ctx)` へそのまま渡せる。
 * - 失敗(タイムアウト/APIエラー)は判別可能な結果型で返す(縮退のリトライ判定に C2 が使う)。
 * - フロー→モデル/許可ツール/タイムアウト/ターン・トークン上限は `config/ai.json` と
 *   `FLOW_TOOL_ALLOWLIST` から引く(`flow-spec.ts` の `resolveFlowSpec`)。ハードコードしない。
 */

// ---------------------------------------------------------------------------
// 生のツール呼び出し意図(検証前)
// ---------------------------------------------------------------------------

/**
 * AIが行おうとした1件のツール呼び出しの生の意図。
 * `rawInput` は未検証の外部入力として `unknown`(C2 が zod で検証する)。
 * `toolName` は 6 ツールのいずれか(`ToolName`)。悪意モードでは「現在フロー非許可の
 * ツール名(別フローのツール)」も出しうるが、いずれも定義済み `ToolName` の範囲内で、
 * フロー許可集合の二重チェック(`validateToolCall`)が却下する。
 */
export interface RawToolCall {
  readonly toolName: ToolName;
  readonly rawInput: unknown;
}

// ---------------------------------------------------------------------------
// 呼び出しコンテキスト(フロー別・判別可能ユニオン)
// ---------------------------------------------------------------------------

/**
 * NPC会話(conversation): 話しかけ・自由入力送信への応答。
 *
 * 充実フィールド(`affinity`/`topic`/`memorySummary`/`activeSubQuests`)は M4-E が GameState
 * スナップショットから供給する完全コンテキスト。**Mock は無視**(決定論を維持)、Live の `prompt.ts`
 * がタグ注入に使う。すべて任意(未供給でも従前どおり動く=前方互換)。
 */
export interface ConversationContext {
  readonly flow: "conversation";
  /** 会話相手(adjust_affinity の npcId・speak の口調に使う) */
  readonly partnerNpcId: NpcId;
  /** 直近のプレイヤー自由入力(Mock は内容非依存。M4-D がプロンプト整形に使う) */
  readonly playerUtterance: string;
  /** 会話相手の現在好感度(0..100)。speak の親密度に反映 */
  readonly affinity?: number;
  /** 会話相手の「今日の話題」(npc_rumor で置換され得る現行値) */
  readonly topic?: string;
  /** 会話記憶の要約(累積。空文字/未供給なら要約なし) */
  readonly memorySummary?: string;
  /** 受注中サブクエスト(会話の文脈に使う) */
  readonly activeSubQuests?: readonly SubQuest[];
}

/** サブクエスト生成(questGeneration): 情報屋への「仕事はある?」 */
export interface QuestGenerationContext {
  readonly flow: "questGeneration";
  /** 会話相手(通常は情報屋カイ) */
  readonly partnerNpcId: NpcId;
  /** 会話相手の「今日の話題」(任意) */
  readonly topic?: string;
  /** 受注中サブクエスト(重複依頼を避けるため提示。任意) */
  readonly activeSubQuests?: readonly SubQuest[];
}

/** 夢シーン(dream): 宿屋の宿泊 */
export interface DreamContext {
  readonly flow: "dream";
  /** 当日の行動サマリ(Mock は内容非依存。M4-D が <recent_play> に使う) */
  readonly recentPlay: string;
  /** 現在の世界状態(天候・当日 street_event・各層シンボル数)。翌朝の変化の基準として提示(任意) */
  readonly world?: WorldState;
  /** 受注中サブクエスト(夢の文脈に使う。任意) */
  readonly activeSubQuests?: readonly SubQuest[];
}

/** 戦果描写(battleResult): 初見敵の撃破 */
export interface BattleResultContext {
  readonly flow: "battleResult";
  /** 描写対象の敵種(Mock は敵別の定型文を返す) */
  readonly enemyId: EnemyId;
}

/** 会話要約(summary): 会話終了時。ツールなし・テキスト出力のみ */
export interface SummaryContext {
  readonly flow: "summary";
  /** 要約対象の会話相手 */
  readonly partnerNpcId: NpcId;
  /** 既存要約(累積置換の入力。Mock は内容非依存) */
  readonly existingSummary: string;
  /** 未要約の往復(累積置換の入力。Mock は内容非依存) */
  readonly exchanges: readonly ConversationExchange[];
}

/** DreamMaster の呼び出しコンテキスト(flow で判別) */
export type DreamMasterContext =
  | ConversationContext
  | QuestGenerationContext
  | DreamContext
  | BattleResultContext
  | SummaryContext;

// ---------------------------------------------------------------------------
// 呼び出し結果(判別可能ユニオン)
// ---------------------------------------------------------------------------

/**
 * 失敗種別。**タイムアウト(初回/全体)と API エラーのみ**が DreamMaster の失敗。
 * 「表示系承認0件」「出力壁却下」は検証の結果であり DreamMaster の失敗ではない
 * (C2 が検証後に判定する)。C2 は timeout/api_error のときのみ 1 回リトライする
 * (ai-integration.md 259-260)。
 */
export const DREAM_MASTER_FAILURE_KINDS = ["timeout_first", "timeout_total", "api_error"] as const;
export type DreamMasterFailureKind = (typeof DREAM_MASTER_FAILURE_KINDS)[number];

/** 結果メタ(監査ログ・縮退判定の補助)。model は使用モデル名 */
export interface DreamMasterMeta {
  readonly mode: AiMode;
  readonly model: string;
}

/** 成功: 生のツール意図列 + 任意の最終テキスト(summary はここに要約が載る。他は null) */
export interface DreamMasterSuccess {
  readonly ok: true;
  readonly flow: ToolFlow;
  readonly toolCalls: readonly RawToolCall[];
  readonly text: string | null;
  readonly meta: DreamMasterMeta;
}

/** 失敗: リトライ判定に使う失敗種別のみ(生の意図・テキストは持たない) */
export interface DreamMasterFailure {
  readonly ok: false;
  readonly flow: ToolFlow;
  readonly failure: DreamMasterFailureKind;
  readonly meta: DreamMasterMeta;
}

export type DreamMasterResult = DreamMasterSuccess | DreamMasterFailure;

// ---------------------------------------------------------------------------
// インターフェース本体
// ---------------------------------------------------------------------------

/**
 * 1 回の呼び出しオプション。
 * - `signal`: C2/M4-D が全体タイムアウト等で呼び出しをキャンセルするための任意シグナル。
 *   タイムアウト2値そのものは `resolveFlowSpec(flow, config).timeout` から引ける
 *   (DreamMaster は config を保持し、フロー別タイムアウトを内部で解決できる)。
 *   Mock は signal を無視する(実計測は不要。インターフェース上は存在させる)。
 */
export interface DreamMasterRunOptions {
  readonly signal?: AbortSignal;
  /**
   * speak ツール入力 text の増分コールバック(対話ストリーミング表示。オーナー指示 2026-07-12)。
   * **未検証の生テキスト増分**が渡る(画面表示専用の先行経路)。検証・最終正文の確定は
   * 従来どおりターン完了後(turn-executor)。Live は conversation/questGeneration のみ発火、
   * Mock は同2フローで決定論チャンクを発火、他フロー・未指定時は従来どおり。
   */
  readonly onSpeakDelta?: (delta: string) => void;
}

/**
 * ゲーム内AIの抽象。Mock と(M4-D の)Live が実装する単一インターフェース。
 * `run` は非同期(Live は Agent SDK の query を待つ。Mock は解決済み Promise を返す)。
 */
export interface DreamMaster {
  readonly mode: AiMode;
  run(context: DreamMasterContext, options?: DreamMasterRunOptions): Promise<DreamMasterResult>;
}
