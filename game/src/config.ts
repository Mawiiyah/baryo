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
  // Portrait 9:16 logical size; naka-scale sa window (Scale.FIT)
  width: 1080,
  height: 1920,
  background: 0x1d2b1f,
  groundTop: 1150,
  groundBottom: 1650,
  flyHeight: 260, // gaano kataas lumilipad sa ibabaw ng ground
  spawnX: 1150, // kanan, labas ng screen
  defenderSpawnX: 220,
  frontLineX: 560, // dito naghihintay ang defenders kapag walang kalaban
  healerBackOffset: 160, // gaano kalayo sa likod ng front line ang healer
  restartDelayMs: 6000,
} as const;

export const BASE = {
  name: 'Bahay Kubo',
  hp: 2000,
  x: 100,
  width: 170,
  height: 150,
  roofHeight: 100,
  roofOverhang: 16,
  wallColor: 0xc8a165,
  roofColor: 0x8a6d3b,
  hitX: 210, // dito tumitigil at umaatake ang halimaw
} as const;

export const DEFENDERS: Record<DefenderKind, UnitStats> = {
  tanod: {
    name: 'Tanod', hp: 120, damage: 12, range: 64, cooldownMs: 800, speed: 112,
    width: 42, height: 67, color: 0x3a7bd5, shape: 'rect',
    flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  anito: {
    name: 'Anito', hp: 600, damage: 18, range: 72, cooldownMs: 1400, speed: 64,
    width: 70, height: 96, color: 0x8b5a2b, shape: 'rect',
    flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  albularyo: {
    name: 'Albularyo', hp: 100, damage: 0, range: 288, cooldownMs: 1200, speed: 88,
    width: 48, height: 48, color: 0x4caf50, shape: 'circle',
    flying: false, canHitAir: false, heal: 25, ranged: true,
  },
  sarimanok: {
    name: 'Sarimanok', hp: 220, damage: 45, range: 512, cooldownMs: 1000, speed: 96,
    width: 64, height: 64, color: 0xff9800, shape: 'star',
    flying: false, canHitAir: true, heal: 0, ranged: true,
  },
};

export const ATTACKERS: Record<AttackerKind, UnitStats> = {
  aswang: {
    name: 'Aswang', hp: 90, damage: 10, range: 64, cooldownMs: 900, speed: 72,
    width: 45, height: 64, color: 0x8e1b1b, shape: 'rect',
    flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  manananggal: {
    name: 'Manananggal', hp: 70, damage: 14, range: 64, cooldownMs: 1000, speed: 88,
    width: 54, height: 45, color: 0x7b3fa0, shape: 'triangle',
    flying: true, canHitAir: false, heal: 0, ranged: false,
  },
  tikbalang: {
    name: 'Tikbalang', hp: 110, damage: 12, range: 64, cooldownMs: 700, speed: 176,
    width: 35, height: 93, color: 0x5d4037, shape: 'rect',
    flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  kapre: {
    name: 'Kapre', hp: 1500, damage: 60, range: 88, cooldownMs: 1800, speed: 35,
    width: 112, height: 176, color: 0x263238, shape: 'rect',
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
  idleJitterX: 140, // random na ±px sa front line para hindi magpatong-patong ang defenders
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

/** Kulay at font ng buong UI. */
export const THEME = {
  font: '"Trebuchet MS", "Arial Rounded MT Bold", Verdana, sans-serif',
  text: '#ffffff',
  textDim: '#c3cbbd',
  stroke: '#0b0f0a',
  panel: 0x0a1210,
  panelAlpha: 0.66,
  panelBorder: 0xffffff,
  panelBorderAlpha: 0.14,
  accent: 0xffc84a, // ginto
  accentCss: '#ffc84a',
  good: 0x5cc85f,
  warn: 0xffb300,
  danger: 0xe53935,
  dangerCss: '#ff6157',
  like: 0xff4081,
  likeCss: '#ff8ab3',
  heal: 0x76ff03,
  healCss: '#a6ff5c',
  projectile: 0xffd54f,
  outline: 0x000000,
  barBg: 0x000000,
  barBgAlpha: 0.55,
  netColors: { connecting: 0xffb300, connected: 0x5cc85f, disconnected: 0xe53935 },
} as const;

export const HUD = {
  padding: 32,
  panelPad: 24,
  panelRadius: 24,
  titleSize: 38,
  fontSize: 32,
  smallFontSize: 24,
  textStroke: 6,
  barHeight: 34,
  likeBarHeight: 22,
  barRadius: 11,
  gap: 14,
  hpWarn: 0.5, // < 50% → dilaw
  hpDanger: 0.25, // < 25% → pula
  netDotR: 9,
  // Unit overlays
  unitBarHeight: 8,
  unitBarGap: 14, // agwat ng HP bar sa itaas ng unit
  unitLabelGap: 22, // agwat ng label sa itaas ng HP bar
  unitFontSize: 22,
  strokeWidth: 3,
  // Legend ("Paano tumulong")
  legendY: 330,
  legendWidth: 470,
  legendRowH: 46,
  legendIconSize: 30,
  legendFontSize: 25,
  // Toasts (alerts sa kanan)
  toastBottomY: 1060,
  toastRowH: 54,
  toastFontSize: 25,
  toastMax: 5,
  toastMs: 6000,
  toastFadeMs: 500,
  toastSlidePx: 60,
  // Wave banner
  bannerY: 930,
  bannerFontSize: 112,
  bannerSubSize: 40,
  bannerMs: 1800,
  // Game over
  overlayAlpha: 0.65,
  overFontSize: 92,
} as const;

/** Emoji sa legend at toasts. Walang emoji = '🎁'. */
export const ICONS = {
  like: '❤️',
  follow: '➕',
  chat: '💬',
  gift: '🎁',
  gifts: {
    Rose: '🌹',
    TikTok: '🎵',
    'Ice Cream Cone': '🍦',
    'Finger Heart': '🫰',
    Doughnut: '🍩',
  } as Record<string, string>,
} as const;

/** Background: gabi sa baryo. */
export const SCENERY = {
  skyTop: 0x060a22,
  skyBottom: 0x2d2852,
  starCount: 80,
  starMinR: 1.2,
  starMaxR: 3.4,
  starMaxY: 1000,
  starTwinkleMinMs: 900,
  starTwinkleMaxMs: 2800,
  moonX: 880,
  moonY: 470,
  moonR: 80,
  moonColor: 0xfff1c9,
  moonCrater: 0xe8d9a8,
  moonGlow: 0xffe08a,
  moonGlowRings: 5,
  moonGlowStep: 34,
  moonGlowAlpha: 0.05,
  hills: [
    { color: 0x1a1f40, height: 210, freq: 0.006, phase: 0.4 },
    { color: 0x111a24, height: 120, freq: 0.011, phase: 2.1 },
  ],
  palms: [
    { x: 330, h: 300, lean: 40 },
    { x: 610, h: 380, lean: -30 },
    { x: 760, h: 260, lean: 25 },
    { x: 980, h: 340, lean: -45 },
  ],
  palmColor: 0x070d0c,
  palmTrunkWidth: 12,
  palmLeaf: 120,
  palmLeaves: 7,
  groundTopColor: 0x4b7537,
  groundBottomColor: 0x253f1d,
  groundEdge: 0x7fae54,
  groundEdgeWidth: 6,
  soilTop: 0x1d170f,
  soilBottom: 0x090705,
  grassCount: 110,
  grassColor: 0x6a9b48,
  grassDark: 0x30521f,
  grassMinH: 10,
  grassMaxH: 26,
  fogColor: 0xcdd6ff,
  fogAlpha: 0.07,
  fogY: 1130,
  fogH: 120,
  fogDriftPx: 140,
  fogDriftMs: 15000,
  darknessWidth: 280, // dilim sa kanan, kung saan galing ang halimaw
  darknessAlpha: 0.8,
  gradientSteps: 48,
} as const;

/** Detalye ng drawing ng Bahay Kubo (sukat ay nasa BASE). */
export const KUBO = {
  stiltHeight: 34,
  stiltWidth: 12,
  stiltColor: 0x5b4325,
  floorHeight: 12,
  floorColor: 0x6e5230,
  wallLines: 9,
  wallLineColor: 0xa9854d,
  windowW: 54,
  windowH: 44,
  windowColor: 0xffcf6b,
  windowGlowR: 70,
  windowGlowAlpha: 0.08,
  doorW: 40,
  doorH: 78,
  doorColor: 0x5b4325,
  thatchLines: 6,
  thatchColor: 0x6f5630,
  shakePx: 6,
  shakeMs: 50,
  shakeCooldownMs: 350,
} as const;

/** Animasyon at effects. */
export const FX = {
  spawnPopMs: 260,
  deathMs: 320,
  deathRise: 36,
  bobPx: 4,
  bobFlyPx: 14,
  bobMinMs: 550,
  bobMaxMs: 900,
  hitFlashMs: 90,
  hitFlashColor: 0xffffff,
  dmgTextMs: 700,
  dmgTextRise: 56,
  dmgFontSize: 26,
  projectileMs: 180,
  projectileR: 9,
  beamWidth: 6,
  beamMs: 180,
  shadowAlpha: 0.35,
  shadowHeight: 0.22, // bahagi ng lapad ng unit
  eyeR: 0.1, // bahagi ng lapad ng unit
  eyeY: { rect: 0.28, circle: 0.38, triangle: 0.66, star: 0.45 } as Record<Shape, number>, // mula sa itaas, bahagi ng taas
  eyeGap: 0.22, // agwat ng mata, bahagi ng lapad
  defenderEye: 0xffffff,
  attackerEye: 0xff3b30,
  pupil: 0x111111,
} as const;

export const NET = {
  reconnectMinMs: 1000,
  reconnectMaxMs: 10000,
} as const;

/** Debug keys → event (dumadaan pa rin sa handleEvent). */
export const DEBUG_KEYS = {
  // '1' = sapat na likes para sa isang Tanod
  '1': { type: 'like', user: 'debug', count: SPAWN.likesPerTanod },
  L: { type: 'like', user: 'debug', count: 10 },
  R: { type: 'gift', user: 'debug', gift: 'Rose', count: 1 },
  D: { type: 'gift', user: 'debug', gift: 'Doughnut', count: 1 },
  A: { type: 'gift', user: 'debug', gift: 'Finger Heart', count: 1 },
  F: { type: 'follow', user: 'debug' },
  T: { type: 'chat', user: 'debug', msg: '!tanod' },
} as const;
