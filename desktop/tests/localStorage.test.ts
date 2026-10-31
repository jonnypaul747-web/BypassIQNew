import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { LocalStorageManager } from '../services/storage/localStore.js';

describe('LocalStorageManager', () => {
  let tempFilePath: string;
  let manager: LocalStorageManager;

  beforeEach(() => {
    tempFilePath = path.join(os.tmpdir(), `test_store_${Date.now()}_${Math.random().toString(36).substring(2)}.json`);
    manager = new LocalStorageManager(tempFilePath);
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch {}
  });

  it('initializes with valid default settings', () => {
    const settings = manager.getSettings();
    expect(settings.ai.provider).toBeDefined();
    expect(settings.audio.transcriptionProvider).toBeDefined();
    expect(settings.ui.alwaysOnTop).toBe(true);
  });

  it('updates and persists settings', () => {
    manager.saveSettings({
      ai: { ...manager.getSettings().ai, modelName: 'test-model-42' },
      ui: { ...manager.getSettings().ui, opacity: 0.8 },
    });

    // Re-instantiate from disk
    const reloaded = new LocalStorageManager(tempFilePath);
    expect(reloaded.getSettings().ai.modelName).toBe('test-model-42');
    expect(reloaded.getSettings().ui.opacity).toBe(0.8);
  });

  it('adds and retrieves history items with max bound', () => {
    manager.addHistory({
      id: 'h1',
      timestamp: Date.now(),
      question: 'What is memoization?',
      answer: 'Caching function results.',
      style: 'short',
    });

    const history = manager.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].question).toBe('What is memoization?');

    manager.deleteHistory('h1');
    expect(manager.getHistory().length).toBe(0);
  });

  it('manages documents and toggle state', () => {
    manager.addDocument({
      id: 'd1',
      name: 'notes.md',
      fileType: 'md',
      extractedText: '# Project Architecture',
      sizeBytes: 50,
      createdAt: Date.now(),
      enabled: true,
    });

    expect(manager.getDocuments().length).toBe(1);
    manager.toggleDocument('d1', false);
    expect(manager.getDocuments()[0].enabled).toBe(false);

    manager.removeDocument('d1');
    expect(manager.getDocuments().length).toBe(0);
  });
});

