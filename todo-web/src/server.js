'use strict';

const express = require('express');
const session = require('express-session');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const { createDatabase } = require('./db');
const { SQLiteSessionStore } = require('./session-store');
const { createAuthRouter } = require('./routes/auth');
const { createTasksRouter } = require('./routes/tasks');

function createApp(options = {}) {
  const db = options.db || createDatabase(options.dbPath);
  const app = express();
  const secret = options.sessionSecret || process.env.SESSION_SECRET;

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('Set SESSION_SECRET before starting in production.');
  }

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(session({
    name: 'todo.sid',
    secret: secret || randomBytes(32).toString('hex'),
    store: new SQLiteSessionStore(db),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  }));

  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/tasks', createTasksRouter(db));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  app.locals.close = () => db.close();
  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Todo app running at http://localhost:${port}`));
}

module.exports = { createApp };