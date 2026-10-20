'use strict';
/** Tiny DOM helpers. No framework: views re-render small subtrees on state change. */

const ICONS = {
  motion: '<path d="M2 12c3 0 4-8 7-8s3 4 5 4"/><circle cx="2" cy="12" r="0.6"/>',
  ease: '<path d="M2 13C7 13 9 3 14 3"/><path d="M2 13h3M11 3h3" opacity=".5"/>',
  stagger: '<path d="M2 4h6M4 8h6M6 12h6"/>',
  code: '<path d="M6 4L2 8l4 4M10 4l4 4-4 4"/>',
  expr: '<path d="M5 3C3 3 4 8 2 8c2 0 1 5 3 5M11 3c2 0 1 5 3 5-2 0-1 5-3 5"/>',
  tools: '<path d="M9.5 2.5a3 3 0 0 0-3.6 3.9L2.5 9.8a1.2 1.2 0 0 0 1.7 1.7l3.4-3.4a3 3 0 0 0 3.9-3.6L9.8 6.2 8.6 5 10.3 3.3z"/>',
  check: '<path d="M3 8.5l3 3 7-7"/>',
  x: '<path d="M4 4l8 8M12 4l-8 8"/>',
  search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>',
  trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/>',
  spark: '<path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l1.8 1.8M10.2 10.2L12 12M12 4l-1.8 1.8M5.8 10.2L4 12"/>',
  star: '<path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4L2.2 6.5l4-.6z"/>',
  history: '<path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9"/><path d="M2.5 2.5v2.2h2.2M8 5v3l2 1.5"/>',
  gear: '<circle cx="8" cy="8" r="2"/><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1"/>',
  pulse: '<path d="M1.5 8h3l1.5-4 2.5 8 1.5-4h4.5"/>',
  refresh: '<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5V5h-2.5"/>',
  chev: '<path d="M6 4l4 4-4 4"/>',
  undo: '<path d="M5 3L2 6l3 3"/><path d="M2 6h7a4 4 0 0 1 0 8H6"/>',
  play: '<path d="M5 3.5l7 4.5-7 4.5z"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  copy: '<rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V3h8"/>',
  save: '<path d="M3 3h8l2 2v8H3z"/><path d="M5 3v3h5V3M5 13V9h6v4"/>',
  grade: '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11" /><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" stroke="none" opacity=".55"/>',
  key: '<path d="M8 2s4 4.3 4 7.2A4 4 0 0 1 4 9.2C4 6.3 8 2 8 2z"/><path d="M6.3 9.8a1.8 1.8 0 0 0 1.7 1.6"/>',
  brand: '<path d="M8 2a6 6 0 1 0 0 12c1 0 1.4-.8 1-1.6-.4-.9.2-1.9 1.2-1.9H12a2 2 0 0 0 2-2A6 6 0 0 0 8 2z"/><circle cx="5" cy="7" r=".8"/><circle cx="8" cy="5" r=".8"/><circle cx="11" cy="7" r=".8"/>',
  type: '<path d="M3 4V3h10v1M8 3v10M6 13h4"/>',
  target: '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15"/>',
  cursor: '<path d="M3 2l9 5-4 1-1 4z"/><path d="M8.5 9.5L12 13"/>',
  eye: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
  solo: '<path d="M3 9a5 5 0 0 1 10 0v3h-2.5V9M3 12h2.5V9"/>',
  shy: '<path d="M3 8c2-3 8-3 10 0M5 10l-1 2M8 10.5v2M11 10l1 2"/>',
  upload: '<path d="M8 11V3M5 6l3-3 3 3M3 13h10"/>',
  edit: '<path d="M10.5 2.5l3 3L6 13H3v-3z"/>',
  layers: '<path d="M8 2l6 3-6 3-6-3z"/><path d="M2 8l6 3 6-3M2 11l6 3 6-3" opacity=".6"/>'
};

Object.assign(ICONS, require('./icons2'));

function icon(name, cls) {
  const span = document.createElement('span');
  span.innerHTML = `<svg class="svg-i ${cls || ''}" viewBox="0 0 16 16" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return span.firstChild;
}

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

function relTime(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

module.exports = { h, icon, clear, append, relTime, ICONS };
