const state = { user: null, tasks: [], filter: 'all', registering: false, toastTimer: null };

const elements = {
  authPanel: document.querySelector('#auth-panel'),
  authForm: document.querySelector('#auth-form'),
  authTitle: document.querySelector('#auth-title'),
  authMessage: document.querySelector('#auth-message'),
  authSwitch: document.querySelector('#auth-switch'),
  authSwitchCopy: document.querySelector('#auth-switch-copy'),
  authSubmitLabel: document.querySelector('#auth-submit-label'),
  taskView: document.querySelector('#task-view'),
  taskForm: document.querySelector('#task-form'),
  taskTitle: document.querySelector('#task-title'),
  taskList: document.querySelector('#task-list'),
  profile: document.querySelector('#profile'),
  profileName: document.querySelector('#profile-name'),
  avatar: document.querySelector('#avatar'),
  navCount: document.querySelector('#nav-count'),
  toast: document.querySelector('#toast'),
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (response.status === 204) return null;
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Something went wrong.');
  return payload;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 2600);
}

function renderAuth() {
  elements.authPanel.hidden = Boolean(state.user);
  elements.taskView.hidden = !state.user;
  elements.profile.hidden = !state.user;
  if (state.user) {
    elements.profileName.textContent = state.user.username;
    elements.avatar.textContent = state.user.username.slice(0, 1);
  }
  updateCounts();
}

function updateCounts() {
  const open = state.tasks.filter((task) => !task.completed).length;
  const done = state.tasks.length - open;
  document.querySelector('#all-count').textContent = state.tasks.length;
  document.querySelector('#open-count').textContent = open;
  document.querySelector('#done-count').textContent = done;
  document.querySelector('#footer-count').textContent = `${open} ${open === 1 ? 'thing' : 'things'} left to do`;
  elements.navCount.textContent = open;
}

function renderTasks() {
  const visibleTasks = state.tasks.filter((task) => {
    if (state.filter === 'open') return !task.completed;
    if (state.filter === 'done') return task.completed;
    return true;
  });
  elements.taskList.replaceChildren();

  if (visibleTasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const mark = document.createElement('div');
    mark.className = 'empty-mark';
    mark.textContent = state.filter === 'done' ? '✓' : '✳';
    const title = document.createElement('p');
    title.textContent = state.filter === 'done' ? 'Nothing checked off just yet.' : 'A little breathing room.';
    const hint = document.createElement('span');
    hint.textContent = state.filter === 'done' ? 'Finish a task and it will find its way here.' : 'Add a task above to get your list started.';
    empty.append(mark, title, hint);
    elements.taskList.append(empty);
    updateCounts();
    return;
  }

  for (const task of visibleTasks) {
    const row = document.createElement('div');
    row.className = `task-row${task.completed ? ' completed' : ''}`;
    const toggle = document.createElement('button');
    toggle.className = 'check-button';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', task.completed ? `Mark ${task.title} as in progress` : `Complete ${task.title}`);
    toggle.textContent = task.completed ? '✓' : '';
    toggle.addEventListener('click', () => toggleTask(task));
    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;
    const meta = document.createElement('span');
    meta.className = 'task-meta';
    const tag = document.createElement('span');
    tag.className = 'task-tag';
    tag.textContent = task.completed ? 'DONE' : 'PERSONAL';
    const remove = document.createElement('button');
    remove.className = 'delete-button';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Delete ${task.title}`);
    remove.title = 'Delete task';
    remove.textContent = '×';
    remove.addEventListener('click', () => deleteTask(task));
    meta.append(tag, remove);
    row.append(toggle, title, meta);
    elements.taskList.append(row);
  }
  updateCounts();
}

async function loadTasks() {
  const result = await request('/api/tasks');
  state.tasks = result.tasks;
  renderTasks();
}

async function toggleTask(task) {
  try {
    const result = await request(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: !task.completed }),
    });
    state.tasks = state.tasks.map((item) => item.id === task.id ? result.task : item);
    renderTasks();
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteTask(task) {
  try {
    await request(`/api/tasks/${task.id}`, { method: 'DELETE' });
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    renderTasks();
    showToast('Task removed.');
  } catch (error) {
    showToast(error.message);
  }
}

function setRegistering(registering) {
  state.registering = registering;
  elements.authTitle.textContent = registering ? 'Make a little space.' : 'Welcome back.';
  elements.authSubmitLabel.textContent = registering ? 'Create account' : 'Sign in';
  elements.authSwitchCopy.textContent = registering ? 'Already have an account?' : 'New around here?';
  elements.authSwitch.textContent = registering ? 'Sign in' : 'Create an account';
  document.querySelector('#password').autocomplete = registering ? 'new-password' : 'current-password';
  elements.authMessage.textContent = '';
}

elements.authSwitch.addEventListener('click', () => setRegistering(!state.registering));

elements.authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.authMessage.textContent = '';
  const form = new FormData(elements.authForm);
  const payload = { username: form.get('username'), password: form.get('password') };
  try {
    const result = await request(state.registering ? '/api/register' : '/api/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.user = result.user;
    elements.authForm.reset();
    renderAuth();
    await loadTasks();
  } catch (error) {
    elements.authMessage.textContent = error.message;
  }
});

elements.taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = elements.taskTitle.value.trim();
  if (!title) {
    showToast('Add a task title before submitting.');
    elements.taskTitle.focus();
    return;
  }
  try {
    const result = await request('/api/tasks', { method: 'POST', body: JSON.stringify({ title }) });
    state.tasks.unshift(result.task);
    elements.taskForm.reset();
    renderTasks();
    elements.taskTitle.focus();
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelectorAll('.filter-button').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll('.filter-button').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-selected', String(selected));
    });
    renderTasks();
  });
});

document.querySelector('#logout').addEventListener('click', async () => {
  try {
    await request('/api/logout', { method: 'POST' });
    state.user = null;
    state.tasks = [];
    state.filter = 'all';
    setRegistering(false);
    renderAuth();
    renderTasks();
  } catch (error) {
    showToast(error.message);
  }
});

function setDates() {
  const now = new Date();
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(now);
  document.querySelector('#day-number').textContent = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(now);
  document.querySelector('#month-label').textContent = new Intl.DateTimeFormat('en', { month: 'short' }).format(now).toUpperCase();
  document.querySelector('#list-date').textContent = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' }).format(now).toUpperCase();
}

async function initialize() {
  setDates();
  try {
    const result = await request('/api/session');
    state.user = result.user;
    renderAuth();
    if (state.user) await loadTasks();
    else renderTasks();
  } catch (error) {
    showToast(error.message);
  }
}

initialize();