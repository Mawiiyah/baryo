import * as THREE from 'three';
import { LANE, SCENE3D as S } from '../config';
import { randFloat } from '../sim/rand';
import { buildBarangay, monoblocChairVox } from './barangay';
import { buildKubo } from './models';
import { fogTexture, voxGroup, type Torch } from './scenery';
import { Vox } from './voxel';

// Battlefield na "Baha" (batay sa assets/reference/battlefield_baha.png): ang 'barangay' na mapa
// na binaha habang may bagyo. Maputik na tubig sa buong paligid (aninag pa ang kalsada),
// malakas na ulan na may mga bilog sa tubig, kidlat, maitim na ulap, rescue boat na may
// flashlight, mga pamilyang naghihintay ng saklolo sa bubong, at mga lumulutang na kalat
// (palanggana, tsinelas, kahoy, cooler, monobloc). Ang mga numero ay nasa SCENE3D.baha.

const W = S.baha;
const HALF = LANE.halfWidth + 0.5;

/** Taas ng alon (metro, kaugnay ng `waterLevel`) sa puwestong (x, z) sa oras na t (segundo). */
export function waveHeight(x: number, z: number, t: number): number {
  let h = 0;
  for (const w of W.waves) {
    const k = (Math.PI * 2) / w.len;
    const n = Math.hypot(w.dirX, w.dirZ);
    h += Math.sin(((x * w.dirX + z * w.dirZ) / n) * k - t * w.speed) * w.amp;
  }
  return h;
}

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
  const waterGeo = new THREE.PlaneGeometry(W.waterSize, W.waterSize, W.waveSegments, W.waveSegments);
  const waterPos = waterGeo.attributes.position as THREE.BufferAttribute;
  const waterCol = new THREE.BufferAttribute(new Float32Array(waterPos.count * 3), 3);
  waterGeo.setAttribute('color', waterCol);
  const waveMax = W.waves.reduce((a, w) => a + w.amp, 0);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({
      map: waterTex,
      vertexColors: true, // maliwanag sa tuktok ng alon, madilim sa lambak
      color: new THREE.Color(W.waterColor).multiplyScalar(W.waveCrestBoost),
      transparent: true,
      opacity: W.waterOpacity,
      roughness: W.waterRoughness, // hindi masyadong makintab: walang puting silaw sa gilid ng alon
      metalness: 0,
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

  // ---- 3b. Mga bahay na lubog sa baha (magkabilang gilid; kapalit ng hamog sa gilid) ----
  // Hanay ng konkretong bahay (may yero, ilaw sa itaas na bintana), lubog ang unang palapag.
  // Iilan ay may rooftop na may mga taong humihingi ng saklolo at karatulang "TULONG".
  const HU = 0.2; // metro kada voxel ng bahay
  const houseSpots: { x: number; z: number; v: number; rot: number }[] = [
    // kaliwa sa screen (+x): unang hanay (isang palapag lang)
    { x: HALF + 9.5, z: -3, v: 0, rot: 0.08 },
    { x: HALF + 9, z: 6.5, v: 4, rot: -0.05 },
    { x: HALF + 9.5, z: 16, v: 2, rot: 0.06 },
    { x: HALF + 9, z: 25.5, v: 3, rot: -0.04 },
    { x: HALF + 9.5, z: 35, v: 2, rot: 0.05 },
    // kaliwa: ikalawang hanay (mas malayo sa kalsada; may 2 palapag)
    { x: HALF + 16, z: 1.5, v: 5, rot: -0.1 },
    { x: HALF + 16.5, z: 11, v: 0, rot: 0.04 },
    { x: HALF + 16, z: 20.5, v: 1, rot: -0.06 },
    { x: HALF + 16.5, z: 30, v: 2, rot: 0.08 },
    { x: HALF + 16, z: 40, v: 4, rot: 0 },
    // kanan sa screen (-x): unang hanay (isang palapag lang para hindi matakpan ang laban)
    { x: -(HALF + 9.5), z: -2, v: 4, rot: -0.06 },
    { x: -(HALF + 9), z: 7.5, v: 2, rot: 0.05 },
    { x: -(HALF + 9.5), z: 17, v: 3, rot: -0.08 },
    { x: -(HALF + 9), z: 26.5, v: 0, rot: 0.04 },
    { x: -(HALF + 9.5), z: 36, v: 4, rot: -0.05 },
    // kanan: ikalawang hanay
    { x: -(HALF + 16), z: 2.5, v: 4, rot: 0.07 },
    { x: -(HALF + 16.5), z: 12, v: 1, rot: -0.04 },
    { x: -(HALF + 16), z: 21.5, v: 5, rot: 0.1 },
    { x: -(HALF + 16.5), z: 31, v: 1, rot: -0.06 },
    { x: -(HALF + 16), z: 41, v: 2, rot: 0.03 },
  ];
  houseSpots.forEach((h, i) => {
    const o = HOUSES[h.v]!;
    const g = voxGroup(houseVox(o), `baha:house:${h.v}`, HU);
    g.position.set(h.x, 0, h.z);
    g.rotation.y = h.rot;
    sc.add(g);
    if (!o.deck) return;
    // Rooftop: mga taong naghihintay ng saklolo + karatulang TULONG
    const deckY = (o.floors * FLOOR_H + 2) * HU; // ibabaw ng sahig ng rooftop
    const p1 = addPerson(g, { shirt: 0xe0e0e0, pants: 0x2a3a5a, skin: 0xb07a52, hair: 0x1a1210, wave: true }, -0.8, deckY, -0.6, `deck${i}a`);
    p1.rotation.x = 0;
    const p2 = addPerson(g, { shirt: 0xd06030, pants: 0x3a3030, skin: 0xbf8a62, hair: 0x22140e }, 0.5, deckY, -0.4, `deck${i}b`);
    p2.rotation.x = 0;
    // Nakalatag sa sahig (parang SOS sa bubong), nababasa mula sa camera sa itaas
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 1), new THREE.MeshBasicMaterial({ map: helpSignTexture(), transparent: true }));
    sign.position.set(0, deckY + 0.02, 0.8);
    sign.rotation.set(-Math.PI / 2, 0, Math.PI);
    g.add(sign);
  });

  // Mga kubong lubog hanggang bintana (sa pagitan ng mga bahay)
  for (const k of [
    { x: HALF + 12.5, z: 44, s: 0.85, r: 0.3 },
    { x: -(HALF + 12.5), z: 45, s: 0.8, r: -0.2 },
    { x: HALF + 22.5, z: 15, s: 0.9, r: 0.5 },
    { x: -(HALF + 22.5), z: 26, s: 0.9, r: -0.4 },
  ]) {
    const hut = buildKubo();
    hut.scale.setScalar(k.s);
    hut.position.set(k.x, 0, k.z);
    hut.rotation.y = k.r;
    sc.add(hut);
  }

  // Poste ng kuryente na may nakalaylay na kable (sa pagitan ng kalsada at mga bahay)
  const postMat = new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 1 });
  const wireMat = new THREE.LineBasicMaterial({ color: 0x0c0c10 });
  for (const side of [1, -1]) {
    const tops: THREE.Vector3[] = [];
    for (let z = -6; z <= 46; z += 13) {
      const x = side * (HALF + 6.2);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 7.5, 0.22), postMat);
      post.position.set(x, 3.75, z);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), postMat);
      arm.position.set(x, 7.1, z);
      sc.add(post, arm);
      tops.push(new THREE.Vector3(x - 0.7, 7.05, z), new THREE.Vector3(x + 0.7, 7.05, z));
    }
    for (const lane of [0, 1]) {
      for (let i = lane; i + 2 < tops.length; i += 2) {
        const a = tops[i]!;
        const b = tops[i + 2]!;
        const mid = a.clone().lerp(b, 0.5);
        mid.y -= 0.9; // laylay ng kable
        const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(10);
        sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
      }
    }
  }

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

  // Dagdag na kalat: random na nakakalat sa buong baha
  const D = W.debris;
  const free = (x: number, z: number) => !(Math.abs(x) < D.kuboClear.halfX && z < D.kuboClear.zMax);
  const spot = (): [number, number] => {
    for (;;) {
      const x = randFloat(-D.areaX, D.areaX);
      const z = randFloat(D.zMin, D.zMax);
      if (!free(x, z)) continue;
      if (Math.abs(x) < LANE.halfWidth && Math.random() > D.laneKeep) continue;
      return [x, z];
    }
  };
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;
  const plastics = [0xe8e8e8, 0x2a6ad0, 0xd84040, 0x40b060, 0xf0d040, 0x202024, 0xe080b0];
  const makers: (() => THREE.Object3D)[] = [
    () => { const c = pick(plastics); return voxGroup(bagVox(c), `baha:bag:${c}`, 0.05); },
    () => voxGroup(tireVox(), 'baha:tire', 0.06),
    () => voxGroup(boxVox(), 'baha:box', 0.07),
    () => voxGroup(styroVox(), 'baha:styro', 0.06),
    () => voxGroup(branchVox(), 'baha:branch', 0.07),
    () => voxGroup(yeroVox(), 'baha:yero', 0.08),
    () => { const c = pick([0x4a90d8, 0xe8e0c8, 0x40a060]); return voxGroup(galonVox(c), `baha:galon:${c}`, 0.05); },
    () => voxGroup(lilyVox(), 'baha:lily', 0.06),
    () => voxGroup(logVox(), 'baha:logS', 0.06),
    () => voxGroup(bottleVox(), 'baha:bottle', 0.04),
    () => { const c = pick(plastics); return voxGroup(slipperVox(c), `baha:slipper:${c}`, 0.04); },
    () => { const c = pick(plastics); return voxGroup(basinVox(c), `baha:basinS:${c}`, 0.05); },
  ];
  for (let i = 0; i < D.count; i++) addFloater(pick(makers)(), ...spot());
  // Bunton ng basura: maliliit na balot, sachet at plastik na magkakadikit
  for (let i = 0; i < D.clusters; i++) {
    const [cx, cz] = spot();
    const n = Math.round(randFloat(D.perCluster[0], D.perCluster[1]));
    for (let j = 0; j < n; j++) {
      const a = randFloat(0, Math.PI * 2);
      const r = Math.sqrt(Math.random()) * D.clusterRadius;
      const c = pick(plastics);
      const obj = j % 3 === 0 ? voxGroup(bagVox(c), `baha:bagS:${c}`, 0.035) : voxGroup(wrapperVox(c), `baha:wrap:${c}`, 0.04);
      addFloater(obj, cx + Math.cos(a) * r, cz + Math.sin(a) * r);
    }
  }

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
      // Alon: lokal na (x, y) ng plane → mundo (x, z = 16 - y) dahil naka-rotate ng -90° sa x
      for (let i = 0; i < waterPos.count; i++) {
        const h = waveHeight(waterPos.getX(i), water.position.z - waterPos.getY(i), t);
        waterPos.setZ(i, h);
        const k = (h / waveMax + 1) / 2; // 0 = lambak, 1 = tuktok
        const b = (W.waveTroughShade + (W.waveCrestBoost - W.waveTroughShade) * k * k) / W.waveCrestBoost;
        waterCol.setXYZ(i, b, b, b * W.waveCrestBlue);
      }
      waterPos.needsUpdate = true;
      waterCol.needsUpdate = true;
      waterGeo.computeVertexNormals();

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
          rp.m.position.set(randFloat(-HALF - 8, HALF + 8), 0, randFloat(-3, 30));
        }
        rp.m.position.y = W.waterLevel + waveHeight(rp.m.position.x, rp.m.position.z, t) + 0.02;
        const p = life - cycle;
        rp.m.scale.setScalar(0.05 + p * W.rippleSize);
        rp.mat.opacity = 0.5 * (1 - p);
      }

      // Lumulutang na kalat: umaalon at dahan-dahang inaanod
      for (const f of floaters) {
        const d = Math.sin(t * W.driftSpeed + f.ph) * 0.6;
        const fx = f.x + d;
        const fz = f.z + Math.cos(t * W.driftSpeed * 0.7 + f.ph) * 0.4;
        f.obj.position.set(fx, W.waterLevel - 0.03 + waveHeight(fx, fz, t) + Math.sin(t * W.bobSpeed + f.ph) * W.bobAmp, fz);
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

/** Haba ng isang palapag at sukat ng bahay (sa voxels ng `HU`). */
const FLOOR_H = 15;
const HOUSE_W = 13; // kalahating lapad (x)
const HOUSE_D = 10; // kalahating lalim (z)

interface HouseOpts {
  wall: number;
  trim: number;
  roof: number;
  floors: 1 | 2;
  deck?: boolean; // patag na rooftop na may barandilya (walang yero)
  antenna?: boolean;
  tank?: boolean; // asul na drum ng tubig sa bubong
}

/** Mga uri ng bahay (iba-ibang pintura at bubong). */
const HOUSES: HouseOpts[] = [
  { wall: 0xd8c8a0, trim: 0x8a6a42, roof: 0x7a7e84, floors: 1, antenna: true },
  { wall: 0x8ab0c8, trim: 0x2f4a62, roof: 0x8a4a2a, floors: 2, tank: true },
  { wall: 0xe0a8a0, trim: 0x8a3a3a, roof: 0xa04030, floors: 1 },
  { wall: 0xc8d890, trim: 0x4a6a2a, roof: 0x3a6a8a, floors: 1, deck: true },
  { wall: 0xf0e0c0, trim: 0x6a5a4a, roof: 0x6a6e74, floors: 1, tank: true },
  { wall: 0xb0a8d0, trim: 0x4a3a6a, roof: 0x7a5a3a, floors: 2, antenna: true },
];

const shade = (c: number, f: number) => {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
};

/** Konkretong bahay (hollow blocks, yero o rooftop), nakatayo sa y = 0; harap = -z. */
function houseVox(o: HouseOpts) {
  const v = new Vox();
  const W = HOUSE_W;
  const D = HOUSE_D;
  const H = o.floors * FLOOR_H;
  const mortar = shade(o.wall, 0.82);
  const wallAt = (y: number) => (y % 4 === 0 ? mortar : o.wall);
  // Mga pader (hungkag)
  for (let y = 0; y <= H; y++) {
    const c = wallAt(y);
    v.box(-W, y, -D, W, y, -D, c);
    v.box(-W, y, D, W, y, D, c);
    v.box(-W, y, -D, -W, y, D, c);
    v.box(W, y, -D, W, y, D, c);
  }
  // Mantsa ng putik sa pader (linya ng tubig noong mas mataas pa ang baha)
  const mud = 0x5a4630;
  for (const y of [13, 14]) {
    v.box(-W, y, -D, W, y, -D, mud);
    v.box(-W, y, D, W, y, D, mud);
    v.box(-W, y, -D, -W, y, D, mud);
    v.box(W, y, -D, W, y, D, mud);
  }
  // Bintana kada palapag (may ilaw ang nasa itaas na hindi lubog)
  for (let f = 0; f < o.floors; f++) {
    const y0 = f * FLOOR_H + 5;
    const lit = f === o.floors - 1;
    const pane = lit ? 0x8a5a24 : 0x1a1c24; // madilim na kulay: pinapaliwanag ng emissive
    for (const wx of [-9, 4]) {
      v.box(wx, y0, -D, wx + 5, y0 + 5, -D, pane, lit);
      v.box(wx - 1, y0 - 1, -D - 1, wx + 6, y0 - 1, -D - 1, o.trim); // pasamano
      v.box(wx + 2, y0, -D - 1, wx + 3, y0 + 5, -D - 1, o.trim); // rehas
      v.box(wx, y0, D, wx + 5, y0 + 5, D, pane, lit);
    }
    for (const sx of [-W, W]) v.box(sx, y0, -3, sx, y0 + 5, 3, pane, lit);
    // Hangganan ng palapag
    if (f > 0) v.box(-W - 1, f * FLOOR_H, -D - 1, W + 1, f * FLOOR_H, D + 1, o.trim);
  }
  if (o.deck) {
    // Patag na rooftop na may barandilya
    v.box(-W - 1, H + 1, -D - 1, W + 1, H + 1, D + 1, 0x9a968c);
    for (let x = -W - 1; x <= W + 1; x++) {
      for (const z of [-D - 1, D + 1]) v.box(x, H + 2, z, x, H + (x % 3 === 0 ? 5 : 2), z, o.trim);
    }
    for (let z = -D - 1; z <= D + 1; z++) {
      for (const x of [-W - 1, W + 1]) v.box(x, H + 2, z, x, H + (z % 3 === 0 ? 5 : 2), z, o.trim);
    }
    v.box(-W - 1, H + 5, -D - 1, W + 1, H + 5, -D - 1, o.trim);
    v.box(-W - 1, H + 5, D + 1, W + 1, H + 5, D + 1, o.trim);
    v.box(-W - 1, H + 5, -D - 1, -W - 1, H + 5, D + 1, o.trim);
    v.box(W + 1, H + 5, -D - 1, W + 1, H + 5, D + 1, o.trim);
    return v;
  }
  // Bubong na yero (gable; tagaytay sa x), may kalawang
  const RZ = D + 2;
  for (let z = -RZ; z <= RZ; z++) {
    const ry = H + 1 + Math.floor((RZ - Math.abs(z)) * 0.55);
    for (let x = -W - 2; x <= W + 2; x++) {
      const rust = (x * 7 + z * 13 + 100) % 17 === 0 || (x * 3 + z * 5 + 50) % 23 === 0;
      const c = z === 0 ? shade(o.roof, 1.25) : rust ? 0x8a4a22 : x % 2 ? o.roof : shade(o.roof, 0.82);
      v.set(x, ry, z, c);
      if (Math.abs(z) <= D && Math.abs(x) === W) v.box(x, H + 1, z, x, ry - 1, z, o.wall); // tatsulok na dulo
    }
  }
  const top = H + 1 + Math.floor(RZ * 0.55);
  if (o.antenna) {
    v.box(-6, top + 1, 0, -6, top + 12, 0, 0x8a8a90);
    for (const [y, w] of [[top + 8, 4], [top + 10, 3], [top + 12, 2]] as const) v.box(-6 - w, y, 0, -6 + w, y, 0, 0x8a8a90);
  }
  if (o.tank) {
    v.box(5, top - 2, -2, 9, top + 4, 2, 0x2a64b0);
    v.box(5, top + 4, -2, 9, top + 4, 2, 0x3a78c8);
  }
  return v;
}

/** Karatulang "TULONG!" na pininturahan sa kumot (puti na may pulang letra). */
function helpSignTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 40;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e8e4da';
  g.fillRect(2, 2, 124, 36);
  g.fillStyle = '#c81e1e';
  g.font = 'bold 28px Impact, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('TULONG!', 64, 22);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
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

/** Supot na plastik (lobo-lobo, may tali sa taas). */
function bagVox(c: number) {
  const v = new Vox();
  v.box(-2, 0, -2, 2, 2, 2, c);
  v.box(-1, 3, -1, 1, 3, 1, c);
  v.boxSym(1, 4, 0, 1, 4, 0, c); // tainga ng supot
  return v;
}

/** Lumang gulong (nakahiga). */
function tireVox() {
  const v = new Vox();
  for (let x = -5; x <= 5; x++)
    for (let z = -5; z <= 5; z++) {
      const r = Math.hypot(x, z);
      if (r <= 5.3 && r > 2.6) v.box(x, 0, z, x, 2, z, r > 4.4 ? 0x18181a : 0x2a2a2e);
    }
  return v;
}

/** Basang karton na kahon (bahagyang lubog). */
function boxVox() {
  const v = new Vox();
  v.box(-4, 0, -3, 4, 4, 3, 0xa07848);
  v.box(-4, 4, -3, 4, 4, -2, 0x8a6438);
  v.box(-4, 2, 3, 4, 2, 3, 0xc8a070); // tape
  v.box(-5, 4, -1, -5, 5, 2, 0x8a6438); // bukas na takip
  return v;
}

function styroVox() {
  const v = new Vox();
  v.box(-4, 0, -3, 4, 1, 3, 0xf2f2ec);
  v.box(-3, 2, -2, 3, 2, -2, 0xdcdcd4);
  v.set(2, 2, 1, 0xdcdcd4);
  return v;
}

/** Sangang may dahon na inanod. */
function branchVox() {
  const v = new Vox();
  v.line([[0, 0, -9], [0, 0, 0], [3, 0, 6], [5, 0, 9]], 0x4a3220);
  v.line([[0, 0, 0], [-4, 0, 5]], 0x4a3220);
  for (const [x, z] of [[5, 9], [-4, 5], [3, 6], [-1, -6], [1, -3]] as const) v.box(x - 1, 1, z - 1, x + 1, 1, z + 1, 0x2e5a22);
  return v;
}

/** Yerong natuklap sa bubong (may kulot). */
function yeroVox() {
  const v = new Vox();
  for (let x = -6; x <= 6; x++) v.box(x, x % 2 === 0 ? 0 : 1, -8, x, x % 2 === 0 ? 0 : 1, 8, x % 4 === 0 ? 0x8a4a2a : 0x8a8a90);
  return v;
}

/** Galon (plastic container) na nakahiga. */
function galonVox(c: number) {
  const v = new Vox();
  v.box(-3, 0, -4, 3, 5, 4, c);
  v.box(-1, 2, 5, 1, 4, 5, c);
  v.box(1, 6, -2, 2, 6, 2, c); // hawakan
  v.box(-1, 3, 6, 0, 3, 6, 0xd84040); // takip
  return v;
}

/** Kumpol ng water lily (water hyacinth). */
function lilyVox() {
  const v = new Vox();
  for (let x = -6; x <= 6; x++)
    for (let z = -5; z <= 5; z++) if (Math.hypot(x, z * 1.2) < 6 && (x * 3 + z * 7) % 5 !== 0) v.set(x, 0, z, (x + z) % 3 === 0 ? 0x3a7a2e : 0x2a5e24);
  for (const [x, z] of [[-2, 1], [2, -2], [3, 2]] as const) v.box(x, 1, z, x, 2, z, 0x3e8a34);
  v.set(0, 2, 0, 0x9a7ad8); // bulaklak
  v.set(2, 3, -2, 0x9a7ad8);
  return v;
}

/** Maliit na balot/sachet. */
function wrapperVox(c: number) {
  const v = new Vox();
  v.box(-2, 0, -1, 2, 0, 1, c);
  v.set(-2, 0, -1, 0xe8e8e8);
  return v;
}
