import { env } from './env.js';
import { createServer } from './server.js';
import { startTikTok } from './tiktok.js';
import { startAmbientMock } from './ambient.js';

const server = createServer(env.wsPort);

// 1. Ambient Mock Simulator: Patuloy na nagpapalaban kahit walang nanonood sa simula
const ambient = startAmbientMock((e) => {
  server.broadcast(e);
});
console.log('🤖 [HYBRID BRIDGE] Aktibo ang background mock simulator (patuloy ang laban)!');

// 2. Real TikTok Live Connector: Kapag may pumasok na totoong viewers, sasabay agad ang aksyon nila!
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
  ambient.stop();
  tiktok.stop();
  server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
