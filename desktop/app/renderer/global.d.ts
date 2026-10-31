import { ElectronAPI } from '../electron/preload/index.js';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

