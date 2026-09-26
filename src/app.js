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
  }

  get(sessionId, callback) {
    this.database.get('SELECT sess, expires_at FROM sessions WHERE sid = ?', [sessionId]).then(async (row) => {
      if (!row) return callback(null, null);
      if (row.expires_at <= Date.now()) {
        await this.database.run('DELETE FROM sessions WHERE sid = ?', [sessionId]);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.sess));
    }).catch(callback);
  }

  set(sessionId, value, callback = () => {}) {
    const expiresAt = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 24 * 60 * 60 * 1000;
    this.database.run(
      'INSERT INTO sessions (sid, sess, expires_at) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at',
      [sessionId, JSON.stringify(value), expiresAt],
    ).then(() => callback(null), callback);
  }

  touch(sessionId, value, callback = () => {}) {
    const expiresAt = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 24 * 60 * 60 * 1000;
    this.database.run('UPDATE sessions SET expires_at = ? WHERE sid = ?', [expiresAt, sessionId]).then(() => callback(null), callback);
  }

  destroy(sessionId, callback = () => {}) {
    this.database.run('DELETE FROM sessions WHERE sid = ?', [sessionId]).then(() => callback(null), callback);
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

  app.get('/api/session', async (request, response) => {
    if (!request.session.userId) return response.json({ user: null });
    const user = await db.get('SELECT id, username FROM users WHERE id = ?', [request.session.userId]);
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
      const result = await db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
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

  app.post('/api/login', async (request, response, next) => {
    const username = typeof request.body.username === 'string' ? request.body.username.trim() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const user = await db.get('SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE', [username]);

    const matches = await bcrypt.compare(password, user?.password_hash || '$2a$12$invalidhashinvalidhashinvalidhashinvalidhashinvalidhashinvalid');
    if (!user || !matches) return response.status(401).json({ error: 'Username or password is incorrect.' });
    request.session.regenerate((error) => {
      if (error) return next(error);
      request.session.userId = user.id;
      request.session.save((saveError) => {
        if (saveError) return next(saveError);
        response.json({ user: { id: user.id, username: user.username } });
      });
    });
  });

  app.post('/api/logout', (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error);
      response.clearCookie('daymark.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      response.status(204).end();
    });
  });

  app.get('/api/tasks', requireUser, async (request, response) => {
    const tasks = await db.all('SELECT id, title, completed, created_at AS createdAt FROM tasks WHERE user_id = ? ORDER BY id DESC', [request.session.userId]);
    response.json({ tasks: tasks.map((task) => ({ ...task, completed: Boolean(task.completed) })) });
  });

  app.post('/api/tasks', requireUser, async (request, response) => {
    const title = typeof request.body.title === 'string' ? request.body.title.trim() : '';
    if (!title || title.length > 200) {
      return response.status(400).json({ error: 'Task must be between 1 and 200 characters.' });
    }
    const result = await db.run('INSERT INTO tasks (user_id, title) VALUES (?, ?)', [request.session.userId, title]);
    const task = await db.get('SELECT id, title, completed, created_at AS createdAt FROM tasks WHERE id = ?', [result.lastInsertRowid]);
    response.status(201).json({ task: { ...task, completed: Boolean(task.completed) } });
  });

  app.patch('/api/tasks/:id', requireUser, async (request, response) => {
    if (typeof request.body.completed !== 'boolean') {
      return response.status(400).json({ error: 'Completed must be true or false.' });
    }
    const result = await db.run('UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?', [
      Number(request.body.completed), Number(request.params.id), request.session.userId,
    ]);
    if (result.changes === 0) return response.status(404).json({ error: 'Task not found.' });
    const task = await db.get('SELECT id, title, completed, created_at AS createdAt FROM tasks WHERE id = ?', [Number(request.params.id)]);
    response.json({ task: { ...task, completed: Boolean(task.completed) } });
  });

  app.delete('/api/tasks/:id', requireUser, async (request, response) => {
    const result = await db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [Number(request.params.id), request.session.userId]);
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