'use strict';

const { Router } = require('express');
const { hashPassword, verifyPassword } = require('../auth');

function createAuthRouter(db) {
  const router = Router();

  router.post('/register', async (req, res, next) => {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = req.body.password;

    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-32 letters, numbers, underscores, or hyphens.' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    }

    try {
      const passwordHash = await hashPassword(password);
      const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
        .run(username.toLowerCase(), passwordHash);
      establishSession(req, res, next, result.lastInsertRowid, username.toLowerCase(), 201);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'That username is already taken.' });
      }
      next(error);
    }
  });

  router.post('/login', async (req, res, next) => {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = req.body.password;
    if (!username || typeof password !== 'string') {
      return res.status(400).json({ error: 'Enter a username and password.' });
    }

    try {
      const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE')
        .get(username);
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return res.status(401).json({ error: 'Username or password is incorrect.' });
      }
      establishSession(req, res, next, user.id, user.username, 200);
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Sign in to continue.' });
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Sign in to continue.' });
    res.json({ user: { id: user.id, username: user.username } });
  });

  router.post('/logout', (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie('todo.sid', { httpOnly: true, sameSite: 'lax' });
      res.json({ ok: true });
    });
  });

  return router;
}

function establishSession(req, res, next, userId, username, status) {
  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.userId = userId;
    req.session.save((saveError) => {
      if (saveError) return next(saveError);
      res.status(status).json({ user: { id: userId, username } });
    });
  });
}

module.exports = { createAuthRouter };