const { contextBridge, ipcRenderer } = require('electron');

const api = {
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  generateInterviewQuestionsFromBackend: (filePath, questionCount) =>
    ipcRenderer.invoke('interview:generate-from-backend', filePath, questionCount),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
};

contextBridge.exposeInMainWorld('electronAPI', api);
