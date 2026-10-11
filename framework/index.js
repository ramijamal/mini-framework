/**
 * framework/index.js — Public API Surface
 *
 * Import everything your app needs from this single entry point:
 *
 *   import { h, createStore, Router, EventBus, eventBus, createApp }
 *     from '../framework/index.js'
 */

export { h, createElement, patch } from './vdom.js';
export { createStore }              from './store.js';
export { Router }                   from './router.js';
export { EventBus, eventBus }       from './events.js';
export { createApp }                from './app.js';
