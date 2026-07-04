import {
  clampDungeonSymbolCount,
  NPC_RUMOR_MAX_LENGTH,
  worldEventSchema,
  type DungeonSymbolCounts,
  type NpcId,
  type StreetEventId,
  type WorldEvent
} from "@dreaming-engine/shared";
import { z } from "zod";

import { checkDisplayText } from "../output-wall.js";
import {
  DREAM_EVENTS_MAX,
  type AppliedDungeonSymbolCount,
  type DreamEventsContext,
  type DreamEventsResult,
  type RejectedEvent,
  type SingleWorldEventEffect,
  type ValidationResult
} from "./types.js";

/**
 * trigger_world_event: 世界変化(夢シーン専用。ai-integration.md「trigger_world_event」)。
 *
 * 単一の {event} を検証する validateWorldEvent と、1回の夢シーンで最大3件のリストへ
 * 解決規則を適用する validateDreamEvents を提供する。
 *
 * 解決規則(ai-integration.md 213-216):
 * - weather        : 後勝ち(最後に承認された1件のみ有効)
 * - npc_rumor      : 同一NPCは後勝ち・別NPCは併存
 * - street_event   : 同一 eventId の2件目以降は却下・異なる id は併存
 * - dungeon_shift  : 承認順に累積適用(各層レンジへ絶対クランプ)
 */

/** 単一ツール入力 { event: WorldEvent } のスキーマ */
const singleWorldEventInputSchema = z.object({ event: worldEventSchema });

/** 対象層の現在値に delta を足してレンジへクランプした結果 */
function applyDungeonShift(
  counts: DungeonSymbolCounts,
  event: Extract<WorldEvent, { kind: "dungeon_shift" }>
): number {
  return clampDungeonSymbolCount(event.layer, counts[event.layer] + event.symbolCountDelta);
}

/**
 * スキーマ検証済みの単一イベントに本体検証を適用する。
 * npc_rumor は出力壁(120字)、dungeon_shift は累積適用起点に対するクランプ結果を返す。
 */
function checkEventBody(
  event: WorldEvent,
  counts: DungeonSymbolCounts
): ValidationResult<{ event: WorldEvent; dungeonSymbolCount: AppliedDungeonSymbolCount | null }> {
  if (event.kind === "npc_rumor") {
    const checked = checkDisplayText(event.rumor, { maxLength: NPC_RUMOR_MAX_LENGTH });
    if (!checked.ok) {
      return { ok: false, reason: `trigger_world_event: rumor 出力壁却下(${checked.reason})` };
    }
    return {
      ok: true,
      effect: { event: { ...event, rumor: checked.normalized }, dungeonSymbolCount: null }
    };
  }
  if (event.kind === "dungeon_shift") {
    const count = applyDungeonShift(counts, event);
    return { ok: true, effect: { event, dungeonSymbolCount: { layer: event.layer, count } } };
  }
  return { ok: true, effect: { event, dungeonSymbolCount: null } };
}

/** 単一の trigger_world_event 呼び出し({event})を検証する */
export function validateWorldEvent(
  rawInput: unknown,
  ctx: DreamEventsContext
): ValidationResult<SingleWorldEventEffect> {
  const parsed = singleWorldEventInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, reason: "trigger_world_event: 入力スキーマ検証に失敗" };
  const body = checkEventBody(parsed.data.event, ctx.dungeonSymbolCounts);
  if (!body.ok) return { ok: false, reason: body.reason };
  return {
    ok: true,
    effect: {
      kind: "world_event",
      event: body.effect.event,
      dungeonSymbolCount: body.effect.dungeonSymbolCount
    }
  };
}

/**
 * 1回の夢シーンのイベントリスト(最大3件)へ解決規則を適用する。
 * 常に effect(解決後の有効イベントと累積適用後のシンボル数)を返し、
 * 却下された要素は rejected に index つきで記録する(監査ログ用)。
 * 4件目以降は上限超過として却下する。
 */
export function validateDreamEvents(rawEvents: unknown, ctx: DreamEventsContext): DreamEventsResult {
  const rejected: RejectedEvent[] = [];
  const running: DungeonSymbolCounts = { ...ctx.dungeonSymbolCounts };

  if (!Array.isArray(rawEvents)) {
    rejected.push({ index: -1, reason: "trigger_world_event: events が配列でない" });
    return {
      effect: { kind: "dream_world_events", events: [], dungeonSymbolCounts: running },
      rejected
    };
  }

  // 解決状態(後勝ち・id別・累積)
  let weather: WorldEvent | null = null;
  const rumorByNpc = new Map<NpcId, WorldEvent>();
  const streetByEventId = new Map<StreetEventId, WorldEvent>();

  rawEvents.forEach((raw, index) => {
    if (index >= DREAM_EVENTS_MAX) {
      rejected.push({ index, reason: "trigger_world_event: 1回の夢シーンの上限(3件)超過" });
      return;
    }
    const parsed = worldEventSchema.safeParse(raw);
    if (!parsed.success) {
      rejected.push({ index, reason: "trigger_world_event: 入力スキーマ検証に失敗" });
      return;
    }
    const event = parsed.data;
    switch (event.kind) {
      case "weather":
        weather = event; // 後勝ち
        return;
      case "npc_rumor": {
        const checked = checkDisplayText(event.rumor, { maxLength: NPC_RUMOR_MAX_LENGTH });
        if (!checked.ok) {
          rejected.push({ index, reason: `trigger_world_event: rumor 出力壁却下(${checked.reason})` });
          return;
        }
        rumorByNpc.set(event.npcId, { ...event, rumor: checked.normalized }); // 同一NPCは後勝ち
        return;
      }
      case "street_event":
        if (streetByEventId.has(event.eventId)) {
          rejected.push({ index, reason: "trigger_world_event: 同一 street_event の重複(2件目以降却下)" });
          return;
        }
        streetByEventId.set(event.eventId, event);
        return;
      case "dungeon_shift":
        running[event.layer] = applyDungeonShift(running, event); // 承認順に累積適用
        return;
    }
  });

  const events: WorldEvent[] = [];
  if (weather !== null) events.push(weather);
  for (const rumor of rumorByNpc.values()) events.push(rumor);
  for (const street of streetByEventId.values()) events.push(street);

  return {
    effect: { kind: "dream_world_events", events, dungeonSymbolCounts: running },
    rejected
  };
}
