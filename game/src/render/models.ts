import * as THREE from 'three';
import { SCENE3D as S, type UnitKind } from '../config';
import { torchFlame, type Torch } from './scenery';
import { buildVoxelModel } from './voxModels';

// Placeholder 3D models (original, gawa sa simpleng hugis). Ang mga numero dito ay
// hugis/proporsyon lang (parang sprite data); taas ≈ 1, paa sa y=0, nakaharap sa +z.

export interface Model {
  root: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  wings: THREE.Object3D[];
  segments: THREE.Object3D[]; // katawan ng ahas (Bakunawa), umaalon
  /** Binti/braso na umuugoy habang naglalalakad (userData: limb 'leg'|'arm', side ±1). */
  limbs: THREE.Object3D[];
}


class Builder {
  readonly root = new THREE.Group();
  readonly mats: THREE.MeshStandardMaterial[] = [];
  readonly wings: THREE.Object3D[] = [];
  readonly segments: THREE.Object3D[] = [];
  readonly limbs: THREE.Object3D[] = [];

  mat(color: number, emissive = 0, roughness = 0.75) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, emissive, emissiveIntensity: emissive ? 2 : 0 });
    m.userData.baseEmissive = emissive;
    this.mats.push(m);
    return m;
  }

  add(geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.root) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }



  done(): Model {
    return { root: this.root, mats: this.mats, wings: this.wings, segments: this.segments, limbs: this.limbs };
  }
}

const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r: number, h: number, seg = 10) => new THREE.ConeGeometry(r, h, seg);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);




/** Mga karakter ay voxel (pixel 3D) na ngayon — tingnan ang voxModels.ts. */
export function buildModel(kind: UnitKind, color: number): Model {
  return buildVoxelModel(kind, color);
}

/** Bahay Kubo: stilts, dingding na kawayan, bintanang may ilaw, bubong na pawid. */
export function buildKubo(): THREE.Group {
  const b = new Builder();
  const wall = b.mat(S.hutColor);
  const post = b.mat(0x5b4325);
  const W = 4.2;
  const D = 3.2;
  for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) for (const z of [-D / 2 + 0.2, D / 2 - 0.2]) b.add(cyl(0.12, 0.14, 1.2, 8), post, x, 0.6, z);
  b.add(box(W + 0.3, 0.16, D + 0.3), b.mat(0x6e5230), 0, 1.2, 0);
  b.add(box(W, 1.9, D), wall, 0, 2.2, 0);
  // kawayan na guhit
  const line = b.mat(0xa9854d);
  for (let i = -4; i <= 4; i++) b.add(box(0.04, 1.9, 0.02), line, i * (W / 10), 2.2, -D / 2 - 0.01);
  // bintana (harap at likod) na may ilaw
  const glow = b.mat(S.kuboWindowColor, S.kuboWindowColor);
  for (const z of [-D / 2 - 0.02, D / 2 + 0.02]) {
    b.add(box(0.9, 0.7, 0.04), glow, 0.9, 2.4, z).castShadow = false;
    b.add(box(0.06, 0.7, 0.06), post, 0.9, 2.4, z);
  }
  b.add(box(0.8, 1.35, 0.06), post, -1, 1.95, -D / 2 - 0.03); // pinto
  // hagdan
  for (let i = 0; i < 4; i++) b.add(box(0.8, 0.06, 0.25), post, -1, 0.25 + i * 0.28, -D / 2 - 0.5 + i * 0.12);
  // bubong (pawid)
  const roof = b.add(cone(3.6, 2.4, 4), b.mat(S.roofColor), 0, 4.3, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.85);
  const thatch = b.mat(0x5e4628);
  for (let i = 1; i <= 3; i++) {
    const r = b.add(cone(3.6 * (1 - i * 0.22) + 0.05, 0.08, 4, ), thatch, 0, 3.15 + i * 0.55, 0);
    r.rotation.y = Math.PI / 4;
    r.scale.set(1, 1, 0.85);
  }
  b.root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.receiveShadow = true;
  });
  return b.root;
}

/**
 * Base na Bahay Kubo: kubo pa rin, pero pinatibay — batong pundasyon, bakod na matulis na
 * kawayan sa likod at gilid (harap/pinto bukas, nakaharap sa camera), bantay na poste na may
 * bandila ng BAYANI, sulo sa pasukan, kalasag sa dingding, at kumikinang na pananggalang sa lupa.
 * Harap (pinto) = -z, nakaharap sa camera; halimaw galing sa +z. Ang `tick(t)` ay nagpapaindayog sa watawat at nagpapapintig sa pananggalang.
 */
export function buildBaseKubo(): { group: THREE.Group; torches: Torch[]; tick: (t: number) => void } {
  const F = S.kuboFort;
  const g = buildKubo();
  const W = 4.2;
  const D = 3.2;
  const mat = (color: number, emissive = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive, emissiveIntensity: emissive ? 1.5 : 0 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Batong pundasyon (dalawang patong)
  const stone = mat(F.stoneColor);
  const stoneTop = mat(F.stoneTopColor);
  add(box(W + 2.0, 0.22, D + 2.0), stone, 0, 0.11, 0);
  add(box(W + 1.3, 0.16, D + 1.3), stoneTop, 0, 0.3, 0);
  // Mga batong nakausli sa gilid ng pundasyon
  for (let i = -3; i <= 3; i++) {
    for (const z of [-(D + 2.0) / 2, (D + 2.0) / 2]) add(box(0.5, 0.26, 0.12), stoneTop, i * 0.85, 0.13, z);
  }

  // Pahilis na kawayang pampatibay sa mga haligi (X brace)
  const rail = mat(F.railColor);
  for (const z of [-D / 2 + 0.2, D / 2 - 0.2]) {
    for (const s of [-1, 1]) {
      const br = add(cyl(0.05, 0.05, W - 0.2, 6), rail, 0, 0.75, z);
      br.rotation.z = Math.PI / 2 + s * 0.22;
    }
  }

  // Bakod na matulis na kawayan: likod (+z, kung saan galing ang halimaw) at magkabilang gilid.
  // Bukas ang harap (-z, pinto, nakaharap sa camera) para kita ang kubo at ang laban.
  const stake = mat(F.stakeColor);
  const stakeGeo = cyl(0.08, 0.09, 1.1, 6);
  const tipGeo = cone(0.09, 0.3, 6);
  const fx = W / 2 + 1.25; // layo ng bakod sa gilid
  const fz = D / 2 + 1.25; // layo ng bakod sa likod
  const frontZ = -D / 2 - 0.4; // dulo ng gilid na bakod sa harap
  const step = 0.24;
  const stakeAt = (x: number, z: number, lean: { x: number; z: number }, h: number) => {
    const sg = new THREE.Group();
    sg.position.set(x, 0.38, z);
    sg.rotation.set(lean.z, 0, lean.x);
    sg.scale.y = h;
    add(stakeGeo, stake, 0, 0.55, 0, sg);
    add(tipGeo, stake, 0, 1.25, 0, sg);
    g.add(sg);
  };
  const tall = (i: number) => 0.9 + (Math.abs(i) % 2 ? 0.15 : 0);
  for (let x = -fx; x <= fx + 1e-6; x += step) stakeAt(x, fz, { x: 0, z: 0.22 }, tall(Math.round(x / step)));
  for (const s of [-1, 1]) {
    for (let z = frontZ; z < fz - 1e-6; z += step) stakeAt(s * fx, z, { x: s * -0.22, z: 0 }, tall(Math.round(z / step)));
  }
  // Pahalang na kawayan sa bakod
  const railGeo = cyl(0.04, 0.04, 1, 6);
  const railRun = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    const r = add(railGeo, rail, (x0 + x1) / 2, y, (z0 + z1) / 2);
    r.scale.y = Math.hypot(x1 - x0, z1 - z0);
    r.rotation.z = Math.PI / 2;
    r.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  };
  for (const y of [0.65, 1.05]) {
    railRun(-fx, fz, fx, fz, y);
    for (const s of [-1, 1]) railRun(s * fx, frontZ, s * fx, fz, y);
  }

  // Bantay na poste na may bandila ng BAYANI sa dalawang sulok ng likod (kita mula sa camera)
  const flagMat = new THREE.MeshStandardMaterial({
    color: F.flagColor,
    roughness: 0.8,
    side: THREE.DoubleSide,
    emissive: F.flagColor,
    emissiveIntensity: 0.3,
  });
  const gold = mat(F.emblemColor, F.emblemColor);
  const flags: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    add(cyl(0.09, 0.11, 3.4, 6), rail, s * fx, 1.7, fz);
    add(new THREE.SphereGeometry(0.13, 8, 6), gold, s * fx, 3.48, fz);
    const pivot = new THREE.Group();
    pivot.position.set(s * fx, 3.05, fz);
    pivot.userData.phase = s;
    g.add(pivot);
    const flag = add(new THREE.PlaneGeometry(1.0, 0.7), flagMat, s * 0.52, 0, 0, pivot);
    flag.castShadow = false;
    const sun = add(cyl(0.13, 0.13, 0.02, 10), gold, s * 0.52, 0, 0.012, pivot);
    sun.rotation.x = Math.PI / 2;
    flags.push(pivot);
  }

  // Sulo sa magkabilang gilid ng harap (pasukan ng BAYANI, sa tapat ng camera)
  const torches: Torch[] = [];
  for (const s of [-1, 1]) {
    const x = s * fx;
    add(cyl(0.06, 0.08, 1.6, 6), rail, x, 1.18, frontZ - 0.1);
    add(cyl(0.14, 0.1, 0.18, 8), mat(0x3a2a18), x, 2.0, frontZ - 0.1);
    torches.push(torchFlame(g, x, 2.22, frontZ - 0.1, S.torchColor, 0.9));
  }

  // Kalasag (pananggalang na kahoy) sa harap na dingding, sa magkabilang gilid
  const shield = mat(F.shieldColor);
  const trim = mat(F.shieldTrim);
  for (const x of [-W / 2 + 0.35, W / 2 - 0.35]) {
    const sh = add(box(0.5, 1.0, 0.06), shield, x, 2.25, -D / 2 - 0.06);
    add(box(0.08, 0.95, 0.03), trim, 0, 0, -0.04, sh);
    add(box(0.42, 0.08, 0.03), trim, 0, 0.12, -0.04, sh);
    // Dalawang sibat na nakakrus sa likod ng kalasag
    for (const s of [-1, 1]) {
      const sp = add(cyl(0.025, 0.025, 1.5, 5), rail, x, 2.25, -D / 2 - 0.03);
      sp.rotation.z = s * 0.6;
      const tip = add(cone(0.06, 0.18, 5), trim, 0, 0.8, 0, sp);
      tip.castShadow = false;
    }
  }

  // Sagisag (araw) sa ibabaw ng pinto
  const emblem = add(cyl(0.22, 0.22, 0.05, 12), mat(F.emblemColor, F.emblemColor), -1, 2.95, -D / 2 - 0.05);
  emblem.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const ray = add(box(0.06, 0.16, 0.03), mat(F.emblemColor, F.emblemColor), 0, 0, 0, emblem);
    const a = (i / 8) * Math.PI * 2;
    ray.position.set(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32);
    ray.rotation.set(Math.PI / 2, 0, 0);
    ray.rotation.y = -a + Math.PI / 2;
  }

  // Pananggalang (anting-anting) — kumikinang na bilog sa lupa sa paligid ng base
  const wardMat = new THREE.MeshBasicMaterial({
    color: F.wardColor,
    transparent: true,
    opacity: F.wardOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const ward = new THREE.Mesh(new THREE.RingGeometry(fx + 0.35, fx + 0.6, 48), wardMat);
  ward.rotation.x = -Math.PI / 2;
  ward.position.y = 0.04;
  ward.scale.set(1, fz / fx, 1);
  g.add(ward);

  const tick = (t: number) => {
    for (const f of flags) f.rotation.y = Math.sin(t * 2.1 + f.userData.phase) * F.flagSway;
    wardMat.opacity = F.wardOpacity + Math.sin(t * F.wardSpeed) * F.wardPulse;
  };
  return { group: g, torches, tick };
}
