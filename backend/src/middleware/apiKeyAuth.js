const { apiKey } = require('../config');
const { validateLicenseKey } = require('../services/licenseService');

/**
 * Guards the endpoints that spend money (AI calls).
 *
 * A client identifies itself with `X-API-Key: <value>`, where the value is either:
 *   - the server's shared secret (`API_KEY`), used for server-to-server calls, or
 *   - a customer license key from the license_keys table.
 *
 * On success `req.apiClient` is set to `{ id, userId? }`, which the rate limiter
 * uses as the per-user bucket key.
 */
async function requireApiKey(req, res, next) {
  const provided = (req.get('X-API-Key') || '').trim();

  if (!provided) {
    return res.status(401).json({
      success: false,
      error: 'Missing API key. Send X-API-Key with a license key.',
    });
  }

  if (apiKey && provided === apiKey) {
    req.apiClient = { id: 'master' };
    return next();
  }

  const result = await validateLicenseKey(provided);

  if (result.status >= 500) {
    return res.status(503).json({
      success: false,
      error: 'Could not verify the API key right now. Please try again shortly.',
    });
  }

  if (!result.body.valid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired license key.',
    });
  }

  req.apiClient = {
    id: `user:${result.body.userId}`,
    userId: result.body.userId,
  };

  return next();
}

module.exports = { requireApiKey };
