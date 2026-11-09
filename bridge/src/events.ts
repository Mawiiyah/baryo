// Kaparehong shape ng game/src/events.ts. Ito lang ang ipinapasa sa game.
export type GameEvent =
  | { type: 'like'; user: string; count: number; mock?: boolean }
  | { type: 'gift'; user: string; gift: string; count: number; icon?: string; coins?: number; mock?: boolean }
  | { type: 'follow'; user: string; mock?: boolean }
  | { type: 'chat'; user: string; msg: string; mock?: boolean };

/** Hindi input: listahan ng gift name → icon URL (galing sa TikTok, ipinapadala pagka-connect). */
export type GiftIconsMessage = { type: 'giftIcons'; icons: Record<string, string> };
export type BridgeMessage = GameEvent | GiftIconsMessage;
