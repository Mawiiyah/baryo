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
  const flags: THREE.Object3D[] = [];
  const eyesList: { mesh: THREE.Object3D; nextBlink: number; blinkEnd: number }[] = [];

  // ---- 1. Lupa at Kapaligiran ----
  const groundTex = createGroundTexture();
  groundTex.repeat.set(24, 24);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }),
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

  // ---- 3. Base Bahay Kubo (sa z = S.kuboPos, nakaharap sa kalsada) ----
  const baseKubo = buildKubo();
  baseKubo.scale.setScalar(S.views.behind.kuboScale);
  baseKubo.position.set(0, 0, S.kuboPos);
  baseKubo.rotation.y = 0; // pinto nakaharap sa kalsada / halimaw
  const baseKuboLight = new THREE.PointLight(S.kuboLight, S.kuboLightIntensity, 14, 2);
  baseKuboLight.position.set(0, 2.6, -2.4);
  baseKubo.add(baseKuboLight);
  sc.add(baseKubo);

  // ---- 4. Barangay Hall Gate (sa dulo, kung saan lumalabas ang halimaw) ----
  // Eksaktong batay sa reference picture: Spanish colonial stone baluarte na may
  // arched portal, "BARANGAY HALL" arched plaque, 2nd floor municipal hall na may 3 bintana,
  // watawat ng Pilipinas, 2 gazebo sa magkabilang baluarte terrace, mga sulong nakakabit sa arko,
  // at malalaking bandila (Bayani sa kaliwa, Halimaw sa kanan).
  const gateGroup = new THREE.Group();
  gateGroup.position.set(0, 0, B.gatePos);

  const stoneTex = createFortressStoneTexture();
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
  stoneTex.repeat.set(1.5, 1.5);
  const stoneMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    roughness: 0.9,
  });

  // Kaliwa at Kanang Baluarte (Fortress Wings)
  const archW = Math.max(7.2, HALF * 1.15);
  const bastionW = 7.6;
  const bastionH = 8.5;
  const bastionD = 3.6;
  const bxOffset = archW / 2 + bastionW / 2 - 0.2;
  for (const s of [-1, 1]) {
    const bx = s * bxOffset;
    const bastion = new THREE.Mesh(new THREE.BoxGeometry(bastionW, bastionH, bastionD), stoneMat);
    bastion.position.set(bx, bastionH / 2, bastionD / 2);
    bastion.castShadow = true;
    bastion.receiveShadow = true;
    gateGroup.add(bastion);

    // Crenellations sa ibabaw ng baluarte
    const crenelW = 0.9;
    const crenelH = 0.7;
    for (let cx = bx - bastionW / 2 + crenelW / 2; cx <= bx + bastionW / 2; cx += crenelW * 2) {
      const crenel = new THREE.Mesh(new THREE.BoxGeometry(crenelW, crenelH, 0.45), stoneMat);
      crenel.position.set(cx, bastionH + crenelH / 2, 0.22);
      crenel.castShadow = true;
      gateGroup.add(crenel);
    }

    // Gazebo sa ibabaw ng bawat baluarte (Filipino wooden guardhouse pavilion na may bubong na pawid)
    const gz = voxGroup(gazeboVox(), `barangay:gazebo:${s}`, 0.16);
    gz.position.set(bx, bastionH, bastionD / 2);
    gateGroup.add(gz);

    // Mainit na ilaw sa loob ng gazebo
    const gzLight = new THREE.PointLight(0xffa834, 1.5, 7);
    gzLight.position.set(bx, bastionH + 1.8, bastionD / 2);
    gateGroup.add(gzLight);

    // Sulo sa dulong kanto ng baluarte rampart
    torches.push(torchFlame(sc, s * (bxOffset + bastionW / 2 - 0.4), bastionH + 0.6, B.gatePos + 0.5, B.flameColor, 1.8));

    // Ceremonial Banners na nakasabit sa harapan ng baluarte
    // Sa likod ng camera (-z view): -x ay kaliwa (Bayani), +x ay kanan (Halimaw)
    const isBayani = s < 0;
    const bannerTex = createBannerTexture(isBayani);
    const bannerW = 2.4;
    const bannerH = 5.2;
    const bannerPivot = new THREE.Group();
    bannerPivot.position.set(s * (archW / 2 + bastionW * 0.42), 7.3, -0.05);

    const bannerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(bannerW, bannerH),
      new THREE.MeshStandardMaterial({ map: bannerTex, transparent: true, roughness: 0.75, side: THREE.DoubleSide }),
    );
    bannerMesh.position.set(0, -bannerH / 2, 0);
    bannerMesh.rotation.y = Math.PI; // nakaharap sa camera
    bannerMesh.castShadow = true;
    bannerPivot.add(bannerMesh);

    // Sabitan / pole ng banner
    const bannerPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, bannerW + 0.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x3d2817 }),
    );
    bannerPole.rotation.z = Math.PI / 2;
    bannerPivot.add(bannerPole);

    gateGroup.add(bannerPivot);
    animatedBanners.push({ pivot: bannerPivot, phase: s * 1.5 });
  }

  // Gitnang Arko Facade (Radial voussoirs at keystones sa paligid ng pabilog na arko)
  const archH = 6.4;
  const archFacadeTex = createArchFacadeTexture();
  const archFacade = new THREE.Mesh(
    new THREE.PlaneGeometry(archW, archH),
    new THREE.MeshStandardMaterial({
      map: archFacadeTex,
      transparent: true,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  archFacade.position.set(0, archH / 2, -0.02);
  archFacade.rotation.y = Math.PI;
  archFacade.castShadow = true;
  archFacade.receiveShadow = true;
  gateGroup.add(archFacade);

  // Arched Stone Vault (kurbadong kisame sa loob ng lagusan kung saan lumalabas ang halimaw)
  const archVault = new THREE.Mesh(
    new THREE.CylinderGeometry(archW * 0.42, archW * 0.42, 3.4, 24, 1, true, 0, Math.PI),
    stoneMat,
  );
  archVault.rotation.z = Math.PI;
  archVault.rotation.y = Math.PI / 2;
  archVault.position.set(0, 3.8, 1.7);
  gateGroup.add(archVault);

  // Madilim na Lagusan (Dark Portal kung saan nag-i-spawn ang halimaw sa kadiliman)
  const tunnelBack = new THREE.Mesh(
    new THREE.PlaneGeometry(archW * 0.85, 5.6),
    new THREE.MeshBasicMaterial({ color: 0x050308 }),
  );
  tunnelBack.position.set(0, 2.8, 3.4);
  gateGroup.add(tunnelBack);

  // Dalawang Stone Pilasters (Haligi sa magkabilang tabi ng arko)
  for (const s of [-1, 1]) {
    const colMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 6.2, 0.85), stoneMat);
    colMesh.position.set(s * (archW / 2), 3.1, 0.15);
    colMesh.castShadow = true;
    gateGroup.add(colMesh);

    // Sulong nakakabit sa haligi ng arko na may maliwanag na apoy
    torches.push(torchFlame(sc, s * (archW / 2), 3.4, B.gatePos - 0.35, B.flameColor, 2.0));
  }

  // Stone Entablature / Lintel sa ibabaw ng arko
  const archCornice = new THREE.Mesh(new THREE.BoxGeometry(archW + 0.6, 0.6, 1.4), stoneMat);
  archCornice.position.set(0, 6.4, 0.5);
  archCornice.castShadow = true;
  gateGroup.add(archCornice);

  // Karatula ng "BARANGAY HALL" (Arched Blue Plaque na may Gintong Border at Puting Letra)
  const signTex = createBarangayHallSignTexture();
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(archW * 0.6, 5.2), 1.15),
    new THREE.MeshStandardMaterial({ map: signTex, transparent: true, roughness: 0.6, side: THREE.DoubleSide }),
  );
  signMesh.position.set(0, 7.15, -0.15);
  signMesh.rotation.y = Math.PI;
  gateGroup.add(signMesh);

  // 2nd Floor Municipal Hall Building
  const upperTex = createBarangayHallUpperTexture();
  const floor2Mesh = new THREE.Mesh(
    new THREE.BoxGeometry(archW + 0.6, 4.2, 2.6),
    new THREE.MeshStandardMaterial({ map: stoneMat.map, roughness: 0.9 }),
  );
  floor2Mesh.position.set(0, 9.3, 1.3);
  floor2Mesh.castShadow = true;
  gateGroup.add(floor2Mesh);

  // Harapan ng 2nd floor na may 3 colonial arched windows
  const floor2Facade = new THREE.Mesh(
    new THREE.PlaneGeometry(archW + 0.6, 4.2),
    new THREE.MeshStandardMaterial({ map: upperTex, transparent: true, roughness: 0.85, side: THREE.DoubleSide }),
  );
  floor2Facade.position.set(0, 9.3, -0.02);
  floor2Facade.rotation.y = Math.PI;
  gateGroup.add(floor2Facade);

  // Crenellations sa ibabaw ng 2nd floor roof parapet
  const roofSpan = (archW + 0.6) / 2 - 0.4;
  for (let x = -roofSpan; x <= roofSpan; x += 1.3) {
    const crn = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.3), stoneMat);
    crn.position.set(x, 11.7, 0.1);
    crn.castShadow = true;
    gateGroup.add(crn);
  }

  // Watawat ng Pilipinas sa ibabaw ng Barangay Hall (fluttering in wind)
  const flagGroup = new THREE.Group();
  flagGroup.position.set(0, 11.5, 0.3);
  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 3.8, 8),
    new THREE.MeshStandardMaterial({ color: 0xd0d0d8, metalness: 0.8, roughness: 0.2 }),
  );
  flagPole.position.y = 1.9;
  const flagFinial = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xf5c430, metalness: 0.9, roughness: 0.2 }),
  );
  flagFinial.position.y = 3.8;
  const flagMesh = createPhilippineFlag();
  flagMesh.position.set(1.4, 2.8, 0);
  flagGroup.add(flagPole, flagFinial, flagMesh);
  flags.push(flagMesh);
  gateGroup.add(flagGroup);

  sc.add(gateGroup);

  // ---- Layout ayon sa reference picture (arrange) ----
  // Kalsada/court sa kaliwa, Barangay Hall sa dulo (itaas), at lahat ng gusali sa KANAN ng kalsada:
  // 2 bahay kubo (malayo) -> 2 sari-sari store -> kubo + kubo-tindahan -> 2 traysikel,
  // at sa pinakaibaba (pinakamalapit sa camera): 2 sulong, 2 monobloc, gulong, 3 aspin.
  // Ang kanan ng screen ay -x (nakaharap ang camera sa +z), kaya `rx(off)` = x sa kanan ng kalsada.
  const rx = (off: number) => HALF + off;

  // ---- 5. Nakaparadang Jeepney sa may gate (sa kaliwang gilid, walang gusali doon) ----
  const gateJeep = voxGroup(jeepneyVox(0x2462a6, 0xe74c3c), 'barangay:gateJeep', 0.14);
  gateJeep.position.set(-(HALF + 0.8), 0, B.gatePos - 3.8);
  gateJeep.rotation.y = -0.25; // bahagyang nakatagilid papunta sa kalsada
  sc.add(gateJeep);

  // Headlight ng nakaparadang jeepney
  const gateJeepSpot = new THREE.SpotLight(B.headlightColor, 3.2, 16, Math.PI / 6, 0.4, 1.2);
  gateJeepSpot.position.set(-(HALF + 0.8), 0.85, B.gatePos - 2.4);
  gateJeepSpot.target.position.set(-(HALF - 0.6), 0, B.gatePos - 12);
  sc.add(gateJeepSpot, gateJeepSpot.target);

  // ---- 6. Traysikel (detalyadong sprite mula sa green-screen picture, tinanggal ang berdeng background) ----
  // Dalawa sa kaliwang hilera at dalawa sa kanang bahagi ng kalsada.
  const trikeLoader = new THREE.TextureLoader();
  const trikeTex = ['trike_a.png', 'trike_b.png'].map((n) => {
    const tx = trikeLoader.load(`${import.meta.env.BASE_URL}${n}`);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.magFilter = THREE.NearestFilter; // pixel-art, hindi malabo
    tx.minFilter = THREE.NearestFilter;
    return tx;
  });
  const TRIKE_H = 2.6; // taas ng traysikel (metro)
  const trikePlacements = [
    { x: rx(6.5), z: 6.5, tex: 0 },
    { x: rx(12.5), z: 6.5, tex: 1 },
    { x: -(HALF + 5.5), z: 7, tex: 1 },
    { x: -(HALF + 11), z: 13, tex: 0 },
  ];
  for (const tp of trikePlacements) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: trikeTex[tp.tex]!, transparent: true, color: 0xd8d8e8 }));
    sp.name = 'barangay:trike';
    sp.scale.set(TRIKE_H * (97 / 91), TRIKE_H, 1);
    sp.position.set(tp.x, TRIKE_H / 2, tp.z);
    sc.add(sp);
  }
  // ---- 7. Sari-Sari Stores (sa magkabilang gilid ng kalsada) ----
  const storeSpots = [
    { x: -(HALF + 3.4), z: 12.8, light: 0xffbe44, facing: 0.15 },
    { x: HALF + 3.4, z: 12.8, light: 0xffbe44, facing: -0.15 },
  ];
  storeSpots.forEach((sp, i) => {
    const store = voxGroup(sariSariStoreVox(), `barangay:store:${i}`, 0.18);
    store.add(storeSign());
    store.position.set(sp.x, 0, sp.z);
    store.rotation.y = sp.facing;
    sc.add(store);
    const l = new THREE.PointLight(sp.light, 1.5, 7);
    l.position.set(sp.x, 2.2, sp.z - 1);
    sc.add(l);
  });

  // ---- 8. Bahay Kubo sa magkabilang gilid (batay sa reference image) ----
  const huts = [
    // Kaliwa (harapan at likuran)
    { x: -(HALF + 3.2), z: 4.2, s: 0.88, rot: 0.25 },
    { x: -(HALF + 3.6), z: 23.5, s: 0.75, rot: 0 },
    // Kanan (harapan at likuran)
    { x: HALF + 3.2, z: 4.2, s: 0.88, rot: -0.25 },
    { x: HALF + 3.6, z: 23.5, s: 0.75, rot: 0 },
  ];
  huts.forEach((h) => {
    const hut = buildKubo();
    hut.scale.setScalar(h.s);
    hut.position.set(h.x, 0, h.z);
    hut.rotation.y = h.rot;
    const hl = new THREE.PointLight(B.windowColor, 1.3, 8);
    hl.position.set(h.x, 2.2, h.z - 1);
    sc.add(hut, hl);
  });

  // ---- 9. Mga Monobloc Chairs (pinakailalim na hilera, kanan) ----
  const blueChair = monoblocChairVox(0x186ec8);
  const redChair = monoblocChairVox(0xd62828);
  const chairPlacements = [
    { off: 7.5, z: 3.0, r: 0.3, red: false },
    { off: 8.7, z: 3.0, r: -0.3, red: true },
  ];
  for (const cp of chairPlacements) {
    const ch = voxGroup(cp.red ? redChair : blueChair, `barangay:chair:${cp.red ? 'r' : 'b'}`, 0.08);
    ch.position.set(rx(cp.off), 0, cp.z);
    ch.rotation.y = cp.r;
    sc.add(ch);
  }

  // ---- 10. Asong Kalye (Aspin) x3 (dulo ng ilalim na hilera) ----
  const aspinPlacements = [
    { off: 13.5, z: 2.8, r: 0.6 },
    { off: 15.2, z: 3.2, r: -2.1 },
    { off: 16.8, z: 4.6, r: 2.4 },
  ];
  aspinPlacements.forEach((ap, i) => {
    const aspin = voxGroup(aspinVox(), `barangay:aspin${i}`, 0.08);
    aspin.position.set(rx(ap.off), 0, ap.z);
    aspin.rotation.y = ap.r;
    sc.add(aspin);
  });

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

  // ---- 12. Banderitas (Fiesta Bunting) na may poste at nakalaylay na tali ----
  const banderitasColors = [0xf1c40f, 0xe74c3c, 0x00b4d8, 0x2ecc71, 0xff7700];
  const postGap = 8;
  const postTop = 3.85;
  const sag = (z: number) => {
    const t = (((z - 2) % postGap) + postGap) % postGap / postGap;
    return 0.55 * 4 * t * (1 - t);
  };
  const postVox = new Vox().box(0, 0, 0, 0, 30, 0, 0x4a3524).box(-1, 29, 0, 1, 29, 0, 0x4a3524);
  for (const s of [-1, 1]) {
    const x = s * (HALF + 0.6);
    for (let pz = 2; pz <= 26; pz += postGap) {
      const post = voxGroup(postVox, 'barangay:post', 0.13);
      post.position.set(x, 0, pz);
      sc.add(post);
    }
    const stringPts: THREE.Vector3[] = [];
    for (let z = 2; z <= 26.01; z += 0.5) stringPts.push(new THREE.Vector3(x, postTop - sag(z), z));
    sc.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(stringPts),
        new THREE.LineBasicMaterial({ color: 0x6a5a48 }),
      ),
    );
    for (let z = 2.7; z <= 26; z += 0.7) {
      const bColor = pick(banderitasColors, Math.round(z * 10), s, 5);
      const flagGeo = new THREE.BufferGeometry();
      // Tatsulok na banderita
      const vertices = new Float32Array([0, 0, -0.16, 0, -0.4, 0, 0, 0, 0.16]);
      flagGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      flagGeo.computeVertexNormals();
      const bMat = new THREE.MeshBasicMaterial({ color: bColor, side: THREE.DoubleSide });
      const bMesh = new THREE.Mesh(flagGeo, bMat);
      bMesh.position.set(x, postTop - sag(z) - 0.02, z);
      sc.add(bMesh);
      banderitasMeshes.push({ mesh: bMesh, phase: z * 0.4 + s });
    }
  }

  // ---- 12b. Mga Palumpong / Hedge (berde sa gilid ng kalsada) at namumulaklak na bougainvillea ----
  const bushPlacements: { x: number; z: number; rx: number; ry: number; rz: number; flower?: number }[] = [
    { x: -(HALF + 2.4), z: 6.2, rx: 7, ry: 5, rz: 6 },
    { x: -(HALF + 2.2), z: 17.4, rx: 6, ry: 6, rz: 7 },
    { x: -(HALF + 2.6), z: 21.5, rx: 7, ry: 5, rz: 6 },
    { x: -(HALF + 2.0), z: 27, rx: 6, ry: 5, rz: 6 },
    { x: HALF + 2.3, z: 3.2, rx: 6, ry: 5, rz: 6 },
    { x: HALF + 2.3, z: 12.8, rx: 6, ry: 6, rz: 7 },
    { x: HALF + 2.4, z: 15.6, rx: 7, ry: 5, rz: 5 },
    { x: HALF + 2.0, z: 26.5, rx: 6, ry: 5, rz: 7 },
    { x: HALF + 3.8, z: 0.6, rx: 7, ry: 5, rz: 7, flower: 0xb04ad8 },
    { x: HALF + 2.0, z: 1.8, rx: 4, ry: 3, rz: 4, flower: 0xd060e0 },
    { x: -(HALF + 4.2), z: 12, rx: 5, ry: 4, rz: 5, flower: 0xff5e8a },
  ];
  bushPlacements.forEach((b, i) => {
    const g = voxGroup(bushVox(b.rx, b.ry, b.rz, b.flower), `barangay:bush:${i}`, 0.22);
    g.position.set(b.x, 0, b.z);
    g.rotation.y = i * 1.3;
    sc.add(g);
  });

  // ---- 12c. Gulong, bangko, kahon, poste ng ilaw, pusa (maliliit na detalye) ----
  const tireStack = voxGroup(tireStackVox(3), 'barangay:tires', 0.12);
  tireStack.position.set(rx(10.6), 0, 3.0);
  sc.add(tireStack);

  const bench = voxGroup(benchVox(), 'barangay:bench', 0.1);
  bench.position.set(rx(11.5), 0, 15.2);
  bench.rotation.y = -Math.PI / 2;
  sc.add(bench);
  const bench2 = voxGroup(benchVox(), 'barangay:bench2', 0.1);
  bench2.position.set(rx(9.8), 0, 9.2);
  bench2.rotation.y = -Math.PI / 2;
  sc.add(bench2);

  const crates: [number, number, number][] = [
    [rx(3.2), 15.5, 0.2],
    [rx(3.4), 14.8, -0.3],
    [-(HALF + 1.6), 10.8, 0.5],
  ];
  crates.forEach(([cx2, cz2, cr], i) => {
    const cr2 = voxGroup(crateVox(i === 1 ? 0x2c6a3a : 0x6a4524), `barangay:crate:${i === 1 ? 'g' : 'w'}`, 0.1);
    cr2.position.set(cx2, 0, cz2);
    cr2.rotation.y = cr;
    sc.add(cr2);
  });

  const halos: THREE.Sprite[] = [];
  const lampPosts: [number, number][] = [
    [HALF + 1.0, 22.5],
    [-(HALF + 1.0), 9.8],
  ];
  for (const [lx, lz] of lampPosts) {
    const lamp = voxGroup(lampPostVox(), 'barangay:lamp', 0.12);
    lamp.position.set(lx, 0, lz);
    sc.add(lamp);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd58a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    halo.scale.setScalar(2.2);
    halo.position.set(lx, 3.0, lz);
    sc.add(halo);
    halos.push(halo);
  }

  const cat = voxGroup(catVox(), 'barangay:cat', 0.09);
  cat.position.set(-(HALF + 1.4), 0.4, 7.8);
  cat.rotation.y = 0.9;
  sc.add(cat);

  // ---- 12d. Mainit na liwanag sa lupa (pool ng ilaw sa ilalim ng apoy, bintana at tindahan) ----
  const poolMats: { mat: THREE.MeshBasicMaterial; base: number; phase: number }[] = [];
  const addPool = (x: number, z: number, size: number, color: number, base: number) => {
    const mat = new THREE.MeshBasicMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity: base,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.045, z);
    sc.add(m);
    poolMats.push({ mat, base, phase: randFloat(0, 10) });
  };
  for (const z of B.brazierPos) {
    for (const s of [-1, 1]) addPool(s * (HALF + 0.4), z, 8, B.flameColor, 0.34);
  }
  for (const sp of storeSpots) addPool(sp.x, sp.z - 1.5, 6, 0xffa838, 0.3);
  for (const [lx, lz] of lampPosts) addPool(lx, lz, 5, 0xffd58a, 0.22);

  // ---- 12e. Baga at alitaptap ----
  const EMBERS_PER = 7;
  const emberSrc: [number, number][] = [];
  for (const z of B.brazierPos) for (const s of [-1, 1]) emberSrc.push([s * (HALF + 1.2), z]);
  const emberN = emberSrc.length * EMBERS_PER;
  const emberPos = new Float32Array(emberN * 3);
  const emberSeed = Array.from({ length: emberN }, () => ({ off: randFloat(0, 1), dx: randFloat(-0.35, 0.35), dz: randFloat(-0.35, 0.35), spd: randFloat(0.25, 0.5) }));
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(
    emberGeo,
    new THREE.PointsMaterial({ map: glowTexture(), color: 0xffa040, size: 0.34, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  embers.frustumCulled = false;
  sc.add(embers);

  const FLY_N = 38;
  const flyPos = new Float32Array(FLY_N * 3);
  const flySeed = Array.from({ length: FLY_N }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    return { cx: side * randFloat(HALF + 1.5, HALF + 9), cz: randFloat(0, 28), cy: randFloat(0.5, 2.4), ph: randFloat(0, 20), r: randFloat(0.4, 1.2) };
  });
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const flies = new THREE.Points(
    flyGeo,
    new THREE.PointsMaterial({ map: glowTexture(), color: 0xc8ff78, size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  flies.frustumCulled = false;
  sc.add(flies);

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
    base: baseKubo,
    torches,
    tick: (t: number) => {
      // Bandila at banners na umiindayog
      for (const b of animatedBanners) {
        b.pivot.rotation.x = Math.sin(t * 1.8 + b.phase) * B.bannerSway;
      }
      for (const fl of flags) {
        fl.rotation.y = Math.sin(t * 3.2) * 0.22;
        fl.rotation.z = Math.sin(t * 2.5) * 0.08;
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
      // Kumukutitap na liwanag sa lupa at poste
      for (const p of poolMats) {
        p.mat.opacity = p.base * (0.88 + Math.sin(t * 9 + p.phase) * 0.07 + Math.sin(t * 5.3 + p.phase * 2) * 0.05);
      }
      for (const h of halos) h.material.opacity = 0.72 + Math.sin(t * 17 + h.position.z) * 0.06;
      // Baga na tumataas mula sa mga apoy
      for (let i = 0; i < emberN; i++) {
        const src = emberSrc[Math.floor(i / EMBERS_PER)]!;
        const sd = emberSeed[i]!;
        const life = (t * sd.spd + sd.off) % 1;
        emberPos[i * 3] = src[0] + sd.dx * life * 2 + Math.sin(t * 2 + i) * 0.1 * life;
        emberPos[i * 3 + 1] = 2.2 + life * 2.8;
        emberPos[i * 3 + 2] = src[1] + sd.dz * life * 2;
      }
      emberGeo.attributes.position!.needsUpdate = true;
      // Alitaptap na umiikot-ikot
      for (let i = 0; i < FLY_N; i++) {
        const f = flySeed[i]!;
        flyPos[i * 3] = f.cx + Math.sin(t * 0.7 + f.ph) * f.r;
        flyPos[i * 3 + 1] = f.cy + Math.sin(t * 1.3 + f.ph * 2) * 0.35;
        flyPos[i * 3 + 2] = f.cz + Math.cos(t * 0.6 + f.ph) * f.r;
      }
      flyGeo.attributes.position!.needsUpdate = true;
      (flies.material as THREE.PointsMaterial).opacity = 0.55 + Math.sin(t * 3) * 0.3;
    },
  };
}

// =========================================================================
// MGA TEXTURE AT VOXEL MODELS
// =========================================================================

function pixelTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, smooth = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (smooth) {
    // Makinis (hindi pixelated) para lumabas ang mga bitak, butas at iba pang detalye
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
  } else {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
  }
  return tex;
}

/** Maliit na seeded RNG para pare-pareho ang itsura ng texture kada load. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Texture ng lupa/damuhan: may batik-batik na damo, lupa at bato (tileable). */
function createGroundTexture() {
  const S2 = 512;
  const rnd = seeded(7);
  const base = `#${B.groundColor.toString(16).padStart(6, '0')}`;
  const tex = pixelTexture(
    S2,
    S2,
    (g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, S2, S2);
      const tones = ['#233a1c', '#16240f', '#2a2a1c', '#1d2e17', '#312818', '#10190c'];
      for (let i = 0; i < 520; i++) {
        const x = rnd() * S2;
        const y = rnd() * S2;
        const r = 6 + rnd() * 26;
        g.fillStyle = tones[Math.floor(rnd() * tones.length)]!;
        g.globalAlpha = 0.18 + rnd() * 0.22;
        for (const ox of [-S2, 0, S2]) for (const oy of [-S2, 0, S2]) {
          g.beginPath();
          g.ellipse(x + ox, y + oy, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
      // mga hibla ng damo
      for (let i = 0; i < 2600; i++) {
        const x = rnd() * S2;
        const y = rnd() * S2;
        g.strokeStyle = rnd() < 0.5 ? '#2f4f24' : '#0e1a0a';
        g.globalAlpha = 0.35 + rnd() * 0.35;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 4);
        g.stroke();
      }
      g.globalAlpha = 1;
    },
    true,
  );
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Karatula (makinis na teksto) para sa hall at mga tindahan. */
function signTexture(text: string, bg: string, fg: string, w: number, h: number) {
  return pixelTexture(
    w,
    h,
    (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = fg;
      g.lineWidth = 5;
      g.strokeRect(5, 5, w - 10, h - 10);
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `bold ${Math.round(h * 0.52)}px Impact, "Arial Black", sans-serif`;
      g.fillText(text, w / 2, h / 2 + 3, w - 40);
    },
    true,
  );
}

/** Nakasabit na karatulang "SARI-SARI STORE" sa harap ng tindahan (lokal sa voxGroup ng tindahan). */
function storeSign() {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.3),
    new THREE.MeshBasicMaterial({ map: signTexture('SARI-SARI STORE', '#b3211d', '#ffe7a0', 384, 76), color: 0xd0c8c0 }),
  );
  m.position.set(0, 1.42, -2.02);
  m.rotation.y = Math.PI;
  return m;
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
  const rnd = seeded(42);

  return pixelTexture(
    W,
    H,
    (g) => {
      const px = (x: number) => (x + HALF) * ppm;
      const py = (z: number) => (z - LANE_START) * ppm;

      // 1. Base Asphalt
      g.fillStyle = B.roadColor;
      g.fillRect(0, 0, W, H);

      // Malalaking batik ng luma at pinaliwanag na asphalt
      const blotch = ['#34353f', '#25262d', '#2f303a', '#1f2026'];
      for (let i = 0; i < 700; i++) {
        g.fillStyle = blotch[Math.floor(rnd() * blotch.length)]!;
        g.globalAlpha = 0.1 + rnd() * 0.18;
        g.beginPath();
        g.ellipse(rnd() * W, rnd() * H, ppm * (0.2 + rnd() * 1.2), ppm * (0.15 + rnd() * 0.9), rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;

      // Pinong butil ng asphalt
      for (let i = 0; i < W * H * 0.06; i++) {
        const x = rnd() * W;
        const y = rnd() * H;
        const k = rnd();
        g.fillStyle = k < 0.45 ? B.roadGrout : k < 0.8 ? '#3d3e49' : '#4a4b57';
        g.globalAlpha = 0.5 + rnd() * 0.4;
        g.fillRect(x, y, 1 + (rnd() < 0.2 ? 1 : 0), 1);
      }
      g.globalAlpha = 1;

      // 2. Mga tagpi (patched asphalt) na may bahagyang ibang kulay
      const patches: [number, number, number, number][] = [
        [-2.2, 5, 2.4, 1.6],
        [2.0, 20.5, 2.2, 2.6],
        [-1.0, 27, 3.0, 1.4],
        [1.6, 3.2, 1.8, 1.2],
      ];
      for (const [pxm, pzm, pw, pl] of patches) {
        g.fillStyle = '#23242b';
        g.fillRect(px(pxm), py(pzm), pw * ppm, pl * ppm);
        g.strokeStyle = '#17171c';
        g.lineWidth = 2;
        g.strokeRect(px(pxm), py(pzm), pw * ppm, pl * ppm);
      }

      // 3. Marka ng gulong (dalawang kurbang guhit patungo sa jeep)
      g.lineCap = 'round';
      for (const off of [-0.95, 0.95]) {
        for (let layer = 0; layer < 3; layer++) {
          g.strokeStyle = `rgba(8,8,12,${0.13 - layer * 0.03})`;
          g.lineWidth = ppm * (0.34 - layer * 0.07);
          g.beginPath();
          g.moveTo(px(off * 0.9), py(-3.5));
          g.bezierCurveTo(px(off * 1.2), py(1.5), px(off * 0.2 + 0.4), py(5), px(off * 0.4 - 0.2), py(11));
          g.stroke();
        }
      }
      g.strokeStyle = 'rgba(8,8,12,0.16)';
      g.lineWidth = ppm * 0.3;
      g.beginPath();
      g.moveTo(px(-0.2), py(12));
      g.bezierCurveTo(px(1.5), py(14.5), px(2.2), py(19), px(1.0), py(24));
      g.stroke();

      // 4. Puting gilid / curbs
      g.fillStyle = '#d6d4c8';
      for (const s of [-1, 1]) {
        g.fillRect(px(s * (HALF - 0.35)) - ppm * 0.15, 0, ppm * 0.3, H);
      }
      // Kupas sa puting guhit
      g.fillStyle = B.roadColor;
      for (let i = 0; i < 260; i++) {
        const s = rnd() < 0.5 ? -1 : 1;
        g.globalAlpha = 0.7;
        g.fillRect(px(s * (HALF - 0.35)) - ppm * 0.15 + rnd() * ppm * 0.3, rnd() * H, 2 + rnd() * 3, 3 + rnd() * 12);
      }
      g.globalAlpha = 1;

      // 5. Dilaw na Dashed Centerline (kupas)
      g.fillStyle = B.lineColor;
      for (let z = 0; z < len; z += 2.4) {
        const wz = LANE_START + z;
        if (Math.abs(wz - B.courtPos) < 2.8) continue;
        if (Math.abs(wz - B.textPos) < 2.0) continue;
        g.fillRect(px(0) - ppm * 0.1, py(wz), ppm * 0.2, ppm * 1.3);
      }

      // 6. \"BARANGAY\" stencil (kupas at lumang pintura)
      const textY = py(B.textPos);
      g.save();
      g.translate(W / 2, textY);
      g.rotate(Math.PI);
      g.scale(1, 1.8); // iniunat paitaas para hindi lumiit ang letra sa anggulo ng camera
      // nakabaligtad ang texture sa camera, kaya iikot para mabasa mula sa likod ng jeep
      g.font = `bold ${Math.round(ppm * 1.55)}px Impact, "Arial Black", sans-serif`;
      (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(ppm * 0.18)}px`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#f6f4ea';
      g.fillText('BARANGAY', 0, 0);
      g.restore();
      g.fillStyle = B.roadColor;
      for (let i = 0; i < 25; i++) {
        g.globalAlpha = 0.25 + rnd() * 0.3;
        g.fillRect(W / 2 + (rnd() - 0.5) * ppm * 8, textY + (rnd() - 0.5) * ppm * 1.7, 1 + rnd() * 4, 1 + rnd() * 3);
      }
      g.globalAlpha = 1;

      // 7. Basketball court: bilog, bola at mga guhit
      const courtY = py(B.courtPos);
      const courtX = W / 2;
      const courtR = Math.min(3.2, HALF * 0.4) * ppm;
      g.strokeStyle = '#d8d6cc';
      g.lineWidth = 0.2 * ppm;
      g.beginPath();
      g.arc(courtX, courtY, courtR, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 0.08 * ppm;
      g.globalAlpha = 0.5;
      g.beginPath();
      g.arc(courtX, courtY, courtR + 0.45 * ppm, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;

      const ballR = courtR * 0.68;
      const grad = g.createRadialGradient(courtX - ballR * 0.35, courtY - ballR * 0.4, ballR * 0.1, courtX, courtY, ballR);
      grad.addColorStop(0, '#e08a3c');
      grad.addColorStop(0.55, '#b85a24');
      grad.addColorStop(1, '#6e3212');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(courtX, courtY, ballR, 0, Math.PI * 2);
      g.fill();
      // Butil ng balat ng bola
      for (let i = 0; i < 450; i++) {
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * ballR * 0.97;
        g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,200,140,0.14)';
        g.fillRect(courtX + Math.cos(a) * r, courtY + Math.sin(a) * r, 1.5, 1.5);
      }
      g.strokeStyle = '#1c1b20';
      g.lineWidth = 0.1 * ppm;
      g.beginPath();
      g.arc(courtX, courtY, ballR, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(courtX - ballR, courtY);
      g.lineTo(courtX + ballR, courtY);
      g.moveTo(courtX, courtY - ballR);
      g.lineTo(courtX, courtY + ballR);
      g.stroke();
      g.beginPath();
      g.arc(courtX - ballR * 1.2, courtY, ballR * 0.95, -Math.PI * 0.38, Math.PI * 0.38);
      g.stroke();
      g.beginPath();
      g.arc(courtX + ballR * 1.2, courtY, ballR * 0.95, Math.PI * 0.62, Math.PI * 1.38);
      g.stroke();

      // 8. Mga bitak sa asphalt (random walk na may sanga)
      const crack = (x0: number, y0: number, steps: number, ang: number, wdt: number) => {
        let x = x0;
        let y = y0;
        let a = ang;
        g.strokeStyle = '#101015';
        g.lineWidth = wdt;
        g.beginPath();
        g.moveTo(x, y);
        for (let i = 0; i < steps; i++) {
          a += (rnd() - 0.5) * 1.1;
          x += Math.cos(a) * ppm * 0.22;
          y += Math.sin(a) * ppm * 0.22;
          g.lineTo(x, y);
          if (rnd() < 0.06 && steps - i > 8 && wdt > 1) crack(x, y, Math.floor((steps - i) * 0.5), a + (rnd() < 0.5 ? 1 : -1) * 0.8, wdt * 0.6);
        }
        g.stroke();
      };
      for (let i = 0; i < 14; i++) {
        const cx = (rnd() - 0.5) * (HALF * 2 - 1.2) * ppm + W / 2;
        const cy = rnd() * H;
        crack(cx, cy, 10 + Math.floor(rnd() * 30), rnd() * Math.PI * 2, 1 + rnd() * 0.9);
      }

      // 9. Mga lubak (potholes) at mantsa ng langis
      const stains: [number, number, number][] = [
        [-2.9, 9.5, 0.9],
        [2.4, 13.5, 0.7],
        [-0.6, 21.5, 0.8],
      ];
      for (const [sx, sz, sr] of stains) {
        const sg = g.createRadialGradient(px(sx), py(sz), 0, px(sx), py(sz), sr * ppm);
        sg.addColorStop(0, 'rgba(6,6,14,0.55)');
        sg.addColorStop(1, 'rgba(6,6,14,0)');
        g.fillStyle = sg;
        g.fillRect(px(sx) - sr * ppm, py(sz) - sr * ppm, sr * 2 * ppm, sr * 2 * ppm);
      }
      const holes: [number, number, number, number][] = [
        [-2.7, 6.6, 0.75, 0.5],
        [2.9, 1.8, 0.6, 0.42],
        [3.0, 22.6, 0.85, 0.55],
        [-2.0, 24.8, 0.7, 0.5],
        [1.7, 10.4, 0.5, 0.34],
        [-3.1, 14.2, 0.55, 0.4],
        [2.5, 17.2, 0.45, 0.32],
      ];
      for (const [hx, hz, hr, hv] of holes) {
        const cx = px(hx);
        const cy = py(hz);
        // gilid na nagkapira-piraso
        g.fillStyle = '#4a4b56';
        g.beginPath();
        g.ellipse(cx, cy, hr * ppm * 1.12, hr * ppm * hv * 2.1 * 1.1, 0.3, 0, Math.PI * 2);
        g.fill();
        const hg = g.createRadialGradient(cx, cy, 0, cx, cy, hr * ppm);
        hg.addColorStop(0, '#05050a');
        hg.addColorStop(0.7, '#0e0e14');
        hg.addColorStop(1, '#1b1b22');
        g.fillStyle = hg;
        g.beginPath();
        g.ellipse(cx, cy, hr * ppm, hr * ppm * hv * 2.1, 0.3, 0, Math.PI * 2);
        g.fill();
        for (let k = 0; k < 6; k++) crack(cx, cy, 8 + Math.floor(rnd() * 10), rnd() * Math.PI * 2, 1.2);
      }
    },
    true,
  );
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

  // Guhit-guhit na awning (pula/puti) sa harap, may mga ilaw na nakasabit
  for (let z = -11; z <= -6; z++) {
    const y = 9 + Math.floor((z + 11) * 0.5);
    for (let x = -9; x <= 9; x++) v.set(x, y, z, Math.floor((x + 9) / 2) % 2 === 0 ? 0xc23028 : 0xe8e2d0);
  }
  for (let x = -8; x <= 8; x += 2) v.set(x, 8, -11, 0xffd27a, true);
  // Poste ng awning
  v.box(-9, 1, -11, -9, 8, -11, WOOD);
  v.box(9, 1, -11, 9, 8, -11, WOOD);
  // Bote at garapon sa counter, at kahon ng paninda sa tabi
  const bottleColors = [0x3aa0d8, 0xd8503a, 0x58c06a, 0xe8c040];
  for (let x = -6; x <= 6; x += 3) v.box(x, 6, -6, x, 8, -6, pick(bottleColors, x, 3, 8));
  v.box(10, 1, -5, 12, 3, -2, 0x6a4524);
  v.box(10, 4, -5, 12, 5, -3, 0x8a5a2b);
  // Ilaw sa loob ng tindahan
  v.box(-1, 11, 0, 1, 11, 0, 0xffe8a0, true);

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
export function tricycleVox() {
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
export function bannerVox(color: number) {
  const v = new Vox();
  // Malapad na tela na nakasabit
  v.box(-3, 0, 0, 3, 12, 0, color);
  // Gintong dulo / tassel sa ibaba
  v.box(-2, -2, 0, 2, 0, 0, 0xf1c40f);
  // Gitnang sagisag
  v.box(-1, 6, 0, 1, 8, 0, 0xf1c40f);
  return v;
}

/** Voxel na palumpong (bilugan); may opsyonal na kulay ng bulaklak (bougainvillea). */
function bushVox(rx: number, ry: number, rz: number, flower?: number) {
  const v = new Vox();
  const GREENS = [0x1f3d1c, 0x285026, 0x1a3418, 0x305c2a, 0x244a21];
  v.ellipsoid(0, ry, 0, rx, ry, rz, (x, y, z) => {
    const h = hash(x + 50, y + 50, z + 50);
    if (flower !== undefined && h % 3 === 0 && y > ry * 0.5) return flower;
    return GREENS[h % GREENS.length]!;
  });
  return v;
}

/** Salansan ng lumang gulong (donut na hugis). */
function tireStackVox(n: number) {
  const v = new Vox();
  for (let k = 0; k < n; k++) {
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const d = Math.hypot(x, z);
        if (d <= 3.3 && d >= 1.3) v.set(x, k, z, k % 2 === 0 ? 0x1c1c20 : 0x26262b);
      }
    }
  }
  return v;
}

/** Kahoy na bangko (nakaharap sa +z). */
function benchVox() {
  const v = new Vox();
  const WOOD = 0x6a4524;
  const DARK = 0x4a2f18;
  v.box(-9, 4, -2, 9, 4, 2, WOOD); // upuan
  v.box(-9, 5, -2, 9, 10, -2, WOOD); // sandalan
  v.box(-9, 7, -2, 9, 7, -2, DARK);
  for (const x of [-8, 8]) v.box(x, 0, -2, x, 3, 2, DARK); // mga paa
  return v;
}

/** Kahong kahoy / plastik. */
function crateVox(color: number) {
  const v = new Vox();
  v.box(-3, 0, -3, 3, 5, 3, color);
  v.box(-3, 2, -3, 3, 2, 3, 0x2a1a0c); // guhit ng tabla
  v.box(-3, 5, -3, 3, 5, -3, 0x2a1a0c);
  return v;
}

/** Poste ng ilaw na may nakasinding parol. */
function lampPostVox() {
  const v = new Vox();
  v.box(0, 0, 0, 0, 22, 0, 0x2e2a28);
  v.box(-1, 22, -1, 1, 22, 1, 0x2e2a28);
  v.box(-1, 23, -1, 1, 25, 1, 0xffd58a, true);
  v.box(-2, 26, -2, 2, 26, 2, 0x2e2a28);
  return v;
}

/** Pusang kalye na nakaupo. */
function catVox() {
  const v = new Vox();
  const FUR = 0x55555e;
  const LIGHT = 0x8a8a94;
  v.box(-1, 0, -2, 1, 3, 1, FUR);
  v.box(-1, 0, 1, 1, 1, 2, LIGHT);
  v.box(-1, 4, 1, 1, 6, 3, FUR);
  v.set(-1, 7, 3, FUR);
  v.set(1, 7, 3, FUR);
  v.set(-1, 5, 4, 0xd8e860, true);
  v.set(1, 5, 4, 0xd8e860, true);
  v.line([[0, 1, -3], [1, 2, -4], [1, 4, -4], [0, 5, -3]], FUR);
  return v;
}

/** Bahay Kubo / Outpost Gazebo para sa mga baluarte ng Barangay Hall */
function gazeboVox() {
  const v = new Vox();
  const WOOD = 0x6a4428;
  const WOOD_DARK = 0x4a2e1a;
  const THATCH = [0x8a5a2e, 0x9a6634, 0x7a4e28];
  // Sahig at plataporma
  for (let x = -7; x <= 7; x++) {
    for (let z = -7; z <= 7; z++) {
      v.set(x, 0, z, (z + 7) % 3 === 0 ? WOOD_DARK : WOOD);
    }
  }
  // 4 na poste
  for (const x of [-6, 6]) {
    for (const z of [-6, 6]) {
      v.box(x, 1, z, x, 9, z, WOOD_DARK);
    }
  }
  // Barandilya sa mga gilid
  for (let i = -5; i <= 5; i++) {
    for (const z of [-6, 6]) v.set(i, 4, z, WOOD);
    for (const x of [-6, 6]) v.set(x, 4, i, WOOD);
    if (i % 2 === 0) {
      for (const z of [-6, 6]) v.box(i, 1, z, i, 3, z, WOOD_DARK);
      for (const x of [-6, 6]) v.box(x, 1, i, x, 3, i, WOOD_DARK);
    }
  }
  // Bubong na pawid (nipa thatch)
  for (let i = 0; i <= 8; i++) {
    const r = 9 - i;
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        const edge = Math.abs(x) === r || Math.abs(z) === r;
        v.set(x, 10 + i, z, i === 0 && edge ? WOOD_DARK : pick(THATCH, x, i, z));
      }
    }
  }
  // Parol / Ilaw sa gitna
  v.box(0, 10, 0, 0, 11, 0, WOOD_DARK);
  v.set(0, 9, 0, 0xffd58a, true);
  return v;
}

/** Texture para sa pader ng Spanish stone fortress / baluarte ng Barangay Hall */
function createFortressStoneTexture() {
  const S2 = 512;
  const rnd = seeded(101);
  return pixelTexture(
    S2,
    S2,
    (g) => {
      // Base mortar
      g.fillStyle = '#222026';
      g.fillRect(0, 0, S2, S2);

      const rowH = 32;
      const stoneColors = ['#444049', '#3a373f', '#4c4852', '#34323a', '#3f3c44', '#514c57'];

      for (let y = 0; y < S2; y += rowH) {
        const rowIdx = Math.floor(y / rowH);
        const xOffset = (rowIdx % 2) * 40;
        let x = -xOffset;
        while (x < S2 + 60) {
          const bw = 50 + Math.floor(rnd() * 35);
          const col = stoneColors[Math.floor(rnd() * stoneColors.length)]!;
          g.fillStyle = col;
          g.fillRect(x + 2, y + 2, bw - 4, rowH - 4);

          // Top & left bevel highlight
          g.fillStyle = 'rgba(255,255,255,0.09)';
          g.fillRect(x + 2, y + 2, bw - 4, 2);
          g.fillRect(x + 2, y + 2, 2, rowH - 4);

          // Bottom & right bevel shadow
          g.fillStyle = 'rgba(0,0,0,0.28)';
          g.fillRect(x + 2, y + rowH - 4, bw - 4, 2);
          g.fillRect(x + bw - 4, y + 2, 2, rowH - 4);

          x += bw;
        }
      }

      // Lumot (moss) sa mga kanto at bitak
      const mossColors = ['#2e4d24', '#3d602e', '#233d1c', '#4a7538'];
      for (let i = 0; i < 400; i++) {
        g.fillStyle = mossColors[Math.floor(rnd() * mossColors.length)]!;
        g.globalAlpha = 0.5 + rnd() * 0.4;
        g.beginPath();
        g.ellipse(rnd() * S2, rnd() * S2, 2 + rnd() * 5, 2 + rnd() * 4, rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;

      // Nakalalaylay na baging at dahon (creeping ivy) mula sa itaas
      for (let vx = 8; vx < S2; vx += 18 + Math.floor(rnd() * 16)) {
        const vineLen = 40 + Math.floor(rnd() * 150);
        let curX = vx;
        for (let vy = 0; vy < vineLen; vy += 3) {
          g.fillStyle = '#213f18';
          g.fillRect(curX - 1, vy, 2, 4);
          if (rnd() < 0.65) {
            const leafSide = rnd() < 0.5 ? -4 : 4;
            g.fillStyle = mossColors[Math.floor(rnd() * mossColors.length)]!;
            g.beginPath();
            g.ellipse(curX + leafSide, vy, 3 + rnd() * 2, 2 + rnd() * 2, rnd() * 2, 0, Math.PI * 2);
            g.fill();
          }
          curX += (rnd() - 0.5) * 3;
        }
      }
    },
    true,
  );
}

/** Texture para sa harapan ng arko ng Barangay Hall na may mga radial voussoirs (keystones) */
function createArchFacadeTexture() {
  const S2 = 512;
  const rnd = seeded(77);
  return pixelTexture(
    S2,
    S2,
    (g) => {
      // Base mortar
      g.fillStyle = '#222026';
      g.fillRect(0, 0, S2, S2);

      const rowH = 26;
      const stoneColors = ['#444049', '#3a373f', '#4c4852', '#34323a', '#3f3c44'];
      for (let y = 0; y < S2; y += rowH) {
        const rowIdx = Math.floor(y / rowH);
        const xOffset = (rowIdx % 2) * 35;
        let x = -xOffset;
        while (x < S2 + 50) {
          const bw = 45 + Math.floor(rnd() * 35);
          g.fillStyle = stoneColors[Math.floor(rnd() * stoneColors.length)]!;
          g.fillRect(x + 2, y + 2, bw - 4, rowH - 4);
          g.fillStyle = 'rgba(255,255,255,0.08)';
          g.fillRect(x + 2, y + 2, bw - 4, 2);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(x + 2, y + rowH - 4, bw - 4, 2);
          x += bw;
        }
      }

      // Radial voussoirs (mga batong kurbada sa paligid ng arko)
      const cx = S2 / 2;
      const springY = S2 - 210;
      const archR = 148;
      const ringW = 34;
      const numStones = 21;

      for (let i = 0; i < numStones; i++) {
        const a1 = Math.PI * (i / numStones);
        const a2 = Math.PI * ((i + 1) / numStones);
        const isKeystone = i === Math.floor(numStones / 2);

        g.fillStyle = isKeystone ? '#5e5966' : i % 2 === 0 ? '#4c4752' : '#413c47';
        g.strokeStyle = '#1d1b20';
        g.lineWidth = 2.5;

        g.beginPath();
        g.arc(cx, springY, archR + (isKeystone ? ringW + 8 : ringW), a1, a2);
        g.arc(cx, springY, archR, a2, a1, true);
        g.closePath();
        g.fill();
        g.stroke();
      }

      // Mga haligi / jambs sa gilid ng arko
      for (let y = springY; y < S2; y += 28) {
        for (const sx of [cx - archR - ringW, cx + archR]) {
          g.fillStyle = '#4a4650';
          g.strokeStyle = '#1d1b20';
          g.lineWidth = 2;
          g.fillRect(sx, y, ringW, 26);
          g.strokeRect(sx, y, ringW, 26);
        }
      }

      // Baging sa mga bato
      const mossColors = ['#2e4d24', '#3d602e', '#4a7538'];
      for (let i = 0; i < 200; i++) {
        g.fillStyle = mossColors[Math.floor(rnd() * mossColors.length)]!;
        g.beginPath();
        g.ellipse(rnd() * S2, rnd() * springY, 2 + rnd() * 4, 2 + rnd() * 3, rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }

      // Gupitin ang butas ng arko (transparent para makita ang 3D tunnel at halimaw)
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.arc(cx, springY, archR - 1, Math.PI, 0);
      g.rect(cx - archR + 1, springY, (archR - 1) * 2, S2 - springY + 2);
      g.fill();
      g.globalCompositeOperation = 'source-over';
    },
    true,
  );
}

/** Karatula ng "BARANGAY HALL" (asul na plaque na may gintong border at letrang puti) */
function createBarangayHallSignTexture() {
  const W = 512;
  const H = 140;
  return pixelTexture(
    W,
    H,
    (g) => {
      // Arched blue plaque
      g.fillStyle = '#101d36';
      g.strokeStyle = '#d49b14';
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect(10, 10, W - 20, H - 20, 22);
      g.fill();
      g.stroke();

      // Inner gold border
      g.strokeStyle = '#f5c430';
      g.lineWidth = 2.5;
      g.beginPath();
      g.roundRect(18, 18, W - 36, H - 36, 16);
      g.stroke();

      // Brass corner rivets
      const rivets: [number, number][] = [
        [28, 28],
        [W - 28, 28],
        [28, H - 28],
        [W - 28, H - 28],
      ];
      for (const [rx, ry] of rivets) {
        if (rx === undefined || ry === undefined) continue;
        g.fillStyle = '#ffd54f';
        g.beginPath();
        g.arc(rx, ry, 4.5, 0, Math.PI * 2);
        g.fill();
      }

      // "BARANGAY HALL" Text
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = 'bold 50px Impact, "Arial Black", sans-serif';

      // Drop shadow
      g.fillStyle = '#080d18';
      g.fillText('BARANGAY HALL', W / 2 + 2, H / 2 + 3);

      // Gold outline / glow
      g.fillStyle = '#f5c430';
      for (const ox of [-1, 0, 1]) {
        for (const oy of [-1, 0, 1]) {
          g.fillText('BARANGAY HALL', W / 2 + ox, H / 2 + oy);
        }
      }

      // Crisp white text
      g.fillStyle = '#ffffff';
      g.fillText('BARANGAY HALL', W / 2, H / 2);
    },
    true,
  );
}

/** 2nd Floor Municipal Hall Facade na may 3 colonial arched windows na may mainit na ilaw sa loob */
function createBarangayHallUpperTexture() {
  const W = 512;
  const H = 256;
  const rnd = seeded(99);
  return pixelTexture(
    W,
    H,
    (g) => {
      // Base stone wall
      g.fillStyle = '#222026';
      g.fillRect(0, 0, W, H);

      const rowH = 22;
      const stoneColors = ['#444049', '#3a373f', '#4c4852', '#34323a', '#3f3c44'];
      for (let y = 0; y < H; y += rowH) {
        const rowIdx = Math.floor(y / rowH);
        const xOffset = (rowIdx % 2) * 35;
        let x = -xOffset;
        while (x < W + 50) {
          const bw = 45 + Math.floor(rnd() * 35);
          g.fillStyle = stoneColors[Math.floor(rnd() * stoneColors.length)]!;
          g.fillRect(x + 2, y + 2, bw - 4, rowH - 4);
          g.fillStyle = 'rgba(255,255,255,0.08)';
          g.fillRect(x + 2, y + 2, bw - 4, 2);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(x + 2, y + rowH - 4, bw - 4, 2);
          x += bw;
        }
      }

      // 3 Arched Windows na may mainit na ilaw
      const winCenters = [W / 4, W / 2, (3 * W) / 4];
      const winW = 56;
      const winH = 92;
      const winTop = 72;

      for (const cx of winCenters) {
        // Stone frame
        g.fillStyle = '#1e1c22';
        g.beginPath();
        g.roundRect(cx - winW / 2 - 5, winTop - 5, winW + 10, winH + 10, 28);
        g.fill();

        // Glowing glass
        g.fillStyle = '#ffaa36';
        g.beginPath();
        g.roundRect(cx - winW / 2, winTop, winW, winH, 24);
        g.fill();

        // Inner warm highlight
        g.fillStyle = '#ffd269';
        g.beginPath();
        g.roundRect(cx - winW / 2 + 6, winTop + 6, winW - 12, winH - 12, 18);
        g.fill();

        // Dark window muntins / rehas
        g.fillStyle = '#221612';
        g.fillRect(cx - 2, winTop, 4, winH);
        g.fillRect(cx - winW / 2, winTop + winH / 2 - 2, winW, 4);

        // Stone window sill
        g.fillStyle = '#56505c';
        g.fillRect(cx - winW / 2 - 10, winTop + winH + 2, winW + 20, 8);
      }

      // Baging at dahon mula sa itaas
      const mossColors = ['#2e4d24', '#3d602e', '#4a7538'];
      for (let vx = 10; vx < W; vx += 20 + Math.floor(rnd() * 15)) {
        const vLen = 30 + Math.floor(rnd() * 90);
        let curX = vx;
        for (let vy = 0; vy < vLen; vy += 3) {
          g.fillStyle = '#213f18';
          g.fillRect(curX - 1, vy, 2, 4);
          if (rnd() < 0.65) {
            const leafSide = rnd() < 0.5 ? -4 : 4;
            g.fillStyle = mossColors[Math.floor(rnd() * mossColors.length)]!;
            g.beginPath();
            g.ellipse(curX + leafSide, vy, 3, 2, 0, 0, Math.PI * 2);
            g.fill();
          }
          curX += (rnd() - 0.5) * 3;
        }
      }
    },
    true,
  );
}

/** Bandilang nakasabit sa pader ng baluarte (Bayani / Halimaw) */
function createBannerTexture(isBayani: boolean) {
  const W = 256;
  const H = 512;
  return pixelTexture(
    W,
    H,
    (g) => {
      const baseColor = isBayani ? '#144ba0' : '#9e1818';
      const darkColor = isBayani ? '#0d326e' : '#6e1010';

      // Tela
      g.fillStyle = baseColor;
      g.fillRect(16, 16, W - 32, H - 64);

      // Shading sa gilid
      g.fillStyle = darkColor;
      g.fillRect(16, 16, 12, H - 64);
      g.fillRect(W - 28, 16, 12, H - 64);

      // Gintong border
      g.strokeStyle = '#f5c430';
      g.lineWidth = 4;
      g.strokeRect(20, 20, W - 40, H - 72);
      g.strokeStyle = '#c49418';
      g.lineWidth = 2;
      g.strokeRect(26, 26, W - 52, H - 84);

      // 3-Tower Fortress / Castle emblem sa gitna
      const cx = W / 2;
      const cy = H / 2 - 25;
      g.fillStyle = '#f5c430';

      // Castle base
      g.fillRect(cx - 48, cy - 20, 96, 60);
      // 3 Towers
      for (const tx of [cx - 48, cx - 14, cx + 22]) {
        g.fillRect(tx, cy - 44, 26, 24);
      }
      // Pinto at bintana
      g.fillStyle = darkColor;
      g.fillRect(cx - 12, cy + 12, 24, 28);
      g.fillRect(cx - 36, cy - 8, 14, 16);
      g.fillRect(cx + 22, cy - 8, 14, 16);

      // Gintong fringed tassels sa ibaba
      for (let x = 18; x < W - 18; x += 8) {
        g.fillStyle = '#f5c430';
        g.fillRect(x, H - 48, 5, 30);
        g.fillStyle = '#c49418';
        g.beginPath();
        g.arc(x + 2.5, H - 18, 3, 0, Math.PI * 2);
        g.fill();
      }
    },
    true,
  );
}
