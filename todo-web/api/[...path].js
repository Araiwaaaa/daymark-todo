'use strict';

process.env.TODO_DB_PATH ||= '/tmp/todo.sqlite';

const { createApp } = require('../src/server');

module.exports = createApp();