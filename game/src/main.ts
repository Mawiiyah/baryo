import Phaser from 'phaser';
import { DEBUG_KEYS, GAME } from './config';
import type { GameEvent } from './events';
import { GameScene } from './scenes/GameScene';
import { connectBridge } from './systems/Net';

const scene = new GameScene();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME.width,
  height: GAME.height,
  backgroundColor: GAME.background,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [scene],
});

/** Iisang entry point: TikTok (via bridge) at keyboard debug keys. */
export function handleEvent(event: GameEvent) {
  if (scene.sys.isActive()) scene.handleEvent(event);
}

window.addEventListener('keydown', (e) => {
  const ev = DEBUG_KEYS[e.key.toUpperCase() as keyof typeof DEBUG_KEYS];
  if (ev) handleEvent(ev);
});

connectBridge(import.meta.env.VITE_WS_URL, handleEvent, (s) => scene.setNetStatus(s));
