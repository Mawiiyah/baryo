import * as THREE from 'three';
import { LANE, SCENE3D as S } from '../config';
import { randFloat } from '../sim/rand';
import { palm, torchFlame, voxGroup, type Torch } from './scenery';
import { Vox } from './voxel';

// Battlefield na "templo" (batay sa assets/reference/battlefield.png): isla na napapalibutan
// ng tubig, daang bato na may dilaw na guhit at korona sa gitna, mga sulong bato, asul
// (bayani) at pulang (halimaw) bandila, mga pahingahang kahoy, at sinaunang templo sa
// dulo kung saan lumalabas ang halimaw. Ang mga numero dito ay hugis/proporsyon ng
// dekorasyon (parang sprite data); ang layout at kulay ay nasa SCENE3D.templo.
// Mga axis: +x = kaliwa ng screen (bayani), z = pos (layo mula sa kubo).

const T = S.templo;
const HALF = LANE.halfWidth + 0.5; // kalahating lapad ng daang bato
const LANE_START = -4;

const hash = (x: number, y: number, z: number) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
const pick = <C>(arr: readonly C[], x: number, y: number, z: number) => arr[hash(x, y, z) % arr.length]!;

const STONE = [0x7a7e86, 0x868a92, 0x6e727a, 0x8e9098];
const STONE_DARK = 0x50545c;
const MOSS = [0x4a6a34, 0x55783a];
const GOLD = 0xffc23a;
const WOOD = 0x6a4428;
const WOOD_DARK = 0x4a2e1a;
const THATCH = [0x8a5a2e, 0x9a6634, 0x7a4e28];

const stone = (x: number, y: number, z: number) => (y <= 1 && hash(x, y, z) % 4 === 0 ? pick(MOSS, x, y, z) : pick(STONE, x, y, z));

export function buildTemplo(sc: THREE.Scene): { torches: Torch[]; tick: (t: number) => void } {
  const torches: Torch[] = [];
  const outline = islandOutline();

  // ---- tubig, bula sa dalampasigan, buhangin at isla ----
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: T.waterColor, emissive: T.waterGlow, roughness: 0.35 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -T.waterLevel;
  sc.add(water);
  const ring = (scale: number) => outline.map((p) => new THREE.Vector2(p.x * scale, (p.y - -T.island.cz) * scale + -T.island.cz));
  const foam = new THREE.Shape(ring(1.1));
  foam.holes.push(new THREE.Path(ring(1.04)));
  const foamMesh = new THREE.Mesh(new THREE.ShapeGeometry(foam), new THREE.MeshBasicMaterial({ color: T.foamColor, transparent: true, opacity: 0.55 }));
  foamMesh.rotation.x = -Math.PI / 2;
  foamMesh.position.y = -T.waterLevel + 0.03;
  sc.add(foamMesh);
  const sand = new THREE.Mesh(
    new THREE.ExtrudeGeometry(new THREE.Shape(ring(1.04)), { depth: 0.4, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: T.sandColor, roughness: 1, flatShading: true }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -T.waterLevel - 0.3;
  sand.receiveShadow = true;
  sc.add(sand);
  const grassTex = pixelTexture(32, 32, (g) => {
    for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) {
      g.fillStyle = pick(T.grassColors, x, y, 7);
      g.fillRect(x, y, 1, 1);
    }
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(1 / 4, 1 / 4); // 32px kada 4 na metro
  const island = new THREE.Mesh(
    new THREE.ExtrudeGeometry(new THREE.Shape(outline), { depth: T.island.depth, bevelEnabled: false }),
    [
      new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: T.cliffColors[0], roughness: 1, flatShading: true }),
    ],
  );
  island.rotation.x = -Math.PI / 2;
  island.position.y = -T.island.depth;
  island.receiveShadow = true;
  sc.add(island);
  // mga bato sa gilid ng bangin
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), outline.length + 24);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  let ri = 0;
  const addRock = (x: number, y: number, z: number, r: number) => {
    q.setFromEuler(new THREE.Euler(randFloat(0, 3), randFloat(0, 3), randFloat(0, 3)));
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r, r * randFloat(0.7, 1.2), r));
    rocks.setMatrixAt(ri, m4);
    rocks.setColorAt(ri++, col.setHex(T.cliffColors[ri % T.cliffColors.length]!));
  };
  for (const p of outline) addRock(p.x * 1.01, -T.waterLevel + 0.4, -p.y, randFloat(0.9, 1.7));
  for (let i = 0; i < 24; i++) {
    const p = randomGround(outline, HALF + 2.5);
    addRock(p.x, 0, p.z, randFloat(0.3, 0.7));
  }
  rocks.count = ri;
  rocks.castShadow = rocks.receiveShadow = true;
  sc.add(rocks);

  // ---- daang bato ----
  const laneLen = T.gatePos + 2 - LANE_START;
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, laneLen), new THREE.MeshStandardMaterial({ map: laneTexture(laneLen), roughness: 1 }));
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.02, LANE_START + laneLen / 2);
  lane.receiveShadow = true;
  sc.add(lane);
  // gilid na bato (curb), may puwang sa mga sulo
  const curb = new Vox();
  const cu = 0.5;
  const cx = Math.round((HALF + 0.25) / cu);
  for (let z = Math.round(1 / cu); z <= Math.round((T.gatePos - 2.5) / cu); z++) {
    for (const s of [-1, 1]) {
      curb.set(s * cx, 0, z, stone(s * cx, 0, z));
      if (z % 6 === 0) curb.set(s * cx, 1, z, stone(s, 1, z)); // maliliit na haligi
    }
  }
  sc.add(voxGroup(curb, 'templo:curb', cu));

  // ---- mga sulong bato ----
  const brazier = brazierVox();
  for (const z of T.brazierPos) for (const s of [-1, 1]) {
    const g = voxGroup(brazier, 'templo:brazier', 0.2);
    const x = s * (HALF + 1.4);
    g.position.set(x, 0, z);
    sc.add(g);
    torches.push(torchFlame(sc, x, 2.25, z, T.flameColor, 1.6));
  }

  // ---- bandila: asul sa kaliwa (bayani), pula sa kanan (halimaw) ----
  const banners: { pivot: THREE.Object3D; phase: number }[] = [];
  for (const s of [1, -1]) {
    const color = s > 0 ? T.bayaniBanner : T.halimawBanner;
    const x = s * (HALF + 1.4);
    const z = T.bannerPos;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.4, 6), new THREE.MeshStandardMaterial({ color: WOOD_DARK }));
    pole.position.set(x, 2.7, z + 0.15);
    pole.castShadow = true;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({ color: GOLD, emissive: 0x6a4a00 }));
    tip.position.set(x, 5.5, z + 0.15);
    const pivot = new THREE.Group();
    pivot.position.set(x, 5.1, z);
    pivot.add(voxGroup(bannerVox(color), `templo:banner${s}`, 0.2));
    sc.add(pole, tip, pivot);
    banners.push({ pivot, phase: randFloat(0, 6) });
    const base = voxGroup(baseVox(), 'templo:bannerBase', 0.2);
    base.position.set(x, 0, z + 0.15);
    sc.add(base);
  }

  // ---- mga pahingahan (gazebo), nakaharap sa daan ----
  const gz = gazeboVox();
  for (const [ax, z] of T.gazebos) for (const s of [1, -1]) {
    const g = voxGroup(gz, 'templo:gazebo', 0.2);
    g.position.set(s * ax, 0, z);
    g.scale.x = s;
    sc.add(g);
  }

  // ---- templo sa dulo ----
  const gate = voxGroup(gateVox(), 'templo:gate', 0.5);
  gate.position.set(0, 0, T.gatePos);
  sc.add(gate);
  for (const s of [-1, 1]) torches.push(torchFlame(sc, s * 10, 7.4, T.gatePos, T.flameColor, 2));

  // ---- niyog, halaman at damo ----
  for (let i = 0; i < T.palmCount; i++) {
    const side = i % 2 ? 1 : -1;
    const p = randomGround(outline, HALF + 3, side);
    if (blocked(p.x, p.z)) continue;
    sc.add(palm(p.x, p.z, randFloat(4, 7), side, T.trunkColor, T.palmColor));
  }
  const bushGeo = new THREE.IcosahedronGeometry(1, 0);
  bushGeo.translate(0, 0.6, 0);
  const bushes = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), T.bushCount);
  for (let i = 0; i < T.bushCount; i++) {
    // kalahati sa tabi ng daan, kalahati kahit saan sa isla
    const s = i % 2 ? 1 : -1;
    const p = i < T.bushCount / 2 ? { x: s * randFloat(HALF + 0.9, HALF + 2.6), z: randFloat(0, T.gatePos - 3) } : randomGround(outline, HALF + 1, s);
    if (T.brazierPos.some((z) => Math.abs(z - p.z) < 1.2) || Math.abs(p.z - T.bannerPos) < 1) p.x += s * 1.8;
    if (blocked(p.x, p.z)) p.z = -6 - Math.random() * 4; // sa likod ng kubo na lang
    const r = randFloat(0.45, 0.85);
    q.setFromEuler(new THREE.Euler(0, randFloat(0, 3), 0));
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(r * 1.2, r, r * 1.2));
    bushes.setMatrixAt(i, m4);
    bushes.setColorAt(i, col.setHex(T.bushColors[i % T.bushColors.length]!));
  }
  bushes.castShadow = bushes.receiveShadow = true;
  sc.add(bushes);
  const tuftGeo = new THREE.ConeGeometry(0.08, 0.4, 4);
  tuftGeo.translate(0, 0.2, 0);
  const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshStandardMaterial({ color: T.grassColor, roughness: 1 }), T.grassTufts);
  for (let i = 0; i < T.grassTufts; i++) {
    const p = randomGround(outline, HALF + 0.6);
    const r = randFloat(0.6, 1.4);
    q.setFromEuler(new THREE.Euler(randFloat(-0.2, 0.2), randFloat(0, Math.PI), randFloat(-0.2, 0.2)));
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(r, r, r));
    tufts.setMatrixAt(i, m4);
  }
  sc.add(tufts);

  const waterMat = water.material;
  return {
    torches,
    tick: (t) => {
      for (const b of banners) b.pivot.rotation.x = Math.sin(t * 1.7 + b.phase) * T.bannerSway;
      waterMat.emissiveIntensity = 1 + Math.sin(t * 0.8) * 0.25;
    },
  };
}

/** May nakatayong istruktura (gazebo, templo) sa (x, z)? */
function blocked(x: number, z: number) {
  return z > T.gatePos - 4 || T.gazebos.some(([ax, gz]) => Math.abs(Math.abs(x) - ax) < 3.2 && Math.abs(z - gz) < 3.2);
}

/** Hugis ng isla (Vector2: x, -z) para sa Shape/Extrude na iikutin nang -90° sa x. */
function islandOutline() {
  const { rx, rz, cz, roundness } = T.island;
  const e = 2 / roundness;
  const pts: THREE.Vector2[] = [];
  const n = 56;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const bump = 1 + 0.05 * Math.sin(a * 5 + 1) + 0.035 * Math.sin(a * 11 + 2);
    const c = Math.cos(a);
    const s = Math.sin(a);
    pts.push(new THREE.Vector2(Math.sign(c) * Math.abs(c) ** e * rx * bump, -(cz + Math.sign(s) * Math.abs(s) ** e * rz * bump)));
  }
  return pts;
}

/** Random na punto sa isla, labas ng daan (|x| ≥ minX); `side` = ±1 para sa isang gilid lang. */
function randomGround(outline: THREE.Vector2[], minX: number, side = 0) {
  const shape = new THREE.Shape(outline);
  const pts = shape.getPoints();
  for (let tries = 0; tries < 50; tries++) {
    const s = side || (Math.random() < 0.5 ? -1 : 1);
    const x = s * randFloat(minX, T.island.rx);
    const z = randFloat(T.island.cz - T.island.rz, T.island.cz + T.island.rz);
    if (insidePoly(pts, x * 0.92, -(T.island.cz + (z - T.island.cz) * 0.92))) return { x, z };
  }
  return { x: side * minX || minX, z: T.island.cz };
}

function insidePoly(pts: THREE.Vector2[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function pixelTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

/**
 * Texture ng daang bato: mga baldosang hindi magkakapantay, dilaw na guhit sa gilid, dash sa
 * gitna, at bilog na may korona sa `emblemPos`. Ang canvas (col,row) ↔ mundo: x = -HALF + col/ppm,
 * z = LANE_START + row/ppm (kaya ang korona ay "nakatayo" kapag tiningnan mula sa kubo).
 */
function laneTexture(len: number) {
  const ppm = T.lanePxPerM;
  const W = Math.round(HALF * 2 * ppm);
  const H = Math.round(len * ppm);
  return pixelTexture(W, H, (g) => {
    const px = (x: number) => (x + HALF) * ppm;
    const py = (z: number) => (z - LANE_START) * ppm;
    g.fillStyle = T.laneGrout;
    g.fillRect(0, 0, W, H);
    // mga baldosa: hanay na 1m, salit-salit ang simula
    for (let row = 0; row * ppm < H; row++) {
      let x = row % 2 ? -ppm * 0.6 : 0;
      let k = 0;
      while (x < W) {
        const w = Math.round(ppm * (1 + (hash(row, k, 3) % 3) * 0.25));
        g.fillStyle = pick(T.laneStones, row, k, 1);
        g.fillRect(x + 1, row * ppm + 1, w - 1, ppm - 1);
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x + 1, row * ppm + 1, w - 1, 1);
        x += w;
        k++;
      }
    }
    g.fillStyle = T.laneLine;
    // guhit sa gilid
    for (const s of [-1, 1]) g.fillRect(px(s * (HALF - 0.45)) - ppm * 0.1, 0, ppm * 0.2, H);
    // dash sa gitna (hindi sa loob ng korona)
    for (let z = 0; z < len; z += 2.4) {
      const wz = LANE_START + z;
      if (Math.abs(wz - T.emblemPos) < 3.2 || wz > T.gatePos - 2) continue;
      g.fillRect(px(-0.1), py(wz), ppm * 0.2, ppm * 1.2);
    }
    // korona: bilog, pahalang na guhit hanggang gilid, at korona sa loob
    const cxp = px(0);
    const cyp = py(T.emblemPos);
    g.strokeStyle = T.laneLine;
    g.lineWidth = ppm * 0.22;
    g.beginPath();
    g.arc(cxp, cyp, ppm * 2.6, 0, Math.PI * 2);
    g.stroke();
    g.fillRect(0, cyp - ppm * 0.1, cxp - ppm * 2.6, ppm * 0.2);
    g.fillRect(cxp + ppm * 2.6, cyp - ppm * 0.1, W, ppm * 0.2);
    // korona (pataas = +z = pababa sa canvas)
    const u = ppm * 0.35;
    g.fillRect(cxp - 4 * u, cyp - 2.5 * u, 8 * u, 2 * u); // banda
    g.beginPath();
    g.moveTo(cxp - 4 * u, cyp - 0.5 * u);
    g.lineTo(cxp - 4 * u, cyp + 3.5 * u);
    g.lineTo(cxp - 2 * u, cyp + 1 * u);
    g.lineTo(cxp, cyp + 4 * u);
    g.lineTo(cxp + 2 * u, cyp + 1 * u);
    g.lineTo(cxp + 4 * u, cyp + 3.5 * u);
    g.lineTo(cxp + 4 * u, cyp - 0.5 * u);
    g.closePath();
    g.fill();
  });
}

/** Sulong bato: patong-patong na haligi, may mangkok ng baga sa itaas (taas ≈ 2m). */
function brazierVox() {
  const v = new Vox();
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) for (let y = 0; y <= 1; y++) v.set(x, y, z, y === 1 ? STONE_DARK : stone(x, y, z));
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) for (let y = 2; y <= 7; y++) v.set(x, y, z, y === 5 ? STONE_DARK : stone(x, y, z));
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) v.set(x, 8, z, stone(x, 8, z));
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
    const edge = Math.abs(x) === 4 || Math.abs(z) === 4;
    if (edge && Math.abs(x) === 4 && Math.abs(z) === 4) continue;
    if (edge) v.set(x, 9, z, STONE_DARK).set(x, 10, z, stone(x, 10, z));
    else v.set(x, 9, z, (x + z) % 2 ? 0xc8401a : 0xff7a1a); // baga
  }
  return v;
}

/** Tela ng bandila (nakasabit mula sa pivot): may gintong gilid, korona, at hiwa sa ibaba. */
function bannerVox(color: number) {
  const v = new Vox();
  const dark = new THREE.Color(color).multiplyScalar(0.7).getHex();
  v.box(-5, 0, 0, 5, 0, 0, WOOD_DARK); // pahalang na kahoy
  v.boxSym(5, 0, 0, 5, 0, 0, GOLD);
  for (let y = -15; y <= -1; y++) for (let x = -4; x <= 4; x++) {
    if (y < -12 && Math.abs(x) < -12 - y) continue; // V na hiwa sa ibaba
    const border = Math.abs(x) === 4 || y === -1;
    v.set(x, y, 0, border ? GOLD : (x + y) % 5 === 0 ? dark : color);
  }
  // korona
  for (const x of [-2, 0, 2]) v.set(x, -4, -1, GOLD);
  v.box(-2, -7, -1, 2, -5, -1, GOLD);
  v.set(0, -6, -2, 0xff3040, true);
  return v;
}

/** Batong patungan ng poste ng bandila. */
function baseVox() {
  const v = new Vox();
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) for (let y = 0; y <= 2; y++) {
    if (y === 2 && (Math.abs(x) === 2 || Math.abs(z) === 2)) continue;
    v.set(x, y, z, stone(x, y, z));
  }
  return v;
}

/** Pahingahan: batong plataporma, sahig na kahoy, 4 na poste, barandilya, bubong na pawid. Harap = -x. */
function gazeboVox() {
  const v = new Vox();
  for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {
    v.set(x, 0, z, stone(x, 0, z));
    v.set(x, 1, z, Math.abs(x) === 8 || Math.abs(z) === 8 ? STONE_DARK : (z + 8) % 3 === 0 ? WOOD_DARK : WOOD);
  }
  v.box(-10, 0, -3, -9, 0, 3, STONE_DARK); // baitang sa harap
  for (const x of [-7, 7]) for (const z of [-7, 7]) v.box(x, 2, z, x, 10, z, WOOD_DARK);
  // barandilya sa likod at gilid (bukas ang harap)
  for (let i = -6; i <= 6; i++) {
    v.set(7, 5, i, WOOD);
    for (const z of [-7, 7]) v.set(i, 5, z, WOOD);
    if (i % 2 === 0) {
      v.box(7, 2, i, 7, 4, i, WOOD_DARK);
      for (const z of [-7, 7]) v.box(i, 2, z, i, 4, z, WOOD_DARK);
    }
  }
  // bubong: patong-patong na pawid na lumiliit pataas
  for (let i = 0; i <= 9; i++) {
    const r = 10 - i;
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
      const edge = Math.abs(x) === r || Math.abs(z) === r;
      v.set(x, 11 + i, z, i === 0 && edge ? WOOD_DARK : pick(THATCH, x, i, z));
    }
  }
  v.box(0, 21, 0, 0, 22, 0, WOOD_DARK);
  v.set(0, 10, 0, WOOD_DARK); // tali ng parol
  v.set(0, 9, 0, 0xffb040, true); // parol
  return v;
}

/**
 * Sinaunang templo (unit 0.5m, gitna sa x=0, harap = -z): gatehouse na may hagdang arko na
 * kasinlapad ng daan, gintong korona sa itaas, mga tore na may sulo, pader sa gilid, at
 * hagdan sa loob papunta sa madilim na pintuan (dito lumalabas ang halimaw).
 */
function gateVox() {
  const v = new Vox();
  const open = Math.ceil(HALF / 0.5); // kalahating lapad ng daanan (voxels)
  const archTop = (x: number) => (Math.abs(x) <= open - 2 ? 8 : Math.abs(x) === open - 1 ? 7 : 6);
  // gatehouse
  for (let x = -open - 6; x <= open + 6; x++) for (let y = 0; y <= 11; y++) for (let z = -3; z <= 3; z++) {
    if (Math.abs(x) <= open && y <= archTop(x)) continue;
    v.set(x, y, z, y === 9 && z === -3 ? STONE_DARK : stone(x, y, z));
  }
  // haligi sa harap at kapital
  for (const s of [-1, 1]) {
    for (let y = 0; y <= 11; y++) for (const x of [open + 1, open + 2]) v.set(s * x, y, -4, y === 11 ? STONE_DARK : stone(s * x, y, -4));
  }
  // mga ngipin (crenel) sa itaas
  for (let x = -open - 6; x <= open + 6; x++) if ((x + 100) % 3 !== 1) for (let z = -3; z <= 3; z += 6) v.set(x, 12, z, stone(x, 12, z));
  // gintong korona sa itaas ng arko
  v.box(-4, 9, -4, 4, 11, -4, STONE_DARK);
  for (const x of [-2, 0, 2]) v.set(x, 11, -5, GOLD);
  v.box(-2, 9, -5, 2, 10, -5, GOLD);
  v.set(0, 10, -6, 0xff3040, true);
  // mga tore na may sulo sa tuktok
  for (const s of [-1, 1]) {
    const x0 = open + 7;
    for (let x = x0; x <= x0 + 4; x++) for (let z = -4; z <= 4; z++) for (let y = 0; y <= 13; y++) v.set(s * x, y, z, stone(s * x, y, z));
    for (let x = x0 - 1; x <= x0 + 5; x++) for (let z = -5; z <= 5; z++) {
      const edge = x === x0 - 1 || x === x0 + 5 || Math.abs(z) === 5;
      if (edge) v.set(s * x, 14, z, STONE_DARK);
    }
    // pader sa gilid
    for (let x = x0 + 5; x <= x0 + 12; x++) for (let z = -1; z <= 1; z++) for (let y = 0; y <= 6; y++) v.set(s * x, y, z, stone(s * x, y, z));
    for (let x = x0 + 5; x <= x0 + 12; x++) if (x % 3 === 0) v.set(s * x, 7, -1, stone(s * x, 7, -1)).set(s * x, 7, 1, stone(s * x, 7, 1));
  }
  // sahig sa loob, hagdan paakyat, at madilim na pintuan sa likod
  for (let x = -open; x <= open; x++) for (let z = 6; z <= 14; z++) {
    const h = z - 6;
    for (let y = 0; y <= h; y++) v.set(x, y, z, y === h ? pick(STONE, x, y, z) : STONE_DARK);
  }
  for (let x = -open - 4; x <= open + 4; x++) for (let y = 0; y <= 18; y++) for (let z = 15; z <= 16; z++) {
    const door = Math.abs(x) <= 4 && y >= 9 && y <= 14;
    v.set(x, y, z, door ? (z === 15 ? 0x1a0a2a : STONE_DARK) : stone(x, y, z));
  }
  for (let x = -open - 4; x <= open + 4; x++) if ((x + 100) % 3 !== 1) v.set(x, 19, 15, stone(x, 19, 15));
  for (let x = -4; x <= 4; x++) v.set(x, 15, 14, x % 2 ? GOLD : STONE_DARK);
  return v;
}
