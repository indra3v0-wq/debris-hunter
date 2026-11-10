/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { MissionState, MissionTarget, Language } from '../types';
import { sound } from '../utils/audio';
import { 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  ArrowRight, 
  ShieldCheck, 
  Orbit, 
  DollarSign, 
  Flame, 
  Zap, 
  Download,
  Share2,
  FileText,
  BadgeCheck,
  Scale,
  Gauge,
  Clock,
  Sparkles
} from 'lucide-react';

interface StageEvaluationProps {
  language?: Language;
  missionState: MissionState;
  onSelectNewMission: () => void;
  onRedesignSpacecraft: () => void;
}

export const StageEvaluation: React.FC<StageEvaluationProps> = ({
  language = 'mn',
  missionState,
  onSelectNewMission,
  onRedesignSpacecraft,
}) => {
  const target = missionState.selectedMission;
  const design = missionState.design;
  const specs = missionState.specs;

  const isMn = language === 'mn';
  const [certDownloaded, setCertDownloaded] = useState<boolean>(false);

  useEffect(() => {
    sound.playLockChime();
    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#38bdf8', '#34d399', '#f59e0b', '#ec4899', '#ffffff'],
      });
    } catch {}
  }, []);

  // 1. FACTOR 1: Cleared Debris Mass & Danger Level
  const debrisMassScore = Math.min(100, Math.round((target.massKg / 8000) * 30 + (target.hazardScore * 0.7)));
  const secondaryFragmentsPrevented = Math.round(target.massKg * 1.65);

  // 2. FACTOR 2: Fuel Consumption & Utilization Efficiency
  const fuelConsumedKg = Math.max(1, design.fuelMassKg - missionState.fuelRemainingKg);
  const fuelRemainingPct = Math.round((missionState.fuelRemainingKg / design.fuelMassKg) * 100);
  const fuelEfficiencyScore = Math.min(100, Math.max(40, Math.round(100 - (fuelConsumedKg / design.fuelMassKg) * 55)));
  const ispRating = design.propulsion.ispSeconds;

  // 3. FACTOR 3: Atmospheric Incineration Success (Re-entry & Ablation)
  const ablationScore = 100; // Controlled entry into Point Nemo Oceanic Corridor
  const entryFlightAngleDeg = -1.82; // Nominal entry angle

  // 4. FACTOR 4: Time Performance & Orbital Safety Score
  const flightDurationSec = missionState.flightTimeSeconds || 420;
  const flightMinutes = Math.floor(flightDurationSec / 60);
  const flightSeconds = flightDurationSec % 60;
  const timeScore = Math.min(100, Math.max(65, 100 - Math.floor(flightMinutes * 2)));

  // Pre vs Post Orbital Safety Index
  const preSafetyIndex = Math.max(25, 100 - target.hazardScore);
  const postSafetyIndex = 98; // neutralized threat
  const kesslerMitigationPct = (target.hazardScore * 0.26).toFixed(1);

  // Overall Calculated Score
  const overallScore = Math.round(
    (debrisMassScore * 0.30) +
    (fuelEfficiencyScore * 0.25) +
    (ablationScore * 0.25) +
    (timeScore * 0.20)
  );

  let rankTitle = isMn ? 'ЕРӨНХИЙ САНСРЫН ИНЖЕНЕР' : 'CHIEF AEROSPACE ENGINEER';
  let rankBadgeColor = 'text-amber-400 border-amber-400 bg-amber-400/10 shadow-[0_0_15px_rgba(251,191,36,0.25)]';
  if (overallScore < 75) {
    rankTitle = isMn ? 'САНСРЫН КАДЕТ' : 'SPACE CADET';
    rankBadgeColor = 'text-slate-300 border-slate-400 bg-slate-800/40';
  } else if (overallScore < 85) {
    rankTitle = isMn ? 'ТУСЛАХ НИСЛЭГИЙН ИНЖЕНЕР' : 'JUNIOR FLIGHT ENGINEER';
    rankBadgeColor = 'text-sky-400 border-sky-400 bg-sky-400/10 shadow-[0_0_15px_rgba(56,189,248,0.25)]';
  } else if (overallScore < 95) {
    rankTitle = isMn ? 'САНСРЫН СИСТЕМИЙН ИНЖЕНЕР' : 'SPACE SYSTEMS ENGINEER';
    rankBadgeColor = 'text-emerald-400 border-emerald-400 bg-emerald-400/10 shadow-[0_0_15px_rgba(16,185,129,0.25)]';
  }

  const certNumber = `MN-NSMA-ODR-2026-${target.code.replace(' ', '')}-9427`;

  const handleDownloadCertificate = () => {
    sound.playClick(1400);
    setCertDownloaded(true);
    window.print();
  };

  return (
    <div className="relative w-full min-h-[calc(100vh-48px)] mt-12 bg-slate-950 py-8 px-4 overflow-y-auto select-none font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* OFFICIAL NSMA CERTIFICATE CARD */}
        <div className="aerospace-panel p-6 sm:p-8 rounded-2xl border-amber-500/50 bg-slate-950/95 relative overflow-hidden shadow-2xl">
          {/* Subtle watermarked seal in background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-amber-500/10 pointer-events-none flex items-center justify-center">
            <span className="text-8xl text-amber-500/5 font-bold">☸</span>
          </div>

          {/* Certificate Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-8 rounded border border-amber-400/80 overflow-hidden flex shadow-lg shrink-0">
                <div className="w-1/3 bg-[#da291c] flex items-center justify-center text-[8px] text-yellow-300 font-bold">☸</div>
                <div className="w-1/3 bg-[#0055b8]" />
                <div className="w-1/3 bg-[#da291c]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-amber-400 tracking-widest uppercase">
                    {isMn ? 'МОНГОЛЫН САНСРЫН УДИРДАХ ГАЗАР (NSMA)' : 'NATIONAL SPACE MANAGEMENT AGENCY'}
                  </span>
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  {isMn ? 'ТОЙРОГ ЗАМЫГ ЦЭВЭРЛЭСЭН АЛБАН ЁСНЫ БАТЛАМЖ' : 'OFFICIAL ORBITAL REMOVAL CERTIFICATE'}
                </h1>
                <span className="text-[11px] font-mono text-slate-400">
                  {isMn ? 'Гэрчилгээний дугаар:' : 'Certificate ID:'} <strong className="text-sky-300">{certNumber}</strong>
                </span>
              </div>
            </div>

            {/* Score & Rank Badge */}
            <div className="flex items-center gap-3 self-end sm:self-auto font-mono">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">
                  {isMn ? 'БОДИТ ҮНЭЛГЭЭ' : 'TOTAL SCORE'}
                </span>
                <span className="text-3xl font-bold text-emerald-400">{overallScore}/100</span>
              </div>
              <div className={`px-3 py-2 rounded-xl border text-center ${rankBadgeColor}`}>
                <Award className="w-5 h-5 mx-auto mb-0.5 text-amber-400" />
                <span className="text-[10px] font-bold block">{rankTitle}</span>
              </div>
            </div>
          </div>

          {/* 4 REALISTIC MULTI-FACTOR CALCULATION CATEGORIES */}
          <div className="mt-6 space-y-4 font-mono text-xs">
            <h2 className="text-xs font-bold text-sky-400 tracking-wider uppercase flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-sky-400" />
              <span>{isMn ? 'БОДИТ ҮЗҮҮЛЭЛТИЙН АВТОМАТ ТООЦООЛОЛ' : 'AUTOMATED MULTI-FACTOR EVALUATION'}</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Category 1: Debris Mass & Danger Rating */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-white font-bold border-b border-slate-800 pb-1.5">
                  <span className="text-sky-300 flex items-center gap-1.5">
                    <span>1.</span>
                    <span>{isMn ? 'Хогны хэмжээ ба Аюулын зэрэг' : 'Debris Mass & Hazard Class'}</span>
                  </span>
                  <span className="text-emerald-400">{debrisMassScore}/100</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isMn ? 'Устгасан бодит масс:' : 'Cleared Debris Mass:'}</span>
                    <span className="font-bold text-white">{target.massKg.toLocaleString()} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isMn ? 'Аюулын түвшин:' : 'Hazard Level:'}</span>
                    <span className="font-bold text-rose-400">{target.hazardScore}/100 ({target.hazardScore >= 80 ? 'CRITICAL' : 'ELEVATED'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isMn ? 'Урьдчилан сэргийлсэн хэлтэрхий:' : 'Secondary Breakup Prevented:'}</span>
                    <span className="font-bold text-emerald-400">~{secondaryFragmentsPrevented.toLocaleString()} fragments</span>
                  </div>
                </div>
              </div>

              {/* Category 2: Fuel Expenditure & Efficiency */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-white font-bold border-b border-slate-800 pb-1.5">
                  <span className="text-amber-300 flex items-center gap-1.5">
                    <span>2.</span>
                    <span>{isMn ? 'Хөлгийн түлш ба Үр ашиг' : 'Propellant & Delta-V Efficiency'}</span>
                  </span>
                  <span className="text-emerald-400">{fuelEfficiencyScore}/100</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isMn ? 'Зарцуулсан бодит түлш:' : 'Propellant Expended:'}</span>
                    <span className="font-bold text-white">{Math.round(fuelConsumedKg)} kg ({fuelRemainingPct}% reserve left)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isMn ? 'Хөдөлгүүрийн онцлог Isp:' : 'Specific Impulse (Isp):'}</span>
                    <span className="font-bold text-sky-300">{ispRating}s ({design.propulsion.name})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isMn ? 'Түлшний ашиглалтын үр ашиг:' : 'Delta-V Conservation:'}</span>
                    <span className="font-bold text-emerald-400">{fuelEfficiencyScore >= 85 ? 'HIGH (Оновчтой)' : 'NOMINAL (Хэвийн)'}</span>
                  </div>
                </div>
              </div>

              {/* Category 3: Atmospheric Incineration Success */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-white font-bold border-b border-slate-800 pb-1.5">
                  <span className="text-rose-400 flex items-center gap-1.5">
                    <span>3.</span>
                    <span>{isMn ? 'Агаар мандалд шатаасан хувь' : 'Atmospheric Re-entry Ablation'}</span>
                  </span>
                  <span className="text-emerald-400">{ablationScore}/100</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isMn ? 'Орсон замналын налуу:' : 'Flight Path Entry Angle:'}</span>
                    <span className="font-bold text-sky-300">{entryFlightAngleDeg}° (Optimal corridor -1.5° ~ -2.1°)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isMn ? 'Шатан ууршсан хувь:' : 'Atmospheric Ablation:'}</span>
                    <span className="font-bold text-emerald-400">100% (Бүрэн шатаж устсан)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isMn ? 'Унасан бүс:' : 'Impact Corridor:'}</span>
                    <span className="font-bold text-white">Point Nemo Oceanic Safe Zone</span>
                  </div>
                </div>
              </div>

              {/* Category 4: Mission Time & Orbital Safety */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-white font-bold border-b border-slate-800 pb-1.5">
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <span>4.</span>
                    <span>{isMn ? 'Хугацаа ба Орбитын аюулгүй байдал' : 'Timeline & Orbital Safety Gain'}</span>
                  </span>
                  <span className="text-emerald-400">{timeScore}/100</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isMn ? 'Нислэгийн нийт хугацаа:' : 'Mission Elapsed Time:'}</span>
                    <span className="font-bold text-white">{flightMinutes} мин {flightSeconds} сек</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isMn ? 'Орбитын аюулгүй байдлын индекс:' : 'Orbital Safety Index:'}</span>
                    <span className="font-bold text-emerald-400">{preSafetyIndex}% ➔ {postSafetyIndex}% (+{postSafetyIndex - preSafetyIndex}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isMn ? 'Кесслерийн эрсдэл бууралт:' : 'Kessler Cascade Reduction:'}</span>
                    <span className="font-bold text-emerald-400">-{kesslerMitigationPct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Official Agency Stamp & Signatures */}
          <div className="mt-6 pt-5 border-t border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-xs">
            <div className="text-[11px] text-slate-400">
              <span className="block text-white font-bold mb-0.5">
                {isMn ? 'БАТАЛСАН: МОНГОЛЫН САНСРЫН УДИРДАХ ГАЗАР (NSMA)' : 'AUTHORIZED BY: NATIONAL SPACE MANAGEMENT AGENCY OF MONGOLIA'}
              </span>
              <span>
                {isMn
                  ? 'Энэхүү сансрын хог хаягдлыг Дэлхийн агаар мандалд бүрэн шатаан устгаж, тойрог замын аюулгүй байдлыг хангасныг батлав.'
                  : 'Certified that orbital debris has been safely incinerated via controlled atmospheric re-entry.'}
              </span>
            </div>

            <button
              onClick={handleDownloadCertificate}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2 transition-colors shrink-0 shadow-md"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>{isMn ? 'Батламж хэвлэх / хадгалах' : 'Print / Save Certificate'}</span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            onClick={() => {
              sound.playClick();
              onRedesignSpacecraft();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isMn ? 'Зохион бүтээх лаборатори руу буцах' : 'Modify Spacecraft in Lab'}</span>
          </button>

          <button
            onClick={() => {
              sound.playLockChime();
              onSelectNewMission();
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-sky-500 to-emerald-400 hover:from-sky-400 hover:to-emerald-300 text-slate-950 text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(56,189,248,0.4)] active:scale-95"
          >
            <span>{isMn ? 'ДАРААГИЙН АЮУЛТАЙ ХОГ РҮҮ ОРОХ' : 'SELECT NEXT HAZARDOUS DEBRIS TARGET'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
