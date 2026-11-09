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
  const count = randInt(2, 6);
  console.log(`[MOCK LIKE] ❤️  ${user} sent ${count} likes`);
  return { type: 'like', user, count };
}

function generateChat(): BridgeMessage {
  const user = pick(MOCK_USERS);
  const isHero = Math.random() < 0.5;
  const msg = isHero ? (Math.random() < 0.5 ? '!tanod' : 'tanod') : (Math.random() < 0.5 ? '!aswang' : 'aswang');
  console.log(`[MOCK CHAT] 💬  ${user}: ${msg}`);
  return { type: 'chat', user, msg };
}

function generateSmallGift(): BridgeMessage {
  const user = pick(MOCK_USERS);
  const isHero = Math.random() < 0.5;
  if (isHero) {
    const gifts = [
      { name: 'Rose', coins: 1, count: 1 },
      { name: 'Ice Cream Cone', coins: 1, count: 1 },
    ];
    const g = pick(gifts);
    console.log(`[MOCK GIFT] 🌹 [BAYANI] ${user} sent ${g.name} x1`);
    return { type: 'gift', user, gift: g.name, count: 1, coins: g.coins };
  } else {
    const gifts = [
      { name: 'GG', coins: 1, count: 1 },
      { name: 'Heart Me', coins: 1, count: 1 },
    ];
    const g = pick(gifts);
    console.log(`[MOCK GIFT] 👹 [HALIMAW] ${user} sent ${g.name} x1`);
    return { type: 'gift', user, gift: g.name, count: 1, coins: g.coins };
  }
}

function generateFollow(): BridgeMessage {
  const user = pick(MOCK_USERS);
  console.log(`[MOCK FOLLOW] ➕  ${user} followed!`);
  return { type: 'follow', user };
}

export function getNextMockEvent(): BridgeMessage {
  const roll = Math.random();
  if (roll < 0.45) return generateChat();        // 45% chance: isa-isang Tanod o Aswang
  if (roll < 0.80) return generateLike();        // 35% chance: marahang likes (+2 hanggang +6)
  if (roll < 0.95) return generateSmallGift();   // 15% chance: 1 gift lang (1-2 units)
  return generateFollow();                       // 5% chance: follow
}

/**
 * Nagpapatakbo ng background simulator para tuloy-tuloy ang laban
 * nang isa-isa o dalawa lang ang naglalaban sa screen (hindi mukhang bot).
 */
export function startAmbientMock(onEvent: (e: BridgeMessage) => void, minMs = 7000, maxMs = 14000) {
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
