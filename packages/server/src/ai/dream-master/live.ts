import type { DreamMaster } from "./types.js";

/**
 * LiveDreamMaster(実AI = Agent SDK 実装)のプレースホルダ。
 *
 * **M4-D で実装する**。ここで Agent SDK の query を用い、
 * `resolveFlowSpec` が返すモデル・許可ツール・タイムアウト2値・ターン/トークン上限で
 * ゲーム内AIを呼び出し、生のツール意図列 + 最終テキストを `DreamMasterResult` として返す
 * (ai-integration.md「AIサンドボックス」48-72 / 「呼び出しフロー別仕様」)。
 *
 * 現時点では未実装エラーを投げる(このモジュールは SDK を import しない=mock 経由で実AIが
 * 混入しないことを構造的に保証する)。`createDreamMaster("live", ...)` は本関数で例外になる。
 */
export function createLiveDreamMaster(): DreamMaster {
  throw new Error(
    "LiveDreamMaster は M4-D(AI_MODE=live / Agent SDK)で実装します。現在は AI_MODE=mock のみ利用可能です。"
  );
}
