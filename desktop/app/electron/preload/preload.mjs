import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  AUDIO_START: 'audio:start',
  AUDIO_PAUSE: 'audio:pause',
  AUDIO_RESUME: 'audio:resume',
  AUDIO_STOP: 'audio:stop',
  INTERVIEW_GENERATE_FROM_BACKEND: 'interview:generate-from-backend',
  DIALOG_OPEN_FILE: 'dialog:open-file',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
};

const api = {
  startAudio: (config) => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_START, config),
  pauseAudio: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_PAUSE),
  resumeAudio: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_RESUME),
  stopAudio: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_STOP),
  generateInterviewQuestionsFromBackend: (filePath, questionCount) =>
    ipcRenderer.invoke(IPC_CHANNELS.INTERVIEW_GENERATE_FROM_BACKEND, filePath, questionCount),
  openFileDialog: (options) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, options),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),
};

contextBridge.exposeInMainWorld('electronAPI', api);
console.log('[Preload] electronAPI exposed to window');
