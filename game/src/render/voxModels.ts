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
   * Binti/braso na umuugoy, may pivot sa (x,y,z); ang `v` ay nakaayos kaugnay ng pivot.
   * `side` = -1 (kanang panig ng karakter, -x) o 1; `swing` = bahagi ng FX na ugoy.
   */
  limb(name: string, v: Vox, limb: 'leg' | 'arm', x: number, y: number, z: number, side: number, swing = 1) {
    const p = this.pivot(x, y, z);
    p.userData.limb = limb;
    p.userData.side = side;
    p.userData.swing = swing;
    this.part(name, v, p);
    this.limbs.push(p);
    return p;
  }

  /** Magkaparehong binti/braso: ang `v` ay ang +x na bahagi; naka-mirror sa -x. */
  limbPair(name: string, v: Vox, limb: 'leg' | 'arm', x: number, y: number, z: number) {
    for (const side of [-1, 1]) this.limb(name, v, limb, side * x, y, z, side).scale.x = side;
  }

  done(): Model {
    return { root: this.root, mats: this.mats, wings: this.wings, segments: this.segments, limbs: this.limbs };
  }
}

export function buildVoxelModel(kind: UnitKind, color: number): Model {
  switch (kind) {
    case 'tanod': return tanod(color);
    case 'anito': return anito(color);
    case 'malupiton': return malupiton(color);
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

// Batay sa assets/reference/malupiton.png: magiting na mandirigmang may kambal na kampilan/talim.
// Salakot na may habi, pulang putong (headband) sa noo, kayumangging katawan na may
// krus na leather harness at gintong medalyon sa dibdib, pulang bahag na may gintong palawit,
// at dalawang makintab na bakal na espada (twin blades) sa magkabilang kamay.
function malupiton(_tint: number) {
  const m = new VoxModel('malupiton', 1 / 24);
  const v = new Vox();
  const skin = 0xb67b4e;
  const skinDark = 0x945f3b;
  const red = 0xc41c1c;
  const redDark = 0x8e1212;
  const gold = 0xf5c242;
  const leather = 0x4a2a14;
  const straw = 0xd8b46a;
  const strawDark = 0xb8924e;
  const hair = 0x1a1410;

  // ---- Katawan & Balakang (Bahag & Dibdib) ----
  // Pulang bahag / sinturon
  v.box(-3, 8, -2, 3, 9, 2, red);
  v.box(-3, 8, -2, 3, 8, -2, redDark);
  // Gintong palawit sa harap ng bahag
  v.box(-1, 5, 2, 1, 8, 2, red);
  v.set(0, 5, 3, gold);
  v.set(0, 7, 3, gold);

  // Kayumangging dibdib at likod
  v.box(-3, 10, -2, 3, 14, 2, skin);
  v.boxSym(3, 10, -2, 3, 14, -2, skinDark);

  // Krus na leather harness (X straps sa dibdib)
  v.set(-2, 14, 2, leather);
  v.set(-1, 13, 2, leather);
  v.set(0, 12, 2, gold); // Gintong medalyon / buckle sa gitna ng dibdib
  v.set(1, 11, 2, leather);
  v.set(2, 10, 2, leather);

  v.set(2, 14, 2, leather);
  v.set(1, 13, 2, leather);
  v.set(-1, 11, 2, leather);
  v.set(-2, 10, 2, leather);

  // X straps sa likod
  v.set(-2, 14, -2, leather);
  v.set(-1, 13, -2, leather);
  v.set(0, 12, -2, leather);
  v.set(1, 11, -2, leather);
  v.set(2, 10, -2, leather);
  v.set(2, 14, -2, leather);
  v.set(1, 13, -2, leather);
  v.set(-1, 11, -2, leather);
  v.set(-2, 10, -2, leather);

  // Leeg at mukha
  v.box(-1, 15, -1, 1, 15, 0, skin);
  v.box(-2, 16, -2, 2, 19, 2, skin);
  v.boxSym(3, 17, 0, 3, 17, 0, skinDark); // tainga
  v.boxSym(1, 17, 2, 1, 17, 2, hair); // matatalim na mata / kilay
  v.set(0, 16, 3, skinDark); // ilong
  v.set(0, 15, 2, 0x6e2c1c); // bibig
  // Itim na buhok sa likod at gilid
  v.box(-2, 16, -2, 2, 19, -2, hair);
  v.boxSym(2, 16, -1, 2, 18, 0, hair);

  // Pulang putong (mandirigmang headband) sa noo
  v.box(-2, 18, 2, 2, 18, 2, red);
  v.boxSym(2, 18, -2, 2, 18, 1, red);
  v.box(-2, 18, -2, 2, 18, -2, redDark);
  v.box(-1, 16, -3, -1, 17, -3, red); // tali ng putong na nakalawit sa likod

  // Salakot (conical woven straw hat)
  const weave = (x: number, z: number) => (((x + z) & 1) === 0 ? straw : strawDark);
  for (let x = -6; x <= 6; x++) {
    for (let z = -6; z <= 6; z++) {
      const r2 = x * x + z * z;
      if (r2 <= 32) v.set(x, 20, z, r2 > 24 ? strawDark : weave(x, z));
      if (r2 <= 16) v.set(x, 21, z, weave(x, z));
      if (r2 <= 6) v.set(x, 22, z, weave(x, z));
    }
  }
  v.set(0, 23, 0, 0x8a5a22); // dulo ng salakot

  m.part('body', v);

  // ---- Binti (legs) may pivot sa balakang ----
  const hip = [2.2, 8, 0] as const;
  const leg = new Vox();
  // Pulang pantalon/bahag sa hita
  leg.box(-1, -4, -1, 1, 0, 1, red);
  leg.box(-1, -4, -1, 1, -1, -1, redDark);
  // Kayumangging binti at paa
  leg.box(-1, -7, -1, 1, -5, 1, skin);
  leg.box(-1, -8, -1, 1, -8, 2, skinDark); // paa
  m.limbPair('leg', leg, 'leg', ...hip);

  // ---- Braso at Kambal na Espada (Twin Kampilan / Swords) ----
  // Pivot sa balikat (x=4, y=13, z=0)
  const sh = [4.2, 13, 0] as const;
  const arm = new Vox();
  const steel = 0xd8dfe8;
  const steelDark = 0x788494;
  const steelEdge = 0xffffff;
  const wood = 0x3d2314;

  // Balikat at braso
  arm.box(-1, -3, -1, 1, 0, 1, skin);
  // Gintong balangkas / armband sa bicep
  arm.box(-1, -2, -1, 1, -2, 1, gold);
  // Bisig at kamao
  arm.box(-1, -6, 0, 1, -4, 1, skin);
  arm.box(-1, -6, 1, 1, -5, 2, skinDark); // kamao na humahawak sa espada

  // Espada / Kampilan: hawakan sa kamao
  arm.box(0, -6, -1, 0, -6, 2, wood); // hawakan
  arm.set(0, -6, -2, gold); // pommel / dulo ng hawakan
  arm.set(0, -6, 2, gold); // crossguard

  // Talim ng espada: nakatutok paharap at bahagyang pataas
  for (let z = 3; z <= 9; z++) {
    const yOff = Math.floor((z - 3) * 0.35); // bahagyang kurba pataas
    const yBlade = -6 + yOff;
    arm.set(0, yBlade, z, steel);
    arm.set(0, yBlade - 1, z, steelEdge); // matalas na talim sa ibaba
    arm.set(0, yBlade + 1, z, steelDark); // likod ng espada
  }
  // Lumalapad na dulo ng kampilan (flared tip) sa dulo (z=9, 10)
  arm.set(0, -4, 10, steelEdge);
  arm.set(0, -3, 10, steel);
  arm.set(0, -2, 9, steelDark);

  m.limbPair('arm', arm, 'arm', ...sh);

  return m.done();
}

// Batay sa assets/reference/sarimanok.png: maalamat na ibon. Kremang katawan, ulo na
// may bahagharing kwelyo ng balahibo (pula → kahel → dilaw → berde → asul), pulang mukha,
// dilaw na baluktot na tuka, palong na pula/kahel/dilaw na pabalik. Malalaking pakpak na
// nakataas: kremang balahibo sa itaas, tapos pula, asul at lila sa dulo (hiwa-hiwalay na
// dulo). Mahahabang laso na buntot (pula, dilaw, asul, lila) na sumasayad at kumukulot.
// Binti: may pivot (lakad); pakpak: pumapagaspas.
function sarimanok(_tint: number) {
  const m = new VoxModel('sarimanok', 1 / 30);
  const v = new Vox();
  const cream = 0xf6e3a0;
  const creamShade = 0xdcc07a;
  const gold = 0xe8b448;
  const red = 0xd8283a;
  const redDark = 0xa01c2c;
  const orange = 0xf07a28;
  const yellow = 0xffd23a;
  const green = 0x4cb84a;
  const blue = 0x2e5ad8;
  const blueDark = 0x24338e;
  const purple = 0x6a3aa8;
  const beak = 0xf2b230;
  const leg = 0xd9a441;
  const talon = 0x4a3a2a;
  // ---- katawan: dibdib na nakataas sa harap, puwitan sa likod ----
  const body = (x: number, y: number, z: number) => (y >= 14 && z <= 1 ? creamShade : (x + y + z) % 5 === 0 ? creamShade : cream);
  v.ellipsoid(0, 13, 1.5, 4, 4.2, 3.8, body);
  v.ellipsoid(0, 11.5, -2.5, 3.5, 3.3, 4, body);
  // leeg
  v.ellipsoid(0, 16.5, 2.8, 2.2, 2.8, 2.2, cream);
  // ---- bahagharing kwelyo: mga singsing sa paligid ng mukha ----
  const ruff = [red, orange, yellow, green, blue, purple];
  const face = [0, 20.5, 7] as const;
  v.ellipsoid(0, 19.5, 2.8, 4.3, 4.6, 3.2, (x, y, z) => {
    const d = Math.hypot(x - face[0], (y - face[1]) * 0.9, (z - face[2]) * 0.55) - 2.2;
    const band = Math.max(0, Math.min(ruff.length - 1, Math.floor(d / 0.8)));
    return ruff[band]!;
  });
  // matulis na dulo ng kwelyo (pababa at sa gilid)
  for (const s of [-1, 1]) {
    v.line([[s * 3, 17, 2], [s * 4, 15, 1], [s * 4, 14, 0]], purple);
    v.line([[s * 2, 16, 3], [s * 2, 14, 3]], blue);
  }
  v.line([[0, 16, 4], [0, 14, 4]], purple);
  // ---- ulo: kremang ulo, pulang mukha, mata, tuka at lambi ----
  v.ellipsoid(0, 21, 5, 2.2, 2.3, 2.2, cream);
  v.boxSym(2, 20, 5, 2, 22, 6, red); // pulang balat sa paligid ng mata
  v.boxSym(2, 21, 6, 2, 21, 6, C.black); // mata
  v.boxSym(2, 22, 6, 2, 22, 6, C.white); // kislap
  v.box(-1, 20, 7, 1, 21, 8, beak); // tuka
  v.box(0, 20, 9, 0, 20, 9, beak);
  v.set(0, 19, 9, gold); // baluktot na dulo
  v.box(0, 18, 7, 0, 19, 7, red); // lambi
  // ---- palong: mga balahibong pataas at pabalik ----
  const crest = [red, orange, yellow, red, orange];
  for (let i = 0; i < crest.length; i++) {
    const s = i - 2;
    v.line([[s * 0.5, 23, 5 - Math.abs(s) * 0.3], [s, 25.5, 4 - i * 0.4], [s * 1.4, 27.5 - Math.abs(s) * 0.6, 2 - i * 0.5]], crest[i]!);
  }
  v.box(0, 23, 4, 0, 24, 6, red);
  // ---- mahahabang laso na buntot: sumasayad sa lupa at kumukulot pataas ----
  const tails: [number, number, number, number][] = [
    // [x sa dulo, haba, kulay ng puno, kulay ng dulo]
    [-6, 14, red, purple],
    [-4, 17, yellow, blue],
    [-1.5, 19, blue, purple],
    [0, 21, red, yellow],
    [1.5, 19, purple, blue],
    [4, 17, yellow, red],
    [6, 14, blue, purple],
  ];
  for (const [x, len, base, tip] of tails) {
    const z0 = -5;
    const z1 = z0 - len;
    const curl = 3 + (len % 3);
    const pts: [number, number, number][] = [[x * 0.25, 11, z0], [x * 0.5, 7, z0 - len * 0.3], [x * 0.85, 2, z0 - len * 0.65], [x, 1, z1 + 2], [x, 1 + curl, z1]];
    v.line(pts.slice(0, 3), base);
    v.line(pts.slice(2), tip);
    v.set(x, 2 + curl, z1 + 1, tip);
  }
  // balahibo sa puwitan na nagtatakip sa puno ng buntot
  v.ellipsoid(0, 11, -6, 2.6, 2, 2, (x, y) => ((x + y) % 2 === 0 ? orange : red));
  m.part('body', v);
  // ---- binti (pivot sa balakang): mabalahibong hita, dilaw na binti, kuko ----
  const hip = [2, 9, 0] as const;
  const lg = new Vox();
  lg.ellipsoid(0, -0.5, 0.3, 1.9, 2.4, 2, creamShade); // hita
  lg.box(0, -6, 0, 1, -3, 0, leg);
  lg.set(0, -5, 1, leg);
  lg.box(0, -9, 1, 0, -7, 1, leg);
  for (const dx of [-1, 0, 1]) lg.line([[0, -9, 1], [dx, -9, 3]], leg); // daliri
  for (const dx of [-1, 0, 1]) lg.set(dx, -9, 4, talon);
  lg.set(0, -9, -1, talon);
  m.limbPair('leg', lg, 'leg', ...hip);
  // ---- pakpak na nakataas (kanang pakpak; ang kaliwa ay naka-mirror) ----
  // Gilid sa harap: balikat → siko → dulo; ang balahibo ay nakalawit pababa-palabas.
  const w = new Vox();
  const edge = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 5, -1), new THREE.Vector3(8, 10, -3), new THREE.Vector3(11, 15, -5)]);
  const n = 52;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = edge.getPoint(t);
    const len = 4 + t * 8; // mas mahaba ang balahibo sa dulo
    const finger = t > 0.55 && i % 4 >= 2; // hiwa-hiwalay na dulo
    for (let d = 0; d <= len; d += 0.5) {
      const f = d / len;
      if (finger && f > 0.7) break;
      const x = p.x + d * (0.45 + t * 0.4);
      const y = p.y - d * (0.95 - t * 0.25);
      const c = f < 0.12 ? gold : f < 0.38 ? cream : f < 0.62 ? (i % 6 === 0 ? redDark : red) : f < 0.86 ? blue : t > 0.5 ? purple : blueDark;
      w.set(x, y, p.z, c);
      if (f < 0.5) w.set(x, y, p.z - 1, f < 0.38 ? creamShade : redDark); // kapal sa itaas
    }
  }
  for (const side of [-1, 1]) {
    const p = m.pivot(side * 3, 15, -1);
    p.scale.x = side;
    p.userData.flapAxis = 'z';
    p.userData.flapAmp = 0.3;
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

// Batay sa assets/reference/mangkukulam.png: matandang babae, kuba nang bahagya,
// uban na nakapusod (bun), kayumangging balabal sa balikat (patulis sa likod),
// kuwintas na may bungo, maitim-asul na baro at mahabang palda na may disenyo sa
// laylayan, kayumangging tapis sa harap, bungo sa sinturon, sandalyas. Kanang kamay:
// baluktot na tungkod na may nakasabit na halamang-gamot; kaliwa: bayong ng halaman.
function mangkukulam(_tint: number) {
  const m = new VoxModel('mangkukulam', 1 / 34);
  const v = new Vox();
  const skin = 0xb07850;
  const skinDark = 0x8a5a3a;
  const navy = 0x27314c;
  const navyDark = 0x1c2338;
  const pattern = 0x7088b0;
  const brown = 0x6b4426;
  const brownDark = 0x4a2e18;
  const trim = 0x9a6a3a;
  const sash = 0x2a1e18;
  const grey = 0xa8a8a8;
  const greyDark = 0x828282;
  const skull = 0xe8dcc0;
  const wood = 0x6a4428;
  const woodDark = 0x4a2e1a;
  const sandal = 0x3a2616;
  const herb = 0x3e6a2e;
  const herbDark = 0x2a4a22;
  const curse = 0xc040ff;
  // ---- mahabang palda (bahagyang lumalapad pababa) na may disenyo sa laylayan ----
  for (let y = 3; y <= 13; y++) {
    const rx = 4.4 - (y - 3) * 0.1;
    const rz = 3.6 - (y - 3) * 0.08;
    for (let x = -5; x <= 5; x++) for (let z = -4; z <= 5; z++) {
      if ((x / rx) ** 2 + ((z - 0.3) / rz) ** 2 > 1) continue;
      const band = y === 4 || (y === 6 && (x + z) % 3 === 0);
      v.set(x, y, z, band ? pattern : y === 3 ? navyDark : navy);
    }
  }
  // tapis sa harap (may gilid at guhit)
  for (let y = 6; y <= 14; y++) for (let x = -3; x <= 3; x++) {
    const edge = Math.abs(x) === 3 || y === 6;
    v.set(x, y, 4, edge ? brownDark : y === 8 || y === 11 ? trim : brown);
  }
  // pamigkis sa baywang at bungo na nakasabit sa kanan
  for (let x = -4; x <= 4; x++) for (let z = -3; z <= 4; z++) {
    if ((x / 4.2) ** 2 + ((z - 0.5) / 3.6) ** 2 <= 1) v.set(x, 14, z, sash);
  }
  v.box(-3, 10, 4, -3, 13, 4, sash);
  v.box(-4, 9, 4, -3, 10, 5, skull);
  v.set(-4, 10, 5, C.black).set(-3, 10, 5, C.black);
  // ---- baro (kuba nang bahagya: pasulong ang itaas) ----
  v.ellipsoid(0, 17.5, 0.6, 3.8, 3.2, 2.8, navy);
  v.ellipsoid(0, 20.5, 1.2, 3.4, 2, 2.6, navy);
  // balabal sa balikat: nakabalot sa itaas, patulis na tatsulok sa likod
  v.ellipsoid(0, 20.8, 0.8, 5, 2, 3.4, (x, y, z) => (z >= 3 && Math.abs(x) <= 1 ? null : y <= 19 ? brownDark : brown));
  for (let y = 11; y <= 20; y++) {
    const w = Math.floor((y - 10) * 0.55);
    for (let x = -w; x <= w; x++) v.set(x, y, -3, Math.abs(x) === w || y === 11 ? trim : brown);
  }
  // nakalawit sa harap ng dibdib (dalawang gilid)
  for (const s of [-1, 1]) v.box(s * 2, 15, 3, s * 3, 19, 3, brown).box(s * 3, 15, 3, s * 3, 19, 3, brownDark);
  // kuwintas na may bungo
  v.box(-1, 19, 4, 1, 19, 4, sash);
  v.box(-1, 16, 4, 1, 18, 4, skull);
  v.set(-1, 17, 5, C.black).set(1, 17, 5, C.black);
  // ---- leeg at ulo (kulubot na mukha, uban na nakapusod) ----
  v.box(-1, 22, 1, 1, 22, 2, skin);
  v.ellipsoid(0, 24.8, 2, 2.6, 2.9, 2.5, skin);
  v.boxSym(1, 25, 4, 1, 25, 4, C.black); // mata
  v.boxSym(1, 26, 4, 2, 26, 4, skinDark); // kulubot na kilay
  v.set(0, 24, 5, skinDark); // ilong
  v.box(-1, 23, 4, 1, 23, 4, skinDark); // bibig
  v.boxSym(2, 23, 3, 2, 24, 3, skinDark); // kulubot sa pisngi
  v.ellipsoid(0, 25.6, 1.6, 2.9, 3, 2.8, (x, y, z) => (z >= 3 && y <= 26 ? null : (x + y) % 2 === 0 ? grey : greyDark));
  v.ellipsoid(0, 28.4, -0.4, 1.7, 1.5, 1.6, (x, y) => ((x + y) % 2 === 0 ? grey : greyDark)); // pusod
  m.part('body', v);
  // ---- paa (sandalyas): ang kita lang ay sa ilalim ng palda ----
  const hip = [2, 10, 0] as const;
  const leg = new Vox();
  leg.box(0, 2 - hip[1], 0, 0, 5 - hip[1], 1, skin);
  leg.box(-1, 1 - hip[1], 0, 1, 1 - hip[1], 2, skin);
  leg.box(-1, -hip[1], -1, 1, -hip[1], 3, sandal);
  m.limbPair('leg', leg, 'leg', ...hip);
  // ---- kanang braso (-x) na may baluktot na tungkod ----
  const rs = [-4, 20, 1] as const;
  const ra = new Vox();
  ra.box(-1, -5, -1, 0, 0, 1, navy); // manggas
  ra.box(-1, -7, 0, 0, -5, 2, navy);
  ra.box(-1, -8, 1, 0, -8, 3, navyDark); // laylayan ng manggas
  ra.box(-2, -10, 2, 0, -9, 3, skin); // kamay na hawak ang tungkod
  for (let y = -rs[1]; y <= 13; y++) ra.set(-2, y, 3, y % 3 === 0 ? woodDark : wood); // pilipit na kahoy
  for (const y of [-9, -2, 5, 11]) ra.set(-2, y, 4, woodDark); // buko-buko
  ra.line([[-2, 13, 3], [-1, 15, 3], [1, 15, 3], [2, 13, 3], [1, 12, 3]], woodDark); // kulot sa tuktok
  ra.set(0, 14, 3, curse, true); // kislap ng sumpa
  ra.box(2, 10, 3, 2, 11, 3, herbDark); // halamang nakasabit
  ra.box(-3, 9, 3, -3, 12, 3, herbDark);
  ra.set(-3, 8, 3, sash);
  m.limb('armR', ra, 'arm', ...rs, -1, 0.5);
  // ---- kaliwang braso (+x) na may bayong ng halaman ----
  const ls = [4, 20, 1] as const;
  const la = new Vox();
  la.box(0, -5, -1, 1, 0, 1, navy);
  la.box(0, -6, 1, 1, -5, 3, navy); // nakabaluktot na siko
  la.box(0, -6, 4, 1, -5, 4, skin); // kamay
  for (let x = 1; x <= 5; x++) for (let y = -11; y <= -8; y++) for (let z = 1; z <= 5; z++) {
    if (((x - 3) / 2.4) ** 2 + ((z - 3) / 2.4) ** 2 > 1) continue;
    la.set(x, y, z, (x + y + z) % 2 === 0 ? trim : wood);
  }
  for (const [x, z, h] of [[2, 2, 2], [3, 4, 3], [4, 3, 2], [3, 2, 1], [2, 4, 1]] as const) la.box(x, -7, z, x, -7 + h, z, h > 1 ? herb : herbDark);
  la.line([[1, -8, 3], [1, -5, 3], [5, -5, 3], [5, -8, 3]], wood); // hawakan
  m.limb('armL', la, 'arm', ...ls, 1, 0.6);
  return m.done();
}

// Batay sa assets/reference/bakunawa.png: dragong-ahas na may apat na paa. Maitim na
// asul-berdeng kaliskis, kremang tiyan na may kumikinang na cyan na guhit sa dibdib,
// pakurbang leeg (S) at ulong nakataas, dalawang pares ng sungay na pabalik, palikpik
// sa pisngi, tinik sa buong likod, mahabang buntot na pakulot pataas na may palumpong na
// palikpik sa dulo. Paa: may pivot (pahilis na lakad); buntot: mga segment na umaalon.
function bakunawa(_tint: number) {
  const m = new VoxModel('bakunawa', 1 / 28);
  const v = new Vox();
  const scales = [0x1c3442, 0x203c4c, 0x1a2f3d, 0x23415a];
  const scaleLit = 0x3a6a7a;
  const dorsal = 0x14252f;
  const belly = 0xb5a47e;
  const bellyDark = 0x8f7f5e;
  const cyan = 0x3fe0d0;
  const spike = 0x1b2c3a;
  const spikeTip = 0x4a8a98;
  const horn = 0x857b68;
  const hornTip = 0xcfc4a6;
  const claw = 0xd8ccb0;
  const hash = (x: number, y: number, z: number) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
  const scale = (x: number, y: number, z: number) => ((x + 2 * y + 3 * z) % 6 === 0 ? scaleLit : scales[hash(x, y, z) % scales.length]!);
  /** Kahon na may kaliskis. */
  const scaleBox = (t: Vox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) t.set(x, y, z, scale(x, y, z));
  };
  /** Kulay ng katawan: likod (n = palabas), kaliskis sa gilid, krema sa tiyan. */
  const skin = (cy: number, cz: number, r: number, ny: number, nz: number) => (x: number, y: number, z: number) => {
    const d = (y - cy) * ny + (z - cz) * nz;
    if (d < -0.4 * r) return (y + z) % 3 === 0 ? bellyDark : belly;
    if (d > 0.8 * r && Math.abs(x) <= 1) return dorsal;
    return scale(x, y, z);
  };
  /**
   * Kurba sa y-z (x=0): bawat punto ay may posisyon, radius at palabas na normal (likod).
   * `bend` = 1 kung pasulong (+z) ang kurba, -1 kung paatras.
   */
  const path = (pts: readonly (readonly [number, number])[], radii: readonly number[], count: number, bend: number) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([y, z]) => new THREE.Vector3(0, y, z)));
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const k = t * (radii.length - 1);
      const j = Math.min(radii.length - 2, Math.floor(k));
      const r = radii[j]! + (radii[j + 1]! - radii[j]!) * (k - j);
      return { y: p.y, z: p.z, r, ny: bend * tan.z, nz: -tan.y };
    });
  };
  // ---- katawan at leeg: mula balakang → dibdib → pakurbang leeg → ulo ----
  const spine = path([[11, -14], [11.5, -8], [12, -2], [12.5, 3], [15, 7], [19, 9], [22.5, 11]], [4.2, 4.6, 5, 4.6, 3.6, 3.2, 3], 40, 1);
  for (const s of spine) v.ellipsoid(0, s.y, s.z, s.r * 0.9, s.r, s.r, skin(s.y, s.z, s.r, s.ny, s.nz));
  // kumikinang na cyan na chevron sa dibdib at leeg
  for (let y = 8; y <= 21; y++) for (let x = -3; x <= 3; x++) {
    if ((Math.abs(x) + y) % 4 !== 0) continue;
    for (let z = 20; z >= 0; z--) if (v.has(x, y, z)) { v.set(x, y, z, cyan, true); break; }
  }
  // ---- ulo ----
  v.ellipsoid(0, 24.5, 12.5, 3.2, 2.8, 3.5, scale);
  for (let z = 15; z <= 20; z++) {
    const w = z <= 17 ? 2 : 1;
    scaleBox(v, -w, 23, z, w, z <= 18 ? 25 : 24, z); // itaas na panga / nguso
    v.box(-w, 21, z - 1, w, 21, z - 1, z % 2 ? bellyDark : belly); // ibabang panga (bukas)
  }
  v.box(-1, 22, 14, 1, 22, 17, 0xff4a10, true); // apoy sa bibig
  for (const z of [16, 18]) v.boxSym(2, 22, z, 2, 22, z, C.white).boxSym(1, 22, z + 1, 1, 22, z + 1, C.white); // ngipin
  v.boxSym(1, 25, 20, 1, 25, 20, C.black); // butas ng ilong
  v.box(-3, 26, 14, 3, 26, 15, dorsal); // kilay
  v.boxSym(2, 25, 15, 2, 25, 15, 0xffc040, true); // mata
  // dalawang pares ng sungay (pabalik) at palikpik sa pisngi
  for (const s of [-1, 1]) {
    v.line([[s * 2, 26, 12], [s * 3, 29, 10], [s * 3, 31, 7]], horn);
    v.line([[s * 3, 31, 7], [s * 2, 32, 5]], hornTip);
    v.line([[s * 3, 25, 11], [s * 5, 26, 9], [s * 6, 27, 7]], horn);
    v.set(s * 6, 28, 6, hornTip);
    v.line([[s * 3, 23, 11], [s * 5, 22, 9], [s * 6, 21, 7]], spike);
    v.line([[s * 3, 24, 10], [s * 5, 24, 8], [s * 7, 24, 6]], spikeTip);
  }
  // tinik sa likod: mula batok hanggang balakang (nakahilig pabalik)
  for (let i = 0; i < spine.length; i += 3) {
    const s = spine[i]!;
    const top = [s.y + s.ny * s.r, s.z + s.nz * s.r] as const;
    const h = i > 28 ? 3 : 2;
    for (let k = 1; k <= h; k++) v.set(0, top[0] + s.ny * k + 0.3 * k * s.nz, top[1] + s.nz * k - 0.3 * k * s.ny, k === h ? spikeTip : spike);
  }
  m.part('body', v);
  // ---- apat na paa: pahilis na lakad (harap-kaliwa kasabay ng likod-kanan) ----
  const front = new Vox();
  front.ellipsoid(1, -1, 0, 2.2, 2.6, 2.5, scale); // balikat
  scaleBox(front, 1, -8, 0, 2, -3, 1);
  front.ellipsoid(1.5, -8.5, 1, 1.5, 1.3, 1.5, scale); // pulso
  const hind = new Vox();
  hind.ellipsoid(1, -1, -0.5, 2.6, 3, 3, scale); // hita
  scaleBox(hind, 1, -5, -2, 2, -3, -1); // tuhod
  scaleBox(hind, 1, -9, -1, 2, -5, 0);
  for (const leg of [front, hind]) {
    scaleBox(leg, 0, -11, -1, 3, -10, 3); // paa
    for (const x of [0, 2, 3]) leg.set(x, -11, 4, claw); // kuko
    leg.set(1, -11, -2, claw);
  }
  for (const side of [-1, 1]) {
    m.limb('legF', front, 'leg', side * 4, 11, 3, side).scale.x = side;
    m.limb('legH', hind, 'leg', side * 4, 11, -12, -side).scale.x = side;
  }
  // ---- buntot: mga segment na pakulot pataas, palumpong na palikpik sa dulo ----
  const tail = path([[11, -15], [10, -20], [10, -25], [11, -29], [13, -33], [16, -36], [20, -37.5], [23.5, -36.5]], [3.9, 3.4, 3, 2.6, 2.3, 2, 1.8, 1.6], 13, -1);
  tail.forEach((s, i) => {
    const seg = new Vox();
    seg.ellipsoid(0, 0, 0, s.r * 0.9, s.r, s.r, skin(0, 0, s.r, s.ny, s.nz));
    for (let k = 1; k <= 2; k++) seg.set(0, s.ny * (s.r + k) + 0.3 * k * s.nz, s.nz * (s.r + k) - 0.3 * k * s.ny, k === 2 ? spikeTip : spike);
    if (i === tail.length - 1) {
      for (let a = -2; a <= 2; a++) {
        const ang = Math.atan2(-s.nz, -s.ny) + a * 0.45; // pabukas na palumpong, sunod sa buntot
        const y = Math.sin(ang) * 6;
        const z = Math.cos(ang) * 6;
        seg.line([[0, 0, 0], [0, y * 0.5 - 0.5, z * 0.5], [0, y, z]], a % 2 ? spikeTip : spike);
      }
    }
    const p = m.pivot(0, s.y, s.z);
    p.userData.sway = 0.15 + (0.85 * i) / (tail.length - 1);
    m.part(`tail${i}`, seg, p);
    m.segments.push(p);
  });
  return m.done();
}
