const crypto = require('crypto');
const express = require('express');
const { ai, liveClassAccessKey } = require('../config');
const { transcribeLiveAudio, generateLiveAnswer } = require('../services/liveClassService');

const router = express.Router();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 60;
const requestCounts = new Map();
const ALLOWED_STYLES = new Set(['short', 'detailed', 'bullet', 'step-by-step', 'technical', 'code']);

function requireLiveClassKey(req, res, next) {
  if (!liveClassAccessKey) {
    return res.status(503).json({ success: false, error: 'Live Class server access is not configured.' });
  }

  const supplied = Buffer.from(req.get('X-Live-Class-Key') || '');
  const expected = Buffer.from(liveClassAccessKey);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ success: false, error: 'Live Class access key is missing or invalid.' });
  }

  next();
}

function limitLiveRequests(req, res, next) {
  const clientKey = crypto.createHash('sha256').update(req.get('X-Live-Class-Key')).digest('hex');
  const now = Date.now();
  const bucket = requestCounts.get(clientKey);
  const current = !bucket || now - bucket.start >= RATE_WINDOW_MS
    ? { start: now, count: 0 }
    : bucket;

  current.count += 1;
  requestCounts.set(clientKey, current);
  res.set('X-RateLimit-Limit', String(RATE_LIMIT));
  res.set('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT - current.count)));

  if (current.count > RATE_LIMIT) {
    return res.status(429).json({ success: false, error: 'Live Class request limit reached. Try again shortly.' });
  }

  if (requestCounts.size > 1000) {
    for (const [key, value] of requestCounts) {
      if (now - value.start >= RATE_WINDOW_MS) requestCounts.delete(key);
    }
  }

  next();
}

function hasOpenRouterKey() {
  return ai.provider === 'openrouter' && Boolean(ai.apiKey);
}

router.post('/live/transcriptions', requireLiveClassKey, limitLiveRequests, async (req, res) => {
  if (!hasOpenRouterKey()) {
    return res.status(503).json({
      success: false,
      error: 'Live transcription is not configured. Set AI_PROVIDER=openrouter and OPENROUTER_API_KEY on the backend.',
    });
  }

  const audio = req.body?.audio;
  if (typeof audio !== 'string' || audio.length > 100_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) {
    return res.status(400).json({ success: false, error: 'Invalid or oversized WAV audio payload.' });
  }

  const wav = Buffer.from(audio, 'base64');
  if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    return res.status(400).json({ success: false, error: 'Audio payload must be a WAV file.' });
  }

  try {
    const result = await transcribeLiveAudio(audio);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[Live Class] Transcription failed:', error.message);
    return res.status(error.status || 502).json({ success: false, error: error.message || 'Transcription failed.' });
  }
});

router.post('/live/answer', requireLiveClassKey, limitLiveRequests, async (req, res) => {
  if (!hasOpenRouterKey()) {
    return res.status(503).json({
      success: false,
      error: 'Live Class AI is not configured. Set AI_PROVIDER=openrouter and OPENROUTER_API_KEY on the backend.',
    });
  }

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question || question.length > 4000) {
    return res.status(400).json({ success: false, error: 'Question must contain 1 to 4000 characters.' });
  }

  const transcriptHistory = Array.isArray(req.body?.transcriptHistory) ? req.body.transcriptHistory : [];
  const style = ALLOWED_STYLES.has(req.body?.style) ? req.body.style : 'short';

  try {
    const result = await generateLiveAnswer({ question, transcriptHistory, style });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[Live Class] Answer generation failed:', error.message);
    return res.status(error.status || 502).json({ success: false, error: error.message || 'Answer generation failed.' });
  }
});

module.exports = router;