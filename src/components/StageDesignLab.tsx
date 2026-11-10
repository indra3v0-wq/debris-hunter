/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SpacecraftDesign, CalculatedSpecs } from '../types';
import { 
  BUS_OPTIONS, 
  SOLAR_OPTIONS, 
  PROPULSION_OPTIONS, 
  RCS_OPTIONS, 
  SENSOR_OPTIONS, 
  CAPTURE_OPTIONS 
} from '../simulation/data';
import { buildModularSpacecraft } from '../three/spacecraftBuilder';
import { sound } from '../utils/audio';
import { 
  Wrench, 
  Zap, 
  Scale, 
  DollarSign, 
  AlertTriangle, 
  ArrowRight, 
  Sliders, 
  CheckCircle2, 
  Layers, 
  Compass, 
  Eye, 
  Flame,
  BatteryCharging
} from 'lucide-react';

interface StageDesignLabProps {
  language?: import('../types').Language;
  design: SpacecraftDesign;
  specs: CalculatedSpecs;
  budgetM: number;
  onUpdateDesign: (newDesign: SpacecraftDesign) => void;
  onProceedToLaunch: () => void;
}

type DesignTab = 'structure' | 'solar' | 'propulsion' | 'rcs' | 'sensors' | 'capture' | 'propellant';

export const StageDesignLab: React.FC<StageDesignLabProps> = ({
  language = 'mn',
  design,
  specs,
  budgetM,
  onUpdateDesign,
  onProceedToLaunch,
}) => {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<DesignTab>('structure');
  const [explodedView, setExplodedView] = useState<number>(0);
  const [hudCollapsed, setHudCollapsed] = useState(false);

  const modelRef = useRef<ReturnType<typeof buildModularSpacecraft> | null>(null);

  // Mount 3D Scene
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
    scene.background = new THREE.Color(0x030712);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(14, 28, 0x0284c7, 0x1e293b);
    gridHelper.position.y = -2.5;
    scene.add(gridHelper);

    // Clean Studio 3-point lighting
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(6, 8, 8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    fillLight.position.set(-6, -2, -6);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.0);
    rimLight.position.set(0, 10, -8);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 2, 7.5);

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
    controls.minDistance = 3.5;
    controls.maxDistance = 18;

    // Build initial modular spacecraft
    let spacecraftModel = buildModularSpacecraft(design);
    scene.add(spacecraftModel.group);
    modelRef.current = spacecraftModel;

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      // Gentle auto-rotation
      spacecraftModel.group.rotation.y += 0.003;
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
      spacecraftModel.dispose();
      gridHelper.dispose();
      keyLight.dispose();
      fillLight.dispose();
      rimLight.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update 3D model when design changes
  useEffect(() => {
    if (!modelRef.current) return;
    const scene = modelRef.current.group.parent as THREE.Scene;
    if (!scene) return;

    scene.remove(modelRef.current.group);
    modelRef.current.dispose();

    const newModel = buildModularSpacecraft(design);
    newModel.setExplodedProgress(explodedView / 100);
    scene.add(newModel.group);
    modelRef.current = newModel;
  }, [design.bus.id, design.solar.id, design.propulsion.id, design.captureMechanism.id]);

  // Update exploded view slider
  const handleExplodedSlider = (val: number) => {
    setExplodedView(val);
    if (modelRef.current) {
      modelRef.current.setExplodedProgress(val / 100);
    }
  };

  const isPowerDeficit = specs.netPowerMarginW < 0;
  const isBudgetExceeded = specs.estimatedTotalCostM > budgetM;
  const isDeltaVLow = specs.deltaVMs < 1200;

  return (
    <div className="relative w-full h-[calc(100vh-48px)] mt-12 bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left: Subsystem Specs HUD */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none max-w-sm">
        <div className="aerospace-panel p-3.5 rounded-lg border-sky-500/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            <span className="text-[11px] font-mono font-bold text-sky-400 tracking-wider">
              {language === 'mn' ? 'ҮЕ ШАТ 3 // ХӨЛГИЙН ИХ БИЕ & ИНЖЕНЕРЧЛЭЛ' : 'STAGE 3 // SPACECRAFT LAB & BUS INTEGRATION'}
            </span>
          </div>
          <h1 className="text-base font-bold text-white tracking-wide">
            {design.name}
          </h1>

          {/* Mass & Power Budget Readouts */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 bg-slate-950/85 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">
                {language === 'mn' ? 'ХӨӨРГӨХ НИЙТ МАСС' : 'WET LAUNCH MASS'}
              </span>
              <span className="text-white font-bold text-sm">{specs.wetMassKg} kg</span>
              <span className="text-slate-500 text-[10px] block">{language === 'mn' ? 'Хуурай:' : 'Dry:'} {specs.dryMassKg} kg</span>
            </div>

            <div className="p-2 bg-slate-950/85 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">
                {language === 'mn' ? 'ХУРДАТГАЛЫН НӨӨЦ (ΔV)' : 'MISSION DELTA-V'}
              </span>
              <span className={`font-bold text-sm ${isDeltaVLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                {specs.deltaVMs} m/s
              </span>
              <span className="text-slate-500 text-[10px] block">{language === 'mn' ? 'Шаардлага: ~1,200 м/с' : 'Req: ~1,200 m/s'}</span>
            </div>

            <div className="p-2 bg-slate-950/85 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">
                {language === 'mn' ? 'ЭРЧИМ ХҮЧНИЙ ЗӨРҮҮ' : 'POWER MARGIN'}
              </span>
              <span className={`font-bold text-sm ${isPowerDeficit ? 'text-rose-400' : 'text-emerald-400'}`}>
                {specs.netPowerMarginW >= 0 ? `+${specs.netPowerMarginW}` : specs.netPowerMarginW} W
              </span>
              <span className="text-slate-500 text-[10px] block">{language === 'mn' ? 'Үүсгүүр:' : 'Gen:'} {specs.powerGenerationW}W</span>
            </div>

            <div className="p-2 bg-slate-950/85 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">
                {language === 'mn' ? 'ТООЦООТ ӨРТӨГ' : 'ESTIMATED COST'}
              </span>
              <span className={`font-bold text-sm ${isBudgetExceeded ? 'text-rose-400' : 'text-white'}`}>
                ${specs.estimatedTotalCostM}M
              </span>
              <span className="text-slate-500 text-[10px] block">{language === 'mn' ? 'Төсөв:' : 'Budget:'} ${budgetM}M</span>
            </div>
          </div>

          {/* Warnings */}
          {(isPowerDeficit || isBudgetExceeded || isDeltaVLow) && (
            <div className="mt-2.5 p-2 rounded bg-rose-950/60 border border-rose-500/40 text-[11px] text-rose-300 space-y-1">
              {isPowerDeficit && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>
                    {language === 'mn' ? 'АЮУЛ: Цахилгаан дутагдалтай! Нарны зайг томсгоно уу.' : 'CRITICAL: Power deficit! Upgrade solar arrays.'}
                  </span>
                </div>
              )}
              {isBudgetExceeded && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {language === 'mn' ? `АНХААР: Өртөг даалгаврын төсвөөс (${budgetM}$M) хэтэрсэн.` : `WARNING: Cost exceeds budget (${budgetM}M).`}
                  </span>
                </div>
              )}
              {isDeltaVLow && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <span>
                    {language === 'mn' ? 'СЭРЭМЖЛҮҮЛЭГ: Дельта-V нөөц хогтой залгагдах ба устгахад бага байна.' : 'CAUTION: Low Delta-V margin for rendezvous and deorbit.'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Top Right: Exploded View Slider */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto">
        <div className="aerospace-panel px-3 py-2 rounded-lg border-sky-500/30 flex items-center gap-3 text-xs font-mono">
          <Sliders className="w-4 h-4 text-sky-400" />
          <span className="text-slate-300">
            {language === 'mn' ? 'ДЭЛГЭСЭН ХАРАГДАЦ (ИНЖЕНЕРЧЛЭЛ):' : 'EXPLODED ASSEMBLY:'}
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={explodedView}
            onChange={(e) => handleExplodedSlider(Number(e.target.value))}
            className="w-24 accent-sky-400 cursor-pointer"
          />
          <span className="text-sky-300 w-8">{explodedView}%</span>
        </div>
      </div>

      {/* Unified Bottom Control Dock */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-5xl transition-transform duration-300 ${
          hudCollapsed ? 'translate-y-[calc(100%-2.25rem)]' : 'translate-y-0'
        }`}
      >
        <div className="aerospace-panel rounded-xl overflow-hidden shadow-2xl border-sky-500/40">
          {/* Header & Subsystem Tab Navigation */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/95 border-b border-sky-500/20 text-xs font-mono">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
              {[
                { id: 'structure', label: language === 'mn' ? '1. Хөлгийн Их Бие (Bus)' : '1. Bus Chassis' },
                { id: 'solar', label: language === 'mn' ? '2. Нарны Зай' : '2. Solar Power' },
                { id: 'propulsion', label: language === 'mn' ? '3. Үндсэн Хөдөлгүүр' : '3. Main Engine' },
                { id: 'rcs', label: language === 'mn' ? '4. RCS Чиглүүлэгч' : '4. RCS Attitude' },
                { id: 'sensors', label: language === 'mn' ? '5. Сенсорын Багц' : '5. Sensors Suite' },
                { id: 'capture', label: language === 'mn' ? '6. Хог Баригч Гар/Тор' : '6. Capture Tool' },
                { id: 'propellant', label: language === 'mn' ? '7. Түлш Цэнэглэлт' : '7. Fuel Loading' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    sound.playClick();
                    setActiveTab(tab.id as DesignTab);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-colors border ${
                    activeTab === tab.id
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                      : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                sound.playClick();
                setHudCollapsed(!hudCollapsed);
              }}
              className="hover:text-white px-2 py-0.5 rounded bg-slate-800/60 hover:bg-slate-700 text-[11px] transition-colors shrink-0 ml-2"
            >
              {hudCollapsed
                ? (language === 'mn' ? '▴ Угсралтын цэсийг дэлгэх' : '▴ Show Assembly Options')
                : (language === 'mn' ? '▾ Харагдацыг хураах' : '▾ Collapse View')}
            </button>
          </div>

          {/* Subsystem Selection Content */}
          <div className="p-3 bg-slate-900/95 max-h-56 overflow-y-auto">
            {/* STRUCTURE */}
            {activeTab === 'structure' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {BUS_OPTIONS.map(bus => (
                  <div
                    key={bus.id}
                    onClick={() => {
                      sound.playClick(1000);
                      onUpdateDesign({ ...design, bus });
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      design.bus.id === bus.id
                        ? 'bg-sky-500/15 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs text-white">
                        {language === 'mn' ? bus.nameMn : bus.name}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">${bus.baseCostM}M</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                      {language === 'mn' ? bus.descriptionMn : bus.descriptionEn}
                    </p>
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Mass: {bus.massKg} kg</span>
                      <span>Power: {bus.powerDrawW} W</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SOLAR POWER */}
            {activeTab === 'solar' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {SOLAR_OPTIONS.map(solar => (
                  <div
                    key={solar.id}
                    onClick={() => {
                      sound.playClick(1050);
                      onUpdateDesign({ ...design, solar });
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      design.solar.id === solar.id
                        ? 'bg-sky-500/15 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs text-white">
                        {language === 'mn' ? solar.nameMn : solar.name}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">${solar.costM}M</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                      {language === 'mn' ? solar.descriptionMn : solar.descriptionEn}
                    </p>
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span className="text-yellow-400 font-bold">Gen: +{solar.powerGenW} W</span>
                      <span>Mass: {solar.massKg} kg</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PROPULSION */}
            {activeTab === 'propulsion' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {PROPULSION_OPTIONS.map(prop => (
                  <div
                    key={prop.id}
                    onClick={() => {
                      sound.playClick(1100);
                      onUpdateDesign({ ...design, propulsion: prop });
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      design.propulsion.id === prop.id
                        ? 'bg-sky-500/15 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs text-white">
                        {language === 'mn' ? prop.nameMn : prop.name}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">${prop.costM}M</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                      {language === 'mn' ? prop.descriptionMn : prop.descriptionEn}
                    </p>
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span className="text-sky-300 font-bold">Isp: {prop.ispSeconds} s</span>
                      <span>Thrust: {prop.thrustN} N</span>
                      <span>Dry: {prop.engineDryMassKg} kg</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* RCS */}
            {activeTab === 'rcs' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {RCS_OPTIONS.map(rcs => (
                  <div
                    key={rcs.id}
                    onClick={() => {
                      sound.playClick(1150);
                      onUpdateDesign({ ...design, rcs });
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      design.rcs.id === rcs.id
                        ? 'bg-sky-500/15 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs text-white">
                        {language === 'mn' ? rcs.nameMn : rcs.name}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">${rcs.costM}M</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                      {language === 'mn' ? rcs.descriptionMn : rcs.descriptionEn}
                    </p>
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Thrust: {rcs.thrustN} N</span>
                      <span>Isp: {rcs.ispSeconds} s</span>
                      <span>Mass: {rcs.massKg} kg</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SENSORS */}
            {activeTab === 'sensors' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {SENSOR_OPTIONS.map(sensor => {
                  const isEquipped = design.sensors.some(s => s.id === sensor.id);
                  return (
                    <div
                      key={sensor.id}
                      onClick={() => {
                        sound.playClick();
                        let updated = [...design.sensors];
                        if (isEquipped) {
                          if (updated.length > 1) {
                            updated = updated.filter(s => s.id !== sensor.id);
                          }
                        } else {
                          updated.push(sensor);
                        }
                        onUpdateDesign({ ...design, sensors: updated });
                      }}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        isEquipped
                          ? 'bg-sky-500/15 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-xs text-white">
                          {language === 'mn' ? sensor.nameMn : sensor.name}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400">${sensor.costM}M</span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                        {language === 'mn' ? sensor.descriptionMn : sensor.descriptionEn}
                      </p>
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>Range: {sensor.rangeKm} km</span>
                        <span className="text-sky-300">Res: {sensor.accuracyCm} cm</span>
                        <span className={isEquipped ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                          {isEquipped ? 'EQUIPPED' : 'ADD'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* CAPTURE TOOL */}
            {activeTab === 'capture' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                {CAPTURE_OPTIONS.map(cap => (
                  <div
                    key={cap.id}
                    onClick={() => {
                      sound.playLockChime();
                      onUpdateDesign({ ...design, captureMechanism: cap });
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between ${
                      design.captureMechanism.id === cap.id
                        ? 'bg-sky-500/15 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-xs text-white line-clamp-1">
                          {language === 'mn' ? cap.nameMn : cap.name}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400">${cap.costM}M</span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                        {language === 'mn' ? cap.descriptionMn : cap.descriptionEn}
                      </p>
                    </div>
                    <div className="text-[10px] font-mono space-y-1 pt-1.5 border-t border-slate-800">
                      <div className="text-emerald-400 flex justify-between">
                        <span>Max Reach:</span>
                        <span>{cap.maxDistanceM} m</span>
                      </div>
                      <div className="text-amber-400 flex justify-between">
                        <span>Tumble Tol:</span>
                        <span>{cap.maxTumbleToleranceDegS}°/s</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PROPELLANT MASS SLIDER */}
            {activeTab === 'propellant' && (
              <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    {language === 'mn' ? 'Түлшний багтаамж (Циолковскийн томьёоны тооцоолол)' : 'Propellant Tank Mass Loading (Tsiolkovsky Sizing)'}
                  </span>
                  <span className="text-sm font-mono font-bold text-amber-400">
                    {design.fuelMassKg} kg
                  </span>
                </div>
                <input
                  type="range"
                  min="250"
                  max="2200"
                  step="25"
                  value={design.fuelMassKg}
                  onChange={(e) => {
                    onUpdateDesign({ ...design, fuelMassKg: Number(e.target.value) });
                  }}
                  className="w-full accent-amber-400 cursor-pointer mb-2"
                />
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>250 kg {language === 'mn' ? '(Хөнгөн маневр)' : '(Agile/Light)'}</span>
                  <span className="text-sky-300 font-bold">
                    {language === 'mn' ? 'Тооцоот Δv:' : 'Calculated Δv:'} {specs.deltaVMs} m/s
                  </span>
                  <span>2,200 kg {language === 'mn' ? '(Дээд хэмжээ)' : '(Maximum)'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="px-4 py-3 bg-slate-950/95 border-t border-sky-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs font-mono text-slate-400">
              <span>{language === 'mn' ? 'СИСТЕМИЙН НАЙДВАРЖИЛТ:' : 'SYSTEM RELIABILITY:'} </span>
              <span className="text-emerald-400 font-bold">{specs.overallReliability}%</span>
              <span className="mx-2">•</span>
              <span>{language === 'mn' ? 'ХӨӨРГӨХ НИЙТ ЖИН:' : 'WET MASS:'} </span>
              <span className="text-white font-bold">{specs.wetMassKg} kg</span>
            </div>

            <button
              onClick={() => {
                sound.playLockChime();
                onProceedToLaunch();
              }}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-[0_0_15px_rgba(56,189,248,0.35)]"
            >
              <span>{language === 'mn' ? 'ХӨЛГИЙН ТОНОГЛОЛЫГ БАТАЛЖ, ПУУЖИН СОНГОХ' : 'COMMIT DESIGN & SELECT LAUNCH VEHICLE'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
