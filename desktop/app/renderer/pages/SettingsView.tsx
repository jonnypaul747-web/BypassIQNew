import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Cpu,
  Mic,
  Monitor,
  Layout,
  Shield,
  Save,
  Check,
  Eye,
  EyeOff,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { AppSettings, AiProvider, TranscriptionProvider, ResponseStyle } from '../../shared/types/index.js';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showAiKey, setShowAiKey] = useState(false);
  const [showAudioKey, setShowAudioKey] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'idle' | 'checking' | 'connected' | 'disconnected'>('idle');
  const [healthMessage, setHealthMessage] = useState('');

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getSettings().then((s) => setSettings(s));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !window.electronAPI) return;
    const updated = await window.electronAPI.saveSettings(settings);
    setSettings(updated);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const checkHealth = async () => {
    setHealthStatus('checking');
    setHealthMessage('Checking...');
    try {
      const response = await fetch('https://bypassiqnew.onrender.com/api/health');
      const data = await response.json();
      if (data.status === 'ok' && data.database === 'connected') {
        setHealthStatus('connected');
        setHealthMessage('Server Online ✓');
      } else {
        setHealthStatus('disconnected');
        setHealthMessage('Server Error');
      }
    } catch (error) {
      setHealthStatus('disconnected');
      setHealthMessage('Connection Failed');
    }
  };

  if (!settings) {
    return <div className="p-8 text-center text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto h-full">
      <form onSubmit={handleSave} className="space-y-6 pb-8">
        {/* Title Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">Application Settings</h2>
              <p className="text-xs text-slate-400">Configure AI models, speech recognition, and desktop preferences</p>
            </div>
          </div>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-medium text-xs transition-colors shadow"
          >
            {savedToast ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedToast ? 'Settings Saved!' : 'Save Settings'}</span>
          </button>
        </div>

        {/* Server Health Check Section */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Backend Server Health</span>
            </div>
            <button
              type="button"
              onClick={checkHealth}
              disabled={healthStatus === 'checking'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {healthStatus === 'checking' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Check Health</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {healthStatus === 'idle' && (
              <span className="text-slate-400">Click "Check Health" to verify backend server status</span>
            )}
            {healthStatus === 'checking' && (
              <span className="text-slate-400">Checking server connection...</span>
            )}
            {healthStatus === 'connected' && (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {healthMessage}
              </span>
            )}
            {healthStatus === 'disconnected' && (
              <span className="text-red-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                {healthMessage}
              </span>
            )}
          </div>
        </div>

        {/* Section 1: AI Provider & Models */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>AI Generation Engine</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">AI Provider</label>
              <select
                value={settings.ai.provider}
                onChange={(e) => {
                  const provider = e.target.value as AiProvider;
                  // DeepSeek needs its own model names; keep the field valid when switching over.
                  const modelName =
                    provider === 'deepseek' && !settings.ai.modelName.startsWith('deepseek')
                      ? 'deepseek-chat'
                      : settings.ai.modelName;
                  setSettings({
                    ...settings,
                    ai: { ...settings.ai, provider, modelName },
                  });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                <option value="anthropic">Anthropic Claude (Sonnet / Haiku)</option>
                <option value="gemini">Google Gemini (Flash / Pro)</option>
                <option value="deepseek">DeepSeek (deepseek-chat / deepseek-reasoner)</option>
                <option value="ollama">Ollama (Local Models)</option>
                <option value="mock">Offline / Mock Engine (Zero API Key)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Model Name</label>
              <input
                type="text"
                value={settings.ai.modelName}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ai: { ...settings.ai, modelName: e.target.value },
                  })
                }
                placeholder="gpt-4o, claude-3-5-sonnet, gemini-1.5-flash, deepseek-chat..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {settings.ai.provider !== 'mock' && settings.ai.provider !== 'ollama' && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">API Key</label>
              <div className="relative">
                <input
                  type={showAiKey ? 'text' : 'password'}
                  value={settings.ai.apiKey}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ai: { ...settings.ai, apiKey: e.target.value },
                    })
                  }
                  placeholder={`Enter your ${settings.ai.provider} API key...`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-9 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAiKey(!showAiKey)}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showAiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Default Response Style</label>
              <select
                value={settings.ai.responseStyle}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ai: { ...settings.ai, responseStyle: e.target.value as ResponseStyle },
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="short">Short Answer (1-3 sentences)</option>
                <option value="detailed">Detailed Explanation</option>
                <option value="bullet">Bullet Points</option>
                <option value="step-by-step">Step-by-Step Solution</option>
                <option value="technical">Technical In-Depth</option>
                <option value="code">Code Example First</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Temperature: <span className="text-emerald-400 font-mono">{settings.ai.temperature}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.ai.temperature}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ai: { ...settings.ai, temperature: parseFloat(e.target.value) },
                  })
                }
                className="w-full accent-emerald-500 mt-2"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Custom System Instructions / Persona</label>
            <textarea
              rows={2}
              value={settings.ai.customInstructions}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ai: { ...settings.ai, customInstructions: e.target.value },
                })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="autoDetectQuestions"
              checked={settings.ai.autoDetectQuestions}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ai: { ...settings.ai, autoDetectQuestions: e.target.checked },
                })
              }
              className="rounded accent-emerald-500"
            />
            <label htmlFor="autoDetectQuestions" className="text-xs text-slate-300 cursor-pointer">
              Automatically detect questions in spoken conversation and trigger AI suggestions
            </label>
          </div>
        </div>

        {/* Section 2: Audio & Transcription */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Mic className="w-4 h-4 text-emerald-400" />
            <span>Real-Time Audio & Transcription</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Transcription Provider</label>
              <select
                value={settings.audio.transcriptionProvider}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    audio: {
                      ...settings.audio,
                      transcriptionProvider: e.target.value as TranscriptionProvider,
                    },
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="web-speech">Web Speech API (Built-in Free / Low Latency)</option>
                <option value="deepgram">Deepgram Live Streaming WebSocket</option>
                <option value="openai">OpenAI Whisper API</option>
                <option value="mock">Mock STT Stream</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Language</label>
              <input
                type="text"
                value={settings.audio.language}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    audio: { ...settings.audio, language: e.target.value },
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {settings.audio.transcriptionProvider === 'deepgram' && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Deepgram API Key</label>
              <div className="relative">
                <input
                  type={showAudioKey ? 'text' : 'password'}
                  value={settings.audio.apiKey}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      audio: { ...settings.audio, apiKey: e.target.value },
                    })
                  }
                  placeholder="Enter your Deepgram API Key..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-9 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAudioKey(!showAudioKey)}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showAudioKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="noiseSuppression"
              checked={settings.audio.noiseSuppression}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  audio: { ...settings.audio, noiseSuppression: e.target.checked },
                })
              }
              className="rounded accent-emerald-500"
            />
            <label htmlFor="noiseSuppression" className="text-xs text-slate-300 cursor-pointer">
              Enable native noise suppression and echo cancellation
            </label>
          </div>
        </div>

        {/* Section 3: Floating Window & Display */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Layout className="w-4 h-4 text-emerald-400" />
            <span>Floating HUD & Appearance</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="alwaysOnTop"
                  checked={settings.ui.alwaysOnTop}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ui: { ...settings.ui, alwaysOnTop: e.target.checked },
                    })
                  }
                  className="rounded accent-emerald-500"
                />
                <label htmlFor="alwaysOnTop" className="text-xs text-slate-300 cursor-pointer">
                  Always-On-Top Floating Window
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="compactMode"
                  checked={settings.ui.compactMode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ui: { ...settings.ui, compactMode: e.target.checked },
                    })
                  }
                  className="rounded accent-emerald-500"
                />
                <label htmlFor="compactMode" className="text-xs text-slate-300 cursor-pointer">
                  Default to Compact Mini-Pill Mode
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">
                HUD Window Opacity: <span className="text-emerald-400 font-mono">{Math.round(settings.ui.opacity * 100)}%</span>
              </label>
              <input
                type="range"
                min="0.4"
                max="1.0"
                step="0.05"
                value={settings.ui.opacity}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ui: { ...settings.ui, opacity: parseFloat(e.target.value) },
                  })
                }
                className="w-full accent-emerald-500 mt-2"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Privacy & Retention */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Security & Privacy Controls</span>
          </div>

          <div className="space-y-2 pt-1 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="retainAudio"
                checked={settings.privacy.retainAudio}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    privacy: { ...settings.privacy, retainAudio: e.target.checked },
                  })
                }
                className="rounded accent-emerald-500"
              />
              <label htmlFor="retainAudio" className="cursor-pointer">
                Retain raw audio recordings locally (default disabled for privacy)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="retainScreenshots"
                checked={settings.privacy.retainScreenshots}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    privacy: { ...settings.privacy, retainScreenshots: e.target.checked },
                  })
                }
                className="rounded accent-emerald-500"
              />
              <label htmlFor="retainScreenshots" className="cursor-pointer">
                Retain temporary screenshots after OCR extraction
              </label>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

