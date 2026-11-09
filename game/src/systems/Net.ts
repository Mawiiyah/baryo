import { NET } from '../config';
import { parseEvent, type GameEvent } from '../events';

export type NetStatus = 'connecting' | 'connected' | 'disconnected';

/** WebSocket client papunta sa bridge, may auto-reconnect (exponential backoff). */
export function connectBridge(
  url: string,
  onEvent: (e: GameEvent) => void,
  onStatus: (s: NetStatus) => void,
  onGiftIcons: (icons: Record<string, unknown>) => void,
) {
  let delay: number = NET.reconnectMinMs;
  let ws: WebSocket | undefined;
  let timer: number | undefined;
  let closed = false;

  const open = () => {
    onStatus('connecting');
    ws = new WebSocket(url);
    ws.onopen = () => {
      delay = NET.reconnectMinMs;
      onStatus('connected');
    };
    ws.onmessage = (msg) => {
      try {
        const raw: unknown = JSON.parse(String(msg.data));
        // Hindi input: listahan ng gift icons (para sa HUD lang)
        if (typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'giftIcons') {
          const icons = (raw as { icons?: unknown }).icons;
          if (typeof icons === 'object' && icons !== null) onGiftIcons(icons as Record<string, unknown>);
          return;
        }
        const e = parseEvent(raw);
        if (e) onEvent(e);
      } catch {
        console.warn('[net] invalid message', msg.data);
      }
    };
    ws.onclose = () => {
      onStatus('disconnected');
      if (closed) return;
      timer = window.setTimeout(open, delay);
      delay = Math.min(delay * 2, NET.reconnectMaxMs);
    };
    ws.onerror = () => ws?.close();
  };

  open();
  return () => {
    closed = true;
    window.clearTimeout(timer);
    ws?.close();
  };
}
