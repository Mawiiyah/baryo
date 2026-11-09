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
  HUD,
  SPAWN,
  WAVES,
  type AttackerKind,
  type DefenderKind,
} from '../config';
import type { GameEvent } from '../events';
import { SpawnQueue } from '../systems/SpawnQueue';
import { composeWave, hpScaleFor } from '../systems/Waves';
import type { NetStatus } from '../systems/Net';
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
  private feed: string[] = [];
  private netStatus: NetStatus = 'connecting';

  private baseBar!: Phaser.GameObjects.Rectangle;
  private likeBar!: Phaser.GameObjects.Rectangle;
  private waveText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private feedText!: Phaser.GameObjects.Text;
  private fx!: Phaser.GameObjects.Graphics;

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
    this.add
      .rectangle(0, GAME.groundTop, GAME.width, GAME.groundBottom - GAME.groundTop, GAME.groundColor)
      .setOrigin(0);
    this.drawBase();
    this.fx = this.add.graphics().setDepth(GAME.height);
    this.createHud();
  }

  // ---------- Iisang entry point para sa lahat ng input ----------
  handleEvent(event: GameEvent) {
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
        this.log(`${event.user} → ${event.gift} x${event.count} = ${n} ${DEFENDERS[map.unit].name}`);
        for (let i = 0; i < n; i++) this.request(map.unit, event.user);
        break;
      }
      case 'follow':
        this.log(`${event.user} nag-follow → ${DEFENDERS[FOLLOW.unit].name}`);
        for (let i = 0; i < FOLLOW.count; i++) this.request(FOLLOW.unit, event.user);
        break;
      case 'chat': {
        const msg = event.msg.trim().slice(0, CHAT.maxMsgLength);
        this.log(`${event.user}: ${msg}`);
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
    this.fx.clear();
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
        this.beam(d, ally, HUD.healColor);
      }
      this.moveToward(d, GAME.frontLineX - GAME.healerBackOffset, dt);
      return;
    }

    const target = this.nearest(d, this.attackers.filter((a) => a.alive && (!a.stats.flying || s.canHitAir)));
    if (target && Math.abs(target.x - d.x) <= s.range) {
      if (time - d.lastActionAt >= s.cooldownMs) {
        d.lastActionAt = time;
        target.damage(s.damage, this);
        if (s.ranged) this.beam(d, target, HUD.projectileColor);
      }
    } else if (target) {
      this.moveToward(d, Math.min(target.x, GAME.width - s.width), dt);
    } else {
      this.moveToward(d, GAME.frontLineX, dt);
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
        if (blocker) blocker.damage(s.damage, this);
        else this.baseHp = Math.max(0, this.baseHp - s.damage);
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
    const line = this.add.line(0, 0, from.x, from.y, to.x, to.y, color).setOrigin(0).setDepth(GAME.height);
    this.tweens.add({ targets: line, alpha: 0, duration: HUD.projectileMs, onComplete: () => line.destroy() });
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
    this.log(`— Wave ${this.wave}: ${list.length} halimaw${list.includes('kapre') ? ' + KAPRE!' : ''} —`);
    list.forEach((kind, i) => this.time.delayedCall(i * WAVES.spawnSpacingMs, () => this.spawnAttacker(kind)));
  }

  private gameOver() {
    this.state = 'over';
    this.queue.clear();
    this.add
      .text(GAME.width / 2, GAME.height / 2, `Nasakop ang Baryo!\nUmabot sa Wave ${this.wave}`, {
        fontFamily: HUD.font,
        fontSize: `${HUD.fontSize * 3}px`,
        color: HUD.textColor,
        align: 'center',
        stroke: '#000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(GAME.height + 1);
    this.time.delayedCall(GAME.restartDelayMs, () => this.scene.restart());
  }

  // ---------- Visuals ----------
  private drawBase() {
    const bottom = GAME.groundBottom - (GAME.groundBottom - GAME.groundTop) / 2;
    const x = BASE.x;
    this.add.rectangle(x, bottom, BASE.width, BASE.height, BASE.wallColor).setOrigin(0.5, 1).setStrokeStyle(2, 0);
    const top = bottom - BASE.height;
    this.add
      .triangle(x, top, -BASE.width / 2 - 10, 0, 0, -BASE.roofHeight, BASE.width / 2 + 10, 0, BASE.roofColor)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0);
  }

  private createHud() {
    const style = { fontFamily: HUD.font, fontSize: `${HUD.fontSize}px`, color: HUD.textColor };
    const small = { ...style, fontSize: `${HUD.smallFontSize + 2}px` };
    const pad = HUD.padding;
    const d = GAME.height + 2;

    this.add.text(pad, pad, BASE.name, style).setDepth(d);
    const barY = pad + HUD.fontSize + 6;
    this.add.rectangle(pad, barY, HUD.barWidth, HUD.barHeight, HUD.barBg).setOrigin(0).setDepth(d);
    this.baseBar = this.add.rectangle(pad, barY, HUD.barWidth, HUD.barHeight, HUD.goodColor).setOrigin(0).setDepth(d);

    const likeY = barY + HUD.barHeight + 8;
    this.add.rectangle(pad, likeY, HUD.barWidth, HUD.barHeight / 2, HUD.barBg).setOrigin(0).setDepth(d);
    this.likeBar = this.add
      .rectangle(pad, likeY, 0, HUD.barHeight / 2, HUD.likeColor)
      .setOrigin(0)
      .setDepth(d);

    this.waveText = this.add.text(GAME.width / 2, pad, '', style).setOrigin(0.5, 0).setDepth(d);
    this.statusText = this.add.text(GAME.width - pad, pad, '', small).setOrigin(1, 0).setDepth(d);
    this.feedText = this.add
      .text(GAME.width - pad, pad + HUD.fontSize * 3, '', small)
      .setOrigin(1, 0)
      .setAlign('right')
      .setDepth(d);
  }

  private updateHud(time: number) {
    this.baseBar.width = HUD.barWidth * (this.baseHp / BASE.hp);
    this.likeBar.width = HUD.barWidth * (this.likeCounter / SPAWN.likesPerTanod);
    const secs = Math.max(0, Math.ceil((this.nextWaveAt - time) / 1000));
    this.waveText.setText(`Wave ${this.wave}  •  susunod sa ${secs}s`);
    this.statusText.setText(
      `bridge: ${this.netStatus}\n` +
        `tagapagtanggol ${this.defenders.length}/${SPAWN.maxDefenders}  pila ${this.queue.size}\n` +
        `halimaw ${this.attackers.length}`,
    );
  }

  private log(line: string) {
    this.feed.push(line);
    if (this.feed.length > HUD.feedLines) this.feed.shift();
    this.feedText?.setText(this.feed.join('\n'));
  }
}
