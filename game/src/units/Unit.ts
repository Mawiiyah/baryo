import Phaser from 'phaser';
import { HUD, type UnitKind, type UnitStats } from '../config';

export type Side = 'defender' | 'attacker';

/** Placeholder-shape unit. Papalitan ng sprites mamaya. */
export class Unit {
  readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Shape;
  private readonly hpBar: Phaser.GameObjects.Rectangle;
  readonly maxHp: number;
  hp: number;
  lastActionAt = 0;

  constructor(
    scene: Phaser.Scene,
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

    this.body = makeShape(scene, stats, w, h, color);
    this.body.setStrokeStyle(HUD.strokeWidth, HUD.barBg);

    const barY = -h / 2 - HUD.unitBarGap;
    const barBg = scene.add.rectangle(0, barY, w, HUD.unitBarHeight, HUD.barBg).setOrigin(0.5);
    this.hpBar = scene.add
      .rectangle(-w / 2, barY, w, HUD.unitBarHeight, side === 'defender' ? HUD.goodColor : HUD.badColor)
      .setOrigin(0, 0.5);

    const label = scene.add
      .text(0, barY - HUD.unitLabelGap, side === 'defender' ? owner : stats.name, {
        fontFamily: HUD.font,
        fontSize: `${HUD.smallFontSize}px`,
        color: HUD.textColor,
      })
      .setOrigin(0.5);

    this.container = scene.add.container(x, y, [this.body, barBg, this.hpBar, label]);
    this.container.setDepth(y);
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

  damage(amount: number, scene: Phaser.Scene) {
    this.hp = Math.max(0, this.hp - amount);
    this.updateBar();
    this.body.setAlpha(0.4);
    scene.time.delayedCall(HUD.flashMs, () => this.body.setAlpha(1));
  }

  healBy(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.updateBar();
  }

  destroy() {
    this.container.destroy();
  }

  private updateBar() {
    this.hpBar.width = this.stats.width * (this.hp / this.maxHp);
  }
}

function makeShape(scene: Phaser.Scene, s: UnitStats, w: number, h: number, color: number) {
  switch (s.shape) {
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
