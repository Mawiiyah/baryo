import { env } from './env.js';
import { createServer } from './server.js';
import { startTikTok } from './tiktok.js';

const server = createServer(env.wsPort);

console.log(`📡 [BRIDGE] Kumokonekta sa TikTok LIVE ni @${env.tiktokUsername}...`);

// Real TikTok Live Connector: Puro totoong events lang mula sa live stream viewers
const tiktok = startTikTok({
  username: env.tiktokUsername,
  reconnectMs: env.reconnectMs,
  reconnectMaxMs: env.reconnectMaxMs,
  signApiKey: env.signApiKey,
  onEvent: (e) => {
    console.log(`[TIKTOK LIVE REAL] 🔥 Natanggap mula kay ${e.type === 'like' || e.type === 'gift' || e.type === 'chat' || e.type === 'follow' ? e.user : 'viewer'}:`, e.type);
    server.broadcast(e);
  },
});

const shutdown = () => {
  tiktok.stop();
  server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
