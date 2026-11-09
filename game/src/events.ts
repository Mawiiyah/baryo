// Iisang event format para sa TikTok (via bridge) at keyboard debug keys.
export type GameEvent =
  | { type: 'like'; user: string; count: number; mock?: boolean }
  | { type: 'gift'; user: string; gift: string; count: number; icon?: string; coins?: number; mock?: boolean }
  | { type: 'follow'; user: string; mock?: boolean }
  | { type: 'chat'; user: string; msg: string; mock?: boolean };

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validate ang galing sa network; null kapag sira. */
export function parseEvent(raw: unknown): GameEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const e = raw as Record<string, unknown>;
  if (!isStr(e.user)) return null;
  const mockOpt = e.mock === true ? { mock: true as const } : {};
  switch (e.type) {
    case 'like':
      return isNum(e.count) ? { type: 'like', user: e.user, count: e.count, ...mockOpt } : null;
    case 'gift':
      return isStr(e.gift) && isNum(e.count)
        ? {
            type: 'gift',
            user: e.user,
            gift: e.gift,
            count: e.count,
            ...(isStr(e.icon) ? { icon: e.icon } : {}),
            ...(isNum(e.coins) && e.coins > 0 ? { coins: e.coins } : {}),
            ...mockOpt,
          }
        : null;
    case 'follow':
      return { type: 'follow', user: e.user, ...mockOpt };
    case 'chat':
      return isStr(e.msg) ? { type: 'chat', user: e.user, msg: e.msg, ...mockOpt } : null;
    default:
      return null;
  }
}

type Handler = (event: GameEvent) => void;
let target: Handler | null = null;

/** Kung saan ipapasa ang events (ang aktibong GameScene). */
export function setEventTarget(handler: Handler | null) {
  target = handler;
}

/** Iisang entry point ng lahat ng input: keyboard debug keys at bridge (TikTok). */
export function handleEvent(event: GameEvent) {
  target?.(event);
}
