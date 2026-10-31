export type ResponseStyle =
  | 'short'
  | 'detailed'
  | 'bullet'
  | 'step-by-step'
  | 'technical'
  | 'code';

export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'ollama' | 'mock';

export type TranscriptionProvider = 'deepgram' | 'openai' | 'web-speech' | 'mock';

export type AudioCaptureState = 'idle' | 'recording' | 'paused' | 'error';

export interface TranscriptionSegment {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
  speaker?: string;
  confidence?: number;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
  isDefault: boolean;
}

export interface AnswerSuggestion {
  id: string;
  question: string;
  answer: string;
  style: ResponseStyle;
  timestamp: number;
  provider: string;
  model: string;
  isStreaming: boolean;
  sourceDocuments?: string[];
  codeBlocks?: string[];
  error?: string;
}

export interface DisplaySource {
  id: string;
  name: string;
  thumbnail?: string;
  isMain?: boolean;
}

export interface OcrBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrLine {
  text: string;
  confidence: number;
  box: number[];
}

export interface OcrResult {
  success: boolean;
  text: string;
  lines: OcrLine[];
  error?: string;
}

export interface ContextDocument {
  id: string;
  name: string;
  fileType: 'txt' | 'md' | 'pdf' | 'docx';
  extractedText: string;
  sizeBytes: number;
  createdAt: number;
  enabled: boolean;
}

export interface AppSettings {
  ai: {
    provider: AiProvider;
    modelName: string;
    apiKey: string;
    temperature: number;
    responseStyle: ResponseStyle;
    autoDetectQuestions: boolean;
    maxContextTokens: number;
    customInstructions: string;
  };
  audio: {
    inputDeviceId: string;
    transcriptionProvider: TranscriptionProvider;
    apiKey: string;
    language: string;
    enableSystemAudio: boolean;
    noiseSuppression: boolean;
  };
  screen: {
    ocrEngine: 'native-vision' | 'multimodal';
    autoCaptureOnQuestion: boolean;
  };
  ui: {
    alwaysOnTop: boolean;
    compactMode: boolean;
    opacity: number;
    floatingHudVisible: boolean;
    screenShareProtection: boolean;
  };
  privacy: {
    retainAudio: boolean;
    retainScreenshots: boolean;
    localOnlyMode: boolean;
  };
}

export interface SessionHistoryItem {
  id: string;
  timestamp: number;
  question: string;
  answer: string;
  style: ResponseStyle;
  transcriptsContext?: string[];
  screenContext?: string;
  documentsUsed?: string[];
}

export const IPC_CHANNELS = {
  // existing channels ...
  // Add new channel for changing app icon at runtime
  APP_SET_ICON: 'app:set-icon' as const,

  // Audio & Transcription
  AUDIO_STATE_CHANGE: 'audio:state-change',
  AUDIO_TRANSCRIPTION_EVENT: 'audio:transcription-event',
  AUDIO_GET_DEVICES: 'audio:get-devices',
  AUDIO_START: 'audio:start',
  AUDIO_PAUSE: 'audio:pause',
  AUDIO_RESUME: 'audio:resume',
  AUDIO_STOP: 'audio:stop',

  // AI & Generation
  AI_GENERATE_ANSWER: 'ai:generate-answer',
  AI_STREAM_CHUNK: 'ai:stream-chunk',
  AI_CANCEL_GENERATION: 'ai:cancel-generation',
  AI_DETECT_QUESTIONS: 'ai:detect-questions',

  // Screen & OCR
  SCREEN_LIST_DISPLAYS: 'screen:list-displays',
  SCREEN_SET_CAPTURE_SOURCE: 'screen:set-capture-source',
  SCREEN_CAPTURE: 'screen:capture',
  SCREEN_OCR: 'screen:ocr',
  SCREEN_ANALYZE: 'screen:analyze',

  // Documents
  DOCS_IMPORT: 'docs:import',
  DOCS_LIST: 'docs:list',
  DOCS_REMOVE: 'docs:remove',
  DOCS_TOGGLE: 'docs:toggle',

  // Interview Questions
  INTERVIEW_GENERATE_QUESTIONS: 'interview:generate-questions',
  INTERVIEW_GENERATE_FROM_BACKEND: 'interview:generate-from-backend',
  INTERVIEW_GET_PROVIDER_INFO: 'interview:get-provider-info',

  // Dialog
  DIALOG_OPEN_FILE: 'dialog:open-file' as const,

  // Storage & Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  HISTORY_GET: 'history:get',
  HISTORY_DELETE: 'history:delete',
  HISTORY_CLEAR: 'history:clear',
  HISTORY_EXPORT: 'history:export',

  // HUD & Window
  WINDOW_TOGGLE_HUD: 'window:toggle-hud',
  WINDOW_SET_ALWAYS_ON_TOP: 'window:set-always-on-top',
  WINDOW_SET_COMPACT: 'window:set-compact',
  WINDOW_SET_OPACITY: 'window:set-opacity',
  WINDOW_SET_CONTENT_PROTECTION: 'window:set-content-protection',
  WINDOW_HUD_STATE_UPDATE: 'window:hud-state-update',
};

// CommonJS export for preload
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IPC_CHANNELS };
}

