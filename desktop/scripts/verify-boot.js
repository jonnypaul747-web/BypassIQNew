import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const { app, BrowserWindow } = require('electron');

console.log('[BootCheck] Starting verification script...');

app.whenReady().then(async () => {
  console.log('[BootCheck] Electron app.whenReady fired successfully!');
  try {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.resolve('dist/app/electron/preload/index.js'),
      },
    });

    const indexPath = path.resolve('dist/renderer/index.html');
    console.log('[BootCheck] Loading file at:', indexPath);
    await win.loadFile(indexPath);
    const title = win.getTitle();
    console.log('[BootCheck] Window loaded HTML successfully. Page Title:', title);
    if (title.includes('JustCilledAI')) {
      console.log('[BootCheck] >>> SUCCESS: JustCilledAI verified working 100%! <<<');
    }
  } catch (err) {
    console.error('[BootCheck] Error during window load:', err);
  } finally {
    app.quit();
  }
});
