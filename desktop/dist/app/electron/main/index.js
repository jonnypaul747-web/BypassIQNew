import { app, BrowserWindow, ipcMain, globalShortcut, systemPreferences, session, dialog, desktopCapturer } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { IPC_CHANNELS } from '../../../shared/types/index.js';
import { LICENSE_BACKEND_URL } from '../../../shared/config.js';
import { LocalStorageManager } from '../../../services/storage/localStore.js';
import { AiService } from '../../../services/ai/aiService.js';
import { ScreenService } from '../../../services/screen/screenService.js';
import { DocumentService } from '../../../services/documents/documentService.js';
import { TranscriptionService } from '../../../services/transcription/transcriptionService.js';
import { QuestionDetector } from '../../../services/ai/questionDetector.js';
import { InterviewService } from '../../../services/interview/interviewService.js';
import { LicenseService } from '../../../services/license/licenseService.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
let hudWindow = null;
const store = new LocalStorageManager();
const settings = store.getSettings();
const aiService = new AiService(settings.ai);
const screenService = new ScreenService();
const docService = new DocumentService();
const transcriptionService = new TranscriptionService(settings.audio.transcriptionProvider, settings.audio.apiKey);
const interviewService = new InterviewService(aiService, docService);
const licenseService = new LicenseService(store);
// Which screen/window the user picked for system-audio capture (null = primary screen).
let pendingCaptureSourceId = null;
let activeAbortController = null;
let audioCaptureState = 'idle';
let recentTranscripts = [];
function isDev() {
    return process.env.NODE_ENV === 'development' || !app.isPackaged;
}
function getPreloadPath() {
    return path.join(__dirname, '../preload/index.js');
}
function createMainWindow() {
    const currentSettings = store.getSettings();
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        title: 'JustCilledAI',
        backgroundColor: '#020617',
        webPreferences: {
            preload: getPreloadPath(),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    // ALWAYS hide from screen capture (NSWindowSharingNone) — no conditional check
    try {
        mainWindow.setContentProtection(true);
    }
    catch (e) {
        console.warn('[Window] setContentProtection failed:', e);
    }
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../../../renderer/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function createHudWindow() {
    const currentSettings = store.getSettings();
    hudWindow = new BrowserWindow({
        width: currentSettings.ui.compactMode ? 360 : 440,
        height: currentSettings.ui.compactMode ? 240 : 580,
        minWidth: 300,
        minHeight: 180,
        frame: false,
        transparent: true,
        alwaysOnTop: currentSettings.ui.alwaysOnTop,
        skipTaskbar: true,
        show: false,
        opacity: currentSettings.ui.opacity ?? 0.95,
        webPreferences: {
            preload: getPreloadPath(),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    // ALWAYS hide HUD from screen capture (NSWindowSharingNone) — unconditional
    try {
        hudWindow.setContentProtection(true);
    }
    catch (e) {
        console.warn('[HudWindow] setContentProtection failed:', e);
    }
    const urlParam = '?view=hud';
    if (process.env.VITE_DEV_SERVER_URL) {
        hudWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}${urlParam}`);
    }
    else {
        hudWindow.loadFile(path.join(__dirname, '../../../renderer/index.html'), {
            query: { view: 'hud' },
        });
    }
    hudWindow.on('closed', () => {
        hudWindow = null;
    });
}
function broadcastToWindows(channel, ...args) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, ...args);
    }
    if (hudWindow && !hudWindow.isDestroyed()) {
        hudWindow.webContents.send(channel, ...args);
    }
}
async function requestMacPermissions() {
    if (process.platform === 'darwin') {
        try {
            const micStatus = await systemPreferences.askForMediaAccess('microphone');
            console.log('[App] Microphone permission status:', micStatus);
        }
        catch (err) {
            console.warn('[App] Error requesting microphone permission:', err);
        }
    }
}
function setupIpcHandlers() {
    // --- Settings & Storage ---
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => store.getSettings());
    ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, (_, newSettings) => {
        const updated = store.saveSettings(newSettings);
        aiService.updateSettings(updated.ai);
        transcriptionService.setConfig(updated.audio.transcriptionProvider, updated.audio.apiKey);
        if (hudWindow && !hudWindow.isDestroyed()) {
            hudWindow.setAlwaysOnTop(updated.ui.alwaysOnTop);
            hudWindow.setOpacity(updated.ui.opacity);
        }
        return updated;
    });
    ipcMain.handle(IPC_CHANNELS.HISTORY_GET, () => store.getHistory());
    ipcMain.handle(IPC_CHANNELS.HISTORY_DELETE, (_, id) => store.deleteHistory(id));
    ipcMain.handle(IPC_CHANNELS.HISTORY_CLEAR, () => store.clearHistory());
    ipcMain.handle(IPC_CHANNELS.HISTORY_EXPORT, () => {
        const history = store.getHistory();
        return JSON.stringify(history, null, 2);
    });
    // --- Audio & Transcription ---
    ipcMain.handle(IPC_CHANNELS.AUDIO_START, async () => {
        await requestMacPermissions();
        audioCaptureState = 'recording';
        broadcastToWindows(IPC_CHANNELS.AUDIO_STATE_CHANGE, 'recording');
        transcriptionService.start({
            onSegment: (segment) => {
                broadcastToWindows(IPC_CHANNELS.AUDIO_TRANSCRIPTION_EVENT, segment);
                if (segment.isFinal) {
                    recentTranscripts.push(segment.text);
                    if (recentTranscripts.length > 30)
                        recentTranscripts.shift();
                    // Auto-detect question if configured
                    const currentSettings = store.getSettings();
                    if (currentSettings.ai.autoDetectQuestions) {
                        const detectedQuestion = QuestionDetector.extractLatestQuestion([{ text: segment.text, isFinal: true }]);
                        if (detectedQuestion) {
                            console.log('[Audio] Auto-detected question in live audio:', detectedQuestion);
                            handleGenerateAnswer({
                                question: detectedQuestion,
                                style: currentSettings.ai.responseStyle,
                            });
                        }
                    }
                }
            },
            onError: (err) => {
                console.error('[Transcription] Error:', err);
                broadcastToWindows(IPC_CHANNELS.AUDIO_STATE_CHANGE, 'error');
            },
            onStateChange: (state) => {
                broadcastToWindows(IPC_CHANNELS.AUDIO_STATE_CHANGE, state === 'connected' ? 'recording' : 'idle');
            },
        });
        return { success: true };
    });
    ipcMain.handle(IPC_CHANNELS.AUDIO_PAUSE, () => {
        audioCaptureState = 'paused';
        broadcastToWindows(IPC_CHANNELS.AUDIO_STATE_CHANGE, 'paused');
    });
    ipcMain.handle(IPC_CHANNELS.AUDIO_RESUME, () => {
        audioCaptureState = 'recording';
        broadcastToWindows(IPC_CHANNELS.AUDIO_STATE_CHANGE, 'recording');
    });
    ipcMain.handle(IPC_CHANNELS.AUDIO_STOP, () => {
        audioCaptureState = 'idle';
        transcriptionService.stop();
        broadcastToWindows(IPC_CHANNELS.AUDIO_STATE_CHANGE, 'idle');
    });
    ipcMain.on('audio:chunk', (_, buffer) => {
        transcriptionService.processAudioChunk(Buffer.from(buffer));
    });
    ipcMain.on(IPC_CHANNELS.AUDIO_TRANSCRIPTION_EVENT, (_, data) => {
        transcriptionService.handleTranscriptSegment(data.text, data.isFinal, data.speaker);
    });
    // --- AI & Generation ---
    async function handleGenerateAnswer(params) {
        // Check license before allowing generation
        const isLicenseValid = await licenseService.isLicenseValid();
        if (!isLicenseValid) {
            return {
                success: false,
                id: '',
                answer: '',
                error: 'License expired or invalid. Please subscribe to continue using JustCilledAI.'
            };
        }
        const currentSettings = store.getSettings();
        const style = params.style || currentSettings.ai.responseStyle || 'short';
        const id = `ans_${Date.now()}`;
        if (activeAbortController) {
            activeAbortController.abort();
        }
        activeAbortController = new AbortController();
        let activeDocs = store.getDocuments().filter((d) => d.enabled);
        // If a specific document ID is provided, only use that document
        if (params.documentId) {
            activeDocs = activeDocs.filter((d) => d.id === params.documentId);
        }
        try {
            broadcastToWindows(IPC_CHANNELS.AI_STREAM_CHUNK, {
                id,
                token: '',
                isComplete: false,
                question: params.question,
            });
            const result = await aiService.generateAnswer({
                question: params.question,
                style,
                transcriptHistory: recentTranscripts,
                screenOcrContext: params.screenContext,
                activeDocuments: activeDocs,
                signal: activeAbortController.signal,
                onToken: (token) => {
                    broadcastToWindows(IPC_CHANNELS.AI_STREAM_CHUNK, {
                        id,
                        token,
                        isComplete: false,
                    });
                },
            });
            broadcastToWindows(IPC_CHANNELS.AI_STREAM_CHUNK, {
                id,
                token: '',
                isComplete: true,
                answer: result.answer,
                codeBlocks: result.codeBlocks,
                documentsUsed: result.documentsUsed,
            });
            // Save to local history
            store.addHistory({
                id,
                timestamp: Date.now(),
                question: params.question,
                answer: result.answer,
                style,
                transcriptsContext: recentTranscripts.slice(-5),
                screenContext: params.screenContext,
                documentsUsed: result.documentsUsed,
            });
            return { success: true, id, answer: result.answer };
        }
        catch (err) {
            const isAborted = activeAbortController?.signal.aborted;
            if (!isAborted) {
                console.error('[AI] Generation failed:', err);
                broadcastToWindows(IPC_CHANNELS.AI_STREAM_CHUNK, {
                    id,
                    token: '',
                    isComplete: true,
                    error: err.message || 'Generation failed',
                });
            }
            return { success: false, id, answer: '', error: err.message };
        }
        finally {
            activeAbortController = null;
        }
    }
    ipcMain.handle(IPC_CHANNELS.AI_GENERATE_ANSWER, async (_, params) => {
        return handleGenerateAnswer(params);
    });
    ipcMain.handle(IPC_CHANNELS.AI_CANCEL_GENERATION, () => {
        if (activeAbortController) {
            activeAbortController.abort();
            activeAbortController = null;
        }
    });
    // --- Screen & OCR ---
    ipcMain.handle(IPC_CHANNELS.SCREEN_LIST_DISPLAYS, async () => {
        return screenService.getAvailableSources();
    });
    // Interview live mode: remember which screen or window the user chose to capture.
    ipcMain.handle(IPC_CHANNELS.SCREEN_SET_CAPTURE_SOURCE, (_, sourceId) => {
        pendingCaptureSourceId = sourceId || null;
        return pendingCaptureSourceId;
    });
    ipcMain.handle(IPC_CHANNELS.SCREEN_OCR, async (_, sourceId) => {
        return screenService.captureAndOcr(sourceId);
    });
    ipcMain.handle(IPC_CHANNELS.SCREEN_ANALYZE, async (_, params) => {
        const { ocrResult } = await screenService.captureAndOcr(params.sourceId);
        if (!ocrResult.success || !ocrResult.text.trim()) {
            return {
                success: false,
                answer: '',
                ocrText: '',
                error: ocrResult.error || 'No visible text could be extracted from the selected screen.',
            };
        }
        const prompt = params.prompt || 'Please explain what is visible on this screen and provide key solutions for any code or errors shown.';
        const genResult = await handleGenerateAnswer({
            question: prompt,
            screenContext: ocrResult.text,
            style: 'technical',
        });
        return {
            success: genResult.success,
            answer: genResult.answer,
            ocrText: ocrResult.text,
            error: genResult.error,
        };
    });
    // --- Documents ---
    ipcMain.handle(IPC_CHANNELS.DOCS_IMPORT, async (_, filePath) => {
        try {
            const doc = await docService.importDocument(filePath);
            store.addDocument(doc);
            return { success: true, document: doc };
        }
        catch (err) {
            console.error('[Docs] Import error:', err);
            return { success: false, error: err.message };
        }
    });
    ipcMain.handle(IPC_CHANNELS.DOCS_LIST, () => store.getDocuments());
    ipcMain.handle(IPC_CHANNELS.DOCS_REMOVE, (_, id) => store.removeDocument(id));
    ipcMain.handle(IPC_CHANNELS.DOCS_TOGGLE, (_, id, enabled) => store.toggleDocument(id, enabled));
    // --- Interview Questions ---
    ipcMain.handle(IPC_CHANNELS.INTERVIEW_GENERATE_QUESTIONS, async (_, filePath, questionCount = 15) => {
        try {
            const result = await interviewService.generateInterviewQuestions(filePath, questionCount);
            return { success: true, data: result };
        }
        catch (err) {
            console.error('[Interview] Error generating questions:', err);
            return { success: false, error: err.message };
        }
    });
    // Document → Q&A generated by the backend (see backend/src/routes/documentRoutes.js).
    // The file is read here and posted as raw bytes, so the renderer never touches the network.
    ipcMain.handle(IPC_CHANNELS.INTERVIEW_GENERATE_FROM_BACKEND, async (_, filePath, questionCount = 10) => {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const fileName = path.basename(filePath);
            // The backend only generates Q&A for licensed clients (see backend/src/middleware/apiKeyAuth.js).
            const storedLicense = await licenseService.getStoredLicense();
            const licenseKey = storedLicense && storedLicense.key ? storedLicense.key : '';
            if (!licenseKey) {
                return {
                    success: false,
                    error: 'Document Q&A needs an active license. Activate a license key first.',
                };
            }
            const response = await fetch(`${LICENSE_BACKEND_URL}/api/documents/questions?count=${encodeURIComponent(String(questionCount))}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-File-Name': encodeURIComponent(fileName),
                    'X-API-Key': licenseKey,
                },
                body: fileBuffer,
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                return {
                    success: false,
                    error: payload.error || `Backend responded with HTTP ${response.status}.`,
                };
            }
            return { success: true, data: payload };
        }
        catch (err) {
            console.error('[Interview] Backend generation failed:', err);
            return {
                success: false,
                error: `Could not reach the backend at ${LICENSE_BACKEND_URL} — ${err.message}`,
            };
        }
    });
    ipcMain.handle(IPC_CHANNELS.INTERVIEW_GET_PROVIDER_INFO, () => {
        return interviewService.getAiProviderInfo();
    });
    // --- File Dialog ---
    ipcMain.handle('dialog:openFile', async (_, options) => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: options?.filters || [
                { name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md'] },
            ],
        });
        return result;
    });
    // --- License ---
    ipcMain.handle(IPC_CHANNELS.LICENSE_VALIDATE, async (_, key) => {
        return await licenseService.validateLicense(key);
    });
    ipcMain.handle(IPC_CHANNELS.LICENSE_STORE, async (_, key, expiresAt) => {
        await licenseService.storeLicense(key, expiresAt);
        return { success: true };
    });
    ipcMain.handle(IPC_CHANNELS.LICENSE_STATUS, async () => {
        const license = await licenseService.getStoredLicense();
        return {
            hasLicense: !!license,
            expiresAt: license?.expiresAt,
            isValid: license?.isValid
        };
    });
    ipcMain.handle(IPC_CHANNELS.LICENSE_CLEAR, async () => {
        await licenseService.clearLicense();
        return { success: true };
    });
    ipcMain.handle(IPC_CHANNELS.LICENSE_REMAINING_DAYS, async () => {
        return await licenseService.getRemainingDays();
    });
    // --- Floating HUD Window Management ---
    ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_HUD, (_, visible) => {
        if (!hudWindow) {
            createHudWindow();
        }
        if (!hudWindow)
            return false;
        const shouldShow = visible !== undefined ? visible : !hudWindow.isVisible();
        if (shouldShow) {
            hudWindow.show();
        }
        else {
            hudWindow.hide();
        }
        return shouldShow;
    });
    ipcMain.handle(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, (_, always) => {
        store.saveSettings({ ui: { ...store.getSettings().ui, alwaysOnTop: always } });
        if (hudWindow && !hudWindow.isDestroyed()) {
            hudWindow.setAlwaysOnTop(always);
        }
    });
    ipcMain.handle(IPC_CHANNELS.WINDOW_SET_COMPACT, (_, compact) => {
        store.saveSettings({ ui: { ...store.getSettings().ui, compactMode: compact } });
        if (hudWindow && !hudWindow.isDestroyed()) {
            hudWindow.setSize(compact ? 360 : 440, compact ? 220 : 580);
        }
    });
    ipcMain.handle(IPC_CHANNELS.WINDOW_SET_OPACITY, (_, opacity) => {
        store.saveSettings({ ui: { ...store.getSettings().ui, opacity } });
        if (hudWindow && !hudWindow.isDestroyed()) {
            hudWindow.setOpacity(opacity);
        }
    });
    ipcMain.handle(IPC_CHANNELS.WINDOW_SET_CONTENT_PROTECTION, (_, enabled) => {
        store.saveSettings({ ui: { ...store.getSettings().ui, screenShareProtection: enabled } });
        if (mainWindow && !mainWindow.isDestroyed()) {
            try {
                mainWindow.setContentProtection(enabled);
            }
            catch { }
        }
        if (hudWindow && !hudWindow.isDestroyed()) {
            try {
                hudWindow.setContentProtection(enabled);
            }
            catch { }
        }
        return enabled;
    });
}
app.whenReady().then(async () => {
    // Automatically grant microphone and screen capture permissions to the renderer
    if (session && session.defaultSession) {
        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
            if (permission === 'media' || permission === 'display-capture') {
                callback(true);
            }
            else {
                callback(false);
            }
        });
        session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
            return permission === 'media' || permission === 'display-capture';
        });
        // Interview live mode captures the system output (the teacher/interviewer) instead of the
        // microphone. Requesting display media with `audio: 'loopback'` gives the renderer a stream
        // carrying that system audio; no window picker is shown, the primary screen is used.
        session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
            try {
                const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
                // The source the user picked in the UI wins; otherwise fall back to the primary screen.
                const requested = pendingCaptureSourceId
                    ? sources.find((source) => source.id === pendingCaptureSourceId)
                    : undefined;
                if (pendingCaptureSourceId && !requested) {
                    console.warn('[App] Chosen capture source is gone, falling back to the primary screen');
                }
                const target = requested || sources.find((s) => s.id.startsWith('screen:')) || sources[0];
                if (!target) {
                    console.warn('[App] No screen source available for system audio capture');
                    callback({});
                    return;
                }
                callback({ video: target, audio: 'loopback' });
            }
            catch (err) {
                console.error('[App] System audio capture setup failed:', err);
                callback({});
            }
        }, { useSystemPicker: false });
    }
    setupIpcHandlers();
    createMainWindow();
    createHudWindow();
    // Force-apply content protection again after windows are fully created
    // This ensures protection even if the window creation had a race condition
    setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            try {
                mainWindow.setContentProtection(true);
            }
            catch { }
        }
        if (hudWindow && !hudWindow.isDestroyed()) {
            try {
                hudWindow.setContentProtection(true);
            }
            catch { }
        }
        console.log('[App] Content protection applied to all windows — app is hidden from screen recording.');
    }, 500);
    // Handle dynamic app icon change (runtime)
    ipcMain.handle(IPC_CHANNELS.APP_SET_ICON, async (_, iconPath) => {
        try {
            const { nativeImage } = require('electron');
            const img = nativeImage.createFromPath(iconPath);
            if (img.isEmpty()) {
                console.warn('[Icon] Invalid icon image at', iconPath);
                return false;
            }
            // Set Dock icon (macOS) and window icon for other platforms
            if (app.dock)
                app.dock.setIcon(img);
            if (mainWindow)
                mainWindow.setIcon(img);
            if (hudWindow)
                hudWindow.setIcon(img);
            console.log('[Icon] App icon updated to', iconPath);
            return true;
        }
        catch (e) {
            console.error('[Icon] Failed to set app icon:', e);
            return false;
        }
    });
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
        if (hudWindow && !hudWindow.isDestroyed()) {
            if (hudWindow.isVisible()) {
                hudWindow.hide();
            }
            else {
                hudWindow.show();
            }
        }
    });
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    screenService.cleanupTempFiles();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
