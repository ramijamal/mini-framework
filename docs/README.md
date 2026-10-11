# Vanilla JS Framework — Documentation

A lightweight, zero-dependency JavaScript framework built from scratch. It implements the four pillars of modern frontend frameworks without relying on React, Angular, Vue, or any other high-level library.

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [API Reference](#api-reference)
   - [h() — Create elements](#h--create-elements)
   - [createStore() — State management](#createstore--state-management)
   - [Router — Routing](#router--routing)
   - [EventBus — Event system](#eventbus--event-system)
   - [createApp() — Mount the app](#createapp--mount-the-app)
5. [How the Framework Works](#how-the-framework-works)
6. [TodoMVC Architecture](#todomvc-architecture)

---

## Overview

This framework implements four features found in every major frontend framework:

| Feature | Module | Description |
|---|---|---|
| **DOM Abstraction** | `vdom.js` | Virtual DOM with efficient diffing and patching |
| **State Management** | `store.js` | Reactive store — UI re-renders automatically on state change |
| **Routing** | `router.js` | Hash-based router that syncs URL with application state |
| **Event Handling** | `events.js` + `vdom.js` | Declarative inline handlers and a pub/sub EventBus |

**No build step required.** The framework uses native ES modules (`import`/`export`) and runs directly in any modern browser.

---

## Getting Started

### Running the TodoMVC Example

You need to serve the files from a local HTTP server (ES modules require HTTP, not `file://`).

```bash
# Option 1 — npx serve (recommended)
npx serve .

# Option 2 — Python
python3 -m http.server 8080

# Option 3 — VS Code Live Server extension
# Right-click todo-mvc/index.html → "Open with Live Server"
```

Then open `http://localhost:3000/todo-mvc/` (or whichever port the server reports).

### Using the Framework in Your Own App

```
your-app/
├── framework/        ← copy this folder from the repo
│   ├── index.js
│   ├── vdom.js
│   ├── store.js
│   ├── router.js
│   ├── events.js
│   └── app.js
├── index.html
└── app.js
```

Import everything from the framework entry point:

```js
import { h, createStore, Router, EventBus, eventBus, createApp }
  from './framework/index.js';
```

---

## Core Concepts

### The Virtual DOM

Instead of manipulating the real DOM directly, you describe what the UI should look like using plain JavaScript objects called **vnodes** (virtual nodes). The framework compares the old vnode tree with the new one and makes only the minimal DOM changes needed.

```
Your component function  →  vnode tree  →  diff against old tree  →  patch real DOM
```

### Reactive State

State lives in a **store**. When you call `store.setState(...)`, all subscribers are notified. The framework subscribes to the store and re-renders your component automatically — you never manually update the DOM.

```
User action → handler → store.setState() → subscribers notified → re-render → DOM updated
```

### Routing

The router listens for URL hash changes (`#/active`, `#/completed`, `#/`). When the hash changes, a registered callback fires — usually calling `store.setState({ filter: '...' })` which triggers a re-render with the new filter applied.

---

## API Reference

### `h()` — Create Elements

```js
h(tag, attrs, ...children)
```

Creates a virtual DOM node (vnode). This is the only way to describe UI in the framework.

| Parameter | Type | Description |
|---|---|---|
| `tag` | `string` | HTML tag name (`'div'`, `'input'`, `'ul'`, …) |
| `attrs` | `object\|null` | Attributes, properties, and event handlers |
| `...children` | `vnode\|string\|number\|null` | Child nodes (nested, or spread from array) |

#### Creating an element

```js
const vnode = h('div', { class: 'container' }, 'Hello world');
// → <div class="container">Hello world</div>
```

#### Adding attributes

```js
h('input', {
  type: 'text',
  placeholder: 'What needs to be done?',
  autofocus: true,
  id: 'my-input',
})
// → <input type="text" placeholder="..." autofocus id="my-input">
```

Special attribute names:

| Attr name | Maps to |
|---|---|
| `class` | `element.className` |
| `value` | `element.value` (DOM property — safe for inputs) |
| `checked` | `element.checked` |
| `disabled` | `element.disabled` |
| `for` | `element.setAttribute('for', ...)` (for `<label>`) |
| `key` | Used internally for keyed diffing (not rendered to DOM) |

#### Creating an event

Events use `on` + PascalCase handler name in the attrs object. The framework wires these up internally — **you never call `addEventListener`**.

```js
h('button', { onClick: () => console.log('clicked!') }, 'Click me')

h('input', {
  onKeydown: (e) => {
    if (e.key === 'Enter') console.log('submitted:', e.target.value)
  },
})

h('label', {
  onDblclick: () => startEditing(id),
}, 'Double-click to edit')
```

Supported event names (any DOM event works):

| Attr | DOM event |
|---|---|
| `onClick` | `click` |
| `onChange` | `change` |
| `onKeydown` | `keydown` |
| `onBlur` | `blur` |
| `onFocus` | `focus` |
| `onDblclick` | `dblclick` |
| `onSubmit` | `submit` |
| `onInput` | `input` |

#### Nesting elements

Pass child vnodes as additional arguments to `h()`, or spread an array:

```js
h('ul', { class: 'list' },
  h('li', {}, 'First item'),
  h('li', {}, 'Second item'),
  h('li', {}, 'Third item'),
)
// → <ul class="list"><li>First item</li>…</ul>
```

Spreading an array (useful for dynamic lists):

```js
const items = ['Apple', 'Banana', 'Cherry'];

h('ul', { class: 'fruits' },
  ...items.map((name, i) =>
    h('li', { key: String(i) }, name)
  )
)
```

Use `key` on list items so the VDOM can efficiently reuse DOM nodes when the list changes. Keys must be unique strings within a list.

#### Conditional rendering

Return `null`, `false`, or `undefined` where you don't want a node. The framework skips them.

```js
h('div', {},
  isLoggedIn ? h('span', {}, 'Welcome!') : null,
  hasError   ? h('p', { class: 'error' }, errorMessage) : null,
)
```

#### Full example — a card component

```js
function Card(title, body, onClose) {
  return h('div', { class: 'card' },
    h('div', { class: 'card-header' },
      h('h2', {}, title),
      h('button', { onClick: onClose, class: 'close' }, '×'),
    ),
    h('div', { class: 'card-body' }, body),
  );
}
```

---

### `createStore()` — State Management

```js
createStore(initialState) → store
```

Creates a reactive state container.

| Method | Signature | Description |
|---|---|---|
| `getState()` | `() → object` | Returns a shallow copy of current state |
| `setState()` | `(object\|fn) → void` | Update state and notify all subscribers |
| `subscribe()` | `(fn) → unsubscribeFn` | Register a callback to run on every state change |

#### Basic usage

```js
const store = createStore({ count: 0, name: 'World' });

// Read state
console.log(store.getState()); // { count: 0, name: 'World' }

// Update with an object (shallow merge)
store.setState({ count: 1 });
console.log(store.getState()); // { count: 1, name: 'World' }

// Update with a function (use when new value depends on old value)
store.setState(prev => ({ count: prev.count + 1 }));
console.log(store.getState()); // { count: 2, name: 'World' }
```

#### Subscribing to changes

```js
const unsubscribe = store.subscribe((state) => {
  console.log('State changed:', state);
});

store.setState({ count: 99 }); // → logs "State changed: { count: 99, … }"

// Stop listening
unsubscribe();
```

#### Updating arrays in state

Since `setState` does a shallow merge, update arrays by spreading:

```js
// Add an item
store.setState(s => ({
  todos: [...s.todos, { id: 1, text: 'New todo', completed: false }]
}));

// Update one item
store.setState(s => ({
  todos: s.todos.map(t => t.id === 1 ? { ...t, completed: true } : t)
}));

// Remove an item
store.setState(s => ({
  todos: s.todos.filter(t => t.id !== 1)
}));
```

---

### `Router` — Routing

```js
new Router()
```

A hash-based router. The URL fragment (`#/active`, `#/completed`, `#/`) is the source of truth for the current route.

| Method | Signature | Description |
|---|---|---|
| `addRoute(path, fn)` | `(string, Function) → this` | Register a route handler |
| `navigate(path)` | `(string) → void` | Navigate programmatically |
| `getCurrentPath()` | `() → string` | Current path (e.g. `'/active'`) |
| `start()` | `() → this` | Attach listeners and fire the current route |
| `destroy()` | `() → void` | Remove listeners (cleanup) |

#### Usage

```js
const router = new Router();

router
  .addRoute('/', () => store.setState({ page: 'home' }))
  .addRoute('/about', () => store.setState({ page: 'about' }))
  .addRoute('/contact', () => store.setState({ page: 'contact' }));

router.start(); // must be called once after all routes are registered
```

#### Programmatic navigation

```js
router.navigate('/about');
// URL becomes http://…/#/about
// The /about handler fires automatically
```

#### Why hash routing?

Using `#/path` works without a server configuration change. Any server can serve `index.html`, and the browser handles the hash part locally. The `hashchange` event fires when the hash changes, giving us routing without page reloads.

---

### `EventBus` — Event System

The framework provides two distinct event APIs, both of which are different from the native `addEventListener` method:

#### 1. Declarative inline handlers (in `h()`)

Already covered above — `onClick`, `onKeydown`, etc. The user never calls `addEventListener`. The framework handles it internally.

#### 2. EventBus — pub/sub for cross-component communication

```js
import { eventBus } from './framework/index.js';
// or create your own instance:
import { EventBus } from './framework/index.js';
const bus = new EventBus();
```

| Method | Signature | Description |
|---|---|---|
| `on(event, fn)` | `(string, Function) → unsubscribeFn` | Subscribe to an event |
| `off(event, fn)` | `(string, Function) → void` | Unsubscribe a specific handler |
| `emit(event, data)` | `(string, *) → void` | Fire an event with optional data |
| `once(event, fn)` | `(string, Function) → unsubscribeFn` | Subscribe for one invocation only |
| `clear(event?)` | `(string?) → void` | Remove all handlers (for one event, or all) |

#### Example

```js
import { eventBus } from './framework/index.js';

// In component A — listen for an event
const unsub = eventBus.on('user:login', (user) => {
  console.log('Logged in:', user.name);
});

// In component B — emit the event
eventBus.emit('user:login', { name: 'Alice', id: 42 });

// Clean up when done
unsub();
```

#### once — fire-and-forget

```js
eventBus.once('app:ready', () => {
  console.log('App is ready! (This runs exactly once)');
});
```

#### Why is EventBus different from addEventListener?

| | `addEventListener` | EventBus `.on()` |
|---|---|---|
| Requires a DOM element | Yes | No |
| Works cross-module | Only with shared element ref | Yes, with shared `eventBus` |
| Unsubscribe API | `.removeEventListener(name, fn)` | Return value of `.on()` |
| Custom event names | Must use `CustomEvent` | Any string |

---

### `createApp()` — Mount the App

```js
createApp({ el, component, store, router }) → { destroy }
```

The orchestrator. Call this once at the end of your `app.js`.

| Option | Type | Required | Description |
|---|---|---|---|
| `el` | `string\|Element` | Yes | CSS selector (`'#app'`) or DOM element |
| `component` | `Function` | Yes | `(state, store, router) → vnode` — must be pure |
| `store` | `store` | Yes | Created by `createStore()` |
| `router` | `Router` | No | Created by `new Router()` |

```js
createApp({
  el: '#app',
  component: (state) => App(state),
  store,
  router,
});
```

The returned `{ destroy }` handle can be called to unmount the app and remove all listeners.

---

## How the Framework Works

### Virtual DOM and Diffing

When you call `createApp`, the framework:

1. Calls `component(state)` to get a **vnode tree** (plain JS objects)
2. Calls `createElement(vnode)` to build real DOM nodes and appends them to the container
3. Stores the vnode tree as `oldVnode`

On the next re-render:

1. Calls `component(newState)` to get a **new vnode tree**
2. Calls `patch(container, oldVnode, newVnode)` which **diffs** the two trees and applies only what changed:
   - Same tag → update attributes, recurse into children
   - Different tag → replace the element entirely
   - Text changed → update `textContent`
   - Node added/removed → insert/delete
3. For **lists of children** (like a todo list), keyed diffing is used: each child has a `key` attribute. The algorithm builds a map of `key → DOM node`, then reuses and reorders existing nodes instead of creating new ones. This is O(n) and avoids destroying/recreating DOM nodes unnecessarily.

### Render Loop and Performance

Re-renders are **batched using `requestAnimationFrame`**:

```
store.setState() called
  → subscribers notified → scheduleRender()
  → if no rAF already queued → requestAnimationFrame(render)
  → ...more setState calls happen synchronously (all ignored by scheduler)...
  → browser frame fires → render() runs exactly once
```

This means any number of `setState` calls in a single event handler result in exactly one DOM update per frame, keeping the UI smooth.

### Why components must be pure

The `component` function must not call `store.setState` inside it. It is called during the render phase and should only compute a vnode tree from the state it receives. Side effects (API calls, localStorage writes, etc.) belong in action functions and store subscribers — not in the component.

### State → URL → State flow (Router)

```
hashchange fires
  → Router dispatches to handler
    → handler calls store.setState({ filter: 'active' })
      → store notifies subscribers
        → scheduleRender queues a frame
          → render() paints the filtered list
```

The URL is always the source of truth for the filter. On page reload, `router.start()` fires the current hash route before the first render — so the app starts in the correct filtered state.

---

## TodoMVC Architecture

### State shape

```js
{
  todos: [{ id: number, text: string, completed: boolean }],
  filter: 'all' | 'active' | 'completed',
  editingId: null | number,   // which todo is being edited
}
```

`editingId` is **not persisted** to localStorage — editing state is transient UI state that should reset on page reload.

### Data flow

```
User presses Enter in .new-todo input
  → onKeydown handler reads e.target.value
  → actions.addTodo(text) called
  → store.setState(s => ({ todos: [...s.todos, newTodo] }))
  → store notifies subscribers
  → persistState writes todos to localStorage
  → scheduleRender queues rAF
  → render() diffs vnode tree
  → patchChildren adds one <li> to the .todo-list
```

### Component tree

```
App(state)
  ├── header.header
  │   └── input.new-todo
  ├── section.main           (omitted from vnode when todos.length === 0)
  │   ├── input#toggle-all.toggle-all
  │   ├── label[for=toggle-all]
  │   └── ul.todo-list
  │       └── TodoItem(todo, isEditing)  × N    [key = todo.id]
  │           ├── div.view
  │           │   ├── input.toggle
  │           │   ├── label              (dblclick → startEditing)
  │           │   └── button.destroy
  │           └── input.edit             (blur/Enter → saveEdit, Escape → cancelEdit)
  └── footer.footer          (omitted from vnode when todos.length === 0)
      ├── span.todo-count
      ├── ul.filters
      │   └── FilterLink × 3             (All / Active / Completed)
      └── button.clear-completed         (omitted from vnode when no completed todos)
```

### Editing flow

```
Double-click label
  → actions.startEditing(todo.id)
  → re-render: li gets class "editing"
  → CSS shows .edit input, hides .view div
  → createApp post-patch: querySelector('li.editing .edit').focus()

Press Enter or blur
  → actions.saveEdit(id, value)
  → empty text → deleteTodo; else → update todo text, editingId = null

Press Escape
  → e.target.value = todo.text   (reset visual state)
  → actions.cancelEdit()          → editingId = null
```

### URL routing

| URL Hash | Filter | Visible todos |
|---|---|---|
| `#/` or empty | `'all'` | All todos |
| `#/active` | `'active'` | Todos where `completed === false` |
| `#/completed` | `'completed'` | Todos where `completed === true` |

Filter clicks are plain `<a href="#/active">` links — no JavaScript needed for navigation. The browser changes the hash, `hashchange` fires, the router calls `actions.setFilter('active')`, and the store re-renders the filtered list.
