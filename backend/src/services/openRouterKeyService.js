const { ai } = require('../config');

/**
 * In-memory cache for generated API keys
 * In production, this should be stored in a secure database
 */
const keyCache = new Map();

/**
 * Cache TTL in milliseconds (24 hours)
 */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Creates a new OpenRouter API key using the Management API
 * @param {string} keyName - Name for the new API key
 * @param {number} limit - Optional spending limit in USD
 * @param {string} limitReset - Type of limit reset (daily, weekly, monthly)
 * @returns {Promise<{key: string, hash: string, error?: string}>}
 */
async function createApiKey(keyName = 'BypassIQ AI Service', limit = 50, limitReset = 'monthly') {
  if (!ai.managementApiKey) {
    return {
      error: 'OpenRouter Management API Key is not configured. Set OPENROUTER_MANAGEMENT_API_KEY in environment.',
    };
  }

  try {
    // Calculate expiration date (1 year from now)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const response = await fetch('https://openrouter.ai/api/v1/keys', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ai.managementApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: keyName,
        expires_at: expiresAt.toISOString(),
        limit,
        limit_reset: limitReset,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenRouter] Key creation failed:', response.status, errorText);
      return {
        error: `Failed to create API key: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      key: data.data.key,
      hash: data.data.hash,
    };
  } catch (error) {
    console.error('[OpenRouter] Key creation error:', error);
    return {
      error: `Failed to create API key: ${error.message}`,
    };
  }
}

/**
 * Gets or creates an API key with caching
 * @param {string} cacheKey - Unique identifier for the cached key
 * @returns {Promise<{key: string, error?: string}>}
 */
async function getOrCreateApiKey(cacheKey = 'default') {
  const cached = keyCache.get(cacheKey);

  // Return cached key if it's still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { key: cached.key };
  }

  // Create a new key
  const result = await createApiKey(`${cacheKey} - ${new Date().toISOString()}`);

  if (result.error) {
    return result;
  }

  // Cache the new key
  keyCache.set(cacheKey, {
    key: result.key,
    hash: result.hash,
    timestamp: Date.now(),
  });

  return { key: result.key };
}

/**
 * Invalidates a cached key
 * @param {string} cacheKey - Unique identifier for the cached key
 */
function invalidateCache(cacheKey = 'default') {
  keyCache.delete(cacheKey);
}

/**
 * Clears all cached keys
 */
function clearAllCache() {
  keyCache.clear();
}

module.exports = {
  createApiKey,
  getOrCreateApiKey,
  invalidateCache,
  clearAllCache,
};
