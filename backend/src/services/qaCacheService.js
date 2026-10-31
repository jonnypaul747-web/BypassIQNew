const crypto = require('crypto');
const { get, run } = require('../db');
const { ai } = require('../config');

// Bump this when the prompt or the response shape changes, so old answers are not reused.
const PROMPT_VERSION = 1;

/**
 * SHA-256 of the raw file bytes. Same resume uploaded again → same hash → cache hit.
 */
function hashDocument(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * The answer depends on the document, how many questions were asked for, and the model,
 * so all three are part of the key.
 */
function buildCacheKey({ documentHash, questionCount }) {
  return `${documentHash}:${questionCount}:${ai.model}:v${PROMPT_VERSION}`;
}

/**
 * Returns the stored questions for a key, or null. Cache failures never break a request.
 */
async function readCache(cacheKey) {
  try {
    const row = await get('SELECT * FROM document_qa_cache WHERE cache_key = $1', [cacheKey]);
    if (!row) {
      return null;
    }

    // Hit counter is best-effort housekeeping; not worth failing the request over.
    run(
      'UPDATE document_qa_cache SET hits = hits + 1, last_used_at = CURRENT_TIMESTAMP WHERE cache_key = $1',
      [cacheKey]
    ).catch((err) => console.error('[Backend] Cache hit counter failed:', err));

    let questions;
    try {
      questions = JSON.parse(row.questions);
    } catch (err) {
      console.error('[Backend] Cached questions are corrupt, ignoring entry:', err);
      return null;
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return null;
    }

    return {
      documentName: row.document_name,
      model: row.model,
      questions,
      usage: {
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        totalTokens: row.total_tokens,
      },
      createdAt: row.created_at,
    };
  } catch (err) {
    console.error('[Backend] QA cache read failed:', err);
    return null;
  }
}

/**
 * Stores freshly generated questions. Never throws — a cache write failure must not
 * turn a good AI response into an error.
 */
async function writeCache({ cacheKey, documentName, questionCount, questions, usage = {} }) {
  try {
    await run(
      `INSERT INTO document_qa_cache
         (cache_key, document_name, question_count, model, questions, input_tokens, output_tokens, total_tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (cache_key) DO UPDATE SET
         questions = EXCLUDED.questions,
         input_tokens = EXCLUDED.input_tokens,
         output_tokens = EXCLUDED.output_tokens,
         total_tokens = EXCLUDED.total_tokens,
         last_used_at = CURRENT_TIMESTAMP`,
      [
        cacheKey,
        documentName,
        questionCount,
        ai.model,
        JSON.stringify(questions),
        usage.inputTokens ?? null,
        usage.outputTokens ?? null,
        usage.totalTokens ?? null,
      ]
    );
  } catch (err) {
    console.error('[Backend] QA cache write failed:', err);
  }
}

module.exports = { hashDocument, buildCacheKey, readCache, writeCache, PROMPT_VERSION };
