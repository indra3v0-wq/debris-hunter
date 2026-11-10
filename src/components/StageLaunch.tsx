/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import confetti from 'canvas-confetti';
import { LaunchVehicle, CalculatedSpecs, SpacecraftDesign, Language } from '../types';
import { LAUNCH_VEHICLES } from '../simulation/data';
import { buildRealisticLaunchScene, LaunchCameraMode, LaunchTelemetryData } from '../three/launchAnimation';
import { NavBallHUD } from './NavBallHUD';
import { sound } from '../utils/audio';
import { TRANSLATIONS } from '../utils/translations';
import { 
  Rocket, 
  AlertTriangle, 
  ArrowRight, 
  Play, 
  Pause, 
  RotateCcw, 
  Flame, 
  CheckCircle2, 
  Camera, 
  FastForward, 
  Layers, 
  Globe,
  Sliders,
  Zap,
  Sparkles,
  ChevronRight,
  Compass,
  Check,
  Maximize2
} from 'lucide-react';

interface StageLaunchProps {
  language?: Language;
  design: SpacecraftDesign;
  specs: CalculatedSpecs;
  selectedRocket: LaunchVehicle;
  onSelectRocket: (rocket: LaunchVehicle) => void;
  onLaunchComplete: () => void;
}

export const StageLaunch: React.FC<StageLaunchProps> = ({
  language = 'mn',
  design,
  specs,
  selectedRocket,
  onSelectRocket,
  onLaunchComplete,
}) => {
  const t = TRANSLATIONS[language];
  const canvasMountRef = useRef<HTMLDivElement>(null);

  const [launching, setLaunching] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0); // 0.0 to 1.0
  const [cameraMode, setCameraMode] = useState<LaunchCameraMode>('chase');

  // Flight HUD & interactive controls
  const [autopilot, setAutopilot] = useState(true);
  const [manualThrottle, setManualThrottle] = useState(100);
  const [manualPitch, setManualPitch] = useState(90); // 90° = vertical, 0° = horizontal prograde
  const [sasActive, setSasActive] = useState(true);
  const [rcsActive, setRcsActive] = useState(true);
  const [showNavBallMobile, setShowNavBallMobile] = useState(true);
  const [showStagingMobile, setShowStagingMobile] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Staging milestone tracker (0 to 6)
  // 0: Pad Hold / Countdown
  // 1: Liftoff & Atmospheric Ascent
  // 2: MECO & Booster Decouple
  // 3: S2 Vac Ignition
  // 4: Fairing Jettison
  // 5: Circularization Burn at Apoapsis
  // 6: Satellite Separation & Array Deploy
  const [activeStageStep, setActiveStageStep] = useState<number>(0);

  const [telemetry, setTelemetry] = useState<LaunchTelemetryData>({
    phaseKey: 'padHold',
    altitudeKm: 0,
    velocityKms: 0,
    downrangeKm: 0,
    mach: 0,
    dynamicPressureKpa: 0,
    gForce: 1.0,
    throttlePct: 0,
    isFairingSeparated: false,
    isBoosterSeparated: false,
    isPayloadDeployed: false,
    pitchDeg: 90,
    rollDeg: 0,
    headingDeg: 90,
    apogeeKm: 0,
    perigeeKm: -6371,
    timeToApogeeSec: 0,
    orbitEccentricity: 1.0,
    isOrbitStable: false,
  });

  const sceneBundleRef = useRef<ReturnType<typeof buildRealisticLaunchScene> | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const isPayloadOverloaded = specs.wetMassKg > selectedRocket.maxLeoPayloadKg;

  // Initialize Three.js WebGL scene
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
    scene.fog = new THREE.FogExp2(0x020617, 0.0018);

    // Warm Sun and ambient lighting
    const sunLight = new THREE.DirectionalLight(0xffedd5, 2.8);
    sunLight.position.set(35, 60, 45);
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.85);
    scene.add(hemiLight);

    const bundle = buildRealisticLaunchScene(container.clientWidth, container.clientHeight);
    scene.add(bundle.group);
    sceneBundleRef.current = bundle;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(bundle.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 250;
    controls.minDistance = 4;
    controls.enabled = false;
    controlsRef.current = controls;

    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (controls.enabled) {
        controls.update();
      }
      renderer.render(scene, bundle.camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      bundle.camera.aspect = container.clientWidth / container.clientHeight;
      bundle.camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      bundle.dispose();
      sunLight.dispose();
      hemiLight.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update camera mode
  const handleChangeCameraMode = (mode: LaunchCameraMode) => {
    sound.playClick(1100);
    setCameraMode(mode);
    if (sceneBundleRef.current) {
      sceneBundleRef.current.setCameraMode(mode);
    }
    if (controlsRef.current) {
      controlsRef.current.enabled = mode === 'free' || mode === 'map';
      if (mode === 'free') {
        controlsRef.current.target.set(0, 12, 0);
      } else if (mode === 'map') {
        controlsRef.current.target.set(0, -25, 0);
      }
    }
  };

  // Toggle Map View (M shortcut)
  const handleToggleMapView = () => {
    if (cameraMode === 'map') {
      handleChangeCameraMode('chase');
    } else {
      handleChangeCameraMode('map');
    }
  };

  // Launch countdown sequence
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        sound.playCountdownBeep(false);
        setCountdown(countdown - 1);
      }, 900);
    } else if (countdown === 0) {
      sound.playCountdownBeep(true);
      sound.playRocketRumble(9);
      setCountdown(null);
      setLaunching(true);
      setActiveStageStep(1);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Main simulation tick loop
  useEffect(() => {
    let animTimer: NodeJS.Timeout;
    if (launching && !isPaused && progress < 1) {
      animTimer = setTimeout(() => {
        // Base step rate scaled by speedMultiplier
        const baseRate = 0.0055;
        const step = baseRate * speedMultiplier * (manualThrottle / 100);
        const nextProgress = Math.min(1, progress + step);
        setProgress(nextProgress);

        // Update activeStageStep based on progress
        if (nextProgress < 0.38) {
          setActiveStageStep(1); // Liftoff & Gravity Turn
        } else if (nextProgress < 0.50) {
          setActiveStageStep(2); // MECO & Booster Sep
        } else if (nextProgress < 0.55) {
          setActiveStageStep(3); // S2 Vac Ignition
        } else if (nextProgress < 0.70) {
          setActiveStageStep(4); // Fairing Jettison
        } else if (nextProgress < 0.88) {
          setActiveStageStep(5); // Circularization burn at Apoapsis
        } else {
          setActiveStageStep(6); // Spacecraft Deployment
        }

        if (sceneBundleRef.current) {
          const telem = sceneBundleRef.current.updateSequence(nextProgress, 0.08 * speedMultiplier);
          setTelemetry(telem);

          // Audio triggers at flight milestones
          if (progress < 0.40 && nextProgress >= 0.40) {
            sound.playStagingSeparation();
          }
          if (progress < 0.55 && nextProgress >= 0.55) {
            sound.playFairingSeparation();
          }
          if (progress < 0.88 && nextProgress >= 0.88) {
            sound.playLockChime();
            confetti({
              particleCount: 110,
              spread: 75,
              origin: { y: 0.65 },
              colors: ['#38bdf8', '#34d399', '#f59e0b', '#ec4899', '#ffffff'],
            });
            setShowSuccessModal(true);
          }
        }
      }, 60);
    }
    return () => clearTimeout(animTimer);
  }, [launching, isPaused, progress, speedMultiplier, manualThrottle]);

  // Keyboard controls listener (Space = Stage, M = Map, Z = Max Throttle, X = Cutoff)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTriggerStageAction();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMapView();
      } else if (e.code === 'KeyZ') {
        e.preventDefault();
        sound.playClick(1400);
        setManualThrottle(100);
      } else if (e.code === 'KeyX') {
        e.preventDefault();
        sound.playClick(800);
        setManualThrottle(0);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        setManualThrottle(prev => Math.min(100, prev + 10));
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        setManualThrottle(prev => Math.max(0, prev - 10));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [launching, progress, countdown, isPayloadOverloaded, cameraMode]);

  const handleStartCountdown = () => {
    if (isPayloadOverloaded) {
      sound.playWarning();
      return;
    }
    sound.playClick();
    setCountdown(5);
  };

  // Interactive Ellipse Simulator Staging Trigger
  const handleTriggerStageAction = () => {
    if (!launching) {
      if (countdown === null) {
        handleStartCountdown();
      }
      return;
    }

    sound.playClick(1200);

    // Staging logic matching the tutorial video
    if (progress < 0.38) {
      // Advance to booster separation
      sound.playStagingSeparation();
      setProgress(0.42);
      setActiveStageStep(2);
    } else if (progress < 0.52) {
      // Ignite Stage 2 Vacuum engine
      sound.playRocketRumble(3);
      setProgress(0.53);
      setActiveStageStep(3);
    } else if (progress < 0.68) {
      // Jettison payload fairing
      sound.playFairingSeparation();
      setProgress(0.70);
      setActiveStageStep(4);
    } else if (progress < 0.85) {
      // Circularization burn at Apoapsis
      sound.playRocketRumble(3);
      setProgress(0.86);
      setActiveStageStep(5);
    } else if (progress < 1) {
      // Deploy satellite payload
      sound.playLockChime();
      setProgress(0.92);
      setActiveStageStep(6);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
      setShowSuccessModal(true);
    } else {
      onLaunchComplete();
    }
  };

  const handleSkipToOrbit = () => {
    sound.playLockChime();
    setProgress(1);
    setLaunching(true);
    setActiveStageStep(6);
    if (sceneBundleRef.current) {
      const telem = sceneBundleRef.current.updateSequence(1, 0.1);
      setTelemetry(telem);
    }
    confetti({
      particleCount: 130,
      spread: 80,
      origin: { y: 0.6 },
    });
    setShowSuccessModal(true);
  };

  const handleResetLaunch = () => {
    sound.playClick();
    setLaunching(false);
    setIsPaused(false);
    setProgress(0);
    setCountdown(null);
    setActiveStageStep(0);
    setShowSuccessModal(false);
    if (sceneBundleRef.current) {
      const telem = sceneBundleRef.current.updateSequence(0, 0.1);
      setTelemetry(telem);
    }
  };

  // Guidance instructions matching the YouTube video tutorial
  const FLIGHT_GUIDE_STEPS = [
    {
      step: 1,
      titleMn: 'Хөөргөлт & Хөдөлгүүр асаах (Liftoff)',
      titleEn: 'Main Engine Ignition & Liftoff',
      descMn: 'Түлхэлтийг 100% болгож, [ШАТЛАХ / STAGE] товчийг дарж пуужингаа хөөргөнө үү!',
      descEn: 'Set throttle to 100% and press STAGE to ignite all 9 main booster engines!',
      actionLabelMn: 'ХӨӨРӨХ / LIFTOFF',
      actionLabelEn: 'LIFTOFF',
    },
    {
      step: 2,
      titleMn: 'Таталцлын эргэлт (Gravity Turn)',
      titleEn: 'Execute Gravity Turn',
      descMn: '10 км өндөрт пуужингийн налууг 45° болгож (Зүүн зүгт), тойрог замын хэвтээ хурд ав!',
      descEn: 'At 10km altitude, tilt pitch to 45° East to build orbital horizontal velocity!',
      actionLabelMn: '1-Р ШАТ САЛГАХ',
      actionLabelEn: 'DECOUPLE BOOSTER',
    },
    {
      step: 3,
      titleMn: '1-р шат салгах (MECO & Decouple)',
      titleEn: 'Stage 1 Booster Decouple',
      descMn: 'Түлхэгчийн шатахуун дуусмагц [ШАТЛАХ] дарж салгаад 2-р шатны вакуум хөдөлгүүр асаа!',
      descEn: 'Stage 1 propellant depleted! Press STAGE to separate booster and ignite MVac!',
      actionLabelMn: '2-Р ШАТ АСААХ',
      actionLabelEn: 'IGNITE S2 VAC',
    },
    {
      step: 4,
      titleMn: 'Хамгаалалтын хавтас унагах (Fairing Jettison)',
      titleEn: 'Payload Fairing Jettison',
      descMn: '70 км-т агаар мандлаас гарах үед [ШАТЛАХ] дарж хавтсыг салган хиймэл дагуулыг ил гарга!',
      descEn: 'Above 70km, exit thick atmosphere and press STAGE to jettison fairing!',
      actionLabelMn: 'ХАВТАС УНАГАХ',
      actionLabelEn: 'JETTISON FAIRING',
    },
    {
      step: 5,
      titleMn: 'Апоапсис руу шилжих (Coast to Apogee)',
      titleEn: 'Coast to Apoapsis & Orbit Map',
      descMn: 'Орбит зураглал [MAP (M)] нээж, Ap цэг хүртэл Time Warp ашиглан хугацааг түргэсгэ!',
      descEn: 'Open Orbit Map (M) and time warp until reaching orbital Apogee (~520km)!',
      actionLabelMn: 'ДУГУЙРУУЛАХ ШАТААЛТ',
      actionLabelEn: 'CIRCULARIZE BURN',
    },
    {
      step: 6,
      titleMn: 'Дугуйруулах түлхэлт (Circularization Burn)',
      titleEn: 'Prograde Circularization Burn',
      descMn: 'Ap дээр 0° (хэвтээ) чиглэлд түлхэж, Перигеег (Pe) 150+ км өсгөн хаалттай тойрог зам үүсгэ!',
      descEn: 'At Apogee, pitch 0° horizontal and burn prograde to raise Periapsis >150km!',
      actionLabelMn: 'ХӨЛӨГ САЛГАХ',
      actionLabelEn: 'DEPLOY SATELLITE',
    },
    {
      step: 7,
      titleMn: 'Хиймэл дагуул салгах & Дэлгэх (Satellite Deploy)',
      titleEn: 'Satellite Deployment & Arrays',
      descMn: 'Тойрог замд орлоо! [ШАТЛАХ] дарж дагуулыг салган нарны зай хураагуурыг дэлгэ!',
      descEn: 'Stable orbit achieved! Press STAGE to decouple satellite & deploy solar panels!',
      actionLabelMn: 'ОРБИТ РУУ ОРОХ',
      actionLabelEn: 'PROCEED TO ORBIT',
    },
  ];

  const currentGuide = FLIGHT_GUIDE_STEPS[Math.min(FLIGHT_GUIDE_STEPS.length - 1, activeStageStep)];

  const isRumbleShaking = launching && !isPaused && ((progress > 0.01 && progress < 0.15) || (progress > 0.22 && progress < 0.35));

  return (
    <div className={`relative w-full h-[calc(100vh-48px)] mt-12 bg-slate-950 overflow-hidden select-none ${isRumbleShaking ? 'rumble-shake' : ''}`}>
      {/* 3D WebGL Canvas */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* TOP BAR: Flight Director Guidance Banner (Matching video tutorial) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[94%] max-w-3xl">
        <div className="aerospace-panel px-3 sm:px-4 py-2 rounded-xl border-sky-500/40 bg-slate-950/90 shadow-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
              telemetry.isOrbitStable ? 'bg-emerald-500 text-slate-950' : 'bg-sky-500/20 text-sky-400 border border-sky-400/50'
            }`}>
              {currentGuide.step}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
                  {language === 'mn' ? 'НИСЛЭГИЙН УДИРДАМЖ' : 'FLIGHT DIRECTOR GUIDE'}
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">•</span>
                <span className="text-xs font-bold text-white truncate">
                  {language === 'mn' ? currentGuide.titleMn : currentGuide.titleEn}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate hidden sm:block">
                {language === 'mn' ? currentGuide.descMn : currentGuide.descEn}
              </p>
            </div>
          </div>

          {/* Autopilot toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                sound.playClick(1000);
                setAutopilot(!autopilot);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all border ${
                autopilot
                  ? 'bg-sky-500/20 text-sky-300 border-sky-400'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={language === 'mn' ? 'Автопилот туслагч' : 'Autopilot Guidance'}
            >
              <Zap className={`w-3 h-3 ${autopilot ? 'text-sky-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">{language === 'mn' ? 'АВТОПИЛОТ' : 'AUTOPILOT'}</span>
              <span>{autopilot ? 'ON' : 'MANUAL'}</span>
            </button>

            {/* Orbit Map View Quick Toggle */}
            <button
              onClick={handleToggleMapView}
              className={`px-3 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all shadow-md ${
                cameraMode === 'map'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
              }`}
              title={language === 'mn' ? 'Орбит зураглал нээх / хаах (M)' : 'Toggle Orbit Map View (M)'}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{cameraMode === 'map' ? (language === 'mn' ? '3D ХӨЛӨГ' : '3D CRAFT') : (language === 'mn' ? 'ОРБИТ MAP' : 'ORBIT MAP')}</span>
              <kbd className="hidden md:inline bg-black/25 px-1 rounded text-[9px]">M</kbd>
            </button>
          </div>
        </div>
      </div>

      {/* TOP LEFT: Telemetry & Orbit Apsis Display */}
      <div className="absolute top-16 left-3 z-20 pointer-events-none max-w-[270px] sm:max-w-xs space-y-2">
        {/* Orbital Trajectory Card (Ellipse Simulator HUD) */}
        <div className="aerospace-panel p-3 rounded-xl border-sky-500/30 bg-slate-950/90 shadow-2xl font-mono text-[11px] space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[10px] font-bold text-sky-400 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" />
              {language === 'mn' ? 'ОРБИТЫН ПАРАМЕТР' : 'ORBIT TELEMETRY'}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
              telemetry.isOrbitStable 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            }`}>
              {telemetry.isOrbitStable ? (language === 'mn' ? 'ТОЙРОГ ЗАМ' : 'CLOSED ORBIT') : (language === 'mn' ? 'СУБ-ОРБИТ' : 'SUB-ORBITAL')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Apoapsis (Ap):</span>
              <span className="text-sky-300 font-bold text-sm">
                {telemetry.apogeeKm > 0 ? `${telemetry.apogeeKm.toLocaleString()} km` : '—'}
              </span>
            </div>
            <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Periapsis (Pe):</span>
              <span className={`font-bold text-sm ${telemetry.perigeeKm > 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {telemetry.perigeeKm > -6000 ? `${telemetry.perigeeKm.toLocaleString()} km` : '—'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="flex justify-between">
              <span className="text-slate-400">T to Ap:</span>
              <span className="text-white font-bold">{telemetry.timeToApogeeSec > 0 ? `${telemetry.timeToApogeeSec}s` : '00:00'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ecc (e):</span>
              <span className="text-white font-bold">{telemetry.orbitEccentricity.toFixed(3)}</span>
            </div>
          </div>

          <div className="pt-1 border-t border-slate-800/80 flex justify-between items-center text-[11px]">
            <span className="text-slate-400">{language === 'mn' ? 'Хурд' : 'Velocity'}:</span>
            <span className="text-emerald-400 font-bold text-xs">{telemetry.velocityKms.toFixed(2)} km/s</span>
          </div>
        </div>

        {/* Camera Selector Pills */}
        <div className="aerospace-panel px-2 py-1.5 rounded-xl border-sky-500/20 bg-slate-950/90 pointer-events-auto flex flex-wrap gap-1 text-[10px] font-mono">
          <Camera className="w-3.5 h-3.5 text-sky-400 ml-1 self-center" />
          {[
            { id: 'chase', label: 'Chase' },
            { id: 'booster', label: 'Booster' },
            { id: 'spacecraft', label: 'Sat' },
            { id: 'cockpit', label: 'FPV' },
            { id: 'tracking', label: 'Track' },
            { id: 'map', label: 'Map' },
            { id: 'free', label: 'Free' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => handleChangeCameraMode(c.id as LaunchCameraMode)}
              className={`px-2 py-0.5 rounded transition-colors ${
                cameraMode === c.id
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Countdown Visual Overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 pointer-events-none">
          <div className="text-center font-mono">
            <div className="text-7xl sm:text-8xl font-bold text-amber-400 tracking-widest drop-shadow-[0_0_30px_rgba(251,191,36,0.8)]">
              T - 00:0{countdown}
            </div>
            <div className="text-sm text-sky-300 tracking-widest mt-2 uppercase font-semibold">
              {language === 'mn' ? 'ХӨӨРӨХ ТООЛОЛ ЯВАГДАЖ БАЙНА' : 'TERMINAL COUNTDOWN SEQUENCE ACTIVE'}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM-LEFT: Authentic NavBall HUD */}
      {launching && showNavBallMobile && (
        <div className="absolute bottom-20 sm:bottom-24 left-3 z-20 pointer-events-auto">
          <NavBallHUD
            language={language}
            pitchDeg={telemetry.pitchDeg}
            rollDeg={telemetry.rollDeg}
            headingDeg={telemetry.headingDeg}
            surfaceVelMs={telemetry.velocityKms * 1000}
            altitudeM={telemetry.altitudeKm * 1000}
            mach={telemetry.mach}
            gForce={telemetry.gForce}
            throttlePct={telemetry.throttlePct}
            sasActive={sasActive}
            onToggleSas={() => {
              sound.playClick(950);
              setSasActive(!sasActive);
            }}
            rcsActive={rcsActive}
            onToggleRcs={() => {
              sound.playClick(1150);
              setRcsActive(!rcsActive);
            }}
            compact={window.innerWidth < 640}
          />
        </div>
      )}

      {/* RIGHT SIDE: Vertical Staging Stack & Manual Throttle (Ellipse Rocket Simulator layout) */}
      {launching && showStagingMobile && (
        <div className="absolute top-16 right-3 z-20 pointer-events-auto max-w-[200px] sm:max-w-[220px] w-full space-y-2">
          {/* Staging Sequence Stack */}
          <div className="aerospace-panel p-2.5 rounded-xl border-sky-500/40 bg-slate-950/95 font-mono text-[10px] shadow-2xl space-y-1.5">
            <div className="flex items-center justify-between border-b border-sky-500/20 pb-1">
              <span className="text-sky-400 font-bold flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {language === 'mn' ? 'ШАТЛАЛ БА ДАРААЛАЛ' : 'STAGING STACK'}
              </span>
              <span className="text-[9px] text-emerald-400 font-bold">Δv 7,080 m/s</span>
            </div>

            {/* Stages Stack */}
            <div className="space-y-1">
              {/* Stage 05: Satellite Deployment */}
              <div className={`p-1.5 rounded border transition-all ${
                telemetry.isPayloadDeployed
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                  : progress >= 0.85
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 animate-pulse font-bold'
                  : 'bg-slate-900/80 border-slate-800 text-slate-500'
              }`}>
                <div className="flex justify-between">
                  <span>05 {language === 'mn' ? 'ХӨЛӨГ САЛГАХ' : 'SATELLITE'}</span>
                  <span>{telemetry.isPayloadDeployed ? 'DEPLOYED' : 'ARMED'}</span>
                </div>
              </div>

              {/* Stage 04: Fairing Jettison */}
              <div className={`p-1.5 rounded border transition-all ${
                telemetry.isFairingSeparated
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : progress >= 0.55
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse font-bold'
                  : 'bg-slate-900/80 border-slate-800 text-slate-500'
              }`}>
                <div className="flex justify-between">
                  <span>04 {language === 'mn' ? 'ХАВТАС УНАГАХ' : 'FAIRING'}</span>
                  <span>{telemetry.isFairingSeparated ? 'JETTISONED' : 'ATTACHED'}</span>
                </div>
              </div>

              {/* Stage 03: Upper Stage MVac */}
              <div className={`p-1.5 rounded border transition-all ${
                progress >= 0.88
                  ? 'bg-slate-900/80 border-slate-800 text-slate-500'
                  : telemetry.isBoosterSeparated
                  ? 'bg-sky-500/25 border-sky-400 text-sky-200 font-bold'
                  : 'bg-slate-900/80 border-slate-800 text-slate-500'
              }`}>
                <div className="flex justify-between">
                  <span>03 {language === 'mn' ? '2-Р ШАТ MVAC' : 'STAGE 2 VAC'}</span>
                  <span className="text-amber-400">{telemetry.isBoosterSeparated && progress < 0.88 ? 'FIRING' : 'READY'}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1 mt-1 overflow-hidden">
                  <div
                    className="bg-sky-400 h-full"
                    style={{ width: `${telemetry.isBoosterSeparated ? Math.max(0, 100 - (progress - 0.4) * 200) : 100}%` }}
                  />
                </div>
              </div>

              {/* Stage 02: Booster Decoupler */}
              <div className={`p-1.5 rounded border transition-all ${
                telemetry.isBoosterSeparated
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : progress >= 0.35
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse font-bold'
                  : 'bg-slate-900/80 border-slate-800 text-slate-500'
              }`}>
                <div className="flex justify-between">
                  <span>02 {language === 'mn' ? 'ШИЛЖИХ ЦАГАРИГ' : 'INTERSTAGE'}</span>
                  <span>{telemetry.isBoosterSeparated ? 'SEPARATED' : 'LOCKED'}</span>
                </div>
              </div>

              {/* Stage 01: Core Booster 9x Engines */}
              <div className={`p-1.5 rounded border transition-all ${
                telemetry.isBoosterSeparated
                  ? 'bg-slate-900/80 border-slate-800 text-slate-500'
                  : progress > 0.05
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400'
              }`}>
                <div className="flex justify-between">
                  <span>01 {language === 'mn' ? 'ҮНДСЭН ТҮЛХЭГЧ (9)' : 'MAIN BOOSTER (9)'}</span>
                  <span className="text-amber-400">{!telemetry.isBoosterSeparated && progress > 0.05 ? 'FIRING' : 'IDLE'}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1 mt-1 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full"
                    style={{ width: `${Math.max(0, 100 - (progress / 0.4) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Interactive Flight Controls Slider: Throttle & Pitch */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <div className="flex justify-between items-center text-[9px] text-slate-400">
                <span>{language === 'mn' ? 'ТҮЛХЭЛТ' : 'THROTTLE'}</span>
                <span className="text-white font-bold">{manualThrottle}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={manualThrottle}
                onChange={e => setManualThrottle(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <div className="flex gap-1 text-[9px]">
                <button
                  onClick={() => setManualThrottle(0)}
                  className="flex-1 py-0.5 rounded bg-slate-900 border border-slate-800 hover:text-white"
                >
                  CUT (X)
                </button>
                <button
                  onClick={() => setManualThrottle(100)}
                  className="flex-1 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/50 hover:bg-sky-500/30"
                >
                  MAX (Z)
                </button>
              </div>
            </div>

            {/* Prominent Stage Button (SPACE) */}
            <button
              onClick={handleTriggerStageAction}
              className="w-full py-2.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.5)] active:scale-95 animate-pulse"
            >
              <Flame className="w-4 h-4 fill-current" />
              <span>{language === 'mn' ? currentGuide.actionLabelMn : currentGuide.actionLabelEn}</span>
              <kbd className="hidden sm:inline bg-black/25 px-1 py-0.5 rounded text-[9px] ml-1">SPACE</kbd>
            </button>
          </div>
        </div>
      )}

      {/* Unified Bottom Control Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-5xl pointer-events-auto">
        <div className="aerospace-panel rounded-xl overflow-hidden shadow-2xl border-sky-500/40 bg-slate-950/95">
          {/* Rocket Selector Tabs (when not launched) */}
          {!launching && (
            <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2.5 bg-slate-900/95 border-b border-sky-500/20 max-h-56 overflow-y-auto">
              {LAUNCH_VEHICLES.map((rocket: LaunchVehicle) => {
                const isSelected = rocket.id === selectedRocket.id;
                const canCarry = specs.wetMassKg <= rocket.maxLeoPayloadKg;
                return (
                  <div
                    key={rocket.id}
                    onClick={() => {
                      sound.playClick(1000);
                      onSelectRocket(rocket);
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs text-white">{rocket.name}</span>
                      <span className="text-[10px] font-mono text-emerald-400">${rocket.launchCostM}M</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                      {rocket.description}
                    </p>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className={canCarry ? 'text-sky-300' : 'text-rose-400 font-bold'}>
                        Max LEO: {rocket.maxLeoPayloadKg.toLocaleString()} kg
                      </span>
                      <span className="text-slate-400">Rel: {rocket.reliabilityPercent}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action & Playback Bar */}
          <div className="px-3 sm:px-4 py-2.5 bg-slate-950/95 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            {/* Status & Progress Bar */}
            <div className="text-xs font-mono flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              {!launching ? (
                <span className="text-slate-400 text-[11px] sm:text-xs">
                  {t.launch?.launchReady || 'Launch Ready'}: <strong className="text-white">{design.name}</strong> on <strong className="text-sky-400">{selectedRocket.name}</strong>.
                </span>
              ) : progress < 1 ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-28 sm:w-40 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-sky-400 h-full transition-all" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <span className="text-sky-300 font-bold text-xs">
                    {Math.round(progress * 100)}% {language === 'mn' ? 'НИСЛЭГ' : 'FLIGHT'}
                  </span>
                  <span className="text-slate-400 hidden sm:inline">• {language === 'mn' ? currentGuide.titleMn : currentGuide.titleEn}</span>
                </div>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  {language === 'mn' ? 'ТОЙРОГ ЗАМД АМЖИЛТТАЙ ГАРГАЛАА!' : 'STABLE ORBIT INSERTION CONFIRMED'}
                </span>
              )}

              {/* Mobile toggles for HUD panels */}
              {launching && (
                <div className="flex items-center gap-1 sm:hidden">
                  <button
                    onClick={() => setShowNavBallMobile(!showNavBallMobile)}
                    className={`px-2 py-1 rounded text-[10px] font-mono border ${showNavBallMobile ? 'bg-sky-500/20 text-sky-300 border-sky-400' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                  >
                    NavBall
                  </button>
                  <button
                    onClick={() => setShowStagingMobile(!showStagingMobile)}
                    className={`px-2 py-1 rounded text-[10px] font-mono border ${showStagingMobile ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                  >
                    Stage
                  </button>
                </div>
              )}
            </div>

            {/* Playback & Action Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {!launching ? (
                <button
                  disabled={isPayloadOverloaded || countdown !== null}
                  onClick={handleStartCountdown}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                    isPayloadOverloaded
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.35)] active:scale-95'
                  }`}
                >
                  <Rocket className="w-4 h-4" />
                  <span>{language === 'mn' ? 'ХӨӨРГӨЛТИЙГ ЭХЛҮҮЛЭХ' : 'START COUNTDOWN & LAUNCH'}</span>
                </button>
              ) : progress < 1 ? (
                <>
                  {/* Play/Pause */}
                  <button
                    onClick={() => {
                      sound.playClick();
                      setIsPaused(!isPaused);
                    }}
                    className="p-2 sm:p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title={isPaused ? (t.common?.play || 'Play') : (t.common?.pause || 'Pause')}
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>

                  {/* Speed toggles */}
                  <div className="flex items-center rounded-lg bg-slate-800/80 border border-slate-700 p-0.5 text-[10px] font-mono">
                    {[1, 2, 5, 10].map(spd => (
                      <button
                        key={spd}
                        onClick={() => {
                          sound.playClick();
                          setSpeedMultiplier(spd);
                        }}
                        className={`px-2 py-1.5 rounded transition-colors ${speedMultiplier === spd ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  {/* Skip to orbit */}
                  <button
                    onClick={handleSkipToOrbit}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 border border-slate-700 min-h-[40px]"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t.launch?.fastForward || 'Fast Forward'}</span>
                  </button>

                  {/* Reset */}
                  <button
                    onClick={handleResetLaunch}
                    className="p-2 sm:p-2.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title={t.common?.reset || 'Reset'}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleResetLaunch}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 min-h-[44px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.common?.retry || 'Retry'}</span>
                  </button>
                  <button
                    onClick={() => {
                      sound.playLockChime();
                      onLaunchComplete();
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(56,189,248,0.35)] min-h-[44px] active:scale-95"
                  >
                    <span>{language === 'mn' ? 'ОРБИТ ЧИГЛҮҮЛЭЛТЭД ОРОХ' : 'PROCEED TO ORBITAL NAV'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SATELLITE DEPLOYMENT SUCCESS MODAL (Ellipse Rocket Simulator Victory Screen) */}
      {showSuccessModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 pointer-events-auto animate-fade-in">
          <div className="aerospace-panel max-w-md w-full p-6 rounded-2xl border-emerald-500/50 bg-slate-950/95 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-wider uppercase">
                  {language === 'mn' ? 'ОРБИТЫН ДААЛГАВАР АМЖИЛТТАЙ' : 'ORBIT INSERTION SUCCESSFUL'}
                </span>
                <h3 className="text-lg font-bold text-white">
                  {design.name} {language === 'mn' ? 'дэлгэгдлээ' : 'Deployed'}
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {language === 'mn'
                ? 'Хиймэл дагуул 520 км-ийн тойрог замд амжилттай байршиж, нарны зай хураагуур болон холбооны антеннуудаа дэлгэн ажиллаж эхэллээ. Пуужингийн үе шатууд ном ёсоор бүрэн биелэгдлээ!'
                : 'The satellite has been successfully inserted into a 520 km circular orbit. Solar arrays and high-gain communication antennas are fully operational!'}
            </p>

            {/* Orbit Summary Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block">Apoapsis (Ap):</span>
                <span className="text-emerald-300 font-bold text-sm">520.0 km</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Periapsis (Pe):</span>
                <span className="text-emerald-300 font-bold text-sm">508.4 km</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Velocity:</span>
                <span className="text-white font-bold">7,612 m/s</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Orbital Period:</span>
                <span className="text-white font-bold">94.8 min</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  sound.playClick();
                  setShowSuccessModal(false);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors"
              >
                {language === 'mn' ? 'Үзэх горимд үлдэх' : 'Stay in View'}
              </button>
              <button
                onClick={() => {
                  sound.playLockChime();
                  setShowSuccessModal(false);
                  onLaunchComplete();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)]"
              >
                <span>{language === 'mn' ? 'Цааш үргэлжлүүлэх' : 'Proceed to Mission'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
