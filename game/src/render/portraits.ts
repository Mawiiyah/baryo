import * as THREE from 'three';
import { ATTACKERS, DEFENDERS, HUD, type UnitKind } from '../config';
import { buildModel } from './models';


/** Nire-render ang bawat karakter nang isang beses → PNG data URL para sa HUD icons. */
export function renderPortraits(): Record<UnitKind, string> {
  // Maliit na resolution → pinalalaki nang pixelated sa HUD
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(HUD.portraitPx, HUD.portraitPx);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);

  const out = {} as Record<UnitKind, string>;
  const all = { ...DEFENDERS, ...ATTACKERS };
  for (const kind of Object.keys(all) as UnitKind[]) {
    const model = buildModel(kind, all[kind].color);
    model.root.rotation.y = 0.5;
    if (kind === 'manananggal') for (const w of model.wings) w.rotation.y = 0.5;
    scene.add(model.root);
    const box = new THREE.Box3().setFromObject(model.root);
    const center = box.getCenter(new THREE.Vector3());
    const h = Math.max(box.max.y - box.min.y, box.max.x - box.min.x, (box.max.z - box.min.z) * 0.6);
    camera.position.set(center.x, center.y + h * 0.15, center.z + h * 2.1);
    camera.lookAt(center);
    renderer.render(scene, camera);
    out[kind] = renderer.domElement.toDataURL('image/png');
    scene.remove(model.root);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
