const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createDatabase } = require('../src/db');

let directory;
let database;
let app;
let alice;
let bob;

before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daymark-test-'));
  const databasePath = path.join(directory, 'test.sqlite');
  database = createDatabase(databasePath);
  app = createApp({ database, databasePath, sessionSecret: 'test-secret-that-is-long-enough' }).app;
  alice = request.agent(app);
  bob = request.agent(app);

  const aliceRegistration = await alice.post('/api/register').send({ username: 'alice', password: 'correct-horse-1' });
  assert.equal(aliceRegistration.status, 201);
  const bobRegistration = await bob.post('/api/register').send({ username: 'bob', password: 'correct-horse-2' });
  assert.equal(bobRegistration.status, 201);
});

after(() => {
  database?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('registration validates credentials and prevents duplicate usernames', async () => {
  const duplicate = await request(app).post('/api/register').send({ username: 'ALICE', password: 'correct-horse-3' });
  assert.equal(duplicate.status, 409);

  const invalid = await request(app).post('/api/register').send({ username: 'x', password: 'short' });
  assert.equal(invalid.status, 400);
});

test('login accepts correct credentials and rejects incorrect credentials', async () => {
  const signedIn = request.agent(app);
  const success = await signedIn.post('/api/login').send({ username: 'ALICE', password: 'correct-horse-1' });
  assert.equal(success.status, 200);
  assert.equal(success.body.user.username, 'alice');
  assert.equal((await signedIn.get('/api/tasks')).status, 200);

  const failure = await request(app).post('/api/login').send({ username: 'alice', password: 'wrong-password' });
  assert.equal(failure.status, 401);
});

test('task list requires a session and supports add, complete, and delete', async () => {
  const anonymous = await request(app).get('/api/tasks');
  assert.equal(anonymous.status, 401);

  const created = await alice.post('/api/tasks').send({ title: 'Write tests' });
  assert.equal(created.status, 201);
  assert.equal(created.body.task.title, 'Write tests');
  assert.equal(created.body.task.completed, false);

  const completed = await alice.patch(`/api/tasks/${created.body.task.id}`).send({ completed: true });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.task.completed, true);

  const listed = await alice.get('/api/tasks');
  assert.equal(listed.body.tasks.length, 1);
  assert.equal(listed.body.tasks[0].title, 'Write tests');

  const deleted = await alice.delete(`/api/tasks/${created.body.task.id}`);
  assert.equal(deleted.status, 204);
  assert.deepEqual((await alice.get('/api/tasks')).body.tasks, []);
});

test('users cannot read, complete, or delete another user’s tasks', async () => {
  const created = await alice.post('/api/tasks').send({ title: 'Private task' });
  const taskId = created.body.task.id;

  assert.deepEqual((await bob.get('/api/tasks')).body.tasks, []);
  assert.equal((await bob.patch(`/api/tasks/${taskId}`).send({ completed: true })).status, 404);
  assert.equal((await bob.delete(`/api/tasks/${taskId}`)).status, 404);
  assert.equal((await alice.get('/api/tasks')).body.tasks[0].completed, false);
});

test('blank task titles are rejected without changing the task list', async () => {
  const response = await bob.post('/api/tasks').send({ title: '   \t  ' });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Task must be between 1 and 200 characters.');
  assert.deepEqual((await bob.get('/api/tasks')).body.tasks, []);
});

test('libSQL backend supports registration, sessions, and task persistence', async () => {
  const previousUrl = process.env.TURSO_DATABASE_URL;
  const previousToken = process.env.TURSO_AUTH_TOKEN;
  const databasePath = path.join(directory, 'libsql.sqlite');
  let libsqlDatabase;

  try {
    process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
    process.env.TURSO_AUTH_TOKEN = 'local-test-token';
    libsqlDatabase = createDatabase();
    const libsqlApp = createApp({ database: libsqlDatabase, sessionSecret: 'libsql-test-secret' }).app;
    const account = request.agent(libsqlApp);

    const registered = await account.post('/api/register').send({ username: 'libuser', password: 'correct-horse-4' });
    assert.equal(registered.status, 201);
    assert.equal((await account.post('/api/tasks').send({ title: 'Persist remotely' })).status, 201);

    const signedIn = request.agent(libsqlApp);
    assert.equal((await signedIn.post('/api/login').send({ username: 'libuser', password: 'correct-horse-4' })).status, 200);
    const tasks = await signedIn.get('/api/tasks');
    assert.equal(tasks.status, 200);
    assert.equal(tasks.body.tasks[0].title, 'Persist remotely');
  } finally {
    await libsqlDatabase?.close();
    if (previousUrl === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = previousUrl;
    if (previousToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = previousToken;
  }
});

test('Vercel refuses to start without persistent Turso configuration', () => {
  const previousVercel = process.env.VERCEL;
  const previousUrl = process.env.TURSO_DATABASE_URL;
  const previousToken = process.env.TURSO_AUTH_TOKEN;
  process.env.VERCEL = '1';
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;

  try {
    assert.throws(() => createDatabase(), /Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN/);
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    if (previousUrl === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = previousUrl;
    if (previousToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = previousToken;
  }
});