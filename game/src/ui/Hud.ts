import Phaser from 'phaser';
import {
  BASE,
  CHAT,
  DEFENDERS,
  FOLLOW,
  GAME,
  GIFTS,
  HUD,
  ICONS,
  SPAWN,
  THEME,
  WAVES,
  type DefenderKind,
} from '../config';
import type { NetStatus } from '../systems/Net';
import { makeShape } from '../units/Unit';

const DEPTH = GAME.height + 10;

const text = (size: number, color: string = THEME.text): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: THEME.font,
  fontStyle: 'bold',
  fontSize: `${size}px`,
  color,
  stroke: THEME.stroke,
  strokeThickness: HUD.textStroke,
});

export interface HudState {
  baseHp: number;
  likes: number;
  wave: number;
  secsToWave: number;
  defenders: number;
  queued: number;
  attackers: number;
  net: NetStatus;
}

export class Hud {
  private bars: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private nextText: Phaser.GameObjects.Text;
  private likeText: Phaser.GameObjects.Text;
  private statsText: Phaser.GameObjects.Text;
  private netDot: Phaser.GameObjects.Arc;
  private netText: Phaser.GameObjects.Text;
  private toasts: Phaser.GameObjects.Container[] = [];

  private readonly x0 = HUD.padding;
  private readonly innerX = HUD.padding + HUD.panelPad;
  private readonly innerW = GAME.width - 2 * (HUD.padding + HUD.panelPad);
  private readonly hpY: number;
  private readonly likeY: number;

  constructor(private scene: Phaser.Scene) {
    const pad = HUD.panelPad;
    const gap = HUD.gap;
    const top = HUD.padding;
    let y = top + pad;

    // Row 1: pangalan ng base + HP + bridge status
    const title = scene.add.text(this.innerX, y, `🏠 ${BASE.name.toUpperCase()}`, text(HUD.titleSize, THEME.accentCss));
    this.netText = scene.add
      .text(this.innerX + this.innerW, y + HUD.titleSize / 2, '', text(HUD.smallFontSize, THEME.textDim))
      .setOrigin(1, 0.5);
    this.netDot = scene.add.circle(0, y + HUD.titleSize / 2, HUD.netDotR, THEME.netColors.connecting);
    y += HUD.titleSize + gap;
    this.hpY = y;
    this.hpText = scene.add
      .text(this.innerX + this.innerW / 2, y + HUD.barHeight / 2, '', text(HUD.smallFontSize))
      .setOrigin(0.5);
    y += HUD.barHeight + gap * 1.5;

    // Row 2: wave + countdown
    this.waveText = scene.add.text(this.innerX, y, '', text(HUD.fontSize, THEME.accentCss));
    this.nextText = scene.add.text(this.innerX + this.innerW, y + 4, '', text(HUD.smallFontSize)).setOrigin(1, 0);
    y += HUD.fontSize + gap * 1.5;

    // Row 3: like meter
    this.likeText = scene.add.text(this.innerX, y, '', text(HUD.smallFontSize, THEME.likeCss));
    y += HUD.smallFontSize + gap / 2;
    this.likeY = y;
    y += HUD.likeBarHeight + gap;

    // Row 4: bilang ng units
    this.statsText = scene.add.text(this.innerX, y, '', text(HUD.smallFontSize, THEME.textDim));
    y += HUD.smallFontSize + pad;

    const panel = scene.add.graphics();
    drawPanel(panel, this.x0, top, GAME.width - 2 * HUD.padding, y - top);
    this.bars = scene.add.graphics();

    for (const o of [panel, this.bars, title, this.netText, this.netDot, this.hpText, this.waveText, this.nextText, this.likeText, this.statsText]) {
      o.setDepth(DEPTH);
    }
    panel.setDepth(DEPTH - 1);

    this.createLegend();
  }

  update(s: HudState) {
    const g = this.bars.clear();
    const hpRatio = s.baseHp / BASE.hp;
    const hpColor = hpRatio < HUD.hpDanger ? THEME.danger : hpRatio < HUD.hpWarn ? THEME.warn : THEME.good;
    drawBar(g, this.innerX, this.hpY, this.innerW, HUD.barHeight, hpRatio, hpColor);
    drawBar(g, this.innerX, this.likeY, this.innerW, HUD.likeBarHeight, s.likes / SPAWN.likesPerTanod, THEME.like);

    this.hpText.setText(`${Math.ceil(s.baseHp)} / ${BASE.hp}`);
    this.waveText.setText(s.wave === 0 ? 'HANDA NA?' : `WAVE ${s.wave}`);
    const bossNext = (s.wave + 1) % WAVES.bossEvery === 0;
    this.nextText
      .setText(`${bossNext ? '⚠️ KAPRE ' : 'Susunod '}sa ${s.secsToWave}s`)
      .setColor(bossNext ? THEME.dangerCss : THEME.text);
    this.likeText.setText(`${ICONS.like} ${s.likes} / ${SPAWN.likesPerTanod} likes → +1 ${DEFENDERS.tanod.name}`);
    this.statsText.setText(
      `🛡️ ${s.defenders}/${SPAWN.maxDefenders}    ⏳ ${s.queued}    💀 ${s.attackers}`,
    );
    this.netText.setText(`bridge ${s.net}`);
    this.netDot.setFillStyle(THEME.netColors[s.net]).setX(this.netText.x - this.netText.width - HUD.netDotR * 2);
  }

  /** Alert sa kanan; nawawala pagkatapos ng ilang segundo. */
  toast(msg: string, color: string = THEME.text) {
    const t = this.scene.add.text(0, 0, msg, text(HUD.toastFontSize, color)).setOrigin(1, 0.5);
    const w = t.width + HUD.panelPad * 1.5;
    const h = HUD.toastRowH - HUD.gap / 2;
    const bg = this.scene.add.graphics();
    drawPanel(bg, -w + HUD.panelPad * 0.75, -h / 2, w, h, h / 2);
    t.setX(0);
    const c = this.scene.add
      .container(GAME.width - HUD.padding - HUD.panelPad * 0.75 + HUD.toastSlidePx, HUD.toastBottomY, [bg, t])
      .setDepth(DEPTH)
      .setAlpha(0);
    this.toasts.push(c);
    const oldest = this.toasts[0];
    if (oldest && this.toasts.length > HUD.toastMax) this.dropToast(oldest);
    this.layoutToasts();
    this.scene.tweens.add({ targets: c, alpha: 1, x: c.x - HUD.toastSlidePx, duration: HUD.toastFadeMs, ease: 'Cubic.easeOut' });
    this.scene.time.delayedCall(HUD.toastMs, () => this.dropToast(c));
  }

  private dropToast(c: Phaser.GameObjects.Container) {
    const i = this.toasts.indexOf(c);
    if (i < 0) return;
    this.toasts.splice(i, 1);
    this.layoutToasts();
    this.scene.tweens.add({ targets: c, alpha: 0, duration: HUD.toastFadeMs, onComplete: () => c.destroy() });
  }

  private layoutToasts() {
    const n = this.toasts.length;
    this.toasts.forEach((c, i) => {
      this.scene.tweens.add({ targets: c, y: HUD.toastBottomY - (n - 1 - i) * HUD.toastRowH, duration: HUD.toastFadeMs / 2 });
    });
  }

  /** Malaking anunsyo sa gitna (hal. bagong wave). */
  banner(title: string, sub: string, color: string = THEME.accentCss) {
    const t = this.scene.add.text(0, 0, title, text(HUD.bannerFontSize, color)).setOrigin(0.5);
    const s = this.scene.add.text(0, HUD.bannerFontSize * 0.75, sub, text(HUD.bannerSubSize)).setOrigin(0.5);
    const c = this.scene.add.container(GAME.width / 2, HUD.bannerY, [t, s]).setDepth(DEPTH + 1).setScale(0.3).setAlpha(0);
    this.scene.tweens.chain({
      targets: c,
      tweens: [
        { scale: 1, alpha: 1, duration: HUD.bannerMs * 0.2, ease: 'Back.easeOut' },
        { scale: 1.05, duration: HUD.bannerMs * 0.6 },
        { alpha: 0, y: HUD.bannerY - HUD.bannerFontSize / 2, duration: HUD.bannerMs * 0.2, ease: 'Quad.easeIn' },
      ],
      onComplete: () => c.destroy(),
    });
  }

  /** Lose screen na may countdown bago mag-restart. */
  gameOver(wave: number, restartMs: number) {
    const cx = GAME.width / 2;
    const cy = GAME.height / 2;
    const overlay = this.scene.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, HUD.overlayAlpha).setOrigin(0);
    const title = this.scene.add.text(cx, cy - HUD.overFontSize, 'NASAKOP\nANG BARYO!', {
      ...text(HUD.overFontSize, THEME.dangerCss),
      align: 'center',
    }).setOrigin(0.5);
    const sub = this.scene.add
      .text(cx, cy + HUD.overFontSize * 0.6, `Umabot sa Wave ${wave}`, text(HUD.fontSize * 1.4, THEME.accentCss))
      .setOrigin(0.5);
    const count = this.scene.add.text(cx, cy + HUD.overFontSize * 1.4, '', text(HUD.fontSize)).setOrigin(0.5);
    for (const o of [overlay, title, sub, count]) o.setDepth(DEPTH + 2);
    overlay.setAlpha(0);
    this.scene.tweens.add({ targets: overlay, alpha: 1, duration: HUD.toastFadeMs });
    const end = this.scene.time.now + restartMs;
    this.scene.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => count.setText(`Bagong laban sa ${Math.max(0, Math.ceil((end - this.scene.time.now) / 1000))}s…`),
    });
  }

  /** "Paano tumulong" card — galing sa config para laging tugma sa mapping. */
  private createLegend() {
    const rows: { icon: string; label: string; unit: DefenderKind; n: number }[] = [
      { icon: ICONS.like, label: `${SPAWN.likesPerTanod} likes`, unit: 'tanod', n: 1 },
      ...Object.entries(GIFTS).map(([gift, m]) => ({
        icon: ICONS.gifts[gift] ?? ICONS.gift,
        label: gift,
        unit: m.unit,
        n: m.perGift,
      })),
      { icon: ICONS.follow, label: 'Follow', unit: FOLLOW.unit, n: FOLLOW.count },
      ...Object.entries(CHAT.commands).map(([cmd, unit]) => ({ icon: ICONS.chat, label: cmd, unit, n: 1 })),
    ];
    const pad = HUD.panelPad;
    const x = HUD.padding;
    const y = HUD.legendY;
    const w = HUD.legendWidth;
    const h = pad * 2 + HUD.legendFontSize + HUD.gap + rows.length * HUD.legendRowH;
    const panel = this.scene.add.graphics();
    drawPanel(panel, x, y, w, h);
    const objs: Phaser.GameObjects.GameObject[] = [panel];
    objs.push(this.scene.add.text(x + pad, y + pad, 'PAANO TUMULONG', text(HUD.legendFontSize, THEME.accentCss)));
    rows.forEach((r, i) => {
      const ry = y + pad + HUD.legendFontSize + HUD.gap + i * HUD.legendRowH + HUD.legendRowH / 2;
      const s = DEFENDERS[r.unit];
      const icon = HUD.legendIconSize;
      const scale = icon / Math.max(s.width, s.height);
      objs.push(
        this.scene.add.text(x + pad, ry, `${r.icon} ${r.label}`, text(HUD.legendFontSize)).setOrigin(0, 0.5),
        this.scene.add
          .text(x + w - pad - icon - HUD.gap, ry, `${r.n > 1 ? `${r.n}× ` : ''}${s.name}`, text(HUD.legendFontSize, THEME.textDim))
          .setOrigin(1, 0.5),
        makeShape(this.scene, s.shape, s.width * scale, s.height * scale, s.color)
          .setPosition(x + w - pad - icon / 2, ry)
          .setStrokeStyle(2, THEME.outline),
      );
    });
    for (const o of objs) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(DEPTH);
  }
}

function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number = HUD.panelRadius) {
  g.fillStyle(THEME.panel, THEME.panelAlpha).fillRoundedRect(x, y, w, h, r);
  g.lineStyle(2, THEME.panelBorder, THEME.panelBorderAlpha).strokeRoundedRect(x, y, w, h, r);
}

function drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, ratio: number, color: number) {
  const r = Math.min(HUD.barRadius, h / 2);
  g.fillStyle(THEME.barBg, THEME.barBgAlpha).fillRoundedRect(x, y, w, h, r);
  const fw = w * Phaser.Math.Clamp(ratio, 0, 1);
  if (fw <= 0) return;
  g.fillStyle(color, 1).fillRoundedRect(x, y, fw, h, Math.min(r, fw / 2));
  // kintab sa itaas na kalahati
  g.fillStyle(0xffffff, 0.18).fillRoundedRect(x, y, fw, h / 2, { tl: Math.min(r, fw / 2), tr: Math.min(r, fw / 2), bl: 0, br: 0 });
}
