import * as THREE from 'three';
import { CAM_PICKER, SCENE3D as S } from '../config';

type Vec = { x: number; y: number; z: number };
export type CamMode = (typeof CAM_PICKER.modes)[number];
export type CamModeId = CamMode['id'];

/**
 * 360° na camera sa paligid ng tinitingnan: drag = ikot (azimuth/polar), wheel = zoom,
 * double-click o `orbit.resetKey` = balik sa preset ng mode, `orbit.autoKey` = kusang ikot.
 * Ang mode (CAM_PICKER) ang nagtatakda ng preset at kung sinusundan ang gitna ng laban.
 * Ang pag-click sa mga button (MAPA, CAMERA, debug panel) ay hindi nagpapaikot.
 */
export class CameraOrbit {
  private readonly homeTarget: THREE.Vector3;
  private readonly target: THREE.Vector3;
  private readonly home: THREE.Spherical;
  private readonly goal: THREE.Spherical;
  private readonly cur: THREE.Spherical;
  private mode: CamMode = CAM_PICKER.modes[0];
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private auto = false;

  constructor(pos: Vec, lookAt: Vec) {
    this.homeTarget = new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z);
    this.target = this.homeTarget.clone();
    this.home = new THREE.Spherical().setFromVector3(new THREE.Vector3(pos.x, pos.y, pos.z).sub(this.homeTarget));
    this.goal = this.home.clone();
    this.cur = this.home.clone();

    const O = S.orbit;
    const interactive = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest('button, a, input, select, textarea, .map-picker, .debug-panel');
    window.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !this.mode.drag || interactive(e.target)) return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.goal.theta -= (e.clientX - this.lastX) * O.dragSpeed;
      this.goal.phi = THREE.MathUtils.clamp(this.goal.phi - (e.clientY - this.lastY) * O.dragSpeed, O.minPolar, O.maxPolar);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => (this.dragging = false));
    window.addEventListener('blur', () => (this.dragging = false));
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.mode.drag || interactive(e.target)) return;
        const r = this.goal.radius * Math.exp(e.deltaY * O.zoomSpeed);
        this.goal.radius = THREE.MathUtils.clamp(r, this.home.radius * O.minDistScale, this.home.radius * O.maxDistScale);
      },
      { passive: true },
    );
    window.addEventListener('dblclick', (e) => {
      if (!interactive(e.target)) this.reset();
    });
    window.addEventListener('keydown', (e) => {
      const k = e.key.toUpperCase();
      if (k === O.resetKey) this.reset();
      else if (k === O.autoKey) this.auto = !this.auto;
    });
  }

  get modeId(): CamModeId {
    return this.mode.id;
  }

  setMode(id: CamModeId) {
    this.mode = CAM_PICKER.modes.find((m) => m.id === id) ?? CAM_PICKER.modes[0];
    this.dragging = false;
    this.reset();
  }

  /** Balik sa preset ng mode (pinakamalapit na ikot, hindi paikot-ikot pabalik). */
  reset() {
    const m = this.mode;
    this.auto = m.spin;
    const twoPi = Math.PI * 2;
    const theta = this.home.theta + m.turn;
    const turns = Math.round((this.cur.theta - theta) / twoPi);
    this.goal.set(this.home.radius * m.radius, m.phi ?? this.home.phi, theta + turns * twoPi);
  }

  /**
   * Inilalagay ang camera sa kasalukuyang posisyon ng ikot (+ shake offset).
   * @param focus gitna ng laban (null = walang laban → balik sa default na tinitingnan)
   */
  apply(camera: THREE.PerspectiveCamera, dtMs: number, shakeX: number, shakeY: number, focus: THREE.Vector3 | null) {
    const dt = dtMs / 1000;
    if (this.auto) this.goal.theta += S.orbit.autoSpeed * dt;
    const want = this.mode.follow && focus ? focus : this.homeTarget;
    this.target.lerp(want, 1 - Math.exp(-S.orbit.focusLerp * dt));
    const k = 1 - Math.exp(-S.orbit.ease * dt);
    this.cur.radius += (this.goal.radius - this.cur.radius) * k;
    this.cur.phi += (this.goal.phi - this.cur.phi) * k;
    this.cur.theta += (this.goal.theta - this.cur.theta) * k;
    camera.position.setFromSpherical(this.cur).add(this.target);
    camera.lookAt(this.target);
    camera.position.x += shakeX;
    camera.position.y += shakeY;
  }
}
