/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { 
  createEarthSurfaceTexture, 
  createEarthCloudTexture, 
  createEarthNightTexture, 
  createMoonTexture,
  createNeonPinkNebulaTexture 
} from './proceduralTextures';
import { MISSIONS } from '../simulation/data';

export interface EarthSceneBundle {
  group: THREE.Group;
  earthMesh: THREE.Mesh;
  cloudsMesh: THREE.Mesh;
  moonGroup: THREE.Group;
  debrisPoints: THREE.Points;
  orbitLinesGroup: THREE.Group;
  getTargetPosition: (missionId: string) => THREE.Vector3;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}

export function createProceduralEarthScene(isSoftwareGl: boolean): EarthSceneBundle {
  const group = new THREE.Group();

  // 1. Earth Sphere
  const earthRadius = 6.371; // scaled down units (1 unit = 1000 km)
  const segments = isSoftwareGl ? 32 : 64;
  const earthGeo = new THREE.SphereGeometry(earthRadius, segments, segments);

  const earthTex = createEarthSurfaceTexture();
  const earthNightTex = createEarthNightTexture();

  const earthMat = new THREE.MeshStandardMaterial({
    map: earthTex,
    emissiveMap: earthNightTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.75,
    roughness: 0.55,
    metalness: 0.12,
  });
  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  group.add(earthMesh);

  // 2. Atmosphere Clouds Layer (slightly larger radius)
  const cloudsGeo = new THREE.SphereGeometry(earthRadius * 1.018, segments, segments);
  const cloudsTex = createEarthCloudTexture();
  const cloudsMat = new THREE.MeshStandardMaterial({
    map: cloudsTex,
    transparent: true,
    opacity: 0.6,
    blending: THREE.NormalBlending,
    depthWrite: false,
    roughness: 0.9,
  });
  const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
  group.add(cloudsMesh);

  // 3. Multi-Layer Atmospheric Rayleigh Scattering Glow
  const atmosphereGeo = new THREE.SphereGeometry(earthRadius * 1.042, 32, 32);
  const atmosphereMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.18,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
  group.add(atmosphereMesh);

  const outerHaloGeo = new THREE.SphereGeometry(earthRadius * 1.075, 32, 32);
  const outerHaloMat = new THREE.MeshBasicMaterial({
    color: 0x0284c7,
    transparent: true,
    opacity: 0.08,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  const outerHaloMesh = new THREE.Mesh(outerHaloGeo, outerHaloMat);
  group.add(outerHaloMesh);

  // 4. Detailed 3D Moon Orbiting Earth
  const moonGroup = new THREE.Group();
  group.add(moonGroup);

  const moonRadius = 1.737; // ~27% of Earth
  const moonGeo = new THREE.SphereGeometry(moonRadius, isSoftwareGl ? 24 : 36, isSoftwareGl ? 24 : 36);
  const moonTex = createMoonTexture();
  const moonMat = new THREE.MeshStandardMaterial({
    map: moonTex,
    roughness: 0.92,
    metalness: 0.05,
  });
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.position.set(28, 4, -14); // Orbit distance
  moonGroup.add(moonMesh);

  // 5. Deep Space Celestial Planets & Constellation Stars
  const celestialGroup = new THREE.Group();
  group.add(celestialGroup);

  // Mars (Red Planet) in distant background
  const marsGeo = new THREE.SphereGeometry(0.9, 16, 16);
  const marsMat = new THREE.MeshStandardMaterial({
    color: 0xc2410c,
    roughness: 0.8,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.2,
  });
  const marsMesh = new THREE.Mesh(marsGeo, marsMat);
  marsMesh.position.set(65, 28, -85);
  celestialGroup.add(marsMesh);

  // Jupiter in deep space
  const jupiterGeo = new THREE.SphereGeometry(2.2, 20, 20);
  const jupiterMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.7,
    emissive: 0x92400e,
    emissiveIntensity: 0.15,
  });
  const jupiterMesh = new THREE.Mesh(jupiterGeo, jupiterMat);
  jupiterMesh.position.set(-110, -35, -130);
  celestialGroup.add(jupiterMesh);

  // 6. NASA Neon Pink & Magenta Cosmic Deep Space Nebula Skydome
  const nebulaRadius = 380;
  const nebulaGeo = new THREE.SphereGeometry(nebulaRadius, 32, 24);
  const nebulaTex = createNeonPinkNebulaTexture();
  const nebulaMat = new THREE.MeshBasicMaterial({
    map: nebulaTex,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const nebulaSky = new THREE.Mesh(nebulaGeo, nebulaMat);
  celestialGroup.add(nebulaSky);

  // 7. Realistic Starfield with Color Temperature & Luminosity Variations
  const starCount = isSoftwareGl ? 800 : 2000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);

  const cWhite = new THREE.Color(0xffffff);
  const cBlue = new THREE.Color(0x93c5fd);
  const cAmber = new THREE.Color(0xfde68a);

  for (let i = 0; i < starCount; i++) {
    const v = new THREE.Vector3(
      (Math.random() - 0.5) * 600,
      (Math.random() - 0.5) * 600,
      (Math.random() - 0.5) * 600
    );
    // Push outside Earth vicinity
    if (v.length() < 50) v.setLength(70 + Math.random() * 200);

    starPos[i * 3] = v.x;
    starPos[i * 3 + 1] = v.y;
    starPos[i * 3 + 2] = v.z;

    const rand = Math.random();
    const starCol = rand < 0.6 ? cWhite : rand < 0.85 ? cBlue : cAmber;
    starColors[i * 3] = starCol.r;
    starColors[i * 3 + 1] = starCol.g;
    starColors[i * 3 + 2] = starCol.b;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starMat = new THREE.PointsMaterial({
    size: isSoftwareGl ? 0.7 : 0.65,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
  });
  const starField = new THREE.Points(starGeo, starMat);
  celestialGroup.add(starField);

  // 7. Orbital Debris Cloud (thousands of particles around Earth)
  const debrisCount = isSoftwareGl ? 1200 : 3500;
  const debrisGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(debrisCount * 3);
  const colors = new Float32Array(debrisCount * 3);

  const colorHazard = new THREE.Color(0xef4444); // red: high collision risk
  const colorTracked = new THREE.Color(0xf59e0b); // amber: cataloged debris
  const colorSmall = new THREE.Color(0x38bdf8); // cyan: small fragments

  for (let i = 0; i < debrisCount; i++) {
    const altKm = 300 + Math.pow(Math.random(), 1.5) * 1200;
    const r = (6371 + altKm) / 1000;

    const inc = (Math.random() > 0.4 ? (0.9 + Math.random() * 0.8) : Math.random() * Math.PI);
    const raan = Math.random() * Math.PI * 2;
    const anomaly = Math.random() * Math.PI * 2;

    const x0 = r * Math.cos(anomaly);
    const y0 = r * Math.sin(anomaly);

    const x = x0 * Math.cos(raan) - y0 * Math.cos(inc) * Math.sin(raan);
    const y = x0 * Math.sin(raan) + y0 * Math.cos(inc) * Math.cos(raan);
    const z = y0 * Math.sin(inc);

    positions[i * 3] = x;
    positions[i * 3 + 1] = z; // Three.js Y-up
    positions[i * 3 + 2] = y;

    let c = colorTracked;
    const rand = Math.random();
    if (rand < 0.25) c = colorHazard;
    else if (rand < 0.65) c = colorSmall;

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  debrisGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  debrisGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const debrisMat = new THREE.PointsMaterial({
    size: isSoftwareGl ? 0.06 : 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
  });

  const debrisPoints = new THREE.Points(debrisGeo, debrisMat);
  group.add(debrisPoints);

  // 8. Gemini AI-Inspired Revolving Orbital Visualization Rings
  // Beautiful glowing, tilted concentric rings revolving around Earth's center
  const geminiOrbitsGroup = new THREE.Group();
  group.add(geminiOrbitsGroup);

  const geminiRingConfigs = [
    { radius: earthRadius * 1.15, incX: 0.35, incZ: 0.2, speed: 0.18, color: 0x38bdf8, opacity: 0.45 },
    { radius: earthRadius * 1.25, incX: -0.45, incZ: 0.5, speed: -0.14, color: 0x818cf8, opacity: 0.40 },
    { radius: earthRadius * 1.38, incX: 0.6, incZ: -0.3, speed: 0.22, color: 0x34d399, opacity: 0.35 },
    { radius: earthRadius * 1.52, incX: -0.2, incZ: -0.6, speed: -0.11, color: 0x38bdf8, opacity: 0.30 },
  ];

  const geminiRingObjects: { ring: THREE.Line; nodes: THREE.Points; speed: number }[] = [];

  geminiRingConfigs.forEach(cfg => {
    const ringGroup = new THREE.Group();
    ringGroup.rotation.x = cfg.incX;
    ringGroup.rotation.z = cfg.incZ;
    geminiOrbitsGroup.add(ringGroup);

    const segs = 100;
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(th) * cfg.radius, 0, Math.sin(th) * cfg.radius));
    }
    const rGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const rMat = new THREE.LineBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: cfg.opacity,
    });
    const ringLine = new THREE.Line(rGeo, rMat);
    ringGroup.add(ringLine);

    // Glowing orbiting energy nodes along this Gemini ring
    const nodeCount = 3;
    const nodeGeo = new THREE.BufferGeometry();
    const nodePos = new Float32Array(nodeCount * 3);
    for (let n = 0; n < nodeCount; n++) {
      const a = (n / nodeCount) * Math.PI * 2;
      nodePos[n * 3] = Math.cos(a) * cfg.radius;
      nodePos[n * 3 + 1] = 0;
      nodePos[n * 3 + 2] = Math.sin(a) * cfg.radius;
    }
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
    const nodeMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.16,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const nodes = new THREE.Points(nodeGeo, nodeMat);
    ringGroup.add(nodes);

    geminiRingObjects.push({ ring: ringLine, nodes, speed: cfg.speed });
  });

  // 9. Mission Target Hazardous Debris Orbital Trajectories & Animated Motion Beacons
  const orbitLinesGroup = new THREE.Group();
  group.add(orbitLinesGroup);

  // Markers for target positions along trajectories
  const targetBeaconsGroup = new THREE.Group();
  group.add(targetBeaconsGroup);

  const targetBeacons: { id: string; mesh: THREE.Mesh; pulseRing: THREE.Mesh; mission: typeof MISSIONS[0]; angle: number }[] = [];

  MISSIONS.forEach((m, idx) => {
    const r = (6371 + m.altitudeKm) / 1000;
    const beaconGeo = new THREE.OctahedronGeometry(0.18, 0);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: m.hazardScore >= 80 ? 0xef4444 : 0xf59e0b,
      wireframe: false,
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);

    // Outer warning pulse ring around beacon
    const pRingGeo = new THREE.RingGeometry(0.24, 0.32, 16);
    const pRingMat = new THREE.MeshBasicMaterial({
      color: m.hazardScore >= 80 ? 0xef4444 : 0xf59e0b,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const pulseRing = new THREE.Mesh(pRingGeo, pRingMat);
    beaconMesh.add(pulseRing);

    targetBeaconsGroup.add(beaconMesh);
    targetBeacons.push({
      id: m.id,
      mesh: beaconMesh,
      pulseRing,
      mission: m,
      angle: (idx / MISSIONS.length) * Math.PI * 2,
    });
  });

  updateOrbitRings(orbitLinesGroup, 'mission_kestrel');

  // Animation update function
  let moonOrbitAngle = 0;
  let pulseTimer = 0;

  const update = (deltaSeconds: number) => {
    // Earth rotates slowly on its axis
    earthMesh.rotation.y += deltaSeconds * 0.03;
    cloudsMesh.rotation.y += deltaSeconds * 0.038;

    // Moon orbits Earth
    moonOrbitAngle += deltaSeconds * 0.015;
    moonMesh.position.x = Math.cos(moonOrbitAngle) * 30;
    moonMesh.position.z = Math.sin(moonOrbitAngle) * 30;
    moonMesh.rotation.y += deltaSeconds * 0.015;

    // Debris cloud precesses along orbit
    debrisPoints.rotation.y += deltaSeconds * 0.015;

    // Gemini AI orbital rings revolve smoothly
    geminiRingObjects.forEach(obj => {
      obj.nodes.rotation.y += deltaSeconds * obj.speed;
      obj.ring.rotation.y += deltaSeconds * (obj.speed * 0.5);
    });

    // Update target debris beacons along their orbits
    pulseTimer += deltaSeconds;
    targetBeacons.forEach(b => {
      // Orbital speed inversely proportional to altitude radius ^ 1.5 (Keplerian)
      const r = (6371 + b.mission.altitudeKm) / 1000;
      const orbSpeed = 0.25 / Math.sqrt(r);
      b.angle += deltaSeconds * orbSpeed;

      const incRad = (b.mission.inclinationDeg * Math.PI) / 180;
      const x0 = r * Math.cos(b.angle);
      const z0 = r * Math.sin(b.angle);

      // Rotate by inclination
      b.mesh.position.x = x0;
      b.mesh.position.y = z0 * Math.sin(incRad);
      b.mesh.position.z = z0 * Math.cos(incRad);

      // Spin beacon
      b.mesh.rotation.x += deltaSeconds * 1.5;
      b.mesh.rotation.y += deltaSeconds * 2.0;

      // Pulse ring expansion
      const s = 1 + Math.sin(pulseTimer * 4 + b.angle) * 0.35;
      b.pulseRing.scale.set(s, s, s);
    });
  };

  const getTargetPosition = (missionId: string): THREE.Vector3 => {
    const beacon = targetBeacons.find(b => b.id === missionId);
    if (beacon) {
      return beacon.mesh.position.clone();
    }
    return new THREE.Vector3(0, 0, earthRadius + 1);
  };

  const dispose = () => {
    earthGeo.dispose();
    earthMat.dispose();
    earthTex.dispose();
    earthNightTex.dispose();
    cloudsGeo.dispose();
    cloudsMat.dispose();
    cloudsTex.dispose();
    atmosphereGeo.dispose();
    atmosphereMat.dispose();
    outerHaloGeo.dispose();
    outerHaloMat.dispose();
    moonGeo.dispose();
    moonMat.dispose();
    moonTex.dispose();
    marsGeo.dispose();
    marsMat.dispose();
    jupiterGeo.dispose();
    jupiterMat.dispose();
    starGeo.dispose();
    starMat.dispose();
    debrisGeo.dispose();
    debrisMat.dispose();
    nebulaGeo.dispose();
    nebulaMat.dispose();
    nebulaTex.dispose();
    targetBeacons.forEach(b => {
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
      b.pulseRing.geometry.dispose();
      (b.pulseRing.material as THREE.Material).dispose();
    });
  };

  return {
    group,
    earthMesh,
    cloudsMesh,
    moonGroup,
    debrisPoints,
    orbitLinesGroup,
    getTargetPosition,
    update,
    dispose,
  };
}

export function updateOrbitRings(group: THREE.Group, selectedMissionId: string) {
  // Clear existing orbit lines
  while (group.children.length > 0) {
    const child = group.children[0] as THREE.Line;
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
    group.remove(child);
  }

  MISSIONS.forEach(mission => {
    const isTarget = mission.id === selectedMissionId;
    const r = (6371 + mission.altitudeKm) / 1000;
    const segments = 120;
    const points: THREE.Vector3[] = [];

    const incRad = (mission.inclinationDeg * Math.PI) / 180;

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x0 = r * Math.cos(theta);
      const z0 = r * Math.sin(theta);

      // Rotate by inclination
      const x = x0;
      const y = z0 * Math.sin(incRad);
      const z = z0 * Math.cos(incRad);
      points.push(new THREE.Vector3(x, y, z));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: isTarget ? 0xef4444 : mission.hazardScore >= 80 ? 0xf59e0b : 0x0284c7,
      transparent: true,
      opacity: isTarget ? 0.95 : 0.35,
      linewidth: isTarget ? 2 : 1,
    });

    const line = new THREE.Line(geo, mat);
    group.add(line);
  });
}
