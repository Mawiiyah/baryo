import { HUD } from '../config';

// Mga pixelated na icon: dino-drawing sa maliit na canvas (HUD.iconPx), tapos
// pinalalaki ng CSS na may `image-rendering: pixelated`.

function smallCanvas(cls: string) {
  const c = document.createElement('canvas');
  c.width = c.height = HUD.iconPx;
  c.className = `px ${cls}`;
  return c;
}

/** Emoji bilang pixel art. */
export function pixelEmoji(ch: string, cls = ''): HTMLCanvasElement {
  const c = smallCanvas(cls);
  const g = c.getContext('2d');
  if (g) {
    const n = HUD.iconPx;
    g.font = `${Math.round(n * 0.85)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, n / 2, n / 2 + 1);
  }
  return c;
}

/** Larawan mula sa URL (hal. TikTok gift icon) bilang pixel art. Pang-display lang ang canvas. */
export function pixelImage(url: string, cls = ''): HTMLCanvasElement {
  const c = smallCanvas(cls);
  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.onload = () => c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
  img.src = url;
  return c;
}
