import React, { useEffect, useState } from 'react';
import { Monitor, AppWindow, X, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { DisplaySource } from '../../shared/types/index.js';

interface AudioSourcePickerProps {
  onSelect: (source: DisplaySource) => void;
  onClose: () => void;
}

/**
 * Lists screens and windows so the user can choose what the live mode captures.
 * Note: the audio track is the system output (loopback), so picking a window narrows
 * the captured surface but the sound is still the computer's output mix.
 */
export const AudioSourcePicker: React.FC<AudioSourcePickerProps> = ({ onSelect, onClose }) => {
  const [sources, setSources] = useState<DisplaySource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!window.electronAPI) {
      setError('Electron bridge not available.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await window.electronAPI.listDisplaySources();
      setSources(list);
      if (list.length === 0) {
        setError('No screens or windows found. Grant Screen Recording permission and try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not list capture sources.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const screens = sources.filter((source) => source.id.startsWith('screen:'));
  const windows = sources.filter((source) => !source.id.startsWith('screen:'));

  const renderCard = (source: DisplaySource) => (
    <button
      key={source.id}
      onClick={() => onSelect(source)}
      className="group text-left bg-slate-900/60 border border-slate-800 hover:border-emerald-500/60 rounded-lg overflow-hidden transition-colors"
      title={source.name}
    >
      {source.thumbnail ? (
        <img
          src={source.thumbnail}
          alt={source.name}
          className="w-full h-24 object-cover bg-slate-950"
        />
      ) : (
        <div className="w-full h-24 bg-slate-950 flex items-center justify-center text-slate-700">
          {source.id.startsWith('screen:') ? <Monitor className="w-6 h-6" /> : <AppWindow className="w-6 h-6" />}
        </div>
      )}
      <div className="px-2.5 py-2">
        <p className="text-xs text-slate-200 truncate group-hover:text-emerald-300">{source.name}</p>
        <p className="text-[10px] uppercase font-mono text-slate-500">
          {source.id.startsWith('screen:') ? 'screen' : 'window'}
          {source.isMain ? ' • primary' : ''}
        </p>
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-6">
      <div className="w-full max-w-3xl max-h-[80vh] flex flex-col bg-slate-900 border border-slate-800 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white">Choose what to listen to</h3>
            <p className="text-xs text-slate-400">
              Pick the screen or window showing Google Meet / the online class.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={load}
              title="Refresh list"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 text-red-400 bg-red-400/10 px-3 py-2 rounded-lg text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && sources.length === 0 ? (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-10">
              <Loader2 className="w-4 h-4 animate-spin" />
              Looking for screens and windows…
            </div>
          ) : (
            <>
              {screens.length > 0 && (
                <section>
                  <h4 className="text-[11px] uppercase font-mono text-slate-500 mb-2">Screens</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{screens.map(renderCard)}</div>
                </section>
              )}
              {windows.length > 0 && (
                <section>
                  <h4 className="text-[11px] uppercase font-mono text-slate-500 mb-2">Windows</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{windows.map(renderCard)}</div>
                </section>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-800">
          <p className="text-[11px] text-slate-500">
            Captured sound is the computer's output audio. Picking a window narrows what is shared, but the audio
            track still carries the system output mix.
          </p>
        </div>
      </div>
    </div>
  );
};
