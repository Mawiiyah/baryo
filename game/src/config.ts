// LAHAT ng numbers ng laro ay dito. Walang magic numbers sa ibang file
// (maliban sa hugis ng placeholder models sa render/models.ts, na parang sprite data).
//
// Coordinates ng mundo (metro):
//   pos = layo mula sa Bahay Kubo papunta sa gubat (0 = kubo, lumalaki palayo sa camera)
//   lat = kaliwa/kanan sa lane (0 = gitna)
//   alt = taas (para sa lumilipad)

export type DefenderKind = 'tanod' | 'anito' | 'malupiton' | 'sarimanok' | 'higante' | 'haliya';
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
  halfWidth: 7.0, // lapad ng daan / 2 (pinalapad mula 4.8 para maluwag ang labanan)
  spawnPos: 32, // dito lumalabas ang halimaw (labas ng screen sa kanan)
  spawnLat: 1.6, // ± m mula sa gitna: sa gitna lang ng gate lumalabas ang halimaw
  baseHitPos: 3.2, // dito tumitigil at umaatake sa kubo ang halimaw (normal na laki)
  /** Malaking halimaw (hal. Kapre) ay tumitigil nang mas malayo para hindi bumaon sa kubo: + (size - ref) × pad. */
  baseSizeRef: 1.6,
  baseSizePad: 0.45,
  baseSpreadLat: 1.8, // kalat (± m) ng halimaw sa harap ng kubo habang inaatake ito
  baseCrowdSlack: 0.5, // gaano kalapit sa hitPos ang puwedeng pagtulak sa halimaw papunta sa kubo
  defenderSpawnPos: 3.0,
  frontLinePos: 7, // dito naghihintay ang defenders kapag walang kalaban
  healerBackOffset: 2.5, // gaano kalayo sa likod ng front line ang healer
  idleJitterPos: 3.5, // random na ± sa front line para hindi magpatong-patong
  flyHeight: 2.4,
  separation: 0.32, // min na layo ng dalawang unit = (size A + size B) × ito (para hindi magpatong)
  aggroRange: 5.5, // halimaw: lumalapit sa bayani na nasa loob nito (para kita ang laban)
  leash: 4.5, // bayani: hinahabol lang ang halimaw hanggang frontLinePos + ito
  rangeJitter: 0.45, // ranged units: tumitigil sa (1 - random×ito) ng range para nakakalat sila
  /**
   * Melee laban sa malaking kalaban: abot = max(range, (size A + size B) × separation + ito),
   * para maabot ng maliit na bayani ang dambuhala (hal. Tanod vs Kapre) kahit tinutulak siya pagilid.
   */
  meleeContactPad: 0.35,
  meleeReach: 1.4, // abot ng suntok; ranged na halimaw ay tumitigil nang (range - meleeReach) mas malayo sa kubo
  /**
   * Yabugan ng dalawang dambuhala (hal. Higante vs Kapre): nagkakaharap sila nang pahilis
   * (hindi magkapila sa iisang linya) para hindi matakpan ng isa ang isa mula sa camera.
   */
  duel: {
    minSize: 3, // parehong melee at ganito kalaki pataas = yabugan
    gap: 0.4, // layo ng magkalaban = (size A + size B) × ito (hindi nagsasapawan ang katawan)
    reachSlack: 1.2, // abot ng suntok = layo × ito
    angleDeg: 62, // anggulo mula sa daan; 90 = magkatabi pakaliwa/pakanan
    adjustSpeed: 0.5, // bahagi ng speed habang umaayos ng puwesto habang naglalaban
  },
} as const;

export const BASE = {
  name: 'Bahay Kubo',
  hp: 3000, // ipinapakita bilang % sa HUD
  /**
   * Tama sa kubo ng halimaw na pinalakas ng coins = normal na damage Ã— k^ito
   * (hindi buong âˆšk), para makunat ang kubo at may oras pang sumagot ang BAYANI.
   */
  damagePowerExp: 0.25,
} as const;

export const DEFENDERS: Record<DefenderKind, UnitStats> = {
  tanod: {
    name: 'Tanod', hp: 120, damage: 12, range: 1.4, cooldownMs: 800, speed: 2.6,
    size: 1.6, color: 0x2f6fd6, flying: false, canHitAir: true, heal: 0, ranged: false,
  },
  anito: {
    name: 'Anito', hp: 600, damage: 15, range: 1.8, cooldownMs: 700, speed: 2.0,
    size: 2.2, color: 0x8b5a2b, flying: false, canHitAir: true, heal: 0, ranged: false,
  },
  malupiton: {
    name: 'Malupiton (Aka Lapu)', hp: 160, damage: 18, range: 1.5, cooldownMs: 500, speed: 2.8,
    size: 1.6, color: 0xc41c1c, flying: false, canHitAir: true, heal: 0, ranged: false,
  },
  sarimanok: {
    name: 'Sarimanok', hp: 220, damage: 45, range: 12, cooldownMs: 1000, speed: 2.2,
    size: 1.9, color: 0x2440b8, flying: false, canHitAir: true, heal: 0, ranged: true,
  },
  higante: {
    name: 'Mabait na Higante', hp: 1600, damage: 52, range: 2.6, cooldownMs: 900, speed: 1.5,
    size: 4.2, color: 0x5b3e2b, flying: false, canHitAir: true, heal: 0, ranged: false, boss: true,
  },
  haliya: {
    name: 'Haliya', hp: 4400, damage: 65, range: 3.2, cooldownMs: 1100, speed: 2.2,
    size: 3.6, color: 0xe6c25e, flying: false, canHitAir: true, heal: 0, ranged: false, boss: true,
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
    name: 'Tikbalang', hp: 110, damage: 10, range: 1.6, cooldownMs: 420, speed: 3.6,
    size: 2.4, color: 0x6b4a32, flying: false, canHitAir: false, heal: 0, ranged: false,
  },
  kapre: {
    name: 'Kapre', hp: 1500, damage: 48, range: 2.6, cooldownMs: 900, speed: 1.4,
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
 * PATAS NA HALAGA: ang lakas (HP Ã— damage/s) ng unit galing sa gift ay ayon sa coins na binayad:
 *   lakas = refPower Ã— (coins / refCoins) ^ coinExponent
 * Mas mataas sa 1 ang exponent dahil sa laban, mas malakas ang maraming maliit kaysa iisang malaki
 * na may parehong kabuuang lakas (sabay-sabay silang tumatama). HP at damage ay Ã— âˆšk.
 * Libre (likes/follow/chat) = normal na lakas.
 */
export const BALANCE = {
  refCoins: 0.5, // 1 Rose = 2 Tanod â†’ 0.5 coin bawat Tanodâ€¦
  refPower: 1800, // â€¦na may normal na lakas (120 HP Ã— 15 dmg/s)
  coinExponent: 1.6, // na-calibrate: equal-coin na laban ay halos tabla
  rangedFactor: 2, // dagdag na halaga ng nakakatira mula sa malayo
  bossFactor: 1, // boss ability ay hiwalay na pinalalakas (Ã— âˆšk)
  /**
   * Dagdag na "halaga" ng karakter na hindi nasusukat ng HP Ã— damage (abilities, AoE, summon).
   * > 1 = mas mahina ang ibibigay kada coin; < 1 = mas malakas. Na-calibrate sa equal-coin na laban.
   */
  valueFactor: { mangkukulam: 2.5, bakunawa: 2, kapre: 0.5, higante: 0.5, haliya: 2 } as Partial<Record<UnitKind, number>>,
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

/** Gift name (gaya ng galing sa TikTok) → anong BAYANI, ilan kada gift, at halaga (1-30 coins). */
export const GIFTS: Record<string, GiftValue<DefenderKind>> = {
  Rose: { unit: 'tanod', perGift: 2, coins: 1 },
  TikTok: { unit: 'tanod', perGift: 3, coins: 1 },
  Fire: { unit: 'malupiton', perGift: 1, coins: 1 },
  'Ice Cream Cone': { unit: 'malupiton', perGift: 1, coins: 1 },
  'Finger Heart': { unit: 'anito', perGift: 1, coins: 5 },
  'I love you': { unit: 'sarimanok', perGift: 1, coins: 10 },
  Dolphin: { unit: 'sarimanok', perGift: 1, coins: 10 },
  'Bravo!': { unit: 'higante', perGift: 1, coins: 15 },
  'G.O.A.T. Busker': { unit: 'higante', perGift: 1, coins: 20 },
  Doughnut: { unit: 'haliya', perGift: 1, coins: 30 },
};

/**
 * Gift na wala sa GIFTS/VILLAIN_GIFTS → BAYANI ayon sa halaga (unang tier na `coins >= min`).
 * Mas mahal na gift = mas malakas o mas maraming bayani (1-30 coins).
 */
export const GIFT_TIERS: { min: number; unit: DefenderKind; perGift: number }[] = [
  { min: 30, unit: 'haliya', perGift: 1 },
  { min: 15, unit: 'higante', perGift: 1 },
  { min: 10, unit: 'sarimanok', perGift: 1 },
  { min: 5, unit: 'anito', perGift: 1 },
  { min: 2, unit: 'malupiton', perGift: 1 },
  { min: 1, unit: 'tanod', perGift: 2 },
  { min: 0, unit: 'tanod', perGift: 1 },
];
export const GIFT_MAX_SPAWNS_PER_EVENT = 10; // cap kahit malaking streak

export const FOLLOW = { unit: 'malupiton' as DefenderKind, count: 1 };

/**
 * VERSUS: mga gift na nagpapalabas ng HALIMAW (laban sa baryo), para maglaban ang viewers.
 * Uunahin ito bago ang GIFTS. 1 hanggang 30 coins.
 */
export const VILLAIN_GIFTS: Record<string, GiftValue<AttackerKind>> = {
  GG: { unit: 'aswang', perGift: 2, coins: 1 },
  'You\'re awesome': { unit: 'aswang', perGift: 2, coins: 1 },
  'Heart Me': { unit: 'manananggal', perGift: 1, coins: 1 },
  'Love you so much': { unit: 'manananggal', perGift: 1, coins: 1 },
  Overreact: { unit: 'tikbalang', perGift: 2, coins: 5 },
  Panda: { unit: 'tikbalang', perGift: 2, coins: 5 },
  Rosa: { unit: 'mangkukulam', perGift: 1, coins: 10 },
  'Kudos for My Star': { unit: 'kapre', perGift: 1, coins: 15 },
  'No Comment': { unit: 'kapre', perGift: 1, coins: 20 },
  Perfume: { unit: 'kapre', perGift: 1, coins: 20 },
  'Gold Boxing Gloves': { unit: 'kapre', perGift: 1, coins: 10 },
  Capybara: { unit: 'bakunawa', perGift: 1, coins: 30 },
  'KO!': { unit: 'bakunawa', perGift: 1, coins: 100 },
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
  kapre: { intro: 'Ang higante ng puno ng balete!', slam: { everyMs: 3800, radius: 3.5, damage: 35 } },
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
  /**
   * 360° na camera (render/CameraOrbit.ts): i-drag ang mouse para umikot sa paligid ng laban,
   * scroll para mag-zoom, `resetKey` o double-click para bumalik sa default, `autoKey` = kusang ikot.
   */
  orbit: {
    dragSpeed: 0.006, // rad kada pixel ng drag
    minPolar: 0.15, // rad mula sa itaas (halos tanaw mula sa langit)
    maxPolar: 1.42, // rad (halos kapantay ng lupa)
    zoomSpeed: 0.0012, // kada wheel delta (multiplicative)
    minDistScale: 0.45, // × default na layo
    maxDistScale: 1.6,
    ease: 8, // bilis ng pagsunod sa target (mas mataas = mas mabilis)
    autoSpeed: 0.18, // rad/s kapag naka-auto na ikot
    resetKey: 'V',
    autoKey: 'O',
    focusLerp: 2.5, // bilis ng pagsunod ng camera sa gitna ng laban
    focusHeight: 1.2, // m: taas ng tinitingnan sa gitna ng laban
    idleDelayMs: 2500, // ganito katagal na walang unit bago magsimulang umikot sa mapa (idleSpin)
    idleRadius: 1.15, // × default na layo habang umiikot sa mapa
    idlePhi: 0.85, // rad mula sa itaas habang umiikot sa mapa
    idleSpeed: 0.12, // rad/s na ikot sa mapa
  },
  views: {
    behind: {
      fov: 46,
      cameraPos: { x: 0, y: 21, z: -12.5 },
      cameraLookAt: { x: 0, y: 0, z: 12 }, // mataas na POV: kita ang buong malapad na daan
      moonPos: { x: -20, y: 18, z: 75 },
      moonLightPos: { x: -10, y: 22, z: 30 },
      kuboScale: 0.85,
    },
    side: {
      fov: 38,
      cameraPos: { x: -22, y: 11, z: 10.5 },
      cameraLookAt: { x: 0, y: 4, z: 10.5 }, // mataas ang tinitingnan â†’ nasa ibaba ng screen ang daan
      moonPos: { x: 70, y: 30, z: 26 },
      moonLightPos: { x: -14, y: 24, z: 4 },
      kuboScale: 0.9,
    },
  },
  /**
   * Battlefield:
   * 'barangay' = bagong mapa (kalsada, basketball court, Barangay Hall gate, jeepney base, sari-sari store, banderitas)
   * 'templo' = isla na may sinaunang templo (batay sa assets/reference/battlefield_templo.png)
   * 'baryo' = luma (daang lupa, bakod na kawayan, gubat)
   * 'baha' = bahang barangay (ulan, kidlat, rescue boat, mga taong nasa bubong; batay sa assets/reference/battlefield_baha.png)
   */
  battlefield: 'barangay' as 'barangay' | 'templo' | 'baryo' | 'baha',
  barangay: {
    camera: { fov: 52, cameraPos: { x: 0, y: 22, z: -13 }, cameraLookAt: { x: 0, y: 0, z: 15 } },
    roadColor: '#41424f',
    roadGrout: '#30313c',
    curbColor: 0xd8d6cb,
    curbStripeColor: 0x3b3a40,
    lineColor: '#eab32a',
    roadPxPerM: 14,
    textPos: 8.5,
    courtPos: 16.5,
    gatePos: 30,
    brazierPos: [4.5, 13.5, 24],
    bannerPos: 20,
    bayaniBanner: 0x1c5bbd,
    halimawBanner: 0xb82424,
    flameColor: 0xff7522,
    headlightColor: 0xffefb8,
    windowColor: 0xffa434,
    trunkColor: 0x3a2618,
    palmColor: 0x182c16,
    palmCount: 16,
    grassTufts: 350,
    grassColor: 0x223a1a,
    groundColor: 0x24351e,
    bannerSway: 0.1,
  },
  /** 'baha': ang 'barangay' na mapa na binaha (gumagamit din ng `barangay` settings sa itaas). */
  baha: {
    waterLevel: 2.1, // taas ng baha (metro): hanggang kalahati ng Bahay Kubo (lubog ang mga bahay, tindahan, sasakyan)
    unitWade: 0.5, // gaano kalalim nakalubog ang units sa tubig (metro); lumalakad sila sa ibabaw ng baha
    waterColor: 0x6a5434, // maputik na tubig-baha
    waterOpacity: 0.93, // malalim na: halos hindi na aninag ang kalsada sa ilalim
    waterFlow: 0.03, // bilis ng agos ng texture (kada segundo)
    waterSize: 90, // lapad/haba ng tubig (metro)
    rainCount: 1800,
    rainArea: { halfX: 26, zMin: -10, zMax: 40, top: 16 },
    rainSpeed: 22, // metro kada segundo
    rainLength: 0.55,
    rainColor: 0x9aa8c0,
    rainOpacity: 0.45,
    rainWind: 0.18, // pahilig ng ulan (x kada y)
    rippleCount: 40, // mga bilog sa tubig kung saan bumabagsak ang ulan
    rippleLife: 0.7, // segundo
    rippleSize: 0.5,
    lightningMin: 6, // segundo sa pagitan ng kidlat
    lightningMax: 15,
    lightningColor: 0xc8d4ff,
    lightningIntensity: 6,
    lightningMs: 380,
    cloudCount: 14,
    cloudColor: 0x1e2230,
    skyTop: '#05070d', // madilim na langit ng bagyo
    skyMid: '#141a26',
    skyHorizon: '#2a3140',
    fogColor: 0x1a1f2a, // kulay-abong hamog ng ulan
    bobAmp: 0.05, // taas ng pag-alon ng lumulutang na bagay (metro)
    bobSpeed: 1.6,
    driftSpeed: 0.12, // gaano kabilis inaanod ang kalat (metro kada segundo)
    /** Dagdag na kalat na nakakalat nang random sa baha (bukod sa mga nakapuwestong kalat). */
    debris: {
      count: 90, // isa-isang kalat (gulong, karton, plastik, yero, sanga, styro, galon, water lily…)
      clusters: 16, // bunton ng basura (maliliit na plastik at balot na magkakadikit)
      perCluster: [6, 11] as [number, number],
      clusterRadius: 1.4, // m
      areaX: 17, // ± m mula sa gitna
      zMin: -2,
      zMax: 31,
      kuboClear: { halfX: 4, zMax: 3.5 }, // walang kalat sa mismong harap ng kubo
      laneKeep: 0.55, // bahagi ng kalat na pinapayagan sa daan (para hindi matakpan ang labanan)
    },
    /** Alon sa ibabaw ng baha: suma ng mga sine wave (dirX/dirZ = direksyon, len = haba ng alon sa metro, amp = taas). */
    waterRoughness: 0.7,
    waveCrestBoost: 2.2, // gaano kaliwanag ang tuktok ng alon (× waterColor)
    waveTroughShade: 0.45, // liwanag ng lambak ng alon (× waterColor)
    waveCrestBlue: 1.08, // bahagyang mala-bula na tint sa tuktok
    waveSegments: 90, // dami ng hati ng tubig (mas marami = mas makinis na alon)
    waves: [
      { dirX: 0.3, dirZ: -1, len: 7, speed: 1.4, amp: 0.18 }, // pangunahing alon, papunta sa kubo
      { dirX: -0.8, dirZ: -0.6, len: 4.5, speed: 1.9, amp: 0.07 },
      { dirX: 1, dirZ: 0.2, len: 2.6, speed: 2.6, amp: 0.035 }, // maliliit na kulot
    ],
    /** Talsik ng tubig habang naglalaban (sa 'baha' lang). */
    splash: {
      drops: 12, // patak kada tama (× laki ng unit)
      dropsSlam: 40, // patak sa slam/pagbagsak ng dambuhala
      dropsStep: 4, // patak sa paa ng umaatake
      dropSize: 0.1,
      speed: 3.2, // m/s palabas
      up: [2.5, 5], // m/s pataas (min, max)
      gravity: 16,
      ms: 650,
      colors: [0xb8a888, 0xd8d0bc, 0x8c7a5a], // maputik na tubig at bula
      ringColor: 0xe0d8c4, // bilog ng bula sa tubig
      ringSize: 1.1, // m (× laki ng unit)
      ringMs: 600,
      max: 260, // limit ng patak sa eksena
    },
  },
  templo: {
    // camera para sa 'behind' (mas nakatingala nang kaunti para kita ang templo sa dulo)
    camera: { fov: 48, cameraPos: { x: 0, y: 19, z: -12 }, cameraLookAt: { x: 0, y: 0, z: 13 } },
    island: { rx: 18.5, rz: 28, cz: 13, depth: 2.4, roundness: 2.6 }, // superellipse na hugis ng isla (metro)
    waterLevel: 1.9, // gaano kababa ang tubig sa ilalim ng damo
    waterColor: 0x091b2c, // madilim at malalim na tubig
    waterGlow: 0x030b14,
    foamColor: 0x4a6a7c, // maputlang bula sa dalampasigan
    sandColor: 0x756852, // basang buhangin
    grassColors: ['#1d381c', '#244222', '#183017', '#2a4c26'], // madilim na damo
    cliffColors: [0x3a3c42, 0x484a52, 0x303238], // madilim na bangin
    laneStones: ['#565048', '#5e574f', '#4e4840', '#645d54', '#464038'], // lumang batong daanan
    laneGrout: '#2e2a24',
    laneLine: '#9c7328', // kupas na gintong guhit
    lanePxPerM: 12, // resolution ng texture ng daan
    emblemPos: 15, // pos ng korona sa gitna ng daan
    gatePos: 30, // pos ng templo; nasa likod nito (LANE.spawnPos) lumalabas ang halimaw
    brazierPos: [5, 13.5, 25], // pos ng mga sulong bato (magkabilang gilid)
    bannerPos: 19.5,
    bayaniBanner: 0x223fa8, // madilim na asul
    halimawBanner: 0x981818, // dugong pula
    gazebos: [[11, 20], [12.5, 6.5]] as [number, number][], // [|x|, pos] ng mga pahingahan (magkabila)
    palmCount: 16,
    palmColor: 0x182c16,
    trunkColor: 0x3e2c1e,
    bushCount: 70,
    bushColors: [0x162c14, 0x1e3618, 0x122410, 0x243e1c],
    grassTufts: 500,
    grassColor: 0x28461e,
    bannerSway: 0.08, // rad
    flameColor: 0xff9030,
  },
  unitScale: 1.0, // visual na laki ng units (hindi apektado ang gameplay)
  pixelScale: 1, // 1 = buong resolution, makinis (may antialias); 2-3 = ire-render sa (1920/n)x(1080/n) tapos palalakihin nang pixelated
  skyTop: '#02020a', // madilim na langit ng hatinggabi
  skyMid: '#130c2a', // katakut-takot na purpura/itim
  skyHorizon: '#33183a', // malabong mapanganib na abot-tanaw
  fogColor: 0x1c1034, // maitim at nakakatakot na hamog
  fogNear: 40, // mas malapit para may misteryosong hamog sa daan
  fogFar: 120, // nababalot sa hamog ang sinaunang templo at gubat
  hemiSky: 0x8a92d0, // malamig na liwanag mula sa langit
  hemiGround: 0x2a2a3c,
  hemiIntensity: 2.4, // mas madilim at nakakatakot
  exposure: 1.45,
  moonLight: 0x8ea0c8, // maputlang liwanag ng buwan
  moonIntensity: 2.1,
  shadowMapSize: 2048,
  shadowArea: 28, // kalahating lapad ng shadow camera
  moonRadius: 3.2,
  moonColor: 0xeae0cc, // maputlang buwan
  moonGlowColor: 0x908cac,
  moonGlowScale: 16,
  /**
   * Buwan at ulap (effects/moon_clouds.png): nakapirmi sa isang puwesto sa mundo (sa itaas ng malayong dulo
   * ng mapa, ayon sa default na camera). Hindi sumasama sa galaw ng camera.
   */
  skyMoon: {
    ndcX: 0, // puwesto sa screen (−1..1) sa default na camera
    ndcY: 0.855, // malapit sa itaas ng screen
    dist: 110, // m mula sa default na camera (dapat < camera far kahit naka-ikot/zoom out)
    widthFrac: 0.43, // lapad bilang bahagi ng lapad ng screen
    floatAmp: 0.6, // m na dahan-dahang paglutang
    floatSpeed: 0.9, // rad/s
    renderOrder: 10, // mataas = iginuguhit sa ibabaw ng mga gusali
  },
  bloodMoonColor: 0xff3a24, // kulay ng buwan habang buhay ang Bakunawa
  bloodMoonLerp: 1.5, // bilis ng pagpalit ng kulay (kada segundo)
  bloodMoonRecoverLerp: 9, // bilis ng balik sa dating kulay pagkamatay ng Bakunawa (~0.3 s)
  bloodFog: 0x360b18, // hamog habang buhay ang Bakunawa
  bloodSky: 0xd9442e, // ilaw mula sa langit habang buhay ang Bakunawa
  starCount: 500,
  starRadius: 80,
  starSize: 0.35,
  groundColor: 0x182414,
  grassColor: 0x243e1c,
  pathColor: 0x3c2c1c,
  pathEdgeColor: 0x2c1e12,
  grassTufts: 700,
  grassArea: 28, // kalahating lapad ng damuhan
  fenceColor: 0x6a5430,
  fenceSpacing: 2.2,
  fenceOffset: 0.6, // layo ng bakod sa gilid ng daan
  torchSpacing: 9,
  torchColor: 0xff9030,
  torchIntensity: 10,
  torchDistance: 11,
  torchFlicker: 0.3,
  palmCount: 14,
  palmColor: 0x121c10,
  trunkColor: 0x322418,
  hutColor: 0x8a6a42,
  roofColor: 0x543e22,
  forestColor: 0x040705,
  kuboPos: 0, // pos ng Bahay Kubo
  kuboHpHeight: 6.2, // m: taas ng HP bar ng kubo (nasa ibabaw ng bubong)
  kuboWindowColor: 0xffa040,
  kuboLight: 0xff9a38,
  kuboLightIntensity: 16, // mainit na liwanag na pugad sa gitna ng kadiliman
  /** Base na Bahay Kubo (pinatibay): pundasyon, bakod na kawayan, sulo, kalasag, watawat, pananggalang. */
  kuboFort: {
    stoneColor: 0x6d6a63,
    stoneTopColor: 0x8a867c,
    stakeColor: 0x9c7a3e,
    railColor: 0x6e5230,
    shieldColor: 0x7a2e1c,
    shieldTrim: 0xe8c25a,
    flagColor: 0x5fd12e,
    emblemColor: 0xffc93a,
    wardColor: 0xffc24a,
    wardOpacity: 0.35,
    wardPulse: 0.15, // ± opacity habang pumipintig
    wardSpeed: 1.6,
    flagSway: 0.25, // rad
  },
  kuboShakeMs: 220,
  kuboShakeAmount: 0.12,
  kuboShakeCooldownMs: 350,
  ambientMistCount: 8,
  ambientMistColor: 0x140e22,
  ambientMistOpacity: 0.28,
  vignette: 0.55, // dilim sa mga gilid ng screen (0 = wala); purple-black na kulay
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
  // Combat slashes, claws, and clash special effects (para mukang nag-aaway)
  slashMs: 200,
  slashColors: {
    tanod: 0x64b5f6, // asul/puting swing ng batuta
    anito: 0xffb74d, // ginintuang bagsak ng anito
    sarimanok: 0xffd54f, // engkantadong kislap
    malupiton: 0xff3232, // pulang kumpas ng kambal na talim
    higante: 0xffb74d, // malakas na bagsak ng higante / troso
    haliya: 0xd8f8ff, // nagliliwanag na crescent moonlight slash
    aswang: 0xff2a2a, // pulang kaskas ng kuko
    manananggal: 0xd05ce3, // purpurang kuko at pakpak
    tikbalang: 0xffa726, // mabibilis na sipa at hampas
    kapre: 0xffb300, // dambuhalang hampas
    mangkukulam: 0xba68c8, // itim at purpurang sumpa
    bakunawa: 0x26c6da, // kagat ng dambuhalang dragon
  } as Record<UnitKind, number>,
  clashSparks: 10,
  staggerMs: 120,
  staggerAmount: 0.04, // banayad na flinch lang, hindi tinutulak paatras para tuloy ang laban
  duel: { lunge: 1.1, stagger: 0.32, twist: 0.35, lift: 0.25 }, // yabugan ng dambuhala (LANE.duel): malalaking suntok at uga
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
  // Eerie enemy spawn fog at battlefield darkness effects
  enemySpawnFogMs: 1500,
  enemySpawnFogCount: 14,
  enemySpawnFogSize: 2.2,
  enemySpawnFogColor: 0x160f24,
  enemySpawnRingColor: 0x221038,
  bossSpawnFogCount: 32,
  bossSpawnFogSize: 3.8,
  bossSpawnRingRadius: 6.0,
  fogPulseMinNear: 6, // pansamantalang bababa ang fogNear kapag may lumabas na halimaw
  fogPulseBossNear: 2.5, // mas malapit kapag boss ang lumabas
  fogPulseRecoverSpeed: 7, // metro kada segundo na pagbalik ng hamog
  darkenPulseIntensity: 0.35, // bawas sa liwanag habang lumalabas ang halimaw
  darkenPulseBossIntensity: 0.65, // matinding pagdilim kapag boss
  darkenPulseMs: 1200,
} as const;

/** HUD (HTML/CSS overlay). Mga pixel ay sa 1080x1920 logical. */
export const HUD = {
  // Lugar na tinatakpan ng TikTok UI (itaas: host/viewers, ibaba: comments)
  safeTop: 24,
  safeBottom: 24,
  sidePad: 16,
  columnWidth: 210, // pinalaki mula 150 para kitang-kita sa mobile
  toastMax: 3,
  toastMs: 5000,
  bannerMs: 2200,
  hpWarn: 0.5,
  hpDanger: 0.25,
  font: '"Silkscreen", monospace',
  portraitPx: 54, // pinalaki para sa mas malinaw na portraits sa mobile
  iconPx: 24, // default emoji size
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
    Fire: '🔥',
    'Ice Cream Cone': '🍦',
    'Finger Heart': '🫰',
    'I love you': '💖',
    Dolphin: '🐬',
    'Bravo!': '👏',
    'G.O.A.T. Busker': '🐐',
    Doughnut: '🍩',
    GG: '🎮',
    'Heart Me': '💗',
    'You\'re awesome': '🐱',
    'Love you so much': '🥰',
    Overreact: '🤪',
    Panda: '🐼',
    Rosa: '🌺',
    'Kudos for My Star': '🎻',
    'No Comment': '🥒',
    Perfume: '🧴',
    'Gold Boxing Gloves': '🥊',
    Capybara: '🦫',
    'KO!': '💥',
  } as Record<string, string>,
} as const;

export const NET = {
  reconnectMinMs: 1000,
  reconnectMaxMs: 10000,
} as const;

/** Debug keys → event (dumadaan pa rin sa handleEvent). */
export const DEBUG_KEYS = {
  // '1' = sapat na likes para sa isang Tanod
  '1': { type: 'like', user: '', count: SPAWN.likesPerTanod },
  L: { type: 'like', user: '', count: 10 },
  R: { type: 'gift', user: '', gift: 'Rose', count: 1 },
  I: { type: 'gift', user: '', gift: 'Fire', count: 1 },
  A: { type: 'gift', user: '', gift: 'Finger Heart', count: 1 },
  D: { type: 'gift', user: '', gift: 'I love you', count: 1 },
  J: { type: 'gift', user: '', gift: 'Bravo!', count: 1 },
  Y: { type: 'gift', user: '', gift: 'Doughnut', count: 1 },
  F: { type: 'follow', user: '' },
  T: { type: 'chat', user: '', msg: '!tanod' },
  // HALIMAW (versus, 1-30 coins)
  G: { type: 'gift', user: '', gift: 'GG', count: 1 },
  H: { type: 'gift', user: '', gift: 'Heart Me', count: 1 },
  P: { type: 'gift', user: '', gift: 'Overreact', count: 1 },
  C: { type: 'gift', user: '', gift: 'Rosa', count: 1 },
  K: { type: 'gift', user: '', gift: 'Kudos for My Star', count: 1 },
  B: { type: 'gift', user: '', gift: 'Capybara', count: 1 },
  X: { type: 'chat', user: '', msg: '!aswang' },
} as const;

/** Para sa testing: ?debug&round=N → N segundo lang ang round. */
/**
 * Button na pampili ng battlefield (laging nandiyan, sa labas ng #stage). Nakatago hanggang
 * gumalaw ang mouse, kaya malinis sa OBS. Naaalala ang pinili (localStorage); mas nauuna ang `?map=`.
 */
/**
 * "🎥 CAMERA" button (ui/CamPicker.ts, kanang-ibaba; auto-hide gaya ng MAPA).
 * `follow` = sinusundan ang gitna ng laban; `radius` = × default na layo; `phi` = anggulo mula sa itaas
 * (null = gaya ng default); `turn` = ikot mula sa default (rad); `drag` = puwedeng i-drag/zoom; `spin` = kusang ikot;
 * `idleSpin` = kapag walang unit (walang nagpapadala), iikot sa buong mapa; pagdating ng units, tutok ulit sa laban.
 */
export const CAM_PICKER = {
  modes: [
    { id: 'default', label: '🏠 Normal', desc: 'Likod ng kubo (default)', follow: false, radius: 1, phi: null, turn: 0, drag: false, spin: false, idleSpin: false },
    { id: 'free', label: '🖱️ Free Cam', desc: 'I-drag para umikot, scroll = zoom', follow: false, radius: 1, phi: null, turn: 0, drag: true, spin: false, idleSpin: false },
    { id: 'laban', label: '⚔️ Sundan ang Laban', desc: 'Ikot sa mapa; tutok sa laban kapag may units', follow: true, radius: 0.5, phi: null, turn: 0, drag: true, spin: false, idleSpin: true },
    { id: 'gilid', label: '👀 Gilid ng Laban', desc: 'Tagilid na tanaw sa bakbakan', follow: true, radius: 0.55, phi: 1.1, turn: Math.PI / 2, drag: true, spin: false, idleSpin: false },
    { id: 'itaas', label: '🦅 Mula sa Itaas', desc: 'Tanaw mula sa langit', follow: true, radius: 0.7, phi: 0.2, turn: 0, drag: true, spin: false, idleSpin: false },
    { id: 'ikot', label: '🔄 Ikot sa Laban', desc: 'Kusang umiikot sa bakbakan', follow: true, radius: 0.6, phi: 0.9, turn: 0, drag: true, spin: true, idleSpin: false },
  ] as const,
  defaultMode: 'default' as const,
  autoHideMs: 2500,
  storageKey: 'laban-baryo.cam',
};

export const MAP_PICKER = {
  maps: [
    { id: 'barangay', label: '🏘️ Barangay', desc: 'Kalsada, court, jeepney' },
    { id: 'templo', label: '🏛️ Templo', desc: 'Isla, daang bato' },
    { id: 'baryo', label: '🌾 Baryo', desc: 'Daang lupa, kawayan' },
    { id: 'baha', label: '🌧️ Baha', desc: 'Binahang barangay, bagyo' },
  ] as { id: typeof SCENE3D.battlefield; label: string; desc: string }[],
  autoHideMs: 2500, // itatago ang button pagkalipas nito kapag hindi gumagalaw ang mouse
  storageKey: 'laban-baryo.map',
};

export const DEBUG_ROUND_LINKS = [30, 60] as const;

/** Clickable test buttons (lalabas lang sa URL na may ?debug). Dumadaan pa rin sa handleEvent. */
export const DEBUG_PANEL = {
  users: ['Juan', 'Maria', 'Pedro', 'Ana', 'Jose', 'Liza'], // random na pangalan para iba-iba
  buttons: [
    { label: '❤️ 30 likes → Tanod', event: { type: 'like', count: SPAWN.likesPerTanod } },
    { label: '🌹 Rose (1c) → 2 Tanod', event: { type: 'gift', gift: 'Rose', count: 1 } },
    { label: '🔥 Fire (1c) → Malupiton', event: { type: 'gift', gift: 'Fire', count: 1 } },
    { label: '🫰 Finger Heart (5c) → Anito', event: { type: 'gift', gift: 'Finger Heart', count: 1 } },
    { label: '💖 I love you (10c) → Sarimanok', event: { type: 'gift', gift: 'I love you', count: 1 } },
    { label: '👏 Bravo (15c) → Higante', event: { type: 'gift', gift: 'Bravo!', count: 1 } },
    { label: '🍩 Doughnut (30c) → Haliya', event: { type: 'gift', gift: 'Doughnut', count: 1 } },
    { label: '➕ Follow → Malupiton', event: { type: 'follow' } },
    { label: '💬 !tanod', event: { type: 'chat', msg: '!tanod' } },
  ],
  // Panig ng HALIMAW (versus, 1-30 coins)
  villainButtons: [
    { label: '[G] 🎮 GG (1c) → 2 Aswang', event: { type: 'gift', gift: 'GG', count: 1 } },
    { label: '[H] 💗 Heart Me (1c) → Manananggal', event: { type: 'gift', gift: 'Heart Me', count: 1 } },
    { label: '[P] 🤪 Overreact (5c) → 2 Tikbalang', event: { type: 'gift', gift: 'Overreact', count: 1 } },
    { label: '[C] 🌺 Rosa (10c) → Mangkukulam', event: { type: 'gift', gift: 'Rosa', count: 1 } },
    { label: '[K] 🎻 Kudos (15c) → Kapre', event: { type: 'gift', gift: 'Kudos for My Star', count: 1 } },
    { label: '[B] 🦫 Capybara (30c) → Bakunawa', event: { type: 'gift', gift: 'Capybara', count: 1 } },
    { label: '[X] 💬 !aswang', event: { type: 'chat', msg: '!aswang' } },
  ],
} as const;


/**
 * Tunog (Web Audio, synthesized; walang audio files). Isang maikling "jingle" kada spawn.
 * notes = Hz ng bawat nota (sunod-sunod), noteMs = haba ng bawat isa, wave = OscillatorType,
 * slide = pag-glide ng pitch sa dulo ng nota (Ã—), noise = halo ng ingay (0..1, pang-ungol/apoy).
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
    malupiton: { wave: 'sawtooth', notes: [440, 554, 659], noteMs: 70, gain: 0.28, slide: 1.1, noise: 0.08 },
    sarimanok: { wave: 'square', notes: [784, 988, 1175, 1568], noteMs: 70, gain: 0.18, slide: 1.06, noise: 0 },
    higante: { wave: 'triangle', notes: [130, 98, 165], noteMs: 160, gain: 0.35, slide: 1, noise: 0.2 },
    haliya: { wave: 'sine', notes: [523, 659, 784, 1047], noteMs: 100, gain: 0.32, slide: 1.05, noise: 0 },
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
