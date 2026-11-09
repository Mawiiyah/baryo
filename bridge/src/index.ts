import { env } from './env.js';
import { createServer } from './server.js';
import { startTikTok } from './tiktok.js';

const server = createServer(env.wsPort);
const tiktok = startTikTok({
  username: env.tiktokUsername,
  reconnectMs: env.reconnectMs,
  reconnectMaxMs: env.reconnectMaxMs,
  signApiKey: env.signApiKey,
  onEvent: (e) => server.broadcast(e),
});

const shutdown = () => {
  tiktok.stop();
  server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
