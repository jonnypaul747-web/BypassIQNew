import React, { useState, useEffect } from 'react';
import {
  Mic,
  Monitor,
  FileText,
  Clock,
  Settings,
  Sparkles,
  ExternalLink,
  Cpu,
  Layers,
  GraduationCap,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { AssistantView } from './AssistantView.js';
import { ScreenView } from './ScreenView.js';
import { DocumentsView } from './DocumentsView.js';
import { HistoryView } from './HistoryView.js';
import { SettingsView } from './SettingsView.js';
import { InterviewView } from './InterviewView.js';
import { AppSettings } from '../../shared/types/index.js';

type Tab = 'assistant' | 'screen' | 'documents' | 'interview' | 'history' | 'settings';

export const MainDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('assistant');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [healthStatus, setHealthStatus] = useState<'idle' | 'checking' | 'connected' | 'disconnected'>('idle');

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSettings().then((s) => setSettings(s));
    }
  }, []);

  const toggleHud = () => {
    if (window.electronAPI) {
      window.electronAPI.toggleFloatingHud();
    }
  };

  const checkHealth = async () => {
    setHealthStatus('checking');
    try {
      const response = await fetch('https://bypassiqnew.onrender.com/api/health');
      const data = await response.json();
      if (data.status === 'ok' && data.database === 'connected') {
        setHealthStatus('connected');
      } else {
        setHealthStatus('disconnected');
      }
    } catch (error) {
      setHealthStatus('disconnected');
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'assistant', label: 'Live Assistant', icon: <Mic className="w-4 h-4" /> },
    { id: 'screen', label: 'Screen & OCR', icon: <Monitor className="w-4 h-4" /> },
    { id: 'documents', label: 'Context & Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'interview', label: 'Interview Q&A', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <Clock className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Top Application Header Bar */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-slate-100 flex items-center gap-1.5">
                <span>JustCilledAI</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Assistant
                </span>
              </h1>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-800 mx-1" />

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right Status Badges & HUD Launcher */}
        <div className="flex items-center gap-3">
          {/* Status Pills */}
          <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
              <Cpu className="w-3 h-3 text-emerald-400" />
              <span className="capitalize">{settings?.ai.provider || 'AI'}: {settings?.ai.modelName || 'ready'}</span>
            </span>
          </div>

          {/* Health Check Button */}
          <button
            onClick={checkHealth}
            disabled={healthStatus === 'checking'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700"
            title="Check backend server health"
          >
            {healthStatus === 'checking' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Checking...</span>
              </>
            ) : healthStatus === 'connected' ? (
              <>
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Online</span>
              </>
            ) : healthStatus === 'disconnected' ? (
              <>
                <Activity className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-400">Offline</span>
              </>
            ) : (
              <>
                <Activity className="w-3.5 h-3.5" />
                <span>Health</span>
              </>
            )}
          </button>

          {/* Open Floating HUD Window Button */}
          <button
            onClick={toggleHud}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs transition-colors shadow-md"
            title="Toggle floating overlay window (shortcut: Cmd+Shift+Space)"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Floating HUD</span>
            <span className="text-[10px] font-mono bg-emerald-700/40 text-slate-950 px-1 rounded ml-0.5">
              ⌘⇧Space
            </span>
          </button>
        </div>
      </header>

      {/* Main Tab Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'assistant' && <AssistantView />}
        {activeTab === 'screen' && <ScreenView />}
        {activeTab === 'documents' && <DocumentsView />}
        {activeTab === 'interview' && <InterviewView />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
};

