const fs = require('node:fs');
const path = require('node:path');

const schema = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  'CREATE INDEX IF NOT EXISTS tasks_by_user ON tasks(user_id, id DESC)',
  `CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS sessions_by_expiry ON sessions(expires_at)',
];

function createLocalDatabase(filename) {
  const Database = require('better-sqlite3');
  const resolvedPath = path.resolve(filename);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const database = new Database(resolvedPath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.exec(schema.join(';'));

  return {
    ready: Promise.resolve(),
    async get(sql, args = []) {
      return database.prepare(sql).get(...args);
    },
    async all(sql, args = []) {
      return database.prepare(sql).all(...args);
    },
    async run(sql, args = []) {
      const result = database.prepare(sql).run(...args);
      return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
    },
    close() {
      database.close();
    },
  };
}

function createTursoDatabase(url, authToken) {
  if (!authToken) throw new Error('TURSO_AUTH_TOKEN is required when using Turso.');
  const { createClient } = require('@libsql/client');
  const client = createClient({ url, authToken });
  const ready = schema.reduce((previous, statement) => previous.then(() => client.execute(statement)), Promise.resolve());

  return {
    ready,
    async get(sql, args = []) {
      await ready;
      const result = await client.execute({ sql, args });
      return result.rows[0] ? { ...result.rows[0] } : undefined;
    },
    async all(sql, args = []) {
      await ready;
      const result = await client.execute({ sql, args });
      return result.rows.map((row) => ({ ...row }));
    },
    async run(sql, args = []) {
      await ready;
      const result = await client.execute({ sql, args });
      return { changes: Number(result.rowsAffected), lastInsertRowid: Number(result.lastInsertRowid) };
    },
    close() {
      return client.close();
    },
  };
}

function createDatabase(filename = process.env.DB_PATH || './data/daymark.sqlite') {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return createTursoDatabase(url, process.env.TURSO_AUTH_TOKEN);
  if (process.env.VERCEL) {
    throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel project settings.');
  }
  return createLocalDatabase(filename);
}

module.exports = { createDatabase };