import Phaser from 'phaser';
import { BASE, GAME, HUD, KUBO, SCENERY as S } from '../config';

/** Gabi sa baryo: langit, buwan, bituin, burol, niyog, lupa, hamog. Puro Graphics (original). */
export function drawScenery(scene: Phaser.Scene) {
  const { width: W, height: H, groundTop: gTop, groundBottom: gBot } = GAME;
  const g = scene.add.graphics().setDepth(-100);

  // Langit
  vGradient(g, 0, 0, W, gTop, S.skyTop, S.skyBottom);

  // Buwan + glow
  for (let i = S.moonGlowRings; i > 0; i--) {
    g.fillStyle(S.moonGlow, S.moonGlowAlpha);
    g.fillCircle(S.moonX, S.moonY, S.moonR + i * S.moonGlowStep);
  }
  g.fillStyle(S.moonColor, 1).fillCircle(S.moonX, S.moonY, S.moonR);
  g.fillStyle(S.moonCrater, 1);
  g.fillCircle(S.moonX - S.moonR * 0.3, S.moonY - S.moonR * 0.2, S.moonR * 0.18);
  g.fillCircle(S.moonX + S.moonR * 0.25, S.moonY + S.moonR * 0.3, S.moonR * 0.12);
  g.fillCircle(S.moonX + S.moonR * 0.35, S.moonY - S.moonR * 0.35, S.moonR * 0.08);

  // Bituin (kumikislap)
  for (let i = 0; i < S.starCount; i++) {
    const x = Phaser.Math.Between(0, W);
    const y = Phaser.Math.Between(0, S.starMaxY);
    if (Phaser.Math.Distance.Between(x, y, S.moonX, S.moonY) < S.moonR * 2) continue;
    const star = scene.add
      .circle(x, y, Phaser.Math.FloatBetween(S.starMinR, S.starMaxR), 0xffffff)
      .setDepth(-99)
      .setAlpha(Phaser.Math.FloatBetween(0.3, 1));
    scene.tweens.add({
      targets: star,
      alpha: Phaser.Math.FloatBetween(0.1, 0.4),
      duration: Phaser.Math.Between(S.starTwinkleMinMs, S.starTwinkleMaxMs),
      yoyo: true,
      repeat: -1,
      delay: Phaser.Math.Between(0, S.starTwinkleMaxMs),
    });
  }

  const h = scene.add.graphics().setDepth(-98);
  // Burol
  for (const hill of S.hills) {
    const pts: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: gTop }];
    for (let x = 0; x <= W; x += 20) {
      const k = 0.5 + 0.3 * Math.sin(x * hill.freq + hill.phase) + 0.2 * Math.sin(x * hill.freq * 2.7);
      pts.push({ x, y: gTop - hill.height * k });
    }
    pts.push({ x: W, y: gTop });
    h.fillStyle(hill.color, 1).fillPoints(pts, true);
  }

  // Puno ng niyog (silhouette)
  for (const p of S.palms) drawPalm(h, p.x, gTop, p.h, p.lean);

  // Lupa
  vGradient(h, 0, gTop, W, gBot - gTop, S.groundTopColor, S.groundBottomColor);
  h.fillStyle(S.groundEdge, 1).fillRect(0, gTop, W, S.groundEdgeWidth);
  vGradient(h, 0, gBot, W, H - gBot, S.soilTop, S.soilBottom);

  // Damo
  for (let i = 0; i < S.grassCount; i++) {
    const x = Phaser.Math.Between(0, W);
    const y = Phaser.Math.Between(gTop + S.groundEdgeWidth + S.grassMaxH, gBot);
    const gh = Phaser.Math.Between(S.grassMinH, S.grassMaxH);
    h.fillStyle(Phaser.Math.Between(0, 1) ? S.grassColor : S.grassDark, 1);
    h.fillTriangle(x - 4, y, x + 4, y, x + Phaser.Math.Between(-6, 6), y - gh);
  }

  // Hamog sa horizon
  const fog = scene.add.graphics().setDepth(-97);
  fog.fillStyle(S.fogColor, S.fogAlpha);
  for (let i = 0; i < 3; i++) fog.fillEllipse(W * (0.2 + i * 0.35), S.fogY, W * 0.7, S.fogH);
  scene.tweens.add({
    targets: fog,
    x: S.fogDriftPx,
    duration: S.fogDriftMs,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // Dilim sa kanan (doon nanggagaling ang halimaw)
  const dark = scene.add.graphics().setDepth(-96);
  const strip = S.darknessWidth / S.gradientSteps;
  for (let i = 0; i < S.gradientSteps; i++) {
    dark.fillStyle(0x000000, S.darknessAlpha * ((i + 1) / S.gradientSteps) ** 2);
    dark.fillRect(W - S.darknessWidth + i * strip, 0, strip, H);
  }
}

/** Vertical gradient gamit ang mga strip (gumagana sa Canvas at WebGL, hindi tulad ng fillGradientStyle). */
function vGradient(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, top: number, bottom: number) {
  const a = Phaser.Display.Color.ValueToColor(top);
  const b = Phaser.Display.Color.ValueToColor(bottom);
  const step = h / S.gradientSteps;
  for (let i = 0; i < S.gradientSteps; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, S.gradientSteps - 1, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(x, y + i * step, w, step + 1);
  }
}

function drawPalm(g: Phaser.GameObjects.Graphics, x: number, baseY: number, height: number, lean: number) {
  g.fillStyle(S.palmColor, 1);
  g.lineStyle(S.palmTrunkWidth, S.palmColor, 1);
  const steps = 8;
  let px = x;
  let py = baseY;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const nx = x + lean * t * t;
    const ny = baseY - height * t;
    g.lineBetween(px, py, nx, ny);
    px = nx;
    py = ny;
  }
  for (let i = 0; i < S.palmLeaves; i++) {
    const a = Math.PI + (i / (S.palmLeaves - 1)) * Math.PI; // pakaliwa → pakanan, pataas
    const tipX = px + Math.cos(a) * S.palmLeaf;
    const tipY = py + Math.sin(a) * S.palmLeaf * 0.45 + S.palmLeaf * 0.35; // nakalaylay
    const midX = (px + tipX) / 2;
    const midY = (py + tipY) / 2 - S.palmLeaf * 0.15;
    g.fillTriangle(px, py - 6, px, py + 6, midX, midY);
    g.fillTriangle(midX, midY - 6, midX, midY + 6, tipX, tipY);
  }
}

/** Bahay Kubo na may stilts, dingding na kawayan, ilaw sa bintana, at pawid na bubong. */
export class Kubo {
  readonly container: Phaser.GameObjects.Container;
  private lastShake = -Infinity;

  constructor(private scene: Phaser.Scene) {
    const bottom = GAME.groundBottom - (GAME.groundBottom - GAME.groundTop) / 2;
    const g = scene.add.graphics();
    const w = BASE.width;
    const half = w / 2;
    const wallBottom = -KUBO.stiltHeight;
    const wallTop = wallBottom - BASE.height;
    const o = HUD.strokeWidth;

    // Anino
    g.fillStyle(0x000000, 0.35).fillEllipse(0, 0, w * 1.2, 30);
    // Stilts
    g.fillStyle(KUBO.stiltColor, 1);
    for (const sx of [-half + 10, -KUBO.stiltWidth / 2, half - 10 - KUBO.stiltWidth]) {
      g.fillRect(sx, wallBottom, KUBO.stiltWidth, KUBO.stiltHeight);
    }
    // Dingding (kawayan)
    g.fillStyle(BASE.wallColor, 1).fillRect(-half, wallTop, w, BASE.height);
    g.lineStyle(2, KUBO.wallLineColor, 1);
    for (let i = 1; i < KUBO.wallLines; i++) {
      const lx = -half + (w / KUBO.wallLines) * i;
      g.lineBetween(lx, wallTop, lx, wallBottom);
    }
    g.lineStyle(o, 0x000000, 1).strokeRect(-half, wallTop, w, BASE.height);
    // Sahig
    g.fillStyle(KUBO.floorColor, 1).fillRect(-half - 8, wallBottom - KUBO.floorHeight / 2, w + 16, KUBO.floorHeight);
    // Bintana na may ilaw
    const winX = half * 0.35;
    const winY = wallTop + BASE.height * 0.32;
    g.fillStyle(KUBO.windowColor, KUBO.windowGlowAlpha).fillCircle(winX, winY, KUBO.windowGlowR);
    g.fillStyle(KUBO.windowColor, 1).fillRect(winX - KUBO.windowW / 2, winY - KUBO.windowH / 2, KUBO.windowW, KUBO.windowH);
    g.lineStyle(o, 0x000000, 1).strokeRect(winX - KUBO.windowW / 2, winY - KUBO.windowH / 2, KUBO.windowW, KUBO.windowH);
    g.lineBetween(winX, winY - KUBO.windowH / 2, winX, winY + KUBO.windowH / 2);
    // Pinto
    const doorX = -half * 0.45;
    g.fillStyle(KUBO.doorColor, 1).fillRect(doorX - KUBO.doorW / 2, wallBottom - KUBO.doorH, KUBO.doorW, KUBO.doorH);
    g.lineStyle(o, 0x000000, 1).strokeRect(doorX - KUBO.doorW / 2, wallBottom - KUBO.doorH, KUBO.doorW, KUBO.doorH);
    // Bubong (pawid)
    const rl = -half - BASE.roofOverhang;
    const rr = half + BASE.roofOverhang;
    const peak = wallTop - BASE.roofHeight;
    g.fillStyle(BASE.roofColor, 1).fillTriangle(rl, wallTop + 10, rr, wallTop + 10, 0, peak);
    g.lineStyle(3, KUBO.thatchColor, 1);
    for (let i = 1; i <= KUBO.thatchLines; i++) {
      const t = i / (KUBO.thatchLines + 1);
      const y = peak + (wallTop + 10 - peak) * t;
      g.lineBetween(rl * t + 6, y, rr * t - 6, y);
    }
    g.lineStyle(o, 0x000000, 1).strokeTriangle(rl, wallTop + 10, rr, wallTop + 10, 0, peak);

    this.container = scene.add.container(BASE.x, bottom, [g]).setDepth(bottom);
  }

  /** Inuuga kapag tinamaan (may cooldown para hindi tuloy-tuloy). */
  hit() {
    const now = this.scene.time.now;
    if (now - this.lastShake < KUBO.shakeCooldownMs) return;
    this.lastShake = now;
    this.scene.tweens.add({
      targets: this.container,
      x: BASE.x + KUBO.shakePx,
      duration: KUBO.shakeMs,
      yoyo: true,
      repeat: 1,
      onComplete: () => this.container.setX(BASE.x),
    });
  }
}
