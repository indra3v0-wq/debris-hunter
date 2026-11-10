/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import confetti from 'canvas-confetti';
import { MissionState, Language } from '../types';
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
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight, 
  RotateCcw, 
  Play,
  Flame, 
  CheckCircle2, 
  Lock,
  Compass,
  Camera,
  Layers,
  Sparkles,
  Sliders,
  Maximize2
} from 'lucide-react';

interface StageCaptureProps {
  language?: Language;
  missionState: MissionState;
  onUpdateState: (partial: Partial<MissionState>) => void;
  onProceedToDisposal: () => void;
}

type CaptureStep = 1 | 2 | 3 | 4;
type CaptureCamMode = 'docking' | 'arm' | 'chase' | 'free';

export const StageCapture: React.FC<StageCaptureProps> = ({
  language = 'mn',
  missionState,
  onUpdateState,
  onProceedToDisposal,
}) => {
  const t = TRANSLATIONS[language];
  const canvasMountRef = useRef<HTMLDivElement>(null);

  const target = missionState.selectedMission;
  const tool = missionState.design.captureMechanism;

  // Capture phase state
  const [activeStep, setActiveStep] = useState<CaptureStep>(1);
  const [camMode, setCamMode] = useState<CaptureCamMode>('docking');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLatching, setIsLatching] = useState<boolean>(false);
  const [currentTumbleRate, setCurrentTumbleRate] = useState<number>(target.tumbleRateDegS);
  const [alignmentPct, setAlignmentPct] = useState<number>(35);
  const [manualExtension, setManualExtension] = useState<number>(0); // 0 to 100%
  const [manualArmAngle, setManualArmAngle] = useState<number>(0); // -45 to +45 deg
  const [clawClosed, setClawClosed] = useState<boolean>(false);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);

  const [captureStatus, setCaptureStatus] = useState<'ready' | 'success' | 'failed'>(
    missionState.isCaptured ? 'success' : 'ready'
  );
  const [failureReason, setFailureReason] = useState<string>('');

  const spacecraftRef = useRef<ReturnType<typeof buildModularSpacecraft> | null>(null);
  const debrisRef = useRef<ReturnType<typeof buildDebrisModel> | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sparkParticlesRef = useRef<THREE.Points | null>(null);

  // 3D Scene setup
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

    // Warm Sun and cool rim lighting for deep space contrast
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 3.0);
    sunLight.position.set(12, 15, 14);
    scene.add(sunLight);

    const earthFillLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    earthFillLight.position.set(-10, -10, -10);
    scene.add(earthFillLight);

    const ambientLight = new THREE.AmbientLight(0x0f172a, 0.6);
    scene.add(ambientLight);

    // Earth Sphere in background with authentic NASA Blue Marble textures
    const earthRadius = 80;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthTex = createEarthSurfaceTexture();
    const earthNightTex = createEarthNightTexture();
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      emissiveMap: earthNightTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.7,
      roughness: 0.55,
      metalness: 0.12,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.position.set(0, -earthRadius - 12, -20);
    scene.add(earthMesh);

    // Dynamic Cloud Layer
    const cloudsGeo = new THREE.SphereGeometry(earthRadius * 1.015, 64, 64);
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

    // Atmosphere Rayleigh Scattering Glow Shell
    const atmoGeo = new THREE.SphereGeometry(earthRadius * 1.035, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    atmoMesh.position.copy(earthMesh.position);
    scene.add(atmoMesh);

    // Deep Space Starfield
    const starCount = 600;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 350;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 350;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 350;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.75, transparent: true, opacity: 0.85 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Modern High-Detail Spacecraft Model
    const scBundle = buildModularSpacecraft(missionState.design);
    scBundle.group.position.set(0, 0, 2.4);
    scene.add(scBundle.group);
    spacecraftRef.current = scBundle;

    // Detailed Debris Model
    const debBundle = buildDebrisModel(target);
    debBundle.group.position.set(0, 0.4, -2.0);
    scene.add(debBundle.group);
    debrisRef.current = debBundle;

    // Visual Docking Crosshair Laser Beam
    const guideGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.2, 1.2),
      new THREE.Vector3(0, 0.4, -1.8),
    ]);
    const guideMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.2,
      gapSize: 0.15,
      transparent: true,
      opacity: 0.75,
    });
    const guideLine = new THREE.Line(guideGeo, guideMat);
    guideLine.computeLineDistances();
    scene.add(guideLine);

    // Spark Particles on Clamp Contact
    const sparkCount = 80;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = 0;
      sparkPos[i * 3 + 1] = 0.4;
      sparkPos[i * 3 + 2] = -1.8;
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xfde047,
      size: 0.15,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkPoints);
    sparkParticlesRef.current = sparkPoints;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 400);
    camera.position.set(0, 1.5, 5.8);
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

      // Debris spin animation (tumbles according to current rate)
      if (debBundle) {
        debBundle.update(delta * (currentTumbleRate / 10));
      }
      if (scBundle) {
        scBundle.update(delta);
      }

      earthMesh.rotation.y += delta * 0.02;
      cloudsMesh.rotation.y += delta * 0.028;

      // Spark particles fade
      if (sparkMat.opacity > 0) {
        sparkMat.opacity -= delta * 1.5;
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
      atmoGeo.dispose();
      atmoMat.dispose();
      nebulaBg.dispose();
      starGeo.dispose();
      starMat.dispose();
      guideGeo.dispose();
      guideMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [target]);

  // Camera switcher
  const handleChangeCamera = (mode: CaptureCamMode) => {
    sound.playClick(1050);
    setCamMode(mode);
    const camera = sceneCameraRef.current;
    if (!camera) return;

    if (controlsRef.current) {
      controlsRef.current.enabled = mode === 'free';
      if (mode === 'free') {
        controlsRef.current.target.set(0, 0.4, 0);
      }
    }

    if (mode === 'docking') {
      camera.position.set(0, 0.3, 3.4);
      camera.lookAt(0, 0.4, -2.0);
    } else if (mode === 'arm') {
      camera.position.set(-1.4, 1.2, 0.8);
      camera.lookAt(0, 0.4, -1.8);
    } else if (mode === 'chase') {
      camera.position.set(5.5, 3.2, 4.5);
      camera.lookAt(0, 0.2, 0);
    }
  };

  // Step 1: Attitude & Spin Matching execution
  const handleExecuteSpinMatch = () => {
    setIsSyncing(true);
    sound.playClick(850);
    sound.playThruster(1.2);

    if (spacecraftRef.current) {
      spacecraftRef.current.setThrusterFiring(true);
    }

    let progressCount = alignmentPct;
    const interval = setInterval(() => {
      progressCount = Math.min(95, progressCount + 5);
      setAlignmentPct(progressCount);
      if (progressCount >= 95) {
        clearInterval(interval);
        setIsSyncing(false);
        setActiveStep(2);
        sound.playLockChime();
        if (spacecraftRef.current) {
          spacecraftRef.current.setThrusterFiring(false);
        }
      }
    }, 120);
  };

  // Step 2: Deploy & Articulate Capture Tool
  const handleDeployTool = () => {
    sound.playClick(900);
    sound.playServoWhir(0.8);

    setManualExtension(100);
    if (spacecraftRef.current) {
      spacecraftRef.current.setArmExtension(1.0);
    }

    setActiveStep(3);
  };

  // Manual Arm Extension Slider Handler
  const handleManualArmChange = (val: number) => {
    setManualExtension(val);
    if (spacecraftRef.current) {
      spacecraftRef.current.setArmExtension(val / 100);
    }
  };

  // Step 3: Mechanical Latch & Tumble Neutralization
  const handleExecuteLatch = () => {
    setIsLatching(true);
    sound.playClick(950);
    sound.playServoWhir(0.6);

    setTimeout(() => {
      sound.playCaptureLatch();
      setClawClosed(true);

      // Trigger spark flash
      if (sparkParticlesRef.current) {
        (sparkParticlesRef.current.material as THREE.PointsMaterial).opacity = 1.0;
      }

      // Check physics alignment tolerances
      if (alignmentPct < 65) {
        sound.playWarning();
        setCaptureStatus('failed');
        setFailureReason(
          language === 'mn'
            ? `Тэнхлэгийн тэнцвэржүүлэлт хангалтгүй (${alignmentPct}% < 65%). Механик баригч гулсав.`
            : `Attitude alignment insufficient (${alignmentPct}% < 65%). Grapple interface slipped.`
        );
        setIsLatching(false);
        return;
      }

      // Successful Berthing! Neutralize tumble to 0.0
      let dampRate = currentTumbleRate;
      const dampInterval = setInterval(() => {
        dampRate = Math.max(0, dampRate - 0.8);
        setCurrentTumbleRate(Math.round(dampRate * 10) / 10);
        if (dampRate <= 0.05) {
          clearInterval(dampInterval);
          setCurrentTumbleRate(0.0);
          setCaptureStatus('success');
          setActiveStep(4);
          setIsLatching(false);

          // Draw debris into berthing collar
          if (debrisRef.current) {
            debrisRef.current.group.position.z = -1.2;
          }

          try {
            confetti({
              particleCount: 110,
              spread: 85,
              origin: { y: 0.6 },
              colors: ['#38bdf8', '#34d399', '#f59e0b', '#ec4899'],
            });
          } catch {}

          onUpdateState({
            isCaptured: true,
            targetTumbleRateDegS: 0.0,
            captureOutcome: {
              success: true,
              reason: language === 'mn' ? 'Хатуу холболт амжилттай' : 'Rigid Berthing Lock',
              details:
                language === 'mn'
                  ? `${tool.name} төхөөрөмжөөр хогийг бэхлэн, эргэлтийг бүрэн зогсоолоо (0.0°/s). Агаар мандалд шатаахад бэлэн.`
                  : `Engaged ${tool.name}. Target locked to spacecraft frame and stabilized to 0.0°/s.`,
            },
          });
        }
      }, 100);
    }, 1100);
  };

  const handleRetry = () => {
    sound.playClick();
    setCaptureStatus('ready');
    setActiveStep(1);
    setAlignmentPct(35);
    setManualExtension(0);
    setClawClosed(false);
    setCurrentTumbleRate(target.tumbleRateDegS);
    setFailureReason('');
    if (spacecraftRef.current) {
      spacecraftRef.current.setArmExtension(0);
      spacecraftRef.current.setThrusterFiring(false);
    }
    if (debrisRef.current) {
      debrisRef.current.group.position.z = -2.0;
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-48px)] mt-12 bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left: Target & Mechanism Status HUD */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none max-w-sm">
        <div className="aerospace-panel p-3.5 rounded-xl border-sky-500/30 bg-slate-950/90 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            <span className="text-[11px] font-mono font-bold text-sky-400 tracking-wider">
              {language === 'mn' ? 'ҮЕ ШАТ 8 // ХОГ ХАЯГДЛЫГ БАРИХ АЖИЛЛАГАА' : 'STAGE 8 // DEBRIS CAPTURE & BERTHING'}
            </span>
          </div>
          <h1 className="text-base font-bold text-white tracking-wide">
            {tool.name}
          </h1>

          <div className="mt-3 p-2.5 bg-slate-950/85 rounded-lg border border-slate-800 text-xs font-mono space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">{t.capture?.targetObject || 'Target'}:</span>
              <span className="text-sky-300 font-bold">{target.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.capture?.targetMass || 'Mass'}:</span>
              <span className="text-white font-bold">{target.massKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.capture?.tumbleRate || 'Tumble'}:</span>
              <span className={`font-bold ${currentTumbleRate > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {currentTumbleRate.toFixed(1)}°/s {currentTumbleRate === 0 && '✓'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Alignment Sync:</span>
              <span className="text-emerald-300 font-bold">{alignmentPct}%</span>
            </div>

            {/* Alignment Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-sky-400 h-full transition-all duration-300"
                style={{ width: `${alignmentPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top Right: Camera View Angles */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto flex items-center gap-1.5">
        <div className="aerospace-panel p-1 rounded-lg border-sky-500/30 flex items-center gap-1 text-xs font-mono bg-slate-950/90 shadow-xl">
          <Camera className="w-3.5 h-3.5 text-sky-400 ml-1.5" />
          {[
            { id: 'docking', label: 'Docking' },
            { id: 'arm', label: 'Arm Cam' },
            { id: 'chase', label: 'Chase' },
            { id: 'free', label: 'Free 360°' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => handleChangeCamera(c.id as CaptureCamMode)}
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
        <div className="aerospace-panel rounded-xl overflow-hidden shadow-2xl border-sky-500/40 bg-slate-950/95">
          {/* Collapse/Expand Toggle Header */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-slate-950/95 border-b border-sky-500/20 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-white font-bold">
                {language === 'mn' ? 'МЕХАНИК ГАР УДИРДЛАГЫН ПАНЕЛ' : 'ROBOTIC MANIPULATOR CONTROL PANEL'}
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

          {/* Stepped Capture Timeline */}
          <div className="p-3 bg-slate-900/90 border-b border-sky-500/20 grid grid-cols-4 gap-2 text-center text-xs font-mono">
            {[
              { step: 1, labelMn: '1. Тэнхлэг тэнцвэржүүлэх', labelEn: '1. Spin Sync' },
              { step: 2, labelMn: '2. Гар сунгах', labelEn: '2. Arm Deploy' },
              { step: 3, labelMn: '3. Түгжиж барих', labelEn: '3. Clamp Latch' },
              { step: 4, labelMn: '4. Бэхэлсэн', labelEn: '4. Captured' },
            ].map(s => (
              <div
                key={s.step}
                className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition-all ${
                  activeStep === s.step
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                    : activeStep > s.step
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-950/60 border-slate-800 text-slate-500'
                }`}
              >
                {language === 'mn' ? s.labelMn : s.labelEn}
              </div>
            ))}
          </div>

          {/* Manual Kinematic Slider Controls */}
          {activeStep >= 2 && activeStep < 4 && (
            <div className="px-4 py-2 bg-slate-950/90 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>{language === 'mn' ? 'Механик гарын сунгалт:' : 'Arm Extension:'}</span>
                  <span className="text-sky-300 font-bold">{manualExtension}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={manualExtension}
                  onChange={e => handleManualArmChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {language === 'mn' ? 'Хавчих хошуу:' : 'Gripper Claws:'}
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                  clawClosed 
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' 
                    : 'bg-amber-500/20 border-amber-400 text-amber-300'
                }`}>
                  {clawClosed ? 'LOCKED (Хавчсан)' : 'OPEN (Нээлттэй)'}
                </span>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="p-3 bg-slate-950 flex items-center justify-between gap-3">
            <div className="text-xs font-mono text-slate-300">
              {activeStep === 1 && (
                <span>{language === 'mn' ? 'Түлхэгч ашиглан хогны савлагаатай тэнхлэгээ тааруулна уу.' : 'Fire RCS thrusters to match debris tumble vector.'}</span>
              )}
              {activeStep === 2 && (
                <span>{language === 'mn' ? 'Механик гар сунгах товчийг дарж зорилтот биет рүү ойртуулна уу.' : 'Deploy robotic arm towards target grapple fixture.'}</span>
              )}
              {activeStep === 3 && (
                <span>{language === 'mn' ? 'Хавчих хошууг түгжиж, хогны эргэлтийг сааруулна уу.' : 'Trigger rigid clamp latch to neutralize target rotation.'}</span>
              )}
              {activeStep === 4 && (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {language === 'mn' ? 'АМЖИЛТТАЙ БЭХЭЛЛЭЭ! Агаар мандалд шатаах шат руу шилжинэ үү.' : 'BERTHING COMPLETE! Proceed to atmospheric re-entry burn.'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeStep === 1 && (
                <button
                  disabled={isSyncing}
                  onClick={handleExecuteSpinMatch}
                  className="px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 shadow-[0_0_15px_rgba(56,189,248,0.4)] active:scale-95"
                >
                  <Flame className="w-4 h-4" />
                  <span>{isSyncing ? (language === 'mn' ? 'Тэнцвэржүүлж байна...' : 'Synchronizing...') : (language === 'mn' ? 'ЭРГЭЛТЭД ТОХИРУУЛАХ' : 'MATCH TUMBLE SPIN')}</span>
                </button>
              )}

              {activeStep === 2 && (
                <button
                  onClick={handleDeployTool}
                  className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.4)] active:scale-95"
                >
                  <span>{language === 'mn' ? 'МЕХАНИК ГАР СУНГАХ' : 'DEPLOY ROBOTIC ARM'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeStep === 3 && (
                <button
                  disabled={isLatching}
                  onClick={handleExecuteLatch}
                  className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.5)] active:scale-95 animate-pulse"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isLatching ? (language === 'mn' ? 'Бэхэлж байна...' : 'Latching...') : (language === 'mn' ? 'ХАВЧИЖ БЭХЛЭХ' : 'CLAMP & LATCH TARGET')}</span>
                </button>
              )}

              {activeStep === 4 && (
                <button
                  onClick={() => {
                    sound.playLockChime();
                    onProceedToDisposal();
                  }}
                  className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-sky-500 to-emerald-400 hover:from-sky-400 hover:to-emerald-300 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 shadow-[0_0_20px_rgba(56,189,248,0.4)] active:scale-95"
                >
                  <span>{language === 'mn' ? 'АГААР МАНДАЛД ШАТААХ РУУ ОРОХ' : 'PROCEED TO DEORBIT BURN'}</span>
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
