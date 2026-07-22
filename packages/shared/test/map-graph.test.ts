import { describe, expect, it } from "vitest";

import { mapConnectionEdges, townMap, dungeon2Map } from "../src/index.js";
import type { MapEdge } from "../src/index.js";

/**
 * マップ接続グラフ(M22。全体マップUI「夢の地図」のエッジ描画に使う純ヘルパー)。
 * 全マップの transitions から無向の隣接を導出する(重複辺を畳む・決定論的)。
 */
describe("mapConnectionEdges(接続グラフ=無向の隣接)", () => {
  // game-design.md「全体マップUI」の8マップの既知の接続(無向・重複なし)。
  // mapIdSchema 列挙順で [a, b](index(a) <= index(b))に正規化・整列した期待値。
  const expectedEdges: MapEdge[] = [
    ["town", "field"],
    ["field", "dungeon-1"],
    ["field", "field-2"],
    ["dungeon-1", "dungeon-2"],
    ["dungeon-2", "dungeon-3"],
    ["settlement", "field-2"],
    ["settlement", "dungeon-4"]
  ];

  it("既知の7辺を過不足なく返す(無向・重複なし)", () => {
    const edges = mapConnectionEdges();
    // 辺数を固定=余分な辺(自己ループ・畳み残しの往復辺)の混入を検出する
    expect(edges).toHaveLength(7);
    // 集合として一致(順序非依存の突き合わせ。整列は別テストで確認)
    const asKeys = (es: readonly MapEdge[]): string[] => es.map(([a, b]) => `${a} ${b}`).sort();
    expect(asKeys(edges)).toEqual(asKeys(expectedEdges));
  });

  it("各辺は往復2遷移を1本に畳む(無向)=どの辺も逆向きの重複を持たない", () => {
    const edges = mapConnectionEdges();
    const keys = edges.map(([a, b]) => `${a} ${b}`);
    for (const [a, b] of edges) {
      // 逆向きキーが辺集合に無い(=無向で1本化されている)
      expect(keys).not.toContain(`${b} ${a}`);
    }
    // 自己ループ(a===b)が無い
    for (const [a, b] of edges) expect(a).not.toBe(b);
  });

  it("決定論的: 呼び出しごとに同一の辺列(同順)を返す", () => {
    const a = mapConnectionEdges();
    const b = mapConnectionEdges();
    expect(a).toEqual(b);
    // mapIdSchema 列挙順での整列を固定値で確認(M22-3 が順序に依存しても安全)
    expect(a).toEqual(expectedEdges);
  });

  it("対象マップを差し替えられる(引数指定=テスト・部分グラフ用)", () => {
    // town のみを渡すと、その transitions(town→field)から1辺のみが導出される
    expect(mapConnectionEdges([townMap])).toEqual([["town", "field"]]);
    // dungeon-2 のみ(往復先が dungeon-1 / dungeon-3)は2辺。正規化・整列も確認
    expect(mapConnectionEdges([dungeon2Map])).toEqual([
      ["dungeon-1", "dungeon-2"],
      ["dungeon-2", "dungeon-3"]
    ]);
  });
});
