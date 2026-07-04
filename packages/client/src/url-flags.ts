import type { ClientMessage } from "@dreaming-engine/shared";

type NewGameOptions = NonNullable<Extract<ClientMessage, { type: "new-game" }>["options"]>;

/**
 * E2E・デバッグ用のURLフラグを new-game のオプションへ変換する。
 * - ?seed=N: 敵シンボル/戦闘シードの固定(再現用)
 * - ?noSymbols=1: 敵シンボルの無効化(移動スモークの安定化用)
 * - ?startLevel=N: 開始レベルの加速(通しプレイ E2E 用。サーバーは mock 時のみ尊重)
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
  return {
    ...(seed !== undefined ? { seed } : {}),
    ...(params.has("noSymbols") ? { noSymbols: true } : {}),
    ...(startLevel !== undefined ? { startLevel } : {})
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
