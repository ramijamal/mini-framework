/**
 * app.js — Application Orchestrator
 *
 * createApp wires together the VDOM, store, and router into a single render
 * loop. It owns the render cycle; no other module touches the DOM root.
 *
 * Public API:
 *   createApp({ el, component, store, router? }) → { destroy }
 *
 * Options:
 *   el        {string|Element}  CSS selector or DOM element to mount into.
 *   component {Function}        (state, store, router) → vnode  — pure function.
 *   store     {object}          Store created by createStore().
 *   router    {Router}          Optional. Router instance.
 *
 * Render loop:
 *   - store.subscribe(scheduleRender)
 *   - scheduleRender queues a single requestAnimationFrame per "dirty" cycle.
 *   - Multiple setState calls in the same tick produce exactly one DOM update.
 *   - The component function must be pure (no setState inside it).
 *
 * Infinite-loop prevention:
 *   - component() is pure → it never calls setState.
 *   - persistState and other store subscribers may run, but they write to
 *     external storage (localStorage), not back to the store.
 *   - scheduleRender guards with `if (rafId !== null) return`.
 */

import { createElement, patch } from './vdom.js';

export function createApp({ el, component, store, router }) {
  // ── Resolve mount target ────────────────────────────────────────────────
  const container =
    typeof el === 'string' ? document.querySelector(el) : el;

  if (!container) {
    throw new Error(`createApp: mount target "${el}" not found in the document.`);
  }

  // ── Internal state ──────────────────────────────────────────────────────
  let oldVnode = null;
  let rafId = null;
  let isMounted = false;

  // ── Render function ─────────────────────────────────────────────────────
  function render() {
    rafId = null;

    const state = store.getState();
    const newVnode = component(state, store, router);

    if (!isMounted) {
      // First render: wipe container and mount fresh
      container.innerHTML = '';
      container.appendChild(createElement(newVnode));
      isMounted = true;
    } else {
      // Subsequent renders: diff & patch
      patch(container, oldVnode, newVnode, 0);
    }

    oldVnode = newVnode;

    // Post-patch: manage focus for the editing input in TodoMVC (or any app
    // that sets `editingId` in state). Querying after patch ensures the
    // li.editing class is already present in the DOM.
    focusEditingInput(container, state);
  }

  // ── Schedule one render per animation frame ──────────────────────────────
  function scheduleRender() {
    if (rafId !== null) return; // already queued
    rafId = requestAnimationFrame(render);
  }

  // ── Wire store → render ─────────────────────────────────────────────────
  const unsubscribe = store.subscribe(scheduleRender);

  // ── Start router (attaches hashchange listener, fires current route) ────
  router?.start();

  // ── Initial render — synchronous so there is no blank-frame flash ───────
  render();

  // ── Return teardown handle ───────────────────────────────────────────────
  return {
    destroy() {
      unsubscribe();
      router?.destroy();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}

// ─── Focus helper ─────────────────────────────────────────────────────────────

/**
 * After each patch, if the app has an editingId in state, find the
 * corresponding .edit input and focus it. Only moves focus when it is not
 * already on the correct element (prevents cursor-position reset).
 */
function focusEditingInput(container, state) {
  if (!state.editingId) return;

  const editInput = container.querySelector('li.editing .edit');
  if (editInput && document.activeElement !== editInput) {
    editInput.focus();
    // Place cursor at the end of the existing text
    const len = editInput.value.length;
    editInput.setSelectionRange(len, len);
  }
}
