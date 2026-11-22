'use strict';
/**
 * v1.0 Open MOE Quick from the After Effects window, not only from the panel (the owner's request).
 * The main panel stays the listener (CEP panels hear keys only while focused):
 *   1. a global shortcut (Windows, Settings › Pie menu, default Ctrl+Alt+Space) — core/platform/hotkeyWin.js;
 *   2. the script "MOE Quick.jsx" (File › Scripts, or a shortcut on it) sends the CSXS event REQUEST;
 * and either opens the floating MOE Quick window (CSInterface.requestOpenExtension), then tells it to show the pie.
 * Window › Extensions › MOE Quick opens the same window by hand.
 */
const QUICK_ID = 'tv.madtomato.moe.motionai.quick';
const PANEL_ID = 'tv.madtomato.moe.motionai.panel';
const REQUEST = 'tv.madtomato.moe.quick.request';
const SHOW = 'tv.madtomato.moe.quick.show';
/**
 * v1.0.2: the selection, handed from this panel to the MOE Quick window through the shared data folder.
 * MOE Quick is a second CEP window with its own everything, and reading the comp itself costs a host connection -
 * seconds of a grey window before the pie could know what is selected. This panel already knows, and it is the one
 * that opens the window, so it writes what it knows first and the pie is right on its first frame.
 */
const QUICK_CTX = 'quick-ctx';

function openQuick(cs, app) {
  if (app) { try { app.services.store.set(QUICK_CTX, { at: Date.now(), ctx: app.state.get().ctx || null }); } catch (_) { /* the store is optional */ } }
  try { cs.requestOpenExtension(QUICK_ID, ''); } catch (_) { /* not in a panel */ }
  // already open: the window is not opened twice — ask it to show its pie again
  setTimeout(() => { try { const e = new CSEvent(SHOW, 'APPLICATION'); e.data = ''; cs.dispatchEvent(e); } catch (_) { /* preview */ } }, 350);
}

/**
 * v1.0.2: the shortcut's other home — the pie in THIS panel, with no second window at all.
 * Nothing to open and nothing to boot, so it is as fast as the panel is. Two costs, both measured in After
 * Effects 26.5.3x9: it appears where the panel is docked, not over the timeline, and requestOpenExtension on an
 * already-open panel does NOT hand it the keyboard — typing after the shortcut still goes to After Effects. So
 * this mode is picked with the mouse (which works), and the search box and 1-8 need one click on the panel first.
 */
function openInPanel(cs, app) {
  try { cs.requestOpenExtension(PANEL_ID, ''); } catch (_) { /* not in a panel */ }
  const P = require('./ui/pie');
  if (P.isOpen()) P.close();
  const w = (typeof window !== 'undefined' && window.innerWidth) || 360;
  const hgt = (typeof window !== 'undefined' && window.innerHeight) || 620;
  app.openPie(w / 2, hgt / 2);
}

/** Where the global shortcut puts the pie: its own small window (default), or this panel. */
function openFor(cs, app) {
  const where = ((app.services.settings.get().ui.pie || {}).globalTarget) || 'window';
  if (where === 'panel') openInPanel(cs, app); else openQuick(cs, app);
}

function attach(app, cs, deps = {}) {
  const services = app.services;
  if (!cs || !cs.requestOpenExtension) return { stop() {} };
  if (cs.addEventListener) cs.addEventListener(REQUEST, () => openQuick(cs, app));
  let hk = { stop() {} };
  const apply = () => {
    hk.stop();
    const combo = ((services.settings.get().ui.pie || {}).globalKey) || 'ctrl+alt+space';
    hk = require('../core/platform/hotkeyWin').start({
      combo, spawn: deps.spawn || require('child_process').spawn,
      // v1.0.2: bare = no frame, no title bar, no background — only the wheel and its search float over After
      // Effects. The helper does it from outside (the page cannot), so it is a switch here, not a stylesheet.
      bare: ((services.settings.get().ui.pie || {}).bare) !== false,
      onKey: () => openFor(cs, app),
      // v1.0.2: the helper answers a second or two after the page drew Settings, so the line there ("Listening: …" /
      // "Not listening: …") kept the state it had at render time — it read "Not listening: stopped." while the
      // shortcut was working. The state belongs on screen the moment it changes.
      onState: (st) => { app.quickKey = st; services.logger.info('quick', `global shortcut ${st.on ? `on (${st.label})` : `off: ${st.reason}`}`); if (app.scheduleRender) app.scheduleRender(); }
    });
  };
  apply();
  app.applyQuickKey = apply;
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', () => hk.stop());
  return { stop: () => hk.stop() };
}

module.exports = { attach, openQuick, openInPanel, openFor, QUICK_ID, PANEL_ID, REQUEST, SHOW, QUICK_CTX };
