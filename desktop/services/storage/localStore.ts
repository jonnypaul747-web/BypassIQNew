import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import { AppSettings, SessionHistoryItem, ContextDocument } from '../../shared/types/index.js';

const DEFAULT_SETTINGS: AppSettings = {
  ai: {
    provider: 'openai',
    modelName: 'gpt-4o',
    apiKey: '',
    temperature: 0.3,
    responseStyle: 'short',
    autoDetectQuestions: true,
    maxContextTokens: 4000,
    customInstructions: 'You are an ultra-fast, helpful real-time desktop assistant. Provide direct, concise, high-impact answers tailored to live conversations and coding questions.',
  },
  audio: {
    inputDeviceId: 'default',
    transcriptionProvider: 'openai',
    apiKey: '',
    language: 'en',
    enableSystemAudio: false,
    noiseSuppression: true,
  },
  screen: {
    ocrEngine: 'native-vision',
    autoCaptureOnQuestion: false,
  },
  ui: {
    alwaysOnTop: true,
    compactMode: false,
    opacity: 0.95,
    floatingHudVisible: false,
    screenShareProtection: true,
  },
  privacy: {
    retainAudio: false,
    retainScreenshots: false,
    localOnlyMode: false,
  },
};

interface StorageData {
  settings: AppSettings;
  history: SessionHistoryItem[];
  documents: ContextDocument[];
}

export class LocalStorageManager {
  private dataDir: string;
  private dataFile: string;
  private cache: StorageData;

  constructor(customPath?: string) {
    if (customPath) {
      this.dataDir = path.dirname(customPath);
      this.dataFile = customPath;
    } else {
      // Prioritize app.getPath('userData') if electron app is available, with safe fallbacks
      let baseDir = '';
      try {
        if (app && typeof app.getPath === 'function') {
          baseDir = app.getPath('userData');
        }
      } catch {}

      if (!baseDir) {
        baseDir = path.join(os.homedir(), 'Library', 'Application Support', 'JustCilledAI');
      }

      this.dataDir = baseDir;
      this.dataFile = path.join(this.dataDir, 'app_data.json');
    }

    this.cache = {
      settings: { ...DEFAULT_SETTINGS },
      history: [],
      documents: [],
    };

    this.init();
  }

  private init(): void {
    // Attempt primary data dir, fallback to workspace .data or /tmp if EPERM occurs
    const candidates = [
      this.dataDir,
      path.join(process.cwd(), '.data'),
      path.join(os.tmpdir(), 'JustCilledAI'),
    ];

    let initialized = false;

    for (const dir of candidates) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        this.dataDir = dir;
        this.dataFile = path.join(dir, 'app_data.json');

        if (fs.existsSync(this.dataFile)) {
          const raw = fs.readFileSync(this.dataFile, 'utf-8');
          const parsed = JSON.parse(raw);
          this.cache = {
            settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
            history: Array.isArray(parsed.history) ? parsed.history : [],
            documents: Array.isArray(parsed.documents) ? parsed.documents : [],
          };
        } else {
          this.persist();
        }
        initialized = true;
        break;
      } catch (err) {
        // Try next candidate directory
      }
    }

    if (!initialized) {
      console.warn('[LocalStorageManager] Operating with memory-backed state due to directory restrictions.');
    }
  }

  private persist(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const tempPath = `${this.dataFile}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.cache, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.dataFile);
    } catch (err) {
      // Fallback silently if disk write is temporarily restricted
    }
  }

  public getSettings(): AppSettings {
    return { ...this.cache.settings };
  }

  public get(key: string): any {
    return this.cache[key as keyof StorageData];
  }

  public set(key: string, value: any): void {
    (this.cache as any)[key] = value;
    this.persist();
  }

  public delete(key: string): void {
    delete (this.cache as any)[key];
    this.persist();
  }

  public saveSettings(partial: Partial<AppSettings>): AppSettings {
    this.cache.settings = {
      ...this.cache.settings,
      ...partial,
      ai: { ...this.cache.settings.ai, ...(partial.ai || {}) },
      audio: { ...this.cache.settings.audio, ...(partial.audio || {}) },
      screen: { ...this.cache.settings.screen, ...(partial.screen || {}) },
      ui: { ...this.cache.settings.ui, ...(partial.ui || {}) },
      privacy: { ...this.cache.settings.privacy, ...(partial.privacy || {}) },
    };
    this.persist();
    return this.cache.settings;
  }

  public getHistory(): SessionHistoryItem[] {
    return [...this.cache.history].sort((a, b) => b.timestamp - a.timestamp);
  }

  public addHistory(item: SessionHistoryItem): void {
    this.cache.history.unshift(item);
    if (this.cache.history.length > 200) {
      this.cache.history = this.cache.history.slice(0, 200);
    }
    this.persist();
  }

  public deleteHistory(id: string): void {
    this.cache.history = this.cache.history.filter((h) => h.id !== id);
    this.persist();
  }

  public clearHistory(): void {
    this.cache.history = [];
    this.persist();
  }

  public getDocuments(): ContextDocument[] {
    return [...this.cache.documents];
  }

  public addDocument(doc: ContextDocument): void {
    this.cache.documents = this.cache.documents.filter((d) => d.id !== doc.id);
    this.cache.documents.unshift(doc);
    this.persist();
  }

  public removeDocument(id: string): void {
    this.cache.documents = this.cache.documents.filter((d) => d.id !== id);
    this.persist();
  }

  public toggleDocument(id: string, enabled: boolean): void {
    const doc = this.cache.documents.find((d) => d.id === id);
    if (doc) {
      doc.enabled = enabled;
      this.persist();
    }
  }
}
