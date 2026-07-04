import { addItem, type GameState, type NpcStates } from "@dreaming-engine/shared";

import type { StateChangeEffect } from "../ai/flow-control/turn-executor.js";
import type { DreamEventsEffect } from "../ai/tool-validation/types.js";

/**
 * 承認済み状態変更 effect(検証・フロー制御が返す `StateChangeEffect`)を GameState へ
 * 決定論的に適用する純関数(M4-E の核心)。
 *
 * ⚠️ カウンタ書き戻しループの閉鎖(最重要):
 * フロー制御(turn-executor/gatekeeper)は effect を**返すだけで GameState を変更しない**。
 * 検証層が読む永続カウンタ(`aiDaily.*`)は、この適用層が increment しない限り永久に 0 のままとなり、
 * ゲーム内1日◯回系の上限が実質無効化される。したがって effect 適用時に対応する `aiDaily` カウンタを
 * 必ず増やす(give_item→giveItemCount / adjust_affinity→affinityDeltaByNpc /
 * propose_quest→proposeQuestCount(+rewardItemProposalCount))。
 *
 * この関数は I/O・時刻・乱数を持たない。会話内カウンタ(揮発)は turn-executor が承認時に閉じるため
 * ここでは扱わない(永続=GameState 側のループのみを閉じる)。
 */
export function applyStateChangeEffect(state: GameState, effect: StateChangeEffect): GameState {
  switch (effect.kind) {
    case "adjust_affinity": {
      const npcId = effect.npcId;
      // 好感度は検証層が算出した適用後クランプ値(0..100)をそのまま採用する
      const npcs: NpcStates = { ...state.npcs };
      npcs[npcId] = { ...npcs[npcId], affinity: effect.affinity };
      const affinityDeltaByNpc = { ...state.aiDaily.affinityDeltaByNpc };
      affinityDeltaByNpc[npcId] = affinityDeltaByNpc[npcId] + effect.delta;
      return {
        ...state,
        npcs,
        aiDaily: { ...state.aiDaily, affinityDeltaByNpc }
      };
    }
    case "give_item": {
      // 贈答はインベントリへ加算(検証層が空き枠を保証済み)。日次承認回数を +1(全 NPC 合算)
      return {
        ...state,
        inventory: addItem(state.inventory, effect.itemId, effect.quantity).inventory,
        aiDaily: { ...state.aiDaily, giveItemCount: state.aiDaily.giveItemCount + 1 }
      };
    }
    case "propose_quest": {
      // 提案の生成(受諾ではない): サブクエストは追加しない(未受諾提案は会話セッションが保持)。
      // 日次の発行数カウンタのみを閉じる。rewardItemId 付きは専用カウンタも +1。
      const hasReward = effect.quest.rewardItemId !== undefined;
      return {
        ...state,
        aiDaily: {
          ...state.aiDaily,
          proposeQuestCount: state.aiDaily.proposeQuestCount + 1,
          rewardItemProposalCount: state.aiDaily.rewardItemProposalCount + (hasReward ? 1 : 0)
        }
      };
    }
    case "dream_world_events":
      return applyDreamEvents(state, effect);
  }
}

/**
 * 夢シーンの世界変化(`validateDreamEvents` の解決済み結果)を world/npcs へ反映する。
 * - weather      : 後勝ち(events に最後の1件のみ含まれる)
 * - street_event : 当日有効集合へ追加(同一 id は重複しない)
 * - npc_rumor    : 対象 NPC の「今日の話題」を置換
 * - dungeon_shift : effect.dungeonSymbolCounts(累積適用後の絶対値)を採用する
 *   (events には含まれないため、ここでは各層カウントを丸ごと差し替える)
 */
function applyDreamEvents(state: GameState, effect: DreamEventsEffect): GameState {
  let weather = state.world.weather;
  const streetSet = new Set(state.world.activeStreetEvents);
  const npcs: NpcStates = { ...state.npcs };

  for (const ev of effect.events) {
    switch (ev.kind) {
      case "weather":
        weather = ev.value;
        break;
      case "street_event":
        streetSet.add(ev.eventId);
        break;
      case "npc_rumor":
        npcs[ev.npcId] = { ...npcs[ev.npcId], topic: ev.rumor };
        break;
      case "dungeon_shift":
        // dungeon_shift は effect.dungeonSymbolCounts に反映済み(events には現れない)
        break;
    }
  }

  return {
    ...state,
    npcs,
    world: {
      weather,
      activeStreetEvents: [...streetSet],
      dungeonSymbolCounts: effect.dungeonSymbolCounts
    }
  };
}
