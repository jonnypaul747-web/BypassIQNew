import React, { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  Trash2,
  Download,
  Copy,
  Check,
  Sparkles,
  FileText,
} from 'lucide-react';
import { SessionHistoryItem } from '../../shared/types/index.js';
import { MarkdownRenderer } from '../components/MarkdownRenderer.js';

export const HistoryView: React.FC = () => {
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<SessionHistoryItem | null>(null);
  const [copied, setCopied] = useState(false);

  const loadHistory = async () => {
    if (!window.electronAPI) return;
    try {
      const items = await window.electronAPI.getHistory();
      setHistory(items);
      if (items.length > 0 && !selectedItem) {
        setSelectedItem(items[0]);
      }
    } catch (err) {
      console.error('[HistoryView] Error loading history:', err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.deleteHistoryItem(id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.electronAPI) return;
    if (window.confirm('Are you sure you want to delete all conversation history?')) {
      await window.electronAPI.clearHistory();
      setHistory([]);
      setSelectedItem(null);
    }
  };

  const handleExport = async () => {
    if (!window.electronAPI) return;
    try {
      const json = await window.electronAPI.exportHistory();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `justcilledai_history_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[HistoryView] Export error:', err);
    }
  };

  const handleCopy = () => {
    if (!selectedItem?.answer) return;
    navigator.clipboard.writeText(selectedItem.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredHistory = history.filter((item) => {
    const q = searchQuery.toLowerCase();
    return item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 flex gap-4 p-4 overflow-hidden h-full">
      {/* Left Column: History Items & Search */}
      <div className="w-1/2 flex flex-col bg-slate-900/40 rounded-xl border border-slate-800/80 p-4 overflow-hidden shadow-lg backdrop-blur-sm gap-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm text-slate-200">Conversation History</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={history.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs transition-colors"
              title="Export history as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <button
              onClick={handleClearAll}
              disabled={history.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 text-red-400 text-xs transition-colors"
              title="Clear all history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search past questions and answers..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-1 py-12">
              <Clock className="w-6 h-6 text-slate-600" />
              <p className="text-xs">No matching history entries found</p>
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between gap-2 ${
                  selectedItem?.id === item.id
                    ? 'bg-slate-800/90 border-emerald-500/60 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400">
                      {item.style}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(item.timestamp).toLocaleTimeString()} • {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="font-medium text-slate-200 line-clamp-2">{item.question}</p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                  className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Detail View */}
      <div className="w-1/2 flex flex-col bg-slate-900/40 rounded-xl border border-slate-800/80 p-4 overflow-hidden shadow-lg backdrop-blur-sm gap-3">
        <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
          <span className="font-semibold text-sm text-slate-200">Answer Details</span>
          {selectedItem && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs hover:bg-emerald-500/30 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>

        {selectedItem ? (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Question card */}
            <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-xs">
              <span className="text-emerald-400 font-semibold block mb-1">Question / Prompt:</span>
              <p className="text-slate-100 font-medium">{selectedItem.question}</p>
              {selectedItem.documentsUsed && selectedItem.documentsUsed.length > 0 && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                  <FileText className="w-3 h-3 text-emerald-400" />
                  <span>Referenced: {selectedItem.documentsUsed.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Answer */}
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <MarkdownRenderer content={selectedItem.answer} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-1 py-12">
            <Sparkles className="w-6 h-6 text-slate-600" />
            <p className="text-xs">Select a past conversation from the left to view full details.</p>
          </div>
        )}
      </div>
    </div>
  );
};

