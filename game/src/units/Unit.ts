import Phaser from 'phaser';
import { FX, GAME, HUD, SPAWN, THEME, type Shape, type UnitKind, type UnitStats } from '../config';

export type Side = 'defender' | 'attacker';

/** Placeholder-shape unit (may anino, mata, bob, hit flash). Papalitan ng sprites mamaya. */
export class Unit {
  readonly container: Phaser.GameObjects.Container;
  private readonly figure: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Shape;
  private readonly hpBg: Phaser.GameObjects.Rectangle;
  private readonly hpBar: Phaser.GameObjects.Rectangle;
  readonly maxHp: number;
  hp: number;
  lastActionAt = 0;
  /** Random na offset sa x kapag naghihintay sa front line. */
  readonly idleOffset = Phaser.Math.FloatBetween(-SPAWN.idleJitterX, SPAWN.idleJitterX);

  constructor(
    private readonly scene: Phaser.Scene,
    readonly kind: UnitKind,
    readonly side: Side,
    readonly stats: UnitStats,
    x: number,
    y: number,
    owner: string,
    hpScale: number,
  ) {
    this.maxHp = Math.round(stats.hp * hpScale);
    this.hp = this.maxHp;
    const { width: w, height: h, color } = stats;

    // Anino sa lupa (mas mababa kapag lumilipad)
    const shadowY = h / 2 + (stats.flying ? GAME.flyHeight : 0);
    const shadow = scene.add
      .ellipse(0, shadowY, w * (stats.flying ? 0.7 : 1.1), w * FX.shadowHeight, 0x000000, FX.shadowAlpha);

    this.body = makeShape(scene, stats.shape, w, h, color).setStrokeStyle(HUD.strokeWidth, THEME.outline);
    this.figure = scene.add.container(0, 0, [this.body, ...makeEyes(scene, side, stats.shape, w, h)]);

    const barY = -h / 2 - HUD.unitBarGap;
    this.hpBg = scene.add.rectangle(0, barY, w, HUD.unitBarHeight, THEME.barBg).setVisible(false);
    this.hpBar = scene.add
      .rectangle(-w / 2, barY, w, HUD.unitBarHeight, side === 'defender' ? THEME.good : THEME.danger)
      .setOrigin(0, 0.5)
      .setVisible(false);

    const label = scene.add
      .text(0, barY - HUD.unitLabelGap, side === 'defender' ? owner : stats.name, {
        fontFamily: THEME.font,
        fontStyle: 'bold',
        fontSize: `${HUD.unitFontSize}px`,
        color: side === 'defender' ? THEME.text : THEME.dangerCss,
        stroke: THEME.stroke,
        strokeThickness: HUD.textStroke,
      })
      .setOrigin(0.5);

    this.container = scene.add.container(x, y, [shadow, this.figure, this.hpBg, this.hpBar, label]);
    this.container.setDepth(y);

    // Pop-in
    this.container.setScale(0);
    scene.tweens.add({ targets: this.container, scale: 1, duration: FX.spawnPopMs, ease: 'Back.easeOut' });
    // Idle bob
    scene.tweens.add({
      targets: this.figure,
      y: -(stats.flying ? FX.bobFlyPx : FX.bobPx),
      duration: Phaser.Math.Between(FX.bobMinMs, FX.bobMaxMs),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  get x() {
    return this.container.x;
  }
  get y() {
    return this.container.y;
  }
  get alive() {
    return this.hp > 0;
  }

  damage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);
    this.updateBar();
    this.body.setFillStyle(FX.hitFlashColor);
    this.scene.time.delayedCall(FX.hitFlashMs, () => this.body.active && this.body.setFillStyle(this.stats.color));
    this.floatText(`-${amount}`, this.side === 'defender' ? THEME.dangerCss : THEME.accentCss);
  }

  healBy(amount: number) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.updateBar();
    if (this.hp > before) this.floatText(`+${this.hp - before}`, THEME.healCss);
  }

  /** Death animation, tapos sinisira ang container. */
  destroy() {
    this.scene.tweens.killTweensOf(this.figure);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 0.2,
      y: this.y - FX.deathRise,
      duration: FX.deathMs,
      ease: 'Quad.easeIn',
      onComplete: () => this.container.destroy(),
    });
  }

  private floatText(text: string, color: string) {
    const t = this.scene.add
      .text(this.x + Phaser.Math.Between(-10, 10), this.y - this.stats.height / 2, text, {
        fontFamily: THEME.font,
        fontStyle: 'bold',
        fontSize: `${FX.dmgFontSize}px`,
        color,
        stroke: THEME.stroke,
        strokeThickness: HUD.textStroke,
      })
      .setOrigin(0.5)
      .setDepth(GAME.height);
    this.scene.tweens.add({
      targets: t,
      y: t.y - FX.dmgTextRise,
      alpha: 0,
      duration: FX.dmgTextMs,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  private updateBar() {
    const damaged = this.hp < this.maxHp;
    this.hpBg.setVisible(damaged);
    this.hpBar.setVisible(damaged);
    this.hpBar.width = this.stats.width * (this.hp / this.maxHp);
  }
}

export function makeShape(scene: Phaser.Scene, shape: Shape, w: number, h: number, color: number) {
  switch (shape) {
    case 'circle':
      return scene.add.ellipse(0, 0, w, h, color);
    case 'triangle':
      return scene.add.triangle(0, 0, 0, h, w / 2, 0, w, h, color);
    case 'star':
      return scene.add.star(0, 0, 5, w / 4, w / 2, color);
    case 'rect':
      return scene.add.rectangle(0, 0, w, h, color);
  }
}

/** Defenders: puting mata nakatingin pakanan. Halimaw: pulang mata nakatingin pakaliwa. */
function makeEyes(scene: Phaser.Scene, side: Side, shape: Shape, w: number, h: number) {
  const dir = side === 'defender' ? 1 : -1;
  const r = Math.max(3, w * FX.eyeR);
  const y = -h / 2 + h * FX.eyeY[shape];
  const cx = dir * w * 0.12;
  const out: Phaser.GameObjects.GameObject[] = [];
  for (const ox of [-w * FX.eyeGap, w * FX.eyeGap]) {
    if (side === 'defender') {
      out.push(scene.add.circle(cx + ox, y, r, FX.defenderEye));
      out.push(scene.add.circle(cx + ox + dir * r * 0.4, y, r * 0.5, FX.pupil));
    } else {
      out.push(scene.add.circle(cx + ox, y, r * 1.6, FX.attackerEye, 0.25));
      out.push(scene.add.circle(cx + ox, y, r, FX.attackerEye));
    }
  }
  return out;
}
