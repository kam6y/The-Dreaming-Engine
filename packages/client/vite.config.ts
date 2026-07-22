import fs from "node:fs";
import path from "node:path";

import { defineConfig, type Plugin, type ViteDevServer } from "vite";

/**
 * リポジトリ直下の `assets/`(画像アセット台帳: asset-pipeline.md)を、開発サーバーで
 * `/assets/*` として配信するプラグイン。ビルド成果物(dist)は縦切りでは使わない
 * (E2E・プレイは常に dev サーバー経由)ため、dist へのコピーは行わない。
 * シンボリックリンクを使わずミドルウェアで配信することで、シークレットスキャン等の
 * ツリー走査がリンク先へ潜り込まないようにする。
 */
function serveRepoAssets(): Plugin {
  const assetsRoot = path.resolve(import.meta.dirname, "../../assets");
  const contentTypes: Record<string, string> = {
    ".png": "image/png",
    ".json": "application/json",
    ".woff2": "font/woff2",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg"
  };
  return {
    name: "serve-repo-assets",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/assets/")) {
          next();
          return;
        }
        const rel = decodeURIComponent(url.slice("/assets/".length).split("?")[0] ?? "");
        const filePath = path.normalize(path.join(assetsRoot, rel));
        // ディレクトリトラバーサル防止: assetsRoot 配下のみ配信する
        if (!filePath.startsWith(assetsRoot + path.sep)) {
          res.statusCode = 403;
          res.end("forbidden");
          return;
        }
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          next();
          return;
        }
        const type = contentTypes[path.extname(filePath)] ?? "application/octet-stream";
        res.setHeader("Content-Type", type);
        fs.createReadStream(filePath).pipe(res);
      });
    }
  };
}

export default defineConfig({
  plugins: [serveRepoAssets()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      deny: [".env", ".env.*", "saves", "saves/**", "logs", "logs/**"]
    }
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true
  }
});
