import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  Trash2,
  Send,
  Sparkles,
  StopCircle,
  Copy,
  Check,
  AlertCircle,
  FileText,
  Volume2,
} from 'lucide-react';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { useAiAnswer } from '../hooks/useAiAnswer';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { FileUpload } from '../components/FileUpload';
import { ResponseStyle, ContextDocument } from '../../../shared/types/index';

export const AssistantView: React.FC = () => {
  const {
    state: audioState,
    segments,
    volumeLevel,
    error: audioError,
    start,
    stop,
    pause,
    resume,
    clearSegments,
    simulateVoiceInput,
  } = useAudioCapture();

  const {
    currentQuestion,
    answer,
    isStreaming,
    documentsUsed,
    error: aiError,
    generate,
    cancel,
    clear,
  } = useAiAnswer();

  const [manualInput, setManualInput] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<ResponseStyle>('short');
  const [copied, setCopied] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<ContextDocument | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    if (!window.electronAPI) return;

    setSelectedFile(file);
    setIsUploading(true);
    setUploadError(null);
    try {
      const filePath = (file as any).path;
      if (!filePath) {
        throw new Error('Unable to resolve native file path.');
      }
      const res = await window.electronAPI.importDocument(filePath);
      if (res.success && res.document) {
        setUploadedFile(res.document);
      } else {
        setUploadError(res.error || 'Failed to import document');
        setSelectedFile(null);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading file');
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    generate(manualInput, selectedStyle, undefined, uploadedFile?.id);
    setManualInput('');
  };

  const handleCopy = () => {
    if (!answer) return;
    navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sampleVoicePrompts = [
    'How does an LRU Cache work and what is its time complexity?',
    'Explain the difference between BFS and DFS with an example.',
    'What causes memory leaks in React applications?',
    'Write a TypeScript function to reverse a linked list.',
  ];

  const styles: { id: ResponseStyle; label: string; icon: string }[] = [
    { id: 'short', label: 'Short', icon: '⚡' },
    { id: 'detailed', label: 'Detailed', icon: '📖' },
    { id: 'bullet', label: 'Bullet Points', icon: '•' },
    { id: 'step-by-step', label: 'Step-by-Step', icon: '🔢' },
    { id: 'technical', label: 'Technical', icon: '⚙️' },
    { id: 'code', label: 'Code Example', icon: '💻' },
  ];

  return (
    <div className="flex-1 flex gap-4 p-4 overflow-hidden h-full">
      {/* Left Column: Live Audio Transcription Feed */}
      <div className="w-1/2 flex flex-col bg-slate-900/40 rounded-xl border border-slate-800/80 p-4 overflow-hidden shadow-lg backdrop-blur-sm">
        {/* Audio Controls Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                audioState === 'recording'
                  ? 'bg-emerald-500 animate-pulse'
                  : audioState === 'paused'
                  ? 'bg-amber-500'
                  : 'bg-slate-600'
              }`}
            />
            <span className="font-semibold text-sm text-slate-200">Live Audio Stream</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono uppercase bg-slate-800 text-slate-400">
              {audioState}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {audioState === 'idle' ? (
              <button
                onClick={start}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-medium text-xs transition-colors shadow"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Start Listening</span>
              </button>
            ) : (
              <>
                {audioState === 'recording' ? (
                  <button
                    onClick={pause}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs transition-colors"
                    title="Pause"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={resume}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs transition-colors"
                    title="Resume"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={stop}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white font-medium text-xs transition-colors"
                >
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              </>
            )}

            {segments.length > 0 && (
              <button
                onClick={clearSegments}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Clear transcript"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Live Audio Visualizer Bar */}
        {audioState === 'recording' && (
          <div className="py-2 border-b border-slate-800/60 flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 bg-slate-950 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-75 rounded-full"
                style={{ width: `${Math.max(5, volumeLevel)}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-400 w-8 text-right">
              {volumeLevel}%
            </span>
          </div>
        )}

        {/* Audio Error Alert */}
        {audioError && (
          <div className="my-2 p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{audioError}</span>
          </div>
        )}

        {/* Voice Simulation & Test Prompts */}
        <div className="py-2 border-b border-slate-800/60 space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
            Test Spoken Voice Queries (Click tosss simulate live speech):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sampleVoicePrompts.map((prompt, pIdx) => (
              <button
                key={pIdx}
                onClick={() => simulateVoiceInput(prompt, true)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-emerald-300 border border-slate-700/50 transition-colors text-left truncate max-w-full"
              >
                🎙️ {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Live Segments Feed */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
          {segments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-2">
              <Mic className="w-8 h-8 text-slate-600" />
              <p className="text-sm">No speech captured yet</p>
              <p className="text-xs text-slate-600 max-w-xs">
                Click &quot;Start Listening&quot; to speak into your microphone, or click any voice query chip above to test live question detection.
              </p>
            </div>
          ) : (
            segments.map((seg) => (
              <div
                key={seg.id}
                className={`p-3 rounded-xl border text-sm transition-all ${
                  seg.isFinal
                    ? 'bg-slate-900/80 border-slate-800/80 text-slate-200'
                    : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300 italic animate-pulse'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span className="font-medium text-slate-400">{seg.speaker || 'Speaker'}</span>
                  <span>{new Date(seg.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="leading-relaxed">{seg.text}</p>
                {seg.isFinal && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => generate(seg.text, selectedStyle, undefined, uploadedFile?.id)}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Ask AI about this
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: AI Answer Engine */}
      <div className="w-1/2 flex flex-col bg-slate-900/40 rounded-xl border border-slate-800/80 p-4 overflow-hidden shadow-lg backdrop-blur-sm">
        {/* Header & Response Styles */}
        <div className="pb-3 border-b border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-sm text-slate-200">AI Answer Engine</span>
            </div>

            <div className="flex items-center gap-1.5">
              {isStreaming ? (
                <button
                  onClick={cancel}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs hover:bg-red-500/30 transition-colors"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              ) : (
                answer && (
                  <>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs hover:bg-emerald-500/30 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={clear}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
                      title="Clear answer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )
              )}
            </div>
          </div>

          {/* Style Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {styles.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStyle(st.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border ${
                  selectedStyle === st.id
                    ? 'bg-emerald-500 text-slate-950 font-medium border-emerald-400 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span>{st.icon}</span>
                <span>{st.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Current Question Badge */}
        {currentQuestion && (
          <div className="my-2 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
            <span className="text-emerald-400 font-semibold uppercase text-[10px] tracking-wider block mb-0.5">
              Active Question
            </span>
            <p className="font-medium text-slate-100">{currentQuestion}</p>
            {documentsUsed && documentsUsed.length > 0 && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                <FileText className="w-3 h-3 text-emerald-400" />
                <span>Context from: {documentsUsed.join(', ')}</span>
              </div>
            )}
          </div>
        )}

        {/* Error Notice */}
        {aiError && (
          <div className="my-2 p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300">
            {aiError}
          </div>
        )}

        {/* Streaming Answer Output Area */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1">
          {answer ? (
            <MarkdownRenderer content={answer} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-2">
              <Sparkles className="w-8 h-8 text-slate-600" />
              <p className="text-sm">AI Answer Suggestions</p>
              <p className="text-xs text-slate-600 max-w-xs">
                Spoken questions will automatically be detected and answered here, or you can type a question below.
              </p>
            </div>
          )}
        </div>

        {/* Manual Input Bar */}
        <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-800 flex gap-2">
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Type a coding problem or question..."
              className="flex-1 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <FileUpload
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              onClear={() => {
                setSelectedFile(null);
                setUploadedFile(null);
              }}
              isUploading={isUploading}
              buttonText="Upload"
            />
          </div>
          <button
            type="submit"
            disabled={!manualInput.trim() || isStreaming}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-medium text-xs transition-colors flex items-center gap-1 shadow"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>
        </form>

        {/* Upload Error */}
        {uploadError && (
          <div className="pt-2 p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
