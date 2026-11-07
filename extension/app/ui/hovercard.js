'use strict';
/**
 * Hover Cards (v0.67, docs/features/SMART_LAYER.md): rest the pointer on a one-click button (NOW, the Quick Bar, a
 * tab's actions and tiles) and its Tool Card appears: what it acts on, what it will write, what could surprise you,
 * how to undo it — or the one thing it needs. The same core/toolcard.card() as the library Inspector, so the two
 * never disagree. Pure UI: no host call; it is an overlay outside the morphed tree, so it never moves the layout.
 */
const TC = require('../../core/toolcard');
const { defaults } = require('../../core/schema');

const DELAY = 550; // a resting pointer, not a passing one
// data-key prefixes of one-click buttons whose rest is an action ref ('quick:…', 'tile:…' or a bare Quick Bar id)
const PREFIX = /^(a|qt|rc|gl|nx)-(.+)$/;

/** The action ref a button stands for, or null. */
function refOf(key) {
  const m = PREFIX.exec(String(key || ''));
  if (!m) return null;
  const rest = m[2];
  if (/^(quick|tile):/.test(rest)) return rest;
  return m[1] === 'qt' ? `quick:${rest}` : null;
}

/** The card for a ref on the current selection, or null when the button is not a tool run. */
function cardFor(app, ref) {
  const a = require('./actions').resolve(ref);
  if (!a || !a.tool) return null;
  const tool = app.services.registry.get(a.tool);
  if (!tool) return null;
  const args = Object.assign(defaults(tool.params || {}), a.args || {});
  return Object.assign(TC.card(tool, args, app.state.get().ctx, app.services), { label: a.label });
}

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

function build(c) {
  const box = el('div', 'hovercard');
  box.setAttribute('role', 'tooltip');
  box.appendChild(el('div', 'hc-title', c.label || c.name));
  if (c.purpose) box.appendChild(el('div', 'hc-purpose', c.purpose));
  if (c.ready) {
    if (c.target) box.appendChild(el('div', 'hc-on', `On ${c.target}`));
    const ul = el('ul', 'hc-list');
    c.writes.slice(0, 3).forEach((w) => ul.appendChild(el('li', '', w)));
    (c.warnings || []).forEach((w) => ul.appendChild(el('li', 'warn', w)));
    box.appendChild(ul);
    box.appendChild(el('div', 'hc-undo', c.undo));
  } else box.appendChild(el('div', 'hc-needs', c.needs));
  return box;
}

function install(app, root) {
  let timer = null, card = null, cur = null;
  const hide = () => { clearTimeout(timer); timer = null; cur = null; if (card) { card.remove(); card = null; } };
  const show = (target, ref) => {
    if (!document.body.contains(target)) return;
    const c = cardFor(app, ref);
    if (!c) return;
    card = build(c);
    document.body.appendChild(card);
    const r = target.getBoundingClientRect(), w = card.offsetWidth, hgt = card.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const below = r.bottom + 6 + hgt <= window.innerHeight - 8;
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(below ? r.bottom + 6 : Math.max(8, r.top - hgt - 6))}px`;
  };
  root.addEventListener('pointerover', (e) => {
    const t = e.target.closest && e.target.closest('[data-key]');
    if (t === cur) return;
    const ref = t ? refOf(t.getAttribute('data-key')) : null;
    hide();
    if (!ref || (app.services.settings.get().ui || {}).hoverCards === false) return;
    cur = t;
    timer = setTimeout(() => show(t, ref), DELAY);
  });
  root.addEventListener('pointerout', (e) => { if (cur && !(e.relatedTarget && cur.contains(e.relatedTarget))) hide(); });
  // a press, a scroll or a key means the user is acting: the card gets out of the way at once
  root.addEventListener('pointerdown', hide, true);
  root.addEventListener('wheel', hide, { passive: true, capture: true });
  root.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', hide, true);
  window.addEventListener('blur', hide);
  return { hide };
}

module.exports = { install, refOf, cardFor, DELAY };
