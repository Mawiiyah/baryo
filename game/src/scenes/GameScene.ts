import Phaser from 'phaser';
import {
  ATTACKERS,
  BASE,
  CHAT,
  DEFENDERS,
  FOLLOW,
  GAME,
  GIFTS,
  GIFT_DEFAULT,
  GIFT_MAX_SPAWNS_PER_EVENT,
  FX,
  ICONS,
  SPAWN,
  THEME,
  WAVES,
  type AttackerKind,
  type DefenderKind,
} from '../config';
import { setEventTarget, type GameEvent } from '../events';
import { SpawnQueue } from '../systems/SpawnQueue';
import { composeWave, hpScaleFor } from '../systems/Waves';
import type { NetStatus } from '../systems/Net';
import { Hud } from '../ui/Hud';
import { Kubo, drawScenery } from '../ui/Scenery';
import { Unit } from '../units/Unit';

type State = 'playing' | 'over';

export class GameScene extends Phaser.Scene {
  private defenders: Unit[] = [];
  private attackers: Unit[] = [];
  private queue = new SpawnQueue();
  private baseHp: number = BASE.hp;
  private likeCounter = 0;
  private wave = 0;
  private nextWaveAt = 0;
  private state: State = 'playing';
  private chatCooldowns = new Map<string, number>();
  private netStatus: NetStatus = 'connecting';

  private hud!: Hud;
  private kubo!: Kubo;

  constructor() {
    super('game');
  }

  create() {
    this.defenders = [];
    this.attackers = [];
    this.queue.clear();
    this.baseHp = BASE.hp;
    this.likeCounter = 0;
    this.wave = 0;
    this.state = 'playing';
    this.nextWaveAt = this.time.now + WAVES.firstDelayMs;

    this.cameras.main.setBackgroundColor(GAME.background);
    drawScenery(this);
    this.kubo = new Kubo(this);
    this.hud = new Hud(this);

    setEventTarget((e) => this.onEvent(e));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setEventTarget(null));
  }

  // ---------- Tinatawag lang ng handleEvent() sa events.ts ----------
  private onEvent(event: GameEvent) {
    switch (event.type) {
      case 'like': {
        this.likeCounter += event.count;
        while (this.likeCounter >= SPAWN.likesPerTanod) {
          this.likeCounter -= SPAWN.likesPerTanod;
          if (!this.request('tanod', event.user)) {
            this.likeCounter %= SPAWN.likesPerTanod;
            break;
          }
        }
        break;
      }
      case 'gift': {
        const map = GIFTS[event.gift] ?? GIFT_DEFAULT;
        const n = Math.min(map.perGift * event.count, GIFT_MAX_SPAWNS_PER_EVENT);
        const icon = ICONS.gifts[event.gift] ?? ICONS.gift;
        this.hud.toast(`${icon} ${event.user}: ${event.gift} ×${event.count} → ${n} ${DEFENDERS[map.unit].name}`, THEME.accentCss);
        for (let i = 0; i < n; i++) this.request(map.unit, event.user);
        break;
      }
      case 'follow':
        this.hud.toast(`${ICONS.follow} ${event.user} nag-follow → ${DEFENDERS[FOLLOW.unit].name}`, THEME.likeCss);
        for (let i = 0; i < FOLLOW.count; i++) this.request(FOLLOW.unit, event.user);
        break;
      case 'chat': {
        const msg = event.msg.trim().slice(0, CHAT.maxMsgLength);
        this.hud.toast(`${ICONS.chat} ${event.user}: ${msg}`);
        const kind = CHAT.commands[msg.toLowerCase()];
        const last = this.chatCooldowns.get(event.user) ?? -Infinity;
        if (kind && this.time.now - last >= CHAT.userCooldownMs) {
          this.chatCooldowns.set(event.user, this.time.now);
          this.request(kind, event.user);
        }
        break;
      }
    }
  }

  setNetStatus(s: NetStatus) {
    this.netStatus = s;
  }

  private request(kind: DefenderKind, user: string): boolean {
    if (this.state !== 'playing') return false;
    return this.queue.push({ kind, user });
  }

  // ---------- Game loop ----------
  update(time: number, delta: number) {
    if (this.state === 'playing') {
      this.queue.update(
        delta,
        () => this.defenders.length < SPAWN.maxDefenders,
        (r) => this.spawnDefender(r.kind, r.user),
      );
      if (time >= this.nextWaveAt) this.startWave();
      const dt = delta / 1000;
      for (const d of this.defenders) this.updateDefender(d, time, dt);
      for (const a of this.attackers) this.updateAttacker(a, time, dt);
      this.defenders = this.reap(this.defenders);
      this.attackers = this.reap(this.attackers);
      if (this.baseHp <= 0) this.gameOver();
    }
    this.updateHud(time);
  }

  private updateDefender(d: Unit, time: number, dt: number) {
    const s = d.stats;
    if (s.heal > 0) {
      const ally = this.defenders
        .filter((o) => o !== d && o.alive && o.hp < o.maxHp && Math.abs(o.x - d.x) <= s.range)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (ally && time - d.lastActionAt >= s.cooldownMs) {
        d.lastActionAt = time;
        ally.healBy(s.heal);
        this.beam(d, ally, THEME.heal);
      }
      this.moveToward(d, GAME.frontLineX - GAME.healerBackOffset + d.idleOffset / 2, dt);
      return;
    }

    const target = this.nearest(d, this.attackers.filter((a) => a.alive && (!a.stats.flying || s.canHitAir)));
    if (target && Math.abs(target.x - d.x) <= s.range) {
      if (time - d.lastActionAt >= s.cooldownMs) {
        d.lastActionAt = time;
        if (s.ranged) this.shoot(d, target, s.damage);
        else target.damage(s.damage);
      }
    } else if (target) {
      this.moveToward(d, Math.min(target.x, GAME.width - s.width), dt);
    } else {
      this.moveToward(d, GAME.frontLineX + d.idleOffset, dt);
    }
  }

  private updateAttacker(a: Unit, time: number, dt: number) {
    const s = a.stats;
    const blocker = s.flying
      ? undefined
      : this.nearest(a, this.defenders.filter((d) => d.alive && Math.abs(d.x - a.x) <= s.range));
    const atBase = a.x <= BASE.hitX;
    if (blocker || atBase) {
      if (time - a.lastActionAt >= s.cooldownMs) {
        a.lastActionAt = time;
        if (blocker) blocker.damage(s.damage);
        else {
          this.baseHp = Math.max(0, this.baseHp - s.damage);
          this.kubo.hit();
        }
      }
      return;
    }
    a.container.x -= s.speed * dt;
  }

  private moveToward(u: Unit, x: number, dt: number) {
    const step = u.stats.speed * dt;
    const dx = x - u.x;
    u.container.x += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
  }

  private nearest(from: Unit, list: Unit[]) {
    let best: Unit | undefined;
    let bestDist = Infinity;
    for (const u of list) {
      const dist = Math.abs(u.x - from.x);
      if (dist < bestDist) {
        best = u;
        bestDist = dist;
      }
    }
    return best;
  }

  private reap(list: Unit[]) {
    return list.filter((u) => {
      if (u.alive) return true;
      u.destroy();
      return false;
    });
  }

  private beam(from: Unit, to: Unit, color: number) {
    const g = this.add.graphics().setDepth(GAME.height);
    g.lineStyle(FX.beamWidth * 2, color, 0.3).lineBetween(from.x, from.y, to.x, to.y);
    g.lineStyle(FX.beamWidth / 2, color, 1).lineBetween(from.x, from.y, to.x, to.y);
    this.tweens.add({ targets: g, alpha: 0, duration: FX.beamMs, onComplete: () => g.destroy() });
  }

  /** Bolang apoy mula sa ranged defender; tatama pagdating. */
  private shoot(from: Unit, to: Unit, dmg: number) {
    const orb = this.add.circle(from.x, from.y, FX.projectileR, THEME.projectile).setDepth(GAME.height);
    const glow = this.add.circle(from.x, from.y, FX.projectileR * 2, THEME.projectile, 0.3).setDepth(GAME.height);
    this.tweens.add({
      targets: [orb, glow],
      x: to.x,
      y: to.y,
      duration: FX.projectileMs,
      onComplete: () => {
        orb.destroy();
        glow.destroy();
        if (to.alive) to.damage(dmg);
      },
    });
  }

  // ---------- Spawning ----------
  private laneY(flying: boolean) {
    const band = (GAME.groundBottom - GAME.groundTop) * SPAWN.laneJitter;
    const y = Phaser.Math.FloatBetween(GAME.groundBottom - band, GAME.groundBottom);
    return flying ? y - GAME.flyHeight : y;
  }

  private spawnDefender(kind: DefenderKind, user: string) {
    const s = DEFENDERS[kind];
    this.defenders.push(new Unit(this, kind, 'defender', s, GAME.defenderSpawnX, this.laneY(s.flying), user, 1));
  }

  private spawnAttacker(kind: AttackerKind) {
    if (this.state !== 'playing' || this.attackers.length >= SPAWN.maxAttackers) return;
    const s = ATTACKERS[kind];
    this.attackers.push(
      new Unit(this, kind, 'attacker', s, GAME.spawnX, this.laneY(s.flying), '', hpScaleFor(this.wave)),
    );
  }

  private startWave() {
    this.wave += 1;
    this.nextWaveAt = this.time.now + WAVES.intervalMs;
    const list = composeWave(this.wave);
    const boss = list.includes('kapre');
    this.hud.banner(
      boss ? 'KAPRE!' : `WAVE ${this.wave}`,
      `${list.length} halimaw ang parating${boss ? ` • Wave ${this.wave}` : ''}`,
      boss ? THEME.dangerCss : THEME.accentCss,
    );
    list.forEach((kind, i) => this.time.delayedCall(i * WAVES.spawnSpacingMs, () => this.spawnAttacker(kind)));
  }

  private gameOver() {
    this.state = 'over';
    this.queue.clear();
    this.hud.gameOver(this.wave, GAME.restartDelayMs);
    this.time.delayedCall(GAME.restartDelayMs, () => this.scene.restart());
  }

  // ---------- HUD ----------
  private updateHud(time: number) {
    this.hud.update({
      baseHp: this.baseHp,
      likes: this.likeCounter,
      wave: this.wave,
      secsToWave: Math.max(0, Math.ceil((this.nextWaveAt - time) / 1000)),
      defenders: this.defenders.length,
      queued: this.queue.size,
      attackers: this.attackers.length,
      net: this.netStatus,
    });
  }
}
