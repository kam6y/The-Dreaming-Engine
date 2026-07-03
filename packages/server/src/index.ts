import { loadRuntimeConfig } from "./config.js";
import { createServer } from "./server.js";

const config = loadRuntimeConfig(process.env);
const server = await createServer();

await server.listen({ host: config.host, port: config.port });

server.log.info(
  `The Dreaming Engine server listening on ${config.host}:${config.port} (${config.aiMode})`
);
