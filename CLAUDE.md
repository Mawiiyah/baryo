# Laban Baryo — TikTok LIVE interactive game

## Ano ito
3D (voxel, pixel-art) tower-defense na kinokontrol ng TikTok LIVE viewers (likes, gifts,
follows, chat). Pinoy Folklore theme. Versus: may gifts para sa BAYANI (`GIFTS`) at para sa HALIMAW
(`VILLAIN_GIFTS`, `VILLAIN_CHAT`), kaya naglalaban ang viewers. WALANG waves: viewers lang
ang nagpapadala ng halimaw. May oras ang round (`ROUND`): BAYANI panalo kapag buhay ang
kubo pagkaubos ng oras, HALIMAW kapag nawasak ito. May score kada round.

## Stack
- Language: TypeScript (strict) sa buong project
- game/: Vite + Three.js (3D na eksena) + HTML/CSS na HUD. PIXEL ART na istilo ang HUD; ang 3D ay nire-render sa `SCENE3D.pixelScale` (1 = buong resolution, makinis; 2-3 = mababang resolution, pixelated); font: @fontsource/silkscreen;
  emoji/gift icons/portraits ay dino-drawing sa maliit na canvas (ui/pixel.ts).
- bridge/: Node.js + tiktok-live-connector + ws (WebSocket, port 8080)
- DB: wala muna. SQLite + Drizzle kapag kailangan na ang leaderboard.
- Tumatakbo sa local PC; kinukuha ng OBS/LIVE Studio ang browser window.
- Landscape 16:9 (buong screen, para sa OBS): 1920x1080 logical size; ang #stage ay naka-scale
  sa window gamit ang CSS transform.
- Camera: `SCENE3D.view` = 'behind' (likod ng Bahay Kubo, daan papalayo; default) o 'side'
  (kubo sa kaliwa, halimaw galing sa kanan). Visual na laki ng units: `SCENE3D.unitScale`.
  360° na camera (`SCENE3D.orbit`, render/CameraOrbit.ts): drag ng mouse = ikot, scroll = zoom,
  V o double-click = balik sa preset ng mode, O = kusang ikot. "🎥 CAMERA" button sa kanang-ibaba (`CAM_PICKER`, ui/CamPicker.ts;
  auto-hide gaya ng MAPA, naaalala sa localStorage): Normal, Free Cam, Sundan ang Laban, Gilid ng Laban, Mula sa Itaas,
  Ikot sa Laban. Ang mga nakatutok sa laban ay sumusunod sa gitna ng nagbabakbakang units (`World3D.fightFocus`).
  Sundan ang Laban (`idleSpin`): kapag walang unit nang `orbit.idleDelayMs`, umiikot sa buong mapa; pagdating ng units, tutok ulit sa laban.
- Battlefield: `SCENE3D.battlefield` = 'barangay' (default; kalsada, basketball court, Barangay Hall gate,
  jeepney base na may headlight beams, sari-sari stores, monobloc chairs, traysikel, aspin, banderitas;
  batay sa assets/reference/battlefield_barangay.jpg) o 'baha' (ang barangay na binaha habang may bagyo: maputik na tubig hanggang kalahati ng Bahay Kubo — lumalakad ang units sa ibabaw nito; hanay ng lubog na bahay sa gilid kapalit ng MonsterFog na hamog,
  ulan, kidlat, rescue boat, pamilya at lolo't lola sa bubong, maraming lumulutang na kalat (`SCENE3D.baha.debris`: gulong, karton, plastik, yero, sanga, styro, galon, water lily, bunton ng basura), umaalong tubig (`SCENE3D.baha.waves`) at talsik ng tubig kapag naglalaban (`SCENE3D.baha.splash`, `World3D.splashAt`); assets/reference/battlefield_baha.png)
  o 'templo' (isla, daang bato, templo) o 'baryo' (luma;
  daang lupa, bakod na kawayan). Puwedeng palitan via URL query (`?map=barangay`, `?map=baha`, `?map=templo`, `?map=baryo`)
  o sa Test panel (`?debug`), o sa "🗺️ MAPA" button sa kaliwang-ibaba (`MAP_PICKER`, ui/MapPicker.ts;
  lumalabas lang kapag gumalaw ang mouse para malinis sa OBS; naaalala ang pinili sa localStorage; mas nauuna ang `?map=`).
- HUD: kaliwa: score → likes → BAYANI PTS/top gifter → BAYANI column (2-column grid ng cards).
  Kanan: oras → HALIMAW PTS/top gifter → HALIMAW column. HP ng kubo (%): nakalutang sa ibabaw ng kubo (CSS2D label, `World3D.kuboHpSlot`, taas = `SCENE3D.kuboHpHeight`). Ibaba: defenders
  at kills/natitirang halimaw. Layers: labels (z1) < HUD (z2) < panalo/talo overlay.

## Mga karakter
Defenders: Barangay Tanod (basic, canHitAir), Anito (tank, canHitAir), Malupiton (Aka Lapu) (dual-blade warrior, canHitAir),
Sarimanok (malakas, ranged, canHitAir), Mabait na Higante (counter kay Kapre, 10c, canHitAir),
Haliya (Moon Goddess, counter kay Bakunawa, 30c, canHitAir).
Attackers: Aswang (basic), Manananggal (lumilipad, umaatake sa bayani), Tikbalang (mabilis).
Bosses (abilities sa `BOSSES`, pinapadala ng viewers via `VILLAIN_GIFTS`): Kapre (slam),
Mangkukulam (sumpa mula sa malayo + nagpapatawag ng Aswang), Bakunawa (apoy; nagiging
pula ang eksena).
Base: Bahay Kubo (may HP) sa harap ng camera, pinatibay (`buildBaseKubo` sa render/models.ts, settings sa `SCENE3D.kuboFort`):
batong pundasyon, bakod na matulis na kawayan sa likod at gilid (bukas ang harap/pinto sa camera), bantay na poste na may
bandila ng BAYANI, sulo, kalasag, at kumikinang na pananggalang sa lupa. Ang `buildKubo` ay para sa mga dekorasyong kubo. Papalapit ang halimaw mula sa malayo; sa gitna lang ng gate sila lumalabas (`LANE.spawnLat`).
Patakaran sa laban: DAPAT MAUBOS MUNA ANG BAYANI bago makatira sa Bahay Kubo ang halimaw.
Kapag kubo na lang ang target, puwedeng magdikit-dikit ang halimaw (walang ally separation, `toBase`) at
nakakalat sa harap ng kubo (`LANE.baseSpreadLat`); mas malayo tumitigil ang malaki (`LANE.baseSizePad`).
Kaya ding ma-attack ng Tanod at iba pang bayani ang Manananggal. May combat VFX (slash arcs,
claw swipes, clash sparks, impact flash, flinch/stagger recoil, at Manananggal dive swoop).
Yabugan (`LANE.duel`, `FX.duel`, `isDuel` sa sim/World.ts): kapag dalawang dambuhalang melee ang naglaban
(hal. Higante vs Kapre), nagkakaharap sila nang pahilis para hindi matakpan ng isa ang isa, at malalaki ang suntok/uga.

## Mga patakaran
- Lahat ng numbers (HP, damage, likes kada spawn, cooldowns, camera, ilaw, FX) ay nasa
  game/src/config.ts. Walang magic numbers sa ibang file. Exception: hugis/proporsyon ng
  placeholder models at dekorasyon sa game/src/render/ (parang sprite data).
- Hiwalay ang logic sa rendering: sim/ ay purong TS (walang three.js), render/ at ui/
  ay nakikinig lang sa `WorldEvent`s.
- Iisang entry point para sa lahat ng input: handleEvent(event).
  Keyboard debug keys at TikTok events ay parehong dumadaan dito.
- Event format:
  { type: 'like', user, count } | { type: 'gift', user, gift, count, icon?, coins? }
  | { type: 'follow', user } | { type: 'chat', user, msg }
- Hiwalay ang bridge sa game. Walang TikTok code sa game/.
- Gift icons: kinukuha ng bridge mula sa TikTok (`fetchAvailableGifts` pagka-connect at
  `gift.image` sa bawat gift) → `{ type: 'giftIcons', icons: {name: url} }` (hindi input;
  HUD lang). Hindi sine-save sa repo; https lang; emoji (`ICONS.gifts`) ang fallback.
- Halaga ng gift: `coins` sa bawat entry ng `GIFTS`/`VILLAIN_GIFTS` (fallback); ang bridge ay
  nagpapasa ng tunay na `diamondCount` bilang `coins`. Gift na wala sa listahan → BAYANI ayon sa
  `GIFT_TIERS`. Top gifter at kabuuang coins ay hiwalay kada panig, kada round.
- Patas na halaga (`BALANCE`, sim/balance.ts): ang lakas (HP × dmg/s) ng unit galing sa gift ay
  refPower × (coins/refCoins)^coinExponent; HP at damage × √k. `valueFactor` kada karakter para sa
  abilities. Na-calibrate sa equal-coin na laban (halos tabla). Tama sa kubo = dmg × k^`BASE.damagePowerExp`.
- Config (WS URL, TikTok username, port) ay galing sa .env, walang hardcode.
- May auto-reconnect ang WebSocket at ang TikTok connection.
- May max na bilang ng units sa screen at rate limit sa spawn (para sa
  like spam).
- Original art lang. Walang gagamitin na copyrighted characters.
- Voxel (pixel 3D) ang mga karakter: game/src/render/voxModels.ts (pixel data) + voxel.ts (mesher).
  Binti/braso na may pivot (`Model.limbs`, `limb`/`limbPair`) ay umuugoy habang naglalakad (`FX.legSwing`/`armSwing`).
  Buntot ng Bakunawa: `Model.segments` na umaalon (`userData.sway` = lakas ng alon kada segment).
  Pakpak (`Model.wings`, `userData.flapAxis`/`flapAmp`): ang naka-mirror (scale.x = -1) ay sabay na pumapagaspas.

## Mga command
Mula sa root ng repo (~/laban-baryo):
- npm run dev → game (http://localhost:5173)
- npm run build → build ng game
- npm run bridge → bridge
O sa loob mismo ng game/ o bridge/: npm run dev

## Layout ng code
- game/src/main.ts — #stage scaling, game loop (rAF), debug keys, bridge connection
- game/src/events.ts — `GameEvent`, `parseEvent` (validation ng galing sa WS),
  `handleEvent` (iisang entry point) at `setEventTarget` (nirerehistro ng main → World)
- game/src/config.ts — lahat ng numbers, gift mapping, debug keys. Units ay sa metro
  (`pos` = layo mula sa kubo, `lat` = kaliwa/kanan, `alt` = taas)
- game/src/sim/World.ts — game logic: combat, rounds (timer + score), base HP, likes, kills,
  top contributor, villain queue; naglalabas ng `WorldEvent`
- game/src/sim/ — `SpawnQueue` (token bucket, para sa bayani at halimaw), `balance` (coins → lakas), `rand`
- game/src/render/CameraOrbit.ts — 360° na camera (drag/zoom/reset/auto-ikot)
- game/src/render/World3D.ts — Three.js na eksena (langit, ilaw, buwan, buwan-at-ulap na sprite (`SCENE3D.skyMoon`; nakapirmi sa isang puwesto sa mundo, hindi sumasama sa galaw ng camera), kubo/jeepney base; 'barangay'/'templo'/'baryo' na battlefield,
  katakut-takot na hamog at pagdilim kapag nag-spawn ang halimaw), unit views, effects, CSS2D labels
- game/src/render/barangay.ts — 'barangay' na battlefield (assets/reference/battlefield_barangay.jpg)
- game/src/render/baha.ts — 'baha' na battlefield: `buildBarangay(sc, { flooded: true })` + tubig, ulan, kidlat,
  rescue boat, mga tao sa bubong, kalat (settings sa `SCENE3D.baha`). Paalala: +x = kaliwa sa screen.
- game/src/render/templo.ts — 'templo' na battlefield (assets/reference/battlefield_templo.png)
- game/src/render/scenery.ts — pinagsasaluhan: glow texture, fog texture, sulo (`torchFlame`), niyog, `voxGroup`
- game/src/render/models.ts — `Model` type at Bahay Kubo; ang mga karakter ay voxel (voxModels.ts)
- game/src/render/voxel.ts — `Vox` builder → iisang mesh kada part (naka-cache ang geometry)
- game/src/render/portraits.ts — nire-render ang models → PNG para sa HUD icons
- game/src/ui/Hud.ts + hud.css — score, likes, coins/top gifter kada panig, oras, HP ng kubo,
  BAYANI at HALIMAW columns (galing sa config, may coin value), defenders, kills, toasts,
  banners (round, boss alert), panalo/talo screen
- game/src/ui/ — `DebugPanel` (?debug), `MapPicker` (MAPA button, pampili ng battlefield), `CamPicker` (CAMERA button, pampili ng POV), `giftIcons` (TikTok icon registry), `pixel` (pixelated icons)
- game/src/systems/Net.ts — WS + reconnect
- game/src/systems/Sound.ts — synthesized na tunog (Web Audio) kada spawn; settings sa `SOUND` (config.ts)
- assets/reference/ — reference sheets (PNG) ng mga karakter; batayan ng voxel models (hindi bundled)
- bridge/src/tiktok.ts — TikTok → `GameEvent` (proto v3 fields: `count`,
  `gift.name`, `content`, `user.displayId`; iba sa README ng library)
- bridge/src/events.ts — kopya ng `GameEvent`; panatilihing kapareho ng game/src/events.ts

## Debug keys (game)
BAYANI: 1 = Tanod (fake like event na sapat para sa isang Tanod), L = 10 likes, R = Rose (1c), I = Ice Cream (1c, Malupiton),
A = Finger Heart (5c, Anito), D = Dolphin (10c, Sarimanok), F = follow, T = chat `!tanod`
HALIMAW: G = GG (1c, Aswang), H = Heart Me (1c, Manananggal), P = Panda (5c, Tikbalang),
C = Rosa (10c, Mangkukulam), K = Gold Boxing Gloves (10c, Kapre), X = chat `!aswang`
M = mute/unmute ng tunog, V = reset ng camera, O = kusang ikot ng camera (hindi game events)
Lahat ng gifts ay 100% tugma sa opisyal na presyo ng TikTok LIVE gifts (1 hanggang 10 coins).
Labels sa ibabaw ng ulo: laging ipinapakita ang pangalan ng Hero/Karakter (hindi "debug").
Clickable test buttons (bayani at halimaw): http://localhost:5173/?debug (naka-config sa `DEBUG_PANEL`; wala sa OBS kapag walang `?debug`).
Maikling round: `?debug&round=30` (segundo; gumagana lang kasama ang `?debug`).

## Status ng mga phase
- [x] Phase 0: setup (game/, bridge/, .env.example, .gitignore)
- [x] Phase 1: core game, portrait, Tanod vs Aswang, key "1"
- [x] Phase 2: lahat ng karakter at bosses, rounds na may timer at score, panalo/talo screen + auto-restart.
  (Tinanggal ang waves: viewers na lang ang nagpapadala ng halimaw.)
- [~] Phase 3: nandiyan na ang event mapping, like counter at debug keys sa config.ts.
  Iba sa roadmap: follow → Albularyo pa (roadmap: Anito).
- [~] Phase 4: nandiyan na ang bridge (TikTok → WS, auto-reconnect, gift icons). Hindi pa nasusubukan sa totoong LIVE.
- [ ] Phase 5: viewer names (meron na), alerts (toasts at top gifter, meron na), leaderboard, goal bar
- [x] 3D voxel + pixel-art UI (Three.js), versus mode, gift coin values at patas na balance

## Workflow
- Pagkatapos ng bawat tapos na feature: i-commit agad. HUWAG nang paalalahanan ang user na mag-`/clear`
  (kusang nagko-compact ang context; ang user na ang bahala kung kailan mag-`/clear`)
- Panatilihing updated ang CLAUDE.md bago mag-commit kapag nagbago ang layout/patakaran.
