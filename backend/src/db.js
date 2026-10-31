const { Pool } = require('pg');
const { dbUrl } = require('./config');

// Validate DATABASE_URL in production
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required in production');
}

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
