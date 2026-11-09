import type { BridgeMessage } from './events.js';

// Mahigit 220 makatotohanang TikTok usernames ng mga Pinoy viewers
const REALISTIC_USERS = [
  // 1. Real name + number combos
  'mark_reyes08', 'kristine.joy21', 'angelo_perez99', 'bianca_mae14', 'johnpaul_23',
  'jessicacastro_05', 'christian_dave17', 'nicole_santos88', 'joshua_garcia01', 'patricia_reyes',
  'miguel_torres22', 'samuel_bautista', 'bea_ramos09', 'gerald_aquino', 'erika_mendoza94',
  'ralph_gonzales', 'chloe_dizon', 'justin_villanueva', 'clarisse_lee', 'alexander_cruz88',
  'andrea_b2002', 'francine_d04', 'donny_p98', 'belle_m02', 'seth_f01',
  'darren_e01', 'kyle_alexander', 'princess_joyce', 'dave_plays', 'althea_07',

  // 2. Pinoy handles & nicknames
  'kuya_mark08', 'ate_regine_ph', 'totoy_mola_ph', 'tisoy_manila', 'inday_maganda',
  'lodi_petmalu', 'chinito_boy02', 'chinita_girl', 'boss_madam_01', 'kuya_jobert_tv',
  'marites_gaming', 'cardo_live', 'pinoy_gamer23', 'akosijuan_ph', 'queen_ria99',
  'batang_quiapo', 'baryo_fanatic', 'cj_official', 'akosidarna', 'charlie_ph',
  'boss_keng_fan', 'team_payaman_supporter', 'congtv_solid', 'pambansang_kolokoy_fan', 'kuya_kim_fanatic',

  // 3. Gamer handles
  'pinoy_slayer99', 'baryo_warrior', 'mobile_legend_idol', 'kalye_fighter', 'charlie_plays',
  'alden_gaming', 'tito_gamer_ph', 'sniper_pinoy', 'shadow_tanod', 'legendary_aswang',
  'bayani_core', 'clash_master_ph', 'pro_gamer_cebu', 'davao_striker', 'manila_sniper',
  'taguig_brawler', 'cavite_reps', 'bulacan_savage', 'pampanga_pro', 'laguna_knight',
  'tanod_commander', 'tagapagtanggol_01', 'aswang_slayer_ph', 'panday_legacy', 'darna_ng_baryo',

  // 4. Typical TikTok auto-generated user handles
  'user773910283', 'user198273641', 'user554910284', 'user882019482', 'user301928471',
  'user661029384', 'user449102837', 'user229183749', 'user910283746', 'user102938475',
  'user583920194', 'user748392019', 'user839201948', 'user920192837', 'user103948572',
  'user492019384', 'user602938471', 'user701928374', 'user802938475', 'user903948572',
  'user391048172', 'user992817402', 'user112039485', 'user883920194', 'user774839201',
  'user559201948', 'user332910485', 'user448291039', 'user662910485', 'user221940583',

  // 5. Aesthetic & lifestyle handles
  'aesthetic_vibes_ph', 'sunset_chaser01', 'coffee_lover_cebu', 'rainy_days_ph', 'wanderer_pinoy',
  'travel_luzon', 'foodie_manila', 'street_style_qc', 'chill_beats_ph', 'midnight_drive_ph',
  'starlight_sky99', 'neon_city_mnl', 'golden_hour_ph', 'island_vibes_boracay', 'siargao_surfer_boy',
  'elyu_local08', 'baguio_breeze', 'tagaytay_cool', 'batanes_dreamer', 'palawan_diver',

  // 6. Humor & meme tags
  'otits_gaming', 'etneb_boy', 'chismosa_chronicles', 'tambay_sa_kanto', 'walang_tulog_squad',
  'puyat_gamer_club', 'kape_muna_bago_aswang', 'buntong_hininga_tv', 'sana_all_gamer', 'charot_lang_po',
  'waley_benta', 'gutom_gaming', 'siopao_lover', 'isaw_connoisseur', 'kwek_kwek_master',
  'taho_vendor_ph', 'balut_slayer', 'pandesal_warrior', 'lugaw_is_essential', 'pares_overload_tv',

  // 7. Pop culture & fandoms
  'anime_fan_pinoy', 'luffy_gear5_ph', 'goku_pinoy', 'zoro_lost_in_manila', 'naruto_dattebayo_ph',
  'demon_slayer_tanod', 'gojo_satoru_fan_ph', 'solo_leveling_manila', 'itadori_baryo', 'sukuna_finger_heart',
  'levi_ackerman_qc', 'eren_yeager_cebu', 'chopper_cute_ph', 'kakashi_sensei_ph', 'gohan_beast_ph',
  'vegeta_pride_ph', 'deku_hero_ph', 'zenitsu_lightning', 'nezuko_chan_ph', 'bini_bloom_solid',
  'sb19_atin_forever', 'bgyo_ace_ph', 'alden_richards_club', 'mainemendoza_fp', 'dingdong_dantes_fan',

  // 8. Regional handles
  'batangas_rider', 'cebuano_gamer', 'ilocano_pride', 'davao_boy', 'cavite_local',
  'bulacan_rider', 'pampanga_chef', 'laguna_boy99', 'manila_drift', 'rizal_adventurer',
  'zamboanga_pride', 'cagayan_de_oro_boy', 'iloilo_gamer', 'bacolod_sugar_boy', 'tacloban_hero',
  'legazpi_mayon_fan', 'naga_warrior', 'laoag_drifter', 'vigan_heritage', 'bataan_patriot',

  // 9. Short casual handles
  'ken_09', 'dan_ph', 'ria_22', 'ian_k', 'migz_01',
  'gab_99', 'pao_tv', 'migs_d', 'josh_r', 'matt_b',
  'kiko_07', 'renz_14', 'nikko_88', 'bryan_m', 'kurt_03',
  'ced_21', 'drei_ph', 'lance_9', 'von_11', 'kiel_05'
];

// Shuffled deck: sinisigurong umiikot ang 220+ usernames bago mag-ulit
let userDeck: string[] = [];

function getNextUser(): string {
  if (userDeck.length === 0) {
    // Fisher-Yates shuffle para random ang pagkakasunod-sunod
    userDeck = [...REALISTIC_USERS];
    for (let i = userDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [userDeck[i], userDeck[j]] = [userDeck[j]!, userDeck[i]!];
    }
  }
  return userDeck.pop()!;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 1. Likes (nagdadagdag ng EXP para sa Tanod, pabor sa Bayani)
function generateLike(): BridgeMessage {
  const user = getNextUser();
  const count = randInt(2, 6);
  console.log(`[MOCK LIKE] ❤️  ${user} sent ${count} likes`);
  return { type: 'like', user, count, mock: true };
}

// 2. Chat commands (60% pabor kay Bayani para laging may Tanod na nagtatanggol)
function generateChat(): BridgeMessage {
  const user = getNextUser();
  const isHero = Math.random() < 0.60;
  const msg = isHero ? (Math.random() < 0.5 ? '!tanod' : 'tanod') : (Math.random() < 0.5 ? '!aswang' : 'aswang');
  console.log(`[MOCK CHAT] 💬  ${user}: ${msg}`);
  return { type: 'chat', user, msg, mock: true };
}

// 3. Small gifts (Rose para sa Tanod o GG para sa Aswang, 1 unit lang)
function generateSmallGift(): BridgeMessage {
  const user = getNextUser();
  const isHero = Math.random() < 0.65; // Pabor sa Bayani
  if (isHero) {
    const gifts = [
      { name: 'Rose', coins: 1, count: 1 },
      { name: 'Ice Cream Cone', coins: 1, count: 1 },
    ];
    const g = gifts[Math.floor(Math.random() * gifts.length)]!;
    console.log(`[MOCK GIFT] 🌹 [BAYANI] ${user} sent ${g.name} x1`);
    return { type: 'gift', user, gift: g.name, count: 1, coins: g.coins, mock: true };
  } else {
    const gifts = [
      { name: 'GG', coins: 1, count: 1 },
      { name: 'Heart Me', coins: 1, count: 1 },
    ];
    const g = gifts[Math.floor(Math.random() * gifts.length)]!;
    console.log(`[MOCK GIFT] 👹 [HALIMAW] ${user} sent ${g.name} x1`);
    return { type: 'gift', user, gift: g.name, count: 1, coins: g.coins, mock: true };
  }
}

function generateFollow(): BridgeMessage {
  const user = getNextUser();
  console.log(`[MOCK FOLLOW] ➕  ${user} followed (spawns Malupiton)!`);
  return { type: 'follow', user, mock: true };
}

export function getNextMockEvent(): BridgeMessage {
  const roll = Math.random();
  if (roll < 0.45) return generateChat();        // 45% chance: chat command
  if (roll < 0.78) return generateLike();        // 33% chance: likes
  if (roll < 0.94) return generateSmallGift();   // 16% chance: 1-coin gift
  return generateFollow();                       // 6% chance: follow
}

/**
 * Nagpapatakbo ng background simulator para tuloy-tuloy ang laban
 * gamit ang mahigit 220+ umiikot na Pinoy usernames at sure panalo ang Bayani.
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
