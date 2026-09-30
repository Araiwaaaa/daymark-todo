'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/server');

function createTestApp() {
  const app = createApp({ dbPath: ':memory:', sessionSecret: 'test-session-secret' });
  return { app, close: () => app.locals.close() };
}

async function register(browser, username) {
  const response = await browser.post('/api/auth/register')
    .send({ username, password: 'eight-or-more' });
  assert.equal(response.status, 201);
}

test('users can add, complete, list, and delete their tasks', async (t) => {
  const { app, close } = createTestApp();
  t.after(close);
  const browser = request.agent(app);
  await register(browser, 'mira');

  const added = await browser.post('/api/tasks').send({ title: 'Plan the week' });
  assert.equal(added.status, 201);
  assert.equal(added.body.task.title, 'Plan the week');
  assert.equal(added.body.task.completed, false);

  const list = await browser.get('/api/tasks');
  assert.equal(list.body.tasks.length, 1);
  assert.equal(list.body.tasks[0].title, 'Plan the week');

  const completed = await browser.patch(`/api/tasks/${added.body.task.id}`)
    .send({ completed: true });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.task.completed, true);

  const removed = await browser.delete(`/api/tasks/${added.body.task.id}`);
  assert.equal(removed.status, 200);
  assert.deepEqual((await browser.get('/api/tasks')).body.tasks, []);
});

test('users cannot view or change another user’s tasks', async (t) => {
  const { app, close } = createTestApp();
  t.after(close);
  await register(request(app), 'mira');
  await register(request(app), 'theo');

  const mira = request.agent(app);
  const theo = request.agent(app);
  assert.equal((await mira.post('/api/auth/login')
    .send({ username: 'mira', password: 'eight-or-more' })).status, 200);
  assert.equal((await theo.post('/api/auth/login')
    .send({ username: 'theo', password: 'eight-or-more' })).status, 200);

  const task = await mira.post('/api/tasks').send({ title: 'Private task' });
  const taskId = task.body.task.id;

  assert.deepEqual((await theo.get('/api/tasks')).body.tasks, []);
  assert.equal((await theo.patch(`/api/tasks/${taskId}`).send({ completed: true })).status, 404);
  assert.equal((await theo.delete(`/api/tasks/${taskId}`)).status, 404);
  assert.equal((await mira.get('/api/tasks')).body.tasks.length, 1);
});

test('task routes require an authenticated session', async (t) => {
  const { app, close } = createTestApp();
  t.after(close);

  const response = await request(app).get('/api/tasks');
  assert.equal(response.status, 401);
});

test('empty and whitespace-only task titles are rejected', async (t) => {
  const { app, close } = createTestApp();
  t.after(close);
  const browser = request.agent(app);
  await register(browser, 'mira');

  const empty = await browser.post('/api/tasks').send({ title: '' });
  assert.equal(empty.status, 400);

  const whitespace = await browser.post('/api/tasks').send({ title: '   ' });
  assert.equal(whitespace.status, 400);

  assert.deepEqual((await browser.get('/api/tasks')).body.tasks, []);
});