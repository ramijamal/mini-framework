/**
 * vdom.js — Virtual DOM
 *
 * Public API:
 *   h(tag, attrs, ...children) → vnode
 *   createElement(vnode)       → real DOM node
 *   patch(parent, oldVnode, newVnode, index) → void
 */

// ─── Vnode constructors ───────────────────────────────────────────────────────

/**
 * Create a virtual DOM node (element or text).
 * @param {string} tag
 * @param {object|null} attrs
 * @param {...*} children
 */
export function h(tag, attrs, ...children) {
  return {
    type: 'element',
    tag,
    attrs: attrs ?? {},
    key: attrs?.key ?? null,
    children: flattenChildren(children),
  };
}

function flattenChildren(children) {
  return children
    .flat(Infinity)
    .map((child) => {
      if (child === null || child === undefined || child === false) return null;
      if (typeof child === 'string' || typeof child === 'number') {
        return { type: 'text', text: String(child) };
      }
      return child; // already a vnode
    })
    .filter((c) => c !== null);
}

// ─── createElement ────────────────────────────────────────────────────────────

/**
 * Turn a vnode into a real DOM node.
 * @param {object} vnode
 * @returns {Node}
 */
export function createElement(vnode) {
  if (vnode.type === 'text') {
    return document.createTextNode(vnode.text);
  }

  const el = document.createElement(vnode.tag);
  applyAttrs(el, {}, vnode.attrs);

  for (const child of vnode.children) {
    el.appendChild(createElement(child));
  }

  return el;
}

// ─── Attribute diffing ────────────────────────────────────────────────────────

/**
 * Diff and apply attribute/event-handler changes from oldAttrs → newAttrs.
 */
function applyAttrs(el, oldAttrs, newAttrs) {
  // ── Remove old event handlers that are gone or changed ──────────────────
  for (const key of Object.keys(oldAttrs)) {
    if (!isHandler(key)) continue;
    const event = handlerToEvent(key);
    el.removeEventListener(event, oldAttrs[key]);
  }

  // ── Add new event handlers ───────────────────────────────────────────────
  for (const key of Object.keys(newAttrs)) {
    if (!isHandler(key)) continue;
    const event = handlerToEvent(key);
    el.addEventListener(event, newAttrs[key]);
  }

  // ── Set new / changed regular attrs ─────────────────────────────────────
  for (const key of Object.keys(newAttrs)) {
    if (isHandler(key) || key === 'key') continue;
    setAttr(el, key, newAttrs[key]);
  }

  // ── Remove attrs that disappeared ────────────────────────────────────────
  for (const key of Object.keys(oldAttrs)) {
    if (isHandler(key) || key === 'key') continue;
    if (!(key in newAttrs)) removeAttr(el, key);
  }
}

function isHandler(key) {
  // Matches onClick, onKeydown, onDblclick, onChange, onBlur, onFocus …
  return /^on[A-Z]/.test(key);
}

function handlerToEvent(key) {
  // 'onClick' → 'click', 'onKeydown' → 'keydown', 'onDblclick' → 'dblclick'
  return key[2].toLowerCase() + key.slice(3);
}

function setAttr(el, key, value) {
  if (key === 'class') {
    el.className = value ?? '';
  } else if (key === 'value') {
    // Only update if changed — prevents cursor-position jumping during typing
    if (el.value !== String(value ?? '')) el.value = value ?? '';
  } else if (key === 'checked') {
    el.checked = !!value;
  } else if (key === 'disabled') {
    el.disabled = !!value;
  } else if (key === 'autofocus') {
    if (value) el.setAttribute('autofocus', '');
    else el.removeAttribute('autofocus');
  } else if (key === 'for') {
    el.setAttribute('for', value);
  } else if (typeof value === 'boolean') {
    if (value) el.setAttribute(key, '');
    else el.removeAttribute(key);
  } else if (value === null || value === undefined) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, value);
  }
}

function removeAttr(el, key) {
  if (key === 'class') el.className = '';
  else if (key === 'value') el.value = '';
  else if (key === 'checked') el.checked = false;
  else if (key === 'disabled') el.disabled = false;
  else el.removeAttribute(key);
}

// ─── patch ────────────────────────────────────────────────────────────────────

/**
 * Diff oldVnode against newVnode and apply the minimal DOM mutations.
 *
 * @param {Element}      parent    - real DOM parent
 * @param {object|null}  oldVnode  - previously rendered vnode (null on first mount)
 * @param {object|null}  newVnode  - freshly computed vnode (null = remove)
 * @param {number}       index     - child index within parent
 */
export function patch(parent, oldVnode, newVnode, index = 0) {
  const existing = parent.childNodes[index];

  // CASE 1: nothing existed before → append
  if (!oldVnode) {
    if (newVnode) parent.appendChild(createElement(newVnode));
    return;
  }

  // CASE 2: node removed → delete
  if (!newVnode) {
    if (existing) parent.removeChild(existing);
    return;
  }

  // CASE 3: both text nodes
  if (oldVnode.type === 'text' && newVnode.type === 'text') {
    if (oldVnode.text !== newVnode.text) {
      existing.textContent = newVnode.text;
    }
    return;
  }

  // CASE 4: type mismatch or tag changed → replace entirely
  if (oldVnode.type !== newVnode.type || oldVnode.tag !== newVnode.tag) {
    parent.replaceChild(createElement(newVnode), existing);
    return;
  }

  // CASE 5: same element tag → update in place
  applyAttrs(existing, oldVnode.attrs, newVnode.attrs);
  patchChildren(existing, oldVnode.children, newVnode.children);
}

// ─── patchChildren — keyed diffing ───────────────────────────────────────────

/**
 * Reconcile a parent's children list using key-based diffing.
 * Keyed nodes are moved/reused by key; unkeyed nodes are recycled in order.
 */
function patchChildren(parent, oldChildren, newChildren) {
  // ── Step 1: snapshot old DOM refs BEFORE any mutations ───────────────────
  const keyedOld = new Map();   // key → { vnode, dom }
  const unkeyedOld = [];        // [ { vnode, dom } ]

  for (let i = 0; i < oldChildren.length; i++) {
    const child = oldChildren[i];
    const dom = parent.childNodes[i];
    if (child.key != null) {
      keyedOld.set(child.key, { vnode: child, dom });
    } else {
      unkeyedOld.push({ vnode: child, dom });
    }
  }

  // ── Step 2: build ordered list of new DOM nodes ──────────────────────────
  let unkeyedIdx = 0;
  const usedKeys = new Set();
  const newDomNodes = [];

  for (const newChild of newChildren) {
    if (newChild.key != null) {
      const old = keyedOld.get(newChild.key);
      if (old) {
        // Reuse existing node: patch attrs and recurse children
        patchNode(old.dom, old.vnode, newChild);
        newDomNodes.push(old.dom);
        usedKeys.add(newChild.key);
      } else {
        // New keyed node
        newDomNodes.push(createElement(newChild));
      }
    } else {
      const old = unkeyedOld[unkeyedIdx++];
      if (old) {
        patchNode(old.dom, old.vnode, newChild);
        newDomNodes.push(old.dom);
      } else {
        newDomNodes.push(createElement(newChild));
      }
    }
  }

  // ── Step 3: reorder / insert DOM nodes in the right order ────────────────
  for (let i = 0; i < newDomNodes.length; i++) {
    const node = newDomNodes[i];
    const current = parent.childNodes[i];
    if (current !== node) {
      parent.insertBefore(node, current ?? null);
    }
  }

  // ── Step 4: remove leftover old nodes ────────────────────────────────────
  for (const [key, { dom }] of keyedOld) {
    if (!usedKeys.has(key) && dom.parentNode === parent) {
      parent.removeChild(dom);
    }
  }
  for (let i = unkeyedIdx; i < unkeyedOld.length; i++) {
    const { dom } = unkeyedOld[i];
    if (dom.parentNode === parent) parent.removeChild(dom);
  }
}

/**
 * Patch one existing DOM node directly (we already have the reference).
 * Used inside patchChildren where index-based lookup would be wrong after moves.
 */
function patchNode(dom, oldVnode, newVnode) {
  if (oldVnode.type === 'text' && newVnode.type === 'text') {
    if (oldVnode.text !== newVnode.text) dom.textContent = newVnode.text;
    return;
  }
  if (oldVnode.type !== newVnode.type || oldVnode.tag !== newVnode.tag) {
    dom.parentNode.replaceChild(createElement(newVnode), dom);
    return;
  }
  // Same element tag
  applyAttrs(dom, oldVnode.attrs, newVnode.attrs);
  patchChildren(dom, oldVnode.children, newVnode.children);
}
