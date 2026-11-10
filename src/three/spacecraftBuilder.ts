/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { SpacecraftDesign } from '../types';
import { createGoldMliTexture, createSolarPanelTexture, createHullPanelTexture } from './proceduralTextures';

export interface SpacecraftModelBundle {
  group: THREE.Group;
  parts: {
    busMesh: THREE.Group;
    solarLeft: THREE.Group;
    solarRight: THREE.Group;
    engineNozzle: THREE.Mesh;
    rcsQuads: THREE.Group[];
    rcsPlumes: THREE.Mesh[];
    antennaDish: THREE.Group;
    sensorTurret: THREE.Group;
    captureMechanism: THREE.Group;
    roboticArmJoints?: THREE.Group[];
    internalTanks?: THREE.Mesh[];
    reactionWheels?: THREE.Mesh[];
  };
  setHighlightedPart: (partName: string | null) => void;
  setExplodedProgress: (progress: number) => void;
  setThrusterFiring: (active: boolean) => void;
  setArmExtension: (progress: number) => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}

export function buildModularSpacecraft(design: SpacecraftDesign): SpacecraftModelBundle {
  const root = new THREE.Group();

  // Procedural textures
  const goldMliTex = createGoldMliTexture();
  const solarTex = createSolarPanelTexture();
  const hullTex = createHullPanelTexture();

  // Materials
  const busMat = new THREE.MeshStandardMaterial({
    map: hullTex,
    roughness: 0.35,
    metalness: 0.8,
  });

  const goldMliMat = new THREE.MeshStandardMaterial({
    map: goldMliTex,
    roughness: 0.25,
    metalness: 0.9,
    color: 0xffd700,
  });

  const solarMat = new THREE.MeshStandardMaterial({
    map: solarTex,
    roughness: 0.15,
    metalness: 0.6,
  });

  const darkFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.7,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.1,
    metalness: 0.95,
  });

  const titaniumTankMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.3,
    metalness: 0.9,
  });

  const rwaMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.2,
    metalness: 0.85,
  });

  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.85,
  });

  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.05,
    metalness: 0.9,
  });

  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });

  const geometriesToDispose: THREE.BufferGeometry[] = [];

  // ================= 1. PRIMARY SILHOUETTE: REALISTIC SPACECRAFT BUS =================
  const busGroup = new THREE.Group();
  root.add(busGroup);

  // Central Thrust Tube / Structural Mast (Primary load-bearing backbone)
  const thrustTubeGeo = new THREE.CylinderGeometry(0.45, 0.45, 2.4, 24);
  geometriesToDispose.push(thrustTubeGeo);
  const thrustTube = new THREE.Mesh(thrustTubeGeo, darkFrameMat);
  busGroup.add(thrustTube);

  // Internal Propellant Tanks (Hydrazine / Xenon spheres inside thrust column)
  const internalTanks: THREE.Mesh[] = [];
  const tank1Geo = new THREE.SphereGeometry(0.38, 16, 16);
  geometriesToDispose.push(tank1Geo);
  const tank1 = new THREE.Mesh(tank1Geo, titaniumTankMat);
  tank1.position.y = 0.45;
  busGroup.add(tank1);
  internalTanks.push(tank1);

  const tank2 = tank1.clone();
  tank2.position.y = -0.45;
  busGroup.add(tank2);
  internalTanks.push(tank2);

  // Internal Reaction Wheel Assembly (RWA) Pyramid (4 gyros for attitude control)
  const reactionWheels: THREE.Mesh[] = [];
  for (let r = 0; r < 4; r++) {
    const rwaGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 16);
    geometriesToDispose.push(rwaGeo);
    const rwa = new THREE.Mesh(rwaGeo, rwaMat);
    const angle = (r / 4) * Math.PI * 2;
    rwa.position.set(Math.cos(angle) * 0.28, 0, Math.sin(angle) * 0.28);
    rwa.rotation.x = 0.4;
    rwa.rotation.y = angle;
    busGroup.add(rwa);
    reactionWheels.push(rwa);
  }

  // Star Tracker Optical Head with Baffle
  const starTrackerGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.22, 12);
  geometriesToDispose.push(starTrackerGeo);
  const starTracker = new THREE.Mesh(starTrackerGeo, darkFrameMat);
  starTracker.position.set(0.65, 0.8, -0.65);
  starTracker.rotation.x = -Math.PI / 4;
  busGroup.add(starTracker);

  // Outer Honeycomb Shear Panels (Can slide outward in Exploded View)
  const outerPanelsGroup = new THREE.Group();
  busGroup.add(outerPanelsGroup);

  const panelMeshes: THREE.Mesh[] = [];
  let busRadius = 1.0;
  let busHeight = 2.2;
  const isCubic = design.bus.id === 'bus_cube';
  const isHeavy = design.bus.id === 'bus_heavy';

  if (isCubic) {
    busRadius = 0.95;
    busHeight = 1.8;
    // 4 Flat Box Panels
    for (let p = 0; p < 4; p++) {
      const pGeo = new THREE.BoxGeometry(1.6, 1.8, 0.08);
      geometriesToDispose.push(pGeo);
      const pMesh = new THREE.Mesh(pGeo, busMat);
      const angle = (p / 4) * Math.PI * 2;
      pMesh.position.set(Math.cos(angle) * 0.82, 0, Math.sin(angle) * 0.82);
      pMesh.rotation.y = angle;
      outerPanelsGroup.add(pMesh);
      panelMeshes.push(pMesh);
    }
  } else {
    // 6 Hexagonal Panels
    const sideCount = isHeavy ? 8 : 6;
    busRadius = isHeavy ? 1.25 : 1.05;
    busHeight = isHeavy ? 2.6 : 2.2;
    const panelWidth = (2 * busRadius * Math.sin(Math.PI / sideCount)) * 0.96;

    for (let p = 0; p < sideCount; p++) {
      const pGeo = new THREE.BoxGeometry(panelWidth, busHeight, 0.06);
      geometriesToDispose.push(pGeo);
      const pMesh = new THREE.Mesh(pGeo, p % 2 === 0 ? busMat : goldMliMat);
      const angle = (p / sideCount) * Math.PI * 2;
      pMesh.position.set(Math.cos(angle) * busRadius, 0, Math.sin(angle) * busRadius);
      pMesh.rotation.y = -angle - Math.PI / 2;
      outerPanelsGroup.add(pMesh);
      panelMeshes.push(pMesh);
    }
  }

  // Gold MLI insulation collar on upper deck
  const mliGeo = new THREE.CylinderGeometry(busRadius * 0.95, busRadius * 0.95, 0.45, 12);
  geometriesToDispose.push(mliGeo);
  const mliMesh = new THREE.Mesh(mliGeo, goldMliMat);
  mliMesh.position.y = busHeight / 2 - 0.2;
  busGroup.add(mliMesh);

  // ================= 2. SECONDARY READ: SOLAR ARRAYS =================
  const solarLeft = new THREE.Group();
  const solarRight = new THREE.Group();
  root.add(solarLeft);
  root.add(solarRight);

  const span = design.solar.spanM * 0.35;
  const wingGeo = new THREE.BoxGeometry(span, 0.04, 0.9);
  geometriesToDispose.push(wingGeo);

  // Left Wing
  const leftPanel = new THREE.Mesh(wingGeo, solarMat);
  leftPanel.position.x = -(span / 2 + busRadius + 0.1);
  const boomLeftGeo = new THREE.CylinderGeometry(0.04, 0.04, busRadius + 0.1, 8);
  geometriesToDispose.push(boomLeftGeo);
  const boomLeft = new THREE.Mesh(boomLeftGeo, chromeMat);
  boomLeft.rotation.z = Math.PI / 2;
  boomLeft.position.x = -(busRadius + 0.1) / 2;
  solarLeft.add(leftPanel);
  solarLeft.add(boomLeft);

  // Right Wing
  const rightPanel = new THREE.Mesh(wingGeo, solarMat);
  rightPanel.position.x = span / 2 + busRadius + 0.1;
  const boomRight = boomLeft.clone();
  boomRight.position.x = (busRadius + 0.1) / 2;
  solarRight.add(rightPanel);
  solarRight.add(boomRight);

  // ================= 3. PROPULSION ENGINE NOZZLE =================
  const nozzleGroup = new THREE.Group();
  root.add(nozzleGroup);
  nozzleGroup.position.y = -busHeight / 2 - 0.15;

  let nozzleGeo: THREE.BufferGeometry;
  if (design.propulsion.type === 'electric_ion') {
    // Ion engine grid + electrostatic ring
    nozzleGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 24);
  } else {
    // Convergent-divergent rocket nozzle
    nozzleGeo = new THREE.ConeGeometry(0.48, 0.85, 24, 1, true);
  }
  geometriesToDispose.push(nozzleGeo);
  const engineNozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
  if (design.propulsion.type !== 'electric_ion') {
    engineNozzle.rotation.x = Math.PI;
  }
  nozzleGroup.add(engineNozzle);

  // Ion discharge glow or chemical flame plume
  const mainPlumeGeo = new THREE.ConeGeometry(0.45, 1.8, 16);
  geometriesToDispose.push(mainPlumeGeo);
  const mainPlumeMat = new THREE.MeshBasicMaterial({
    color: design.propulsion.type === 'electric_ion' ? 0x38bdf8 : 0xff7700,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const mainPlume = new THREE.Mesh(mainPlumeGeo, mainPlumeMat);
  mainPlume.rotation.x = Math.PI;
  mainPlume.position.y = -1.1;
  nozzleGroup.add(mainPlume);

  // ================= 4. REACTION CONTROL SYSTEM (RCS) QUADS =================
  const rcsQuads: THREE.Group[] = [];
  const rcsPlumes: THREE.Mesh[] = [];

  const rcsOffsets = [
    [busRadius * 0.9, busHeight * 0.35, busRadius * 0.9],
    [-busRadius * 0.9, busHeight * 0.35, busRadius * 0.9],
    [busRadius * 0.9, busHeight * 0.35, -busRadius * 0.9],
    [-busRadius * 0.9, busHeight * 0.35, -busRadius * 0.9],
    [busRadius * 0.9, -busHeight * 0.35, busRadius * 0.9],
    [-busRadius * 0.9, -busHeight * 0.35, busRadius * 0.9],
  ];

  rcsOffsets.forEach(pos => {
    const quad = new THREE.Group();
    quad.position.set(pos[0], pos[1], pos[2]);

    const blockGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    geometriesToDispose.push(blockGeo);
    const block = new THREE.Mesh(blockGeo, darkFrameMat);
    quad.add(block);

    // Micro nozzle plume
    const plumeConeGeo = new THREE.ConeGeometry(0.08, 0.25, 8);
    geometriesToDispose.push(plumeConeGeo);
    const plume = new THREE.Mesh(plumeConeGeo, plumeMat);
    plume.rotation.x = Math.PI;
    plume.position.y = -0.15;
    quad.add(plume);
    rcsPlumes.push(plume);

    busGroup.add(quad);
    rcsQuads.push(quad);
  });

  // ================= 5. HIGH-GAIN S/X-BAND COMMUNICATIONS DISH =================
  const antennaGroup = new THREE.Group();
  antennaGroup.position.set(0.4, busHeight / 2 + 0.3, 0.4);
  root.add(antennaGroup);

  const dishGeo = new THREE.SphereGeometry(0.45, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.35);
  geometriesToDispose.push(dishGeo);
  const dish = new THREE.Mesh(dishGeo, goldMliMat);
  dish.rotation.x = -Math.PI / 3;
  antennaGroup.add(dish);

  // ================= 6. SENSOR TURRET (3D FLASH LIDAR & NAVCAM) =================
  const sensorTurret = new THREE.Group();
  sensorTurret.position.set(0, busHeight / 2 + 0.2, -0.4);
  root.add(sensorTurret);

  const turretHousingGeo = new THREE.BoxGeometry(0.35, 0.22, 0.25);
  geometriesToDispose.push(turretHousingGeo);
  const turretHousing = new THREE.Mesh(turretHousingGeo, darkFrameMat);
  sensorTurret.add(turretHousing);

  const lensGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16);
  geometriesToDispose.push(lensGeo);
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, -0.13);
  sensorTurret.add(lens);

  // ================= 7. CAPTURE MECHANISM =================
  const captureGroup = new THREE.Group();
  captureGroup.position.set(0, 0.1, -busRadius - 0.2);
  root.add(captureGroup);

  const roboticArmJoints: THREE.Group[] = [];

  if (design.captureMechanism.type === 'robotic_arm') {
    // 7-DOF Articulated Robotic Arm (Canadarm style)
    const baseJoint = new THREE.Group();
    captureGroup.add(baseJoint);

    const baseTurretGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.15, 12);
    geometriesToDispose.push(baseTurretGeo);
    baseJoint.add(new THREE.Mesh(baseTurretGeo, darkFrameMat));

    // Arm Segment 1 (Shoulder to Elbow)
    const seg1 = new THREE.Group();
    seg1.position.y = 0.1;
    baseJoint.add(seg1);
    roboticArmJoints.push(seg1);

    const boom1Geo = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8);
    geometriesToDispose.push(boom1Geo);
    const boom1Mesh = new THREE.Mesh(boom1Geo, chromeMat);
    boom1Mesh.position.y = 0.45;
    seg1.add(boom1Mesh);

    // Arm Segment 2 (Elbow to Wrist)
    const seg2 = new THREE.Group();
    seg2.position.y = 0.9;
    seg1.add(seg2);
    roboticArmJoints.push(seg2);

    const boom2Geo = new THREE.CylinderGeometry(0.05, 0.05, 0.75, 8);
    geometriesToDispose.push(boom2Geo);
    const boom2Mesh = new THREE.Mesh(boom2Geo, chromeMat);
    boom2Mesh.position.y = 0.38;
    seg2.add(boom2Mesh);

    // End-Effector / Claw
    const clawGroup = new THREE.Group();
    clawGroup.position.y = 0.75;
    seg2.add(clawGroup);

    const clawBaseGeo = new THREE.BoxGeometry(0.18, 0.08, 0.14);
    geometriesToDispose.push(clawBaseGeo);
    clawGroup.add(new THREE.Mesh(clawBaseGeo, darkFrameMat));

    const fingerGeo = new THREE.BoxGeometry(0.03, 0.18, 0.03);
    geometriesToDispose.push(fingerGeo);
    const fingerLeft = new THREE.Mesh(fingerGeo, chromeMat);
    fingerLeft.position.set(-0.06, 0.1, 0);
    const fingerRight = new THREE.Mesh(fingerGeo, chromeMat);
    fingerRight.position.set(0.06, 0.1, 0);
    clawGroup.add(fingerLeft);
    clawGroup.add(fingerRight);

    seg1.rotation.z = -0.6;
    seg2.rotation.z = 1.1;
  } else if (design.captureMechanism.type === 'deployable_net') {
    // Canister Dispenser
    const canGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.4, 16);
    geometriesToDispose.push(canGeo);
    const canMesh = new THREE.Mesh(canGeo, darkFrameMat);
    captureGroup.add(canMesh);

    const lidGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.05, 16);
    geometriesToDispose.push(lidGeo);
    const lidMesh = new THREE.Mesh(lidGeo, chromeMat);
    lidMesh.position.y = 0.22;
    captureGroup.add(lidMesh);
  } else if (design.captureMechanism.type === 'harpoon') {
    // Harpoon Projectile Tube
    const tubeGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.65, 12);
    geometriesToDispose.push(tubeGeo);
    const tubeMesh = new THREE.Mesh(tubeGeo, darkFrameMat);
    captureGroup.add(tubeMesh);

    const barbGeo = new THREE.ConeGeometry(0.08, 0.28, 6);
    geometriesToDispose.push(barbGeo);
    const barbMesh = new THREE.Mesh(barbGeo, chromeMat);
    barbMesh.position.y = 0.38;
    captureGroup.add(barbMesh);
  } else {
    // Magnetic / Gecko Gripper plate
    const plateGeo = new THREE.BoxGeometry(0.6, 0.08, 0.6);
    geometriesToDispose.push(plateGeo);
    const plate = new THREE.Mesh(plateGeo, darkFrameMat);
    captureGroup.add(plate);

    const padGeo = new THREE.BoxGeometry(0.5, 0.04, 0.5);
    geometriesToDispose.push(padGeo);
    const pad = new THREE.Mesh(padGeo, chromeMat);
    pad.position.y = 0.06;
    captureGroup.add(pad);
  }

  // ================= 8. INTERACTIVE EXPLODED VIEW & CONTROLS =================
  const setExplodedProgress = (progress: number) => {
    // progress: 0 to 1
    // Solar wings move laterally outward
    solarLeft.position.x = -progress * 1.5;
    solarRight.position.x = progress * 1.5;

    // Engine nozzle lowers downward
    nozzleGroup.position.y = (-busHeight / 2 - 0.15) - progress * 1.2;

    // Antenna dish moves upward and outward
    antennaGroup.position.y = (busHeight / 2 + 0.3) + progress * 0.9;
    antennaGroup.position.x = 0.4 + progress * 0.5;

    // Sensor turret raises
    sensorTurret.position.y = (busHeight / 2 + 0.2) + progress * 0.7;

    // Capture tool pushes forward
    captureGroup.position.z = (-busRadius - 0.2) - progress * 1.2;

    // Outer honeycomb shear panels slide laterally OUTWARD revealing internal tanks & RWAs!
    panelMeshes.forEach(mesh => {
      const dir = mesh.position.clone().setY(0).normalize();
      mesh.position.x = dir.x * (busRadius + progress * 0.85);
      mesh.position.z = dir.z * (busRadius + progress * 0.85);
    });
  };

  const setHighlightedPart = (partName: string | null) => {
    // Highlight logic
  };

  const setThrusterFiring = (active: boolean) => {
    mainPlumeMat.opacity = active ? 0.85 : 0;
    plumeMat.opacity = active ? 0.7 : 0;
  };

  const setArmExtension = (progress: number) => {
    if (roboticArmJoints.length >= 2) {
      roboticArmJoints[0].rotation.z = -0.6 + progress * 1.2;
      roboticArmJoints[1].rotation.z = 1.1 - progress * 1.4;
    }
  };

  const update = (deltaSeconds: number) => {
    // Gentle idle rotation of high-gain antenna or reaction wheels
    reactionWheels.forEach(rw => {
      rw.rotation.z += deltaSeconds * 4.0;
    });
  };

  const dispose = () => {
    geometriesToDispose.forEach(g => g.dispose());
    busMat.dispose();
    goldMliMat.dispose();
    solarMat.dispose();
    darkFrameMat.dispose();
    chromeMat.dispose();
    titaniumTankMat.dispose();
    rwaMat.dispose();
    nozzleMat.dispose();
    lensMat.dispose();
    plumeMat.dispose();
    mainPlumeMat.dispose();
    goldMliTex.dispose();
    solarTex.dispose();
    hullTex.dispose();
  };

  return {
    group: root,
    parts: {
      busMesh: busGroup,
      solarLeft,
      solarRight,
      engineNozzle,
      rcsQuads,
      rcsPlumes,
      antennaDish: antennaGroup,
      sensorTurret,
      captureMechanism: captureGroup,
      roboticArmJoints,
      internalTanks,
      reactionWheels,
    },
    setHighlightedPart,
    setExplodedProgress,
    setThrusterFiring,
    setArmExtension,
    update,
    dispose,
  };
}
