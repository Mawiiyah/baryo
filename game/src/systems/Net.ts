import { NET } from '../config';
import { parseEvent, type GameEvent } from '../events';

export type NetStatus = 'connecting' | 'connected' | 'disconnected';

/** WebSocket client papunta sa bridge, may auto-reconnect (exponential backoff). */
export function connectBridge(
  url: string,
  onEvent: (e: GameEvent) => void,
  onStatus: (s: NetStatus) => void,
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
        const e = parseEvent(JSON.parse(String(msg.data)));
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
