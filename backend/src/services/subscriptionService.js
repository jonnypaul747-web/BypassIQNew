const crypto = require('crypto');
const { get, run } = require('../db');
const { generateLicenseKey, hashLicenseKey } = require('./licenseService');

/**
 * Finds the user for an email, creating them on first purchase.
 * Returns `{ userId }` on success, or `{ error }` when the lookup itself failed.
 */
async function findOrCreateUser(email) {
  let existing;
  try {
    existing = await get('SELECT id FROM users WHERE email = ?', [email]);
  } catch (err) {
    console.error('[Backend] Error finding user:', err);
    return { error: 'Database error' };
  }

  if (existing) {
    return { userId: existing.id };
  }

  const userId = crypto.randomUUID();
  try {
    await run('INSERT INTO users (id, email) VALUES (?, ?)', [userId, email]);
  } catch (err) {
    // Not fatal on its own: the subscription insert below will fail on the foreign key.
    console.error('[Backend] Error creating user:', err);
  }

  return { userId };
}

/**
 * Creates a subscription plus its license key and returns the plaintext key once.
 * `durationDays` defaults to 30 days. Returns an HTTP-shaped result.
 */
async function createSubscription(email, durationDays = 30) {
  const { userId, error } = await findOrCreateUser(email);
  if (error) {
    return { status: 500, body: { error } };
  }

  const subscriptionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    await run(
      'INSERT INTO subscriptions (id, user_id, status, current_period_end) VALUES (?, ?, ?, ?)',
      [subscriptionId, userId, 'active', expiresAt]
    );
  } catch (err) {
    console.error('[Backend] Error creating subscription:', err);
    return { status: 500, body: { error: 'Failed to create subscription' } };
  }

  const licenseKey = generateLicenseKey();
  const licenseKeyId = crypto.randomUUID();

  try {
    await run(
      'INSERT INTO license_keys (id, key_hash, user_id, subscription_id, expires_at) VALUES (?, ?, ?, ?, ?)',
      [licenseKeyId, hashLicenseKey(licenseKey), userId, subscriptionId, expiresAt]
    );
  } catch (err) {
    console.error('[Backend] Error creating license key:', err);
    return { status: 500, body: { error: 'Failed to create license key' } };
  }

  console.log(`[Backend] License key generated for ${email}: ${licenseKey}`);

  return {
    status: 200,
    body: { success: true, licenseKey, expiresAt, userId },
  };
}

/**
 * Returns the newest subscription for a user. Returns an HTTP-shaped result.
 */
async function getLatestSubscription(userId) {
  let row;
  try {
    row = await get(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
  } catch (err) {
    console.error('[Backend] Database error:', err);
    return { status: 500, body: { error: 'Database error' } };
  }

  if (!row) {
    return { status: 404, body: { error: 'Subscription not found' } };
  }

  return { status: 200, body: row };
}

module.exports = { createSubscription, getLatestSubscription };
