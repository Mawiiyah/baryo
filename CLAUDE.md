# Laban Baryo — TikTok LIVE interactive game

## Ano ito
2D tower-defense na kinokontrol ng TikTok LIVE viewers (likes, gifts,
follows, chat). Pinoy Folklore theme. Co-op mode muna.

## Stack
- Language: TypeScript (strict) sa buong project
- game/: Vite + Phaser 3
- bridge/: Node.js + tiktok-live-connector + ws (WebSocket, port 8080)
- DB: wala muna. SQLite + Drizzle kapag kailangan na ang leaderboard.
- Tumatakbo sa local PC; kinukuha ng OBS/LIVE Studio ang browser window.
- Portrait 9:16: 1080x1920 logical size, naka-scale sa window (Phaser Scale.FIT).

## Mga karakter
Defenders: Barangay Tanod (basic), Anito (tank), Albularyo (healer),
Sarimanok (malakas, ranged).
Attackers: Aswang (basic), Manananggal (lumilipad), Tikbalang (mabilis),
Kapre (boss).
Base: Bahay Kubo (may HP) sa kaliwa. Umaatake ang halimaw mula sa kanan.

## Mga patakaran
- Lahat ng numbers (HP, damage, likes kada spawn, cooldowns) ay nasa
  game/src/config.ts. Walang magic numbers sa ibang file.
- Iisang entry point para sa lahat ng input: handleEvent(event).
  Keyboard debug keys at TikTok events ay parehong dumadaan dito.
- Event format:
  { type: 'like', user, count } | { type: 'gift', user, gift, count }
  | { type: 'follow', user } | { type: 'chat', user, msg }
- Hiwalay ang bridge sa game. Walang TikTok code sa game/.
- Config (WS URL, TikTok username, port) ay galing sa .env, walang hardcode.
- May auto-reconnect ang WebSocket at ang TikTok connection.
- May max na bilang ng units sa screen at rate limit sa spawn (para sa
  like spam).
- Original art lang. Walang gagamitin na copyrighted characters.
- Placeholder shapes muna bago ang tunay na sprites.

## Mga command
- game: npm run dev | npm run build
- bridge: npm run dev

## Layout ng code
- game/src/main.ts — Phaser setup, debug keys, bridge connection
- game/src/events.ts — `GameEvent`, `parseEvent` (validation ng galing sa WS),
  `handleEvent` (iisang entry point) at `setEventTarget` (nirerehistro ng GameScene)
- game/src/config.ts — lahat ng numbers, gift mapping, debug keys
- game/src/scenes/GameScene.ts — game loop, combat, waves, HUD
- game/src/systems/ — `SpawnQueue` (token bucket), `Waves`, `Net` (WS + reconnect)
- game/src/units/Unit.ts — placeholder-shape unit
- bridge/src/tiktok.ts — TikTok → `GameEvent` (proto v3 fields: `count`,
  `gift.name`, `content`, `user.displayId`; iba sa README ng library)
- bridge/src/events.ts — kopya ng `GameEvent`; panatilihing kapareho ng game/src/events.ts

## Debug keys (game)
1 = Tanod (fake like event na sapat para sa isang Tanod), L = 10 likes, R = Rose, D = Doughnut (Sarimanok), A = Finger Heart (Anito),
F = follow, T = chat `!tanod`

## Status ng mga phase
- [x] Phase 0: setup (game/, bridge/, .env.example, .gitignore)
- [x] Phase 1: core game, portrait, Tanod vs Aswang, key "1"
- [~] Phase 2: nandiyan na lahat ng karakter, waves, Kapre, lose screen + auto-restart.
  Kulang pa: win screen at hiwalay na timer.
- [~] Phase 3: nandiyan na ang event mapping, like counter at debug keys sa config.ts.
  Iba sa roadmap: follow → Albularyo pa (roadmap: Anito).
- [~] Phase 4: nandiyan na ang bridge (TikTok → WS, auto-reconnect). Hindi pa nasusubukan sa totoong LIVE.
- [ ] Phase 5: viewer names (meron na sa ibabaw ng defender), alerts, leaderboard, goal bar
