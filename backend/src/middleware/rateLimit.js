const { ai } = require('../config');

const { max, windowMinutes } = ai.rateLimit;
const windowMs = windowMinutes * 60 * 1000;

// clientId -> { count, resetAt }. In-memory on purpose: counters reset on restart and
// are per process, which is fine for a single instance with SQLite.
const buckets = new Map();

/**
 * Counts requests per authenticated client (`req.apiClient.id` — a user or the master key),
 * so one license cannot burn the whole AI budget and other users are unaffected.
 */
function rateLimitByClient(req, res, next) {
  if (!max) {
    return next();
  }

  const id = req.apiClient ? req.apiClient.id : 'anonymous';
  const now = Date.now();

  let bucket = buckets.get(id);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(id, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, max - bucket.count);

  res.set('X-RateLimit-Limit', String(max));
  res.set('X-RateLimit-Remaining', String(remaining));
  res.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > max) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      success: false,
      error: `Rate limit reached (${max} requests per ${windowMinutes} min). Try again in ${retryAfter}s.`,
    });
  }

  return next();
}

// Drop expired buckets so the map cannot grow forever.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [id, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(id);
    }
  }
}, Math.max(windowMs, 60 * 1000));
if (typeof sweeper.unref === 'function') {
  sweeper.unref();
}

function resetRateLimitState() {
  buckets.clear();
}

module.exports = { rateLimitByClient, resetRateLimitState };
