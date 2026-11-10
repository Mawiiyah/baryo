import * as THREE from 'three';
import { SCENE3D as S } from '../config';
import { randFloat } from '../sim/rand';
import type { Vox } from './voxel';

// Mga pirasong ginagamit ng lahat ng battlefield (glow, niyog, apoy, voxel na dekorasyon).

export interface Torch {
  light: THREE.PointLight;
  flame: THREE.Object3D;
  phase: number;
}

let glowTex: THREE.Texture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

let fogTex: THREE.Texture | null = null;
export function fogTexture() {
  if (fogTex) return fogTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.35, 'rgba(235,230,245,0.45)');
  grad.addColorStop(0.7, 'rgba(190,180,210,0.15)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  fogTex = new THREE.CanvasTexture(c);
  return fogTex;
}

/** Apoy (cone + halo) na may kumukutitap na ilaw; ang `size` ay laki ng apoy. */
export function torchFlame(sc: THREE.Object3D, x: number, y: number, z: number, color: number, size = 1): Torch {
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14 * size, 0.4 * size, 8), new THREE.MeshBasicMaterial({ color }));
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.07 * size, 0.24 * size, 6), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  core.position.y = -0.06 * size;
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  halo.scale.setScalar(1.6 * size);
  flame.add(core, halo);
  flame.position.set(x, y, z);
  const light = new THREE.PointLight(color, S.torchIntensity, S.torchDistance, 2);
  light.position.set(x, y + 0.5 * size, z); // mas mataas: hindi nasusunog sa liwanag ang lalagyan
  sc.add(flame, light);
  return { light, flame, phase: randFloat(0, 10) };
}

/** Voxel na dekorasyon → Group (naka-cache ang geometry kada `key`). */
export function voxGroup(v: Vox, key: string, unit: number) {
  const g = new THREE.Group();
  for (const { geometry, glow } of v.build(key, unit)) {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      emissive: glow ?? 0x000000,
      emissiveIntensity: glow ? 2 : 0,
    });
    const mesh = new THREE.Mesh(geometry, m);
    mesh.castShadow = !glow;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

export function palm(x: number, z: number, height: number, side: number, trunkColor: number = S.trunkColor, leafColor: number = S.palmColor) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 1, side: THREE.DoubleSide });
  const segs = 6;
  const lean = -side * randFloat(0.4, 1.2);
  let px = 0;
  let py = 0;
  for (let i = 0; i < segs; i++) {
    const t1 = (i + 1) / segs;
    const nx = lean * t1 * t1;
    const ny = height * t1;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, height / segs + 0.05, 7), trunkMat);
    seg.position.set((px + nx) / 2, (py + ny) / 2, 0);
    seg.rotation.z = -Math.atan2(nx - px, ny - py);
    seg.castShadow = true;
    g.add(seg);
    px = nx;
    py = ny;
  }
  for (let i = 0; i < 8; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 2.6), leafMat);
    leaf.geometry.translate(0, 1.3, 0);
    const pivot = new THREE.Group();
    pivot.position.set(px, py, 0);
    pivot.rotation.y = (i / 8) * Math.PI * 2;
    leaf.rotation.x = 1.05 + randFloat(-0.15, 0.25);
    leaf.castShadow = true;
    pivot.add(leaf);
    g.add(pivot);
  }
  g.position.set(x, 0, z);
  return g;
}
