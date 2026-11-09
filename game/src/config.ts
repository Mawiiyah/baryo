// LAHAT ng numbers ng laro ay dito. Walang magic numbers sa ibang file.

export type DefenderKind = 'tanod' | 'anito' | 'albularyo' | 'sarimanok';
export type AttackerKind = 'aswang' | 'manananggal' | 'tikbalang' | 'kapre';
export type UnitKind = DefenderKind | AttackerKind;
export type Shape = 'rect' | 'circle' | 'triangle' | 'star';

export interface UnitStats {
  name: string;
  hp: number;
  damage: number; // per hit
  range: number; // px
  cooldownMs: number; // pagitan ng atake/heal
  speed: number; // px per second
  width: number;
  height: number;
  color: number;
  shape: Shape;
  flying: boolean;
  canHitAir: boolean;
  heal: number; // > 0 = healer (hindi umaatake)
  ranged: boolean; // nagpapakita ng projectile line
}

export const GAME = {
  width: 1280,
  height: 720,
  background: 0x1d2b1f,
  groundTop: 430,
  groundBottom: 640,
  groundColor: 0x3b5d2e,
  flyHeight: 150, // gaano kataas lumilipad sa ibabaw ng ground
  spawnX: 1320, // kanan, labas ng screen
  defenderSpawnX: 150,
  frontLineX: 560, // dito naghihintay ang defenders kapag walang kalaban
  healerBackOffset: 120, // gaano kalayo sa likod ng front line ang healer
  restartDelayMs: 6000,
} as const;

export const BASE = {
  name: 'Bahay Kubo',
  hp: 2000,
  x: 70,
  width: 110,
  height: 90,
  roofHeight: 60,
  wallColor: 0xc8a165,
  roofColor: 0x8a6d3b,
  hitX: 130, // dito tumitigil at umaatake ang halimaw
} as const;

export const DEFENDERS: Record<DefenderKind, UnitStats> = {
  tanod: {
    name: 'Tanod', hp: 120, damage: 12, range: 40, cooldownMs: 800, speed: 70,
    width: 26, height: 42, color: 0x3a7bd5, shape: 'rect',
    flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  anito: {
    name: 'Anito', hp: 600, damage: 18, range: 45, cooldownMs: 1400, speed: 40,
    width: 44, height: 60, color: 0x8b5a2b, shape: 'rect',
    flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  albularyo: {
    name: 'Albularyo', hp: 100, damage: 0, range: 180, cooldownMs: 1200, speed: 55,
    width: 30, height: 30, color: 0x4caf50, shape: 'circle',
    flying: false, canHitAir: false, heal: 25, ranged: true,
  },
  sarimanok: {
    name: 'Sarimanok', hp: 220, damage: 45, range: 320, cooldownMs: 1000, speed: 60,
    width: 40, height: 40, color: 0xff9800, shape: 'star',
    flying: false, canHitAir: true, heal: 0, ranged: true,
  },
};

export const ATTACKERS: Record<AttackerKind, UnitStats> = {
  aswang: {
    name: 'Aswang', hp: 90, damage: 10, range: 40, cooldownMs: 900, speed: 45,
    width: 28, height: 40, color: 0x8e1b1b, shape: 'rect',
    flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  manananggal: {
    name: 'Manananggal', hp: 70, damage: 14, range: 40, cooldownMs: 1000, speed: 55,
    width: 34, height: 28, color: 0x7b3fa0, shape: 'triangle',
    flying: true, canHitAir: false, heal: 0, ranged: false,
  },
  tikbalang: {
    name: 'Tikbalang', hp: 110, damage: 12, range: 40, cooldownMs: 700, speed: 110,
    width: 22, height: 58, color: 0x5d4037, shape: 'rect',
    flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  kapre: {
    name: 'Kapre', hp: 1500, damage: 60, range: 55, cooldownMs: 1800, speed: 22,
    width: 70, height: 110, color: 0x263238, shape: 'rect',
    flying: false, canHitAir: false, heal: 0, ranged: false,
  },
};

export const SPAWN = {
  likesPerTanod: 30,
  maxDefenders: 40,
  maxAttackers: 50,
  // Token bucket: max na spawn kada segundo (para sa like spam)
  ratePerSec: 4,
  burst: 6,
  queueMax: 30, // sobra dito ay itinatapon
  laneJitter: 1, // 0..1 bahagi ng ground band na ginagamit para sa random y
} as const;

/** Gift name (gaya ng galing sa TikTok) → anong defender at ilan kada gift. */
export const GIFTS: Record<string, { unit: DefenderKind; perGift: number }> = {
  Rose: { unit: 'tanod', perGift: 2 },
  'TikTok': { unit: 'tanod', perGift: 3 },
  'Ice Cream Cone': { unit: 'albularyo', perGift: 1 },
  'Finger Heart': { unit: 'anito', perGift: 1 },
  Doughnut: { unit: 'sarimanok', perGift: 1 },
};
export const GIFT_DEFAULT = { unit: 'anito' as DefenderKind, perGift: 1 };
export const GIFT_MAX_SPAWNS_PER_EVENT = 10; // cap kahit malaking streak

export const FOLLOW = { unit: 'albularyo' as DefenderKind, count: 1 };

/** Chat commands: per-user cooldown para hindi ma-spam. */
export const CHAT = {
  commands: { '!tanod': 'tanod' } as Record<string, DefenderKind>,
  userCooldownMs: 15000,
  maxMsgLength: 60,
} as const;

export const WAVES = {
  firstDelayMs: 5000,
  intervalMs: 20000,
  baseCount: 4,
  growthPerWave: 2,
  spawnSpacingMs: 700,
  bossEvery: 5, // Kapre tuwing ika-N wave
  // Mga weight ng random na attacker (hindi kasama ang boss)
  weights: { aswang: 5, manananggal: 2, tikbalang: 3 } as Record<Exclude<AttackerKind, 'kapre'>, number>,
  manananggalFromWave: 2,
  tikbalangFromWave: 3,
  hpScalePerWave: 0.08, // +8% HP kada wave
} as const;

export const HUD = {
  feedLines: 7,
  padding: 16,
  likeColor: 0xff4081,
  font: 'monospace',
  fontSize: 18,
  smallFontSize: 12,
  barWidth: 400,
  barHeight: 18,
  unitBarHeight: 4,
  textColor: '#ffffff',
  goodColor: 0x4caf50,
  badColor: 0xe53935,
  barBg: 0x000000,
  flashMs: 120,
  projectileMs: 150,
  healColor: 0x76ff03,
  projectileColor: 0xffeb3b,
} as const;

export const NET = {
  reconnectMinMs: 1000,
  reconnectMaxMs: 10000,
} as const;

/** Debug keys → event (dumadaan pa rin sa handleEvent). */
export const DEBUG_KEYS = {
  L: { type: 'like', user: 'debug', count: 10 },
  R: { type: 'gift', user: 'debug', gift: 'Rose', count: 1 },
  D: { type: 'gift', user: 'debug', gift: 'Doughnut', count: 1 },
  A: { type: 'gift', user: 'debug', gift: 'Finger Heart', count: 1 },
  F: { type: 'follow', user: 'debug' },
  T: { type: 'chat', user: 'debug', msg: '!tanod' },
} as const;
