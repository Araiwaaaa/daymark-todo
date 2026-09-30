'use strict';

const authScreen = document.querySelector('#auth-screen');
const workspace = document.querySelector('#workspace');
const authForm = document.querySelector('#auth-form');
const authError = document.querySelector('#auth-error');
const taskError = document.querySelector('#task-error');
const taskList = document.querySelector('#task-list');
const taskForm = document.querySelector('#task-form');
const taskTitleInput = document.querySelector('#task-title');
const authTabs = [...document.querySelectorAll('.auth-tab')];
const filterTabs = [...document.querySelectorAll('.filter-tab')];

let authMode = 'login';
let selectedFilter = 'all';
let tasks = [];

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const body = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
}

function showAuth() {
  workspace.hidden = true;
  authScreen.hidden = false;
}

async function showWorkspace(user) {
  authScreen.hidden = true;
  workspace.hidden = false;
  document.querySelector('#account-name').textContent = user.username;
  document.querySelector('#avatar').textContent = user.username.slice(0, 1);
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'long', day: 'numeric'
  }).format(new Date()).toUpperCase();
  await loadTasks();
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === 'register';
  document.querySelector('#auth-eyebrow').textContent = registering ? 'START FRESH' : 'WELCOME BACK';
  document.querySelector('#auth-title').textContent = registering ? 'A list of your own.' : 'Good to see you.';
  document.querySelector('#auth-subtitle').textContent = registering
    ? 'Create an account and make room for what matters.'
    : 'Sign in to pick up where you left off.';
  document.querySelector('#auth-submit').innerHTML = registering
    ? 'Create account <span aria-hidden="true">→</span>'
    : 'Sign in <span aria-hidden="true">→</span>';
  document.querySelector('#auth-hint').textContent = registering
    ? 'Choose a username and a password of at least 8 characters.'
    : 'Your task list is private to your account.';
  document.querySelector('#password').autocomplete = registering ? 'new-password' : 'current-password';
  authTabs.forEach((tab) => {
    const active = tab.id === (registering ? 'register-tab' : 'login-tab');
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  authError.hidden = true;
}

async function loadTasks() {
  const result = await api('/api/tasks');
  tasks = result.tasks;
  renderTasks();
}

function renderTasks() {
  const openCount = tasks.filter((task) => !task.completed).length;
  document.querySelector('#task-count').textContent = `${openCount} ${openCount === 1 ? 'task' : 'tasks'} left`;

  const visibleTasks = tasks.filter((task) => {
    if (selectedFilter === 'active') return !task.completed;
    if (selectedFilter === 'completed') return task.completed;
    return true;
  });
  taskList.replaceChildren();

  if (!visibleTasks.length) {
    const item = document.createElement('li');
    item.className = 'empty-state';
    const mark = document.createElement('span');
    mark.className = 'empty-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = selectedFilter === 'completed' ? '✓' : '＋';
    const message = document.createElement('p');
    message.textContent = tasks.length === 0
      ? 'A clear list. Add something when you’re ready.'
      : selectedFilter === 'active' ? 'Nothing left to do. Nice work.' : 'No completed tasks yet.';
    item.append(mark, message);
    taskList.append(item);
    return;
  }

  const fragment = document.createDocumentFragment();
  visibleTasks.forEach((task, index) => {
    const item = document.createElement('li');
    item.className = `task-row${task.completed ? ' is-complete' : ''}`;
    item.style.animationDelay = `${Math.min(index * 25, 150)}ms`;

    const checkbox = document.createElement('input');
    checkbox.className = 'task-check';
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `${task.completed ? 'Mark incomplete' : 'Complete'}: ${task.title}`);
    checkbox.addEventListener('change', async () => {
      try {
        await api(`/api/tasks/${task.id}`, {
          method: 'PATCH', body: JSON.stringify({ completed: checkbox.checked })
        });
        await loadTasks();
      } catch (error) {
        checkbox.checked = task.completed;
        showTaskError(error.message);
      }
    });

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;

    const remove = document.createElement('button');
    remove.className = 'delete-task';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete: ${task.title}`);
    remove.addEventListener('click', async () => {
      try {
        await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
        await loadTasks();
      } catch (error) {
        showTaskError(error.message);
      }
    });

    item.append(checkbox, title, remove);
    fragment.append(item);
  });
  taskList.append(fragment);
}

function showTaskError(message) {
  taskError.textContent = message;
  taskError.hidden = false;
}

authTabs.forEach((tab) => tab.addEventListener('click', () => {
  setAuthMode(tab.id === 'register-tab' ? 'register' : 'login');
}));

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authError.hidden = true;
  const submit = document.querySelector('#auth-submit');
  submit.disabled = true;
  try {
    const form = new FormData(authForm);
    const result = await api(`/api/auth/${authMode === 'register' ? 'register' : 'login'}`, {
      method: 'POST',
      body: JSON.stringify({ username: form.get('username'), password: form.get('password') })
    });
    authForm.reset();
    await showWorkspace(result.user);
  } catch (error) {
    authError.textContent = error.message;
    authError.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  taskError.hidden = true;
  const submit = taskForm.querySelector('button');
  submit.disabled = true;
  try {
    await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title: taskTitleInput.value }) });
    taskForm.reset();
    await loadTasks();
    taskTitleInput.focus();
  } catch (error) {
    showTaskError(error.message);
  } finally {
    submit.disabled = false;
  }
});

filterTabs.forEach((tab) => tab.addEventListener('click', () => {
  selectedFilter = tab.dataset.filter;
  filterTabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  renderTasks();
}));

document.querySelector('#logout-button').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  tasks = [];
  showAuth();
});

(async () => {
  try {
    const result = await api('/api/auth/me');
    await showWorkspace(result.user);
  } catch {
    showAuth();
  }
})();