export const IPC_CHANNELS = {
    // existing channels ...
    // Add new channel for changing app icon at runtime
    APP_SET_ICON: 'app:set-icon',
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
    DIALOG_OPEN_FILE: 'dialog:open-file',
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
