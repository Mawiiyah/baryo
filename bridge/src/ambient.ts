import type { BridgeMessage } from './events.js';

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

function generateLike(): BridgeMessage {
  const user = pick(MOCK_USERS);
  const count = randInt(10, 25);
  console.log(`[MOCK LIKE] ❤️  ${user} sent ${count} likes`);
  return { type: 'like', user, count };
}

function generateChat(): BridgeMessage {
  const user = pick(MOCK_USERS);
  const isHero = Math.random() < 0.55;
  const msg = isHero ? (Math.random() < 0.5 ? '!tanod' : 'tanod') : (Math.random() < 0.5 ? '!aswang' : 'aswang');
  console.log(`[MOCK CHAT] 💬  ${user}: ${msg}`);
  return { type: 'chat', user, msg };
}

function generateSmallGift(): BridgeMessage {
  const user = pick(MOCK_USERS);
  const isHero = Math.random() < 0.5;
  if (isHero) {
    const gifts = [
      { name: 'Rose', coins: 1, count: randInt(1, 2) },
      { name: 'Ice Cream Cone', coins: 1, count: 1 },
    ];
    const g = pick(gifts);
    console.log(`[MOCK GIFT] 🌹 [BAYANI] ${user} sent ${g.name} x${g.count}`);
    return { type: 'gift', user, gift: g.name, count: g.count, coins: g.coins };
  } else {
    const gifts = [
      { name: 'GG', coins: 1, count: randInt(1, 2) },
      { name: 'Heart Me', coins: 1, count: 1 },
    ];
    const g = pick(gifts);
    console.log(`[MOCK GIFT] 👹 [HALIMAW] ${user} sent ${g.name} x${g.count}`);
    return { type: 'gift', user, gift: g.name, count: g.count, coins: g.coins };
  }
}

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
    console.log(`[MOCK GIFT] 🌟 [BAYANI] ${user} sent ${g.name}!`);
    return { type: 'gift', user, gift: g.name, count: g.count, coins: g.coins };
  } else {
    const gifts = [
      { name: 'Panda', coins: 5, count: 1 },
      { name: 'Rosa', coins: 10, count: 1 },
      { name: 'Gold Boxing Gloves', coins: 10, count: 1 },
      { name: 'Capybara', coins: 30, count: 1 },
    ];
    const g = pick(gifts);
    console.log(`[MOCK GIFT] 👹 [HALIMAW] ${user} sent ${g.name}!`);
    return { type: 'gift', user, gift: g.name, count: g.count, coins: g.coins };
  }
}

function generateFollow(): BridgeMessage {
  const user = pick(MOCK_USERS);
  console.log(`[MOCK FOLLOW] ➕  ${user} followed!`);
  return { type: 'follow', user };
}

export function getNextMockEvent(): BridgeMessage {
  const roll = Math.random();
  if (roll < 0.40) return generateLike();
  if (roll < 0.72) return generateChat();
  if (roll < 0.90) return generateSmallGift();
  if (roll < 0.96) return generateFollow();
  return generateMidGift();
}

/**
 * Nagpapatakbo ng background simulator para tuloy-tuloy ang laban
 * kahit walang nanonood sa TikTok LIVE.
 */
export function startAmbientMock(onEvent: (e: BridgeMessage) => void, minMs = 3500, maxMs = 7500) {
  let timer: NodeJS.Timeout | undefined;
  let running = true;

  function schedule() {
    if (!running) return;
    const delay = randInt(minMs, maxMs);
    timer = setTimeout(() => {
      if (!running) return;
      const e = getNextMockEvent();
      onEvent(e);
      schedule();
    }, delay);
  }

  schedule();

  return {
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
    },
  };
}
