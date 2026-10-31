import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  AppSettings,
  ResponseStyle,
  TranscriptionSegment,
  SessionHistoryItem,
  ContextDocument,
  DisplaySource,
  OcrResult,
} from '../../../shared/types/index.js';

export interface ElectronAPI {
  // Audio & Transcription
  startAudio: (config?: any) => Promise<{ success: boolean; error?: string }>;
  pauseAudio: () => Promise<void>;
  resumeAudio: () => Promise<void>;
  stopAudio: () => Promise<void>;
  sendAudioChunk: (buffer: ArrayBuffer) => void;
  sendTranscriptEvent: (text: string, isFinal: boolean, speaker?: string) => void;
  onAudioStateChange: (callback: (state: string) => void) => () => void;
  onTranscriptionSegment: (callback: (segment: TranscriptionSegment) => void) => () => void;

  // AI & Generation
  generateAnswer: (params: {
    question: string;
    style?: ResponseStyle;
    screenContext?: string;
    documentId?: string;
  }) => Promise<{ success: boolean; id: string; answer: string; error?: string }>;
  cancelGeneration: () => Promise<void>;
  onAiStreamChunk: (callback: (data: { id: string; token: string; isComplete: boolean; error?: string }) => void) => () => void;

  // Screen & OCR
  listDisplaySources: () => Promise<DisplaySource[]>;
  setCaptureSource: (sourceId: string | null) => Promise<string | null>;
  captureAndOcr: (sourceId?: string) => Promise<{ ocrResult: OcrResult; imagePath: string; isDuplicate: boolean }>;
  analyzeScreen: (params: { sourceId?: string; prompt?: string }) => Promise<{ success: boolean; answer: string; ocrText: string; error?: string }>;

  // Documents
  importDocument: (filePath: string) => Promise<{ success: boolean; document?: ContextDocument; error?: string }>;
  listDocuments: () => Promise<ContextDocument[]>;
  removeDocument: (id: string) => Promise<void>;
  toggleDocument: (id: string, enabled: boolean) => Promise<void>;

  // Interview Questions
  generateInterviewQuestions: (filePath: string, questionCount?: number) => Promise<{
    success: boolean;
    data?: {
      questions: Array<{
        question: string;
        answer: string;
        category: string;
        difficulty: 'Easy' | 'Medium' | 'Hard';
      }>;
      aiProvider: string;
      aiModel: string;
      documentName: string;
      generatedAt: number;
    };
    error?: string;
  }>;
  getAiProviderInfo: () => Promise<{ provider: string; model: string }>;
  generateInterviewQuestionsFromBackend: (filePath: string, questionCount?: number) => Promise<{
    success: boolean;
    data?: {
      questions: Array<{
        question: string;
        answer: string;
        category: string;
        difficulty: 'Easy' | 'Medium' | 'Hard';
      }>;
      documentName: string;
      provider: string;
      model: string;
      questionCount: number;
      cached: boolean;
      ocrUsed?: boolean;
      usage: {
        inputTokens: number | null;
        outputTokens: number | null;
        totalTokens: number | null;
      };
    };
    error?: string;
  }>;

  // File Dialog
  openFileDialog: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{
    canceled: boolean;
    filePaths: string[];
  }>;

  // License
  validateLicense: (key: string) => Promise<boolean>;
  storeLicense: (key: string, expiresAt: number) => Promise<{ success: boolean }>;
  getLicenseStatus: () => Promise<{ hasLicense: boolean; expiresAt?: number; isValid?: boolean }>;
  clearLicense: () => Promise<{ success: boolean }>;
  getRemainingDays: () => Promise<number>;

  // Settings & Storage
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  getHistory: () => Promise<SessionHistoryItem[]>;
  deleteHistoryItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  exportHistory: () => Promise<string>;

  // Window & HUD
  toggleFloatingHud: (visible?: boolean) => Promise<boolean>;
  setAlwaysOnTop: (always: boolean) => Promise<void>;
  setCompactMode: (compact: boolean) => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  setAppIcon: (iconPath: string) => Promise<boolean>;
  onHudStateUpdate: (callback: (state: { isHud: boolean; compact: boolean; alwaysOnTop: boolean; opacity: number }) => void) => () => void;
}

export interface ElectronAPI {
  // Audio & Transcription
  startAudio: (config?: any) => Promise<{ success: boolean; error?: string }>;
  pauseAudio: () => Promise<void>;
  resumeAudio: () => Promise<void>;
  stopAudio: () => Promise<void>;
  sendAudioChunk: (buffer: ArrayBuffer) => void;
  sendTranscriptEvent: (text: string, isFinal: boolean, speaker?: string) => void;
  onAudioStateChange: (callback: (state: string) => void) => () => void;
  onTranscriptionSegment: (callback: (segment: TranscriptionSegment) => void) => () => void;

  // AI & Generation
  generateAnswer: (params: {
    question: string;
    style?: ResponseStyle;
    screenContext?: string;
    documentId?: string;
  }) => Promise<{ success: boolean; id: string; answer: string; error?: string }>;
  cancelGeneration: () => Promise<void>;
  onAiStreamChunk: (callback: (data: { id: string; token: string; isComplete: boolean; error?: string }) => void) => () => void;

  // Screen & OCR
  listDisplaySources: () => Promise<DisplaySource[]>;
  setCaptureSource: (sourceId: string | null) => Promise<string | null>;
  captureAndOcr: (sourceId?: string) => Promise<{ ocrResult: OcrResult; imagePath: string; isDuplicate: boolean }>;
  analyzeScreen: (params: { sourceId?: string; prompt?: string }) => Promise<{ success: boolean; answer: string; ocrText: string; error?: string }>;

  // Documents
  importDocument: (filePath: string) => Promise<{ success: boolean; document?: ContextDocument; error?: string }>;
  listDocuments: () => Promise<ContextDocument[]>;
  removeDocument: (id: string) => Promise<void>;
  toggleDocument: (id: string, enabled: boolean) => Promise<void>;

  // Interview Questions
  generateInterviewQuestions: (filePath: string, questionCount?: number) => Promise<{
    success: boolean;
    data?: {
      questions: Array<{
        question: string;
        answer: string;
        category: string;
        difficulty: 'Easy' | 'Medium' | 'Hard';
      }>;
      aiProvider: string;
      aiModel: string;
      documentName: string;
      generatedAt: number;
    };
    error?: string;
  }>;
  getAiProviderInfo: () => Promise<{ provider: string; model: string }>;
  generateInterviewQuestionsFromBackend: (filePath: string, questionCount?: number) => Promise<{
    success: boolean;
    data?: {
      questions: Array<{
        question: string;
        answer: string;
        category: string;
        difficulty: 'Easy' | 'Medium' | 'Hard';
      }>;
      documentName: string;
      provider: string;
      model: string;
      questionCount: number;
      cached: boolean;
      ocrUsed?: boolean;
      usage: {
        inputTokens: number | null;
        outputTokens: number | null;
        totalTokens: number | null;
      };
    };
    error?: string;
  }>;

  // File Dialog
  openFileDialog: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{
    canceled: boolean;
    filePaths: string[];
  }>;

  // Settings & Storage
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  getHistory: () => Promise<SessionHistoryItem[]>;
  deleteHistoryItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  exportHistory: () => Promise<string>;

  // Window & HUD
  toggleFloatingHud: (visible?: boolean) => Promise<boolean>;
  setAlwaysOnTop: (always: boolean) => Promise<void>;
  setCompactMode: (compact: boolean) => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  setAppIcon: (iconPath: string) => Promise<boolean>;
  onHudStateUpdate: (callback: (state: { isHud: boolean; compact: boolean; alwaysOnTop: boolean; opacity: number }) => void) => () => void;
}

const api: ElectronAPI = {
  // Audio
  startAudio: (config) => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_START, config),
  pauseAudio: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_PAUSE),
  resumeAudio: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_RESUME),
  stopAudio: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_STOP),
  sendAudioChunk: (buffer) => ipcRenderer.send('audio:chunk', buffer),
  sendTranscriptEvent: (text, isFinal, speaker) => ipcRenderer.send(IPC_CHANNELS.AUDIO_TRANSCRIPTION_EVENT, { text, isFinal, speaker }),
  onAudioStateChange: (callback) => {
    const handler = (_: any, state: string) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.AUDIO_STATE_CHANGE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_STATE_CHANGE, handler);
  },
  onTranscriptionSegment: (callback) => {
    const handler = (_: any, seg: TranscriptionSegment) => callback(seg);
    ipcRenderer.on(IPC_CHANNELS.AUDIO_TRANSCRIPTION_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_TRANSCRIPTION_EVENT, handler);
  },

  // AI
  generateAnswer: (params) => ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_ANSWER, params),
  cancelGeneration: () => ipcRenderer.invoke(IPC_CHANNELS.AI_CANCEL_GENERATION),
  onAiStreamChunk: (callback) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.AI_STREAM_CHUNK, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_CHUNK, handler);
  },

  // Screen
  listDisplaySources: () => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_LIST_DISPLAYS),
  setCaptureSource: (sourceId) => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_SET_CAPTURE_SOURCE, sourceId),
  captureAndOcr: (sourceId) => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_OCR, sourceId),
  analyzeScreen: (params) => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_ANALYZE, params),

  // Docs
  importDocument: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.DOCS_IMPORT, filePath),
  listDocuments: () => ipcRenderer.invoke(IPC_CHANNELS.DOCS_LIST),
  removeDocument: (id) => ipcRenderer.invoke(IPC_CHANNELS.DOCS_REMOVE, id),
  toggleDocument: (id, enabled) => ipcRenderer.invoke(IPC_CHANNELS.DOCS_TOGGLE, id, enabled),

  // Interview
  generateInterviewQuestions: (filePath, questionCount) => ipcRenderer.invoke(IPC_CHANNELS.INTERVIEW_GENERATE_QUESTIONS, filePath, questionCount),
  getAiProviderInfo: () => ipcRenderer.invoke(IPC_CHANNELS.INTERVIEW_GET_PROVIDER_INFO),
  generateInterviewQuestionsFromBackend: (filePath, questionCount) =>
    ipcRenderer.invoke(IPC_CHANNELS.INTERVIEW_GENERATE_FROM_BACKEND, filePath, questionCount),

  // File Dialog
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),

  // License
  validateLicense: (key) => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_VALIDATE, key),
  storeLicense: (key, expiresAt) => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_STORE, key, expiresAt),
  getLicenseStatus: () => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_STATUS),
  clearLicense: () => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_CLEAR),
  getRemainingDays: () => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_REMAINING_DAYS),

  // Storage
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),
  getHistory: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET),
  deleteHistoryItem: (id) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_DELETE, id),
  clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_CLEAR),
  exportHistory: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_EXPORT),

  // HUD
  toggleFloatingHud: (visible) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_HUD, visible),
  setAlwaysOnTop: (always) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, always),
  setCompactMode: (compact) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_COMPACT, compact),
  setOpacity: (opacity) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_OPACITY, opacity),
  // App Icon
  // app/electron/preload/index.ts
  setAppIcon: (iconPath: string) => ipcRenderer.invoke(IPC_CHANNELS.APP_SET_ICON, iconPath), onHudStateUpdate: (callback) => {
    const handler = (_: any, state: any) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.WINDOW_HUD_STATE_UPDATE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_HUD_STATE_UPDATE, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

console.log('[Preload] electronAPI exposed to window');
