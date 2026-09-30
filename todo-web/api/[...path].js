'use strict';

process.env.TODO_DB_PATH ||= '/tmp/todo.sqlite';

module.exports = require('../src/server');