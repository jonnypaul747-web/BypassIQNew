const path = require('path');

// Resolved from this file, so subscriptions.db always lives in backend/ next to
// server.js — no matter which directory the process is started from.
const ROOT_DIR = path.join(__dirname, '..');

module.exports = {
  port: process.env.PORT || 3000,
  rootDir: ROOT_DIR,
  dbUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/justcilledai',

  // Shared secret for server-to-server calls (optional). Customers normally send
  // their license key instead — see src/middleware/apiKeyAuth.js.
  apiKey: process.env.API_KEY || '',

  // OCR fallback for PDFs that are images (scanned resumes) with no text layer.
  // Rendering + OCR is slow, so the page count is capped.
  ocr: {
    enabled: process.env.OCR_ENABLED !== '0',
    maxPages: Number(process.env.OCR_MAX_PAGES) || 3,
    scale: Number(process.env.OCR_SCALE) || 2,
    minTextChars: Number(process.env.OCR_MIN_TEXT_CHARS) || 80,
  },

  // Document → Q&A generation. This is the one feature where the server itself
  // calls an AI provider, so keep the context small to keep tokens (and cost) low.
  ai: {
    apiKey: process.env.GEMINI_API_KEY || '',
    provider: process.env.AI_PROVIDER || 'gemini',
    model: process.env.AI_MODEL || 'gemini-1.5-flash',
    maxDocumentChars: Number(process.env.AI_MAX_DOCUMENT_CHARS) || 6000,
    maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS) || 1400,
    maxQuestions: Number(process.env.AI_MAX_QUESTIONS) || 15,

    // Per-client cap on AI requests. Set AI_RATE_LIMIT_MAX=0 to disable.
    rateLimit: {
      max: process.env.AI_RATE_LIMIT_MAX === '0' ? 0 : Number(process.env.AI_RATE_LIMIT_MAX) || 10,
      windowMinutes: Number(process.env.AI_RATE_LIMIT_WINDOW_MINUTES) || 60,
    },
  },
};
