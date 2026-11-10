import * as THREE from 'three';
import { LANE, SCENE3D as S } from '../config';
import { randFloat } from '../sim/rand';
import { buildBarangay, monoblocChairVox } from './barangay';
import { fogTexture, voxGroup, type Torch } from './scenery';
import { Vox } from './voxel';

// Battlefield na "Baha" (batay sa assets/reference/battlefield_baha.png): ang 'barangay' na mapa
// na binaha habang may bagyo. Maputik na tubig sa buong paligid (aninag pa ang kalsada),
// malakas na ulan na may mga bilog sa tubig, kidlat, maitim na ulap, rescue boat na may
// flashlight, mga pamilyang naghihintay ng saklolo sa bubong, at mga lumulutang na kalat
// (palanggana, tsinelas, kahoy, cooler, monobloc). Ang mga numero ay nasa SCENE3D.baha.

const W = S.baha;
const HALF = LANE.halfWidth + 0.5;

export function buildBaha(sc: THREE.Scene): {
  base: THREE.Object3D;
  torches: Torch[];
  tick: (t: number) => void;
} {
  const brgy = buildBarangay(sc, { flooded: true });
  sc.background = stormSky();

  // ---- 1. Tubig-baha ----
  const waterTex = waterTexture();
  waterTex.repeat.set(W.waterSize / 6, W.waterSize / 6);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(W.waterSize, W.waterSize),
    new THREE.MeshStandardMaterial({
      map: waterTex,
      color: W.waterColor,
      transparent: true,
      opacity: W.waterOpacity,
      roughness: 0.25,
      metalness: 0.15,
      depthWrite: false,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, W.waterLevel, 16);
  water.receiveShadow = true;
  water.renderOrder = 1;
  sc.add(water);

  // ---- 2. Mga taong naghihintay ng saklolo sa bubong ----
  // Kapareho ng posisyon ng harapang bahay kubo sa barangay.ts. Paalala: +x = kaliwa sa screen.
  const roofGroup = (x: number, z: number, s: number, rot: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    g.scale.setScalar(s);
    sc.add(g);
    return g;
  };
  const wavers: THREE.Object3D[] = [];
  const addPerson = (parent: THREE.Object3D, p: PersonOpts, x: number, y: number, z: number, key: string, ry = Math.PI) => {
    const g = voxGroup(personVox(p), `baha:person:${key}`, p.kid ? 0.06 : 0.075);
    g.position.set(x, y, z);
    g.rotation.y = ry; // nakaharap sa camera (-z)
    g.rotation.x = 0.45; // nakasandal pabalik sa dalisdis ng bubong
    parent.add(g);
    if (p.wave) wavers.push(g);
    return g;
  };
  // Kaliwa: pamilya (tatay na kumakaway, nanay, dalawang bata)
  const left = roofGroup(HALF + 3.2, 4.2, 0.88, -0.25);
  addPerson(left, { shirt: 0x3c7ab0, pants: 0x2a2a38, skin: 0xb07a52, hair: 0x1a1210, wave: true }, 0.75, 3.55, -1.75, 'tatay');
  addPerson(left, { shirt: 0xc8506a, pants: 0x3a2a48, skin: 0xbf8a62, hair: 0x22140e, sit: true }, -0.55, 3.55, -1.8, 'nanay');
  addPerson(left, { shirt: 0xf0c040, pants: 0x2a4a7a, skin: 0xc49066, hair: 0x1a1210, sit: true, kid: true }, -1.3, 3.45, -1.9, 'bata1');
  addPerson(left, { shirt: 0x58b060, pants: 0x3a3a40, skin: 0xc49066, hair: 0x1a1210, kid: true, wave: true }, 0.1, 3.55, -1.8, 'bata2');
  // Kanan: lolo at lola
  const right = roofGroup(-(HALF + 3.2), 4.2, 0.88, 0.25);
  addPerson(right, { shirt: 0xd8d0c0, pants: 0x4a4440, skin: 0xa87850, hair: 0xe4e4e4, sit: true }, -0.55, 3.55, -1.8, 'lolo');
  addPerson(right, { shirt: 0x8a6aa8, pants: 0x3a3040, skin: 0xb48058, hair: 0xd8d8d8, sit: true }, 0.55, 3.55, -1.8, 'lola');

  // ---- 3. Rescue boat (may dalawang rescuer at flashlight) ----
  const boat = new THREE.Group();
  boat.position.set(-(HALF - 1.2), W.waterLevel - 0.05, 26.5); // kanan sa screen, sa kalsada malapit sa gate (tulad ng reference)
  boat.rotation.y = Math.PI + 0.35; // nakaharap sa camera, bahagyang papunta sa kalsada
  boat.add(voxGroup(boatVox(), 'baha:boat', 0.1));
  const rescuer: PersonOpts = { shirt: 0xff7a1a, pants: 0x3d5a2a, skin: 0xa87850, hair: 0x3d5a2a, helmet: true };
  addPerson(boat, rescuer, 0, 0.25, 0.6, 'rescuer', 0).rotation.x = 0;
  addPerson(boat, { ...rescuer, wave: false }, 0.1, 0.25, -0.6, 'rescuer', 0).rotation.x = 0;
  const beam = new THREE.SpotLight(0xfff4d0, 14, 22, Math.PI / 10, 0.5, 1.3);
  beam.position.set(0, 1.6, 0.9);
  beam.target.position.set(0, 0, 8);
  boat.add(beam, beam.target);
  sc.add(boat);

  // ---- 4. Lumulutang na kalat ----
  const floaters: { obj: THREE.Object3D; x: number; z: number; ph: number; spin: number }[] = [];
  const addFloater = (obj: THREE.Object3D, x: number, z: number, tilt = 0) => {
    obj.rotation.set(tilt, randFloat(0, Math.PI * 2), 0);
    sc.add(obj);
    floaters.push({ obj, x, z, ph: randFloat(0, 10), spin: randFloat(-0.15, 0.15) });
  };
  const basin = (c: number, key: string) => voxGroup(basinVox(c), `baha:basin:${key}`, 0.06);
  addFloater(basin(0xd84a6a, 'pink'), 1.5, 14.5);
  addFloater(basin(0xe05050, 'red'), 3.6, 3.2);
  addFloater(basin(0x4a90d8, 'blue'), -(HALF + 5), 15);
  addFloater(voxGroup(coolerVox(), 'baha:cooler', 0.07), -(HALF + 2), 2.2);
  addFloater(voxGroup(slipperVox(0x2a6ad0), 'baha:slipper:b', 0.04), -0.8, 4.2);
  addFloater(voxGroup(slipperVox(0x40c070), 'baha:slipper:g', 0.04), -(HALF - 1.5), 9);
  addFloater(voxGroup(slipperVox(0xe8e0d0), 'baha:slipper:w', 0.04), HALF + 1.5, 9.5);
  addFloater(voxGroup(logVox(), 'baha:log', 0.08), -2.5, 1.2);
  addFloater(voxGroup(logVox(), 'baha:log', 0.08), HALF + 4, 1.5);
  addFloater(voxGroup(logVox(), 'baha:log', 0.08), 2.2, 22);
  addFloater(voxGroup(monoblocChairVox(0x186ec8), 'barangay:chair:b', 0.08), HALF + 5.8, 10.5, 1.4);
  addFloater(voxGroup(bottleVox(), 'baha:bottle', 0.04), -(HALF + 3.5), 18);
  addFloater(voxGroup(bottleVox(), 'baha:bottle', 0.04), 4.8, 8.5);

  // ---- 5. Ulan (mga guhit na bumabagsak) ----
  const RA = W.rainArea;
  const rainN = W.rainCount;
  const rainPos = new Float32Array(rainN * 6);
  const rainSeed = Array.from({ length: rainN }, () => ({
    x: randFloat(-RA.halfX, RA.halfX),
    z: randFloat(RA.zMin, RA.zMax),
    off: randFloat(0, RA.top),
    spd: W.rainSpeed * randFloat(0.85, 1.15),
  }));
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({ color: W.rainColor, transparent: true, opacity: W.rainOpacity, depthWrite: false }),
  );
  rain.frustumCulled = false;
  sc.add(rain);

  // Bilog sa tubig kung saan bumabagsak ang ulan
  const rippleGeo = new THREE.RingGeometry(0.8, 1, 16);
  rippleGeo.rotateX(-Math.PI / 2);
  const ripples = Array.from({ length: W.rippleCount }, () => {
    const mat = new THREE.MeshBasicMaterial({ color: W.rainColor, transparent: true, depthWrite: false });
    const m = new THREE.Mesh(rippleGeo, mat);
    m.renderOrder = 2;
    sc.add(m);
    return { m, mat, off: randFloat(0, W.rippleLife), cycle: -1 };
  });

  // ---- 6. Maitim na ulap at kidlat ----
  const clouds: THREE.Sprite[] = [];
  for (let i = 0; i < W.cloudCount; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: fogTexture(), color: W.cloudColor, transparent: true, opacity: 0.85, depthWrite: false, fog: false }),
    );
    const s = randFloat(18, 34);
    sp.scale.set(s, s * 0.4, 1);
    sp.position.set(randFloat(-45, 45), randFloat(14, 24), randFloat(45, 75));
    sc.add(sp);
    clouds.push(sp);
  }
  const bolt = new THREE.DirectionalLight(W.lightningColor, 0);
  bolt.position.set(-10, 30, 40);
  sc.add(bolt);
  let nextBolt = randFloat(W.lightningMin, W.lightningMax);
  let boltAt = -Infinity;

  return {
    base: brgy.base,
    torches: brgy.torches,
    tick: (t: number) => {
      brgy.tick(t);
      // Agos ng tubig
      waterTex.offset.set(t * W.waterFlow * 0.4, -t * W.waterFlow);

      // Ulan
      for (let i = 0; i < rainN; i++) {
        const r = rainSeed[i]!;
        const y = RA.top - ((t * r.spd + r.off) % RA.top);
        const x = r.x + y * W.rainWind;
        const o = i * 6;
        rainPos[o] = x;
        rainPos[o + 1] = y;
        rainPos[o + 2] = r.z;
        rainPos[o + 3] = x + W.rainLength * W.rainWind;
        rainPos[o + 4] = y + W.rainLength;
        rainPos[o + 5] = r.z;
      }
      rainGeo.attributes.position!.needsUpdate = true;

      // Bilog sa tubig: lumalaki at kumukupas, tapos lilipat sa bagong puwesto
      for (const rp of ripples) {
        const life = (t + rp.off) / W.rippleLife;
        const cycle = Math.floor(life);
        if (cycle !== rp.cycle) {
          rp.cycle = cycle;
          rp.m.position.set(randFloat(-HALF - 8, HALF + 8), W.waterLevel + 0.01, randFloat(-3, 30));
        }
        const p = life - cycle;
        rp.m.scale.setScalar(0.05 + p * W.rippleSize);
        rp.mat.opacity = 0.5 * (1 - p);
      }

      // Lumulutang na kalat: umaalon at dahan-dahang inaanod
      for (const f of floaters) {
        const d = Math.sin(t * W.driftSpeed + f.ph) * 0.6;
        f.obj.position.set(f.x + d, W.waterLevel - 0.03 + Math.sin(t * W.bobSpeed + f.ph) * W.bobAmp, f.z + Math.cos(t * W.driftSpeed * 0.7 + f.ph) * 0.4);
        f.obj.rotation.y += f.spin * 0.016;
        f.obj.rotation.z = Math.sin(t * W.bobSpeed * 0.8 + f.ph) * 0.08;
      }

      // Bangka at flashlight na naghahanap
      boat.position.y = W.waterLevel - 0.05 + Math.sin(t * W.bobSpeed * 0.7) * W.bobAmp;
      boat.rotation.z = Math.sin(t * W.bobSpeed * 0.6) * 0.04;
      beam.target.position.set(Math.sin(t * 0.5) * 4, 0, 8 + Math.cos(t * 0.35) * 3);

      // Kumakaway na humihingi ng saklolo
      for (const w of wavers) w.rotation.z = Math.sin(t * 5 + w.position.x * 3) * 0.08;

      for (const c of clouds) c.position.x += Math.sin(t * 0.05 + c.position.z) * 0.004;

      // Kidlat (dobleng kislap)
      if (t > nextBolt) {
        boltAt = t;
        nextBolt = t + randFloat(W.lightningMin, W.lightningMax);
      }
      const bp = ((t - boltAt) * 1000) / W.lightningMs;
      bolt.intensity = bp < 1 ? W.lightningIntensity * (bp < 0.15 ? 1 : bp < 0.3 ? 0.15 : bp < 0.45 ? 0.8 : (1 - bp) * 0.5) : 0;
      for (const c of clouds) c.material.color.setHex(bp < 0.5 ? 0x5a6688 : W.cloudColor);
    },
  };
}

// =========================================================================
// MGA TEXTURE AT VOXEL MODELS (hugis/proporsyon lang, parang sprite data)
// =========================================================================

function stormSky() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, W.skyTop);
  grad.addColorStop(0.55, W.skyMid);
  grad.addColorStop(1, W.skyHorizon);
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Tileable na texture ng maputik na tubig: maliliwanag na guhit ng alon at bula. */
function waterTexture() {
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c8c0b0';
  g.fillRect(0, 0, N, N);
  let a = 1234567;
  const rnd = () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 140; i++) {
    const x = Math.floor(rnd() * N);
    const y = Math.floor(rnd() * N);
    const len = 3 + Math.floor(rnd() * 10);
    g.fillStyle = rnd() < 0.5 ? '#e8e2d4' : '#a89e8c';
    for (let k = 0; k < len; k++) g.fillRect((x + k) % N, (y + Math.round(Math.sin(k * 0.6) * 1)) % N, 1, 1);
  }
  for (let i = 0; i < 30; i++) {
    g.fillStyle = '#f4f0e6';
    g.fillRect(Math.floor(rnd() * N), Math.floor(rnd() * N), 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

interface PersonOpts {
  shirt: number;
  pants: number;
  skin: number;
  hair: number;
  sit?: boolean;
  kid?: boolean;
  wave?: boolean;
  helmet?: boolean;
}

/** Simpleng voxel na tao, nakaharap sa +z. Nakaupo (nakaunat ang binti) o nakatayo; puwedeng kumakaway. */
function personVox(p: PersonOpts) {
  const v = new Vox();
  const EYE = 0x161010;
  // Balakang/binti
  let y0: number;
  if (p.sit) {
    v.box(-2, 0, -1, 2, 2, 1, p.pants); // balakang
    v.box(-2, 0, 2, -1, 1, 6, p.pants); // binting nakaunat
    v.box(1, 0, 2, 2, 1, 6, p.pants);
    v.box(-2, 0, 7, -1, 1, 7, p.skin);
    v.box(1, 0, 7, 2, 1, 7, p.skin);
    y0 = 3;
  } else {
    v.box(-2, 0, -1, -1, 6, 0, p.pants);
    v.box(1, 0, -1, 2, 6, 0, p.pants);
    y0 = 7;
  }
  // Katawan (vest ng rescuer o damit)
  v.box(-2, y0, -1, 2, y0 + 6, 1, p.shirt);
  // Mga braso
  v.box(-3, y0 + 1, 0, -3, y0 + 6, 0, p.shirt);
  v.set(-3, y0 + 1, 1, p.skin);
  if (p.wave) {
    v.box(3, y0 + 6, 0, 3, y0 + 11, 0, p.shirt);
    v.box(3, y0 + 12, 0, 3, y0 + 13, 0, p.skin);
  } else {
    v.box(3, y0 + 1, 0, 3, y0 + 6, 0, p.shirt);
    v.set(3, y0 + 1, 1, p.skin);
  }
  // Ulo
  const hy = y0 + 7;
  v.box(-2, hy, -2, 2, hy + 4, 2, p.skin);
  v.set(-1, hy + 2, 2, EYE);
  v.set(1, hy + 2, 2, EYE);
  if (p.helmet) {
    v.box(-3, hy + 4, -3, 3, hy + 5, 3, p.hair);
  } else {
    v.box(-2, hy + 4, -2, 2, hy + 5, 2, p.hair);
    v.box(-2, hy + 1, -2, 2, hy + 4, -2, p.hair);
  }
  return v;
}

/** Inflatable na rescue boat na may outboard motor (harap = +z). */
function boatVox() {
  const v = new Vox();
  const TUBE = 0x3c4a2e;
  const TUBE2 = 0x2e3a22;
  const FLOOR = 0x22262a;
  for (let z = -12; z <= 12; z++) {
    const w = z > 6 ? 6 - Math.round((z - 6) * 0.7) : 6; // patulis sa harap
    for (const s of [-1, 1]) v.box(s * w, 0, z, s * (w - 1), 2, z, z % 3 === 0 ? TUBE2 : TUBE);
    v.box(-(w - 2), 0, z, w - 2, 0, z, FLOOR);
  }
  v.box(-6, 0, -12, 6, 2, -13, TUBE); // likod
  v.box(-5, 3, -12, -5, 3, -2, 0xe8e8e8); // tali sa gilid
  // Outboard motor
  v.box(-1, 1, -16, 1, 5, -14, 0x18181c);
  v.box(0, -2, -15, 0, 0, -15, 0x18181c);
  v.set(0, 5, -16, 0xd04020);
  return v;
}

/** Palangganang plastik (nakataob na bilog). */
function basinVox(c: number) {
  const v = new Vox();
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      const r = Math.hypot(x, z);
      if (r <= 5.4 && r > 4.2) v.box(x, 0, z, x, 2, z, c);
      else if (r <= 4.2) v.set(x, 0, z, c);
    }
  }
  return v;
}

function coolerVox() {
  const v = new Vox();
  v.box(-4, 0, -3, 4, 5, 3, 0x2a70c8);
  v.box(-4, 5, -3, 4, 6, 3, 0xe8e8e8);
  v.box(-2, 7, 0, 2, 7, 0, 0xe8e8e8);
  return v;
}

function slipperVox(c: number) {
  const v = new Vox();
  v.box(-2, 0, -5, 2, 0, 5, c);
  v.box(-1, 1, 1, -1, 1, 3, 0x202020);
  v.box(1, 1, 1, 1, 1, 3, 0x202020);
  v.set(0, 1, 3, 0x202020);
  return v;
}

function logVox() {
  const v = new Vox();
  v.box(-1, 0, -10, 1, 2, 10, 0x4a3220);
  v.box(-1, 1, -10, 1, 1, -10, 0x8a6a42);
  v.box(1, 1, 3, 3, 1, 4, 0x4a3220); // sanga
  return v;
}

function bottleVox() {
  const v = new Vox();
  v.box(-1, 0, -4, 1, 2, 3, 0x9ad0e0);
  v.set(0, 1, 4, 0x9ad0e0);
  v.set(0, 1, 5, 0x2a8a3a);
  return v;
}
