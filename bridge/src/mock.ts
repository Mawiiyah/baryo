import { createServer } from './server.js';
import { startAmbientMock } from './ambient.js';

const PORT = Number(process.env.WS_PORT) || 8080;
const server = createServer(PORT);

console.log('='.repeat(55));
console.log(`🎮 [MOCK BRIDGE] WebSocket server started sa ws://localhost:${PORT}`);
console.log('📡 Nagpapadala ng simulated TikTok LIVE events...');
console.log('💡 Buksan ang game sa browser (http://localhost:5173)');
console.log('   Pindutin ang Ctrl+C para ihinto.');
console.log('='.repeat(55));

const ambient = startAmbientMock((e) => {
  server.broadcast(e);
});

const shutdown = () => {
  ambient.stop();
  server.close();
  console.log('\n🛑 [MOCK BRIDGE] Nahinto na ang mock server.');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
