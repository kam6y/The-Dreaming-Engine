import type { NpcId, SubQuest } from "@dreaming-engine/shared";

import type { ConversationSessionContext } from "../tool-validation/types.js";

/**
 * 会話セッション(揮発。ai-integration.md「会話セッション管理」100-140 / 「give_item」177)。
 *
 * 1会話の境界に沿った**ランタイム状態**を保持する(GameState=セーブには載せない):
 * - `affinityAtOpen`: 会話開始時点のNPC好感度スナップショット。give_item 解禁判定はこの値のみを読む。
 *   会話内の adjust_affinity による好感度上昇では変えない(解禁されない)。
 * - `adjustAffinityCount` / `giveItemCount`: 会話内の承認回数(1会話あたりの上限判定に使う。
 *   会話終了でリセット=セッション破棄)。
 * - `pendingProposal`: 未受諾提案(同時1件)。未受諾のまま会話終了で破棄。
 *
 * tool-validation の `ConversationSessionContext` をこのセッションから組み立てて検証器へ渡す
 * (本クラスは検証器を import しない。契約に沿った値を供給するのみ)。
 * カウンタの増加は AIターン実行器が承認済み effect に基づいて行う(このクラスは記録メソッドを提供)。
 */
export class ConversationSession {
  /** 会話相手(adjust_affinity の npcId 一致・speak の口調・要約対象) */
  public readonly partnerNpcId: NpcId;
  /** 会話開始時点の好感度スナップショット(give_item 解禁判定の唯一の根拠) */
  public readonly affinityAtOpen: number;

  private adjustAffinityCount = 0;
  private giveItemCount = 0;
  private pendingProposal: SubQuest | null = null;

  public constructor(partnerNpcId: NpcId, affinityAtOpen: number) {
    this.partnerNpcId = partnerNpcId;
    this.affinityAtOpen = affinityAtOpen;
  }

  /** tool-validation 用の揮発コンテキストを組み立てる(現在のカウンタ・提案を反映) */
  public toContext(): ConversationSessionContext {
    return {
      partnerNpcId: this.partnerNpcId,
      affinityAtOpen: this.affinityAtOpen,
      adjustAffinityCount: this.adjustAffinityCount,
      giveItemCount: this.giveItemCount,
      pendingProposal: this.pendingProposal
    };
  }

  public getAdjustAffinityCount(): number {
    return this.adjustAffinityCount;
  }

  public getGiveItemCount(): number {
    return this.giveItemCount;
  }

  public getPendingProposal(): SubQuest | null {
    return this.pendingProposal;
  }

  /** adjust_affinity が1件承認された(会話内カウンタ +1) */
  public recordAdjustAffinity(): void {
    this.adjustAffinityCount += 1;
  }

  /** give_item が1件承認された(会話内カウンタ +1) */
  public recordGiveItem(): void {
    this.giveItemCount += 1;
  }

  /** propose_quest が1件承認された(未受諾提案スロットを埋める。同時1件) */
  public setPendingProposal(quest: SubQuest): void {
    this.pendingProposal = quest;
  }

  /** 未受諾提案を破棄する(辞退・会話終了時) */
  public clearPendingProposal(): void {
    this.pendingProposal = null;
  }
}
