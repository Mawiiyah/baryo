import {
  ATTACKERS,
  BASE,
  BOSSES,
  CHAT,
  DEFENDERS,
  FOLLOW,
  FX,
  GAME,
  GIFTS,
  GIFT_TIERS,
  GIFT_MAX_SPAWNS_PER_EVENT,
  LANE,
  SPAWN,
  VILLAIN_CHAT,
  VILLAIN_GIFTS,
  ROUND,
  type AttackerKind,
  type BossKind,
  type DefenderKind,
  type UnitKind,
  type UnitStats,
} from '../config';
import type { GameEvent } from '../events';
import { statsForCoins } from './balance';
import { randFloat } from './rand';
import { SpawnQueue } from './SpawnQueue';

export type Side = 'defender' | 'attacker';

export interface SimUnit {
  readonly id: number;
  readonly kind: UnitKind;
  readonly side: Side;
  readonly stats: UnitStats;
  readonly owner: string;
  readonly maxHp: number;
  readonly idleOffset: number;
  /** Ranged: bahagi ng range kung saan siya tumitigil (para hindi magkumpol). */
  readonly reach: number;
  /** Puwesto pakaliwa/pakanan habang naghihintay. */
  readonly homeLat: number;
  /** Multiplier ng lakas mula sa coins (1 = normal). */
  readonly power: number;
  pos: number;
  lat: number;
  alt: number;
  /** Direksyong hinaharap (pos, lat) — para sa renderer. */
  facePos: number;
  faceLat: number;
  hp: number;
  lastActionAt: number;
  lastAbilityAt: number;
  moving: boolean;
  alive: boolean;
}

/** Lahat ng nangyayari sa mundo; pinapakinggan ng renderer at HUD. */
export type WorldEvent =
  | { type: 'spawn'; unit: SimUnit }
  | { type: 'death'; unit: SimUnit }
  | { type: 'hit'; unit: SimUnit; amount: number; by?: SimUnit }
  | { type: 'heal'; from: SimUnit; to: SimUnit; amount: number }
  | { type: 'attack'; unit: SimUnit; target?: SimUnit }
  | { type: 'shot'; from: SimUnit; to?: SimUnit; toBase?: boolean; flightMs: number }
  | { type: 'baseHit'; amount: number; by?: SimUnit }
  | { type: 'round'; round: number }
  | { type: 'slam'; unit: SimUnit; radius: number }
  | { type: 'summon'; unit: SimUnit }
  | { type: 'breath'; unit: SimUnit; length: number }
  | { type: 'gift'; user: string; gift: string; count: number; unit: UnitKind; n: number; side: Side; coins: number }
  | { type: 'follow'; user: string; unit: DefenderKind }
  | { type: 'chat'; user: string; msg: string }
  | { type: 'over'; won: boolean; round: number }
  | { type: 'reset' };

type Listener = (e: WorldEvent) => void;
type State = 'playing' | 'over';

/** Game logic (walang rendering). Tinatawag ang update() kada frame. */
export class World {
  defenders: SimUnit[] = [];
  attackers: SimUnit[] = [];
  baseHp: number = BASE.hp;
  likes = 0;
  round = 0;
  /** Score ng magkabilang panig (ilang round ang naipanalo). */
  score = { bayani: 0, halimaw: 0 };
  kills = 0;
  now = 0;
  state: State = 'playing';
  private roundEndsAt = 0;
  private restartAt = 0;
  private nextId = 1;
  private queue = new SpawnQueue<DefenderKind>();
  /** Halimaw na pinadala ng viewers (versus), may sariling rate limit. */
  private villainQueue = new SpawnQueue<AttackerKind>();
  private pendingHits: { at: number; target: SimUnit | 'base'; amount: number; by?: SimUnit }[] = [];
  private chatCooldowns = new Map<string, number>();
  /** Kabuuang coins na naibigay ng bawat viewer sa round na ito. */
  private contributions: Record<Side, Map<string, number>> = { defender: new Map(), attacker: new Map() };
  private listeners: Listener[] = [];

  /** @param roundMs haba ng round (mas maikli para sa testing: ?round=N). */
  constructor(private readonly roundMs: number = ROUND.durationMs) {
    this.reset();
  }

  on(fn: Listener) {
    this.listeners.push(fn);
  }

  private emit(e: WorldEvent) {
    for (const fn of this.listeners) fn(e);
  }

  reset() {
    this.defenders = [];
    this.attackers = [];
    this.baseHp = BASE.hp;
    this.likes = 0;
    this.round += 1;
    this.kills = 0;
    this.state = 'playing';
    this.queue.clear();
    this.villainQueue.clear();
    this.pendingHits = [];
    this.contributions.defender.clear();
    this.contributions.attacker.clear();
    this.roundEndsAt = this.now + this.roundMs;
    this.emit({ type: 'reset' });
    this.emit({ type: 'round', round: this.round });
  }

  // ---------- Para sa HUD ----------
  get queued() {
    return this.queue.size;
  }
  get roundDurationMs() {
    return this.roundMs;
  }
  get msLeft() {
    return Math.max(0, this.roundEndsAt - this.now);
  }
  get msToRestart() {
    return Math.max(0, this.restartAt - this.now);
  }
  /** Pinakamalaking naibigay (coins) para sa isang panig sa round na ito. */
  topContributor(side: Side): { user: string; coins: number } | null {
    let best: { user: string; coins: number } | null = null;
    for (const [user, coins] of this.contributions[side]) if (!best || coins > best.coins) best = { user, coins };
    return best;
  }
  /** Kabuuang coins na naipadala para sa isang panig sa round na ito. */
  totalCoins(side: Side) {
    let t = 0;
    for (const c of this.contributions[side].values()) t += c;
    return t;
  }
  /** Mga buhay na boss (para sa boss HP bar). */
  get bosses() {
    return this.attackers.filter((a) => a.stats.boss);
  }

  /** Ilang halimaw ang nasa field + nakapila. */
  get remaining() {
    return this.attackers.length + this.villainQueue.size;
  }

  // ---------- Input (galing sa handleEvent) ----------
  onEvent(event: GameEvent) {
    switch (event.type) {
      case 'like': {
        this.likes += event.count;
        while (this.likes >= SPAWN.likesPerTanod) {
          this.likes -= SPAWN.likesPerTanod;
          if (!this.request('tanod', event.user)) {
            this.likes %= SPAWN.likesPerTanod;
            break;
          }
        }
        break;
      }
      case 'gift': {
        // Halaga: galing sa TikTok kung meron, kung wala ay sa config
        const villain = VILLAIN_GIFTS[event.gift];
        const hero = GIFTS[event.gift];
        const unitCoins = event.coins ?? villain?.coins ?? hero?.coins ?? 1;
        const coins = unitCoins * event.count;
        const side: Side = villain ? 'attacker' : 'defender';
        const book = this.contributions[side];
        book.set(event.user, (book.get(event.user) ?? 0) + coins);
        if (villain) {
          const n = Math.min(villain.perGift * event.count, GIFT_MAX_SPAWNS_PER_EVENT);
          this.emit({ type: 'gift', user: event.user, gift: event.gift, count: event.count, unit: villain.unit, n, side: 'attacker', coins });
          for (let i = 0; i < n; i++) this.requestVillain(villain.unit, event.user, coins / n);
          break;
        }
        // Kilalang gift, o ayon sa halaga (tier) kapag hindi kilala
        const map = hero ?? GIFT_TIERS.find((t) => unitCoins >= t.min) ?? GIFT_TIERS[GIFT_TIERS.length - 1]!;
        const n = Math.min(map.perGift * event.count, GIFT_MAX_SPAWNS_PER_EVENT);
        this.emit({ type: 'gift', user: event.user, gift: event.gift, count: event.count, unit: map.unit, n, side: 'defender', coins });
        for (let i = 0; i < n; i++) this.request(map.unit, event.user, coins / n);
        break;
      }
      case 'follow':
        this.emit({ type: 'follow', user: event.user, unit: FOLLOW.unit });
        for (let i = 0; i < FOLLOW.count; i++) this.request(FOLLOW.unit, event.user);
        break;
      case 'chat': {
        const msg = event.msg.trim().slice(0, CHAT.maxMsgLength);
        this.emit({ type: 'chat', user: event.user, msg });
        const cmd = msg.toLowerCase().trim();
        const withBang = cmd.startsWith('!') ? cmd : `!${cmd}`;
        const kind = CHAT.commands[cmd] ?? CHAT.commands[withBang];
        const villain = VILLAIN_CHAT[cmd] ?? VILLAIN_CHAT[withBang];
        const last = this.chatCooldowns.get(event.user) ?? -Infinity;
        if ((kind || villain) && this.now - last >= CHAT.userCooldownMs) {
          this.chatCooldowns.set(event.user, this.now);
          if (kind) this.request(kind, event.user);
          else if (villain) this.requestVillain(villain, event.user);
        }
        break;
      }
    }
  }

  /** @param coins halaga ng unit na ito (galing sa gift); wala = libre (likes/follow/chat). */
  private request(kind: DefenderKind, user: string, coins?: number): boolean {
    if (this.state !== 'playing') return false;
    return this.queue.push({ kind, user, coins });
  }

  private requestVillain(kind: AttackerKind, user: string, coins?: number) {
    if (this.state === 'playing') this.villainQueue.push({ kind, user, coins });
  }

  // ---------- Game loop ----------
  update(deltaMs: number) {
    this.now += deltaMs;
    if (this.state === 'over') {
      if (this.now >= this.restartAt) this.reset();
      return;
    }
    const dt = deltaMs / 1000;
    this.queue.update(
      deltaMs,
      () => this.defenders.length < SPAWN.maxDefenders,
      (r) => this.spawnDefender(r.kind, r.user, r.coins),
    );
    this.villainQueue.update(
      deltaMs,
      () => this.attackers.length < SPAWN.maxAttackers,
      (r) => this.spawnAttacker(r.kind, LANE.spawnPos, r.user, r.coins),
    );
    this.pendingHits = this.pendingHits.filter((h) => {
      if (h.at <= this.now) {
        if (h.target === 'base') {
          this.baseHp = Math.max(0, this.baseHp - h.amount);
          this.emit({ type: 'baseHit', amount: h.amount, by: h.by });
        } else {
          this.damage(h.target, h.amount, h.by);
        }
        return false;
      }
      return true;
    });

    for (const d of this.defenders) if (d.alive) this.updateDefender(d, dt);
    for (const a of this.attackers) if (a.alive) this.updateAttacker(a, dt);
    this.separate();
    this.defenders = this.defenders.filter((u) => u.alive);
    this.attackers = this.attackers.filter((u) => u.alive);

    if (this.baseHp <= 0) this.finish(false);
    else if (this.now >= this.roundEndsAt) this.finish(true);
  }

  private updateDefender(d: SimUnit, dt: number) {
    const s = d.stats;
    d.moving = false;
    if (s.heal > 0) {
      const ally = this.defenders
        .filter((o) => o !== d && o.alive && o.hp < o.maxHp && dist(o, d) <= s.range)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (ally && this.now - d.lastActionAt >= s.cooldownMs) {
        d.lastActionAt = this.now;
        face(d, ally);
        const before = ally.hp;
        ally.hp = Math.min(ally.maxHp, ally.hp + s.heal);
        this.emit({ type: 'heal', from: d, to: ally, amount: ally.hp - before });
      }
      this.moveTo(d, LANE.frontLinePos - LANE.healerBackOffset + d.idleOffset / 2, d.homeLat, dt);
      return;
    }

    // Binabantayan ang sona: hinaharap at inaatake ang halimaw (kasama ang lumilipad gaya ng Manananggal)
    const validTargets = this.attackers.filter((a) => a.alive && (!a.stats.flying || s.canHitAir));
    const inRange = nearest(
      d,
      validTargets.filter((a) => dist(a, d) <= s.range * d.reach),
    );
    const target =
      inRange ??
      nearest(
        d,
        validTargets.filter(
          (a) => a.pos <= LANE.frontLinePos + LANE.leash || a.pos <= d.pos + 2 || dist(a, d) <= LANE.aggroRange * 1.5,
        ),
      ) ??
      nearest(d, validTargets);

    if (target && dist(target, d) <= s.range * d.reach) {
      face(d, target);
      if (this.now - d.lastActionAt >= s.cooldownMs) {
        d.lastActionAt = this.now;
        if (s.ranged) {
          this.emit({ type: 'shot', from: d, to: target, flightMs: FX.projectileMs });
          this.pendingHits.push({ at: this.now + FX.projectileMs, target, amount: s.damage, by: d });
        } else {
          this.emit({ type: 'attack', unit: d, target });
          this.damage(target, s.damage, d);
        }
      }
    } else if (target) {
      this.moveTo(d, Math.min(target.pos, LANE.length), target.lat, dt); // habulin ang kalaban
    } else {
      this.moveTo(d, LANE.frontLinePos + d.idleOffset, d.homeLat, dt);
      if (!d.moving) d.facePos = 1; // nakaharap sa gubat habang naghihintay
    }
  }

  private updateAttacker(a: SimUnit, dt: number) {
    const s = a.stats;
    a.moving = false;
    if (s.boss) this.bossAbility(a);

    // PATAKARAN: DAPAT MAUBOS MUNA ANG MGA BAYANI BAGO NILA MATIRA ANG KUBO!
    // Ang Manananggal at iba pang halimaw ay dapat ding umaatake sa mga bayani.
    const livingDefenders = this.defenders.filter((d) => d.alive);

    if (livingDefenders.length > 0) {
      // May buhay pang bayani sa battlefield: uunahin silang lipulin bago ang kubo
      const blocker = nearest(a, livingDefenders.filter((d) => dist(d, a) <= s.range * a.reach));

      if (blocker) {
        face(a, blocker);
        if (this.now - a.lastActionAt >= s.cooldownMs) {
          a.lastActionAt = this.now;
          if (s.ranged) {
            this.emit({ type: 'shot', from: a, to: blocker, flightMs: FX.projectileMs });
            this.pendingHits.push({ at: this.now + FX.projectileMs, target: blocker, amount: s.damage, by: a });
            return;
          }
          this.emit({ type: 'attack', unit: a, target: blocker });
          this.damage(blocker, s.damage, a);
        }
        return;
      }

      // Hindi pa abot: lumapit sa pinakamalapit na bayani para makipaglaban
      const target = nearest(a, livingDefenders);
      if (target) {
        this.moveTo(a, target.pos, target.lat, dt);
        return;
      }
    }

    // Ubos na ang bayani (o walang bayani): dito lang pwedeng lumapit at tirahin ang mismong kubo!
    const kuboTargetLat = Math.sign(a.homeLat) * Math.min(Math.abs(a.homeLat), 1.6);
    const attackReach = s.ranged ? s.range : LANE.baseHitPos;
    const atBase = a.pos <= attackReach && Math.abs(a.lat - kuboTargetLat) <= 0.8;

    if (atBase) {
      a.facePos = -a.pos; // humarap nang diretso sa mismong Bahay Kubo
      a.faceLat = -a.lat;
      if (this.now - a.lastActionAt >= s.cooldownMs) {
        a.lastActionAt = this.now;
        const hit = Math.round(ATTACKERS[a.kind as AttackerKind].damage * a.power ** BASE.damagePowerExp);
        if (s.ranged) {
          this.emit({ type: 'shot', from: a, toBase: true, flightMs: FX.projectileMs });
          this.pendingHits.push({ at: this.now + FX.projectileMs, target: 'base', amount: hit, by: a });
        } else {
          this.emit({ type: 'attack', unit: a });
          this.baseHp = Math.max(0, this.baseHp - hit);
          this.emit({ type: 'baseHit', amount: hit, by: a });
        }
      }
      return;
    }

    // Magmartsa papunta sa mismong Bahay Kubo: lumalapit sa harap ng kubo (pos at lat)
    this.moveTo(a, LANE.baseHitPos - 0.2, kuboTargetLat, dt);
  }

  /**
   * Pini-prevent ang magkakapatong na units.
   * PATAKARAN: Kapag magkalaban (defender vs attacker), HINDI itutulak paatras ang bayani!
   * Naglalaban sila nang salpukan (hold the line). Banayad na lateral (kaliwa/kanan) slide lang
   * para hindi magpatong, pero walang atrasan sa posisyon ng laban.
   */
  private separate() {
    const all = [...this.defenders, ...this.attackers].filter((u) => u.alive);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]!;
        const b = all[j]!;
        if (a.stats.flying !== b.stats.flying) continue;
        const min = (a.stats.size + b.stats.size) * LANE.separation;
        let dp = a.pos - b.pos;
        let dl = a.lat - b.lat;
        let d = Math.hypot(dp, dl);
        if (d >= min) continue;
        if (d < 1e-4) {
          dl = randFloat(-1, 1);
          dp = randFloat(-1, 1);
          d = Math.hypot(dp, dl);
        }

        if (a.side === b.side) {
          // Parehong panig (allies): banayad na ihiwalay para nakakalat sila
          const push = (min - d) / 2 / d;
          a.pos += dp * push;
          a.lat += dl * push;
          b.pos -= dp * push;
          b.lat -= dl * push;
        } else {
          // Magkalaban (defender vs attacker): hindi tinutulak paatras ang bayani!
          // Banayad na lateral slide lang sa lane (lat) upang hindi magsapawan
          if (Math.abs(dl) > 1e-4) {
            const pushLat = Math.sign(dl) * Math.min(0.06, (min - d) * 0.15);
            a.lat += pushLat;
            b.lat -= pushLat;
          }
        }
      }
    }
    for (const u of all) {
      u.lat = Math.max(-LANE.halfWidth, Math.min(LANE.halfWidth, u.lat));
      u.pos = Math.max(0, u.pos);
    }
  }

  /** Espesyal na atake ng boss (tingnan ang BOSSES sa config). */
  private bossAbility(a: SimUnit) {
    const ab = BOSSES[a.kind as BossKind];
    if (ab.slam && this.now - a.lastAbilityAt >= ab.slam.everyMs) {
      const { radius, damage } = ab.slam;
      const hit = this.defenders.filter((d) => d.alive && Math.hypot(d.pos - a.pos, d.lat - a.lat) <= radius);
      if (hit.length) {
        a.lastAbilityAt = this.now;
        this.emit({ type: 'slam', unit: a, radius });
        for (const d of hit) this.damage(d, Math.round(damage * Math.sqrt(a.power)));
      }
    }
    if (ab.summon && this.now - a.lastAbilityAt >= ab.summon.everyMs) {
      a.lastAbilityAt = this.now;
      this.emit({ type: 'summon', unit: a });
      for (let i = 0; i < ab.summon.count; i++) this.spawnAttacker(ab.summon.kind, a.pos + LANE.meleeReach);
    }
    if (ab.breath && this.now - a.lastAbilityAt >= ab.breath.everyMs) {
      const { length, damage } = ab.breath;
      const hit = this.defenders.filter((d) => d.alive && d.pos <= a.pos && d.pos >= a.pos - length);
      if (hit.length) {
        a.lastAbilityAt = this.now;
        this.emit({ type: 'breath', unit: a, length });
        for (const d of hit) this.damage(d, Math.round(damage * Math.sqrt(a.power)));
      }
    }
  }

  private damage(u: SimUnit, amount: number, by?: SimUnit) {
    if (!u.alive) return;
    u.hp = Math.max(0, u.hp - amount);
    this.emit({ type: 'hit', unit: u, amount, by });
    if (u.hp <= 0) {
      u.alive = false;
      if (u.side === 'attacker') this.kills += 1;
      this.emit({ type: 'death', unit: u });
    }
  }

  /** Lakad papunta sa (pos, lat) at humarap doon. */
  private moveTo(u: SimUnit, pos: number, lat: number, dt: number) {
    const dp = pos - u.pos;
    const dl = lat - u.lat;
    const d = Math.hypot(dp, dl);
    if (d < 0.05) return;
    const step = Math.min(d, u.stats.speed * dt);
    u.pos += (dp / d) * step;
    u.lat += (dl / d) * step;
    u.facePos = dp;
    u.faceLat = dl;
    u.moving = true;
  }

  // ---------- Spawning ----------
  private makeUnit(kind: UnitKind, side: Side, base: UnitStats, pos: number, owner: string, coins?: number): SimUnit {
    const { stats, k } = statsForCoins(kind, base, coins);
    const maxHp = Math.round(stats.hp);
    return {
      id: this.nextId++,
      kind,
      side,
      stats,
      owner,
      maxHp,
      hp: maxHp,
      idleOffset: randFloat(-LANE.idleJitterPos, LANE.idleJitterPos),
      reach: stats.ranged ? 1 - randFloat(0, LANE.rangeJitter) : 1,
      homeLat: randFloat(-LANE.halfWidth, LANE.halfWidth),
      power: k,
      facePos: side === 'defender' ? 1 : -1,
      faceLat: 0,
      pos,
      lat: randFloat(-LANE.halfWidth, LANE.halfWidth),
      alt: stats.flying ? LANE.flyHeight : 0,
      lastActionAt: 0,
      lastAbilityAt: this.now,
      moving: false,
      alive: true,
    };
  }

  private spawnDefender(kind: DefenderKind, user: string, coins?: number) {
    const u = this.makeUnit(kind, 'defender', DEFENDERS[kind], LANE.defenderSpawnPos, user, coins);
    this.defenders.push(u);
    this.emit({ type: 'spawn', unit: u });
  }

  /** @param owner viewer na nagpadala; '' = ipinatawag ng boss. */
  private spawnAttacker(kind: AttackerKind, pos: number = LANE.spawnPos, owner = '', coins?: number) {
    if (this.attackers.length >= SPAWN.maxAttackers) return;
    const u = this.makeUnit(kind, 'attacker', ATTACKERS[kind], pos, owner, coins);
    this.attackers.push(u);
    this.emit({ type: 'spawn', unit: u });
  }

  private finish(won: boolean) {
    this.state = 'over';
    this.queue.clear();
    this.villainQueue.clear();
    if (won) this.score.bayani += 1;
    else this.score.halimaw += 1;
    this.restartAt = this.now + GAME.restartDelayMs;
    this.emit({ type: 'over', won, round: this.round });
  }
}

/** Layo sa daan (pos at lat). */
function dist(a: SimUnit, b: SimUnit) {
  return Math.hypot(a.pos - b.pos, a.lat - b.lat);
}

/** Harapin ang isang unit. */
function face(u: SimUnit, t: SimUnit) {
  u.facePos = t.pos - u.pos;
  u.faceLat = t.lat - u.lat;
}

function nearest(from: SimUnit, list: SimUnit[]) {
  let best: SimUnit | undefined;
  let bestDist = Infinity;
  for (const u of list) {
    const d = dist(u, from);
    if (d < bestDist) {
      best = u;
      bestDist = d;
    }
  }
  return best;
}
