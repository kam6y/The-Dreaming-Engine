import { z } from "zod";

/**
 * 街頭演出(`trigger_world_event` の `street_event`)。夢シーンの翌朝、灯町の街角に
 * 起こる小さな出来事。定義済みの ID からのみ選べる(AI に自由記述させない)。
 *
 * 表示テキストは world-lore.md のトーン(暗く・物哀しく・しかしどこか優しい)に合わせた
 * 裁量文。行商人・鐘の音は同書に既出の題材。固有名詞(人物名・地名)は新設しない
 * (演出の細部=裁量。JOURNAL 記録対象)。
 *
 * 表示は第4層(出力の壁)の対象外(AI 生成テキストではなく定義済み定数)だが、
 * クライアントでは他のテキスト同様プレーンテキストとして描画する(guardrails 第4層)。
 */

export interface StreetEventDefinition {
  id: StreetEventId;
  /** ログ・デバッグ用の短い名称 */
  name: string;
  /** 翌朝の街頭に表示する情景テキスト */
  text: string;
}

export const STREET_EVENT_IDS = [
  "peddler",
  "black-cat",
  "distant-bell",
  "lamplighter"
] as const;

export const streetEventIdSchema = z.enum(STREET_EVENT_IDS);
export type StreetEventId = z.infer<typeof streetEventIdSchema>;

/** 街頭演出の定義表(ID → 定義) */
export const STREET_EVENTS: Record<StreetEventId, StreetEventDefinition> = {
  peddler: {
    id: "peddler",
    name: "流れの行商人",
    text: "渡り物屋の軒先に、見慣れぬ行商人が荷を広げている。どこから来たとも知れぬ品が、朝霧の中で鈍く光っていた。"
  },
  "black-cat": {
    id: "black-cat",
    name: "辻の黒猫",
    text: "石畳の辻に、片目の黒猫がうずくまっている。旅人と目が合うと、何も言わずに霧の奥へ溶けていった。"
  },
  "distant-bell": {
    id: "distant-bell",
    name: "遠い鐘の音",
    text: "どこか遠くで、鐘が一度だけ鳴った。誰かを呼ぶような、それでいて誰も来ないとわかっている音だった。"
  },
  lamplighter: {
    id: "lamplighter",
    name: "灯点しの影",
    text: "宵の名残の薄闇に、誰かが街灯へ灯を入れて回っている。顔は見えないが、その手つきはひどく優しかった。"
  }
};

/** 定義済みの街頭演出か */
export function isStreetEvent(id: string): id is StreetEventId {
  return streetEventIdSchema.safeParse(id).success;
}
