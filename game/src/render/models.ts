import * as THREE from 'three';
import { SCENE3D as S, type UnitKind } from '../config';
import { buildVoxelModel } from './voxModels';

// Placeholder 3D models (original, gawa sa simpleng hugis). Ang mga numero dito ay
// hugis/proporsyon lang (parang sprite data); taas ≈ 1, paa sa y=0, nakaharap sa +z.

export interface Model {
  root: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  wings: THREE.Object3D[];
  segments: THREE.Object3D[]; // katawan ng ahas (Bakunawa), umaalon
}


class Builder {
  readonly root = new THREE.Group();
  readonly mats: THREE.MeshStandardMaterial[] = [];
  readonly wings: THREE.Object3D[] = [];
  readonly segments: THREE.Object3D[] = [];

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
    return { root: this.root, mats: this.mats, wings: this.wings, segments: this.segments };
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
