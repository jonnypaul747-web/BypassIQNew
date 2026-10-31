import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Camera,
  FileCode,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { DisplaySource, OcrResult } from '../../shared/types/index.js';
import { MarkdownRenderer } from '../components/MarkdownRenderer.js';

export const ScreenView: React.FC = () => {
  const [sources, setSources] = useState<DisplaySource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(
    'Identify and explain the code or errors shown on this screen, and provide an optimized fix.'
  );

  const loadSources = async () => {
    if (!window.electronAPI) return;
    try {
      const list = await window.electronAPI.listDisplaySources();
      setSources(list);
      if (list.length > 0 && !selectedSourceId) {
        setSelectedSourceId(list[0].id);
      }
    } catch (err) {
      console.error('[ScreenView] Failed to load sources:', err);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleCapture = async () => {
    if (!window.electronAPI) return;
    setIsCapturing(true);
    setAiAnalysis('');
    try {
      const result = await window.electronAPI.captureAndOcr(selectedSourceId);
      setOcrResult(result.ocrResult);
      if (result.imagePath) {
        setPreviewImage(`file://${result.imagePath}?t=${Date.now()}`);
      }
    } catch (err: any) {
      console.error('[ScreenView] Capture error:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!window.electronAPI || !ocrResult) return;
    setIsAnalyzing(true);
    try {
      const res = await window.electronAPI.analyzeScreen({
        sourceId: selectedSourceId,
        prompt: customPrompt,
      });
      if (res.success) {
        setAiAnalysis(res.answer);
      } else {
        setAiAnalysis(`Error: ${res.error}`);
      }
    } catch (err: any) {
      setAiAnalysis(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyOcr = () => {
    if (!ocrResult?.text) return;
    navigator.clipboard.writeText(ocrResult.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex gap-4 p-4 overflow-hidden h-full">
      {/* Left Column: Source Selection & OCR Result */}
      <div className="w-1/2 flex flex-col bg-slate-900/40 rounded-xl border border-slate-800/80 p-4 overflow-hidden shadow-lg backdrop-blur-sm gap-3">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm text-slate-200">Screen & Window Capture</span>
          </div>
          <button
            onClick={loadSources}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
            title="Refresh screens"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Available Sources Grid */}
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-medium">Select Screen or Window:</label>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {sources.map((src) => (
              <button
                key={src.id}
                onClick={() => setSelectedSourceId(src.id)}
                className={`flex-shrink-0 w-36 rounded-lg border p-1.5 text-left transition-all ${
                  selectedSourceId === src.id
                    ? 'border-emerald-500 bg-emerald-950/20'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                {src.thumbnail ? (
                  <img
                    src={src.thumbnail}
                    alt={src.name}
                    className="w-full h-16 object-cover rounded mb-1 bg-slate-950"
                  />
                ) : (
                  <div className="w-full h-16 bg-slate-950 rounded flex items-center justify-center mb-1 text-slate-600">
                    <Monitor className="w-6 h-6" />
                  </div>
                )}
                <p className="text-[11px] text-slate-300 font-medium truncate">{src.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Capture Action */}
        <div className="flex gap-2">
          <button
            onClick={handleCapture}
            disabled={isCapturing}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-medium text-xs transition-colors shadow"
          >
            <Camera className="w-4 h-4" />
            <span>{isCapturing ? 'Capturing & Reading OCR...' : 'Capture & Extract OCR'}</span>
          </button>
        </div>

        {/* Extracted OCR Output */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs">
            <span className="font-medium text-slate-400 flex items-center gap-1">
              <FileCode className="w-3.5 h-3.5 text-emerald-400" /> Apple Vision OCR Output
            </span>
            {ocrResult?.text && (
              <button
                onClick={handleCopyOcr}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pt-2 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed pr-1">
            {ocrResult ? (
              ocrResult.text ? (
                ocrResult.text
              ) : (
                <div className="text-slate-500 italic py-4 text-center">
                  No text detected in selected window.
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-1 py-8">
                <Eye className="w-6 h-6 text-slate-600" />
                <p>Click &quot;Capture & Extract OCR&quot; above to scan visible text.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: AI Screen Analysis & Code Solution */}
      <div className="w-1/2 flex flex-col bg-slate-900/40 rounded-xl border border-slate-800/80 p-4 overflow-hidden shadow-lg backdrop-blur-sm gap-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm text-slate-200">AI Screen Explainer</span>
          </div>
        </div>

        {/* Prompt Input */}
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-medium">Analysis Directive:</label>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!ocrResult?.text || isAnalyzing}
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-medium text-xs transition-colors shadow"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isAnalyzing ? 'Analyzing Visible Code...' : 'Analyze Screen Content'}</span>
        </button>

        {/* AI Answer Content Area */}
        <div className="flex-1 overflow-y-auto p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg pr-1">
          {aiAnalysis ? (
            <MarkdownRenderer content={aiAnalysis} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 text-xs gap-1 py-12">
              <Sparkles className="w-6 h-6 text-slate-600" />
              <p>AI explanations and code fixes will render here</p>
              <p className="text-[10px] text-slate-600">Extract OCR text first, then click &quot;Analyze Screen Content&quot;</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

