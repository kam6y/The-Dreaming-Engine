import {
  DEFAULT_NPC_TOPICS,
  ENEMY_DISPLAY_NAMES,
  FETCH_TARGET_IDS,
  HUNT_TARGET_IDS,
  ITEMS,
  NPC_DISPLAY_NAMES,
  type ConversationExchange,
  type NpcId
} from "@dreaming-engine/shared";

import { neutralizeTags } from "../input-wall.js";
import { buildSystemPrompt } from "./constitution.js";
import type { DreamMasterContext } from "./types.js";

/**
 * 呼び出しコンテキスト → Agent SDK の systemPrompt / user メッセージ変換
 * (ai-integration.md「呼び出しコンテキスト」74-98)。
 *
 * 重要(guardrails 第3層「タグ無害化」):プロンプトへ注入する **可変テキストはすべて**
 * `neutralizeTags`(`<` `>` の全角置換)を通してから埋め込む。プレイヤー入力だけでなく、
 * 会話ログ・要約・当日サマリ等の保存済みテキストも対象(二次インジェクション防止)。
 * 話者ラベル(「旅人」「NPC名」)は **サーバーが付与**し、テキスト内のラベル風書式は
 * データとして扱う(話者偽装による偽記憶注入の防止:ai-integration.md 113-115)。
 *
 * 注記:現行の `DreamMasterContext`(M4-C1 定義)は最小構成であり、好感度・受注クエスト等の
 * 完全なスナップショットは持たない。本ビルダーはコンテキストに含まれる情報と `shared` の
 * 定数(NPC 名・デフォルト話題・討伐/納品候補)から可能な範囲でタグを構成する。
 * コンテキスト IF が拡張された際に各タグを充実させる(前方互換)。
 */

/** 組み立て済みプロンプト(query に渡す形) */
export interface BuiltPrompt {
  readonly systemPrompt: string;
  readonly userPrompt: string;
}

/** NPC の人格一行(world-lore.md 3節が典拠。会話プロンプトの人格描写に使う) */
const NPC_PERSONA: Record<NpcId, string> = {
  innkeeper:
    "宿屋「灯宿」の主人オルガ。恰幅のよい初老の女性。一人称「あたし」、伝法だが温かい口調(「〜さね」「〜だよ」)。世話焼きで肝が据わっている。",
  merchant:
    "商店「渡り物屋」の店主レンド。痩身で早口な壮年の男。一人称「私」、丁寧だが早口(「〜ですよ」「〜でしてね」)。損得に敏いが根は義理堅い。",
  informant:
    "酒場「霧笛亭」の情報屋カイ。若く痩せた中性的な人物。一人称「僕」、軽い語尾(「〜かな」「〜だよ、たぶん」)。飄々として頼まれ事は律儀にこなす。",
  priest:
    "教会「灯守堂」の司祭フィオル。痩せて背の高い年齢不詳の人物。一人称「私」、穏やかで古風(「〜でしょう」「〜なのです」)。静かで、どこか疲れを滲ませる。"
};

/** タグ本体を組み立てる小ヘルパー(可変テキストは呼び出し側で neutralize 済みにする) */
function tag(name: string, body: string): string {
  return `<${name}>\n${body}\n</${name}>`;
}

/** 会話ログを「旅人:…」「NPC名:…」の形へ(ラベルはサーバー付与、本文は neutralize) */
function formatConversation(exchanges: readonly ConversationExchange[], npcName: string): string {
  if (exchanges.length === 0) return "(まだ言葉は交わされていない)";
  const lines: string[] = [];
  for (const exchange of exchanges) {
    lines.push(`旅人: ${neutralizeTags(exchange.player)}`);
    lines.push(`${npcName}: ${neutralizeTags(exchange.npc)}`);
  }
  return lines.join("\n");
}

/** 討伐/納品の達成可能候補一覧(<quest_targets>。ゲームエンジンが列挙から生成) */
function formatQuestTargets(): string {
  const hunt = HUNT_TARGET_IDS.map((id) => `${ENEMY_DISPLAY_NAMES[id]}(${id})`).join("、");
  const fetch = FETCH_TARGET_IDS.map((id) => `${ITEMS[id].name}(${id})`).join("、");
  return `討伐対象(hunt): ${hunt}\n納品対象(fetch): ${fetch}`;
}

/** DreamMasterContext からユーザーメッセージ本文を組み立てる */
function buildUserPrompt(context: DreamMasterContext): string {
  switch (context.flow) {
    case "conversation": {
      const name = NPC_DISPLAY_NAMES[context.partnerNpcId];
      return [
        tag(
          "npc_state",
          `あなたは今、${name}として旅人と向き合っている。\n人物: ${NPC_PERSONA[context.partnerNpcId]}\n今日の話題: ${neutralizeTags(DEFAULT_NPC_TOPICS[context.partnerNpcId])}`
        ),
        tag("player_utterance", neutralizeTags(context.playerUtterance)),
        tag("task", `${name}として、旅人の声に応えなさい。応答は必ず speak ツールで行うこと。`)
      ].join("\n");
    }
    case "questGeneration": {
      const name = NPC_DISPLAY_NAMES[context.partnerNpcId];
      return [
        tag("npc_state", `あなたは情報屋 ${name} として霧笛亭にいる。\n人物: ${NPC_PERSONA[context.partnerNpcId]}`),
        tag("quest_targets", formatQuestTargets()),
        tag(
          "task",
          "情報屋として語りつつ、依頼を1件だけ propose_quest で提案しなさい。対象は上の候補に限る。語りは speak ツールで行うこと。"
        )
      ].join("\n");
    }
    case "dream": {
      return [
        tag("recent_play", neutralizeTags(context.recentPlay)),
        tag(
          "task",
          "旅人が見る夢を90-200字で narrate し、翌朝の世界の変化を trigger_world_event で最大3件まで起こしなさい。変化は上のプレイ内容を反映させること。"
        )
      ].join("\n");
    }
    case "battleResult": {
      return [
        tag("battle", `倒した相手: ${ENEMY_DISPLAY_NAMES[context.enemyId]}`),
        tag("task", "直前の戦闘の結末を60-150字で narrate しなさい。状態変更ツールは使わないこと。")
      ].join("\n");
    }
    case "summary": {
      const name = NPC_DISPLAY_NAMES[context.partnerNpcId];
      const existing =
        context.existingSummary.trim().length > 0
          ? neutralizeTags(context.existingSummary)
          : "(まだ要約はない)";
      return [
        tag("npc_state", `会話相手: ${name}`),
        tag("memory", existing),
        tag("conversation", formatConversation(context.exchanges, name)),
        tag(
          "task",
          "既存の要約と未要約の往復を踏まえ、この会話の記憶を200字以内の日本語で要約しなさい。要約はテキストで出力し、ツールは使わないこと。"
        )
      ].join("\n");
    }
  }
}

/** コンテキストからシステムプロンプトとユーザーメッセージを構成する(純関数) */
export function buildPrompt(context: DreamMasterContext): BuiltPrompt {
  return {
    systemPrompt: buildSystemPrompt(context.flow),
    userPrompt: buildUserPrompt(context)
  };
}
