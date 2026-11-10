import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { FX, GAME, LANE, SCENE3D as S } from '../config';
import type { SimUnit, World, WorldEvent } from '../sim/World';
import { randFloat } from '../sim/rand';
import { buildBarangay } from './barangay';
import { buildBaha } from './baha';
import { buildKubo, buildModel, type Model } from './models';
import { fogTexture, glowTexture, palm, torchFlame, type Torch } from './scenery';
import { buildTemplo } from './templo';

interface UnitView {
  unit: SimUnit;
  group: THREE.Group;
  model: Model;
  label: CSS2DObject;
  labelInner: HTMLDivElement;
  hpFill: HTMLDivElement | null;
  bornAt: number;
  diedAt: number | null;
  lungeAt: number;
  staggerAt: number;
  flashUntil: number;
  phase: number;
  targetView: UnitView | null;
}

interface Fx {
  obj: THREE.Object3D;
  start: number;
  dur: number;
  tick: (p: number) => void;
  shared?: boolean; // shared na geometry/material: huwag i-dispose
}

/** Tapered crescent slash geometry para sa mga atake/kuko/suntok. */
function createSlashGeometry(radius: number, width: number, arcAngle: number, segments = 16): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = -arcAngle / 2 + t * arcAngle;
    const w = Math.sin(t * Math.PI) * width;
    const rIn = Math.max(0.05, radius - w * 0.5);
    const rOut = radius + w * 0.5;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    positions.push(rIn * cos, rIn * sin, 0);
    uvs.push(t, 0);

    positions.push(rOut * cos, rOut * sin, 0);
    uvs.push(t, 1);
  }

  for (let i = 0; i < segments; i++) {
    const v0 = i * 2;
    const v1 = i * 2 + 1;
    const v2 = (i + 1) * 2;
    const v3 = (i + 1) * 2 + 1;
    indices.push(v0, v1, v2);
    indices.push(v2, v1, v3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.userData.shared = true;
  return geo;
}

// Shared na geometry para sa maraming maliliit na particle at slashes
const SPARK_GEO = new THREE.SphereGeometry(1, 6, 4);
SPARK_GEO.userData.shared = true;

const SLASH_GEO_M = createSlashGeometry(0.85, 0.42, Math.PI * 0.65);
const SLASH_GEO_L = createSlashGeometry(1.6, 0.72, Math.PI * 0.75);
const CLASH_FLASH_GEO = new THREE.PlaneGeometry(1, 1);
CLASH_FLASH_GEO.userData.shared = true;

/** posisyon sa mundo: pos → z, lat → x (baligtad para kaliwa sa screen ang -lat). */
const toVec = (u: SimUnit, out = new THREE.Vector3()) => out.set(-u.lat, u.alt, u.pos);
/** Visual na taas ng unit (stats.size × unitScale). */
/** Aktibong camera view (tingnan ang SCENE3D.view). */
function getViewConfig() {
  const bf = S.battlefield;
  if (S.view === 'behind') {
    if (bf === 'barangay' || bf === 'baha') return { ...S.views.behind, ...S.barangay.camera };
    if (bf === 'templo') return { ...S.views.behind, ...S.templo.camera };
  }
  return S.views[S.view];
}
const SIDE = S.view === 'side';
const vsz = (u: SimUnit): number => u.stats.size * S.unitScale;
const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

export class World3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private views = new Map<number, UnitView>();
  private fx: Fx[] = [];
  private torches: Torch[] = [];
  private envTick: ((t: number) => void) | null = null;
  private kubo!: THREE.Group;
  private kuboShakeAt = -Infinity;
  private spawnGlow!: THREE.PointLight;
  private moonLight!: THREE.DirectionalLight;
  private moonMat!: THREE.MeshBasicMaterial;
  private moonGlow!: THREE.Sprite;
  private hemi!: THREE.HemisphereLight;
  private fog!: THREE.Fog;
  /** Normal na kulay ng hamog (iba sa 'baha': kulay-abo ng ulan). */
  private fogBase: number = S.battlefield === 'baha' ? S.baha.fogColor : S.fogColor;
  private currentFogNear: number = S.fogNear;
  private darkenPulse = 0;
  private spawnGlowSurge = 0;
  private ambientMist: THREE.Sprite[] = [];
  private shakeUntil = 0;
  private shakeAmount = 0;
  private sparks = 0;
  private time = 0;
  private dt = 0;
  private tmp = new THREE.Vector3();
  private V = getViewConfig();

  constructor(parent: HTMLElement, world: World) {
    // Pixelated kapag pixelScale > 1 (mababang resolution, pinalalaki nang walang blur); makinis kapag 1
    const smooth = S.pixelScale <= 1;
    this.renderer = new THREE.WebGLRenderer({ antialias: smooth });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(Math.round(GAME.width / S.pixelScale), Math.round(GAME.height / S.pixelScale), false);
    Object.assign(this.renderer.domElement.style, { width: `${GAME.width}px`, height: `${GAME.height}px`, imageRendering: smooth ? 'auto' : 'pixelated' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = S.exposure;
    parent.appendChild(this.renderer.domElement);

    // Vignette: madilim na purple-black sa mga gilid (nasa pagitan ng 3D at labels/HUD)
    if (S.vignette > 0) {
      const vg = document.createElement('div');
      Object.assign(vg.style, {
        position: 'absolute',
        inset: '0',
        zIndex: '1',
        pointerEvents: 'none',
        background: `radial-gradient(ellipse at 50% 55%, rgba(10,4,24,0) 42%, rgba(10,4,24,${S.vignette * 0.55}) 75%, rgba(4,1,12,${S.vignette}) 100%)`,
      });
      parent.appendChild(vg);
    }

    this.labels = new CSS2DRenderer();
    this.labels.setSize(GAME.width, GAME.height);
    this.labels.domElement.className = 'labels';
    parent.appendChild(this.labels.domElement);

    const V = this.V;
    this.camera = new THREE.PerspectiveCamera(V.fov, GAME.width / GAME.height, 0.1, 200);
    this.camera.position.set(V.cameraPos.x, V.cameraPos.y, V.cameraPos.z);
    this.camera.lookAt(V.cameraLookAt.x, V.cameraLookAt.y, V.cameraLookAt.z);

    this.buildEnvironment();
    world.on((e) => this.onWorld(e));
  }

  // ---------- Kapaligiran ----------
  private buildEnvironment() {
    const sc = this.scene;
    const V = this.V;
    sc.background = skyTexture();
    this.fog = new THREE.Fog(this.fogBase, S.fogNear, S.fogFar);
    sc.fog = this.fog;

    this.hemi = new THREE.HemisphereLight(S.hemiSky, S.hemiGround, S.hemiIntensity);
    sc.add(this.hemi);
    this.moonLight = new THREE.DirectionalLight(S.moonLight, S.moonIntensity);
    this.moonLight.position.set(V.moonLightPos.x, V.moonLightPos.y, V.moonLightPos.z);
    this.moonLight.target.position.set(0, 0, LANE.frontLinePos);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(S.shadowMapSize, S.shadowMapSize);
    const c = this.moonLight.shadow.camera;
    c.left = c.bottom = -S.shadowArea;
    c.right = c.top = S.shadowArea;
    c.far = 100;
    sc.add(this.moonLight, this.moonLight.target);

    // Buwan + glow + bituin (hindi apektado ng hamog)
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(S.moonRadius, 24, 16),
      new THREE.MeshBasicMaterial({ color: S.moonColor, fog: false }),
    );
    moonMesh.position.set(V.moonPos.x, V.moonPos.y, V.moonPos.z);
    this.moonMat = moonMesh.material;
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: S.moonGlowColor, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
    );
    glow.scale.setScalar(S.moonGlowScale);
    glow.position.copy(moonMesh.position);
    this.moonGlow = glow;
    if (S.battlefield === 'barangay' || S.battlefield === 'baha') {
      moonMesh.visible = false;
      glow.visible = false;
    }
    sc.add(moonMesh, glow);
    const starPos: number[] = [];
    for (let i = 0; i < S.starCount; i++) {
      const th = randFloat(-Math.PI * 0.6, Math.PI * 0.6);
      const ph = randFloat(0.12, Math.PI / 2);
      starPos.push(S.starRadius * Math.sin(th) * Math.cos(ph), S.starRadius * Math.sin(ph), S.starRadius * Math.cos(th) * Math.cos(ph));
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    if (S.battlefield !== 'baha') sc.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: S.starSize, fog: false }))); // walang bituin sa bagyo

    const bf = S.battlefield;
    if (bf === 'barangay' || bf === 'baha') {
      const b = bf === 'baha' ? buildBaha(sc) : buildBarangay(sc);
      this.torches.push(...b.torches);
      this.envTick = b.tick;
      this.kubo = b.base as THREE.Group;
    } else if (bf === 'templo') {
      const b = buildTemplo(sc);
      this.torches.push(...b.torches);
      this.envTick = b.tick;
      this.buildBaseKubo(sc);
    } else {
      this.buildBaryo();
      this.buildBaseKubo(sc);
    }
    this.spawnGlow = new THREE.PointLight(0x7a18b8, 22, 18, 2);
    this.spawnGlow.position.set(0, 2, LANE.spawnPos - 2);
    sc.add(this.spawnGlow);

    // Eerie gumagapang na hamog sa paligid ng pinto kung saan lumalabas ang halimaw
    for (let i = 0; i < S.ambientMistCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: fogTexture(),
        color: S.ambientMistColor,
        transparent: true,
        opacity: S.ambientMistOpacity,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      const rz = randFloat(LANE.spawnPos - 8, LANE.spawnPos + 4);
      const rx = randFloat(-LANE.halfWidth * 1.3, LANE.halfWidth * 1.3);
      sp.position.set(rx, randFloat(0.25, 0.75), rz);
      const sc2 = randFloat(4.5, 7.5);
      sp.scale.set(sc2, sc2 * 0.45, 1);
      sc.add(sp);
      this.ambientMist.push(sp);
    }
  }

  private buildBaseKubo(sc: THREE.Scene) {
    this.kubo = buildKubo();
    this.kubo.scale.setScalar(this.V.kuboScale);
    this.kubo.position.set(0, 0, S.kuboPos);
    this.kubo.rotation.y = SIDE ? Math.PI / 2 : 0; // pinto nakaharap sa camera
    const kl = new THREE.PointLight(S.kuboLight, S.kuboLightIntensity, 12, 2);
    kl.position.set(0, 2.6, -2.4);
    this.kubo.add(kl);
    sc.add(this.kubo);
  }

  /** Lumang battlefield: daang lupa, bakod na kawayan, sulo, niyog, kubo at gubat. */
  private buildBaryo() {
    const sc = this.scene;
    // Lupa at daan
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 140), new THREE.MeshStandardMaterial({ color: S.groundColor, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = 40;
    ground.receiveShadow = true;
    sc.add(ground);
    const pathLen = LANE.spawnPos + 10;
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE.halfWidth * 2 + 1, pathLen),
      new THREE.MeshStandardMaterial({ color: S.pathColor, roughness: 1 }),
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.01, pathLen / 2 - 2);
    path.receiveShadow = true;
    sc.add(path);
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.4, pathLen), new THREE.MeshStandardMaterial({ color: S.pathEdgeColor, roughness: 1 }));
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(side * (LANE.halfWidth + 0.5), 0.015, pathLen / 2 - 2);
      edge.receiveShadow = true;
      sc.add(edge);
    }

    // Damo (instanced)
    const tuftGeo = new THREE.ConeGeometry(0.08, 0.4, 4);
    tuftGeo.translate(0, 0.2, 0);
    const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshStandardMaterial({ color: S.grassColor, roughness: 1 }), S.grassTufts);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < S.grassTufts; i++) {
      let x = randFloat(-S.grassArea, S.grassArea);
      if (Math.abs(x) < LANE.halfWidth + 0.7) x += Math.sign(x || 1) * (LANE.halfWidth + 0.7);
      const sc2 = randFloat(0.6, 1.5);
      q.setFromEuler(new THREE.Euler(randFloat(-0.2, 0.2), randFloat(0, Math.PI), randFloat(-0.2, 0.2)));
      m.compose(new THREE.Vector3(x, 0, randFloat(-6, 50)), q, new THREE.Vector3(sc2, sc2, sc2));
      tufts.setMatrixAt(i, m);
    }
    tufts.receiveShadow = true;
    sc.add(tufts);

    // Bakod na kawayan sa gilid ng daan
    const fenceMat = new THREE.MeshStandardMaterial({ color: S.fenceColor, roughness: 0.8 });
    const fenceStart = LANE.baseHitPos + 2;
    for (const side of SIDE ? [1] : [-1, 1]) { // side view: malayong gilid lang (nasa -x ang camera)
      const x = side * (LANE.halfWidth + S.fenceOffset + 0.5);
      for (let z = fenceStart; z < LANE.length; z += S.fenceSpacing) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 6), fenceMat);
        p.position.set(x, 0.55, z);
        p.castShadow = true;
        sc.add(p);
      }
      for (const y of [0.45, 0.85]) {
        const len = LANE.length - fenceStart;
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), fenceMat);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(x, y, fenceStart + len / 2);
        rail.castShadow = true;
        sc.add(rail);
      }
    }

    // Sulo (torches) na kumukutitap
    for (const side of SIDE ? [1] : [-1, 1]) {
      for (let z = fenceStart + 2; z < LANE.length; z += S.torchSpacing) {
        const x = side * (LANE.halfWidth + S.fenceOffset + 1);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0x3b2a1a }));
        pole.position.set(x, 0.9, z);
        sc.add(pole);
        this.torches.push(torchFlame(sc, x, 1.9, z, S.torchColor));
      }
    }

    // Niyog at kubo sa paligid
    for (let i = 0; i < S.palmCount; i++) {
      const side = SIDE || i % 2 ? 1 : -1;
      const x = side * randFloat(LANE.halfWidth + 3, SIDE ? 22 : 18);
      sc.add(palm(x, randFloat(SIDE ? -6 : -2, SIDE ? 34 : 40), randFloat(4, 7.5), side));
    }
    const huts = SIDE
      ? ([[11, 4, 0.5], [14, 15, -0.6], [12, 25, 0.3]] as const)
      : ([[-11, 8, 0.5], [12, 16, -0.6], [-13, 24, 0.3], [11, 30, -0.2]] as const);
    for (const [x, z, r] of huts) {
      const hut = buildKubo();
      hut.scale.setScalar(0.7);
      hut.position.set(x, 0, z);
      hut.rotation.y = r + (x < 0 ? Math.PI / 2 : -Math.PI / 2);
      sc.add(hut);
    }

    // Gubat sa dulo (doon nanggagaling ang halimaw)
    const forestMat = new THREE.MeshStandardMaterial({ color: S.forestColor, roughness: 1 });
    const tree = (x: number, z: number, h: number) => {
      const t = new THREE.Mesh(new THREE.SphereGeometry(h * 0.45, 10, 8), forestMat);
      t.position.set(x, h * 0.6, z);
      sc.add(t);
    };
    if (SIDE) {
      // likod ng daan, mas makapal sa kanan (doon nanggagaling ang halimaw)
      for (let i = 0; i < 30; i++) tree(randFloat(24, 40), randFloat(-10, 46), randFloat(6, 12));
      for (let i = 0; i < 10; i++) tree(randFloat(6, 20), randFloat(LANE.length + 2, LANE.length + 10), randFloat(6, 10));
    } else {
      // sa dulo ng daan (malayo sa camera)
      for (let i = 0; i < 30; i++) {
        const x = randFloat(-30, 30);
        if (Math.abs(x) > LANE.halfWidth + 1.5) tree(x, randFloat(LANE.spawnPos + 3, LANE.spawnPos + 16), randFloat(6, 12));
      }
    }
    const balete = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.6, 10, 10), forestMat);
    trunk.position.y = 5;
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(8, 14, 10), forestMat);
    canopy.position.y = 13;
    canopy.scale.y = 0.6;
    balete.add(trunk, canopy);
    balete.position.set(SIDE ? 10 : 0, 0, LANE.spawnPos + (SIDE ? 4 : 12));
    sc.add(balete);
  }

  // ---------- Events galing sa World ----------
  private onWorld(e: WorldEvent) {
    switch (e.type) {
      case 'spawn':
        this.addView(e.unit);
        if (e.unit.side === 'attacker') {
          this.spawnEnemyFog(e.unit);
          this.triggerDarkScaryPulse(!!e.unit.stats.boss);
        }
        if (e.unit.stats.boss) this.shake(FX.shakeBoss);
        break;
      case 'death': {
        const v = this.views.get(e.unit.id);
        if (v) {
          this.puff(v);
          v.diedAt = this.time;
          v.label.visible = false;
          for (const m of v.model.mats) m.transparent = true;
        }
        break;
      }
      case 'hit': {
        const v = this.views.get(e.unit.id);
        if (v) {
          if (this.time - v.flashUntil > FX.hitFlashCooldownMs) v.flashUntil = this.time + FX.hitFlashMs;
          v.staggerAt = this.time;
          this.updateHp(v);
          const byView = e.by ? this.views.get(e.by.id) : undefined;
          this.clashImpact(v, byView);
          this.floatText(v, `-${e.amount}`, e.unit.side === 'defender' ? 'dmg-bad' : 'dmg');
        }
        break;
      }
      case 'heal': {
        const from = this.views.get(e.from.id);
        const to = this.views.get(e.to.id);
        if (from && to) {
          this.beam(from, to);
          this.updateHp(to);
          if (e.amount > 0) this.floatText(to, `+${e.amount}`, 'heal');
        }
        break;
      }
      case 'attack': {
        const v = this.views.get(e.unit.id);
        if (v) {
          v.lungeAt = this.time;
          const targetView = e.target ? this.views.get(e.target.id) : null;
          v.targetView = targetView || null;
          this.slashVfx(v, targetView || null);
        }
        break;
      }
      case 'shot': {
        const from = this.views.get(e.from.id);
        if (!from) break;
        if (e.toBase) {
          const kuboPos = new THREE.Vector3(0, 1.8, S.kuboPos + 1.2);
          this.projectileToPoint(from, kuboPos, e.flightMs);
        } else if (e.to) {
          const to = this.views.get(e.to.id);
          if (to) this.projectile(from, to, e.flightMs);
        }
        break;
      }
      case 'baseHit': {
        const kuboPos = new THREE.Vector3(0, 3.4, S.kuboPos + 1.2);
        this.floatTextAt(kuboPos, `-${e.amount}`, 'dmg-bad');
        this.spawnSparks(new THREE.Vector3(randFloat(-1.0, 1.0), randFloat(1.2, 2.2), S.kuboPos + 1.4), 10, 0xffa726);
        if (this.time - this.kuboShakeAt > S.kuboShakeCooldownMs) {
          this.kuboShakeAt = this.time;
          this.shake(FX.shakeBaseHit);
        }
        break;
      }
      case 'slam': {
        const v = this.views.get(e.unit.id);
        if (v) {
          v.lungeAt = this.time;
          this.ring(toVec(e.unit), e.radius, FX.slamColor);
        }
        this.shake(FX.shakeSlam);
        break;
      }
      case 'summon':
        this.ring(toVec(e.unit), LANE.meleeReach * 2, FX.curseColor);
        break;
      case 'breath':
        this.breath(e.unit, e.length);
        this.shake(FX.shakeBreath);
        break;
      case 'reset':
        for (const v of this.views.values()) this.removeView(v);
        this.views.clear();
        break;
      default:
        break;
    }
  }

  private addView(u: SimUnit) {
    const model = buildModel(u.kind, u.stats.color);
    const group = new THREE.Group();
    model.root.scale.setScalar(vsz(u));
    if (u.side === 'attacker') model.root.rotation.y = Math.PI;
    group.add(model.root);
    // anino sa lupa para sa lumilipad
    if (u.stats.flying) {
      const sh = new THREE.Mesh(
        new THREE.CircleGeometry(vsz(u) * 0.35, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
      );
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = -u.alt + 0.03;
      group.add(sh);
    }

    const el = document.createElement('div');
    const inner = document.createElement('div');
    inner.className = `ulabel ${u.side}${u.stats.boss ? ' boss' : ''}`;
    let hpFill: HTMLDivElement | null = null;

    // Pangalan ng hero / karakter sa ibabaw ng ulo (hindi na 'debug')
    const heroName = u.stats.name.toUpperCase();
    const n = document.createElement('div');
    n.className = 'uname';
    n.textContent = heroName;
    inner.appendChild(n);

    // Viewer / gifter kung may totoong nagpadala (hindi generic/debug)
    const owner = u.owner?.trim();
    const isGeneric = !owner || owner.toLowerCase() === 'debug' || owner.toLowerCase() === 'kontra' || owner.toLowerCase() === 'viewer';
    if (!isGeneric) {
      const o = document.createElement('div');
      o.className = 'uowner';
      o.textContent = `ni ${owner}`;
      inner.appendChild(o);
    }

    const hp = document.createElement('div');
    hp.className = 'uhp';
    hpFill = document.createElement('div');
    hp.appendChild(hpFill);
    inner.appendChild(hp);
    el.appendChild(inner);
    const label = new CSS2DObject(el);
    label.position.set(0, vsz(u) * 1.2 + 0.2, 0);
    label.center.set(0.5, 1);
    group.add(label);

    toVec(u, group.position);
    this.scene.add(group);
    const v: UnitView = {
      unit: u, group, model, label, labelInner: inner, hpFill,
      bornAt: this.time, diedAt: null, lungeAt: -Infinity, staggerAt: -Infinity, flashUntil: 0, phase: randFloat(0, Math.PI * 2),
      targetView: null,
    };
    this.updateHp(v);
    this.views.set(u.id, v);
  }

  private updateHp(v: UnitView) {
    const r = v.unit.hp / v.unit.maxHp;
    v.labelInner.classList.toggle('damaged', r < 1 || !!v.unit.stats.boss);
    if (v.hpFill) v.hpFill.style.width = `${Math.max(0, r) * 100}%`;
  }

  private removeView(v: UnitView) {
    v.label.element.remove();
    this.scene.remove(v.group);
    v.group.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.geometry.userData.shared) o.geometry.dispose(); // voxel geometry ay naka-cache
    });
    for (const m of v.model.mats) m.dispose();
  }

  // ---------- Effects ----------
  private floatTextAt(pos: THREE.Vector3, text: string, cls: string) {
    const el = document.createElement('div');
    const inner = document.createElement('div');
    inner.className = `float ${cls}`;
    inner.textContent = text;
    el.appendChild(inner);
    const obj = new CSS2DObject(el);
    obj.position.copy(pos);
    obj.position.x += randFloat(-0.35, 0.35);
    this.scene.add(obj);
    this.fx.push({
      obj,
      start: this.time,
      dur: FX.dmgFloatMs,
      tick: (p) => {
        if (p >= 1) el.remove();
      },
    });
  }

  private floatText(v: UnitView, text: string, cls: string) {
    const pos = toVec(v.unit, new THREE.Vector3());
    pos.y += vsz(v.unit) * 1.1;
    this.floatTextAt(pos, text, cls);
  }

  private projectileToPoint(from: UnitView, targetPos: THREE.Vector3, ms: number) {
    const color = from.unit.side === 'attacker' ? FX.curseColor : FX.projectileColor;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(FX.projectileRadius, 10, 8), new THREE.MeshBasicMaterial({ color }));
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    halo.scale.setScalar(FX.projectileRadius * 8);
    orb.add(halo);
    const a = toVec(from.unit).setY(from.unit.alt + vsz(from.unit) * 0.7);
    this.scene.add(orb);
    this.fx.push({
      obj: orb,
      start: this.time,
      dur: ms,
      tick: (p) => {
        orb.position.lerpVectors(a, targetPos, p);
        orb.position.y += Math.sin(p * Math.PI) * FX.projectileArc;
      },
    });
  }

  private projectile(from: UnitView, to: UnitView, ms: number) {
    const color = from.unit.side === 'attacker' ? FX.curseColor : FX.projectileColor;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(FX.projectileRadius, 10, 8), new THREE.MeshBasicMaterial({ color }));
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    halo.scale.setScalar(FX.projectileRadius * 8);
    orb.add(halo);
    const a = toVec(from.unit).setY(from.unit.alt + vsz(from.unit) * 0.7);
    const target = to.unit;
    this.scene.add(orb);
    this.fx.push({
      obj: orb,
      start: this.time,
      dur: ms,
      tick: (p) => {
        const b = toVec(target, this.tmp).setY(target.alt + vsz(target) * 0.5);
        orb.position.lerpVectors(a, b, p);
        orb.position.y += Math.sin(p * Math.PI) * FX.projectileArc;
      },
    });
  }

  private beam(from: UnitView, to: UnitView) {
    const a = toVec(from.unit).setY(vsz(from.unit) * 0.8);
    const b = toVec(to.unit).setY(to.unit.alt + vsz(to.unit) * 0.6);
    const len = a.distanceTo(b);
    const mat = new THREE.MeshBasicMaterial({ color: FX.beamColor, transparent: true, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(FX.beamRadius, FX.beamRadius, len, 6), mat);
    beam.position.copy(a).add(b).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.scene.add(beam);
    this.fx.push({ obj: beam, start: this.time, dur: FX.beamMs, tick: (p) => (mat.opacity = 1 - p) });
  }

  private shake(amount: number) {
    this.shakeAmount = Math.max(this.shakeAmount * (this.time < this.shakeUntil ? 1 : 0), amount);
    this.shakeUntil = this.time + FX.shakeMs;
  }

  /** Special effects ng atake (batuta swing, claw swipe, talon strike, earth smash). */
  private slashVfx(attacker: UnitView, target: UnitView | null) {
    const u = attacker.unit;
    const kind = u.kind;
    const color = FX.slashColors[kind] ?? (u.side === 'defender' ? 0x64b5f6 : 0xff2a2a);
    const isLarge = !!u.stats.boss || kind === 'anito';
    const geo = isLarge ? SLASH_GEO_L : SLASH_GEO_M;
    const size = vsz(u);

    const at = toVec(u, new THREE.Vector3()).setY(u.alt + size * 0.55);
    const forward = new THREE.Vector3(Math.sin(attacker.model.root.rotation.y), 0, Math.cos(attacker.model.root.rotation.y));

    let strikePos: THREE.Vector3;
    let targetDir = forward.clone();
    let isHittingAir = false;

    if (target) {
      const targetPos = toVec(target.unit, new THREE.Vector3()).setY(target.unit.alt + vsz(target.unit) * 0.55);
      strikePos = at.clone().lerp(targetPos, 0.65);
      targetDir = targetPos.clone().sub(at).normalize();
      isHittingAir = target.unit.stats.flying && !u.stats.flying;
    } else {
      // Umaatake sa mismong Bahay Kubo!
      const kuboTarget = new THREE.Vector3(0, 1.4, S.kuboPos + 1.2);
      targetDir = kuboTarget.clone().sub(at).normalize();
      strikePos = at.clone().addScaledVector(targetDir, Math.min(1.2 * size, at.distanceTo(kuboTarget) * 0.75));
    }

    const count = kind === 'aswang' ? 3 : kind === 'manananggal' || kind === 'tikbalang' || kind === 'malupiton' ? 2 : 1;
    const slashGroup = new THREE.Group();
    slashGroup.position.copy(strikePos);

    const orient = new THREE.Object3D();
    orient.position.copy(strikePos);
    orient.lookAt(strikePos.clone().add(targetDir));
    slashGroup.rotation.copy(orient.rotation);

    const materials: THREE.MeshBasicMaterial[] = [];

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      materials.push(mat);
      const mesh = new THREE.Mesh(geo, mat);

      if (count === 3) {
        const offset = (i - 1) * 0.22 * size;
        mesh.position.set(offset, offset * 0.4, 0);
        mesh.rotation.z = Math.PI * 0.2 + (i - 1) * 0.12;
      } else if (count === 2) {
        const offset = (i === 0 ? -1 : 1) * 0.18 * size;
        mesh.position.set(offset, (i === 0 ? 1 : -1) * 0.12 * size, 0);
        mesh.rotation.z = (i === 0 ? 0.35 : -0.35) * Math.PI;
      } else {
        mesh.rotation.z = (u.side === 'defender' ? -0.2 : 0.2) * Math.PI;
      }

      if (isHittingAir) {
        mesh.rotation.x = -Math.PI * 0.28;
      } else if (u.stats.flying) {
        mesh.rotation.x = Math.PI * 0.28;
      }

      slashGroup.add(mesh);
    }

    this.scene.add(slashGroup);

    const baseScale = size * (isLarge ? 1.0 : 1.25);
    const startRotZ = slashGroup.rotation.z;
    const dur = FX.slashMs;

    this.fx.push({
      obj: slashGroup,
      start: this.time,
      dur,
      tick: (p) => {
        const scale = baseScale * (0.6 + 0.65 * Math.sqrt(p));
        slashGroup.scale.set(scale, scale, scale);
        slashGroup.rotation.z = startRotZ + (p - 0.5) * 0.8;
        const opacity = Math.sin(p * Math.PI);
        for (const m of materials) m.opacity = Math.max(0, opacity);
        if (p >= 1) {
          for (const m of materials) m.dispose();
        }
      },
    });

    if (kind === 'anito') {
      this.ring(strikePos, 1.8, 0xffb74d);
    } else if (kind === 'higante') {
      this.ring(strikePos, 3.4, 0x8d6e63); // Hampas-Lupa ground slam
      this.spawnSparks(strikePos, 8, 0xffb74d);
    } else if (kind === 'haliya') {
      this.ring(strikePos, 3.0, 0x80e5ff); // Celestial moon ring
    }
  }

  /** Lumikha ng lumilipad na sparks sa punto ng impact. */
  private spawnSparks(at: THREE.Vector3, count: number, sparkColor: number) {
    const sparkMat = new THREE.MeshBasicMaterial({ color: sparkColor });
    for (let i = 0; i < count && this.sparks < FX.maxSparks; i++) {
      const m = new THREE.Mesh(SPARK_GEO, sparkMat);
      m.scale.setScalar(FX.sparkSize * 1.3);
      const start = at.clone();
      const vel = new THREE.Vector3(
        randFloat(-1.8, 1.8),
        randFloat(0.5, 2.2),
        randFloat(-1.8, 1.8),
      ).multiplyScalar(FX.sparkSpeed * 0.9);
      const dur = FX.sparkMs / 1000;
      this.sparks++;
      this.scene.add(m);
      this.fx.push({
        obj: m,
        start: this.time,
        dur: FX.sparkMs,
        shared: true,
        tick: (p) => {
          const tt = p * dur;
          m.position.set(start.x + vel.x * tt, start.y + vel.y * tt - 0.5 * FX.sparkGravity * tt * tt, start.z + vel.z * tt);
          m.scale.setScalar(FX.sparkSize * 1.3 * (1 - p));
          if (p >= 1) {
            this.sparks--;
            if (i === 0) sparkMat.dispose();
          }
        },
      });
    }
  }

  /** Malakas na clash impact, starburst flash, at sparks sa punto ng pagtama. */
  private clashImpact(victim: UnitView, byView?: UnitView) {
    const u = victim.unit;
    const size = vsz(u);
    const at = toVec(u, new THREE.Vector3()).setY(u.alt + size * 0.55);

    if (byView) {
      const byPos = toVec(byView.unit, new THREE.Vector3()).setY(byView.unit.alt + vsz(byView.unit) * 0.55);
      at.lerp(byPos, 0.35);
    }

    // Starburst contact flash
    const flashMat = new THREE.MeshBasicMaterial({
      map: glowTexture(),
      color: byView && byView.unit.side === 'defender' ? 0xffea75 : 0xff3b3b,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const flashMesh = new THREE.Mesh(CLASH_FLASH_GEO, flashMat);
    flashMesh.position.copy(at);
    flashMesh.quaternion.copy(this.camera.quaternion);
    this.scene.add(flashMesh);

    const flashBase = size * 0.95;
    this.fx.push({
      obj: flashMesh,
      start: this.time,
      dur: 130,
      tick: (p) => {
        flashMesh.quaternion.copy(this.camera.quaternion);
        const sc = flashBase * (0.4 + 1.2 * p);
        flashMesh.scale.set(sc, sc, 1);
        flashMat.opacity = Math.max(0, 1 - p);
        if (p >= 1) flashMat.dispose();
      },
    });

    // High energy clash sparks
    const sparkColor = byView && byView.unit.side === 'defender' ? 0xffee88 : 0xff5533;
    this.spawnSparks(at, FX.clashSparks, sparkColor);

    // Dust ring sa lupa
    if (!u.stats.flying) {
      const groundAt = toVec(u, new THREE.Vector3()).setY(0.04);
      this.ring(groundAt, size * 0.7, 0x443328);
    }
  }

  /** Usok kapag namatay. */
  private puff(v: UnitView) {
    const at = toVec(v.unit).setY(v.unit.alt + vsz(v.unit) * 0.4);
    const mat = new THREE.MeshBasicMaterial({ color: FX.puffColor, transparent: true, depthWrite: false });
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(SPARK_GEO, mat);
      m.position.set(randFloat(-0.4, 0.4), randFloat(0, 0.5), randFloat(-0.4, 0.4)).multiplyScalar(vsz(v.unit));
      g.add(m);
    }
    g.position.copy(at);
    this.scene.add(g);
    const base = vsz(v.unit) * 0.25;
    this.fx.push({
      obj: g,
      start: this.time,
      dur: FX.puffMs,
      shared: true,
      tick: (p) => {
        g.scale.setScalar(base * (0.5 + p * 1.5));
        g.position.y = at.y + p * 0.6;
        mat.opacity = 0.8 * (1 - p);
        if (p >= 1) mat.dispose();
      },
    });
  }

  /** Lumalawak na bilog sa lupa (slam / summon). */
  private ring(at: THREE.Vector3, radius: number, color: number) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(at.x, 0.05, at.z);
    this.scene.add(ring);
    this.fx.push({
      obj: ring,
      start: this.time,
      dur: FX.ringMs,
      tick: (p) => {
        ring.scale.setScalar(radius * (0.2 + 0.8 * Math.sqrt(p)));
        mat.opacity = 1 - p;
        if (p >= 1) mat.dispose();
      },
    });
  }

  /** Apoy ng Bakunawa papunta sa harap (papunta sa kubo). */
  private breath(u: SimUnit, length: number) {
    const mat = new THREE.MeshBasicMaterial({ color: FX.breathColor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const g = new THREE.Group();
    const mouth = toVec(u).setY(vsz(u) * 0.45);
    const parts: { m: THREE.Mesh; delay: number; dx: number; dy: number }[] = [];
    for (let i = 0; i < FX.breathParticles; i++) {
      const m = new THREE.Mesh(SPARK_GEO, mat);
      parts.push({ m, delay: randFloat(0, 0.5), dx: randFloat(-1, 1), dy: randFloat(-0.6, 0.4) });
      g.add(m);
    }
    this.scene.add(g);
    this.fx.push({
      obj: g,
      start: this.time,
      dur: FX.breathMs,
      shared: true,
      tick: (p) => {
        for (const q of parts) {
          const k = THREE.MathUtils.clamp((p - q.delay) / (1 - q.delay), 0, 1);
          q.m.visible = k > 0 && k < 1;
          q.m.position.set(mouth.x + q.dx * k * 1.8, Math.max(0.1, mouth.y + q.dy * k * 1.5), mouth.z - k * length);
          q.m.scale.setScalar(0.15 + k * 0.6);
        }
        mat.opacity = 1 - p * 0.6;
        if (p >= 1) mat.dispose();
      },
    });
  }

  /** Katakut-takot na usok/hamog kapag lumabas ang halimaw sa pinto/spawn. */
  private spawnEnemyFog(u: SimUnit) {
    const isBoss = !!u.stats.boss;
    const at = toVec(u).setY(0.08);
    const count = isBoss ? FX.bossSpawnFogCount : FX.enemySpawnFogCount;
    const baseSize = isBoss ? FX.bossSpawnFogSize : FX.enemySpawnFogSize;
    const ringRadius = isBoss ? FX.bossSpawnRingRadius : LANE.meleeReach * 2;

    // Maitim na shockwave ring sa lupa
    this.ring(at, ringRadius, isBoss ? FX.curseColor : FX.enemySpawnRingColor);

    // Maitim at makapal na usok/hamog na bumubugso
    const group = new THREE.Group();
    group.position.copy(at);

    const particles: { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; vel: THREE.Vector3; rotSpeed: number; maxOpacity: number; scale: number }[] = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: fogTexture(),
        color: FX.enemySpawnFogColor,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      const spread = isBoss ? 2.2 : 1.2;
      sp.position.set(randFloat(-spread, spread), randFloat(0.1, 0.5), randFloat(-spread, spread));
      const vel = new THREE.Vector3(
        randFloat(-0.9, 0.9),
        randFloat(0.3, 1.4),
        randFloat(-1.8, 0.4),
      );
      const scale = baseSize * randFloat(0.75, 1.4);
      sp.scale.setScalar(0.1);
      group.add(sp);
      particles.push({
        sprite: sp,
        mat,
        vel,
        rotSpeed: randFloat(-1.2, 1.2),
        maxOpacity: randFloat(0.65, 0.9),
        scale,
      });
    }

    this.scene.add(group);
    this.fx.push({
      obj: group,
      start: this.time,
      dur: FX.enemySpawnFogMs,
      shared: false,
      tick: (p) => {
        const opacityP = p < 0.18 ? p / 0.18 : (1 - p) / 0.82;
        const dtSec = this.dt / 1000;
        for (const pt of particles) {
          pt.sprite.position.addScaledVector(pt.vel, dtSec);
          pt.mat.rotation += pt.rotSpeed * dtSec;
          pt.mat.opacity = pt.maxOpacity * Math.max(0, opacityP);
          const sc = pt.scale * (0.35 + 0.85 * Math.sqrt(p));
          pt.sprite.scale.set(sc, sc * 0.7, 1);
        }
        if (p >= 1) {
          for (const pt of particles) pt.mat.dispose();
        }
      },
    });
  }

  /** Pagdilim at biglang pagbugso ng hamog sa battlefield kapag may sumulpot na halimaw. */
  private triggerDarkScaryPulse(isBoss: boolean) {
    this.currentFogNear = Math.min(this.currentFogNear, isBoss ? FX.fogPulseBossNear : FX.fogPulseMinNear);
    const intensity = isBoss ? FX.darkenPulseBossIntensity : FX.darkenPulseIntensity;
    this.darkenPulse = Math.max(this.darkenPulse, intensity);
    this.spawnGlowSurge = Math.max(this.spawnGlowSurge, isBoss ? 45 : 22);
  }

  // ---------- Frame ----------
  update(deltaMs: number) {
    this.time += deltaMs;
    this.dt = deltaMs;
    const t = this.time / 1000;

    for (const v of [...this.views.values()]) this.animateView(v, t);

    this.fx = this.fx.filter((f) => {
      const p = Math.min(1, (this.time - f.start) / f.dur);
      f.tick(p);
      if (p >= 1) {
        this.scene.remove(f.obj);
        if (!f.shared) {
          f.obj.traverse((o) => {
            if (o instanceof THREE.Mesh) o.geometry.dispose();
          });
        }
        return false;
      }
      return true;
    });

    this.ambientMist.forEach((sp, i) => {
      sp.material.rotation += (i % 2 === 0 ? 0.04 : -0.04) * (deltaMs / 1000);
      sp.position.x += Math.sin(t * 0.8 + i) * 0.003;
    });

    for (const tch of this.torches) {
      const f = 1 + Math.sin(t * 13 + tch.phase) * S.torchFlicker * 0.6 + Math.sin(t * 7.3 + tch.phase * 2) * S.torchFlicker * 0.4;
      tch.light.intensity = S.torchIntensity * f;
      tch.flame.scale.set(f, f, f);
    }
    this.spawnGlow.intensity = 14 + Math.sin(t * 2) * 5 + this.spawnGlowSurge;
    this.spawnGlowSurge = Math.max(0, this.spawnGlowSurge - (deltaMs / 1000) * 18);
    this.envTick?.(t);

    const shakeP = (this.time - this.kuboShakeAt) / S.kuboShakeMs;
    const shake = shakeP < 1 ? Math.sin(shakeP * Math.PI * 6) * S.kuboShakeAmount * (1 - shakeP) : 0;
    if (SIDE) this.kubo.position.z = S.kuboPos + shake;
    else this.kubo.position.x = shake;

    // Camera shake
    const base = this.V.cameraPos;
    const sk = this.time < this.shakeUntil ? this.shakeAmount * ((this.shakeUntil - this.time) / FX.shakeMs) : 0;
    this.camera.position.set(base.x + randFloat(-sk, sk), base.y + randFloat(-sk, sk), base.z);

    // Pulang buwan habang buhay ang Bakunawa
    let blood = false;
    for (const v of this.views.values()) if (v.unit.kind === 'bakunawa' && v.diedAt === null) blood = true;
    const target = new THREE.Color(blood ? S.bloodMoonColor : S.moonColor);
    const k = Math.min(1, (deltaMs / 1000) * S.bloodMoonLerp);
    this.moonMat.color.lerp(target, k);
    this.moonGlow.material.color.lerp(blood ? target : new THREE.Color(S.moonGlowColor), k);
    this.fog.color.lerp(new THREE.Color(blood ? S.bloodFog : this.fogBase), k);
    this.hemi.color.lerp(new THREE.Color(blood ? S.bloodSky : S.hemiSky), k);

    // Hamog at pagdilim kapag nag-spawn ang halimaw
    this.currentFogNear = THREE.MathUtils.lerp(this.currentFogNear, S.fogNear, Math.min(1, (FX.fogPulseRecoverSpeed * deltaMs) / 1000));
    this.fog.near = this.currentFogNear;
    this.darkenPulse = Math.max(0, this.darkenPulse - deltaMs / FX.darkenPulseMs);
    const baseHemi = blood ? S.hemiIntensity * 1.1 : S.hemiIntensity;
    this.hemi.intensity = baseHemi * (1 - this.darkenPulse);
    this.moonLight.intensity = S.moonIntensity * (1 - this.darkenPulse * 0.5);

    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  private animateView(v: UnitView, t: number) {
    const u = v.unit;
    const size = vsz(u);
    const root = v.model.root;

    if (v.diedAt !== null) {
      const p = (this.time - v.diedAt) / FX.deathMs;
      if (p >= 1) {
        this.removeView(v);
        this.views.delete(u.id);
        return;
      }
      root.scale.set(size * (1 + p * 0.3), size * (1 - p * 0.8), size * (1 + p * 0.3));
      root.rotation.z = p * (u.side === 'attacker' ? -1 : 1) * 1.2;
      for (const m of v.model.mats) m.opacity = 1 - p;
      return;
    }

    toVec(u, v.group.position);
    // Harapin ang direksyon (kalaban o nilalakaran), dahan-dahang umiikot
    const want = Math.atan2(-u.faceLat, u.facePos);
    let diff = want - root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    root.rotation.y += diff * Math.min(1, (FX.turnSpeed * this.dt) / 1000);

    // lunge kapag umaatake (sugod, yuko, kaskas ng kuko o hampas ng batuta)
    const lp = (this.time - v.lungeAt) / FX.lungeMs;
    let armStrike = 0;
    if (lp >= 0 && lp < 1) {
      const k = Math.sin(lp * Math.PI);
      v.group.position.x += Math.sin(root.rotation.y) * k * FX.lungeAmount;
      v.group.position.z += Math.cos(root.rotation.y) * k * FX.lungeAmount;
      root.rotation.x = k * 0.35;
      armStrike = k * 1.5;

      // Manananggal: sisisid pababa para kumaskas sa bayani
      if (u.stats.flying) {
        v.group.position.y -= k * 1.35;
        root.rotation.x = k * 0.55;
      }

      // Bayaning sumusuntok/humahampas pataas sa lumilipad na halimaw
      if (v.targetView?.unit.stats.flying && !u.stats.flying) {
        v.group.position.y += k * 0.55;
        root.rotation.x = -k * 0.45;
      }
    } else {
      root.rotation.x = 0;
    }

    // stagger / flinch kapag tinamaan ng atake
    const stp = (this.time - v.staggerAt) / FX.staggerMs;
    if (stp >= 0 && stp < 1) {
      const sk = Math.sin(stp * Math.PI) * FX.staggerAmount;
      v.group.position.x -= Math.sin(root.rotation.y) * sk;
      v.group.position.z -= Math.cos(root.rotation.y) * sk;
      root.rotation.x -= sk * 0.45;
      root.rotation.z += Math.sin(stp * Math.PI * 2) * 0.14;
    }

    // Pangalan ng hero ay laging nakikita sa ibabaw ng ulo ng character

    const bob = u.stats.flying ? FX.flyBobAmount : FX.bobAmount * size;
    const speed = u.moving ? FX.bobSpeed * 1.6 : FX.bobSpeed * 0.5;
    root.position.y = Math.abs(Math.sin(t * speed + v.phase)) * bob * (u.moving || u.stats.flying ? 1 : 0.4);
    if (stp < 0 || stp >= 1) {
      root.rotation.z = u.moving ? Math.sin(t * speed + v.phase) * FX.walkSway : 0;
    }
    for (const w of v.model.wings) {
      const axis = (w.userData.flapAxis as 'y' | 'z' | undefined) ?? 'y';
      const amp = (w.userData.flapAmp as number | undefined) ?? 0.7;
      const flapMult = lp >= 0 && lp < 1 ? 1.6 : 1;
      const fSpeed = (u.stats.flying ? FX.flapSpeed : FX.flapSpeed * 0.4) * flapMult;
      // × scale.x: magkasabay na pumapagaspas ang naka-mirror na pakpak (hindi parang seesaw)
      w.rotation[axis] = Math.sin(t * fSpeed + v.phase) * amp * Math.sign(w.scale.x);
    }
    // lakad: cos para magkatabi ang paa sa tuktok ng bob (mid-stance)
    const settle = Math.min(1, (FX.limbSettle * this.dt) / 1000);
    for (const l of v.model.limbs) {
      const isArm = l.userData.limb === 'arm';
      const amp = isArm ? -FX.armSwing : FX.legSwing;
      const want = u.moving ? Math.cos(t * speed + v.phase) * amp * (l.userData.side as number) * ((l.userData.swing as number | undefined) ?? 1) : 0;
      const extra = isArm && armStrike > 0 ? armStrike * ((l.userData.side as number) > 0 ? 1 : 0.35) : 0;
      l.rotation.x += (want + extra - l.rotation.x) * (u.moving || armStrike > 0 ? 1 : settle);
    }
    v.model.segments.forEach((sg, i) => (sg.position.x = Math.sin(t * 3 + v.phase - i * 0.6) * 0.12 * ((sg.userData.sway as number | undefined) ?? 1)));
    if (v.model.segments.length) root.rotation.z = 0;

    // spawn pop
    const sp = Math.min(1, (this.time - v.bornAt) / FX.spawnPopMs);
    root.scale.setScalar(size * Math.max(0.01, easeOutBack(sp)));

    // hit flash
    const flash = this.time < v.flashUntil;
    for (const m of v.model.mats) {
      const base = m.userData.baseEmissive as number;
      m.emissive.setHex(flash ? FX.hitFlashColor : base);
      m.emissiveIntensity = flash ? FX.hitFlashIntensity : base ? 2 : 0;
    }

    // laki ng label ayon sa layo
    const d = this.camera.position.distanceTo(v.group.position);
    const s = THREE.MathUtils.clamp(FX.labelRefDist / d, FX.labelMinScale, FX.labelMaxScale);
    v.labelInner.style.transform = `scale(${s.toFixed(3)})`;
  }
}

// ---------- Helpers ----------
function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, S.skyTop);
  grad.addColorStop(0.55, S.skyMid);
  grad.addColorStop(1, S.skyHorizon);
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
