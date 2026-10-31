const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const { dbFile } = require('./config');

const db = new sqlite3.Database(dbFile);

// sqlite3 is callback based. These wrappers let the services use async/await
// while keeping the very same driver and SQL.
const get = promisify(db.get).bind(db);
const run = promisify(db.run).bind(db);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    status TEXT,
    current_period_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS license_keys (
    id TEXT PRIMARY KEY,
    key_hash TEXT UNIQUE,
    user_id TEXT,
    subscription_id TEXT,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME
  )`,
];

/**
 * Creates the three tables if they do not exist yet. Safe to call on every boot.
 */
async function initDatabase() {
  for (const statement of SCHEMA) {
    await run(statement);
  }
  console.log('[Backend] Database initialized');
}

module.exports = { db, dbFile, get, run, initDatabase };
