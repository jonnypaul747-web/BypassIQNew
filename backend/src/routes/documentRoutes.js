const express = require('express');
const path = require('path');
const { ai } = require('../config');
const { extractDocument, truncateForPrompt } = require('../services/documentTextService');
const { generateQuestions } = require('../services/questionAnswerService');
const { hashDocument, buildCacheKey, readCache, writeCache } = require('../services/qaCacheService');
const { requireApiKey } = require('../middleware/apiKeyAuth');
const { rateLimitByClient } = require('../middleware/rateLimit');

const router = express.Router();

// The desktop app posts the raw file bytes, so no multipart parser is needed.
const readDocument = express.raw({ type: 'application/octet-stream', limit: '15mb' });

/**
 * POST /api/documents/questions?count=10
 * Body:    raw file bytes (Content-Type: application/octet-stream)
 * Headers: X-File-Name: url-encoded file name, e.g. resume.pdf
 *          X-API-Key:   license key (or the server API_KEY)
 * Returns: { success, cached, ocrUsed, documentName, provider, model, questionCount, usage, questions }
 * Errors:  401 missing/invalid key, 429 rate limit, 400 bad file, 503 no AI key, 502 AI failure
 */
router.post('/documents/questions', readDocument, requireApiKey, rateLimitByClient, async (req, res) => {
  const fileName = decodeURIComponent(req.get('X-File-Name') || req.query.file || '').trim();
  const requested = Number(req.query.count) || 10;
  const count = Math.min(Math.max(requested, 1), ai.maxQuestions);
  const documentName = path.basename(fileName || 'document');

  if (!fileName) {
    return res.status(400).json({
      success: false,
      error: 'Missing file name. Send it in the X-File-Name header.',
    });
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Empty request body. POST the file bytes as application/octet-stream.',
    });
  }

  // Same file bytes → same hash → the second upload never reaches the AI provider.
  const cacheKey = buildCacheKey({ documentHash: hashDocument(req.body), questionCount: count });
  const cached = await readCache(cacheKey);

  if (cached) {
    return res.status(200).json({
      success: true,
      cached: true,
      documentName,
      provider: 'openai',
      model: cached.model || ai.model,
      questionCount: cached.questions.length,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      questions: cached.questions,
    });
  }

  let text;
  let ocrUsed = false;
  try {
    const extracted = await extractDocument(req.body, fileName);
    text = extracted.text;
    ocrUsed = extracted.usedOcr;
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }

  // Trim before the AI call — this is the step that keeps input tokens small.
  const promptText = truncateForPrompt(text, ai.maxDocumentChars);

  const result = await generateQuestions({
    text: promptText,
    documentName,
    count,
  });

  if (result.status === 200 && result.body.success) {
    await writeCache({
      cacheKey,
      documentName,
      questionCount: count,
      questions: result.body.questions,
      usage: result.body.usage,
    });

    return res.status(200).json({ ...result.body, cached: false, ocrUsed });
  }

  return res.status(result.status).json(result.body);
});

module.exports = router;
