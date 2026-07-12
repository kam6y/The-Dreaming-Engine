import type { SubQuest } from "@dreaming-engine/shared";

import type { DreamMasterContext } from "../dream-master/types.js";

/**
 * 表示専用ターンのメモ化キャッシュ(ai-integration.md「AI応答キャッシュ・先行生成(拡張: M26)」
 * 採用案A)。**防御検証を通過した後の最終出力だけ**を対象にし、いかなる防御層・ツール検証・
 * 出力壁・レート/コスト保護も弱めず・迂回せず・省略しない(追加のみ)。
 *
 * - 記憶するのは「状態変更 effect を1件も含まない成功ターン」(approvedEffects 空・出力壁通過・
 *   フォールバック/縮退/却下でない)のみ。汚染テキスト・却下結果・副作用は焼き込まない。
 * - 適用は2フローのみ: 戦果描写(battleResult。鍵=enemyId)と会話の開始挨拶
 *   (conversation の playerUtterance:"" ターン。鍵=完全文脈フィンガープリント)。
 *   ほかのフロー(自由入力・クエスト生成・要約)は**対象外**(鍵を導出しない=null)。
 * - **メモリのみ・プロセス寿命・非永続**(セーブ/ディスクへ一切書かない)。フロー別に
 *   上限件数を持つ LRU 相当で有界。
 *
 * ヒット時に再検証を省略してよい安全性: 出力壁・ツール検証は「入力バイト列→判定」が決定論の
 * 純関数であり、同一鍵=検証入力が同一バイト列 ⇒ 判定も同一。ゆえに記憶済みの結果は再検証しても
 * 承認される(冗長排除であって迂回ではない。防御は記憶を作った miss 時に実行済み)。
 */

/** キャッシュ対象フロー(表示専用ターン。ほかのフローはキャッシュしない) */
export type CacheableFlow = "battleResult" | "conversation";

/** フロー別のキャッシュ上限件数(LRU 相当。裁量値。メモリのみ・非永続) */
export const TURN_CACHE_MAX_ENTRIES_PER_FLOW = 32;

/** 記憶する検証済み表示専用ターンのスナップショット(生の副作用は持たない) */
export interface CachedTurn {
  /** 承認 speak/narrate の連結(検証済み表示テキスト) */
  readonly displayText: string;
  /** 使用モデル名(なければ null)。監査には残さないが結果の再構築に保持する */
  readonly model: string | null;
}

/** キャッシュ鍵(フロー + 正規化フィンガープリント)。非対象フローでは導出しない */
export interface CacheKey {
  readonly flow: CacheableFlow;
  readonly key: string;
}

/** プロセス内の観測カウンタ(デバッグ用。秘密情報は持たない) */
export interface TurnCacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly stores: number;
}

/**
 * 受注クエスト集合を順序非依存に正規化する(「集合」の完全一致フィンガープリント)。
 * id で安定ソートしてから各要素を JSON 直列化する(progress 等の内容差も鍵に含める=鮮度追随)。
 */
function canonicalizeQuests(quests: readonly SubQuest[] | undefined): string {
  if (quests === undefined || quests.length === 0) return "";
  const sorted = [...quests].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted.map((q) => JSON.stringify(q)).join(";");
}

/**
 * 呼び出しコンテキストからキャッシュ鍵を導出する。対象2フローのみ鍵を返し、それ以外は null。
 * 鍵は検証入力を完全に含む正規化フィンガープリント(1要素でも変われば別鍵=miss)。
 * プロンプト・タグ・ツール入出力は一切読まない(既存構築物からの読み取りのみ)。
 */
export function cacheKeyForContext(ctx: DreamMasterContext): CacheKey | null {
  if (ctx.flow === "battleResult") {
    // 最も安全・決定論的な textbook ケース: 文脈は {flow, enemyId} のみ
    return { flow: "battleResult", key: `enemy=${ctx.enemyId}` };
  }
  if (ctx.flow === "conversation" && ctx.playerUtterance === "") {
    // 会話の開始挨拶(playerUtterance:"" ターン)のみ。完全文脈フィンガープリント=
    // partnerNpcId + 好感度 + 今日の話題 + 会話記憶要約 + 受注クエスト集合の正規化ハッシュ。
    const affinity = ctx.affinity ?? "";
    const topic = ctx.topic ?? "";
    const memory = ctx.memorySummary ?? "";
    const quests = canonicalizeQuests(ctx.activeSubQuests);
    const key = [
      `npc=${ctx.partnerNpcId}`,
      `aff=${affinity}`,
      `topic=${topic}`,
      `mem=${memory}`,
      `quests=${quests}`
    ].join("");
    return { flow: "conversation", key };
  }
  return null;
}

/**
 * 表示専用ターンのメモ化キャッシュ本体。フロー別の LRU(挿入順 Map で近似)で有界。
 * `AiTurnExecutor` が DreamMaster.run の直前(get)/直後(set)で使う。
 */
export class TurnCache {
  private readonly maxPerFlow: number;
  private readonly entries: Record<CacheableFlow, Map<string, CachedTurn>> = {
    battleResult: new Map(),
    conversation: new Map()
  };
  private hits = 0;
  private misses = 0;
  private stores = 0;

  public constructor(maxPerFlow: number = TURN_CACHE_MAX_ENTRIES_PER_FLOW) {
    this.maxPerFlow = maxPerFlow;
  }

  /**
   * 鍵で参照する。ヒット時は LRU の最新へ繰り上げて返す(hits++)。ミスは misses++。
   * 呼び出し側は鍵が非 null のとき(=対象フロー)のみ呼ぶ。
   */
  public get(key: CacheKey): CachedTurn | undefined {
    const map = this.entries[key.flow];
    const entry = map.get(key.key);
    if (entry === undefined) {
      this.misses += 1;
      return undefined;
    }
    // LRU: 参照したものを最新へ(削除→再挿入で Map の末尾=MRU にする)
    map.delete(key.key);
    map.set(key.key, entry);
    this.hits += 1;
    return entry;
  }

  /** 検証済み表示専用ターンを格納する。上限超過で最も古い(LRU)要素を落とす(stores++)。 */
  public set(key: CacheKey, entry: CachedTurn): void {
    const map = this.entries[key.flow];
    if (map.has(key.key)) map.delete(key.key);
    map.set(key.key, entry);
    while (map.size > this.maxPerFlow) {
      const oldest = map.keys().next().value;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
    this.stores += 1;
  }

  /** 現在の格納件数(テスト・監視用) */
  public size(flow: CacheableFlow): number {
    return this.entries[flow].size;
  }

  /** 観測カウンタのスナップショット(デバッグ用) */
  public stats(): TurnCacheStats {
    return { hits: this.hits, misses: this.misses, stores: this.stores };
  }
}
