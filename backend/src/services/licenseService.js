const crypto = require('crypto');
const { get } = require('../db');

/**
 * Creates a new plaintext license key. The plaintext is shown to the buyer once;
 * only the hash below is ever written to the database.
 */
function generateLicenseKey() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

/**
 * License keys are stored hashed, so a leaked database does not leak usable keys.
 */
function hashLicenseKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Checks one license key against its subscription.
 * Returns an HTTP-shaped result the route can send as-is.
 */
async function validateLicenseKey(licenseKey) {
  let row;
  try {
    row = await get(
      'SELECT lk.*, s.status as subscription_status FROM license_keys lk ' +
        'JOIN subscriptions s ON lk.subscription_id = s.id ' +
        'WHERE lk.key_hash = $1 AND lk.is_active = true',
      [hashLicenseKey(licenseKey)]
    );
  } catch (err) {
    console.error('[Backend] Database error:', err);
    return { status: 500, body: { valid: false, error: 'Database error' } };
  }

  if (!row) {
    return { status: 200, body: { valid: false, error: 'License key not found' } };
  }

  if (row.subscription_status !== 'active') {
    return { status: 200, body: { valid: false, error: 'Subscription not active' } };
  }

  if (new Date(row.expires_at) < new Date()) {
    return { status: 200, body: { valid: false, error: 'License expired' } };
  }

  return {
    status: 200,
    body: { valid: true, expiresAt: row.expires_at, userId: row.user_id },
  };
}

module.exports = { generateLicenseKey, hashLicenseKey, validateLicenseKey };
