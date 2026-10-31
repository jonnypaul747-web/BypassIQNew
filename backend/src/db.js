const { Pool } = require('pg');
const { dbUrl } = require('./config');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * Query helper that returns the first row only.
 */
async function get(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0];
}

/**
 * Query helper for INSERT/UPDATE/DELETE operations.
 */
async function run(sql, params = []) {
  const result = await pool.query(sql, params);
  return result;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    status TEXT,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS license_keys (
    id TEXT PRIMARY KEY,
    key_hash TEXT UNIQUE,
    user_id TEXT,
    subscription_id TEXT,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS document_qa_cache (
    cache_key TEXT PRIMARY KEY,
    document_name TEXT,
    question_count INTEGER,
    model TEXT,
    questions TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    hits INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
  )`,
];

/**
 * Creates the three tables if they do not exist yet. Safe to call on every boot.
 */
async function initDatabase() {
  try {
    for (const statement of SCHEMA) {
      await pool.query(statement);
    }
    console.log('[Backend] Database initialized');
  } catch (err) {
    console.error('[Backend] Database initialization failed:', err);
    throw err;
  }
}

module.exports = { pool, get, run, initDatabase, dbUrl };
