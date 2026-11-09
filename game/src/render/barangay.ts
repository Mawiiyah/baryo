import * as THREE from 'three';
import { LANE, SCENE3D as S } from '../config';
import { randFloat } from '../sim/rand';
import { buildKubo } from './models';
import { glowTexture, palm, torchFlame, voxGroup, type Torch } from './scenery';
import { Vox } from './voxel';

// Battlefield na "Barangay" (batay sa reference screenshot):
// Asphalt kalsada na may "BARANGAY" stencil at basketball court sa gitna,
// Barangay Hall gate sa dulo (kung saan lumalabas ang halimaw) na may watawat ng Pilipinas,
// Jeepney bilang base sa harap ng camera na may headlight beams na sumisikat sa daan,
// mga Sari-Sari store, Bahay Kubo, mga plastik na monobloc chairs (asul/pula),
// nakaparadang traysikel, asong kalye (aspin), mga sulong bato, banderitas (fiesta bunting),
// at mga kumikislap na mata ng halimaw sa madilim na paligid.

const B = S.barangay;
const HALF = LANE.halfWidth + 0.5;
const LANE_START = -4;

const hash = (x: number, y: number, z: number) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
const pick = <C>(arr: readonly C[], x: number, y: number, z: number) => arr[hash(x, y, z) % arr.length]!;

export function buildBarangay(sc: THREE.Scene): {
  base: THREE.Object3D;
  torches: Torch[];
  tick: (t: number) => void;
} {
  const torches: Torch[] = [];
  const animatedBanners: { pivot: THREE.Object3D; phase: number }[] = [];
  const banderitasMeshes: { mesh: THREE.Mesh; phase: number }[] = [];
  let flagPivot: THREE.Object3D | null = null;
  const eyesList: { mesh: THREE.Object3D; nextBlink: number; blinkEnd: number }[] = [];

  // ---- 1. Lupa at Kapaligiran ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: B.groundColor, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 16);
  ground.receiveShadow = true;
  sc.add(ground);

  // ---- 2. Asphalt Kalsada ----
  const laneLen = B.gatePos + 2 - LANE_START;
  const roadTex = createRoadTexture(laneLen);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2, laneLen),
    new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, LANE_START + laneLen / 2);
  road.receiveShadow = true;
  sc.add(road);

  // Mga puting gutter/curb sa gilid ng kalsada
  const curb = new Vox();
  const cu = 0.4;
  const cx = Math.round((HALF + 0.15) / cu);
  for (let z = Math.round(LANE_START / cu); z <= Math.round((B.gatePos - 1) / cu); z++) {
    for (const s of [-1, 1]) {
      const isStripe = (Math.abs(z) % 8) < 4;
      curb.set(s * cx, 0, z, isStripe ? B.curbColor : B.curbStripeColor);
    }
  }
  sc.add(voxGroup(curb, 'barangay:curb', cu));

  // ---- 3. Base Jeepney (sa z = 0, nakaharap sa kalsada) ----
  const baseJeepneyGroup = new THREE.Group();
  const baseJeepMesh = voxGroup(jeepneyVox(0x1a5298, 0xefc436), 'barangay:baseJeep', 0.14);
  baseJeepneyGroup.add(baseJeepMesh);
  baseJeepneyGroup.position.set(0, 0, S.kuboPos);
  sc.add(baseJeepneyGroup);

  // Headlight beams sa kalsada (mula sa base jeepney)
  const headlightBeamMat = new THREE.MeshBasicMaterial({
    map: glowTexture(),
    color: B.headlightColor,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (const s of [-1, 1]) {
    // 3D spotlight para sa dynamic lighting
    const spot = new THREE.SpotLight(B.headlightColor, 4.5, 24, Math.PI / 6, 0.45, 1.2);
    spot.position.set(s * 0.9, 0.85, 2.2);
    spot.target.position.set(s * 1.6, 0, 14);
    sc.add(spot, spot.target);

    // Maliwanag na fan/beam overlay sa mismong asphalt
    const beamGeo = new THREE.PlaneGeometry(3.2, 14);
    beamGeo.translate(0, 7, 0);
    const beamMesh = new THREE.Mesh(beamGeo, headlightBeamMat);
    beamMesh.rotation.x = -Math.PI / 2;
    beamMesh.rotation.z = s * -0.09;
    beamMesh.position.set(s * 1.1, 0.03, 1.8);
    sc.add(beamMesh);
  }

  // ---- 4. Barangay Hall Gate (sa dulo, kung saan lumalabas ang halimaw) ----
  const gateGroup = new THREE.Group();
  gateGroup.position.set(0, 0, B.gatePos);
  const gateMesh = voxGroup(barangayGateVox(), 'barangay:gate', 0.3);
  gateGroup.add(gateMesh);

  // Watawat ng Pilipinas sa ibabaw ng Barangay Hall
  const flagGroup = new THREE.Group();
  flagGroup.position.set(0, 8.4, 0);
  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 3.6, 6),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 }),
  );
  flagPole.position.y = 1.8;
  const flagMesh = createPhilippineFlag();
  flagMesh.position.set(1.4, 2.6, 0);
  flagGroup.add(flagPole, flagMesh);
  flagPivot = flagMesh;
  gateGroup.add(flagGroup);

  // Sulong apoy sa dalawang tore ng Barangay Hall
  for (const s of [-1, 1]) {
    torches.push(torchFlame(sc, s * 8.4, 7.8, B.gatePos, B.flameColor, 2));
  }

  // Banners: Bayani (kaliwa) at Halimaw (kanan) sa pader ng gate
  for (const s of [1, -1]) {
    const bannerColor = s > 0 ? B.bayaniBanner : B.halimawBanner;
    const bPivot = new THREE.Group();
    bPivot.position.set(s * 5.4, 6.2, B.gatePos - 1.2);
    const bMesh = voxGroup(bannerVox(bannerColor), `barangay:banner:${s}`, 0.18);
    bPivot.add(bMesh);
    sc.add(bPivot);
    animatedBanners.push({ pivot: bPivot, phase: randFloat(0, 6) });
  }
  sc.add(gateGroup);

  // ---- 5. Nakaparadang Jeepney sa may gate (kaliwa) ----
  const gateJeep = voxGroup(jeepneyVox(0x2462a6, 0xe74c3c), 'barangay:gateJeep', 0.14);
  gateJeep.position.set(-5.6, 0, B.gatePos - 3.8);
  gateJeep.rotation.y = -0.25; // bahagyang nakatagilid papunta sa kalsada
  sc.add(gateJeep);

  // Headlight ng nakaparadang jeepney
  const gateJeepSpot = new THREE.SpotLight(B.headlightColor, 3.2, 16, Math.PI / 6, 0.4, 1.2);
  gateJeepSpot.position.set(-5.6, 0.85, B.gatePos - 2.4);
  gateJeepSpot.target.position.set(-4.2, 0, B.gatePos - 12);
  sc.add(gateJeepSpot, gateJeepSpot.target);

  // ---- 6. Nakaparadang Traysikel sa tabi ng kalsada (kanan) ----
  const trike = voxGroup(tricycleVox(), 'barangay:trike', 0.12);
  trike.position.set(HALF + 1.8, 0, 16);
  trike.rotation.y = 0.32;
  sc.add(trike);

  // ---- 7. Sari-Sari Stores ----
  // Tindahan sa kaliwa
  const leftStore = voxGroup(sariSariStoreVox(), 'barangay:storeLeft', 0.18);
  leftStore.position.set(-(HALF + 3.4), 0, 11);
  leftStore.rotation.y = Math.PI / 2;
  sc.add(leftStore);
  const leftStoreLight = new THREE.PointLight(0xffbe44, 1.5, 7);
  leftStoreLight.position.set(-(HALF + 2.4), 2.2, 11);
  sc.add(leftStoreLight);

  // Tindahan sa kanan
  const rightStore = voxGroup(sariSariStoreVox(), 'barangay:storeRight', 0.18);
  rightStore.position.set(HALF + 3.4, 0, 7.5);
  rightStore.rotation.y = -Math.PI / 2;
  sc.add(rightStore);
  const rightStoreLight = new THREE.PointLight(0xffbe44, 1.5, 7);
  rightStoreLight.position.set(HALF + 2.4, 2.2, 7.5);
  sc.add(rightStoreLight);

  // ---- 8. Bahay Kubo sa mga gilid ----
  const huts = [
    { x: -(HALF + 4.2), z: 3.5, r: 0.4 },
    { x: -(HALF + 5.5), z: 20.5, r: -0.3 },
    { x: HALF + 4.6, z: 22.5, r: -0.5 },
  ];
  for (const h of huts) {
    const hut = buildKubo();
    hut.scale.setScalar(0.75);
    hut.position.set(h.x, 0, h.z);
    hut.rotation.y = h.r + (h.x < 0 ? Math.PI / 2 : -Math.PI / 2);
    const hl = new THREE.PointLight(B.windowColor, 1.2, 8);
    hl.position.set(h.x, 2.2, h.z);
    sc.add(hut, hl);
  }

  // ---- 9. Mga Monobloc Chairs at Bangko ----
  const blueChair = monoblocChairVox(0x186ec8);
  const redChair = monoblocChairVox(0xd62828);
  const chairPlacements = [
    { x: -(HALF + 1.2), z: 12.2, r: 0.4, red: false },
    { x: -(HALF + 1.6), z: 13.1, r: -0.2, red: true },
    { x: -(HALF + 1.1), z: 9.8, r: 0.1, red: false },
    { x: HALF + 1.2, z: 8.8, r: -0.5, red: true },
    { x: HALF + 1.5, z: 6.5, r: 0.2, red: false },
    { x: HALF + 1.2, z: 18.2, r: 0.6, red: false },
  ];
  for (const cp of chairPlacements) {
    const ch = voxGroup(cp.red ? redChair : blueChair, `barangay:chair:${cp.red ? 'r' : 'b'}`, 0.08);
    ch.position.set(cp.x, 0, cp.z);
    ch.rotation.y = cp.r;
    sc.add(ch);
  }

  // ---- 10. Asong Kalye (Aspin) ----
  const aspin = voxGroup(aspinVox(), 'barangay:aspin', 0.08);
  aspin.position.set(-(HALF + 0.8), 0, 14);
  aspin.rotation.y = 0.6;
  sc.add(aspin);

  const aspin2 = voxGroup(aspinVox(), 'barangay:aspin2', 0.08);
  aspin2.position.set(HALF + 0.9, 0, 18.5);
  aspin2.rotation.y = -2.1;
  sc.add(aspin2);

  // ---- 11. Sulong Bato sa mga Pedestal (Fire Braziers) ----
  const pedestal = brazierPedestalVox();
  for (const z of B.brazierPos) {
    for (const s of [-1, 1]) {
      const g = voxGroup(pedestal, 'barangay:pedestal', 0.18);
      const x = s * (HALF + 1.2);
      g.position.set(x, 0, z);
      sc.add(g);
      torches.push(torchFlame(sc, x, 2.2, z, B.flameColor, 1.5));
    }
  }

  // ---- 12. Banderitas (Fiesta Bunting) ----
  const banderitasColors = [0xf1c40f, 0xe74c3c, 0x00b4d8, 0x2ecc71, 0xff7700];
  for (const s of [-1, 1]) {
    const x = s * (HALF + 0.6);
    for (let z = 2; z <= 26; z += 1.4) {
      const bColor = pick(banderitasColors, z, s, 5);
      const flagGeo = new THREE.BufferGeometry();
      // Tatsulok na banderita
      const vertices = new Float32Array([0, 0, 0, 0, -0.4, 0.25, 0, 0, 0.5]);
      flagGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      flagGeo.computeVertexNormals();
      const bMat = new THREE.MeshBasicMaterial({ color: bColor, side: THREE.DoubleSide });
      const bMesh = new THREE.Mesh(flagGeo, bMat);
      bMesh.position.set(x, 3.8, z);
      sc.add(bMesh);
      banderitasMeshes.push({ mesh: bMesh, phase: z * 0.4 + s });
    }
  }

  // ---- 13. Niyog at Halaman sa Paligid ----
  for (let i = 0; i < B.palmCount; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * randFloat(HALF + 4.5, 20);
    const z = randFloat(-2, 32);
    // Iwasan kung may tindahan o bahay
    if (Math.abs(z - 11) < 2.5 && Math.abs(x) < HALF + 5) continue;
    sc.add(palm(x, z, randFloat(4.5, 7.5), side, B.trunkColor, B.palmColor));
  }

  // Damo at palumpong
  const tuftGeo = new THREE.ConeGeometry(0.08, 0.4, 4);
  tuftGeo.translate(0, 0.2, 0);
  const tufts = new THREE.InstancedMesh(
    tuftGeo,
    new THREE.MeshStandardMaterial({ color: B.grassColor, roughness: 1 }),
    B.grassTufts,
  );
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < B.grassTufts; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * randFloat(HALF + 0.8, 22);
    const z = randFloat(-4, 34);
    const sc2 = randFloat(0.6, 1.4);
    q.setFromEuler(new THREE.Euler(randFloat(-0.15, 0.15), randFloat(0, Math.PI), randFloat(-0.15, 0.15)));
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(sc2, sc2, sc2));
    tufts.setMatrixAt(i, m4);
  }
  tufts.receiveShadow = true;
  sc.add(tufts);

  // ---- 14. Nakatagong mga Mata ng Halimaw sa Dilim ----
  const eyeColors = [0xff2222, 0xffd000, 0xc022ff];
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const eyePair = new THREE.Group();
    const eColor = pick(eyeColors, i, 3, 9);
    const eyeMat = new THREE.MeshBasicMaterial({ color: eColor });
    const e1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.05), eyeMat);
    const e2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.05), eyeMat);
    e1.position.x = -0.1;
    e2.position.x = 0.1;
    eyePair.add(e1, e2);
    const ex = side * randFloat(HALF + 6, 22);
    const ez = randFloat(2, 30);
    const ey = randFloat(0.4, 1.8);
    eyePair.position.set(ex, ey, ez);
    eyePair.rotation.y = side > 0 ? -Math.PI / 2 + 0.3 : Math.PI / 2 - 0.3;
    sc.add(eyePair);
    eyesList.push({ mesh: eyePair, nextBlink: randFloat(2, 8), blinkEnd: 0 });
  }

  return {
    base: baseJeepneyGroup,
    torches,
    tick: (t: number) => {
      // Bandila at banners na umiindayog
      for (const b of animatedBanners) {
        b.pivot.rotation.x = Math.sin(t * 1.8 + b.phase) * B.bannerSway;
      }
      if (flagPivot) {
        flagPivot.rotation.y = Math.sin(t * 3.2) * 0.22;
        flagPivot.rotation.z = Math.sin(t * 2.5) * 0.08;
      }
      // Banderitas na umiihip sa hangin
      for (const bd of banderitasMeshes) {
        bd.mesh.rotation.x = Math.sin(t * 3.5 + bd.phase) * 0.25;
      }
      // Pikit-dilat ng mga mata ng halimaw sa dilim
      for (const eye of eyesList) {
        if (t > eye.nextBlink) {
          eye.mesh.scale.y = 0.05; // nakapikit
          eye.blinkEnd = t + 0.18;
          eye.nextBlink = t + randFloat(3, 10);
        } else if (t > eye.blinkEnd && eye.mesh.scale.y < 1) {
          eye.mesh.scale.y = 1;
        }
      }
    },
  };
}

// =========================================================================
// MGA TEXTURE AT VOXEL MODELS
// =========================================================================

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
 * Texture ng kalsada:
 * - Madilim na asphalt na may kaunting grit at bitak
 * - Puting guhit/curb sa mga gilid
 * - Dilaw na putol-putol na centerline
 * - "BARANGAY" stencil text sa may z = 8.5
 * - Basketball court center circle na may ipinintang basketball sa gitna (z = 16.5)
 */
function createRoadTexture(len: number) {
  const ppm = B.roadPxPerM;
  const W = Math.round(HALF * 2 * ppm);
  const H = Math.round(len * ppm);

  return pixelTexture(W, H, (g) => {
    const px = (x: number) => (x + HALF) * ppm;
    const py = (z: number) => (z - LANE_START) * ppm;

    // 1. Base Asphalt
    g.fillStyle = B.roadColor;
    g.fillRect(0, 0, W, H);

    // Asphalt grit/noise
    for (let y = 0; y < H; y += 4) {
      for (let x = 0; x < W; x += 4) {
        if (hash(x, y, 17) % 5 === 0) {
          g.fillStyle = B.roadGrout;
          g.fillRect(x, y, 2, 2);
        } else if (hash(x, y, 31) % 7 === 0) {
          g.fillStyle = '#3a3b46';
          g.fillRect(x, y, 2, 2);
        }
      }
    }

    // 2. Puting gilid / curbs
    g.fillStyle = '#dedcd2';
    for (const s of [-1, 1]) {
      g.fillRect(px(s * (HALF - 0.35)) - ppm * 0.15, 0, ppm * 0.3, H);
    }

    // 3. "BARANGAY" Text Stencil (bandang z = 8.5)
    const textY = py(B.textPos);
    g.save();
    g.font = `bold ${Math.round(ppm * 1.5)}px Silkscreen, monospace, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(235, 233, 225, 0.9)';
    g.fillText('BARANGAY', W / 2, textY);
    g.restore();

    // 4. Basketball Court Center Circle at Bola (sa z = 16.5)
    const courtY = py(B.courtPos);
    const courtX = W / 2;
    const courtR = 2.4 * ppm;

    // Puting bilog ng court
    g.strokeStyle = '#dedcd4';
    g.lineWidth = 0.22 * ppm;
    g.beginPath();
    g.arc(courtX, courtY, courtR, 0, Math.PI * 2);
    g.stroke();

    // Bola ng basketball sa gitna ng court
    const ballR = 1.65 * ppm;
    g.fillStyle = '#b85a24'; // kulay kahel ng balat ng bola
    g.beginPath();
    g.arc(courtX, courtY, ballR, 0, Math.PI * 2);
    g.fill();

    // Dilim/anino sa ibabang bahagi ng bola
    g.fillStyle = 'rgba(0, 0, 0, 0.18)';
    g.beginPath();
    g.arc(courtX, courtY, ballR, Math.PI * 0.2, Math.PI * 0.9);
    g.lineTo(courtX, courtY);
    g.fill();

    // Mga itim na guhit/seam ng basketball
    g.strokeStyle = '#222226';
    g.lineWidth = 0.12 * ppm;

    // Outer rim ng bola
    g.beginPath();
    g.arc(courtX, courtY, ballR, 0, Math.PI * 2);
    g.stroke();

    // Gitnang guhit (pahalang at patayo)
    g.beginPath();
    g.moveTo(courtX - ballR, courtY);
    g.lineTo(courtX + ballR, courtY);
    g.moveTo(courtX, courtY - ballR);
    g.lineTo(courtX, courtY + ballR);
    g.stroke();

    // Kurbang guhit sa magkabilang gilid
    g.beginPath();
    g.arc(courtX - ballR * 0.65, courtY, ballR * 0.95, -Math.PI * 0.35, Math.PI * 0.35);
    g.stroke();
    g.beginPath();
    g.arc(courtX + ballR * 0.65, courtY, ballR * 0.95, Math.PI * 0.65, Math.PI * 1.35);
    g.stroke();

    // 5. Dilaw na Dashed Centerline
    // (Hindi idinodrawing sa loob ng text at ng basketball court)
    g.fillStyle = B.lineColor;
    for (let z = 0; z < len; z += 2.4) {
      const wz = LANE_START + z;
      if (Math.abs(wz - B.courtPos) < 2.8) continue;
      if (Math.abs(wz - B.textPos) < 2.0) continue;
      g.fillRect(px(0) - ppm * 0.1, py(wz), ppm * 0.2, ppm * 1.3);
    }
  });
}

/** Philippine Flag Mesh (fluttering in wind) */
function createPhilippineFlag() {
  const c = document.createElement('canvas');
  c.width = 120;
  c.height = 60;
  const g = c.getContext('2d')!;

  // Royal Blue sa itaas
  g.fillStyle = '#0038a8';
  g.fillRect(0, 0, 120, 30);
  // Scarlet Red sa ibaba
  g.fillStyle = '#ce1126';
  g.fillRect(0, 30, 120, 30);
  // Puting tatsulok sa kaliwa
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(52, 30);
  g.lineTo(0, 60);
  g.closePath();
  g.fill();
  // Gintong araw sa gitna ng tatsulok
  g.fillStyle = '#fcd116';
  g.beginPath();
  g.arc(18, 30, 7, 0, Math.PI * 2);
  g.fill();
  // 3 Bituin sa mga kanto
  const stars: [number, number][] = [
    [7, 10],
    [7, 50],
    [40, 30],
  ];
  for (const [sx, sy] of stars) {
    if (sx === undefined || sy === undefined) continue;
    g.beginPath();
    g.arc(sx, sy, 2.5, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  const flagGeo = new THREE.PlaneGeometry(2.6, 1.3);
  return new THREE.Mesh(flagGeo, mat);
}

/** Voxel model ng Philippine Jeepney (detalyado: gulong, chrome grille, windshield, pasahero, bubong) */
export function jeepneyVox(bodyColor = 0x1a5298, stripeColor = 0xefc436) {
  const v = new Vox();
  const CHROME = 0xd4d4dc;
  const TIRE = 0x18181c;
  const GLASS = 0x4e7090;
  const SEAT = 0x6e3816;
  const FLOOR = 0x36373e;
  const ROOF = 0xe0e0e8;

  // 1. Gulong (4 na piraso)
  for (const s of [-1, 1]) {
    // Harap
    v.box(s * 7, 0, 8, s * 8, 3, 11, TIRE);
    v.set(s * 8, 1, 9, CHROME);
    v.set(s * 8, 2, 10, CHROME);
    // Likod
    v.box(s * 7, 0, -11, s * 8, 3, -8, TIRE);
    v.set(s * 8, 1, -10, CHROME);
    v.set(s * 8, 2, -9, CHROME);
  }

  // 2. Chassis at Sahig
  v.box(-6, 2, -14, 6, 3, 14, FLOOR);

  // 3. Bumpers
  // Harapang chrome bumper
  v.box(-7, 2, 15, 7, 3, 16, CHROME);
  // Likurang bumper at apakan
  v.box(-7, 1, -16, 7, 2, -15, 0x6e7078);
  v.box(-3, 1, -17, 3, 2, -16, 0x8e909a); // gitnang apakan sa likod

  // 4. Harap ng Jeepney (Engine Hood, Grille, Headlights)
  v.box(-5, 4, 6, 5, 7, 14, bodyColor);
  // Chrome grille sa harap
  v.box(-4, 3, 15, 4, 6, 15, CHROME);
  // Chrome hood ornament sa ibabaw ng makina
  v.box(-1, 8, 10, 1, 8, 14, 0xf1c40f);
  // Mga bilog na headlight
  v.set(-5, 5, 15, 0xfff9b8, true);
  v.set(5, 5, 15, 0xfff9b8, true);
  // Signal lights
  v.set(-6, 4, 15, 0xe67e22, true);
  v.set(6, 4, 15, 0xe67e22, true);

  // 5. Salamin (Windshield)
  v.box(-5, 8, 5, 5, 11, 5, GLASS);
  v.box(-6, 8, 5, -6, 11, 5, bodyColor);
  v.box(6, 8, 5, 6, 11, 5, bodyColor);
  // Sun visor
  v.box(-6, 12, 5, 6, 12, 7, stripeColor);

  // 6. Katawan ng Jeepney (gilid at mga guhit)
  for (const s of [-1, 1]) {
    // Pang-ibabang pader
    v.box(s * 6, 4, -14, s * 6, 7, 5, bodyColor);
    // Kulay na linya/stripe
    v.box(s * 6, 5, -13, s * 6, 5, 5, stripeColor);
    // Mga poste ng bintana (bukas ang bintana tulad ng tunay na jeep)
    for (const z of [3, -2, -7, -13]) {
      v.box(s * 6, 8, z, s * 6, 11, z, bodyColor);
    }
  }

  // 7. Loob ng Jeepney (mga upuang kahoy/leather)
  v.box(-5, 4, -12, -4, 5, 4, SEAT);
  v.box(4, 4, -12, 5, 5, 4, SEAT);
  // Ilaw sa loob ng kisame
  v.set(0, 12, -4, 0xffe28a, true);

  // 8. Likuran (Entryway kung saan sumasakay, kita mula sa camera)
  // Bukas ang gitna para kita ang loob
  v.box(-6, 4, -15, -3, 11, -15, bodyColor);
  v.box(3, 4, -15, 6, 11, -15, bodyColor);
  // Pulang tail lights
  v.set(-5, 4, -15, 0xe74c3c, true);
  v.set(5, 4, -15, 0xe74c3c, true);
  // Hawakan sa likod
  v.box(-2, 4, -16, -2, 11, -16, CHROME);
  v.box(2, 4, -16, 2, 11, -16, CHROME);

  // 9. Bubong at Luggage Rack
  v.box(-6, 12, -14, 6, 13, 6, ROOF);
  // Bubong ng hood
  v.box(-5, 8, 6, 5, 8, 8, bodyColor);
  // Metal rack sa bubong
  v.box(-5, 14, -12, 5, 14, 4, 0x686a74);

  return v;
}

/** Voxel model ng Barangay Hall Gate Fortress (Stone Arch, Plaque, Towers) */
function barangayGateVox() {
  const v = new Vox();
  const STONE1 = 0x464952;
  const STONE2 = 0x545864;
  const STONE_DARK = 0x34363e;
  const MOSS = 0x3d542e;
  const WOOD = 0x422a18;

  const pickStone = (x: number, y: number, z: number) => {
    const h = hash(x, y, z);
    if (y < 4 && h % 4 === 0) return MOSS;
    return h % 2 === 0 ? STONE1 : STONE2;
  };

  // 1. Dalawang Malaking Tore sa magkabilang gilid
  for (const s of [-1, 1]) {
    const minX = s > 0 ? 12 : -28;
    const maxX = s > 0 ? 28 : -12;
    for (let x = minX; x <= maxX; x++) {
      for (let y = 0; y <= 24; y++) {
        for (let z = -4; z <= 4; z++) {
          v.set(x, y, z, pickStone(x, y, z));
        }
      }
    }
    // Crenellations sa ibabaw ng tore
    for (let x = minX; x <= maxX; x += 3) {
      v.box(x, 25, -4, x + 1, 26, 4, STONE_DARK);
    }
  }

  // 2. Gitnang Pader at Arched Portal
  for (let x = -12; x <= 12; x++) {
    for (let y = 0; y <= 20; y++) {
      for (let z = -3; z <= 3; z++) {
        // Portal archway (bukas kung saan lumalabas ang halimaw)
        const inArch = Math.abs(x) <= 6 && (y <= 11 || (y <= 14 && Math.abs(x) <= 4));
        if (inArch) {
          if (z === 3) v.set(x, y, z, 0x111218); // madilim na pinto sa dulo
          continue;
        }
        v.set(x, y, z, pickStone(x, y, z));
      }
    }
  }

  // Crenellations sa gitnang pader
  for (let x = -11; x <= 11; x += 3) {
    v.box(x, 21, -3, x + 1, 22, 3, STONE_DARK);
  }

  // 3. "BARANGAY HALL" Plaque / Arko sa ibabaw ng pinto
  v.box(-8, 15, -4, 8, 18, -4, WOOD);
  // Gold borders at letra voxels
  v.box(-8, 15, -5, 8, 15, -5, 0xf1c40f);
  v.box(-8, 18, -5, 8, 18, -5, 0xf1c40f);
  v.box(-8, 16, -5, -8, 17, -5, 0xf1c40f);
  v.box(8, 16, -5, 8, 17, -5, 0xf1c40f);
  // Puting letra sa loob ng karatula
  for (let lx = -6; lx <= 6; lx += 2) {
    v.set(lx, 16, -5, 0xffffff);
    v.set(lx, 17, -5, 0xffffff);
  }

  return v;
}

/** Voxel model ng Sari-Sari Store */
function sariSariStoreVox() {
  const v = new Vox();
  const WOOD = 0x5e3a22;
  const COUNTER = 0x7c4c28;
  const TIN_ROOF = 0x6e7682;

  // Sahig at mga haligi
  v.box(-8, 0, -6, 8, 1, 6, WOOD);
  v.box(-8, 1, -6, -7, 12, -5, WOOD);
  v.box(7, 1, -6, 8, 12, -5, WOOD);
  v.box(-8, 1, 5, -7, 12, 6, WOOD);
  v.box(7, 1, 5, 8, 12, 6, WOOD);

  // Likod at mga dingding sa gilid
  v.box(-8, 1, 5, 8, 11, 6, 0x4a2e1a);
  v.box(-8, 1, -5, -7, 11, 5, 0x4a2e1a);
  v.box(7, 1, -5, 8, 11, 5, 0x4a2e1a);

  // Harapang counter
  v.box(-7, 2, -6, 7, 5, -4, COUNTER);

  // Mga paninda / sitsirya / chichirya sa display rack
  const snackColors = [0xf1c40f, 0xe74c3c, 0x2ecc71, 0x9b59b6, 0x3498db, 0xe67e22];
  for (let row = 6; row <= 9; row++) {
    for (let col = -6; col <= 6; col += 2) {
      const c = pick(snackColors, col, row, 11);
      v.set(col, row, -3, c);
      v.set(col, row, -4, c);
    }
  }

  // Nakasabit na mga sachet
  for (let col = -5; col <= 5; col += 2) {
    for (let sy = 9; sy >= 7; sy--) {
      v.set(col, sy, -5, pick(snackColors, col, sy, 7));
    }
  }

  // Sloped yero/tin roof
  for (let z = -7; z <= 7; z++) {
    const y = 13 - Math.floor((z + 7) * 0.25);
    v.box(-9, y, z, 9, y, z, TIN_ROOF);
  }

  return v;
}

/** Voxel model ng classic Pinoy Monobloc Chair */
function monoblocChairVox(color: number) {
  const v = new Vox();
  // 4 na paa
  v.box(-3, 0, -3, -2, 4, -2, color);
  v.box(2, 0, -3, 3, 4, -2, color);
  v.box(-3, 0, 2, -2, 4, 3, color);
  v.box(2, 0, 2, 3, 4, 3, color);
  // Upuan
  v.box(-3, 4, -3, 3, 5, 3, color);
  // Sandalan
  v.box(-3, 5, 2, 3, 10, 3, color);
  return v;
}

/** Voxel model ng Philippine Tricycle (Motorcycle + Passenger Cab) */
function tricycleVox() {
  const v = new Vox();
  const METAL = 0x2462a6; // Asul na sidecar
  const CHROME = 0xd0d0d8;
  const TIRE = 0x18181c;
  const ROOF = 0xdedee4;

  // 1. Motorsiklo (sa kaliwa: x = -4)
  // Gulong
  v.box(-5, 0, 4, -4, 3, 6, TIRE);
  v.box(-5, 0, -5, -4, 3, -3, TIRE);
  // Frame at upuan
  v.box(-5, 3, -4, -4, 5, 4, 0x1c1c20);
  v.box(-5, 5, -2, -4, 5, 2, 0x222226); // seat
  v.box(-5, 6, 2, -4, 7, 3, METAL); // tangke
  // Handlebars at bilog na headlight
  v.box(-6, 7, 3, -3, 8, 3, CHROME);
  v.set(-4, 6, 4, 0xfff8a0, true);

  // 2. Sidecar (sa kanan: x = 0 hanggang 6)
  // Gulong ng sidecar
  v.box(6, 0, -2, 7, 3, 1, TIRE);
  // Sahig at katawan
  v.box(0, 1, -5, 6, 4, 5, METAL);
  // Upuan sa loob ng sidecar
  v.box(1, 2, -3, 5, 4, 0, 0x6e3816);
  // Pader ng sidecar
  v.box(6, 4, -5, 6, 7, 4, METAL);
  v.box(0, 4, -5, 6, 7, -5, METAL);
  // Salamin sa harap ng pasahero
  v.box(1, 6, 4, 5, 9, 4, 0x6e90b0);
  // Bubong ng sidecar
  v.box(0, 10, -5, 6, 11, 4, ROOF);
  // Mga poste ng bubong
  v.box(0, 7, -5, 1, 10, -5, CHROME);
  v.box(5, 7, -5, 6, 10, -5, CHROME);
  v.box(0, 7, 4, 1, 10, 4, CHROME);
  v.box(5, 7, 4, 6, 10, 4, CHROME);

  return v;
}

/** Voxel model ng Aspin (Pinoy Street Dog) */
function aspinVox() {
  const v = new Vox();
  const FUR = 0xb4793e; // caramel tan
  const BELLY = 0xdca86c;
  const NOSE = 0x26160e;

  // Katawan
  v.box(-1, 2, -3, 1, 4, 2, FUR);
  v.box(-1, 2, -2, 1, 2, 1, BELLY);
  // 4 na paa
  v.box(-2, 0, 1, -1, 2, 2, FUR);
  v.box(1, 0, 1, 2, 2, 2, FUR);
  v.box(-2, 0, -3, -1, 2, -2, FUR);
  v.box(1, 0, -3, 2, 2, -2, FUR);
  // Ulo at nguso
  v.box(-1, 4, 2, 1, 6, 4, FUR);
  v.box(-1, 3, 4, 1, 4, 5, NOSE);
  // Mga tainga
  v.set(-1, 7, 3, FUR);
  v.set(1, 7, 3, FUR);
  // Nakataas na buntot
  v.set(0, 5, -4, FUR);
  v.set(0, 6, -4, FUR);

  return v;
}

/** Voxel model ng Stone Brazier Pedestal */
function brazierPedestalVox() {
  const v = new Vox();
  const STONE = 0x484b54;
  const STONE_DARK = 0x34363d;
  // Baitang ng pedestal
  v.box(-4, 0, -4, 4, 1, 4, STONE_DARK);
  v.box(-3, 1, -3, 3, 2, 3, STONE);
  v.box(-2, 2, -2, 2, 7, 2, STONE);
  // Mangkok ng apoy sa itaas
  v.box(-3, 8, -3, 3, 9, 3, STONE_DARK);
  v.box(-4, 9, -4, 4, 10, 4, 0x2c2e35);
  return v;
}

/** Voxel model ng Bandila (Bayani / Halimaw) */
function bannerVox(color: number) {
  const v = new Vox();
  // Malapad na tela na nakasabit
  v.box(-3, 0, 0, 3, 12, 0, color);
  // Gintong dulo / tassel sa ibaba
  v.box(-2, -2, 0, 2, 0, 0, 0xf1c40f);
  // Gitnang sagisag
  v.box(-1, 6, 0, 1, 8, 0, 0xf1c40f);
  return v;
}
