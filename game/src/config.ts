// LAHAT ng numbers ng laro ay dito. Walang magic numbers sa ibang file
// (maliban sa hugis ng placeholder models sa render/models.ts, na parang sprite data).
//
// Coordinates ng mundo (metro):
//   pos = layo mula sa Bahay Kubo papunta sa gubat (0 = kubo, lumalaki palayo sa camera)
//   lat = kaliwa/kanan sa lane (0 = gitna)
//   alt = taas (para sa lumilipad)

export type DefenderKind = 'tanod' | 'anito' | 'albularyo' | 'sarimanok';
export type MinionKind = 'aswang' | 'manananggal' | 'tikbalang';
export type BossKind = 'kapre' | 'mangkukulam' | 'bakunawa';
export type AttackerKind = MinionKind | BossKind;
export type UnitKind = DefenderKind | AttackerKind;

export interface UnitStats {
  name: string;
  hp: number;
  damage: number; // per hit
  range: number; // m
  cooldownMs: number; // pagitan ng atake/heal
  speed: number; // m per second
  size: number; // taas sa metro (scale ng model)
  color: number;
  flying: boolean;
  canHitAir: boolean;
  heal: number; // > 0 = healer (hindi umaatake)
  ranged: boolean; // may projectile/beam
  boss?: boolean; // may malaking HP bar sa HUD at sariling ability (tingnan ang BOSSES)
}

export const GAME = {
  // Landscape 16:9 (buong screen, para sa OBS); naka-scale sa window (CSS transform)
  width: 1920,
  height: 1080,
  restartDelayMs: 8000, // pagitan ng round
} as const;

/** Sukat ng lane at mga posisyon (metro). */
export const LANE = {
  length: 30, // hanggang saan ang daan
  halfWidth: 4.8, // lapad ng daan / 2 (dito naglalakad ang units)
  spawnPos: 32, // dito lumalabas ang halimaw (labas ng screen sa kanan)
  baseHitPos: 3.2, // dito tumitigil at umaatake sa kubo ang halimaw
  defenderSpawnPos: 3.0,
  frontLinePos: 7, // dito naghihintay ang defenders kapag walang kalaban
  healerBackOffset: 2.5, // gaano kalayo sa likod ng front line ang healer
  idleJitterPos: 3.5, // random na ± sa front line para hindi magpatong-patong
  flyHeight: 2.4,
  separation: 0.32, // min na layo ng dalawang unit = (size A + size B) × ito (para hindi magpatong)
  aggroRange: 5, // halimaw: lumalapit sa bayani na nasa loob nito (para kita ang laban)
  leash: 4, // bayani: hinahabol lang ang halimaw hanggang frontLinePos + ito (laban sa gitna ng screen)
  rangeJitter: 0.45, // ranged units: tumitigil sa (1 - random×ito) ng range para nakakalat sila
  meleeReach: 1.4, // abot ng suntok; ranged na halimaw ay tumitigil nang (range - meleeReach) mas malayo sa kubo
} as const;

export const BASE = {
  name: 'Bahay Kubo',
  hp: 3000, // ipinapakita bilang % sa HUD
  /**
   * Tama sa kubo ng halimaw na pinalakas ng coins = normal na damage × k^ito
   * (hindi buong √k), para makunat ang kubo at may oras pang sumagot ang BAYANI.
   */
  damagePowerExp: 0.25,
} as const;

export const DEFENDERS: Record<DefenderKind, UnitStats> = {
  tanod: {
    name: 'Tanod', hp: 120, damage: 12, range: 1.4, cooldownMs: 800, speed: 2.6,
    size: 1.6, color: 0x2f6fd6, flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  anito: {
    name: 'Anito', hp: 600, damage: 18, range: 1.6, cooldownMs: 1400, speed: 1.5,
    size: 2.2, color: 0x8b5a2b, flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  albularyo: {
    name: 'Albularyo', hp: 100, damage: 0, range: 8, cooldownMs: 1200, speed: 2.0,
    size: 1.5, color: 0x3fae4a, flying: false, canHitAir: false, heal: 25, ranged: true,
  },
  sarimanok: {
    name: 'Sarimanok', hp: 220, damage: 45, range: 12, cooldownMs: 1000, speed: 2.2,
    size: 1.9, color: 0x2440b8, flying: false, canHitAir: true, heal: 0, ranged: true,
  },
};

export const ATTACKERS: Record<AttackerKind, UnitStats> = {
  aswang: {
    name: 'Aswang', hp: 90, damage: 10, range: 1.4, cooldownMs: 900, speed: 1.8,
    size: 1.6, color: 0x8e1b1b, flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  manananggal: {
    name: 'Manananggal', hp: 70, damage: 14, range: 1.4, cooldownMs: 1000, speed: 2.2,
    size: 1.3, color: 0x7b3fa0, flying: true, canHitAir: false, heal: 0, ranged: false,
  },
  tikbalang: {
    name: 'Tikbalang', hp: 110, damage: 12, range: 1.4, cooldownMs: 700, speed: 3.6,
    size: 2.4, color: 0x6b4a32, flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  kapre: {
    name: 'Kapre', hp: 1500, damage: 60, range: 2.2, cooldownMs: 1800, speed: 0.9,
    size: 4.4, color: 0x2b3a2e, flying: false, canHitAir: false, heal: 0, ranged: false, boss: true,
  },
  mangkukulam: {
    name: 'Mangkukulam', hp: 1100, damage: 22, range: 9, cooldownMs: 1500, speed: 1.0,
    size: 2.1, color: 0x3a1a4c, flying: false, canHitAir: false, heal: 0, ranged: true, boss: true,
  },
  bakunawa: {
    name: 'Bakunawa', hp: 4200, damage: 55, range: 3, cooldownMs: 1500, speed: 0.75,
    size: 3.8, color: 0x1d6f84, flying: false, canHitAir: false, heal: 0, ranged: false, boss: true,
  },
};

/**
 * PATAS NA HALAGA: ang lakas (HP × damage/s) ng unit galing sa gift ay ayon sa coins na binayad:
 *   lakas = refPower × (coins / refCoins) ^ coinExponent
 * Mas mataas sa 1 ang exponent dahil sa laban, mas malakas ang maraming maliit kaysa iisang malaki
 * na may parehong kabuuang lakas (sabay-sabay silang tumatama). HP at damage ay × √k.
 * Libre (likes/follow/chat) = normal na lakas.
 */
export const BALANCE = {
  refCoins: 0.5, // 1 Rose = 2 Tanod → 0.5 coin bawat Tanod…
  refPower: 1800, // …na may normal na lakas (120 HP × 15 dmg/s)
  coinExponent: 1.6, // na-calibrate: equal-coin na laban ay halos tabla
  rangedFactor: 2, // dagdag na halaga ng nakakatira mula sa malayo
  bossFactor: 1, // boss ability ay hiwalay na pinalalakas (× √k)
  /**
   * Dagdag na "halaga" ng karakter na hindi nasusukat ng HP × damage (abilities, AoE, summon).
   * > 1 = mas mahina ang ibibigay kada coin; < 1 = mas malakas. Na-calibrate sa equal-coin na laban.
   */
  valueFactor: { mangkukulam: 2.5, bakunawa: 2, kapre: 0.5 } as Partial<Record<UnitKind, number>>,
  minMultiplier: 0.05,
  maxMultiplier: 1e6,
  sizeExp: 0.08, // mas malakas = bahagyang mas malaki (k^ito)
  maxSizeScale: 1.35,
} as const;

export const SPAWN = {
  likesPerTanod: 30,
  maxDefenders: 40,
  maxAttackers: 50,
  // Token bucket: max na spawn kada segundo (para sa like spam)
  ratePerSec: 4,
  burst: 6,
  queueMax: 30, // sobra dito ay itinatapon
} as const;

/**
 * Halaga ng bawat gift: `coins` = presyo sa TikTok coins (para sa HUD at top gifter).
 * Kapag may `coins` na galing sa TikTok (via bridge), iyon ang ginagamit; ito ang fallback.
 * TANDAAN: i-verify ang presyo at eksaktong pangalan sa TikTok bago mag-LIVE.
 */
export interface GiftValue<K> {
  unit: K;
  perGift: number;
  coins: number;
}

/** Gift name (gaya ng galing sa TikTok) → anong BAYANI, ilan kada gift, at halaga. */
export const GIFTS: Record<string, GiftValue<DefenderKind>> = {
  Rose: { unit: 'tanod', perGift: 2, coins: 1 },
  'TikTok': { unit: 'tanod', perGift: 3, coins: 1 },
  'Ice Cream Cone': { unit: 'albularyo', perGift: 1, coins: 1 },
  'Finger Heart': { unit: 'anito', perGift: 1, coins: 5 },
  Doughnut: { unit: 'sarimanok', perGift: 1, coins: 30 },
};

/**
 * Gift na wala sa GIFTS/VILLAIN_GIFTS → BAYANI ayon sa halaga (unang tier na `coins >= min`).
 * Mas mahal na gift = mas malakas o mas maraming bayani.
 */
export const GIFT_TIERS: { min: number; unit: DefenderKind; perGift: number }[] = [
  { min: 500, unit: 'sarimanok', perGift: 5 },
  { min: 100, unit: 'sarimanok', perGift: 2 },
  { min: 30, unit: 'anito', perGift: 2 },
  { min: 10, unit: 'anito', perGift: 1 },
  { min: 5, unit: 'albularyo', perGift: 1 },
  { min: 0, unit: 'tanod', perGift: 2 },
];
export const GIFT_MAX_SPAWNS_PER_EVENT = 10; // cap kahit malaking streak

export const FOLLOW = { unit: 'albularyo' as DefenderKind, count: 1 };

/**
 * VERSUS: mga gift na nagpapalabas ng HALIMAW (laban sa baryo), para maglaban ang viewers.
 * Uunahin ito bago ang GIFTS. Palitan ang pangalan ayon sa eksaktong gift name sa TikTok.
 */
export const VILLAIN_GIFTS: Record<string, GiftValue<AttackerKind>> = {
  GG: { unit: 'aswang', perGift: 3, coins: 1 },
  'Heart Me': { unit: 'manananggal', perGift: 2, coins: 1 },
  Perfume: { unit: 'tikbalang', perGift: 3, coins: 20 },
  'Hand Hearts': { unit: 'kapre', perGift: 1, coins: 100 },
  Cap: { unit: 'mangkukulam', perGift: 1, coins: 99 },
  Galaxy: { unit: 'bakunawa', perGift: 1, coins: 1000 },
};
/** Chat commands para sa halimaw (parehong cooldown ng CHAT). */
export const VILLAIN_CHAT: Record<string, AttackerKind> = { '!aswang': 'aswang' };

/** Chat commands: per-user cooldown para hindi ma-spam. */
export const CHAT = {
  commands: { '!tanod': 'tanod' } as Record<string, DefenderKind>,
  userCooldownMs: 15000,
  maxMsgLength: 60,
} as const;

/** Isang round: BAYANI panalo kapag buhay ang kubo pagkaubos ng oras; HALIMAW kapag nawasak ito. */
export const ROUND = {
  durationMs: 5 * 60 * 1000,
  warnMs: 30 * 1000, // pula ang timer sa huling 30s
  firstBannerDelayMs: 300,
} as const;

export interface BossAbility {
  intro: string; // sub-title sa banner
  slam?: { everyMs: number; radius: number; damage: number }; // tama sa lahat ng bayani sa paligid
  summon?: { everyMs: number; kind: MinionKind; count: number }; // nagpapatawag ng alagad
  breath?: { everyMs: number; length: number; damage: number }; // apoy sa harap
}

export const BOSSES: Record<BossKind, BossAbility> = {
  kapre: { intro: 'Ang higante ng puno ng balete!', slam: { everyMs: 6000, radius: 3.5, damage: 40 } },
  mangkukulam: { intro: 'Mag-ingat sa kanyang sumpa!', summon: { everyMs: 9000, kind: 'aswang', count: 2 } },
  bakunawa: { intro: 'Kinakain na ang buwan!', breath: { everyMs: 7000, length: 7, damage: 35 } },
};

/** 3D na eksena: camera, ilaw, hamog, kulay ng mundo. */
export const SCENE3D = {
  /**
   * 'behind' = nasa likod ng Bahay Kubo, daan papalayo (gaya ng reference).
   * 'side'   = nasa gilid, kubo sa kaliwa at halimaw galing sa kanan.
   */
  view: 'behind' as 'behind' | 'side',
  views: {
    behind: {
      fov: 42,
      cameraPos: { x: 0, y: 19, z: -11 },
      cameraLookAt: { x: 0, y: 0, z: 9 }, // mataas na POV: kita ang buong daan, hindi magulo kahit marami
      moonPos: { x: -20, y: 18, z: 75 },
      moonLightPos: { x: -10, y: 22, z: 30 },
      kuboScale: 0.8,
    },
    side: {
      fov: 38,
      cameraPos: { x: -22, y: 11, z: 10.5 },
      cameraLookAt: { x: 0, y: 4, z: 10.5 }, // mataas ang tinitingnan → nasa ibaba ng screen ang daan
      moonPos: { x: 70, y: 30, z: 26 },
      moonLightPos: { x: -14, y: 24, z: 4 },
      kuboScale: 0.9,
    },
  },
  /**
   * Battlefield: 'templo' = isla na may sinaunang templo (batay sa assets/reference/battlefield.png;
   * ginawa para sa 'behind' na view), 'baryo' = luma (daang lupa, bakod na kawayan, gubat).
   */
  battlefield: 'templo' as 'templo' | 'baryo',
  templo: {
    // camera para sa 'behind' (mas nakatingala nang kaunti para kita ang templo sa dulo)
    camera: { fov: 46, cameraPos: { x: 0, y: 17.5, z: -11 }, cameraLookAt: { x: 0, y: 0, z: 12 } },
    island: { rx: 15.5, rz: 26, cz: 13, depth: 2.4, roundness: 2.6 }, // superellipse na hugis ng isla (metro)
    waterLevel: 1.9, // gaano kababa ang tubig sa ilalim ng damo
    waterColor: 0x1d6aa0,
    waterGlow: 0x0b2c4a,
    foamColor: 0x9fe6ff,
    sandColor: 0xd9c08a,
    grassColors: ['#3f7d34', '#478b38', '#36702e', '#4f963d'],
    cliffColors: [0x5a5e66, 0x6a6e76, 0x4c5058],
    laneStones: ['#8f8577', '#9a8f80', '#857a6c', '#a1968a', '#7d7366'],
    laneGrout: '#5a5248',
    laneLine: '#e0a83a', // dilaw na guhit, dash sa gitna at korona
    lanePxPerM: 12, // resolution ng texture ng daan
    emblemPos: 15, // pos ng korona sa gitna ng daan
    gatePos: 30, // pos ng templo; nasa likod nito (LANE.spawnPos) lumalabas ang halimaw
    brazierPos: [5, 13.5, 25], // pos ng mga sulong bato (magkabilang gilid)
    bannerPos: 19.5,
    bayaniBanner: 0x2a4fc8, // asul (kaliwa ng screen)
    halimawBanner: 0xc82a2a, // pula (kanan ng screen)
    gazebos: [[11, 20], [12.5, 6.5]] as [number, number][], // [|x|, pos] ng mga pahingahan (magkabila)
    palmCount: 16,
    palmColor: 0x2f6a2a,
    trunkColor: 0x6a4e34,
    bushCount: 70,
    bushColors: [0x2e6a2a, 0x3a7a30, 0x285a24, 0x447f34],
    grassTufts: 500,
    grassColor: 0x5a9a3c,
    bannerSway: 0.08, // rad
    flameColor: 0xffb040,
  },
  unitScale: 1.0, // visual na laki ng units (hindi apektado ang gameplay)
  pixelScale: 3, // ire-render ang 3D sa (1920/3)x(1080/3) tapos palalakihin nang pixelated; mas malaki = mas blocky
  skyTop: '#0a0b2a',
  skyMid: '#3a2c5e',
  skyHorizon: '#c0607a',
  fogColor: 0x2c2448,
  fogNear: 32,
  fogFar: 80,
  hemiSky: 0x8a8fd8,
  hemiGround: 0x2a3a20,
  hemiIntensity: 1.7,
  exposure: 1.25,
  moonLight: 0xc8d4ff,
  moonIntensity: 2.2,
  shadowMapSize: 2048,
  shadowArea: 24, // kalahating lapad ng shadow camera
  moonRadius: 3.2,
  moonColor: 0xfff1c9,
  moonGlowColor: 0xffd79a,
  moonGlowScale: 16,
  bloodMoonColor: 0xff3a24, // kulay ng buwan habang buhay ang Bakunawa
  bloodMoonLerp: 1.5, // bilis ng pagpalit ng kulay (kada segundo)
  bloodFog: 0x4a1424, // hamog habang buhay ang Bakunawa
  bloodSky: 0xff6a50, // ilaw mula sa langit habang buhay ang Bakunawa
  starCount: 500,
  starRadius: 80,
  starSize: 0.35,
  groundColor: 0x355a2a,
  grassColor: 0x4f8a35,
  pathColor: 0x7a5c3a,
  pathEdgeColor: 0x5e4630,
  grassTufts: 700,
  grassArea: 28, // kalahating lapad ng damuhan
  fenceColor: 0xc7a35c,
  fenceSpacing: 2.2,
  fenceOffset: 0.6, // layo ng bakod sa gilid ng daan
  torchSpacing: 9,
  torchColor: 0xffa040,
  torchIntensity: 9,
  torchDistance: 10,
  torchFlicker: 0.25,
  palmCount: 14,
  palmColor: 0x1d2c18,
  trunkColor: 0x4a3626,
  hutColor: 0xc8a165,
  roofColor: 0x7d5f34,
  forestColor: 0x0d1410,
  kuboPos: 0, // pos ng Bahay Kubo
  kuboWindowColor: 0xffc860,
  kuboLight: 0xffb050,
  kuboLightIntensity: 14,
  kuboShakeMs: 220,
  kuboShakeAmount: 0.12,
  kuboShakeCooldownMs: 350,
} as const;

/** Animasyon at effects (3D). */
export const FX = {
  spawnPopMs: 320,
  deathMs: 450,
  bobAmount: 0.06, // bahagi ng size
  bobSpeed: 6, // rad/s
  flyBobAmount: 0.25,
  flapSpeed: 14,
  walkSway: 0.12, // rad
  legSwing: 0.5, // rad, ugoy ng binti habang naglalakad (sabay sa bob)
  armSwing: 0.35, // rad, ugoy ng braso (kabaligtaran ng binti sa parehong panig)
  limbSettle: 8, // 1/s, bilis ng pagbalik ng binti/braso kapag huminto
  lungeMs: 220,
  lungeAmount: 0.35, // m
  hitFlashMs: 110,
  hitFlashColor: 0xffffff,
  hitFlashCooldownMs: 300, // hindi kumikislap nang tuloy-tuloy kapag maraming tama
  hitFlashIntensity: 0.35, // mahina para hindi puti nang puti ang boss na laging tinatamaan
  projectileMs: 280,
  projectileRadius: 0.22,
  projectileColor: 0xffb030,
  projectileArc: 1.5, // taas ng arko (m)
  beamMs: 220,
  beamColor: 0x9cff57,
  beamRadius: 0.06,
  eyeGlow: 0xff2a1a,
  dmgFloatMs: 800,
  labelRefDist: 27, // layo kung saan scale 1 ang labels
  labelMinScale: 0.8,
  labelMaxScale: 1.25,
  nameShowMs: 5000, // ilang ms nakikita ang pangalan pagka-spawn (laging nakikita sa boss)
  turnSpeed: 10, // bilis ng pagharap ng unit sa kalaban (rad/s)
  curseColor: 0xc040ff, // tira ng Mangkukulam
  sparkCount: 6,
  sparkMs: 380,
  sparkSpeed: 4,
  sparkSize: 0.07,
  sparkGravity: 14,
  sparkColor: 0xffe08a,
  maxSparks: 240, // limit para hindi bumagal kapag maraming tama
  puffMs: 550,
  puffColor: 0x2a2030,
  ringMs: 600, // shockwave ng slam / summon
  slamColor: 0xffd59a,
  breathMs: 700,
  breathColor: 0xff6a1a,
  breathParticles: 40,
  shakeMs: 350,
  shakeBaseHit: 0.06,
  shakeSlam: 0.35,
  shakeBoss: 0.25,
  shakeBreath: 0.2,
} as const;

/** HUD (HTML/CSS overlay). Mga pixel ay sa 1080x1920 logical. */
export const HUD = {
  // Lugar na tinatakpan ng TikTok UI (itaas: host/viewers, ibaba: comments)
  safeTop: 24,
  safeBottom: 24,
  sidePad: 18,
  columnWidth: 150,
  toastMax: 3,
  toastMs: 5000,
  bannerMs: 2200,
  hpWarn: 0.5, // < 50% → dilaw
  hpDanger: 0.25, // < 25% → pula
  font: '"Silkscreen", monospace',
  portraitPx: 36, // resolution ng larawan ng karakter sa HUD (pinalalaki nang pixelated)
  iconPx: 18, // resolution ng emoji / gift icon sa HUD (pinalalaki nang pixelated)
} as const;

/** Emoji sa HUD. Walang emoji ang gift = ICONS.gift. */
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
    GG: '🎮',
    'Heart Me': '💗',
    Perfume: '🧴',
    'Hand Hearts': '🫶',
    Cap: '🧢',
    Galaxy: '🌌',
  } as Record<string, string>,
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
  // HALIMAW (versus)
  G: { type: 'gift', user: 'kontra', gift: 'GG', count: 1 },
  H: { type: 'gift', user: 'kontra', gift: 'Heart Me', count: 1 },
  P: { type: 'gift', user: 'kontra', gift: 'Perfume', count: 1 },
  K: { type: 'gift', user: 'kontra', gift: 'Hand Hearts', count: 1 },
  C: { type: 'gift', user: 'kontra', gift: 'Cap', count: 1 },
  B: { type: 'gift', user: 'kontra', gift: 'Galaxy', count: 1 },
  X: { type: 'chat', user: 'kontra', msg: '!aswang' },
} as const;

/** Para sa testing: ?debug&round=N → N segundo lang ang round. */
export const DEBUG_ROUND_LINKS = [30, 60] as const;

/** Clickable test buttons (lalabas lang sa URL na may ?debug). Dumadaan pa rin sa handleEvent. */
export const DEBUG_PANEL = {
  users: ['juan', 'maria', 'pedro', 'ana', 'jose', 'liza'], // random na pangalan para iba-iba
  buttons: [
    { label: '❤️ 30 likes → Tanod', event: { type: 'like', count: SPAWN.likesPerTanod } },
    { label: '❤️ 300 likes → 10 Tanod', event: { type: 'like', count: SPAWN.likesPerTanod * 10 } },
    { label: '🎁 Ibang gift (50 coins) → 2 Anito', event: { type: 'gift', gift: 'Mystery', count: 1, coins: 50 } },
    { label: '🌹 Rose → 2 Tanod', event: { type: 'gift', gift: 'Rose', count: 1 } },
    { label: '🎵 TikTok → 3 Tanod', event: { type: 'gift', gift: 'TikTok', count: 1 } },
    { label: '🫰 Finger Heart → Anito', event: { type: 'gift', gift: 'Finger Heart', count: 1 } },
    { label: '🍩 Doughnut → Sarimanok', event: { type: 'gift', gift: 'Doughnut', count: 1 } },
    { label: '🍦 Ice Cream → Albularyo', event: { type: 'gift', gift: 'Ice Cream Cone', count: 1 } },
    { label: '🍩 Doughnut ×5 (streak)', event: { type: 'gift', gift: 'Doughnut', count: 5 } },
    { label: '➕ Follow → Albularyo', event: { type: 'follow' } },
    { label: '💬 !tanod', event: { type: 'chat', msg: '!tanod' } },
  ],
  // Panig ng HALIMAW (versus)
  villainButtons: [
    { label: '[G] 🎮 GG → 3 Aswang', event: { type: 'gift', gift: 'GG', count: 1 } },
    { label: '[H] 💗 Heart Me → 2 Manananggal', event: { type: 'gift', gift: 'Heart Me', count: 1 } },
    { label: '[P] 🧴 Perfume → 3 Tikbalang', event: { type: 'gift', gift: 'Perfume', count: 1 } },
    { label: '[K] 🫶 Hand Hearts → Kapre', event: { type: 'gift', gift: 'Hand Hearts', count: 1 } },
    { label: '[C] 🧢 Cap → Mangkukulam', event: { type: 'gift', gift: 'Cap', count: 1 } },
    { label: '[B] 🌌 Galaxy → Bakunawa', event: { type: 'gift', gift: 'Galaxy', count: 1 } },
    { label: '[X] 💬 !aswang', event: { type: 'chat', msg: '!aswang' } },
  ],
} as const;

/**
 * Tunog (Web Audio, synthesized; walang audio files). Isang maikling "jingle" kada spawn.
 * notes = Hz ng bawat nota (sunod-sunod), noteMs = haba ng bawat isa, wave = OscillatorType,
 * slide = pag-glide ng pitch sa dulo ng nota (×), noise = halo ng ingay (0..1, pang-ungol/apoy).
 */
export interface SpawnSound {
  wave: OscillatorType;
  notes: number[];
  noteMs: number;
  gain: number;
  slide: number;
  noise: number;
}
export const SOUND = {
  enabled: true,
  masterGain: 0.5,
  /** Pinakamaikling pagitan ng spawn sound kada panig (iwas ingay sa like spam). */
  minGapMs: 90,
  attackMs: 8,
  releaseMs: 120,
  noiseLowpassHz: 900,
  /** Debug key para i-mute/unmute (hindi game event). */
  muteKey: 'M',
  spawn: {
    // BAYANI: maliwanag, paakyat
    tanod: { wave: 'square', notes: [523, 784], noteMs: 70, gain: 0.18, slide: 1, noise: 0 },
    anito: { wave: 'triangle', notes: [196, 262, 392], noteMs: 110, gain: 0.35, slide: 1, noise: 0 },
    albularyo: { wave: 'sine', notes: [659, 880, 1047], noteMs: 80, gain: 0.3, slide: 1, noise: 0 },
    sarimanok: { wave: 'square', notes: [784, 988, 1175, 1568], noteMs: 70, gain: 0.18, slide: 1.06, noise: 0 },
    // HALIMAW: madilim, pababa
    aswang: { wave: 'sawtooth', notes: [220, 165], noteMs: 90, gain: 0.16, slide: 0.85, noise: 0.15 },
    manananggal: { wave: 'sawtooth', notes: [880, 587], noteMs: 110, gain: 0.12, slide: 0.7, noise: 0.1 },
    tikbalang: { wave: 'square', notes: [330, 247, 330, 196], noteMs: 50, gain: 0.14, slide: 0.9, noise: 0.1 },
    // Bosses: mahaba at mababa
    kapre: { wave: 'sawtooth', notes: [110, 82, 55], noteMs: 220, gain: 0.3, slide: 0.8, noise: 0.35 },
    mangkukulam: { wave: 'triangle', notes: [440, 415, 392, 370, 349], noteMs: 120, gain: 0.3, slide: 1, noise: 0.1 },
    bakunawa: { wave: 'sawtooth', notes: [147, 98, 73], noteMs: 300, gain: 0.3, slide: 0.6, noise: 0.5 },
  } satisfies Record<UnitKind, SpawnSound>,
} as const;
