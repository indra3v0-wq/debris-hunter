/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MissionState } from '../types';
import { buildDebrisModel } from '../three/debrisBuilder';
import { sound } from '../utils/audio';
import { TRANSLATIONS } from '../utils/translations';
import { 
  Radar, 
  Eye, 
  Compass, 
  Flame, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  RotateCw,
  Scan,
  Maximize2
} from 'lucide-react';

interface StageDetectionProps {
  language?: import('../types').Language;
  missionState: MissionState;
  onProceedToApproach: () => void;
}

type SensorViewMode = 'optical' | 'lidar' | 'radar' | 'thermal';

export const StageDetection: React.FC<StageDetectionProps> = ({
  language = 'mn',
  missionState,
  onProceedToApproach,
}) => {
  const t = TRANSLATIONS[language];
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const [sensorMode, setSensorMode] = useState<SensorViewMode>('lidar');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanComplete, setScanComplete] = useState<boolean>(false);

  const target = missionState.selectedMission;
  const hasLidar = missionState.design.sensors.some(s => s.type === 'lidar');
  const hasRadar = missionState.design.sensors.some(s => s.type === 'radar');

  const debrisBundleRef = useRef<ReturnType<typeof buildDebrisModel> | null>(null);

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
    scene.background = new THREE.Color(0x020617);

    // Key light simulating harsh space sunlight
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(8, 12, 10);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    rimLight.position.set(-6, -4, -6);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.5, 6.5);

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
    controls.minDistance = 3;
    controls.maxDistance = 15;

    // Build 3D debris model
    const bundle = buildDebrisModel(target);
    scene.add(bundle.group);
    debrisBundleRef.current = bundle;

    // LiDAR Scanning grid plane
    const scanGridGeo = new THREE.PlaneGeometry(6, 6, 20, 20);
    const scanGridMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const scanPlane = new THREE.Mesh(scanGridGeo, scanGridMat);
    scene.add(scanPlane);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      bundle.update(delta);

      // Animate scan grid sliding back and forth
      scanPlane.position.z = Math.sin(clock.getElapsedTime() * 1.5) * 2.5;

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
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      bundle.dispose();
      scanGridGeo.dispose();
      scanGridMat.dispose();
      sunLight.dispose();
      rimLight.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [target]);

  // Simulated scan progress
  useEffect(() => {
    const timer = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setScanComplete(true);
          sound.playLockChime();
          return 100;
        }
        return prev + 5;
      });
    }, 120);

    return () => clearInterval(timer);
  }, []);

  // Compute confidence based on equipped sensors
  let confidence = 80;
  if (hasLidar) confidence += 12;
  if (hasRadar) confidence += 8;

  const isTumbleSafeForCurrentTool =
    target.tumbleRateDegS <= missionState.design.captureMechanism.maxTumbleToleranceDegS;

  return (
    <div className="relative w-full h-[calc(100vh-48px)] mt-12 bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Optical / LiDAR Crosshair Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative w-64 h-64 border border-sky-400/30 rounded-lg">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-sky-400"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-sky-400"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-sky-400"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-sky-400"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-emerald-400/80"></div>
          </div>
          <div className="absolute -top-5 left-0 text-[10px] font-mono text-emerald-400 font-bold">
            TRACKING LOCK // RANGE: 12.4 km
          </div>
        </div>
      </div>

      {/* Top Left: Sensor Suite Badge */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none max-w-sm">
        <div className="aerospace-panel p-3.5 rounded-lg border-sky-500/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            <span className="text-[11px] font-mono font-bold text-sky-400 tracking-wider">
              {language === 'mn' ? 'ҮЕ ШАТ 6 // ОЛОН СПЕКТРИЙН МЭДРЭГЧИЙН ЦОГЦОЛБОР' : 'STAGE 6 // MULTI-SPECTRAL SENSOR SUITE'}
            </span>
          </div>
          <h1 className="text-base font-bold text-white tracking-wide">
            {language === 'mn' ? 'Хогны Хэлбэр Дүрс, Эргэлтийг Тодорхойлох' : 'Target Identification & Geometry'}
          </h1>

          <div className="mt-3 p-2.5 bg-slate-950/80 rounded border border-slate-800 text-xs font-mono space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">{language === 'mn' ? 'Зорилт:' : 'Classification:'}</span>
              <span className="text-sky-300 font-bold">{language === 'mn' ? target.nameMn : target.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{language === 'mn' ? 'Тооцоолсон масс:' : 'Estimated Mass:'}</span>
              <span className="text-white font-bold">{target.massKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{language === 'mn' ? 'Эргэлтийн хурд:' : 'Tumble Rate:'}</span>
              <span className={`font-bold ${target.tumbleRateDegS > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {target.tumbleRateDegS}°/s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{language === 'mn' ? 'Овор хэмжээ:' : 'Dimensions:'}</span>
              <span className="text-slate-300">
                {target.dimensionsM[0]}m × {target.dimensionsM[1]}m × {target.dimensionsM[2]}m
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-1">
              <span className="text-slate-400">{language === 'mn' ? 'Илрүүлэлтийн итгэлцүүр:' : 'Detection Confidence:'}</span>
              <span className="text-emerald-400 font-bold">{confidence}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Right: Sensor View Switcher */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto">
        <div className="aerospace-panel p-1.5 rounded-lg border-sky-500/30 flex items-center gap-1 text-xs font-mono">
          <button
            onClick={() => { sound.playClick(); setSensorMode('lidar'); }}
            className={`px-2.5 py-1 rounded transition-colors ${
              sensorMode === 'lidar'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3D LiDAR
          </button>
          <button
            onClick={() => { sound.playClick(); setSensorMode('optical'); }}
            className={`px-2.5 py-1 rounded transition-colors ${
              sensorMode === 'optical'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'mn' ? 'Оптик НавКам' : 'Optical NavCam'}
          </button>
          <button
            onClick={() => { sound.playClick(); setSensorMode('radar'); }}
            className={`px-2.5 py-1 rounded transition-colors ${
              sensorMode === 'radar'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'mn' ? 'Доплер Радар' : 'Doppler Radar'}
          </button>
        </div>
      </div>

      {/* Unified Bottom Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-5xl">
        <div className="aerospace-panel rounded-xl overflow-hidden shadow-2xl border-sky-500/40">
          {/* Analysis telemetry */}
          <div className="p-3 bg-slate-900/95 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-sky-500/20 text-xs font-mono">
            <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block mb-1">
                {language === 'mn' ? 'ЭРГЭЛТ БА ИМПУЛЬС' : 'ROTATION & MOMENTUM'}
              </span>
              <div className="text-white font-bold flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                <span>Spin: {target.tumbleRateDegS}°/s on Y-Axis</span>
              </div>
              <span className="text-slate-500 text-[10px] block mt-1">
                Kinetic Energy: ~{Math.round(target.massKg * Math.pow(target.tumbleRateDegS, 1.2))} J
              </span>
            </div>

            <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block mb-1">
                {language === 'mn' ? 'БАРИХ МЕХАНИЗМЫН ТОХИРГОО' : 'CAPTURE MECHANISM COMPATIBILITY'}
              </span>
              <div className={`font-bold flex items-center gap-1.5 ${isTumbleSafeForCurrentTool ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isTumbleSafeForCurrentTool ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {language === 'mn'
                        ? `${missionState.design.captureMechanism.nameMn || missionState.design.captureMechanism.name} тохиромжтой`
                        : `Safe with ${missionState.design.captureMechanism.name}`}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>
                      {language === 'mn'
                        ? 'Эргэлтийн хурд механизмын тэсвэрлэх хэмжээнээс хэтэрсэн!'
                        : 'Tumble rate exceeds mechanism tolerance!'}
                    </span>
                  </>
                )}
              </div>
              <span className="text-slate-500 text-[10px] block mt-1">
                {language === 'mn'
                  ? `Зөвшөөрөгдөх дээд хязгаар: ${missionState.design.captureMechanism.maxTumbleToleranceDegS}°/с`
                  : `Tolerance: Max ${missionState.design.captureMechanism.maxTumbleToleranceDegS}°/s`}
              </span>
            </div>

            <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block mb-1">
                {language === 'mn' ? 'БҮТЦИЙН БӨХ БАТ' : 'SURFACE & BREAKUP INTEGRITY'}
              </span>
              <span className="text-amber-400 font-bold block line-clamp-1">
                {language === 'mn' ? target.breakupRiskMn : target.breakupRisk}
              </span>
              <span className="text-slate-500 text-[10px] block mt-1">
                {language === 'mn' ? 'Эвдрэлгүйгээр зөөлөн залгагдах шаардлагатай' : 'Recommend gentle non-destructive berthing'}
              </span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="px-4 py-3 bg-slate-950/95 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs font-mono text-slate-400">
              <span>{language === 'mn' ? 'СКАННЕРДАХ ЯВЦ: ' : 'SCAN PROGRESS: '}</span>
              <span className="text-emerald-400 font-bold">{scanProgress}% COMPLETE</span>
              <span className="mx-2">•</span>
              <span>{language === 'mn' ? 'ЗОРИЛТ ТҮГЖИГДСЭН' : 'BEARING LOCK CONFIRMED'}</span>
            </div>

            <button
              onClick={() => {
                sound.playLockChime();
                onProceedToApproach();
              }}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-[0_0_15px_rgba(56,189,248,0.35)]"
            >
              <span>{language === 'mn' ? 'ОЙРЫН ОЙРТОЛТЫН ТРАЕКТОРТ ОРОХ' : 'ENGAGE CLOSE PROXIMITY APPROACH'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
