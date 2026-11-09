import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import type { BridgeMessage } from './events.js';

interface Options {
  username: string;
  reconnectMs: number;
  reconnectMaxMs: number;
  signApiKey?: string;
  onEvent: (e: BridgeMessage) => void;
}

type MaybeUser = { user?: { displayId?: string; nickname?: string } | undefined };
/** displayId = @handle ng viewer sa proto v3. */
const userOf = (d: MaybeUser) => d.user?.displayId || d.user?.nickname || 'anon';

/** Unang https URL mula sa iba't ibang hugis ng image object ng TikTok. */
function firstUrl(img: unknown): string | undefined {
  if (!img || typeof img !== 'object') return undefined;
  const o = img as Record<string, unknown>;
  for (const key of ['url', 'urlList', 'url_list']) {
    const list = o[key];
    if (Array.isArray(list)) {
      const u = list.find((x): x is string => typeof x === 'string' && x.startsWith('https://'));
      if (u) return u;
    }
  }
  return undefined;
}

/** Listahan ng gifts ng room → { pangalan: icon URL }. */
function iconsFromCatalog(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const r = raw as { gifts?: unknown } | unknown[] | null;
  const list = Array.isArray(r) ? r : Array.isArray(r?.gifts) ? r.gifts : [];
  for (const g of list as Record<string, unknown>[]) {
    const name = typeof g?.name === 'string' ? g.name : undefined;
    const url = firstUrl(g?.image) ?? firstUrl(g?.icon);
    if (name && url) out[name] = url;
  }
  return out;
}

/** Kumokonekta sa TikTok LIVE at nire-reconnect nang may exponential backoff. */
export function startTikTok(opts: Options) {
  const conn = new TikTokLiveConnection(opts.username, { signApiKey: opts.signApiKey });
  let delay = opts.reconnectMs;
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  const scheduleReconnect = (why: string) => {
    if (stopped || timer) return;
    console.log(`[tiktok] ${why}; reconnect in ${delay / 1000}s`);
    timer = setTimeout(() => {
      timer = undefined;
      void connect();
    }, delay);
    delay = Math.min(delay * 2, opts.reconnectMaxMs);
  };

  async function connect() {
    try {
      const state = await conn.connect();
      delay = opts.reconnectMs;
      console.log(`[tiktok] connected to @${opts.username} (room ${state.roomId})`);
      try {
        const icons = iconsFromCatalog(await conn.fetchAvailableGifts());
        console.log(`[tiktok] ${Object.keys(icons).length} gift icons`);
        if (Object.keys(icons).length) opts.onEvent({ type: 'giftIcons', icons });
      } catch (err) {
        console.warn('[tiktok] gift list failed', err instanceof Error ? err.message : err);
      }
    } catch (err) {
      scheduleReconnect(`connect failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  conn.on(ControlEvent.DISCONNECTED, () => scheduleReconnect('disconnected'));
  conn.on(WebcastEvent.STREAM_END, () => scheduleReconnect('stream ended'));
  conn.on(ControlEvent.ERROR, (e) => console.error('[tiktok] error', e?.info ?? e));

  conn.on(WebcastEvent.LIKE, (d) => {
    const count = d.count ?? 0;
    if (count > 0) opts.onEvent({ type: 'like', user: userOf(d), count });
  });

  conn.on(WebcastEvent.GIFT, (d) => {
    // Streakable gifts (giftType 1): bilangin lang kapag tapos na ang streak.
    if (d.gift?.type === 1 && !d.repeatEnd) return;
    opts.onEvent({
      type: 'gift',
      user: userOf(d),
      gift: d.gift?.name || `gift#${d.giftId}`,
      count: Math.max(1, d.repeatCount ?? 1),
      icon: firstUrl(d.gift?.image) ?? firstUrl(d.gift?.icon),
      coins: d.gift?.diamondCount || undefined, // presyo ng isang gift (TikTok coins)
    });
  });

  conn.on(WebcastEvent.FOLLOW, (d) => opts.onEvent({ type: 'follow', user: userOf(d) }));

  conn.on(WebcastEvent.CHAT, (d) => {
    if (d.content) opts.onEvent({ type: 'chat', user: userOf(d), msg: d.content });
  });

  void connect();

  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      void conn.disconnect();
    },
  };
}
