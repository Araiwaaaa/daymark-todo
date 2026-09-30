'use strict';

const session = require('express-session');

class SQLiteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_by_expiry ON sessions(expires_at);
    `);
    this.readSession = db.prepare('SELECT data, expires_at FROM sessions WHERE id = ?');
    this.writeSession = db.prepare(`
      INSERT INTO sessions (id, data, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
    `);
    this.deleteSession = db.prepare('DELETE FROM sessions WHERE id = ?');
  }

  get(id, callback) {
    try {
      const row = this.readSession.get(id);
      if (!row) return callback(null, null);
      if (row.expires_at <= Date.now()) {
        this.deleteSession.run(id);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.data));
    } catch (error) {
      callback(error);
    }
  }

  set(id, sessionData, callback = () => {}) {
    try {
      const expiresAt = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires).getTime()
        : Date.now() + 24 * 60 * 60 * 1000;
      this.writeSession.run(id, JSON.stringify(sessionData), expiresAt);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(id, sessionData, callback = () => {}) {
    this.set(id, sessionData, callback);
  }

  destroy(id, callback = () => {}) {
    try {
      this.deleteSession.run(id);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = { SQLiteSessionStore };