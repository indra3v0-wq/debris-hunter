/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RocketConfig } from '../types';
import { createRocketDecalTexture, createGoldMliTexture } from './proceduralTextures';

export interface RocketModelBundle {
  group: THREE.Group;
  parts: {
    stage1Group: THREE.Group;
    stage2Group: THREE.Group;
    engineCluster: THREE.Group;
    tankMesh: THREE.Mesh;
    sideBoosters: THREE.Group[];
    interstage: THREE.Mesh;
    fairingLeft: THREE.Mesh;
    fairingRight: THREE.Mesh;
    gridFins: THREE.Mesh[];
  };
  setExplodedProgress: (progress: number) => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}

export function buildModularRocket(config: RocketConfig): RocketModelBundle {
  const root = new THREE.Group();
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];
  const texturesToDispose: THREE.Texture[] = [];

  const whiteHullMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.75,
  });
  materialsToDispose.push(whiteHullMat);

  const blackCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
    metalness: 0.7,
  });
  materialsToDispose.push(blackCarbonMat);

  const engineNozzleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.9,
  });
  materialsToDispose.push(engineNozzleMat);

  const vacNozzleMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    roughness: 0.3,
    metalness: 0.9,
    emissive: 0x450a0a,
  });
  materialsToDispose.push(vacNozzleMat);

  const goldMliTex = createGoldMliTexture();
  texturesToDispose.push(goldMliTex);
  const goldMliMat = new THREE.MeshStandardMaterial({
    map: goldMliTex,
    color: 0xffd700,
    metalness: 0.85,
    roughness: 0.25,
  });
  materialsToDispose.push(goldMliMat);

  // ================= 1. STAGE 1 (MAIN BOOSTER CORE) =================
  const stage1Group = new THREE.Group();
  root.add(stage1Group);

  const tankRadius = config.tank.diameterM * 0.24;
  const tankHeight = 6.8;

  // Main propellant tank cylinder
  const tankGeo = new THREE.CylinderGeometry(tankRadius, tankRadius, tankHeight, 32);
  geometriesToDispose.push(tankGeo);
  const tankMesh = new THREE.Mesh(tankGeo, whiteHullMat);
  tankMesh.position.y = tankHeight / 2;
  stage1Group.add(tankMesh);

  // Decal on booster hull (Mongolian Flag + QUASAR)
  const decalTex = createRocketDecalTexture();
  texturesToDispose.push(decalTex);
  const decalMat = new THREE.MeshBasicMaterial({ map: decalTex, transparent: true });
  materialsToDispose.push(decalMat);
  const decalGeo = new THREE.PlaneGeometry(tankRadius * 1.5, tankRadius * 2.5);
  geometriesToDispose.push(decalGeo);
  const decalMesh = new THREE.Mesh(decalGeo, decalMat);
  decalMesh.position.set(0, 4.2, tankRadius + 0.02);
  stage1Group.add(decalMesh);

  // Engine Octoweb Mount at base
  const engineCluster = new THREE.Group();
  engineCluster.position.y = 0;
  stage1Group.add(engineCluster);

  const engineMountGeo = new THREE.CylinderGeometry(tankRadius, tankRadius * 0.94, 0.45, 24);
  geometriesToDispose.push(engineMountGeo);
  const engineMount = new THREE.Mesh(engineMountGeo, blackCarbonMat);
  engineMount.position.y = 0.2;
  engineCluster.add(engineMount);

  const engineCount = config.engine.type === 'kerolox' ? 9 : config.engine.type === 'methalox' ? 7 : 1;
  const nozzleRadius = config.engine.type === 'solid' ? 0.45 : 0.18;

  for (let i = 0; i < engineCount; i++) {
    const nozzleGeo = new THREE.ConeGeometry(nozzleRadius, 0.65, 16, 1, true);
    geometriesToDispose.push(nozzleGeo);
    const nozzle = new THREE.Mesh(nozzleGeo, engineNozzleMat);
    nozzle.rotation.x = Math.PI;

    if (i === 0) {
      nozzle.position.set(0, -0.2, 0);
    } else {
      const angle = (i / (engineCount - 1)) * Math.PI * 2;
      const r = tankRadius * 0.55;
      nozzle.position.set(Math.cos(angle) * r, -0.2, Math.sin(angle) * r);
    }
    engineCluster.add(nozzle);
  }

  // Titanium Grid Fins (4 units at top of Stage 1)
  const gridFins: THREE.Mesh[] = [];
  if (config.hasInterstageGridFins) {
    for (let f = 0; f < 4; f++) {
      const finGeo = new THREE.BoxGeometry(0.35, 0.45, 0.04);
      geometriesToDispose.push(finGeo);
      const fin = new THREE.Mesh(finGeo, blackCarbonMat);
      const angle = (f / 4) * Math.PI * 2;
      fin.position.set(
        Math.cos(angle) * (tankRadius + 0.15),
        tankHeight - 0.4,
        Math.sin(angle) * (tankRadius + 0.15)
      );
      fin.rotation.y = angle;
      stage1Group.add(fin);
      gridFins.push(fin);
    }
  }

  // Side Strap-on Boosters (0, 2, or 4 boosters)
  const sideBoosters: THREE.Group[] = [];
  if (config.boosterCount > 0) {
    for (let b = 0; b < config.boosterCount; b++) {
      const boosterGroup = new THREE.Group();
      const angle = (b / config.boosterCount) * Math.PI * 2 + (config.boosterCount === 2 ? Math.PI / 2 : 0);
      const dist = tankRadius + 0.55;
      boosterGroup.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

      // Booster cylinder body
      const sGeo = new THREE.CylinderGeometry(0.38, 0.38, 5.2, 24);
      geometriesToDispose.push(sGeo);
      const sMesh = new THREE.Mesh(sGeo, whiteHullMat);
      sMesh.position.y = 2.6;
      boosterGroup.add(sMesh);

      // Aerodynamic slant nosecone
      const coneGeo = new THREE.ConeGeometry(0.38, 0.85, 24);
      geometriesToDispose.push(coneGeo);
      const coneMesh = new THREE.Mesh(coneGeo, blackCarbonMat);
      coneMesh.position.y = 5.2 + 0.42;
      boosterGroup.add(coneMesh);

      // Booster exhaust nozzle
      const sNozGeo = new THREE.ConeGeometry(0.24, 0.55, 16, 1, true);
      geometriesToDispose.push(sNozGeo);
      const sNoz = new THREE.Mesh(sNozGeo, engineNozzleMat);
      sNoz.rotation.x = Math.PI;
      sNoz.position.y = -0.2;
      boosterGroup.add(sNoz);

      stage1Group.add(boosterGroup);
      sideBoosters.push(boosterGroup);
    }
  }

  // ================= 2. INTERSTAGE & STAGE 2 (UPPER STAGE) =================
  const stage2Group = new THREE.Group();
  stage2Group.position.y = tankHeight;
  root.add(stage2Group);

  // Carbon interstage separation ring
  const interstageGeo = new THREE.CylinderGeometry(tankRadius * 1.01, tankRadius * 1.01, 0.75, 32);
  geometriesToDispose.push(interstageGeo);
  const interstage = new THREE.Mesh(interstageGeo, blackCarbonMat);
  interstage.position.y = 0.38;
  stage2Group.add(interstage);

  // Stage 2 fuel tank
  const s2Height = 2.4;
  const s2Geo = new THREE.CylinderGeometry(tankRadius, tankRadius, s2Height, 32);
  geometriesToDispose.push(s2Geo);
  const s2Mesh = new THREE.Mesh(s2Geo, whiteHullMat);
  s2Mesh.position.y = s2Height / 2 + 0.75;
  stage2Group.add(s2Mesh);

  // Stage 2 Vacuum Engine Nozzle (Inside interstage)
  const vacNozGeo = new THREE.ConeGeometry(0.38, 0.8, 20, 1, true);
  geometriesToDispose.push(vacNozGeo);
  const vacNoz = new THREE.Mesh(vacNozGeo, vacNozzleMat);
  vacNoz.rotation.x = Math.PI;
  vacNoz.position.y = 0.4;
  stage2Group.add(vacNoz);

  // ================= 3. PAYLOAD FAIRING & ENCAPSULATED SPACECRAFT =================
  const fairingGroup = new THREE.Group();
  fairingGroup.position.y = s2Height + 0.75;
  stage2Group.add(fairingGroup);

  // Mini Satellite inside fairing
  const satGeo = new THREE.BoxGeometry(0.65, 0.95, 0.65);
  geometriesToDispose.push(satGeo);
  const satMesh = new THREE.Mesh(satGeo, goldMliMat);
  satMesh.position.y = 0.75;
  fairingGroup.add(satMesh);

  // Fairing Shell Left Half
  const fairingRad = config.fairing.diameterM * 0.22;
  const fairingHeight = config.fairing.heightM * 0.24;
  const fairingGeo = new THREE.ConeGeometry(fairingRad, fairingHeight, 32, 1, false, 0, Math.PI);
  geometriesToDispose.push(fairingGeo);

  const fairingLeft = new THREE.Mesh(fairingGeo, whiteHullMat);
  fairingLeft.position.set(0, fairingHeight / 2, 0);
  fairingGroup.add(fairingLeft);

  // Fairing Shell Right Half
  const fairingRight = new THREE.Mesh(fairingGeo, whiteHullMat);
  fairingRight.position.set(0, fairingHeight / 2, 0);
  fairingRight.rotation.y = Math.PI;
  fairingGroup.add(fairingRight);

  // ================= 4. EXPLODED ASSEMBLY VIEW LOGIC =================
  const setExplodedProgress = (progress: number) => {
    // progress: 0 to 1
    // Stage 1 drops down
    stage1Group.position.y = -progress * 1.8;

    // Stage 2 lifts up
    stage2Group.position.y = tankHeight + progress * 2.2;

    // Fairing halves open laterally outward
    fairingLeft.position.x = -progress * 2.4;
    fairingRight.position.x = progress * 2.4;

    // Side boosters push outward
    sideBoosters.forEach((b, idx) => {
      const angle = (idx / sideBoosters.length) * Math.PI * 2;
      const baseDist = tankRadius + 0.55;
      const newDist = baseDist + progress * 1.5;
      b.position.set(Math.cos(angle) * newDist, 0, Math.sin(angle) * newDist);
    });
  };

  const update = (deltaSeconds: number) => {
    // Idle effects
  };

  const dispose = () => {
    geometriesToDispose.forEach(g => g.dispose());
    materialsToDispose.forEach(m => m.dispose());
    texturesToDispose.forEach(t => t.dispose());
  };

  return {
    group: root,
    parts: {
      stage1Group,
      stage2Group,
      engineCluster,
      tankMesh,
      sideBoosters,
      interstage,
      fairingLeft,
      fairingRight,
      gridFins,
    },
    setExplodedProgress,
    update,
    dispose,
  };
}
