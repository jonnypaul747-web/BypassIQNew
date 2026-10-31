import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  // Audio
  AUDIO_START: 'audio:start',
  AUDIO_PAUSE: 'audio:pause',
  AUDIO_RESUME: 'audio:resume',
  AUDIO_STOP: 'audio:stop',
  AUDIO_STATE_CHANGE: 'audio:state-change',
  AUDIO_TRANSCRIPTION_EVENT: 'audio:transcription-event',
  
  // AI
  AI_GENERATE_ANSWER: 'ai:generate-answer',
  AI_STREAM_CHUNK: 'ai:stream-chunk',
  AI_CANCEL_GENERATION: 'ai:cancel-generation',
  
  // Screen
  SCREEN_LIST_DISPLAYS: 'screen:list-displays',
  SCREEN_SET_CAPTURE_SOURCE: 'screen:set-capture-source',
  SCREEN_OCR: 'screen:ocr',
  SCREEN_ANALYZE: 'screen:analyze',
  
  // Documents
  DOCS_IMPORT: 'docs:import',
  DOCS_LIST: 'docs:list',
  DOCS_REMOVE: 'docs:remove',
  DOCS_TOGGLE: 'docs:toggle',
  
  // Interview
  INTERVIEW_GENERATE_QUESTIONS: 'interview:generate-questions',
  INTERVIEW_GENERATE_FROM_BACKEND: 'interview:generate-from-backend',
  INTERVIEW_GET_PROVIDER_INFO: 'interview:get-provider-info',
  
  // Dialog
  DIALOG_OPEN_FILE: 'dialog:openFile',
  
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  
  // History
  HISTORY_GET: 'history:get',
  HISTORY_DELETE: 'history:delete',
  HISTORY_CLEAR: 'history:clear',
  HISTORY_EXPORT: 'history:export',
  
  // Window
  WINDOW_TOGGLE_HUD: 'window:toggle-hud',
  WINDOW_SET_ALWAYS_ON_TOP: 'window:set-always-on-top',
  WINDOW_SET_COMPACT: 'window:set-compact',
  WINDOW_SET_OPACITY: 'window:set-opacity',
  WINDOW_SET_CONTENT_PROTECTION: 'window:set-content-protection',
  WINDOW_HUD_STATE_UPDATE: 'window:hud-state-update',
  
  // App
  APP_SET_ICON: 'app:set-icon',
};

const api = {
  // Audio
  startAudio: (config) => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_START, config),
  pauseAudio: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_PAUSE),
  resumeAudio: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_RESUME),
  stopAudio: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_STOP),
  onAudioStateChange: (callback) => {
    const handler = (_, state) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.AUDIO_STATE_CHANGE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_STATE_CHANGE, handler);
  },
  onTranscriptionSegment: (callback) => {
    const handler = (_, seg) => callback(seg);
    ipcRenderer.on(IPC_CHANNELS.AUDIO_TRANSCRIPTION_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_TRANSCRIPTION_EVENT, handler);
  },
  
  // AI
  generateAnswer: (params) => ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_ANSWER, params),
  cancelGeneration: () => ipcRenderer.invoke(IPC_CHANNELS.AI_CANCEL_GENERATION),
  onAiStreamChunk: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.AI_STREAM_CHUNK, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_CHUNK, handler);
  },
  
  // Screen
  listDisplaySources: () => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_LIST_DISPLAYS),
  setCaptureSource: (sourceId) => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_SET_CAPTURE_SOURCE, sourceId),
  captureAndOcr: (sourceId) => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_OCR, sourceId),
  analyzeScreen: (params) => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_ANALYZE, params),
  
  // Documents
  importDocument: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.DOCS_IMPORT, filePath),
  listDocuments: () => ipcRenderer.invoke(IPC_CHANNELS.DOCS_LIST),
  removeDocument: (id) => ipcRenderer.invoke(IPC_CHANNELS.DOCS_REMOVE, id),
  toggleDocument: (id, enabled) => ipcRenderer.invoke(IPC_CHANNELS.DOCS_TOGGLE, id, enabled),
  
  // Interview
  generateInterviewQuestions: (filePath, questionCount) => ipcRenderer.invoke(IPC_CHANNELS.INTERVIEW_GENERATE_QUESTIONS, filePath, questionCount),
  getAiProviderInfo: () => ipcRenderer.invoke(IPC_CHANNELS.INTERVIEW_GET_PROVIDER_INFO),
  generateInterviewQuestionsFromBackend: (filePath, questionCount) =>
    ipcRenderer.invoke(IPC_CHANNELS.INTERVIEW_GENERATE_FROM_BACKEND, filePath, questionCount),
  
  // Dialog
  openFileDialog: (options) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, options),
  
  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),
  
  // History
  getHistory: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET),
  deleteHistoryItem: (id) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_DELETE, id),
  clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_CLEAR),
  exportHistory: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_EXPORT),
  
  // Window
  toggleFloatingHud: (visible) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_HUD, visible),
  setAlwaysOnTop: (always) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, always),
  setCompactMode: (compact) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_COMPACT, compact),
  setOpacity: (opacity) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_OPACITY, opacity),
  onHudStateUpdate: (callback) => {
    const handler = (_, state) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.WINDOW_HUD_STATE_UPDATE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_HUD_STATE_UPDATE, handler);
  },
  
  // App
  setAppIcon: (iconPath) => ipcRenderer.invoke(IPC_CHANNELS.APP_SET_ICON, iconPath),
};

contextBridge.exposeInMainWorld('electronAPI', api);
console.log('[Preload] electronAPI exposed to window');
