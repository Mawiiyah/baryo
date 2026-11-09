import * as THREE from 'three';
import type { UnitKind } from '../config';
import type { Model } from './models';
import { Vox } from './voxel';

// Voxel (pixel 3D) na mga karakter — original na disenyo mula sa Pinoy folklore.
// Mga numero dito ay pixel-art data (posisyon ng cube), parang sprite sheet.
// Taas ≈ 1 (pinapalaki ng stats.size), paa sa y=0, nakaharap sa +z.

const C = {
  skin: 0xc98a55,
  skinDark: 0xa86e3e,
  black: 0x141414,
  white: 0xf2f2f2,
  bone: 0xd9c49a,
  red: 0xc8182a,
  redGlow: 0xff2a1a,
  teal: 0x1fa3ad,
  deepBlue: 0x1838a8,
  orange: 0xff5a1f,
  wood: 0x8b5a2b,
  woodDark: 0x5e3a1a,
};

class VoxModel {
  readonly root = new THREE.Group();
  readonly mats: THREE.MeshStandardMaterial[] = [];
  readonly wings: THREE.Object3D[] = [];
  readonly segments: THREE.Object3D[] = [];
  readonly limbs: THREE.Object3D[] = [];

  constructor(private kind: UnitKind, readonly unit: number) {}

  /** Idagdag ang voxels bilang mesh sa `parent` (o sa root). */
  part(name: string, v: Vox, parent: THREE.Object3D = this.root) {
    for (const { geometry, glow } of v.build(`${this.kind}:${name}`, this.unit)) {
      const m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        emissive: glow ?? 0x000000,
        emissiveIntensity: glow ? 2 : 0,
      });
      m.userData.baseEmissive = glow ?? 0;
      this.mats.push(m);
      const mesh = new THREE.Mesh(geometry, m);
      mesh.castShadow = !glow;
      parent.add(mesh);
    }
  }

  /** Pivot (sa voxel units) para sa pakpak o segment. */
  pivot(x: number, y: number, z: number, parent: THREE.Object3D = this.root) {
    const g = new THREE.Group();
    g.position.set(x * this.unit, y * this.unit, z * this.unit);
    parent.add(g);
    return g;
  }

  /**
   * Binti/braso na umuugoy: ang `v` ay ang kanang bahagi (+x) na nakaayos kaugnay
   * ng pivot (x,y,z); ang kaliwa ay naka-mirror sa -x.
   */
  limbPair(name: string, v: Vox, limb: 'leg' | 'arm', x: number, y: number, z: number) {
    for (const side of [-1, 1]) {
      const p = this.pivot(side * x, y, z);
      p.scale.x = side;
      p.userData.limb = limb;
      p.userData.side = side;
      this.part(name, v, p);
      this.limbs.push(p);
    }
  }

  done(): Model {
    return { root: this.root, mats: this.mats, wings: this.wings, segments: this.segments, limbs: this.limbs };
  }
}

export function buildVoxelModel(kind: UnitKind, color: number): Model {
  switch (kind) {
    case 'tanod': return tanod(color);
    case 'anito': return anito(color);
    case 'albularyo': return albularyo(color);
    case 'sarimanok': return sarimanok(color);
    case 'aswang': return aswang(color);
    case 'manananggal': return manananggal(color);
    case 'tikbalang': return tikbalang(color);
    case 'kapre': return kapre(color);
    case 'mangkukulam': return mangkukulam(color);
    case 'bakunawa': return bakunawa(color);
  }
}

// ---------- Mga bayani ----------

// Batay sa assets/reference/tanod.png: salakot, puting t-shirt, asul na vest
// ("TANOD" sa likod, name patch, badge, ID), navy na pantalon, sinturon na may
// pouch, batuta sa kaliwang balakang, kayumangging sapatos.
function tanod(_tint: number) {
  const m = new VoxModel('tanod', 1 / 24);
  const v = new Vox();
  const vest = 0x2a55c8;
  const vestShade = 0x1f3f99;
  const pants = 0x1f2d55;
  const shoe = 0x4a3626;
  const belt = 0x1a1a1a;
  const straw = 0xd8b46a;
  const strawDark = 0xb8924e;
  const hair = 0x1a1410;
  // sapatos at pantalon
  v.boxSym(1, 0, -1, 2, 0, 2, shoe);
  v.boxSym(1, 1, -1, 2, 4, 1, pants);
  v.box(-2, 5, -1, 2, 7, 1, pants);
  // sinturon, buckle, pouch at holster
  v.box(-3, 8, -2, 3, 8, 2, belt);
  v.set(0, 8, 2, 0x9a9a9a);
  v.boxSym(3, 6, -1, 3, 7, -1, belt);
  v.box(-3, 6, 1, -3, 7, 1, belt);
  // vest (may tiyan sa harap)
  v.box(-3, 9, -2, 3, 14, 2, vest);
  v.box(-2, 9, 3, 2, 11, 3, vest);
  v.boxSym(3, 9, -2, 3, 14, -2, vestShade);
  // puting kwelyo (V-neck) at ID sa lanyard
  v.box(-1, 14, 2, 1, 14, 2, C.white);
  v.set(0, 13, 2, C.white);
  v.set(0, 12, 2, belt);
  v.box(0, 10, 3, 0, 11, 3, C.white);
  // name patch (kanan ng dibdib) at badge (kaliwa)
  v.box(-2, 12, 2, -1, 12, 2, C.black);
  v.set(-2, 12, 2, C.white);
  v.set(2, 12, 2, 0xffd34d);
  v.set(2, 11, 2, C.red);
  // "TANOD" sa likod
  v.box(-3, 12, -2, 3, 13, -2, C.black);
  for (const x of [-2, 0, 2]) v.box(x, 12, -2, x, 13, -2, C.white);
  // maikling manggas, braso at kamay
  v.boxSym(4, 12, -1, 4, 14, 1, C.white);
  v.boxSym(4, 8, 0, 4, 11, 0, C.skin);
  v.boxSym(4, 7, 0, 4, 7, 0, C.skinDark);
  // batuta sa kaliwang balakang
  v.box(4, 2, 1, 4, 8, 1, C.wood);
  v.set(4, 9, 1, C.woodDark);
  // leeg at ulo
  v.box(-1, 15, -1, 1, 15, 0, C.skin);
  v.box(-2, 16, -2, 2, 19, 2, C.skin);
  v.boxSym(3, 17, 0, 3, 17, 0, C.skinDark); // tainga
  v.boxSym(1, 18, 2, 1, 18, 2, C.black); // mata
  v.set(0, 17, 3, C.skinDark); // ilong
  v.set(0, 16, 2, 0x7a3e2a); // bibig
  v.box(-2, 17, -2, 2, 19, -2, hair);
  v.boxSym(2, 18, -1, 2, 19, 0, hair);
  // salakot (pa-cone, may habi)
  const weave = (x: number, z: number) => (((x + z) & 1) === 0 ? straw : strawDark);
  for (let x = -6; x <= 6; x++)
    for (let z = -6; z <= 6; z++) {
      const r2 = x * x + z * z;
      if (r2 <= 32) v.set(x, 20, z, r2 > 24 ? strawDark : weave(x, z));
      if (r2 <= 16) v.set(x, 21, z, weave(x, z));
      if (r2 <= 6) v.set(x, 22, z, weave(x, z));
    }
  v.set(0, 23, 0, strawDark);
  m.part('body', v);
  return m.done();
}

function anito(wood: number) {
  const m = new VoxModel('anito', 1 / 18);
  const v = new Vox();
  v.box(-4, 0, -2, 4, 9, 2, wood);
  for (const y of [3, 6]) v.box(-4, y, 2, 4, y, 2, C.woodDark); // ukit
  v.boxSym(5, 3, -1, 6, 8, 1, wood); // braso
  v.box(-3, 10, -2, 3, 15, 2, 0x6e4420); // ulo
  v.box(-2, 11, 3, 2, 11, 3, 0x3a2410); // bibig
  v.boxSym(1, 13, 3, 2, 13, 3, 0xffc400, true); // kumikinang na mata
  v.box(-3, 14, 3, -3, 14, 3, 0x6e4420);
  for (const x of [-3, 0, 3]) v.box(x, 16, 0, x, 17, 0, 0x6e4420); // korona
  m.part('body', v);
  return m.done();
}

function albularyo(robe: number) {
  const m = new VoxModel('albularyo', 1 / 18);
  const v = new Vox();
  v.box(-4, 0, -3, 4, 3, 3, robe);
  v.box(-3, 4, -2, 3, 6, 2, robe);
  v.box(-2, 7, -2, 2, 9, 2, robe);
  v.box(-1, 4, 3, 1, 8, 3, 0x2a6e2e); // panyo
  v.box(-2, 10, -2, 2, 13, 2, C.skin); // ulo
  v.boxSym(1, 12, 2, 1, 12, 2, C.black);
  v.box(-1, 10, 3, 1, 10, 3, 0xe0e0e0); // balbas
  // salakot (sumbrerong pabilog)
  for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) if (x * x + z * z <= 26) v.set(x, 14, z, 0xd8b46a);
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (x * x + z * z <= 9) v.set(x, 15, z, 0xc9a35a);
  v.set(0, 16, 0, 0xb08a48);
  v.box(5, 0, 1, 5, 13, 1, 0x6a4a2a); // tungkod
  v.box(5, 14, 1, 5, 15, 1, 0x9cff57, true); // dahon na kumikinang
  v.boxSym(4, 7, 0, 4, 8, 0, C.skin);
  m.part('body', v);
  return m.done();
}

function sarimanok(blue: number) {
  const m = new VoxModel('sarimanok', 1 / 22);
  const v = new Vox();
  // paa at kuko
  v.boxSym(1, 1, 0, 1, 5, 0, C.bone);
  v.boxSym(1, 0, 0, 2, 0, 2, C.bone);
  // katawan na may "kaliskis" sa dibdib
  v.ellipsoid(0, 9, 0, 4.2, 4.5, 3.6, (x, y, z) => (z >= 2 ? ((x + y) % 2 === 0 ? C.teal : C.deepBlue) : blue));
  // leeg at ulo
  v.box(-2, 13, -1, 2, 15, 2, blue);
  v.box(-2, 15, 0, 2, 18, 4, C.deepBlue);
  v.boxSym(2, 16, 2, 2, 17, 4, C.red); // pulang mukha
  v.boxSym(2, 17, 3, 2, 17, 3, 0xfff4e0, true); // mata
  v.box(0, 16, 5, 0, 17, 6, C.bone); // tuka
  v.set(0, 15, 5, C.red); // lambi
  v.box(0, 19, 0, 0, 20, 3, C.red); // palong
  // kulot na crest
  for (const s of [-1, 1]) {
    for (const k of [1, 2, 3]) {
      v.line([[0, 19, 1], [s * k, 21, 0], [s * k * 2, 22, -1], [s * (k * 2 + 1), 21, -2]], C.red);
    }
  }
  // laso na buntot
  const ribbon = [C.deepBlue, C.teal, C.orange, C.red];
  for (let i = 0; i < 8; i++) {
    const s = i % 2 ? 1 : -1;
    const w = 2 + (i % 4) * 1.5;
    v.line([[0, 7, -3], [s * w * 0.5, 4, -6], [s * w, 1, -5], [s * w * 1.3, 0, -1 + (i % 3)], [s * w * 1.1, 2 + (i % 3), 2]], ribbon[i % 4]!);
  }
  // isda sa kaliwang kuko
  v.box(-3, 2, -1, -3, 3, 3, 0xb8985a);
  v.box(-3, 1, -2, -3, 4, -2, 0xb8985a);
  v.set(-4, 3, 2, C.black);
  m.part('body', v);
  // pakpak na nakataas (kanang pakpak; ang kaliwa ay naka-mirror)
  const w = new Vox();
  for (let i = 0; i <= 8; i++) {
    const ax = i;
    const ay = Math.round(i * 0.9);
    w.set(ax, ay, 0, blue);
    const len = 3 + Math.round(i * 0.7);
    for (let d = 1; d <= len; d++) {
      const c = i >= 7 ? C.teal : d <= 2 ? (i % 2 ? C.teal : C.deepBlue) : C.red;
      w.set(ax + Math.floor(d / 3), ay - d, 0, c);
    }
  }
  for (const side of [-1, 1]) {
    const p = m.pivot(side * 4, 12, -1);
    p.scale.x = side;
    p.userData.flapAxis = 'z';
    p.userData.flapAmp = 0.25;
    m.part('wing', w, p);
    m.wings.push(p);
  }
  return m.done();
}

// ---------- Mga halimaw ----------

function aswang(body: number) {
  const m = new VoxModel('aswang', 1 / 16);
  const v = new Vox();
  const grey = 0x4a3a3a;
  v.boxSym(1, 0, 0, 2, 3, 0, grey); // paa
  for (let y = 4; y <= 10; y++) {
    const dz = Math.floor((y - 4) / 3); // kuba, nakayuko pasulong
    v.box(-3, y, -1 + dz, 3, y, 1 + dz, body);
  }
  v.box(-2, 10, 1, 2, 13, 4, grey); // ulo
  v.box(-3, 12, -1, 3, 14, 2, C.black); // buhok
  v.box(-3, 6, -2, 3, 13, -2, C.black);
  v.boxSym(1, 12, 5, 1, 12, 5, C.redGlow, true); // mata
  v.box(-1, 10, 5, 1, 10, 5, C.white); // pangil
  v.boxSym(4, 3, 1, 4, 9, 1, grey); // mahabang braso
  v.boxSym(4, 1, 2, 4, 2, 2, C.white); // kuko
  m.part('body', v);
  return m.done();
}

// Batay sa assets/reference/manananggal.png: itaas na kalahati lang ang lumilipad
// (naiwan ang palda at paa), nakalawit ang bituka, malaking kayumangging pakpak.
function manananggal(_tint: number) {
  const m = new VoxModel('manananggal', 1 / 20);
  const v = new Vox();
  const skin = 0xd9a070;
  const blouse = 0xeee2c4;
  const blouseShade = 0xcdbf9e;
  const gut = 0xb8404a;
  const gutLight = 0xd8737a;
  const raw = 0x6e1420;
  // nakalawit na bituka
  v.line([[-1, 6, 0], [-2, 4, 1], [-1, 2, 0], [-2, 0, 1]], gut);
  v.line([[1, 6, 0], [2, 4, 0], [1, 3, 1], [2, 1, 0]], gutLight);
  v.line([[0, 6, 1], [0, 4, 1], [1, 2, 1]], gut);
  v.box(-2, 6, -1, 2, 6, 1, raw); // putol na baywang
  // blusa (baro) na may puff sleeves
  v.box(-2, 7, -1, 2, 8, 1, blouse);
  v.box(-3, 9, -1, 3, 12, 1, blouse);
  v.box(0, 8, 1, 0, 11, 1, blouseShade); // tahi sa harap
  v.boxSym(4, 10, -1, 5, 12, 1, blouse);
  v.boxSym(4, 10, 1, 5, 10, 1, blouseShade);
  v.box(-1, 12, 1, 1, 12, 1, skin); // leeg ng blusa
  // braso at kamay
  v.boxSym(4, 5, 0, 4, 9, 0, skin);
  v.boxSym(4, 4, 0, 4, 4, 1, skin);
  // leeg at ulo
  v.box(-1, 13, -1, 1, 13, 0, skin);
  v.box(-2, 14, -1, 2, 18, 2, skin);
  v.boxSym(1, 16, 2, 1, 16, 2, C.black); // mata
  v.boxSym(1, 16, 3, 1, 16, 3, C.redGlow, true); // kislap ng mata
  v.set(0, 14, 2, C.red); // labi
  // mahabang itim na buhok
  v.box(-2, 19, -2, 2, 19, 2, C.black);
  v.boxSym(3, 12, -2, 3, 18, 1, C.black);
  v.box(-2, 6, -2, 2, 18, -2, C.black);
  v.box(-1, 18, 2, 2, 18, 2, C.black); // bangs
  m.part('body', v);
  // pakpak ng paniki (kanan; naka-mirror ang kaliwa)
  const bone = 0x5a3428;
  const membrane = 0x8f6150;
  const w = new Vox();
  for (let x = 0; x <= 11; x++) {
    const top = x <= 7 ? Math.round(x * 1.2) : Math.round(8.4 - (x - 7) * 0.8);
    const bottom = -1 - Math.round(x * 0.8) + (x % 3 === 1 ? 2 : 0);
    for (let y = bottom; y <= top; y++) {
      const torn = x >= 4 && y === bottom && x % 4 === 0;
      if (torn) continue;
      w.set(x, y, 0, y === top || x % 3 === 0 ? bone : membrane);
    }
  }
  for (const side of [-1, 1]) {
    const p = m.pivot(side * 2, 11, -2);
    p.scale.x = side;
    m.part('wing', w, p);
    m.wings.push(p);
  }
  return m.done();
}

function tikbalang(body: number) {
  const m = new VoxModel('tikbalang', 1 / 22);
  const v = new Vox();
  v.boxSym(1, 0, -1, 2, 1, 1, C.black); // kuko ng kabayo
  v.boxSym(1, 2, 0, 2, 8, 0, 0x3b2a1e); // mahabang binti
  v.box(-3, 9, -2, 3, 15, 2, body);
  v.boxSym(4, 8, 0, 4, 14, 0, body); // braso
  v.box(-1, 16, 0, 1, 17, 1, body); // leeg
  v.box(-1, 17, 1, 1, 20, 5, body); // ulo ng kabayo
  v.box(-1, 16, 5, 1, 18, 7, 0x5a3a24); // nguso
  v.boxSym(1, 17, 7, 1, 17, 7, C.black);
  v.box(0, 18, -1, 0, 22, 3, C.black); // kiling
  v.boxSym(1, 21, 2, 1, 21, 2, body); // tainga
  v.boxSym(1, 19, 4, 1, 19, 4, C.redGlow, true);
  m.part('body', v);
  return m.done();
}

// Batay sa assets/reference/kapre.png (at kapre walk sheet): mabalahibong higante
// (maitim na kayumanggi), malapad na balikat at dibdib, bahagyang nakayuko ang ulo na
// parang gorilya, mahabang buhok mula ulo hanggang likod, maputlang kumikinang na mata,
// tabako sa kaliwang gilid ng bibig, palda ng dahon na may lubid, mahahabang braso
// hanggang tuhod na may malalaking kamao, makakapal na binti at malalapad na paa.
// Hiwalay ang binti at braso (may pivot sa balakang at balikat) para sa lakad.
function kapre(_tint: number) {
  const m = new VoxModel('kapre', 1 / 32);
  const v = new Vox();
  const furs = [0x3a281c, 0x342319, 0x412c1e, 0x2e2017];
  const furLit = 0x4a3424;
  const furDark = 0x22170f;
  const skin = 0x3a281d;
  const muzzle = 0x4a3426;
  const mane = 0x241810;
  const maneLit = 0x30211a;
  const rope = 0x7a5a3a;
  const leafs = [0x2e4a2a, 0x3a5a32, 0x24401f];
  const eye = 0xfff0b0;
  const hash = (x: number, y: number, z: number) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
  // balahibo: halo-halong kulay; mas maliwanag sa harap para may hugis ang kalamnan
  const fur = (x: number, y: number, z: number) => (z >= 3 && hash(x, y, z) % 3 === 0 ? furLit : furs[hash(x, y, z) % furs.length]!);
  const blob = (t: Vox, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) => t.ellipsoid(cx, cy, cz, rx, ry, rz, fur);
  // ---- katawan ----
  // balakang at tiyan
  blob(v, 0, 14.5, 0.3, 5.5, 3, 3.6);
  blob(v, 0, 16, 1, 5, 2.5, 3.8);
  // malapad na dibdib (pecs) at likod
  blob(v, 0, 20, 0, 7, 4.2, 4.2);
  for (const s of [-1, 1]) blob(v, s * 2.6, 20.5, 2.2, 2.8, 2.2, 2.2);
  // trapezius at balikat
  blob(v, 0, 23.5, -0.8, 5.5, 2.2, 3);
  for (const s of [-1, 1]) blob(v, s * 7.2, 21.8, -0.2, 2.8, 2.6, 2.8);
  // lubid na sinturon at nakalawit na tali
  for (let x = -6; x <= 6; x++) for (let z = -4; z <= 5; z++) {
    if ((x / 5.6) ** 2 + ((z - 0.5) / 4.3) ** 2 <= 1 && (x / 4.6) ** 2 + ((z - 0.5) / 3.3) ** 2 > 1) v.set(x, 13, z, rope);
  }
  v.box(-2, 9, 5, -2, 12, 5, rope);
  v.set(-1, 9, 5, rope);
  // palda ng dahon: patulis na dahon na nakalawit mula sa sinturon
  for (let a = 0; a < 22; a++) {
    const t = (a / 22) * Math.PI * 2;
    const x = Math.round(Math.sin(t) * 5.9);
    const z = Math.round(0.5 + Math.cos(t) * 4.6);
    const len = 4 + (a % 2) + (Math.abs(Math.cos(t)) > 0.7 ? 1 : 0);
    const c = leafs[a % leafs.length]!;
    for (let k = 0; k < len; k++) v.set(x, 12 - k, z, c);
  }
  // ulo: nakayuko pasulong, may noo, nguso at panga na parang gorilya
  v.ellipsoid(0, 26.5, 1.6, 3.3, 3.3, 3.2, skin);
  v.box(-3, 27, 4, 3, 28, 4, furDark); // makapal na noo / kilay
  v.box(-2, 27, 5, 2, 27, 5, furDark);
  v.boxSym(1, 26, 4, 2, 26, 4, skin);
  v.boxSym(1, 26, 4, 1, 26, 4, eye, true); // maputlang mata
  v.box(-2, 23, 3, 2, 25, 5, muzzle); // nguso
  v.box(-1, 25, 6, 1, 25, 6, furDark); // ilong
  v.box(-1, 24, 6, 1, 24, 6, muzzle);
  v.box(-1, 23, 6, 1, 23, 6, furDark); // bibig
  // tabako sa kaliwang gilid ng bibig, may baga at usok
  v.line([[1, 23, 6], [3, 23, 7], [5, 24, 7]], 0x7a4a2a);
  v.set(6, 24, 7, 0xff6a00, true);
  v.set(6, 26, 7, 0x8a8a8a).set(7, 28, 7, 0xaaaaaa);
  // mahabang buhok: bumabalot sa tuktok at gilid ng ulo, hanggang gitna ng likod
  v.ellipsoid(0, 27.5, 0.6, 3.8, 3.4, 3.4, (x, y, z) => (z >= 3 && y <= 28 ? null : (x + y) % 3 === 0 ? maneLit : mane));
  for (let x = -6; x <= 6; x++) {
    const bottom = 12 + Math.abs(x) + (x % 2 === 0 ? 0 : 1);
    v.box(x, bottom, -4 - (Math.abs(x) <= 3 ? 1 : 0), x, 26, -4, Math.abs(x) % 3 === 1 ? maneLit : mane);
  }
  v.boxSym(4, 21, -3, 4, 27, 1, mane); // buhok na nakalawit sa gilid ng mukha
  v.boxSym(5, 19, -3, 5, 23, -1, mane);
  m.part('body', v);
  // ---- binti (pivot sa balakang: x=3, y=13) ----
  const hip = [3, 13, 0] as const;
  const leg = new Vox();
  blob(leg, 0.5, 4.5 - hip[1], 0.5, 2.3, 3.5, 2.3);
  blob(leg, 0.5, 9 - hip[1], 0.5, 2.6, 2.5, 2.6);
  blob(leg, 0.3, 12 - hip[1], 0.3, 3, 2.5, 3);
  leg.box(-1, -hip[1], -2, 2, 1 - hip[1], 3, furDark); // malapad na paa
  for (const x of [-1, 0, 1, 2]) leg.set(x, -hip[1], 4, x % 2 ? skin : furDark); // daliri
  m.limbPair('leg', leg, 'leg', ...hip);
  // ---- braso (pivot sa balikat: x=8, y=21): balikat → siko → pulso → kamao ----
  const sh = [8, 21, 0] as const;
  const arm = new Vox();
  blob(arm, 0.6, 18.5 - sh[1], 0, 2.2, 3, 2.3);
  blob(arm, 1, 14 - sh[1], 0.5, 2, 2.6, 2.1);
  blob(arm, 1.2, 10.8 - sh[1], 0.8, 1.8, 1.6, 1.9);
  arm.ellipsoid(1.3, 8 - sh[1], 1, 2.2, 2.2, 2.2, furDark);
  arm.box(1, 6 - sh[1], 2, 2, 7 - sh[1], 3, skin); // mga daliri
  m.limbPair('arm', arm, 'arm', ...sh);
  return m.done();
}

function mangkukulam(robe: number) {
  const m = new VoxModel('mangkukulam', 1 / 18);
  const v = new Vox();
  for (let y = 0; y <= 11; y++) {
    const r = 4 - Math.floor(y / 4);
    v.box(-r, y, -r, r, y, r, robe);
  }
  v.box(-2, 11, -1, 2, 14, 3, 0x8a9a7a); // maputlang mukha
  v.set(0, 12, 4, 0x8a9a7a); // ilong
  v.boxSym(1, 13, 3, 1, 13, 3, 0xc040ff, true);
  v.box(-3, 12, -2, 3, 16, 0, robe); // talukbong
  v.box(-2, 16, 0, 2, 16, 2, robe);
  v.box(-2, 5, -3, 2, 12, -3, 0xdedede); // puting buhok
  v.box(-5, 6, 2, -5, 8, 2, 0xd8c8a0); // manika
  v.set(-5, 9, 2, 0xd8c8a0).set(-6, 7, 2, 0xb0b0b0);
  v.box(5, 9, 2, 5, 10, 3, 0xc040ff, true); // orb ng sumpa
  v.boxSym(4, 7, 1, 4, 8, 1, 0x8a9a7a);
  m.part('body', v);
  return m.done();
}

function bakunawa(body: number) {
  const m = new VoxModel('bakunawa', 1 / 12);
  const head = new Vox();
  head.box(-2, 4, 0, 2, 7, 5, body);
  head.box(-1, 4, 6, 1, 6, 7, body); // nguso
  head.box(-2, 2, 1, 2, 2, 7, 0x0f4555); // panga
  head.box(-1, 3, 3, 1, 3, 7, 0xff4a10, true); // apoy sa bibig
  head.boxSym(2, 7, 4, 2, 7, 4, 0xffd000, true); // mata
  head.boxSym(1, 8, 1, 1, 9, 0, C.bone); // sungay
  head.boxSym(1, 10, -1, 1, 10, -1, C.bone);
  head.boxSym(3, 6, 1, 4, 6, 2, 0x2fb5a0); // palikpik
  m.part('head', head);
  // katawan: mga segment na umaalon
  const n = 9;
  for (let i = 0; i < n; i++) {
    const r = 2.6 - i * 0.18;
    const seg = new Vox();
    seg.ellipsoid(0, 0, 0, r, r, r, (x, y) => ((x + y) % 2 === 0 ? body : 0x2a9aa8));
    seg.box(0, Math.ceil(r), 0, 0, Math.ceil(r) + 1, 0, 0x2fb5a0); // palikpik sa likod
    const p = m.pivot(0, 3.2 - i * 0.12, -2 - i * 3.6);
    m.part(`seg${i}`, seg, p);
    m.segments.push(p);
  }
  return m.done();
}
