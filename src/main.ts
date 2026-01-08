interface Task {
  id: string;
  title: string;
  category: string;
  status: string;
  stage: string;
  startDate: string;
  notes: string;
  assignee: string;
}

interface StatusOption {
  id: string;
  name: string;
  color: string;
}

interface Settings {
  darkMode: boolean;
  showCompleted: boolean;
}

interface AppState {
  tasks: Task[];
  categories: { id: string; name: string; color: string }[];
  statuses: StatusOption[];
  stages: string[];
  settings: Settings;
  githubToken?: string;
  gistId?: string;
}

const DEFAULT_CATEGORIES = [
  { id: 'personal', name: 'Личное', color: '#3b82f6' },
  { id: 'work', name: 'Работа', color: '#f59e0b' },
  { id: 'shopping', name: 'Покупки', color: '#22c55e' },
  { id: 'health', name: 'Здоровье', color: '#ef4444' },
];

const DEFAULT_STATUSES: StatusOption[] = [
  { id: 'in-progress', name: 'Выполняется', color: '#8b5cf6' },
  { id: 'blocked', name: 'Заблокировано', color: '#ef4444' },
  { id: 'done', name: 'Готово', color: '#22c55e' },
  { id: 'later', name: 'ПОТОМ', color: '#f59e0b' },
];

const DEFAULT_STAGES = ['В процессе', 'Забили хуй', 'ПОТОМ', 'Планирование', 'Тестирование'];

let state: AppState = {
  tasks: [],
  categories: DEFAULT_CATEGORIES,
  statuses: DEFAULT_STATUSES,
  stages: DEFAULT_STAGES,
  settings: { darkMode: false, showCompleted: true },
};

let selectedFilter: string | null = null;
let selectedCategory = 'personal';
let selectedStatus = 'in-progress';

function loadState(): void {
  const data = localStorage.getItem('tasklist-state');
  if (data) {
    const parsed = JSON.parse(data);
    state = { ...state, ...parsed };
    if (!state.statuses?.length) state.statuses = DEFAULT_STATUSES;
    if (!state.stages?.length) state.stages = DEFAULT_STAGES;
    state.tasks = state.tasks.map(t => ({
      ...t,
      status: t.status || 'in-progress',
      stage: t.stage || 'В процессе',
      startDate: t.startDate || '',
      notes: t.notes || '',
      assignee: t.assignee || '',
    }));
  }
  applyTheme();
}

function saveState(): void {
  localStorage.setItem('tasklist-state', JSON.stringify(state));
}

function applyTheme(): void {
  document.documentElement.setAttribute('data-theme', state.settings.darkMode ? 'dark' : 'light');
}

function render(): void {
  renderCategories();
  renderTasks();
}

function renderCategories(): void {
  const el = document.getElementById('categories')!;
  const counts: Record<string, number> = {};
  state.tasks.forEach(t => {
    if (t.status !== 'done') counts[t.category] = (counts[t.category] || 0) + 1;
  });
  const total = state.tasks.filter(t => t.status !== 'done').length;
  
  el.innerHTML = `
    <button class="category-btn ${!selectedFilter ? 'active' : ''}" data-filter="">Все <span class="count">${total}</span></button>
    ${state.categories.map(c => `
      <button class="category-btn ${selectedFilter === c.id ? 'active' : ''}" data-filter="${c.id}">
        ${c.name} <span class="count">${counts[c.id] || 0}</span>
      </button>
    `).join('')}
  `;
  
  el.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = (btn as HTMLElement).dataset.filter;
      selectedFilter = f === '' ? null : f!;
      render();
    });
  });
}

function getStatusInfo(statusId: string): StatusOption {
  return state.statuses.find(s => s.id === statusId) || state.statuses[0] || { id: statusId, name: statusId, color: '#888' };
}

function renderTasks(): void {
  const el = document.getElementById('taskList')!;
  let tasks = [...state.tasks];
  
  if (selectedFilter) tasks = tasks.filter(t => t.category === selectedFilter);
  if (!state.settings.showCompleted) tasks = tasks.filter(t => t.status !== 'done');
  
  // Sort by status order
  const statusOrder: Record<string, number> = {};
  state.statuses.forEach((s, i) => statusOrder[s.id] = i);
  tasks.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));
  
  if (!tasks.length) {
    el.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg><h3>Нет задач</h3><p>Нажмите + чтобы добавить</p></div>`;
    return;
  }
  
  el.innerHTML = `
    <div class="task-table">
      <div class="table-header">
        <div></div>
        <div>Задача</div>
        <div>Статус</div>
        <div>Этап</div>
        <div>Дата начала</div>
        <div>Примечания</div>
        <div>Ответственный</div>
        <div></div>
      </div>
      ${tasks.map(t => {
        const st = getStatusInfo(t.status);
        return `
          <div class="table-row" data-id="${t.id}" data-status="${t.status}">
            <div class="col-checkbox">
              <div class="checkbox ${t.status === 'done' ? 'checked' : ''}" data-action="toggle">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
            <div class="col-title"><span class="task-text" data-action="editTitle">${esc(t.title)}</span></div>
            <div class="col-status"><span class="status-badge" style="background:${st.color}" data-action="editStatus">${st.name}</span></div>
            <div class="col-stage"><span class="stage-badge" data-action="editStage">${esc(t.stage)}</span></div>
            <div class="col-date"><span class="editable-cell" data-action="editDate">${t.startDate || 'dd.mm.yyyy'}</span></div>
            <div class="col-notes"><span class="editable-cell" data-action="editNotes">${esc(t.notes) || 'Примечания'}</span></div>
            <div class="col-assignee"><span class="editable-cell" data-action="editAssignee">${esc(t.assignee) || '-'}</span></div>
            <div class="col-actions"><button class="delete-btn" data-action="delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg></button></div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  el.querySelectorAll('[data-action]').forEach(elem => {
    elem.addEventListener('click', handleTableClick);
  });
}

function handleTableClick(e: Event): void {
  e.stopPropagation();
  const target = e.currentTarget as HTMLElement;
  const action = target.getAttribute('data-action');
  const row = target.closest('.table-row');
  const id = row?.getAttribute('data-id');
  if (!action || !id) return;
  
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  
  switch (action) {
    case 'toggle':
      task.status = task.status === 'done' ? 'in-progress' : 'done';
      saveState(); render();
      break;
    case 'delete':
      state.tasks = state.tasks.filter(t => t.id !== id);
      saveState(); render();
      break;
    case 'editStatus':
      showPicker(target, state.statuses.map(s => ({ value: s.id, label: s.name, color: s.color })), v => {
        task.status = v;
        saveState(); render();
      });
      break;
    case 'editStage':
      showPicker(target, state.stages.map(s => ({ value: s, label: s })), v => {
        task.stage = v;
        saveState(); render();
      });
      break;
    case 'editDate':
      showDatePicker(target, v => {
        task.startDate = v;
        saveState(); render();
      });
      break;
    case 'editNotes':
      showTextInput(target, task.notes, 'Примечания', v => {
        task.notes = v;
        saveState(); render();
      });
      break;
    case 'editAssignee':
      showTextInput(target, task.assignee, 'Ответственный', v => {
        task.assignee = v;
        saveState(); render();
      });
      break;
    case 'editTitle':
      showTextInput(target, task.title, 'Название задачи', v => {
        if (v.trim()) { task.title = v.trim(); saveState(); render(); }
      });
      break;
  }
}

// Pickers
function closePickers(): void {
  document.querySelectorAll('.inline-picker').forEach(p => p.remove());
}

function showPicker(target: HTMLElement, options: { value: string; label: string; color?: string }[], onSelect: (v: string) => void): void {
  closePickers();
  const picker = document.createElement('div');
  picker.className = 'inline-picker';
  picker.innerHTML = options.map(o => `
    <div class="picker-option ${o.color ? '' : 'stage-option'}" data-value="${o.value}" ${o.color ? `style="background:${o.color}"` : ''}>${o.label}</div>
  `).join('');
  document.body.appendChild(picker);
  const rect = target.getBoundingClientRect();
  picker.style.top = `${rect.bottom + 4}px`;
  picker.style.left = `${rect.left}px`;
  picker.querySelectorAll('.picker-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect((opt as HTMLElement).dataset.value!);
      closePickers();
    });
  });
}

function showDatePicker(target: HTMLElement, onSelect: (v: string) => void): void {
  closePickers();
  const picker = document.createElement('div');
  picker.className = 'inline-picker date-picker';
  picker.innerHTML = `<input type="date" class="date-input">`;
  document.body.appendChild(picker);
  const rect = target.getBoundingClientRect();
  picker.style.top = `${rect.bottom + 4}px`;
  picker.style.left = `${rect.left}px`;
  const input = picker.querySelector('input')!;
  input.focus();
  input.addEventListener('change', () => {
    const [y, m, d] = input.value.split('-');
    onSelect(input.value ? `${d}.${m}.${y}` : '');
    closePickers();
  });
}

function showTextInput(target: HTMLElement, current: string, placeholder: string, onSave: (v: string) => void): void {
  closePickers();
  const picker = document.createElement('div');
  picker.className = 'inline-picker text-picker';
  picker.innerHTML = `<input type="text" class="text-input" value="${esc(current)}" placeholder="${placeholder}">`;
  document.body.appendChild(picker);
  const rect = target.getBoundingClientRect();
  picker.style.top = `${rect.bottom + 4}px`;
  picker.style.left = `${rect.left}px`;
  const input = picker.querySelector('input')!;
  input.focus();
  input.select();
  const save = () => { onSave(input.value); closePickers(); };
  input.addEventListener('keypress', e => { if (e.key === 'Enter') save(); });
  input.addEventListener('blur', () => setTimeout(save, 100));
}

document.addEventListener('click', e => {
  if (!(e.target as HTMLElement).closest('.inline-picker')) {
    closePickers();
  }
});

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Modals
function openModal(id: string): void {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id: string): void {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// Add Task Modal
document.getElementById('addBtn')?.addEventListener('click', () => {
  (document.getElementById('taskInput') as HTMLInputElement).value = '';
  selectedStatus = state.statuses[0]?.id || 'in-progress';
  selectedCategory = state.categories[0]?.id || 'personal';
  renderAddModalChips();
  openModal('addModal');
});

function renderAddModalChips(): void {
  const catEl = document.getElementById('categoryChips')!;
  catEl.innerHTML = state.categories.map(c => `
    <button type="button" class="chip ${selectedCategory === c.id ? 'active' : ''}" data-cat="${c.id}">${c.name}</button>
  `).join('');
  catEl.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      selectedCategory = (btn as HTMLElement).dataset.cat!;
      renderAddModalChips();
    });
  });
  
  const statusEl = document.getElementById('statusChips')!;
  statusEl.innerHTML = state.statuses.map(s => `
    <button type="button" class="chip ${selectedStatus === s.id ? 'active' : ''}" data-st="${s.id}" style="${selectedStatus === s.id ? `background:${s.color};color:white;border-color:${s.color}` : ''}">${s.name}</button>
  `).join('');
  statusEl.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      selectedStatus = (btn as HTMLElement).dataset.st!;
      renderAddModalChips();
    });
  });
}

document.getElementById('saveTaskBtn')?.addEventListener('click', () => {
  const input = document.getElementById('taskInput') as HTMLInputElement;
  const title = input.value.trim();
  if (title) {
    state.tasks.push({
      id: crypto.randomUUID(),
      title,
      category: selectedCategory,
      status: selectedStatus,
      stage: state.stages[0] || 'В процессе',
      startDate: '',
      notes: '',
      assignee: '',
    });
    saveState();
    render();
    closeModal('addModal');
  }
});

document.getElementById('closeAddModal')?.addEventListener('click', () => closeModal('addModal'));
document.querySelector('#addModal .modal-backdrop')?.addEventListener('click', () => closeModal('addModal'));

// Sync Modal
document.getElementById('syncBtn')?.addEventListener('click', () => {
  (document.getElementById('tokenInput') as HTMLInputElement).value = state.githubToken || '';
  (document.getElementById('gistIdInput') as HTMLInputElement).value = state.gistId || '';
  openModal('syncModal');
});

document.getElementById('closeSyncModal')?.addEventListener('click', () => closeModal('syncModal'));
document.querySelector('#syncModal .modal-backdrop')?.addEventListener('click', () => closeModal('syncModal'));

document.getElementById('saveSyncBtn')?.addEventListener('click', () => {
  state.githubToken = (document.getElementById('tokenInput') as HTMLInputElement).value.trim() || undefined;
  state.gistId = (document.getElementById('gistIdInput') as HTMLInputElement).value.trim() || undefined;
  saveState();
  alert('Сохранено!');
});

document.getElementById('uploadBtn')?.addEventListener('click', async () => {
  if (!state.githubToken) { alert('Введите Token'); return; }
  try {
    const content = JSON.stringify({ tasks: state.tasks, categories: state.categories, statuses: state.statuses, stages: state.stages }, null, 2);
    const headers = { 'Authorization': `token ${state.githubToken}`, 'Content-Type': 'application/json' };
    if (state.gistId) {
      await fetch(`https://api.github.com/gists/${state.gistId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ files: { 'tasklist.json': { content } } }),
      });
    } else {
      const r = await fetch('https://api.github.com/gists', {
        method: 'POST', headers,
        body: JSON.stringify({ description: 'TaskList', public: false, files: { 'tasklist.json': { content } } }),
      });
      const d = await r.json();
      state.gistId = d.id;
      (document.getElementById('gistIdInput') as HTMLInputElement).value = d.id;
      saveState();
    }
    alert('Выгружено!');
  } catch { alert('Ошибка'); }
});

document.getElementById('downloadBtn')?.addEventListener('click', async () => {
  if (!state.githubToken || !state.gistId) { alert('Введите Token и Gist ID'); return; }
  try {
    const r = await fetch(`https://api.github.com/gists/${state.gistId}`, {
      headers: { 'Authorization': `token ${state.githubToken}` },
    });
    const d = await r.json();
    const content = d.files['tasklist.json']?.content;
    if (content) {
      const parsed = JSON.parse(content);
      state.tasks = parsed.tasks || [];
      state.categories = parsed.categories || DEFAULT_CATEGORIES;
      state.statuses = parsed.statuses || DEFAULT_STATUSES;
      state.stages = parsed.stages || DEFAULT_STAGES;
      saveState();
      render();
      alert('Загружено!');
    }
  } catch { alert('Ошибка'); }
});

// Settings Modal
document.getElementById('settingsBtn')?.addEventListener('click', () => {
  (document.getElementById('darkMode') as HTMLInputElement).checked = state.settings.darkMode;
  (document.getElementById('showCompleted') as HTMLInputElement).checked = state.settings.showCompleted;
  renderSettingsLists();
  openModal('settingsModal');
});

document.getElementById('closeSettingsModal')?.addEventListener('click', () => closeModal('settingsModal'));
document.querySelector('#settingsModal .modal-backdrop')?.addEventListener('click', () => closeModal('settingsModal'));

document.getElementById('darkMode')?.addEventListener('change', e => {
  state.settings.darkMode = (e.target as HTMLInputElement).checked;
  applyTheme();
  saveState();
});

document.getElementById('showCompleted')?.addEventListener('change', e => {
  state.settings.showCompleted = (e.target as HTMLInputElement).checked;
  saveState();
  render();
});

function renderSettingsLists(): void {
  // Categories
  const catEl = document.getElementById('categoryList')!;
  catEl.innerHTML = state.categories.map(c => `
    <div class="list-item">
      <span class="item-color" style="background:${c.color}"></span>
      <span class="item-name">${esc(c.name)}</span>
      <button class="item-delete" data-type="cat" data-id="${c.id}">×</button>
    </div>
  `).join('');
  
  // Statuses
  const statusEl = document.getElementById('statusList')!;
  statusEl.innerHTML = state.statuses.map(s => `
    <div class="list-item">
      <span class="item-color" style="background:${s.color}"></span>
      <span class="item-name">${esc(s.name)}</span>
      <button class="item-delete" data-type="status" data-id="${s.id}">×</button>
    </div>
  `).join('');
  
  // Stages
  const stageEl = document.getElementById('stageList')!;
  stageEl.innerHTML = state.stages.map((s, i) => `
    <div class="list-item">
      <span class="item-name">${esc(s)}</span>
      <button class="item-delete" data-type="stage" data-idx="${i}">×</button>
    </div>
  `).join('');
  
  // Delete handlers
  document.querySelectorAll('.item-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = (btn as HTMLElement).dataset.type;
      if (type === 'cat') {
        state.categories = state.categories.filter(c => c.id !== (btn as HTMLElement).dataset.id);
      } else if (type === 'status') {
        state.statuses = state.statuses.filter(s => s.id !== (btn as HTMLElement).dataset.id);
      } else if (type === 'stage') {
        state.stages.splice(parseInt((btn as HTMLElement).dataset.idx!), 1);
      }
      saveState();
      renderSettingsLists();
      render();
    });
  });
}

// Add category
document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
  const name = (document.getElementById('newCatName') as HTMLInputElement).value.trim();
  const color = (document.getElementById('newCatColor') as HTMLInputElement).value;
  if (name) {
    state.categories.push({ id: crypto.randomUUID(), name, color });
    (document.getElementById('newCatName') as HTMLInputElement).value = '';
    saveState();
    renderSettingsLists();
    render();
  }
});

// Add status
document.getElementById('addStatusBtn')?.addEventListener('click', () => {
  const name = (document.getElementById('newStatusName') as HTMLInputElement).value.trim();
  const color = (document.getElementById('newStatusColor') as HTMLInputElement).value;
  if (name) {
    state.statuses.push({ id: crypto.randomUUID(), name, color });
    (document.getElementById('newStatusName') as HTMLInputElement).value = '';
    saveState();
    renderSettingsLists();
    render();
  }
});

// Add stage
document.getElementById('addStageBtn')?.addEventListener('click', () => {
  const name = (document.getElementById('newStageName') as HTMLInputElement).value.trim();
  if (name) {
    state.stages.push(name);
    (document.getElementById('newStageName') as HTMLInputElement).value = '';
    saveState();
    renderSettingsLists();
  }
});

// Export/Import
document.getElementById('exportBtn')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tasklist-backup.json';
  a.click();
});

document.getElementById('importBtn')?.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target?.result as string);
          state = { ...state, ...data };
          saveState();
          render();
          alert('Импортировано!');
        } catch { alert('Ошибка'); }
      };
      reader.readAsText(file);
    }
  };
  input.click();
});

document.getElementById('clearDataBtn')?.addEventListener('click', () => {
  if (confirm('Удалить все задачи?')) {
    state.tasks = [];
    saveState();
    render();
  }
});

// Init
loadState();
render();
