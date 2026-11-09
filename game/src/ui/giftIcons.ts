import { HUD, ICONS } from '../config';
import { pixelEmoji, pixelImage } from './pixel';

// Mga gift icon URL galing sa TikTok (via bridge). Hindi naka-save sa repo;
// emoji (ICONS.gifts) ang fallback kapag wala pa o offline.

const icons = new Map<string, string>();
const listeners: (() => void)[] = [];

/** https lang ang tinatanggap (galing sa network). */
const isSafeUrl = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u);

export function setGiftIcons(map: Record<string, unknown>) {
  let changed = false;
  for (const [name, url] of Object.entries(map)) {
    if (isSafeUrl(url) && icons.get(name) !== url) {
      icons.set(name, url);
      changed = true;
    }
  }
  if (changed) for (const fn of listeners) fn();
}

export function onGiftIconsChange(fn: () => void) {
  listeners.push(fn);
}

/** Pixelated na TikTok icon kung meron, kung wala ay pixelated na emoji (may class na `emoji`). */
export function giftIconEl(gift: string, cls = 'gift-icon', size: number = HUD.iconPx): HTMLElement {
  const url = icons.get(gift);
  if (url) return pixelImage(url, cls, size);
  const el = pixelEmoji(ICONS.gifts[gift] ?? ICONS.gift, cls, size);
  el.classList.add('emoji');
  return el;
}
