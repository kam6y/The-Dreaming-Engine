import type { ClientMessage } from "@dreaming-engine/shared";

type NewGameOptions = NonNullable<Extract<ClientMessage, { type: "new-game" }>["options"]>;

/**
 * E2E・デバッグ用のURLフラグを new-game のオプションへ変換する。
 * - ?seed=N: 敵シンボル/戦闘シードの固定(再現用)
 * - ?noSymbols=1: 敵シンボルの無効化(移動スモークの安定化用)
 * サーバー正本化後もフラグの入口はURLのまま維持する(既存E2Eとの互換)。
 */
export function newGameOptionsFromUrl(): NewGameOptions {
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
