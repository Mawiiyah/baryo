import { createServer } from './server.js';
import type { BridgeMessage } from './events.js';

const PORT = Number(process.env.WS_PORT) || 8080;
const server = createServer(PORT);

console.log('='.repeat(55));
console.log(`🎮 [MOCK BRIDGE] WebSocket server started sa ws://localhost:${PORT}`);
console.log('📡 Nagpapadala ng simulated TikTok LIVE events...');
console.log('💡 Buksan ang game sa browser (http://localhost:5173)');
console.log('   Pindutin ang Ctrl+C para ihinto.');
console.log('='.repeat(55));

const MOCK_USERS = [
  'user982314',
  'kuya_mark08',
  'charlie_ph',
  'marites_gaming',
  'cardo_live',
  'pinoy_gamer23',
  'akosijuan_ph',
  'queen_ria99',
  'batang_quiapo',
  'kristine.joy',
  'dave_plays',
  'baryo_fanatic',
  'althea_07',
  'cj_official',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 1. Likes (Madalas - viewers tapping screen)
function generateLike(): BridgeMessage {
  const user = pick(MOCK_USERS);
  const count = randInt(10, 25);
  console.log(`[LIKE] ❤️  ${user} sent ${count} likes`);
  return { type: 'like', user, count };
}

// 2. Chat commands (Madalas - viewers playing free)
function generateChat(): BridgeMessage {
  const user = pick(MOCK_USERS);
  const isHero = Math.random() < 0.55;
  const msg = isHero ? (Math.random() < 0.5 ? '!tanod' : 'tanod') : (Math.random() < 0.5 ? '!aswang' : 'aswang');
  console.log(`[CHAT] 💬  ${user}: ${msg}`);
  return { type: 'chat', user, msg };
}

// 3. Small gifts (1 coin - saktuhan lang)
function generateSmallGift(): BridgeMessage {
  const user = pick(MOCK_USERS);
  const isHero = Math.random() < 0.5;
  if (isHero) {
    const gifts = [
      { name: 'Rose', coins: 1, count: randInt(1, 2) },
      { name: 'Ice Cream Cone', coins: 1, count: 1 },
    ];
    const g = pick(gifts);
    console.log(`[GIFT] 🌹 [BAYANI] ${user} sent ${g.name} x${g.count}`);
    return { type: 'gift', user, gift: g.name, count: g.count, coins: g.coins };
  } else {
    const gifts = [
      { name: 'GG', coins: 1, count: randInt(1, 2) },
      { name: 'Heart Me', coins: 1, count: 1 },
    ];
    const g = pick(gifts);
    console.log(`[GIFT] 👹 [HALIMAW] ${user} sent ${g.name} x${g.count}`);
    return { type: 'gift', user, gift: g.name, count: g.count, coins: g.coins };
  }
}

// 4. Mid/Boss gift (Bihira lang para exciting)
function generateMidGift(): BridgeMessage {
  const user = pick(MOCK_USERS);
  const isHero = Math.random() < 0.5;
  if (isHero) {
    const gifts = [
      { name: 'Finger Heart', coins: 5, count: 1 },
      { name: 'Dolphin', coins: 10, count: 1 },
      { name: 'Bravo!', coins: 10, count: 1 },
      { name: 'Doughnut', coins: 30, count: 1 },
    ];
    const g = pick(gifts);
    console.log(`[BIG GIFT] 🌟 [BAYANI] ${user} sent ${g.name}!`);
    return { type: 'gift', user, gift: g.name, count: g.count, coins: g.coins };
  } else {
    const gifts = [
      { name: 'Panda', coins: 5, count: 1 },
      { name: 'Rosa', coins: 10, count: 1 },
      { name: 'Gold Boxing Gloves', coins: 10, count: 1 },
      { name: 'Capybara', coins: 30, count: 1 },
    ];
    const g = pick(gifts);
    console.log(`[BIG GIFT] 👹 [HALIMAW] ${user} sent ${g.name}!`);
    return { type: 'gift', user, gift: g.name, count: g.count, coins: g.coins };
  }
}

// 5. Follow (Paminsan-minsan)
function generateFollow(): BridgeMessage {
  const user = pick(MOCK_USERS);
  console.log(`[FOLLOW] ➕  ${user} followed!`);
  return { type: 'follow', user };
}

function getNextEvent(): BridgeMessage {
  const roll = Math.random();
  if (roll < 0.40) return generateLike();        // 40% chance likes
  if (roll < 0.72) return generateChat();        // 32% chance chat commands
  if (roll < 0.90) return generateSmallGift();   // 18% chance small 1c gifts
  if (roll < 0.96) return generateFollow();      // 6% chance follow
  return generateMidGift();                      // 4% chance big gift / boss
}

// Saktuhang delay: 3.5 hanggang 7.5 segundo para natural ang laban
let timer: NodeJS.Timeout | undefined;

function scheduleNext() {
  const delayMs = randInt(3500, 7500);
  timer = setTimeout(() => {
    const event = getNextEvent();
    server.broadcast(event);
    scheduleNext();
  }, delayMs);
}

scheduleNext();

const shutdown = () => {
  if (timer) clearTimeout(timer);
  server.close();
  console.log('\n🛑 [MOCK BRIDGE] Nahinto na ang mock server.');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
