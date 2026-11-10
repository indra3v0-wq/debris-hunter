/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import confetti from 'canvas-confetti';
import { MissionState, Language } from '../types';
import { calculateDeorbitDeltaV, calculateFuelRequired } from '../simulation/orbitalPhysics';
import { buildModularSpacecraft } from '../three/spacecraftBuilder';
import { buildDebrisModel } from '../three/debrisBuilder';
import { 
  createEarthSurfaceTexture, 
  createEarthCloudTexture, 
  createEarthNightTexture, 
  createNeonPinkNebulaTexture 
} from '../three/proceduralTextures';
import { sound } from '../utils/audio';
import { TRANSLATIONS } from '../utils/translations';
import { 
  Flame, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Orbit, 
  RotateCcw,
  Play,
  Pause,
  Camera,
  MapPin,
  Waves,
  Sparkles,
  Timer,
  Sliders,
  FastForward
} from 'lucide-react';

interface StageDisposalProps {
  language?: Language;
  missionState: MissionState;
  onUpdateState: (partial: Partial<MissionState>) => void;
  onProceedToEvaluation: () => void;
}

type StrategyType = 'reentry' | 'graveyard' | 'drag_sail';
type DisposalCamMode = 'plasma' | 'tracking' | 'trajectory' | 'free';

export const StageDisposal: React.FC<StageDisposalProps> = ({
  language = 'mn',
  missionState,
  onUpdateState,
  onProceedToEvaluation,
}) => {
  const t = TRANSLATIONS[language];
  const canvasMountRef = useRef<HTMLDivElement>(null);

  const target = missionState.selectedMission;
  const initialAlt = target.altitudeKm;

  const [strategy, setStrategy] = useState<StrategyType>('reentry');
  const [isBurning, setIsBurning] = useState<boolean>(false);
  const [disposalComplete, setDisposalComplete] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0); // 0.0 to 1.0
  const [camMode, setCamMode] = useState<DisposalCamMode>('plasma');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(0.25); // Default to Slow-Motion 0.25x as requested!
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);

  // Stack Mass
  const [fuelKg, setFuelKg] = useState<number>(missionState.fuelRemainingKg);
  const combinedMassKg = missionState.specs.dryMassKg + fuelKg + target.massKg;

  // Delta-V for controlled atmospheric entry (perigee at 45km)
  const deorbitDeltaV = calculateDeorbitDeltaV(initialAlt, 45);
  const deorbitFuelReq = calculateFuelRequired(
    combinedMassKg,
    deorbitDeltaV,
    missionState.design.propulsion.ispSeconds
  );
  const hasEnoughFuel = fuelKg >= deorbitFuelReq;

  // Live telemetry state during reentry
  const [telemetry, setTelemetry] = useState({
    phaseText: language === 'mn' ? 'Ретроград эргэлт хийх' : 'Retrograde Flip',
    altitudeKm: initialAlt,
    velocityKms: 7.68,
    mach: 24.8,
    plasmaTempC: 25,
    dynamicPressureKpa: 0,
    ablationPct: 0,
  });

  const sceneCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const stackGroupRef = useRef<THREE.Group | null>(null);
  const plasmaMeshRef = useRef<THREE.Mesh | null>(null);
  const fragmentParticlesRef = useRef<THREE.Points | null>(null);
  const debrisModelRef = useRef<ReturnType<typeof buildDebrisModel> | null>(null);
  const spacecraftModelRef = useRef<ReturnType<typeof buildModularSpacecraft> | null>(null);

  // 3D Scene Initialization
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();
    const nebulaBg = createNeonPinkNebulaTexture();
    scene.background = nebulaBg;

    // Warm Sun & Atmospheric rim light
    const sun = new THREE.DirectionalLight(0xffedd5, 2.8);
    sun.position.set(15, 12, 18);
    scene.add(sun);

    const hemi = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.7);
    scene.add(hemi);

    // Earth Sphere with authentic NASA Blue Marble textures
    const earthRadius = 24.0;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthTex = createEarthSurfaceTexture();
    const earthNightTex = createEarthNightTexture();
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      emissiveMap: earthNightTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.65,
      roughness: 0.55,
      metalness: 0.12,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.position.set(0, -earthRadius - 2.0, 0);
    scene.add(earthMesh);

    // Dynamic Cloud Layer
    const cloudsGeo = new THREE.SphereGeometry(earthRadius * 1.012, 64, 64);
    const cloudsTex = createEarthCloudTexture();
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsTex,
      transparent: true,
      opacity: 0.65,
      blending: THREE.NormalBlending,
      depthWrite: false,
      roughness: 0.9,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    cloudsMesh.position.copy(earthMesh.position);
    scene.add(cloudsMesh);

    // Blue Atmospheric Glow Shell
    const atmoGeo = new THREE.SphereGeometry(earthRadius * 1.028, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    atmoMesh.position.copy(earthMesh.position);
    scene.add(atmoMesh);

    // Deep space stars
    const starCount = 500;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 350;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 350;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 350;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.85 });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Stack Group (Spacecraft + Docked Debris)
    const stack = new THREE.Group();
    stack.position.set(0, 4.0, 0);
    scene.add(stack);
    stackGroupRef.current = stack;

    // Modular Spacecraft
    const scBundle = buildModularSpacecraft(missionState.design);
    scBundle.group.position.set(0, 0, 1.2);
    stack.add(scBundle.group);
    spacecraftModelRef.current = scBundle;

    // Docked Debris
    const debBundle = buildDebrisModel(target);
    debBundle.group.position.set(0, 0.4, -1.8);
    stack.add(debBundle.group);
    debrisModelRef.current = debBundle;

    // Hypersonic Incandescent Plasma Sheath Shell
    const plasmaGeo = new THREE.ConeGeometry(2.6, 6.5, 24, 1, true);
    const plasmaMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const plasmaMesh = new THREE.Mesh(plasmaGeo, plasmaMat);
    plasmaMesh.rotation.x = Math.PI / 2;
    plasmaMesh.position.set(0, 0.2, -2.5);
    stack.add(plasmaMesh);
    plasmaMeshRef.current = plasmaMesh;

    // Thermal Fragmentation Particles (flying burning debris sparks)
    const fragCount = 200;
    const fragGeo = new THREE.BufferGeometry();
    const fragPos = new Float32Array(fragCount * 3);
    const fragVel: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < fragCount; i++) {
      fragPos[i * 3] = (Math.random() - 0.5) * 1.5;
      fragPos[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
      fragPos[i * 3 + 2] = -Math.random() * 8;
      fragVel.push({
        x: (Math.random() - 0.5) * 0.1,
        y: (Math.random() - 0.5) * 0.1,
        z: Math.random() * 0.2 + 0.1,
      });
    }
    fragGeo.setAttribute('position', new THREE.BufferAttribute(fragPos, 3));
    const fragMat = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.65,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const fragParticles = new THREE.Points(fragGeo, fragMat);
    stack.add(fragParticles);
    fragmentParticlesRef.current = fragParticles;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 500);
    camera.position.set(-1.8, 1.2, -5.2);
    camera.lookAt(0, 0.4, 0);
    sceneCameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enabled = false;
    controlsRef.current = controls;

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      earthMesh.rotation.y += delta * 0.01;
      cloudsMesh.rotation.y += delta * 0.016;

      // Animate fragmentation sparks if active
      if (fragMat.opacity > 0) {
        const pArr = (fragGeo.attributes.position as THREE.BufferAttribute).array as Float32Array;
        for (let i = 0; i < fragCount; i++) {
          pArr[i * 3] += fragVel[i].x * playbackSpeed * 2;
          pArr[i * 3 + 1] += fragVel[i].y * playbackSpeed * 2;
          pArr[i * 3 + 2] += fragVel[i].z * playbackSpeed * 2;
          if (pArr[i * 3 + 2] > 6) {
            pArr[i * 3] = (Math.random() - 0.5) * 1.5;
            pArr[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
            pArr[i * 3 + 2] = -2;
          }
        }
        (fragGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }

      if (controls.enabled) {
        controls.update();
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      scBundle.dispose();
      debBundle.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      earthTex.dispose();
      earthNightTex.dispose();
      cloudsGeo.dispose();
      cloudsMat.dispose();
      cloudsTex.dispose();
      nebulaBg.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      plasmaGeo.dispose();
      plasmaMat.dispose();
      fragGeo.dispose();
      fragMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [target]);

  // Camera switcher
  const handleChangeCamera = (mode: DisposalCamMode) => {
    sound.playClick(1150);
    setCamMode(mode);
    const camera = sceneCameraRef.current;
    if (!camera) return;

    if (controlsRef.current) {
      controlsRef.current.enabled = mode === 'free';
      if (mode === 'free') {
        controlsRef.current.target.set(0, 3.5, 0);
      }
    }

    if (mode === 'plasma') {
      camera.position.set(-1.8, 1.2, -5.2);
      camera.lookAt(0, 0.4, 0);
    } else if (mode === 'tracking') {
      camera.position.set(6.5, 4.2, 7.5);
      camera.lookAt(0, 3.5, 0);
    } else if (mode === 'trajectory') {
      camera.position.set(0, 16.0, 22.0);
      camera.lookAt(0, -6.0, 0);
    }
  };

  // Reentry Flight Timeline Loop with Slow-Motion support
  useEffect(() => {
    let animTimer: NodeJS.Timeout;
    if (isBurning && !isPaused && progress < 1) {
      animTimer = setTimeout(() => {
        // Base step rate scaled by slow-motion multiplier (0.25x default)
        const step = 0.006 * playbackSpeed;
        const nextProgress = Math.min(1, progress + step);
        setProgress(nextProgress);

        const plasmaMat = plasmaMeshRef.current?.material as THREE.MeshBasicMaterial | undefined;
        const fragMat = fragmentParticlesRef.current?.material as THREE.PointsMaterial | undefined;
        const stack = stackGroupRef.current;
        const camera = sceneCameraRef.current;

        let phaseText = '';
        let altKm = initialAlt;
        let velKms = 7.68;
        let mach = 24.8;
        let tempC = 25;
        let pressKpa = 0;
        let ablationPct = 0;

        if (nextProgress < 0.20) {
          // Phase 1: Retrograde orientation flip
          const p = nextProgress / 0.20;
          phaseText = language === 'mn' ? 'Ретроград чиглэл рүү эргэх' : 'Retrograde Orientation Flip';
          if (stack) {
            stack.rotation.y = p * Math.PI;
          }
          altKm = initialAlt;
          velKms = 7.68;
          ablationPct = 0;
        } else if (nextProgress < 0.45) {
          // Phase 2: Retrograde Deorbit Burn
          const p = (nextProgress - 0.20) / 0.25;
          phaseText = language === 'mn' ? 'Тоормослох түлхэлт асаах' : 'Retrograde Deorbit Burn';
          if (spacecraftModelRef.current) {
            spacecraftModelRef.current.setThrusterFiring(true);
          }
          altKm = initialAlt - p * (initialAlt - 85);
          velKms = 7.68 - p * 0.25;
          velKms = Math.round(velKms * 100) / 100;
          tempC = 25 + p * 180;
          ablationPct = Math.round(p * 15);
        } else if (nextProgress < 0.70) {
          // Phase 3: Hypersonic Slow-Motion plasma shockwave
          const p = (nextProgress - 0.45) / 0.25;
          phaseText = language === 'mn' ? 'Гипер дууны плазм үүсэлт (Удаашруулсан)' : 'Hypersonic Incandescent Plasma (Slow-Mo)';
          altKm = 85 - p * 35; // 85 -> 50 km
          velKms = 7.43 - p * 2.2;
          mach = Math.round((velKms / 0.32) * 10) / 10;
          tempC = Math.round(200 + p * 2400); // reaches ~2600°C!
          pressKpa = Math.round(p * 45);
          ablationPct = Math.round(15 + p * 50);

          // Intense plasma glow
          if (plasmaMat) {
            plasmaMat.opacity = Math.min(0.95, p * 1.4);
            plasmaMat.color.setHex(p > 0.6 ? 0xffffff : 0xff4500);
          }
          if (fragMat) {
            fragMat.opacity = p * 0.85;
          }

          // Camera shakes with hypersonic atmospheric buffeting
          if (camera && camMode !== 'free') {
            camera.position.x += (Math.random() - 0.5) * 0.05 * playbackSpeed;
            camera.position.y += (Math.random() - 0.5) * 0.05 * playbackSpeed;
          }
        } else if (nextProgress < 0.92) {
          // Phase 4: Aerodynamic breakup & complete incineration
          const p = (nextProgress - 0.70) / 0.22;
          phaseText = language === 'mn' ? 'Агаар мандлын үрэлтээр бүрэн шатах' : 'Aerodynamic Ablation & Incineration';
          altKm = 50 - p * 30; // 50 -> 20 km
          velKms = 5.2 - p * 3.8;
          mach = Math.round((velKms / 0.33) * 10) / 10;
          tempC = Math.round(2600 - p * 900);
          pressKpa = Math.round(45 + p * 80);
          ablationPct = Math.min(100, Math.round(65 + p * 35));

          // Shrink and disintegrate debris model in slow motion
          if (debrisModelRef.current) {
            const sc = Math.max(0.05, 1 - p * 0.95);
            debrisModelRef.current.group.scale.set(sc, sc, sc);
            debrisModelRef.current.group.rotation.x += 0.15;
            debrisModelRef.current.group.rotation.y += 0.25;
          }
          if (fragMat) {
            fragMat.opacity = 1.0;
          }
        } else {
          // Phase 5: Point Nemo splashdown
          phaseText = language === 'mn' ? 'Немо цэгт амжилттай шатаж дууслаа' : 'Point Nemo Ocean Corridor Vaporized';
          altKm = 0;
          velKms = 0.12;
          mach = 0.3;
          tempC = 35;
          pressKpa = 101.3;
          ablationPct = 100;

          if (plasmaMat) plasmaMat.opacity = 0;
          if (fragMat) fragMat.opacity = 0;
        }

        setTelemetry({
          phaseText,
          altitudeKm: Math.round(altKm * 10) / 10,
          velocityKms: Math.round(velKms * 100) / 100,
          mach,
          plasmaTempC: tempC,
          dynamicPressureKpa: pressKpa,
          ablationPct,
        });

        if (nextProgress >= 1) {
          setIsBurning(false);
          setDisposalComplete(true);
          sound.playLockChime();

          try {
            confetti({
              particleCount: 120,
              spread: 90,
              origin: { y: 0.6 },
              colors: ['#38bdf8', '#34d399', '#f59e0b', '#ec4899'],
            });
          } catch {}

          onUpdateState({
            disposalStrategy: 'reentry',
            disposalOutcome: {
              success: true,
              burnDeltaV: Math.round(deorbitDeltaV),
              decayYears: 0,
              impactZone: 'Point Nemo (South Pacific Ocean Uninhabited Area)',
            },
          });
        }
      }, 50);
    }
    return () => clearTimeout(animTimer);
  }, [isBurning, isPaused, progress, playbackSpeed, initialAlt, language]);

  const handleStartDeorbitBurn = () => {
    sound.playClick(1200);
    sound.playPlasmaReentry(6);
    setIsBurning(true);
    setProgress(0);
    setDisposalComplete(false);
  };

  const handleReset = () => {
    sound.playClick();
    setIsBurning(false);
    setProgress(0);
    setDisposalComplete(false);
    if (debrisModelRef.current) {
      debrisModelRef.current.group.scale.set(1, 1, 1);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-48px)] mt-12 bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left: Deorbit Telemetry HUD */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none max-w-sm">
        <div className="aerospace-panel p-3.5 rounded-xl border-rose-500/40 bg-slate-950/90 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="text-[11px] font-mono font-bold text-rose-400 tracking-wider">
              {language === 'mn' ? 'ҮЕ ШАТ 9 // АГААР МАНДАЛД ШАТААХ УСТГАЛ' : 'STAGE 9 // CONTROLLED DEORBIT ABLATION'}
            </span>
          </div>
          <h1 className="text-base font-bold text-white tracking-wide">
            {language === 'mn' ? 'Агаар мандлын мацалтаар устгах' : 'Atmospheric Re-entry Burn'}
          </h1>

          <div className="mt-3 p-2.5 bg-slate-950/90 rounded-lg border border-slate-800 text-xs font-mono space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">{language === 'mn' ? 'Өндөр' : 'Altitude'}:</span>
              <span className="text-white font-bold">{telemetry.altitudeKm} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{language === 'mn' ? 'Хурд' : 'Velocity'}:</span>
              <span className="text-sky-300 font-bold">{telemetry.velocityKms} km/s (Mach {telemetry.mach})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{language === 'mn' ? 'Плазмын температур' : 'Plasma Temp'}:</span>
              <span className={`font-bold ${telemetry.plasmaTempC > 1500 ? 'text-rose-400' : 'text-amber-400'}`}>
                {telemetry.plasmaTempC}°C
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{language === 'mn' ? 'Шаталтын хувь' : 'Ablation Rate'}:</span>
              <span className="text-emerald-400 font-bold">{telemetry.ablationPct}%</span>
            </div>

            {/* Ablation Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-rose-500 h-full transition-all"
                style={{ width: `${telemetry.ablationPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top Right: Camera Angles & Slow-Mo Controls */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto flex items-center gap-2">
        {/* Slow-Motion Speed Selector */}
        <div className="aerospace-panel px-2.5 py-1.5 rounded-lg border-amber-500/40 flex items-center gap-1.5 text-xs font-mono bg-slate-950/90 shadow-xl">
          <Timer className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] text-slate-400 mr-1 hidden sm:inline">
            {language === 'mn' ? 'УДААШРУУЛАЛТ:' : 'SLOW-MO:'}
          </span>
          {[0.25, 0.5, 1.0].map(spd => (
            <button
              key={spd}
              onClick={() => {
                sound.playClick(1000);
                setPlaybackSpeed(spd);
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                playbackSpeed === spd
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Camera Angles */}
        <div className="aerospace-panel p-1 rounded-lg border-sky-500/30 flex items-center gap-1 text-xs font-mono bg-slate-950/90 shadow-xl">
          <Camera className="w-3.5 h-3.5 text-sky-400 ml-1.5" />
          {[
            { id: 'plasma', label: 'Plasma' },
            { id: 'tracking', label: 'Track' },
            { id: 'trajectory', label: 'Trajectory' },
            { id: 'free', label: 'Free' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => handleChangeCamera(c.id as DisposalCamMode)}
              className={`px-2.5 py-1 rounded transition-colors ${
                camMode === c.id
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Unified Bottom Control Dock */}
      <div 
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-4xl transition-transform duration-300 pointer-events-auto ${
          hudCollapsed ? 'translate-y-[calc(100%-2.25rem)]' : 'translate-y-0'
        }`}
      >
        <div className="aerospace-panel rounded-xl overflow-hidden shadow-2xl border-rose-500/40 bg-slate-950/95">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-slate-950/95 border-b border-rose-500/20 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-white font-bold">
                {language === 'mn' ? 'АГААР МАНДАЛД ШАТААХ УДИРДЛАГЫН ТАВЦАН' : 'RE-ENTRY BURN & DEORBIT CONTROLLER'}
              </span>
            </div>
            <button
              onClick={() => {
                sound.playClick();
                setHudCollapsed(!hudCollapsed);
              }}
              className="hover:text-white px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] transition-colors"
            >
              {hudCollapsed ? '▴ Expand Controls' : '▾ Collapse Dock'}
            </button>
          </div>

          {/* Action Bar */}
          <div className="p-3.5 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs font-mono">
              {!isBurning && !disposalComplete ? (
                <span className="text-slate-300">
                  {language === 'mn' ? 'Шаардлагатай дельта-v: ' : 'Required Delta-V: '}
                  <strong className="text-sky-400">{Math.round(deorbitDeltaV)} m/s</strong> •{' '}
                  {language === 'mn' ? 'Шатахуун: ' : 'Propellant: '}
                  <strong className="text-emerald-400">{Math.round(deorbitFuelReq)} kg</strong>
                </span>
              ) : !disposalComplete ? (
                <div className="flex items-center gap-2 text-amber-300 font-bold animate-pulse">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <span>{telemetry.phaseText} ({Math.round(progress * 100)}%)</span>
                </div>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {language === 'mn' ? '100% АМЖИЛТТАЙ ШАТААЖ УСТГАЛАА! Тайлан руу шилжинэ үү.' : '100% RE-ENTRY ABLATION CONFIRMED! Proceed to official debrief report.'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {!isBurning && !disposalComplete && (
                <button
                  onClick={handleStartDeorbitBurn}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.4)] active:scale-95"
                >
                  <Flame className="w-4 h-4 fill-current" />
                  <span>{language === 'mn' ? 'АГААР МАНДАЛД ШАТААЖ ЭХЛҮҮЛЭХ' : 'START DEORBIT RE-ENTRY BURN'}</span>
                </button>
              )}

              {isBurning && !disposalComplete && (
                <>
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              )}

              {disposalComplete && (
                <button
                  onClick={() => {
                    sound.playLockChime();
                    onProceedToEvaluation();
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95"
                >
                  <span>{language === 'mn' ? 'АЛБАН ЁСНЫ ТАЙЛАН ҮЗЭХ' : 'VIEW OFFICIAL FLIGHT REPORT'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
