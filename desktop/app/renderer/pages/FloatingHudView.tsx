import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Copy,
  Check,
  Minimize2,
  Maximize2,
  Pin,
  PinOff,
  X,
  Sparkles,
  StopCircle,
  RefreshCw,
  Shield,
  ShieldOff,
} from 'lucide-react';
import { useAudioCapture } from '../hooks/useAudioCapture.js';
import { useAiAnswer } from '../hooks/useAiAnswer.js';
import { MarkdownRenderer } from '../components/MarkdownRenderer.js';
import { ResponseStyle } from '../../shared/types/index.js';

export const FloatingHudView: React.FC = () => {
  const { state: audioState, segments } = useAudioCapture();
  const { currentQuestion, answer, isStreaming, generate, cancel, clear } = useAiAnswer();

  const [compact, setCompact] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [screenShareProtection, setScreenShareProtection] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<ResponseStyle>('short');

  const toggleScreenShareProtection = async () => {
    const next = !screenShareProtection;
    setScreenShareProtection(next);
    if (window.electronAPI) {
      await window.electronAPI.setScreenShareProtection(next);
    }
  };

  const latestSegment = segments.length > 0 ? segments[segments.length - 1] : null;

  const toggleCompact = async () => {
    const next = !compact;
    setCompact(next);
    if (window.electronAPI) {
      await window.electronAPI.setCompactMode(next);
    }
  };

  const toggleAlwaysOnTop = async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    if (window.electronAPI) {
      await window.electronAPI.setAlwaysOnTop(next);
    }
  };

  const handleCopy = () => {
    if (!answer) return;
    navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStyleChange = (style: ResponseStyle) => {
    setSelectedStyle(style);
    if (currentQuestion) {
      generate(currentQuestion, style);
    }
  };

  const closeHud = () => {
    if (window.electronAPI) {
      window.electronAPI.toggleFloatingHud(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950/95 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden select-none text-slate-100">
      {/* Draggable Title Bar */}
      <div className="titlebar-drag flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800/70 cursor-move">
        <div className="flex items-center gap-2">
          {/* Status Pulse */}
          <div className="flex items-center gap-1.5 titlebar-no-drag">
            <span
              className={`w-2 h-2 rounded-full ${
                audioState === 'recording'
                  ? 'bg-emerald-500 animate-pulse'
                  : audioState === 'paused'
                  ? 'bg-amber-500'
                  : 'bg-slate-600'
              }`}
            />
            {audioState === 'recording' ? (
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <MicOff className="w-3.5 h-3.5 text-slate-500" />
            )}
          </div>
          <span className="text-xs font-semibold tracking-wide text-slate-300">
            JustCilledAI HUD
          </span>
        </div>

        {/* Action Controls */}
        <div className="titlebar-no-drag flex items-center gap-1">
          <button
            onClick={toggleScreenShareProtection}
            title={screenShareProtection ? 'Hidden from Screen Sharing (Protected - Only you can see it)' : 'Visible to Screen Sharing'}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {screenShareProtection ? (
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ShieldOff className="w-3.5 h-3.5 text-amber-400" />
            )}
          </button>
          <button
            onClick={toggleAlwaysOnTop}
            title={alwaysOnTop ? 'Pinned On Top' : 'Unpinned'}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {alwaysOnTop ? <Pin className="w-3.5 h-3.5 text-emerald-400" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={toggleCompact}
            title={compact ? 'Expand' : 'Compact'}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {compact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={closeHud}
            title="Hide HUD"
            className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-3 overflow-hidden gap-2.5">
        {/* Live Audio Transcript Ticker */}
        <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60 flex items-center gap-2 text-xs">
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Live
          </span>
          <p className="truncate text-slate-300 flex-1 italic">
            {latestSegment ? latestSegment.text : 'Listening for conversation...'}
          </p>
        </div>

        {/* Current Question or Detection */}
        {currentQuestion && (
          <div className="px-3 py-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-xs">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5" /> Question Detected:
            </span>
            <p className="text-slate-200 font-medium">{currentQuestion}</p>
          </div>
        )}

        {/* Response Style Pills */}
        {!compact && (
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-[11px] no-scrollbar">
            {(['short', 'bullet', 'code', 'technical', 'detailed'] as ResponseStyle[]).map((st) => (
              <button
                key={st}
                onClick={() => handleStyleChange(st)}
                className={`px-2 py-0.5 rounded-full capitalize whitespace-nowrap transition-colors border ${
                  selectedStyle === st
                    ? 'bg-emerald-500 text-slate-950 font-medium border-emerald-400 shadow-sm'
                    : 'bg-slate-900/70 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}

        {/* Streaming Answer Scroll Area */}
        <div className="flex-1 overflow-y-auto px-1 pr-2 space-y-2">
          {answer ? (
            <MarkdownRenderer content={answer} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 text-xs gap-1 py-6">
              <Sparkles className="w-6 h-6 text-slate-600 mb-1" />
              <p>Ready for questions</p>
              <p className="text-[10px] text-slate-600">Answers stream here in real time</p>
            </div>
          )}
        </div>

        {/* Bottom HUD Actions */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                onClick={cancel}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            ) : (
              answer && (
                <button
                  onClick={clear}
                  className="flex items-center gap-1 px-2 py-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )
            )}
          </div>

          {answer && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors font-medium text-xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Answer</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

