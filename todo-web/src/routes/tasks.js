'use strict';

const { Router } = require('express');

function createTasksRouter(db) {
  const router = Router();

  router.use((req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Sign in to continue.' });
    next();
  });

  router.get('/', (req, res) => {
    const tasks = db.prepare(`
      SELECT id, title, completed, created_at AS createdAt
      FROM tasks WHERE user_id = ?
      ORDER BY completed ASC, created_at ASC, id ASC
    `).all(req.session.userId);
    res.json({ tasks: tasks.map(serializeTask) });
  });

  router.post('/', (req, res) => {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (title.length < 1 || title.length > 200) {
      return res.status(400).json({ error: 'Task title must be between 1 and 200 characters.' });
    }

    const result = db.prepare('INSERT INTO tasks (user_id, title) VALUES (?, ?)')
      .run(req.session.userId, title);
    const task = db.prepare(`
      SELECT id, title, completed, created_at AS createdAt FROM tasks WHERE id = ? AND user_id = ?
    `).get(result.lastInsertRowid, req.session.userId);
    res.status(201).json({ task: serializeTask(task) });
  });

  router.patch('/:id', (req, res) => {
    if (typeof req.body.completed !== 'boolean') {
      return res.status(400).json({ error: 'Completed must be true or false.' });
    }

    const result = db.prepare('UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?')
      .run(Number(req.body.completed), req.params.id, req.session.userId);
    if (!result.changes) return res.status(404).json({ error: 'Task not found.' });

    const task = db.prepare(`
      SELECT id, title, completed, created_at AS createdAt FROM tasks WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.session.userId);
    res.json({ task: serializeTask(task) });
  });

  router.delete('/:id', (req, res) => {
    const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.session.userId);
    if (!result.changes) return res.status(404).json({ error: 'Task not found.' });
    res.json({ ok: true });
  });

  return router;
}

function serializeTask(task) {
  return { ...task, completed: Boolean(task.completed) };
}

module.exports = { createTasksRouter };