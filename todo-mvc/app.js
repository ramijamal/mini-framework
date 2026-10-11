/**
 * todo-mvc/app.js — TodoMVC built with the Vanilla JS Framework
 *
 * Architecture:
 *   store    — single source of truth for todos, filter, editingId
 *   actions  — pure functions that call store.setState (defined outside
 *              the component so function references are stable)
 *   router   — hash-based, maps #/ → filter:'all' etc.
 *   App()    — pure component: state → vnode tree
 *   createApp — mounts, wires render loop
 */

import { h, createStore, Router, createApp } from '../framework/index.js';

// ─── LocalStorage ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'todomvc-vanilla-framework';

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Validate shape
    if (!Array.isArray(parsed.todos)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistState(state) {
  try {
    // editingId is transient UI state — intentionally NOT persisted
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ todos: state.todos, filter: state.filter }),
    );
  } catch {
    // Ignore quota-exceeded errors
  }
}

// ─── Initial state ─────────────────────────────────────────────────────────────

function getCurrentFilterFromHash() {
  const hash = window.location.hash;
  if (hash === '#/active') return 'active';
  if (hash === '#/completed') return 'completed';
  return 'all';
}

const saved = loadPersistedState();

const store = createStore({
  todos: saved?.todos ?? [],
  // URL hash is authoritative on load; falls back to saved or 'all'
  filter: getCurrentFilterFromHash(),
  editingId: null,
});

// Auto-save on every state change
store.subscribe(persistState);

// ─── ID generator ──────────────────────────────────────────────────────────────

// Start above the highest existing ID so we never collide after a reload
let nextId =
  store.getState().todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;

function uid() {
  return nextId++;
}

// ─── Actions ───────────────────────────────────────────────────────────────────
// All state mutations go through these stable, named functions.
// Defining them outside the component means their references don't change
// across renders, avoiding unnecessary event-listener re-registration.

const actions = {
  addTodo(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    store.setState((s) => ({
      todos: [...s.todos, { id: uid(), text: trimmed, completed: false }],
    }));
  },

  toggleTodo(id) {
    store.setState((s) => ({
      todos: s.todos.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t,
      ),
    }));
  },

  deleteTodo(id) {
    store.setState((s) => ({
      todos: s.todos.filter((t) => t.id !== id),
      editingId: s.editingId === id ? null : s.editingId,
    }));
  },

  clearCompleted() {
    store.setState((s) => ({
      todos: s.todos.filter((t) => !t.completed),
    }));
  },

  toggleAll(completed) {
    store.setState((s) => ({
      todos: s.todos.map((t) => ({ ...t, completed })),
    }));
  },

  setFilter(filter) {
    store.setState({ filter });
  },

  startEditing(id) {
    store.setState({ editingId: id });
  },

  saveEdit(id, text) {
    const trimmed = text.trim();
    if (!trimmed) {
      // Empty submission deletes the todo (per TodoMVC spec)
      actions.deleteTodo(id);
    } else {
      store.setState((s) => ({
        todos: s.todos.map((t) =>
          t.id === id ? { ...t, text: trimmed } : t,
        ),
        editingId: null,
      }));
    }
  },

  cancelEdit() {
    store.setState({ editingId: null });
  },
};

// ─── Router ────────────────────────────────────────────────────────────────────

const router = new Router();

router
  .addRoute('/', () => actions.setFilter('all'))
  .addRoute('/active', () => actions.setFilter('active'))
  .addRoute('/completed', () => actions.setFilter('completed'));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getFilteredTodos(todos, filter) {
  if (filter === 'active') return todos.filter((t) => !t.completed);
  if (filter === 'completed') return todos.filter((t) => t.completed);
  return todos;
}

function pluralise(n, word) {
  return n === 1 ? word : word + 's';
}

// ─── Component functions (pure: state → vnode) ─────────────────────────────────

/**
 * A single todo list item.
 * key is set on the li so the VDOM keyed-diffing can reuse DOM nodes
 * when the list is reordered by filter changes.
 */
function TodoItem(todo, isEditing) {
  const liClass = [
    todo.completed ? 'completed' : '',
    isEditing ? 'editing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return h(
    'li',
    { key: String(todo.id), class: liClass || null },

    // ── View (visible when not editing) ──────────────────────────────
    h(
      'div',
      { class: 'view' },
      h('input', {
        class: 'toggle',
        type: 'checkbox',
        checked: todo.completed,
        onChange: () => actions.toggleTodo(todo.id),
      }),
      h(
        'label',
        { onDblclick: () => actions.startEditing(todo.id) },
        todo.text,
      ),
      h('button', {
        class: 'destroy',
        onClick: () => actions.deleteTodo(todo.id),
      }),
    ),

    // ── Edit input (visible only in editing state via CSS) ────────────
    h('input', {
      class: 'edit',
      value: todo.text,
      onBlur: (e) => {
        // Only save if we're still editing this item
        // (cancelEdit sets editingId to null before blur can fire)
        if (store.getState().editingId === todo.id) {
          actions.saveEdit(todo.id, e.target.value);
        }
      },
      onKeydown: (e) => {
        if (e.key === 'Enter') actions.saveEdit(todo.id, e.target.value);
        if (e.key === 'Escape') {
          e.target.value = todo.text; // reset visual value
          actions.cancelEdit();
        }
      },
    }),
  );
}

/**
 * A filter link in the footer.
 */
function FilterLink(label, path, filterName, currentFilter) {
  return h(
    'li',
    {},
    h(
      'a',
      {
        href: '#' + path,
        class: currentFilter === filterName ? 'selected' : null,
      },
      label,
    ),
  );
}

/**
 * Root application component.
 * Pure function: (state) → vnode
 */
function App(state) {
  const { todos, filter, editingId } = state;
  const filteredTodos = getFilteredTodos(todos, filter);
  const activeCount = todos.filter((t) => !t.completed).length;
  const hasCompleted = todos.some((t) => t.completed);
  const allCompleted = todos.length > 0 && todos.every((t) => t.completed);

  return h(
    'section',
    { class: 'todoapp' },

    // ── Header ──────────────────────────────────────────────────────────
    h(
      'header',
      { class: 'header' },
      h('h1', {}, 'todos'),
      h('input', {
        class: 'new-todo',
        placeholder: 'What needs to be done?',
        autofocus: true,
        onKeydown: (e) => {
          if (e.key === 'Enter') {
            actions.addTodo(e.target.value);
            e.target.value = '';
          }
        },
      }),
    ),

    // ── Main (hidden by removing from VDOM when no todos exist) ─────────
    todos.length === 0
      ? null
      : h(
          'section',
          { class: 'main' },
          h('input', {
            id: 'toggle-all',
            class: 'toggle-all',
            type: 'checkbox',
            checked: allCompleted,
            onChange: (e) => actions.toggleAll(e.target.checked),
          }),
          h('label', { for: 'toggle-all' }, 'Mark all as complete'),
          h(
            'ul',
            { class: 'todo-list' },
            ...filteredTodos.map((todo) =>
              TodoItem(todo, editingId === todo.id),
            ),
          ),
        ),

    // ── Footer (hidden by removing from VDOM when no todos exist) ────────
    todos.length === 0
      ? null
      : h(
          'footer',
          { class: 'footer' },
          h(
            'span',
            { class: 'todo-count' },
            h('strong', {}, String(activeCount)),
            ` ${pluralise(activeCount, 'item')} left`,
          ),
          h(
            'ul',
            { class: 'filters' },
            FilterLink('All', '/', 'all', filter),
            FilterLink('Active', '/active', 'active', filter),
            FilterLink('Completed', '/completed', 'completed', filter),
          ),
          hasCompleted
            ? h(
                'button',
                {
                  class: 'clear-completed',
                  onClick: actions.clearCompleted,
                },
                'Clear completed',
              )
            : null,
        ),
  );
}

// ─── Mount ─────────────────────────────────────────────────────────────────────

createApp({
  el: '#app',
  component: (state) => App(state),
  store,
  router,
});
