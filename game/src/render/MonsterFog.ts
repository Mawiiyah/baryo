import type { World } from '../sim/World';
import './monsterFog.css';

interface EyeEntry {
  el: HTMLElement;
  nextBlink: number;
  blinkEnd: number;
}

export class MonsterFog {
  readonly root: HTMLDivElement;
  private flankLeft: HTMLDivElement;
  private flankRight: HTMLDivElement;
  private eyes: EyeEntry[] = [];
  private flareTimeout: number | null = null;
  private enabled = true;

  /** `flanks: false` = walang hamog/mata sa gilid (hal. sa 'baha', may mga lubog na bahay doon). */
  constructor(parent: HTMLElement, world?: World, opts: { flanks?: boolean } = {}) {
    this.root = document.createElement('div');
    this.root.className = 'monster-fog-root';
    if (opts.flanks === false) this.root.classList.add('mf-no-flanks');

    // (Ang buwan at ulap ay nasa 3D na langit na: World3D.buildSkyMoon, para hindi sumama sa ikot ng camera.)

    // 2. Kaliwang Hamog at Silhouettes ng Halimaw na may Kumikislap na Mata
    this.flankLeft = document.createElement('div');
    this.flankLeft.className = 'mf-flank mf-flank-left';
    const fogLeftImg = document.createElement('img');
    fogLeftImg.className = 'mf-fog-img';
    fogLeftImg.src = `${import.meta.env.BASE_URL}effects/left_monster_fog.png`;
    this.flankLeft.appendChild(fogLeftImg);

    // Mga nakasilip na mata sa kaliwa (mula sa pixel coordinate detection)
    this.addSingleEye(this.flankLeft, 23.8, 14.3);
    this.addEyePair(this.flankLeft, 16.5, 18.6, 9);
    this.addSingleEye(this.flankLeft, 33.2, 19.4);
    this.addEyePair(this.flankLeft, 34.4, 45.1, 8);

    this.root.appendChild(this.flankLeft);

    // 3. Kanang Hamog at Silhouettes ng Halimaw na may Kumikislap na Mata
    this.flankRight = document.createElement('div');
    this.flankRight.className = 'mf-flank mf-flank-right';
    const fogRightImg = document.createElement('img');
    fogRightImg.className = 'mf-fog-img';
    fogRightImg.src = `${import.meta.env.BASE_URL}effects/right_monster_fog.png`;
    this.flankRight.appendChild(fogRightImg);

    // Mga nakasilip na mata sa kanan
    this.addEyePair(this.flankRight, 82.1, 26.0, 9);
    this.addSingleEye(this.flankRight, 87.0, 34.2);

    this.root.appendChild(this.flankRight);

    // Ambient ground mist
    const mistL = document.createElement('div');
    mistL.className = 'mf-creeping-mist-left';
    const mistR = document.createElement('div');
    mistR.className = 'mf-creeping-mist-right';
    this.root.append(mistL, mistR);

    // Ikabit sa stage (bago ang HUD o sa tamang z-order)
    parent.appendChild(this.root);

    // Makinig sa mga pangyayari sa mundo (pag-spawn ng halimaw, boss)
    if (world) {
      world.on((e) => {
        if (e.type === 'spawn' && e.unit.side === 'attacker') {
          this.triggerFlare();
        } else if (e.type === 'attack' && e.unit.side === 'attacker') {
          this.triggerCombatPulse();
        }
        if (e.type === 'breath') {
          this.triggerFlare(3000);
        } else if (e.type === 'slam' || e.type === 'summon') {
          this.triggerFlare(2000);
        }
      });
    }
  }

  private addSingleEye(parent: HTMLElement, leftPct: number, topPct: number) {
    const eye = document.createElement('div');
    eye.className = 'mf-eye';
    eye.style.left = `${leftPct}%`;
    eye.style.top = `${topPct}%`;
    parent.appendChild(eye);
    this.registerEye(eye);
  }

  private addEyePair(parent: HTMLElement, leftPct: number, topPct: number, gapPx: number) {
    const pair = document.createElement('div');
    pair.className = 'mf-eye-pair';
    pair.style.left = `${leftPct}%`;
    pair.style.top = `${topPct}%`;
    pair.style.gap = `${gapPx}px`;

    const pupil1 = document.createElement('span');
    pupil1.className = 'mf-pupil';
    const pupil2 = document.createElement('span');
    pupil2.className = 'mf-pupil';
    pair.append(pupil1, pupil2);
    parent.appendChild(pair);

    this.registerEye(pupil1);
    this.registerEye(pupil2);
  }

  private registerEye(el: HTMLElement) {
    this.eyes.push({
      el,
      nextBlink: performance.now() + 1500 + Math.random() * 5000,
      blinkEnd: 0,
    });
  }

  /**
   * Pikit-dilat ng mga mata ng halimaw sa dilim.
   * Tinatawag sa game loop (rAF).
   */
  update(_dt: number) {
    if (!this.enabled) return;
    const now = performance.now();
    for (const e of this.eyes) {
      if (now > e.nextBlink) {
        e.el.classList.add('mf-blink');
        e.blinkEnd = now + 120 + Math.random() * 60;
        e.nextBlink = now + 3000 + Math.random() * 7000;
      } else if (e.blinkEnd > 0 && now > e.blinkEnd) {
        e.el.classList.remove('mf-blink');
        e.blinkEnd = 0;
      }
    }
  }

  /** Nagliliyab ang mga mata at kumakapal ang hamog kapag may lumalabas na halimaw */
  triggerFlare(durationMs = 1500) {
    if (!this.enabled) return;
    this.flankLeft.classList.add('mf-flare');
    this.flankRight.classList.add('mf-flare');
    for (const e of this.eyes) e.el.classList.add('mf-flare');

    if (this.flareTimeout) window.clearTimeout(this.flareTimeout);
    this.flareTimeout = window.setTimeout(() => {
      this.flankLeft.classList.remove('mf-flare');
      this.flankRight.classList.remove('mf-flare');
      for (const e of this.eyes) e.el.classList.remove('mf-flare');
      this.flareTimeout = null;
    }, durationMs);
  }

  /** Maikling kislap ng mga mata sa hamog kapag may bakbakan/atake ang halimaw */
  triggerCombatPulse() {
    if (!this.enabled) return;
    for (const e of this.eyes) {
      if (Math.random() < 0.65) {
        e.el.classList.add('mf-flare');
        window.setTimeout(() => e.el.classList.remove('mf-flare'), 320);
      }
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.root.style.display = on ? '' : 'none';
  }
}
