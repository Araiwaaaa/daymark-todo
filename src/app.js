const path = require('node:path');
const bcrypt = require('bcryptjs');
const express = require('express');
const session = require('express-session');
const { createDatabase } = require('./db');

const usernamePattern = /^[a-zA-Z0-9_]{3,24}$/;

class SQLiteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.database = database;
    this.getStatement = database.prepare('SELECT sess, expires_at FROM sessions WHERE sid = ?');
    this.setStatement = database.prepare('INSERT INTO sessions (sid, sess, expires_at) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at');
    this.touchStatement = database.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?');
    this.destroyStatement = database.prepare('DELETE FROM sessions WHERE sid = ?');
  }

  get(sessionId, callback) {
    try {
      const row = this.getStatement.get(sessionId);
      if (!row) return callback(null, null);
      if (row.expires_at <= Date.now()) {
        this.destroyStatement.run(sessionId);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sessionId, value, callback = () => {}) {
    try {
      const expiresAt = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 24 * 60 * 60 * 1000;
      this.setStatement.run(sessionId, JSON.stringify(value), expiresAt);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sessionId, value, callback = () => {}) {
    try {
      const expiresAt = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 24 * 60 * 60 * 1000;
      this.touchStatement.run(expiresAt, sessionId);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sessionId, callback = () => {}) {
    try {
      this.destroyStatement.run(sessionId);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

function createApp({ database, databasePath, sessionSecret = process.env.SESSION_SECRET || 'development-only-change-this-secret' } = {}) {
  const db = database || createDatabase(databasePath);
  const app = express();
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET && sessionSecret === 'development-only-change-this-secret') {
    throw new Error('SESSION_SECRET must be set in production.');
  }

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use(session({
    name: 'daymark.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new SQLiteSessionStore(db),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }));

  function requireUser(request, response, next) {
    if (!request.session.userId) {
      return response.status(401).json({ error: 'Please sign in to continue.' });
    }
    next();
  }

  app.get('/api/session', (request, response) => {
    if (!request.session.userId) return response.json({ user: null });
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(request.session.userId);
    if (!user) {
      return request.session.destroy(() => response.json({ user: null }));
    }
    response.json({ user });
  });

  app.post('/api/register', async (request, response, next) => {
    const username = typeof request.body.username === 'string' ? request.body.username.trim() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    if (!usernamePattern.test(username)) {
      return response.status(400).json({ error: 'Username must be 3–24 characters: letters, numbers, or underscores.' });
    }
    if (password.length < 8 || password.length > 72) {
      return response.status(400).json({ error: 'Password must be between 8 and 72 characters.' });
    }

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
      request.session.regenerate((error) => {
        if (error) return next(error);
        request.session.userId = Number(result.lastInsertRowid);
        request.session.save((saveError) => {
          if (saveError) return next(saveError);
          response.status(201).json({ user: { id: Number(result.lastInsertRowid), username } });
        });
      });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return response.status(409).json({ error: 'That username is already taken.' });
      }
      next(error);
    }
  });

  app.post('/api/login', (request, response, next) => {
    const username = typeof request.body.username === 'string' ? request.body.username.trim() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE').get(username);

    bcrypt.compare(password, user?.password_hash || '$2a$12$invalidhashinvalidhashinvalidhashinvalidhashinvalidhashinvalid').then((matches) => {
      if (!user || !matches) return response.status(401).json({ error: 'Username or password is incorrect.' });
      request.session.regenerate((error) => {
        if (error) return next(error);
        request.session.userId = user.id;
        request.session.save((saveError) => {
          if (saveError) return next(saveError);
          response.json({ user: { id: user.id, username: user.username } });
        });
      });
    }).catch(next);
  });

  app.post('/api/logout', (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error);
      response.clearCookie('daymark.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      response.status(204).end();
    });
  });

  app.get('/api/tasks', requireUser, (request, response) => {
    const tasks = db.prepare('SELECT id, title, completed, created_at AS createdAt FROM tasks WHERE user_id = ? ORDER BY id DESC').all(request.session.userId);
    response.json({ tasks: tasks.map((task) => ({ ...task, completed: Boolean(task.completed) })) });
  });

  app.post('/api/tasks', requireUser, (request, response) => {
    const title = typeof request.body.title === 'string' ? request.body.title.trim() : '';
    if (!title || title.length > 200) {
      return response.status(400).json({ error: 'Task must be between 1 and 200 characters.' });
    }
    const result = db.prepare('INSERT INTO tasks (user_id, title) VALUES (?, ?)').run(request.session.userId, title);
    const task = db.prepare('SELECT id, title, completed, created_at AS createdAt FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    response.status(201).json({ task: { ...task, completed: Boolean(task.completed) } });
  });

  app.patch('/api/tasks/:id', requireUser, (request, response) => {
    if (typeof request.body.completed !== 'boolean') {
      return response.status(400).json({ error: 'Completed must be true or false.' });
    }
    const result = db.prepare('UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?').run(
      Number(request.body.completed), Number(request.params.id), request.session.userId,
    );
    if (result.changes === 0) return response.status(404).json({ error: 'Task not found.' });
    const task = db.prepare('SELECT id, title, completed, created_at AS createdAt FROM tasks WHERE id = ?').get(Number(request.params.id));
    response.json({ task: { ...task, completed: Boolean(task.completed) } });
  });

  app.delete('/api/tasks/:id', requireUser, (request, response) => {
    const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(Number(request.params.id), request.session.userId);
    if (result.changes === 0) return response.status(404).json({ error: 'Task not found.' });
    response.status(204).end();
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use((error, request, response, next) => {
    console.error(error);
    if (response.headersSent) return next(error);
    response.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return { app, database: db };
}

module.exports = { createApp };