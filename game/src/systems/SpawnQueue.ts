import { SPAWN, type DefenderKind } from '../config';

export interface SpawnRequest {
  kind: DefenderKind;
  user: string;
}

/** Token-bucket rate limiter + bounded queue para sa defender spawns. */
export class SpawnQueue {
  private tokens: number = SPAWN.burst;
  private readonly queue: SpawnRequest[] = [];

  /** @returns false kapag puno ang queue (itinapon ang request). */
  push(req: SpawnRequest): boolean {
    if (this.queue.length >= SPAWN.queueMax) return false;
    this.queue.push(req);
    return true;
  }

  get size() {
    return this.queue.length;
  }

  /** Tawagin kada frame. `canSpawn` = may puwang pa sa screen. */
  update(deltaMs: number, canSpawn: () => boolean, spawn: (r: SpawnRequest) => void) {
    this.tokens = Math.min(SPAWN.burst, this.tokens + (deltaMs / 1000) * SPAWN.ratePerSec);
    while (this.tokens >= 1 && this.queue.length > 0 && canSpawn()) {
      this.tokens -= 1;
      spawn(this.queue.shift()!);
    }
  }

  clear() {
    this.queue.length = 0;
  }
}
