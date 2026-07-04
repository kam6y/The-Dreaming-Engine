import { loadRuntimeConfig } from "./config.js";
import { loadDotEnv } from "./env.js";
import { createServer } from "./server.js";

// 認証トークン等をリポジトリ直下の .env から process.env へ読み込む(loadRuntimeConfig /
// createServer が env を読む前に、この最初で呼ぶ)。既存 env は上書きしないため、
// dev スクリプトが立てる AI_MODE(mock/live)が .env より優先される(フェイルセーフ維持)。
loadDotEnv();

const config = loadRuntimeConfig(process.env);
const server = await createServer();

await server.listen({ host: config.host, port: config.port });

server.log.info(
  `The Dreaming Engine server listening on ${config.host}:${config.port} (${config.aiMode})`
);
