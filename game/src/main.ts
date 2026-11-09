import '@fontsource/silkscreen/700.css';
import { DEBUG_KEYS, GAME, ROUND, SCENE3D, SOUND } from './config';
import { handleEvent, setEventTarget } from './events';
import { renderPortraits } from './render/portraits';
import { World3D } from './render/World3D';
import { World } from './sim/World';
import { connectBridge } from './systems/Net';
import { Sound } from './systems/Sound';
import { mountDebugPanel } from './ui/DebugPanel';
import { Hud } from './ui/Hud';
import { setGiftIcons } from './ui/giftIcons';

const MAX_FRAME_MS = 100; // iwas talon kapag na-pause ang tab

// #stage = 1080x1920 logical, naka-scale para magkasya sa window (parang Scale.FIT)
const stage = document.getElementById('stage')!;
const fit = () => {
  const s = Math.min(window.innerWidth / GAME.width, window.innerHeight / GAME.height);
  stage.style.transform = `translate(${(window.innerWidth - GAME.width * s) / 2}px, ${(window.innerHeight - GAME.height * s) / 2}px) scale(${s})`;
};
stage.style.width = `${GAME.width}px`;
stage.style.height = `${GAME.height}px`;
window.addEventListener('resize', fit);
fit();

const params = new URLSearchParams(location.search);
// Pumili ng mapa (battlefield: barangay | templo | baryo)
const mapParam = params.get('map') || params.get('battlefield');
if (mapParam === 'barangay' || mapParam === 'templo' || mapParam === 'baryo') {
  (SCENE3D as { battlefield: string }).battlefield = mapParam;
}

// ?round=N segundo (kasama ng ?debug lang) → maikling round para sa testing
const debugRoundSecs = params.has('debug') ? Number(params.get('round')) : 0;
const world = new World(debugRoundSecs > 0 ? debugRoundSecs * 1000 : ROUND.durationMs);
const view = new World3D(stage, world);
const hud = new Hud(stage, world, renderPortraits());
const sound = new Sound(world);
setEventTarget((e) => {
  if (e.type === 'gift' && e.icon) setGiftIcons({ [e.gift]: e.icon });
  world.onEvent(e);
});

// Debug keys: gumagawa ng fake event, dumadaan sa handleEvent (hindi direktang spawn).
window.addEventListener('keydown', (e) => {
  if (e.key.toUpperCase() === SOUND.muteKey) {
    sound.toggleMute();
    return;
  }
  const ev = DEBUG_KEYS[e.key.toUpperCase() as keyof typeof DEBUG_KEYS];
  if (ev) handleEvent(ev);
});

// Clickable test buttons: buksan ang http://localhost:5173/?debug
if (params.has('debug')) mountDebugPanel();

connectBridge(import.meta.env.VITE_WS_URL, handleEvent, (s) => hud.setNet(s), setGiftIcons);

let last = performance.now();
const frame = (now: number) => {
  const dt = Math.min(now - last, MAX_FRAME_MS);
  last = now;
  world.update(dt);
  view.update(dt);
  hud.update();
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
