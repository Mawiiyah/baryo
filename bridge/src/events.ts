// Kaparehong shape ng game/src/events.ts. Ito lang ang ipinapasa sa game.
export type GameEvent =
  | { type: 'like'; user: string; count: number }
  | { type: 'gift'; user: string; gift: string; count: number; icon?: string; coins?: number }
  | { type: 'follow'; user: string }
  | { type: 'chat'; user: string; msg: string };

/** Hindi input: listahan ng gift name → icon URL (galing sa TikTok, ipinapadala pagka-connect). */
export type GiftIconsMessage = { type: 'giftIcons'; icons: Record<string, string> };
export type BridgeMessage = GameEvent | GiftIconsMessage;
