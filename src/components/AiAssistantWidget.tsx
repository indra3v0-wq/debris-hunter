/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Language, TRANSLATIONS, speakText, stopSpeech } from '../utils/translations';
import { sound } from '../utils/audio';
import { GameStage, MissionState } from '../types';
import { 
  Bot, 
  Volume2, 
  VolumeX, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface AiAssistantWidgetProps {
  language: Language;
  currentStage: GameStage;
  missionState: MissionState;
}

export const AiAssistantWidget: React.FC<AiAssistantWidgetProps> = ({
  language,
  currentStage,
  missionState,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const t = TRANSLATIONS[language];

  // Dynamic context-dependent prompt text
  let message = t.aiAssistant.intro;

  if (currentStage === 'rocket_lab') {
    message = t.aiAssistant.rocketLabHelp;
  } else if (currentStage === 'design_lab') {
    message = t.aiAssistant.designLabHelp;
  } else if (currentStage === 'launch_config') {
    message = t.aiAssistant.launchHelp;
  } else if (currentStage === 'orbital_nav') {
    message = t.aiAssistant.orbitHelp;
  } else if (currentStage === 'target_detection') {
    message = t.aiAssistant.detectionHelp;
  } else if (currentStage === 'approach_sync') {
    message = t.aiAssistant.approachHelp;
  } else if (currentStage === 'debris_capture') {
    message = t.aiAssistant.captureHelp;
  } else if (currentStage === 'deorbit_disposal') {
    message = t.aiAssistant.disposalHelp;
  } else if (currentStage === 'mission_eval') {
    message = t.aiAssistant.successMessage;
  }

  const handleToggleVoice = () => {
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
    } else {
      speakText(message, language);
      setIsSpeaking(true);
      sound.playClick();
    }
  };

  useEffect(() => {
    // When stage changes, stop previous speech
    stopSpeech();
    setIsSpeaking(false);
  }, [currentStage]);

  return (
    <div className="fixed bottom-20 right-4 z-40 max-w-sm pointer-events-auto">
      <div className="aerospace-panel rounded-xl overflow-hidden shadow-2xl border-sky-500/40 bg-slate-950/95 backdrop-blur-md">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-sky-500/20 text-xs font-mono">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-400 flex items-center justify-center text-sky-400">
              <Bot className="w-3 h-3" />
            </div>
            <span className="font-bold text-white tracking-wide">{t.aiAssistant.name}</span>
            <span className="text-[10px] text-emerald-400 border border-emerald-500/30 px-1 rounded">
              ONLINE
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleVoice}
              className={`p-1 rounded transition-colors ${
                isSpeaking ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
              title={isSpeaking ? 'Stop Voice' : 'Read in Mongolian'}
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expanded Message Content */}
        {isExpanded && (
          <div className="p-3 text-[11px] font-mono text-slate-300 leading-relaxed space-y-2">
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p>{message}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
