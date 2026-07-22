# フォント

| ファイル | フォント | ウェイト | ライセンス | 出典 |
|---|---|---|---|---|
| `ShipporiMincho-Regular.woff2` | しっぽり明朝 (Shippori Mincho) | Regular (400) | SIL OFL 1.1(同梱の `OFL.txt`) | [google/fonts `ofl/shipporimincho`](https://github.com/google/fonts/tree/main/ofl/shipporimincho)(上流: [fontdasu/ShipporiMincho](https://github.com/fontdasu/ShipporiMincho)) |

- 2026-07-05 に google/fonts リポジトリの TTF を取得し、`fonttools ttLib.woff2` で woff2 へ
  無加工圧縮したもの(サブセット化はしていない。AI が任意の漢字を出力しうるため全グリフを保持)
- 画像アセット(codex委譲: `docs/spec/asset-pipeline.md`)とは異なり、フォントは既存の
  オープンライセンス配布物の同梱であり `manifest.json` の管理対象外
- 利用側: `packages/client/src/style.css` の `@font-face` と
  `packages/client/src/ui/font.ts` の `UI_FONT_FAMILY`
