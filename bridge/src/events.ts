// Kaparehong shape ng game/src/events.ts. Ito lang ang ipinapasa sa game.
export type GameEvent =
  | { type: 'like'; user: string; count: number }
  | { type: 'gift'; user: string; gift: string; count: number }
  | { type: 'follow'; user: string }
  | { type: 'chat'; user: string; msg: string };
