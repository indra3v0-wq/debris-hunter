/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MissionTarget, MissionState, Language, DebrisCatalogItem } from '../types';
import { MISSIONS, DEBRIS_CATALOG } from '../simulation/data';
import { createProceduralEarthScene, updateOrbitRings } from '../three/proceduralEarth';
import { buildDebrisModel } from '../three/debrisBuilder';
import { createNeonPinkNebulaTexture } from '../three/proceduralTextures';
import { sound } from '../utils/audio';
import { TRANSLATIONS } from '../utils/translations';
import { 
  AlertTriangle, 
  Orbit, 
  ChevronRight, 
  ShieldAlert, 
  Layers, 
  ArrowRight,
  Eye,
  Sliders,
  Sparkles,
  Info,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Compass,
  Radio,
  Volume2
} from 'lucide-react';

interface StageMissionControlProps {
  language: Language;
  missionState: MissionState;
  onSelectMission: (mission: MissionTarget) => void;
  onProceedToRocketLab: () => void;
}

export const StageMissionControl: React.FC<StageMissionControlProps> = ({
  language,
  missionState,
  onSelectMission,
  onProceedToRocketLab,
}) => {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const inspectMountRef = useRef<HTMLDivElement>(null);

  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<'missions' | 'catalog'>('missions');
  const [selectedDebris, setSelectedDebris] = useState<DebrisCatalogItem>(DEBRIS_CATALOG[0]);
  const [isZoomedIn, setIsZoomedIn] = useState<boolean>(false);
  const [showInspectionModal, setShowInspectionModal] = useState<boolean>(false);
  const [showDispatchModal, setShowDispatchModal] = useState<boolean>(true);

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const earthBundleRef = useRef<ReturnType<typeof createProceduralEarthScene> | null>(null);

  const targetCameraPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 5, 18));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  const t = TRANSLATIONS[language];
  const selected = missionState.selectedMission;

  // Speak announcement helper
  const speakDirective = () => {
    sound.playRadioStatic(0.4);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const msg = language === 'mn'
          ? 'Үндэсний Сансрын Удирдах Газраас ирсэн яаралтай даалгавар. Дэлхийн тойрог замын аюултай хог хаягдлыг арилгах ажиллагааг эхлүүлнэ үү.'
          : 'Priority Directive from the National Space Management Agency. Initiate orbital hazard removal sequence immediately.';
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = language === 'mn' ? 'mn-MN' : 'en-US';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch {}
    }
  };

  // Trigger dispatch siren when arriving at Mission Control
  useEffect(() => {
    sound.playDispatchSiren();
    const staticTimer = setTimeout(() => {
      sound.playRadioStatic(0.5);
    }, 450);
    const speakTimer = setTimeout(() => {
      speakDirective();
    }, 900);

    return () => {
      clearTimeout(staticTimer);
      clearTimeout(speakTimer);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Main 3D Earth & Debris Orbit Scene
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

    const sunLight = new THREE.DirectionalLight(0xfff8e7, 2.5);
    sunLight.position.set(16, 12, 14);
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.7);
    scene.add(hemiLight);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 5, 18);
    cameraRef.current = camera;

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
    controls.minDistance = 6;
    controls.maxDistance = 45;
    controlsRef.current = controls;

    const earthBundle = createProceduralEarthScene(isSoftwareGl);
    scene.add(earthBundle.group);
    earthBundleRef.current = earthBundle;

    // Starfield
    const starCount = isSoftwareGl ? 500 : 1200;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 450;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 450;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 450;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.75 });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      earthBundle.update(delta);

      // Smooth camera interpolation towards target when zoomed in/out
      camera.position.lerp(targetCameraPos.current, 0.05);
      controls.target.lerp(targetLookAt.current, 0.05);

      controls.update();
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
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      earthBundle.dispose();
      starGeo.dispose();
      starMat.dispose();
      sunLight.dispose();
      hemiLight.dispose();
      nebulaBg.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update orbit trajectory rings when selected target changes
  useEffect(() => {
    if (earthBundleRef.current) {
      updateOrbitRings(earthBundleRef.current.orbitLinesGroup, selected.id);
    }
  }, [selected.id]);

  // Dedicated 3D Inspection modal for the selected debris item
  useEffect(() => {
    if (!showInspectionModal || !inspectMountRef.current) return;
    const container = inspectMountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712);

    const light1 = new THREE.DirectionalLight(0xffedd5, 2.8);
    light1.position.set(8, 10, 10);
    scene.add(light1);

    const light2 = new THREE.DirectionalLight(0x38bdf8, 1.2);
    light2.position.set(-8, -6, -8);
    scene.add(light2);

    const amb = new THREE.AmbientLight(0x1e293b, 0.8);
    scene.add(amb);

    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 1.5, 5.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const debrisBundle = buildDebrisModel(selected);
    scene.add(debrisBundle.group);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      debrisBundle.update(delta);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    const handleInspectResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleInspectResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleInspectResize);
      controls.dispose();
      debrisBundle.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [showInspectionModal, selected]);

  // Smooth Zoom-In action to selected target
  const handleZoomInToTarget = (targetMission: MissionTarget) => {
    sound.playClick(1400);
    setIsZoomedIn(true);
    if (earthBundleRef.current) {
      const pos = earthBundleRef.current.getTargetPosition(targetMission.id);
      targetLookAt.current.copy(pos);
      // Position camera slightly offset from target position
      const offset = pos.clone().normalize().multiplyScalar(pos.length() + 2.8);
      offset.y += 0.8;
      targetCameraPos.current.copy(offset);
    }
  };

  const handleResetOrbitView = () => {
    sound.playClick(900);
    setIsZoomedIn(false);
    targetLookAt.current.set(0, 0, 0);
    targetCameraPos.current.set(0, 5, 18);
  };

  return (
    <div className="relative w-full h-[calc(100vh-48px)] mt-12 bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left Title & Global Catalog Badge */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none max-w-sm">
        <div className="aerospace-panel p-3.5 rounded-xl border-sky-500/30 bg-slate-950/90 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-[11px] font-mono font-bold text-sky-400 tracking-wider">
              {language === 'mn' ? 'ҮЕ ШАТ 1 // ДЭЛХИЙН ТОЙРОГ ЗАМЫН ХЯНАЛТ' : 'STAGE 1 // GLOBAL ORBITAL MONITORING'}
            </span>
          </div>
          <h1 className="text-base font-bold text-white tracking-wide">
            {language === 'mn' ? 'Монголын Сансрын Удирдлагын Төв' : 'Mongolian Mission Control Center'}
          </h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {language === 'mn'
              ? 'Дэлхийн тойрог замд 36,500 гаруй каталогжсон 10см-ээс дээш хог, 130 сая хэлтэрхий оршиж байна. Даалгавраа сонгон сансрын цэвэрлэгээг эхлүүлнэ үү.'
              : 'Over 36,500 cataloged objects >10 cm and 130 million fragments orbit Earth. Select an active threat below to initiate mission design.'}
          </p>

          <div className="mt-3 pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div>
              <span className="text-slate-500">LEO DENSITY:</span>
              <span className="text-rose-400 block font-bold">CRITICAL (700-900 km)</span>
            </div>
            <div>
              <span className="text-slate-500">KESSLER CASCADE:</span>
              <span className="text-amber-400 block font-bold">ELEVATED THREAT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Right: View Switcher & Camera Zoom Controls */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto flex items-center gap-2">
        <div className="aerospace-panel p-1 rounded-lg border-sky-500/30 flex items-center gap-1 text-xs font-mono bg-slate-950/90 shadow-xl">
          <button
            onClick={() => { sound.playClick(); setActiveView('missions'); }}
            className={`px-3 py-1 rounded transition-colors ${
              activeView === 'missions'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'mn' ? '8 Даалгавар' : '8 Missions'}
          </button>
          <button
            onClick={() => { sound.playClick(); setActiveView('catalog'); }}
            className={`px-3 py-1 rounded transition-colors ${
              activeView === 'catalog'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'mn' ? 'Каталог' : 'Catalog'}
          </button>
        </div>

        {/* Orbit Camera Zoom Toggle */}
        <button
          onClick={() => {
            if (isZoomedIn) handleResetOrbitView();
            else handleZoomInToTarget(selected);
          }}
          className="aerospace-panel px-3 py-1.5 rounded-lg border-sky-500/30 text-xs font-mono font-bold flex items-center gap-1.5 text-sky-300 hover:text-white hover:bg-slate-800 bg-slate-950/90 shadow-xl transition-all"
        >
          {isZoomedIn ? (
            <>
              <ZoomOut className="w-3.5 h-3.5" />
              <span>{language === 'mn' ? 'Дэлхий рүү буцах' : 'Global View'}</span>
            </>
          ) : (
            <>
              <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'mn' ? 'Хог руу томруулах' : 'Zoom In Debris'}</span>
            </>
          )}
        </button>

        <button
          onClick={() => {
            sound.playLockChime();
            setShowInspectionModal(true);
          }}
          className="aerospace-panel px-3 py-1.5 rounded-lg border-amber-500/40 text-xs font-mono font-bold flex items-center gap-1.5 text-amber-300 hover:text-white hover:bg-amber-950/40 bg-slate-950/90 shadow-xl transition-all"
        >
          <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
          <span>{language === 'mn' ? '3D Нарийн үзлэг' : '3D Inspect'}</span>
        </button>
      </div>

      {/* Unified Bottom Control Dock */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-5xl transition-transform duration-300 pointer-events-auto ${
          hudCollapsed ? 'translate-y-[calc(100%-2.25rem)]' : 'translate-y-0'
        }`}
      >
        <div className="aerospace-panel rounded-xl overflow-hidden shadow-2xl border-sky-500/40 bg-slate-950/95">
          {/* Collapse/Expand Toggle Header */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-slate-950/95 border-b border-sky-500/20 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-300 font-medium">
                {activeView === 'missions'
                  ? (language === 'mn' ? 'ДААЛГАВРЫН САН (8 ТӨРЛИЙН ЗОРИЛТ)' : 'MISSION LIBRARY (8 CATEGORIES)')
                  : (language === 'mn' ? 'БОДИТ & СИМУЛЯЦИЙН ТОЙРОГ ЗАМЫН БИЕТҮҮД' : 'TRACKED & SIMULATED ORBITAL OBJECTS')}
              </span>
            </div>
            <button
              onClick={() => {
                sound.playClick();
                setHudCollapsed(!hudCollapsed);
              }}
              className="hover:text-white px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] transition-colors"
            >
              {hudCollapsed ? '▴ Expand Panel' : '▾ Collapse Viewport'}
            </button>
          </div>

          {/* MISSIONS VIEW */}
          {activeView === 'missions' && (
            <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-2.5 bg-slate-900/95 max-h-60 overflow-y-auto">
              {MISSIONS.map(m => {
                const isSelected = m.id === selected.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      sound.playClick(1100);
                      onSelectMission(m);
                      handleZoomInToTarget(m);
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-800 text-sky-300 font-bold">
                          {m.code}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold ${
                            m.hazardScore >= 85 ? 'text-rose-400' : 'text-amber-400'
                          }`}
                        >
                          {m.difficulty}
                        </span>
                      </div>

                      <h3 className="text-xs font-bold text-white line-clamp-1 mb-1">
                        {language === 'mn' ? m.nameMn : m.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                        {language === 'mn' ? m.storyMn : m.storyEn}
                      </p>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-emerald-400 font-bold">${m.rewardBudgetM}M</span>
                      <span className="text-slate-400">{m.altitudeKm} km // {m.massKg} kg</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* DEBRIS CATALOG VIEW */}
          {activeView === 'catalog' && (
            <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-900/95 max-h-60 overflow-y-auto">
              {DEBRIS_CATALOG.map(item => {
                const isSelected = item.id === selectedDebris.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      sound.playClick();
                      setSelectedDebris(item);
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-slate-800 text-sky-300">
                        {item.isRealTracked ? 'REAL TRACKED' : 'SIMULATED'}
                      </span>
                      <span className="text-[9px] font-mono text-amber-400 font-bold">
                        {item.priorityLevel}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-white mb-0.5">
                      {language === 'mn' ? item.nameMn : item.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mb-1">
                      {item.catalogNumber || 'N/A'} • {item.altitudeKm} km • {item.orbitalVelocityKms} km/s
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2">
                      {language === 'mn' ? item.descriptionMn : item.descriptionEn}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Target Action Bar */}
          <div className="px-4 py-3 bg-slate-950/95 border-t border-sky-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs">
              <span className="text-slate-400 font-mono">
                {language === 'mn' ? 'СОНГОРТ ЗОРИЛТ:' : 'SELECTED TARGET:'}{' '}
              </span>
              <span className="text-white font-bold">
                {language === 'mn' ? selected.nameMn : selected.name}
              </span>
              <span className="text-sky-400 font-mono ml-2 text-[11px]">
                ({selected.massKg} kg • {selected.altitudeKm} km • Tumble {selected.tumbleRateDegS}°/s)
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowInspectionModal(true)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{language === 'mn' ? '3D Үзлэг' : '3D Inspect'}</span>
              </button>

              <button
                onClick={() => {
                  sound.playLockChime();
                  onProceedToRocketLab();
                }}
                className="flex-1 sm:flex-none px-6 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(56,189,248,0.35)]"
              >
                <span>{language === 'mn' ? 'ПУУЖИН УГСРАЛТ РУУ ОРОХ' : 'PROCEED TO ROCKET LAB'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3D DEBRIS CLOSE-UP INSPECTION MODAL */}
      {showInspectionModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto animate-fade-in">
          <div className="aerospace-panel max-w-3xl w-full p-5 rounded-2xl border-amber-500/50 bg-slate-950/95 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
                  🔍
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {language === 'mn' ? selected.nameMn : selected.name}
                  </h3>
                  <span className="text-[10px] font-mono text-amber-400 tracking-wider">
                    {language === 'mn' ? 'ТОЙРОГ ЗАМЫН ХОГ ХАЯГДЛЫН ОГЦОМ ТОМРУУЛСАН 3D ҮЗЛЭГ' : 'HIGH-RESOLUTION 3D DEBRIS INSPECTION'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowInspectionModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3D Model Viewport */}
            <div className="relative w-full h-64 bg-slate-900/90 rounded-xl overflow-hidden border border-slate-800">
              <div ref={inspectMountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
              <div className="absolute top-2 right-2 text-[10px] font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                {language === 'mn' ? '🖱️ Хулганаар 360° эргүүлж үзнэ үү' : '🖱️ Drag to rotate 360°'}
              </div>
            </div>

            {/* Telemetry and Threat Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">{language === 'mn' ? 'Масс' : 'Mass'}:</span>
                <span className="text-white font-bold text-sm">{selected.massKg.toLocaleString()} kg</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">{language === 'mn' ? 'Орбит өндөр' : 'Altitude'}:</span>
                <span className="text-sky-300 font-bold text-sm">{selected.altitudeKm} km</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">{language === 'mn' ? 'Эргэлтийн хурд' : 'Tumble Rate'}:</span>
                <span className="text-amber-400 font-bold text-sm">{selected.tumbleRateDegS}°/s</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">{language === 'mn' ? 'Аюулын индекс' : 'Hazard Score'}:</span>
                <span className="text-rose-400 font-bold text-sm">{selected.hazardScore} / 100</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
              <span className="text-amber-400 font-mono font-bold block mb-1">
                {language === 'mn' ? 'Зөвлөмж баригч хэрэгсэл:' : 'Recommended Capture Mechanism:'}{' '}
                {language === 'mn' ? selected.recommendedCaptureMn : selected.recommendedCapture}
              </span>
              <p className="text-[11px] text-slate-400">
                {language === 'mn' ? selected.storyMn : selected.storyEn}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowInspectionModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
              >
                {language === 'mn' ? 'Хаах' : 'Close'}
              </button>
              <button
                onClick={() => {
                  setShowInspectionModal(false);
                  sound.playLockChime();
                  onProceedToRocketLab();
                }}
                className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 shadow-[0_0_15px_rgba(56,189,248,0.4)]"
              >
                <span>{language === 'mn' ? 'ЭНЭ ДААЛГАВРЫГ ЭХЛҮҮЛЭХ' : 'PROCEED WITH THIS TARGET'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NSMA EMERGENCY MISSION DISPATCH MODAL ("dran daalgvara ogo") */}
      {showDispatchModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 pointer-events-auto animate-fade-in">
          <div className="aerospace-panel max-w-2xl w-full p-6 rounded-2xl border-rose-500/50 bg-slate-950/95 shadow-[0_0_50px_rgba(244,63,94,0.3)] space-y-5">
            {/* Urgent Header Banner */}
            <div className="flex items-center justify-between border-b border-rose-500/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="w-4 h-4 rounded-full bg-rose-500 block animate-ping absolute inset-0 opacity-75"></span>
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 font-bold relative z-10">
                    <ShieldAlert className="w-6 h-6 animate-pulse" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40">
                      PRIORITY ALPHA-1 // EMERGENCY
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      NSMA-SEC-DISPATCH #774-9
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">
                    {language === 'mn' ? 'ҮНДЭСНИЙ САНСРЫН УДИРДАХ ГАЗАР (NSMA)' : 'NATIONAL SPACE MANAGEMENT AGENCY'}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => speakDirective()}
                  title={language === 'mn' ? 'Даалгаврын дуу хоолойг дахин сонсох' : 'Replay Voice Briefing'}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-sky-400 hover:text-sky-300 hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-mono"
                >
                  <Volume2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{language === 'mn' ? 'Дуу сонсох' : 'Audio'}</span>
                </button>
              </div>
            </div>

            {/* Directive Message Body */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 font-mono text-xs">
                <div className="text-rose-400 font-bold mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    {language === 'mn' ? 'ЯАРАЛТАЙ ОРБИТЫН ДААЛГАВАР' : 'URGENT ORBITAL CLEARANCE DIRECTIVE'}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed text-xs">
                  {language === 'mn'
                    ? 'Монгол Улсын Үндэсний Сансрын Удирдах Газраас мэдэгдэж байна: Дэлхийн нам тойрог замд (LEO 600-950 км) 36,500 гаруй том хэмжээтэй аюултай хог хаягдал ба 130 сая хэлтэрхий хуримтлагдаж, олон улсын сансрын станц болон холбооны хиймэл дагуулуудад онц ноцтой аюул учруулж эхэллээ.'
                    : 'Emergency dispatch from the National Space Management Agency: Over 36,500 cataloged orbital debris items and 130M fragments in LEO (600-950 km) threaten vital space infrastructure, human spaceflight, and telecom satellites.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-sky-400 font-bold">
                  {language === 'mn' ? '📋 ТАНЫ ДААЛГАВРЫН ҮЕ ШАТУУД:' : '📋 YOUR OPERATIONAL DIRECTIVES:'}
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 leading-relaxed">
                  <li>
                    {language === 'mn'
                      ? 'Орбитын каталогоос хамгийн аюултай биетийг сонгох'
                      : 'Select priority hazardous debris target from the orbital catalog'}
                  </li>
                  <li>
                    {language === 'mn'
                      ? 'Хүнд даацын пуужин болон тусгай цэвэрлэгч сансрын хөлгийг инженерчлэн угсрах'
                      : 'Engineer and configure heavy launch vehicle & robotic cleanup spacecraft'}
                  </li>
                  <li>
                    {language === 'mn'
                      ? 'Газрын талбайгаас бодит хөөргөлт хийж, Гоманы шилжилтээр зорилтод ойртох'
                      : 'Execute ground liftoff and Hohmann orbital transfer to achieve rendezvous'}
                  </li>
                  <li>
                    {language === 'mn'
                      ? 'Робот гараар хогийг барьж аван Дэлхийн агаар мандал руу түлхэн шатааж устгах'
                      : 'Grapple debris with robotic manipulator and execute de-orbit re-entry burn'}
                  </li>
                </ol>
              </div>
            </div>

            {/* Clearance confirmation footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>COMM LINK: NSMA-ULAANBAATAR (ACTIVE)</span>
              </div>

              <button
                onClick={() => {
                  sound.playLockChime();
                  setShowDispatchModal(false);
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all"
              >
                <span>{language === 'mn' ? 'ДААЛГАВРЫГ ХҮЛЭЭН АВАХ // ЭХЛЭХ' : 'ACCEPT DIRECTIVE & COMMENCE'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
