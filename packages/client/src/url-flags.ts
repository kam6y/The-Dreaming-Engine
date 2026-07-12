import { difficultySchema, timeOfDaySchema } from "@dreaming-engine/shared";
import type { ClientMessage } from "@dreaming-engine/shared";

type NewGameOptions = NonNullable<Extract<ClientMessage, { type: "new-game" }>["options"]>;
type ContinueOptions = NonNullable<Extract<ClientMessage, { type: "continue" }>["options"]>;

/**
 * E2E・デバッグ用のURLフラグを new-game のオプションへ変換する。
 * - ?seed=N: 敵シンボル/戦闘シードの固定(再現用)
 * - ?noSymbols=1: 敵シンボルの無効化(移動スモークの安定化用)
 * - ?startLevel=N: 開始レベルの加速(通しプレイ E2E 用。サーバーは mock 時のみ尊重)
 * - ?startGold=N: 開始ゴールドの加速(装備購入スモーク用。サーバーは mock 時のみ尊重)
 * - ?timeOfDay=day|night: 時間帯の固定ピン(M23。夜スモーク用。サーバーは mock 時のみ尊重)
 * - ?difficulty=easy|normal|hard: 難易度(M25)。加速チートと異なり正規のプレイヤー選択の
 *   別入口のため live でも尊重される。?skipIntro=1 と併用時は難易度選択ステップを飛ばして
 *   この値(未指定なら normal)で開始する(E2E の決定論再現用)
 * サーバー正本化後もフラグの入口はURLのまま維持する(既存E2Eとの互換)。
 */
export function newGameOptionsFromUrl(): NewGameOptions {
  const params = new URLSearchParams(window.location.search);
  const seedRaw = params.get("seed");
  const seed =
    seedRaw !== null && seedRaw !== "" && Number.isFinite(Number(seedRaw))
      ? Number(seedRaw)
      : undefined;
  const startLevelRaw = params.get("startLevel");
  const startLevel =
    startLevelRaw !== null && startLevelRaw !== "" && Number.isInteger(Number(startLevelRaw))
      ? Number(startLevelRaw)
      : undefined;
  const startGoldRaw = params.get("startGold");
  const startGold =
    startGoldRaw !== null && startGoldRaw !== "" && Number.isInteger(Number(startGoldRaw))
      ? Number(startGoldRaw)
      : undefined;
  const timeOfDayParsed = timeOfDaySchema.safeParse(params.get("timeOfDay"));
  const difficultyParsed = difficultySchema.safeParse(params.get("difficulty"));
  return {
    ...(seed !== undefined ? { seed } : {}),
    ...(params.has("noSymbols") ? { noSymbols: true } : {}),
    ...(startLevel !== undefined ? { startLevel } : {}),
    ...(startGold !== undefined ? { startGold } : {}),
    ...(timeOfDayParsed.success ? { timeOfDay: timeOfDayParsed.data } : {}),
    ...(difficultyParsed.success ? { difficulty: difficultyParsed.data } : {})
  };
}

/**
 * E2E・デバッグ用のURLフラグを つづきから(continue)のオプションへ変換する。
 * - ?seed=N: 敵シンボル/戦闘シードの固定(つづきから後の配置再現用)
 * - ?noSymbols=1: 敵シンボルの無効化(移動スモークの安定化用)
 * new-game と違い startLevel/startGold は運ばない(セーブ済みの進行が正)。
 * seed/noSymbols の解釈は newGameOptionsFromUrl と同一流儀で揃える。
 */
export function continueOptionsFromUrl(): ContinueOptions {
  const params = new URLSearchParams(window.location.search);
  const seedRaw = params.get("seed");
  const seed =
    seedRaw !== null && seedRaw !== "" && Number.isFinite(Number(seedRaw))
      ? Number(seedRaw)
      : undefined;
  return {
    ...(seed !== undefined ? { seed } : {}),
    ...(params.has("noSymbols") ? { noSymbols: true } : {})
  };
}

/**
 * 新規ゲーム時にオープニング演出を飛ばして直接探索へ入るか(?skipIntro=1)。
 * E2E・デバッグ用の演出スキップ(ai-integration.md「レート・コスト保護」の注記=
 * テスト時の演出スキップは防御弱体化にあたらない)。本番URLでは付与されない。
 */
export function shouldSkipIntro(): boolean {
  return new URLSearchParams(window.location.search).has("skipIntro");
}
