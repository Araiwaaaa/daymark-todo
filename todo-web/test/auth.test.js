'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/server');

function createTestApp() {
  const app = createApp({ dbPath: ':memory:', sessionSecret: 'test-session-secret' });
  return { app, close: () => app.locals.close() };
}

test('registration creates a session and login verifies the password', async (t) => {
  const { app, close } = createTestApp();
  t.after(close);
  const browser = request.agent(app);

  const registration = await browser.post('/api/auth/register')
    .send({ username: 'mira', password: 'eight-or-more' });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.user.username, 'mira');

  const identity = await browser.get('/api/auth/me');
  assert.equal(identity.status, 200);
  assert.equal(identity.body.user.username, 'mira');

  const duplicate = await request(app).post('/api/auth/register')
    .send({ username: 'MIRA', password: 'eight-or-more' });
  assert.equal(duplicate.status, 409);

  const stranger = request.agent(app);
  const invalidLogin = await stranger.post('/api/auth/login')
    .send({ username: 'mira', password: 'incorrect-password' });
  assert.equal(invalidLogin.status, 401);

  const login = await stranger.post('/api/auth/login')
    .send({ username: 'MIRA', password: 'eight-or-more' });
  assert.equal(login.status, 200);
  assert.equal((await stranger.get('/api/auth/me')).body.user.username, 'mira');
});

test('registration validates username and password', async (t) => {
  const { app, close } = createTestApp();
  t.after(close);

  const shortPassword = await request(app).post('/api/auth/register')
    .send({ username: 'mira', password: 'short' });
  assert.equal(shortPassword.status, 400);

  const invalidUsername = await request(app).post('/api/auth/register')
    .send({ username: 'no spaces', password: 'eight-or-more' });
  assert.equal(invalidUsername.status, 400);
});