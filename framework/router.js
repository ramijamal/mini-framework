/**
 * router.js — Hash-Based Router
 *
 * Public API:
 *   new Router()
 *   router.addRoute(path, fn) → this   Register a route handler.
 *   router.navigate(path)              Change the URL hash.
 *   router.getCurrentPath() → string   Current hash path (e.g. '/active').
 *   router.start() → this              Attach listeners & fire current route.
 *   router.destroy()                   Remove listeners (cleanup / testing).
 *
 * Paths use the form '/active', '/completed', '/'. The URL hash is '#/active'.
 *
 * Usage:
 *   const router = new Router()
 *   router
 *     .addRoute('/', () => store.setState({ filter: 'all' }))
 *     .addRoute('/active', () => store.setState({ filter: 'active' }))
 *     .addRoute('/completed', () => store.setState({ filter: 'completed' }))
 *   router.start()
 */

export class Router {
  #routes = new Map();
  #handler = null;

  /**
   * Register a route.
   * @param {string}   path  e.g. '/', '/active', '/completed'
   * @param {Function} fn    Called with (path) when route matches.
   * @returns {Router}  this — for fluent chaining.
   */
  addRoute(path, fn) {
    this.#routes.set(normalizePath(path), fn);
    return this;
  }

  /**
   * Navigate to a path by setting window.location.hash.
   * The hashchange event fires automatically and dispatches the route.
   * @param {string} path  e.g. '/', '/active'
   */
  navigate(path) {
    window.location.hash = '#' + normalizePath(path);
  }

  /**
   * Read the current URL hash and return the normalized path.
   * '#/active' → '/active', '' or '#' → '/'
   * @returns {string}
   */
  getCurrentPath() {
    return hashToPath(window.location.hash);
  }

  /**
   * Attach event listeners and immediately dispatch the current route.
   * Call this once after all routes have been registered.
   * @returns {Router}  this
   */
  start() {
    this.#handler = () => this.#dispatch();
    window.addEventListener('hashchange', this.#handler);
    // Fire now so the app starts in the correct state (handles page reload)
    this.#dispatch();
    return this;
  }

  /**
   * Remove event listeners. Call when tearing down the app.
   */
  destroy() {
    if (this.#handler) {
      window.removeEventListener('hashchange', this.#handler);
      this.#handler = null;
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  #dispatch() {
    const path = this.getCurrentPath();
    const fn = this.#routes.get(path);

    if (fn) {
      fn(path);
    } else {
      // Fallback to root route if registered
      const fallback = this.#routes.get('/');
      if (fallback) fallback('/');
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePath(path) {
  // Ensure leading slash; strip trailing slashes (except root)
  const p = path.startsWith('/') ? path : '/' + path;
  return p === '/' ? p : p.replace(/\/+$/, '');
}

function hashToPath(hash) {
  // '#/active' → '/active', '' → '/', '#' → '/'
  const raw = hash.replace(/^#/, '') || '/';
  return normalizePath(raw);
}
