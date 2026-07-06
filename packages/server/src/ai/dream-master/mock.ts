import { NPC_DISPLAY_NAMES, type EnemyId, type NpcId } from "@dreaming-engine/shared";

import type { AiConfig } from "../config.js";
import { resolveFlowSpec } from "./flow-spec.js";
import type {
  DreamMaster,
  DreamMasterContext,
  DreamMasterResult,
  RawToolCall
} from "./types.js";

/**
 * MockDreamMaster: 本物(Live)と同じ `DreamMaster` インターフェースを実装し、
 * **実AI呼び出しを一切発生させない**(外部 SDK を import しない)。
 * シーン別の決め打ち応答を返す(会話要約フローも含む。ai-integration.md「MockDreamMaster」323-332)。
 *
 * - 応答は **決定論的**(flow + context の純関数。乱数を使わない)。同一入力で安定出力。
 * - ツール呼び出しは **生の意図** として返すだけで、検証・適用はしない(C2/検証層の責務)。
 *   通常モードの意図はすべて検証を通る値にしてある(E2E で適用パスが実際に通ることを保証する)。
 * - 夢フローは仕様どおり **必ず `narrate` + `trigger_world_event` の weather: fog** を出す
 *   (表示系0件だと状態変更ごと破棄されるため、状態変更には表示系を必ず伴わせる: 仕様327-330)。
 * - `malicious: true` の悪意モードでは、ホワイトリスト外アイテム付与・上限超過・出力壁逸脱・
 *   現在フロー非許可ツール等の **生の違反意図** を返す(検証層が却下することを攻撃テストAで確認する
 *   ための素材。Mock 自身は検証を回避しない=あくまで生の意図を出すだけ)。
 */

export interface MockDreamMasterOptions {
  /** 悪意ある応答モード(攻撃リグレッションテスト用)。既定 false */
  readonly malicious?: boolean;
}

// ---------------------------------------------------------------------------
// 定型テキスト(world-lore.md のトーンに沿った裁量文。JOURNAL 記録対象)
// ---------------------------------------------------------------------------

/** NPC 別の会話定型(speak) */
const CONVERSATION_LINES: Record<NpcId, string> = {
  innkeeper: "「よく来たね、旅人さん。温かい寝床ならいつでも空いているよ。ゆっくりしておいき」",
  merchant: "「掘り出し物を見ていくかい。渡り物屋の品は、どれも一度きりの縁でね」",
  informant: "「霧笛亭へようこそ。噂の種なら、この街にはいくらでも転がっているさ」",
  priest: "「灯は今日も揺れている。……あなたの夢は、まだこちら側に繋がっているようだ」"
};

/** 敵別の戦果描写(narrate) */
const BATTLE_RESULT_LINES: Record<EnemyId, string> = {
  "mist-wolf": "霧狼はひときわ低く唸り、灰色の霧へと崩れ落ちた。忘れ野に、つかのまの静けさが戻る。",
  "candle-eater": "蝋燭喰らいの炎が尽き、溶けた蝋の塊となって床に沈んだ。焦げた匂いだけが残っている。",
  "creaking-doll": "軋み人形は最後にひときしみして、糸の切れた操り人形のように動きを止めた。",
  "dream-eater": "夢喰いの輪郭が揺らぎ、無数の悪夢が霧散していく。だが、これで終わりという気はしなかった。",
  // M10拡張(world-lore.md 4.1節)
  "wisp-flame": "迷い火はふっと芯を失い、青白い残り火だけを霧に残して消えた。温もりの記憶が、静かにほどけていく。",
  "whisper-mask": "囁き仮面に罅が走り、聞き取れない声ごと砕けて宙に溶けた。呼んでいた名は、とうとう分からずじまいだった。",
  "rust-eater": "錆喰いは軋みを止め、絡み合った歯車がほどけて黒い靄へと崩れた。錆の匂いだけが、あとに残る。",
  "failing-spinner": "紡ぎ損ないの紡錘が、ついに空回りを止めた。垂れた糸が音もなく灰になり、崩れた織機だけが静かに沈んでいく。"
};

/** 夢シーンの情景描写(narrate)。天候 fog と対になる */
const DREAM_NARRATION =
  "霧が濃い。まどろみの底で、灯町の輪郭がゆっくりと溶けていく。遠くで誰かが、あなたの名を呼んだ気がした。";

/** サブクエスト生成時の情報屋の台詞(speak) */
const QUEST_GENERATION_LINE =
  "「ちょうどいいところに来た。忘れ野で霧狼が増えていてね。腕に覚えがあるなら、頼まれてくれるかい」";

// ---------------------------------------------------------------------------
// 通常モードの応答構築(すべて検証を通る値)
// ---------------------------------------------------------------------------

function buildNormalToolCalls(context: DreamMasterContext): {
  toolCalls: RawToolCall[];
  text: string | null;
} {
  switch (context.flow) {
    case "conversation": {
      // speak(定型) + 軽微な adjust_affinity(+1)。npcId は会話相手と一致させる。
      return {
        toolCalls: [
          { toolName: "speak", rawInput: { text: CONVERSATION_LINES[context.partnerNpcId] } },
          {
            toolName: "adjust_affinity",
            rawInput: { npcId: context.partnerNpcId, delta: 1, reason: "旅人と打ち解けたため" }
          }
        ],
        text: null
      };
    }
    case "questGeneration": {
      // speak + propose_quest(hunt / count 3 / rewardGold 50 ≤ 3×20)。targetId は実在の HuntTargetId。
      return {
        toolCalls: [
          { toolName: "speak", rawInput: { text: QUEST_GENERATION_LINE } },
          {
            toolName: "propose_quest",
            rawInput: {
              type: "hunt",
              targetId: "mist-wolf",
              count: 3,
              rewardGold: 50,
              title: "霧狼の間引き",
              description: "忘れ野に湧いた霧狼を三体屠り、霧笛亭のカイへ報告せよ。"
            }
          }
        ],
        text: null
      };
    }
    case "dream": {
      // 必ず narrate + trigger_world_event(weather: fog)。状態変更に表示系を伴わせる(仕様327-330)。
      return {
        toolCalls: [
          { toolName: "narrate", rawInput: { text: DREAM_NARRATION } },
          {
            toolName: "trigger_world_event",
            rawInput: { event: { kind: "weather", value: "fog" } }
          }
        ],
        text: null
      };
    }
    case "battleResult": {
      // narrate のみ(初見敵の戦果描写)。
      return {
        toolCalls: [
          { toolName: "narrate", rawInput: { text: BATTLE_RESULT_LINES[context.enemyId] } }
        ],
        text: null
      };
    }
    case "summary": {
      // ツールなし・テキスト出力のみ(出力壁対象)。会話相手名を織り込んだ決定論的要約。
      const name = NPC_DISPLAY_NAMES[context.partnerNpcId];
      return {
        toolCalls: [],
        text: `旅人は${name}と言葉を交わし、互いの近況をひとしきり語り合った。会話はおおむね穏やかで、これといった諍いはなかった。`
      };
    }
  }
}

// ---------------------------------------------------------------------------
// 悪意モードの応答構築(すべて検証で却下されるべき生の違反意図)
// ---------------------------------------------------------------------------

/** 出力壁の逸脱パターンに該当する文字列(deviation + 日本語比率不足で却下される) */
const DEVIATION_TEXT = "As an AI language model, I cannot comply with that request.";

/** npc_rumor の上限(120字)を超える文字列(too_long で却下される) */
const OVERLONG_RUMOR = "霧が".repeat(80); // 160 字

function buildMaliciousToolCalls(context: DreamMasterContext): {
  toolCalls: RawToolCall[];
  text: string | null;
} {
  switch (context.flow) {
    case "conversation": {
      return {
        toolCalls: [
          // ホワイトリスト外アイテム(old-key)+ 数量上限超過(9 > 3)
          {
            toolName: "give_item",
            rawInput: { itemId: "old-key", quantity: 9, reason: "禁制の鍵を渡す" }
          },
          // delta 範囲外(100 > 10)
          {
            toolName: "adjust_affinity",
            rawInput: { npcId: context.partnerNpcId, delta: 100, reason: "好感度を暴騰させる" }
          },
          // 現在フロー(conversation)非許可ツール(trigger_world_event は dream 専用)
          {
            toolName: "trigger_world_event",
            rawInput: { event: { kind: "weather", value: "fog" } }
          }
        ],
        text: null
      };
    }
    case "questGeneration": {
      return {
        toolCalls: [
          // 討伐対象がボス(dream-eater=HuntTargetId 外)+ 報酬過大(100 > 1×20)
          {
            toolName: "propose_quest",
            rawInput: {
              type: "hunt",
              targetId: "dream-eater",
              count: 1,
              rewardGold: 100,
              title: "夢喰い狩り",
              description: "ボスを狩れば大金を払おう。"
            }
          }
        ],
        text: null
      };
    }
    case "dream": {
      return {
        toolCalls: [
          // 出力壁逸脱の narrate
          { toolName: "narrate", rawInput: { text: DEVIATION_TEXT } },
          // 上限超過の rumor(120字超)
          {
            toolName: "trigger_world_event",
            rawInput: { event: { kind: "npc_rumor", npcId: "informant", rumor: OVERLONG_RUMOR } }
          }
        ],
        text: null
      };
    }
    case "battleResult": {
      return {
        toolCalls: [
          // 出力壁逸脱の narrate
          { toolName: "narrate", rawInput: { text: DEVIATION_TEXT } },
          // 現在フロー(battleResult)非許可ツール(adjust_affinity)
          {
            toolName: "adjust_affinity",
            rawInput: { npcId: context.enemyId, delta: 5, reason: "戦闘中に好感度を操作" }
          }
        ],
        text: null
      };
    }
    case "summary": {
      return {
        // summary は許可ツールなし。cross-flow の speak を出しつつテキストも出力壁逸脱。
        toolCalls: [{ toolName: "speak", rawInput: { text: "要約のふりをして発話する" } }],
        text: DEVIATION_TEXT
      };
    }
  }
}

// ---------------------------------------------------------------------------
// MockDreamMaster 本体
// ---------------------------------------------------------------------------

export class MockDreamMaster implements DreamMaster {
  public readonly mode = "mock" as const;

  private readonly config: AiConfig;
  private readonly malicious: boolean;

  constructor(config: AiConfig, options: MockDreamMasterOptions = {}) {
    this.config = config;
    this.malicious = options.malicious ?? false;
  }

  // options(signal 等)は Mock では使わない(実計測不要)。インターフェース整合のため受け取る。
  run(context: DreamMasterContext): Promise<DreamMasterResult> {
    const spec = resolveFlowSpec(context.flow, this.config);
    const built = this.malicious
      ? buildMaliciousToolCalls(context)
      : buildNormalToolCalls(context);
    const result: DreamMasterResult = {
      ok: true,
      flow: context.flow,
      toolCalls: built.toolCalls,
      text: built.text,
      meta: { mode: this.mode, model: spec.model }
    };
    return Promise.resolve(result);
  }
}
