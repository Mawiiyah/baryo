import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import type { GameEvent } from './events.js';

interface Options {
  username: string;
  reconnectMs: number;
  reconnectMaxMs: number;
  signApiKey?: string;
  onEvent: (e: GameEvent) => void;
}

type MaybeUser = { user?: { displayId?: string; nickname?: string } | undefined };
/** displayId = @handle ng viewer sa proto v3. */
const userOf = (d: MaybeUser) => d.user?.displayId || d.user?.nickname || 'anon';

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
