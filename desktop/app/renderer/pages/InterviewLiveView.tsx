import React, { useEffect, useState } from 'react';
import {
  Headphones,
  MicOff,
  Play,
  Square,
  Radio,
  AlertCircle,
  Sparkles,
  Volume2,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import { useSystemAudioCapture } from '../hooks/useSystemAudioCapture.js';
import { useAiAnswer } from '../hooks/useAiAnswer.js';
import { MarkdownRenderer } from '../components/MarkdownRenderer.js';
import { AudioSourcePicker } from '../components/AudioSourcePicker.js';
import { AppSettings, DisplaySource } from '../../shared/types/index.js';

export const InterviewLiveView: React.FC = () => {
  const { state, segments, volumeLevel, error, start, stop, clearSegments } = useSystemAudioCapture();
  const { currentQuestion, answer, isStreaming, generate, cancel, clear } = useAiAnswer();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [manualQuestion, setManualQuestion] = useState('');
  const [source, setSource] = useState<DisplaySource | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSettings().then(setSettings);
    }
  }, []);

  useEffect(() => {
    return () => {
      // Never leave the capture running when the panel unmounts.
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isRecording = state === 'recording';

  const handleStart = () => {
    // First run asks which screen/window to listen to; the choice is remembered.
    if (!source) {
      setPickerOpen(true);
      return;
    }
    start();
  };

  const handlePickSource = async (picked: DisplaySource) => {
    setPickerOpen(false);
    setSource(picked);
    if (window.electronAPI) {
      await window.electronAPI.setCaptureSource(picked.id);
    }
    start();
  };
  const transcriptionProvider = settings?.audio.transcriptionProvider;
  const streamingSttReady = transcriptionProvider === 'deepgram';
  const aiProvider = settings?.ai.provider || 'not configured';
  const aiModel = settings?.ai.modelName || 'model not set';
  const finalSegments = segments.filter((s) => s.isFinal).slice(-6);

  return (
    <div className="space-y-6">
      {/* How the two streams are routed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-5 border border-emerald-500/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Headphones className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Stream A — System output</h3>
            </div>
            <span
              className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                isRecording
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-900 text-slate-500 border-slate-700'
              }`}
            >
              {isRecording ? 'live' : 'idle'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Google Meet / Zoom / online class audio, captured from the speakers.
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-slate-500">Source:</span>
            <span className="text-slate-300 truncate" title={source?.name}>
              {source ? source.name : 'Primary screen (default)'}
            </span>
            <button
              onClick={() => setPickerOpen(true)}
              disabled={isRecording}
              className="ml-auto text-[11px] text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 underline underline-offset-2"
            >
              {source ? 'Change' : 'Choose'}
            </button>
          </div>
          <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            To AI: {aiProvider} ({aiModel})
          </p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MicOff className="w-5 h-5 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-300">Stream B — Microphone</h3>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">
              ignored
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Your own voice and room noise are never opened in this mode, so they cannot reach the AI.
          </p>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Filtered out by design
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={isRecording ? stop : handleStart}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                isRecording
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'
              }`}
            >
              {isRecording ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isRecording ? 'Stop capture' : 'Start listening to the class'}
            </button>

            {segments.length > 0 && (
              <button
                onClick={() => {
                  clearSegments();
                  clear();
                }}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-900"
              >
                Clear
              </button>
            )}
          </div>

          {/* Level meter for the captured system audio */}
          <div className="flex items-center gap-2 min-w-[160px]">
            <Volume2 className={`w-4 h-4 ${isRecording ? 'text-emerald-400' : 'text-slate-600'}`} />
            <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden flex-1">
              <div
                className="h-full bg-emerald-500 transition-all duration-75"
                style={{ width: `${volumeLevel}%` }}
              />
            </div>
          </div>
        </div>

        {isRecording && (
          <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Listening to system audio only. Questions are detected automatically.
          </p>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 text-red-400 bg-red-400/10 px-4 py-2 rounded-lg text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!streamingSttReady && (
          <div className="mt-4 flex items-start gap-2 text-amber-400 bg-amber-400/10 px-4 py-2 rounded-lg text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              System audio needs streaming speech-to-text. Set Transcription Provider to <strong>Deepgram</strong> in
              Settings and add its API key — the built-in Web Speech engine only listens to the microphone.
            </span>
          </div>
        )}
      </div>

      {/* Live transcript from system audio */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          What the class is saying
        </h3>
        {finalSegments.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            {isRecording ? 'Waiting for speech from the shared audio…' : 'Not listening yet.'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {finalSegments.map((segment) => (
              <li key={segment.id}>
                <button
                  type="button"
                  onClick={() => setManualQuestion(segment.text)}
                  title="Use this line as the question"
                  className="w-full text-left text-sm text-slate-300 hover:text-emerald-300 hover:bg-slate-900/60 rounded px-1.5 py-0.5 transition-colors"
                >
                  <span className="text-[10px] uppercase font-mono text-slate-500 mr-2">system</span>
                  {segment.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Manual ask — works with auto-detection off */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const question = manualQuestion.trim();
          if (!question) return;
          generate(question);
          setManualQuestion('');
        }}
        className="bg-slate-800/50 rounded-xl p-5 border border-slate-700"
      >
        <label className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          Ask manually
        </label>
        <div className="flex items-center gap-2">
          <input
            value={manualQuestion}
            onChange={(e) => setManualQuestion(e.target.value)}
            placeholder="Type a question, or click a transcript line above…"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!manualQuestion.trim()}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            Ask AI
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Sent straight to the AI pipeline — automatic question detection is not required.
        </p>
      </form>

      {pickerOpen && (
        <AudioSourcePicker onSelect={handlePickSource} onClose={() => setPickerOpen(false)} />
      )}

      {/* Answer generated from that audio */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 min-h-[140px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Suggested answer
          </h3>
          {isStreaming && (
            <button
              onClick={cancel}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10"
            >
              Cancel
            </button>
          )}
        </div>

        {currentQuestion && (
          <p className="text-xs text-emerald-400 mb-2">
            Detected: <span className="text-slate-200">{currentQuestion}</span>
          </p>
        )}

        {answer ? (
          <MarkdownRenderer content={answer} />
        ) : (
          <p className="text-xs text-slate-500 italic">
            Answers stream here once a question is detected in the shared audio.
          </p>
        )}
      </div>
    </div>
  );
};
