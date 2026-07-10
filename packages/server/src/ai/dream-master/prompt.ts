import {
  affinityTier,
  affinityTierDefinition,
  DEFAULT_NPC_TOPICS,
  ENEMY_DISPLAY_NAMES,
  FETCH_TARGET_IDS,
  HUNT_TARGET_IDS,
  ITEMS,
  NPC_DISPLAY_NAMES,
  STREET_EVENTS,
  SUMMARY_MAX_LENGTH,
  type AffinityTier,
  type ConversationExchange,
  type NpcId,
  type SubQuest,
  type WorldState
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
    "教会「灯守堂」の司祭フィオル。痩せて背の高い年齢不詳の人物。一人称「私」、穏やかで古風(「〜でしょう」「〜なのです」)。静かで、どこか疲れを滲ませる。",
  // 第2エリア「琥珀郷」の3人(M16。world-lore.md 3.6〜3.8。秘密は帯ごとの態度指示で段階的に開かせる=
  // 人格一行には書かない。既存4人と同じ形式=外見・一人称・口調・性格・口癖)
  caretaker:
    "琥珀郷の世話役イルマ。「寄り屋」で旅人を泊める小柄で痩せた老婆。一人称「わたし」、静かで柔らかい口調(「〜ですよ」「〜でしょうねえ」)。言葉少なだが来る者を拒まない。口癖は「火のそばへ。話はそれからですよ」。",
  artisan:
    "「琥珀工房」の主ガロ。岩のような体つきの中年男。一人称「おれ」、短くぶっきらぼう(「〜だ」「〜さな」)。無骨で口が重いが、仕事と客には誠実。口癖は「琥珀は嘘をつかん。人よりよほどな」。",
  warden:
    "封じられた坑口の番人にして琥珀郷の語り部トワ。年齢の読めない小柄な人物。一人称は自分の名「トワ」、唄うように話し問いにまっすぐ答えない語尾(「〜とさ」「〜だってさ」)。口癖は「唄は忘れても、続きのほうが覚えてるとさ」。"
};

/**
 * 好感度の段階別「態度指示」(会話プロンプトの <npc_state> に添える固定定数)。
 * game-design.md「好感度の段階(拡張: M11)」(a)項の態度指示 / ai-integration.md「会話セッション管理」。
 * 文面は世界観(青灰と琥珀・灯・夢)のトーンに寄せた裁量文で、各NPCの人物設定と矛盾しない
 * 一般形にしてある(人物設定が態度より優先である旨は AFFINITY_ATTITUDE_PERSONA_NOTE で添える)。
 *
 * これらはサーバー管理の固定定数(段階名も AFFINITY_TIERS 由来の固定文字列)であり、
 * NPC_PERSONA・NPC_DISPLAY_NAMES と同じ信頼クラスに属する。したがって neutralizeTags は
 * 通さない(無害化対象は話題・記憶・発話など「出所が可変のテキスト」のみ:guardrails 第3層の流儀)。
 */
export const AFFINITY_ATTITUDE_INSTRUCTIONS: Record<AffinityTier, string> = {
  wary: "態度: 旅人をまだ信じていない。応えは短く、素っ気なく。個人的な打ち明け話や踏み込んだ頼みは、灯を翳すようにやんわり受け流す。",
  distant:
    "態度: 礼は尽くすが、心の距離は保つ。自分から深い事情や内緒話は明かさず、当たり障りなく応じる。",
  friendly:
    "態度: 旅人に気を許しはじめている。口調はいくらか和らぎ、自分の事情や街の噂を、頼まれずとも少しだけ零す。",
  trusted: "態度: 旅人を信じ、心を開いている。本音まで率直に語り、その力になろうと自ら手を差し伸べる。"
};

/** 態度指示は人物設定の枠内で表す(人物設定が態度より優先)旨の一文(段階に依らず添える) */
export const AFFINITY_ATTITUDE_PERSONA_NOTE =
  "ただし上の人物像が最優先であり、態度はその人柄の口調・性根の枠内で滲ませること。";

/**
 * <npc_state> に添える好感度ブロック(好感度の数値 + 段階名 + 段階別態度指示 + 人物設定優先の注記)。
 * 好感度は数値、段階名・態度指示は固定定数のため、いずれも neutralizeTags 不要(上記の流儀)。
 */
function formatAffinityBlock(affinity: number): string {
  const tier = affinityTier(affinity);
  const label = affinityTierDefinition(tier).label;
  return (
    `好感度: ${affinity}(0-100)/ 段階: ${label}\n` +
    `${AFFINITY_ATTITUDE_INSTRUCTIONS[tier]}\n` +
    AFFINITY_ATTITUDE_PERSONA_NOTE
  );
}

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

/** 受注中サブクエストの一覧(<quest_journal>。文脈提示・重複依頼の回避に使う) */
function formatSubQuests(quests: readonly SubQuest[]): string {
  const lines = quests.map((q) => {
    const target = q.type === "hunt" ? ENEMY_DISPLAY_NAMES[q.targetId] : ITEMS[q.targetId].name;
    return `・[${q.type}] ${neutralizeTags(q.title)}(対象:${target} ${q.progress}/${q.count} 状態:${q.status})`;
  });
  return lines.join("\n");
}

/** 現在の世界状態(<world_state>。翌朝の変化を決める基準として提示) */
function formatWorldState(world: WorldState): string {
  const streets =
    world.activeStreetEvents.length > 0
      ? world.activeStreetEvents.map((id) => STREET_EVENTS[id].name).join("、")
      : "なし";
  const dungeon = `1層${world.dungeonSymbolCounts[1]}・2層${world.dungeonSymbolCounts[2]}・3層${world.dungeonSymbolCounts[3]}`;
  return `天候: ${world.weather}\n当日の街頭演出: ${streets}\nダンジョン各層の敵勢力: ${dungeon}`;
}

/** DreamMasterContext からユーザーメッセージ本文を組み立てる */
function buildUserPrompt(context: DreamMasterContext): string {
  switch (context.flow) {
    case "conversation": {
      const name = NPC_DISPLAY_NAMES[context.partnerNpcId];
      const topic = context.topic ?? DEFAULT_NPC_TOPICS[context.partnerNpcId];
      const affinityBlock =
        context.affinity !== undefined ? `\n${formatAffinityBlock(context.affinity)}` : "";
      const parts = [
        tag(
          "npc_state",
          `あなたは今、${name}として旅人と向き合っている。\n人物: ${NPC_PERSONA[context.partnerNpcId]}\n今日の話題: ${neutralizeTags(topic)}${affinityBlock}`
        )
      ];
      if (context.memorySummary !== undefined && context.memorySummary.trim().length > 0) {
        parts.push(tag("memory", neutralizeTags(context.memorySummary)));
      }
      if (context.activeSubQuests !== undefined && context.activeSubQuests.length > 0) {
        parts.push(tag("quest_journal", formatSubQuests(context.activeSubQuests)));
      }
      parts.push(
        tag("player_utterance", neutralizeTags(context.playerUtterance)),
        tag(
          "task",
          `${name}として、旅人の声に応えなさい。応答は必ず speak ツールの呼び出しで行うこと。` +
            `ツールを使わない地の文・思考・前置きの文章は旅人には一切表示されず破棄される。` +
            `「Tool loaded.」のようなシステム通知には応答しないこと。` +
            `旅人がまだ何も言っていない(声が空)なら、こちらから会話開始の挨拶を speak で述べること。`
        )
      );
      return parts.join("\n");
    }
    case "questGeneration": {
      const name = NPC_DISPLAY_NAMES[context.partnerNpcId];
      const topicLine =
        context.topic !== undefined ? `\n今日の話題: ${neutralizeTags(context.topic)}` : "";
      const parts = [
        tag(
          "npc_state",
          `あなたは情報屋 ${name} として霧笛亭にいる。\n人物: ${NPC_PERSONA[context.partnerNpcId]}${topicLine}`
        ),
        tag("quest_targets", formatQuestTargets())
      ];
      if (context.activeSubQuests !== undefined && context.activeSubQuests.length > 0) {
        parts.push(tag("quest_journal", formatSubQuests(context.activeSubQuests)));
      }
      parts.push(
        tag(
          "task",
          "情報屋として語りつつ、依頼を1件だけ propose_quest で提案しなさい。対象は上の候補に限り、受注中の依頼と重複させないこと。" +
            "語りは必ず speak ツールで行い、依頼は propose_quest ツールで渡すこと。" +
            "ツールを使わない地の文・思考の文章は旅人には表示されず破棄される。"
        )
      );
      return parts.join("\n");
    }
    case "dream": {
      const parts = [tag("recent_play", neutralizeTags(context.recentPlay))];
      if (context.world !== undefined) {
        parts.push(tag("world_state", formatWorldState(context.world)));
      }
      if (context.activeSubQuests !== undefined && context.activeSubQuests.length > 0) {
        parts.push(tag("quest_journal", formatSubQuests(context.activeSubQuests)));
      }
      parts.push(
        tag(
          "task",
          "旅人が見る夢を90-200字で narrate し、翌朝の世界の変化を trigger_world_event で最大3件まで起こしなさい。変化は上のプレイ内容を反映させること。" +
            "夢の描写は必ず narrate ツールで行うこと。ツールを使わない地の文・思考の文章は旅人には表示されず破棄される。"
        )
      );
      return parts.join("\n");
    }
    case "battleResult": {
      return [
        tag("battle", `倒した相手: ${ENEMY_DISPLAY_NAMES[context.enemyId]}`),
        tag(
          "task",
          "直前の戦闘の結末を60-150字で narrate しなさい。描写は必ず narrate ツールで行うこと。" +
            "ツールを使わない地の文・思考の文章は旅人には表示されず破棄される。状態変更ツールは使わないこと。"
        )
      ].join("\n");
    }
    case "summary": {
      const name = NPC_DISPLAY_NAMES[context.partnerNpcId];
      const hasExisting = context.existingSummary.trim().length > 0;
      const existing = hasExisting ? neutralizeTags(context.existingSummary) : "(まだ要約はない)";
      // 既存要約がある場合のみ「古い情報の圧縮を優先し、新しい約束を落とさない」指示を足す。
      const compressionNote = hasExisting
        ? "既存の要約にある古い出来事は思い切って圧縮してよいが、今回新たに生まれた約束・依頼・貸し借りは必ず残すこと。"
        : "";
      return [
        tag("npc_state", `会話相手: ${name}`),
        tag("memory", existing),
        tag("conversation", formatConversation(context.exchanges, name)),
        tag(
          "task",
          `${name}が次に旅人と会ったとき、この会話を自然に思い出せるよう、二人の記憶を${SUMMARY_MAX_LENGTH}字以内の日本語で要約しなさい。` +
            "次の優先順で拾うこと:(1)交わした事実——約束・依頼・貸し借り、(2)旅人の呼び名や口調の癖、(3)この会話でNPCが抱いた感情の変化。" +
            "日時・金額・品名などの具体は残し、挨拶や社交辞令は省く。" +
            compressionNote +
            `要約は常に1件のテキストとして出力し、過去の要約に継ぎ足さず既存の要約を置き換えること(連結しない)。${SUMMARY_MAX_LENGTH}字以内に収め、ツールは使わないこと。`
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
