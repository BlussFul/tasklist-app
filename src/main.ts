interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  createdAt: number;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface AppState {
  tasks: Task[];
  categories: Category[];
  githubToken?: string;
  gistId?: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'personal', name: 'Личное', color: '#0a84ff' },
  { id: 'work', name: 'Работа', color: '#ff9f0a' },
  { id: 'shopping', name: 'Покупки', color: '#30d158' },
  { id: 'health', name: 'Здоровье', color: '#ff453a' },
];

let state: AppState = {
  tasks: [],
  categories: DEFAULT_CATEGORIES,
};

let selectedFilter: string | null = null;
let selectedCategory = 'personal';
let selectedPriority: Task['priority'] = 'medium';

// DOM Elements
const taskList = document.getElementById('taskList')!;
const categories = document.getElementById('categories')!;
const stats = document.getElementById('stats')!;
const progressFill = document.getElementById('progressFill')!;
const addModal = document.getElementById('addModal')!;
const settingsModal = document.getElementById('settingsModal')!;
const taskInput = document.getElementById('taskInput') as HTMLInputElement;
const categoryChips = document.getElementById('categoryChips')!;
const priorityChips = document.getElementById('priorityChips')!;
const tokenInput = document.getElementById('tokenInput') as HTMLInputElement;
const gistInput = document.getElementById('gistInput') as HTMLInputElement;

// Load/Save
function loadState(): void {
  try {
    const data = localStorage.getItem('tasklist-data');
    if (data) {
      state = JSON.parse(data);
      if (!state.categories?.length) {
        state.categories = DEFAULT_CATEGORIES;
      }
    }
  } catch (e) {
    console.error('Load error:', e);
  }
}

function saveState(): void {
  try {
    localStorage.setItem('tasklist-data', JSON.stringify(state));
  } catch (e) {
    console.error('Save error:', e);
  }
}

// Render
function render(): void {
  renderCategories();
  renderTasks();
  renderStats();
}

function renderCategories(): void {
  const counts: Record<string, number> = {};
  state.tasks.forEach(t => {
    if (!t.completed) {
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
  });
  
  const total = state.tasks.filter(t => !t.completed).length;
  
  categories.innerHTML = `
    <button class="category-btn ${selectedFilter === null ? 'active' : ''}" data-filter="">
      Все <span class="count">${total}</span>
    </button>
    ${state.categories.map(cat => `
      <button class="category-btn ${selectedFilter === cat.id ? 'active' : ''}" 
              data-filter="${cat.id}" 
              style="${selectedFilter === cat.id ? `background: ${cat.color}` : ''}">
        ${cat.name} <span class="count">${counts[cat.id] || 0}</span>
      </button>
    `).join('')}
  `;
  
  categories.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = (btn as HTMLElement).dataset.filter;
      selectedFilter = filter === '' ? null : filter!;
      render();
    });
  });
}

function renderTasks(): void {
  let tasks = [...state.tasks];
  
  if (selectedFilter) {
    tasks = tasks.filter(t => t.category === selectedFilter);
  }
  
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  tasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  if (tasks.length === 0) {
    taskList.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 12l2 2 4-4"/>
          <circle cx="12" cy="12" r="10"/>
        </svg>
        <h3>Нет задач</h3>
        <p>Нажмите + чтобы добавить</p>
      </div>
    `;
    return;
  }
  
  taskList.innerHTML = tasks.map(task => {
    const cat = state.categories.find(c => c.id === task.category);
    return `
      <div class="task-card ${task.completed ? 'completed' : ''}" data-id="${task.id}">
        <div class="checkbox ${task.completed ? 'checked' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="task-content">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta">
            <span class="task-category" style="background: ${cat?.color}20; color: ${cat?.color}">${cat?.name || ''}</span>
            <span class="task-priority ${task.priority}"></span>
          </div>
        </div>
        <button class="delete-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');
  
  // Event listeners
  taskList.querySelectorAll('.checkbox').forEach(cb => {
    cb.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.task-card');
      const id = card?.getAttribute('data-id');
      if (id) toggleTask(id);
    });
  });
  
  taskList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.task-card');
      const id = card?.getAttribute('data-id');
      if (id) deleteTask(id);
    });
  });
}

function renderStats(): void {
  const total = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  stats.textContent = `${completed} из ${total} выполнено`;
  progressFill.style.width = total > 0 ? `${(completed / total) * 100}%` : '0%';
}

function renderCategoryChips(): void {
  categoryChips.innerHTML = state.categories.map(cat => `
    <button class="chip ${selectedCategory === cat.id ? 'active' : ''}" 
            data-category="${cat.id}"
            style="${selectedCategory === cat.id ? `background: ${cat.color}` : ''}">
      ${cat.name}
    </button>
  `).join('');
  
  categoryChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectedCategory = (chip as HTMLElement).dataset.category!;
      renderCategoryChips();
    });
  });
}

// Actions
function addTask(title: string): void {
  const task: Task = {
    id: Math.random().toString(36).substr(2, 9),
    title,
    completed: false,
    priority: selectedPriority,
    category: selectedCategory,
    createdAt: Date.now(),
  };
  state.tasks.push(task);
  saveState();
  render();
}

function toggleTask(id: string): void {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveState();
    render();
  }
}

function deleteTask(id: string): void {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
  render();
}

// GitHub Sync
async function syncToGist(): Promise<void> {
  if (!state.githubToken) {
    openModal(settingsModal);
    return;
  }
  
  try {
    const content = JSON.stringify({
      tasks: state.tasks,
      categories: state.categories,
      lastSync: Date.now(),
    }, null, 2);
    
    const headers = {
      'Authorization': `token ${state.githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
    
    if (state.gistId) {
      await fetch(`https://api.github.com/gists/${state.gistId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ files: { 'tasklist-data.json': { content } } }),
      });
    } else {
      const resp = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description: 'TaskList App Data',
          public: false,
          files: { 'tasklist-data.json': { content } },
        }),
      });
      const data = await resp.json();
      state.gistId = data.id;
      saveState();
    }
    
    alert('Синхронизация завершена!');
  } catch (e) {
    alert('Ошибка синхронизации');
    console.error(e);
  }
}

// Modals
function openModal(modal: HTMLElement): void {
  modal.classList.add('open');
}

function closeModal(modal: HTMLElement): void {
  modal.classList.remove('open');
}

// Utils
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event Listeners
document.getElementById('addBtn')!.addEventListener('click', () => {
  taskInput.value = '';
  selectedPriority = 'medium';
  renderCategoryChips();
  priorityChips.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', (c as HTMLElement).dataset.priority === 'medium');
  });
  openModal(addModal);
  setTimeout(() => taskInput.focus(), 100);
});

document.getElementById('closeAddModal')!.addEventListener('click', () => closeModal(addModal));
addModal.querySelector('.modal-backdrop')!.addEventListener('click', () => closeModal(addModal));

document.getElementById('saveTaskBtn')!.addEventListener('click', () => {
  const title = taskInput.value.trim();
  if (title) {
    addTask(title);
    closeModal(addModal);
  }
});

taskInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const title = taskInput.value.trim();
    if (title) {
      addTask(title);
      closeModal(addModal);
    }
  }
});

priorityChips.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    priorityChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedPriority = (chip as HTMLElement).dataset.priority as Task['priority'];
  });
});

document.getElementById('syncBtn')!.addEventListener('click', syncToGist);

document.getElementById('settingsBtn')!.addEventListener('click', () => {
  tokenInput.value = state.githubToken || '';
  gistInput.value = state.gistId || '';
  openModal(settingsModal);
});

document.getElementById('closeSettingsModal')!.addEventListener('click', () => closeModal(settingsModal));
settingsModal.querySelector('.modal-backdrop')!.addEventListener('click', () => closeModal(settingsModal));

document.getElementById('saveSettingsBtn')!.addEventListener('click', () => {
  state.githubToken = tokenInput.value.trim() || undefined;
  state.gistId = gistInput.value.trim() || undefined;
  saveState();
  closeModal(settingsModal);
});

document.getElementById('disconnectBtn')!.addEventListener('click', () => {
  state.githubToken = undefined;
  state.gistId = undefined;
  saveState();
  closeModal(settingsModal);
});

// Init
loadState();
render();
