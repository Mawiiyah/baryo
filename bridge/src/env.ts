import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env var ${name} (tingnan ang bridge/.env.example)`);
  return v;
}

function int(name: string): number {
  const n = Number.parseInt(required(name), 10);
  if (!Number.isFinite(n)) throw new Error(`Env var ${name} must be an integer`);
  return n;
}

export const env = {
  tiktokUsername: required('TIKTOK_USERNAME'),
  wsPort: int('WS_PORT'),
  reconnectMs: int('TIKTOK_RECONNECT_MS'),
  reconnectMaxMs: int('TIKTOK_RECONNECT_MAX_MS'),
  signApiKey: process.env.SIGN_API_KEY?.trim() || undefined,
} as const;
