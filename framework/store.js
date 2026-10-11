/**
 * store.js — Reactive State Management
 *
 * Public API:
 *   createStore(initialState) → { getState, setState, subscribe }
 *
 * Usage:
 *   const store = createStore({ count: 0 })
 *   store.subscribe(state => console.log(state))
 *   store.setState({ count: 1 })
 *   store.setState(s => ({ count: s.count + 1 }))
 */

/**
 * Create a reactive state store.
 *
 * @param {object} initialState
 * @returns {{ getState: Function, setState: Function, subscribe: Function }}
 */
export function createStore(initialState) {
  // Internal state — never exposed directly to avoid external mutation
  let state = shallowClone(initialState);

  // Subscribers are held in a Set so each function is unique
  const subscribers = new Set();

  /**
   * Return a shallow copy of current state.
   * Callers get a snapshot; mutating it has no effect on the store.
   */
  function getState() {
    return shallowClone(state);
  }

  /**
   * Update state and notify all subscribers.
   *
   * @param {object|Function} updater
   *   - plain object → shallow-merged with current state
   *   - function(prevState) → should return a partial object to merge
   */
  function setState(updater) {
    const patch =
      typeof updater === 'function' ? updater(state) : updater;

    const nextState = { ...state, ...patch };

    // Skip notification if nothing actually changed
    if (shallowEqual(state, nextState)) return;

    state = nextState;
    notify();
  }

  /**
   * Subscribe to state changes.
   *
   * @param {Function} fn  Called with the new state after every change.
   * @returns {Function}   Unsubscribe function.
   */
  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  function notify() {
    // Iterate a copy so subscribers can safely unsubscribe themselves
    for (const fn of [...subscribers]) {
      fn(state);
    }
  }

  return { getState, setState, subscribe };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shallowClone(obj) {
  return { ...obj };
}

function shallowEqual(a, b) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
}
