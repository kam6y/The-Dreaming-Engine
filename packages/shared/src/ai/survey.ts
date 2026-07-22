import { z } from "zod";

/**
 * survey 型サブクエスト(`propose_quest`。M19)の調査対象ホワイトリスト。
 * **既存マップの調べオブジェクト(`sign` 種)**の部分集合。
 * 調べが無害・再実行可能な `sign` に限る(ai-integration.md「5b」)。
 *
 * **除外**: `d4-conduit`(第2章開始トリガー)、`chest`(一度きり開封)・`gather`(採取=アイテム源)。
 * 各 ID が実在オブジェクトID(kind=sign)であること・`d4-conduit` を含まないことをユニットテストで担保する。
 */
export const SURVEY_TARGET_IDS = [
  "field-sign-post",
  "d1-sign",
  "town-sign-tavern",
  "settlement-sign-mine"
] as const;

export const surveyTargetIdSchema = z.enum(SURVEY_TARGET_IDS);
export type SurveyTargetId = z.infer<typeof surveyTargetIdSchema>;

/** 調査対象IDの表示名(クエストジャーナルの現況表示に使う。語彙は裁量: JOURNAL 記録) */
export const SURVEY_TARGET_NAMES: Record<SurveyTargetId, string> = {
  "field-sign-post": "忘れ野の道標",
  "d1-sign": "裂け目一層の刻印",
  "town-sign-tavern": "霧笛亭の看板",
  "settlement-sign-mine": "坑口の看板"
};

/** survey の調査対象として有効か(ホワイトリスト内か) */
export function isSurveyTarget(id: string): id is SurveyTargetId {
  return surveyTargetIdSchema.safeParse(id).success;
}
