/**
 * events.js — Custom Event System
 *
 * Provides two event APIs that are distinctly different from the native
 * addEventListener() method:
 *
 *  1. Declarative inline handlers — `onClick`, `onKeydown`, etc. in h() attrs.
 *     These are handled transparently by vdom.js. The user never calls
 *     addEventListener; they just write:
 *       h('button', { onClick: () => doSomething() }, 'Click me')
 *
 *  2. EventBus — Application-level pub/sub for cross-component communication.
 *     No DOM target, no addEventListener call by the user:
 *       eventBus.on('todo:added', handler)
 *       eventBus.emit('todo:added', { id: 1, text: 'Buy milk' })
 *
 * Public API:
 *   class EventBus
 *     .on(event, fn)    → unsubscribeFn
 *     .off(event, fn)
 *     .emit(event, data)
 *     .once(event, fn)  → unsubscribeFn
 *     .clear(event?)
 *
 *   eventBus — shared singleton instance
 */

export class EventBus {
  #listeners = new Map(); // Map<eventName, Set<fn>>

  /**
   * Subscribe to an event.
   * @param {string}   event
   * @param {Function} fn     Called with (data) when the event is emitted.
   * @returns {Function}      Unsubscribe function.
   */
  on(event, fn) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  /**
   * Unsubscribe a specific handler from an event.
   * @param {string}   event
   * @param {Function} fn
   */
  off(event, fn) {
    this.#listeners.get(event)?.delete(fn);
  }

  /**
   * Emit an event, calling all registered handlers.
   * @param {string} event
   * @param {*}      data    Passed as the first argument to each handler.
   */
  emit(event, data) {
    const fns = this.#listeners.get(event);
    if (!fns) return;
    // Iterate a copy so handlers can safely call .off() on themselves
    for (const fn of [...fns]) {
      fn(data);
    }
  }

  /**
   * Subscribe to an event for a single invocation, then auto-unsubscribe.
   * @param {string}   event
   * @param {Function} fn
   * @returns {Function}  Unsubscribe function (in case you need to cancel early).
   */
  once(event, fn) {
    const wrapper = (data) => {
      fn(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  /**
   * Remove all handlers for a specific event, or clear everything.
   * @param {string} [event]  If omitted, all events are cleared.
   */
  clear(event) {
    if (event !== undefined) {
      this.#listeners.delete(event);
    } else {
      this.#listeners.clear();
    }
  }
}

/**
 * Shared application-wide EventBus instance.
 * Import and use directly in any module without passing it around.
 */
export const eventBus = new EventBus();
