'use strict';
/**
 * Panel entry (runs in CEP mixed context: DOM + Node in one context).
 * Wires the Node platform and the CSInterface host bridge, then mounts the UI.
 */
const { createServices } = require('../core/services');
const { createApp } = require('./ui/shell');
const theme = require('./ui/theme');

const QUICK_EVENT = require('./quickLauncher').SHOW;

async function start({ cs, root, platform, mount, ui, mode }) {
  const plat = platform || require('../core/platform/node').createNodePlatform();
  const services = createServices({ platform: plat, evalScript: (script, cb) => cs.evalScript(script, cb), rootPath: root });
  // Appearance: follow AE's interface brightness unless the user picked a theme.
  if (cs.getHostEnvironment) {
    theme.readHost(cs);
    cs.addEventListener('com.adobe.csxs.events.ThemeColorChanged', () => { theme.readHost(cs); theme.apply(services.settings.get().ui); });
  }
  if (ui) services.settings.update({ ui }); // preview / tests: appearance overrides
  theme.apply(services.settings.get().ui);
  const app = createApp(mount || document.getElementById('app'), services, { cs, mode: mode || 'main' });
  /*
   * v1.0.2 MOE Quick: the window IS the pie, so the pie is the first thing painted — nothing else.
   *
   * It used to draw the whole panel shell, run the splash and the what's-new, and only then WAIT for the host to
   * load its ExtendScript before the pie appeared: a grey window sitting over After Effects for seconds, every
   * time. Nothing in that was needed. The selection comes from the panel that opened the window (quickLauncher
   * wrote it), the host connects behind the pie, and a pick awaits the host anyway — so it cannot be too early.
   */
  if (mode === 'quick') {
    /* The bare styling hangs off body.quick, because the pie's overlay is appended to document.body (ui/pie.js),
       not inside the shell's .app-quick div. quick.html already carries the class; the browser preview
       (dev/preview.html?mode=quick) does not, so quick mode sets it itself and both look the same. */
    try { document.documentElement.classList.add('quick'); document.body.classList.add('quick'); } catch (_) { /* no DOM */ }
    app.applyDensity();
    /*
     * After Effects owns this window completely. Measured in 26.5.3x9, all three were tried and none of them do
     * anything: --enable-transparent-visuals (the window stays opaque), window.resizeTo and window.moveTo. So the
     * page cannot make itself see-through, cannot resize and cannot place itself at the pointer. What is ours is
     * the manifest's size (330 x 344, hugging the wheel) and what is drawn inside.
     */
    /* v1.0.2: nothing around the tools (the owner). The frame and the title bar come off in hotkeyWin.js; the
       window's own rectangle goes here - the pie measures what it drew and the helper clips the window to it
       (core/platform/shapeWin.js). Only while the wheel is bare: with its frame on, the window keeps its shape. */
    const bare = ((services.settings.get().ui.pie || {}).bare) !== false;
    let shaper = null;
    try {
      shaper = require('../core/platform/shapeWin').start({
        spawn: require('child_process').spawn,
        onState: (st) => services.logger.info('quick', `window shape ${st.on ? 'on' : 'off'}${st.line ? `: ${st.line}` : ''}${st.reason ? `: ${st.reason}` : ''}`)
      });
      /* The window is exactly what this page draws, and nothing else — measured here, never assumed, because the
         drawing changes: the wheel, the search with its results, the toast a run leaves behind. Whatever is drawn
         at this moment is the window; when nothing is, the window is one pixel, because a shape that outlives its
         drawing is a row of empty black silhouettes sitting over After Effects (the owner saw exactly that). */
      const SHAPED = '.pie-slot, .pie-centre, .pie-x, .pie-res, .toast';
      const NOTHING = [{ x: 0, y: 0, w: 1, h: 1, r: 0 }];
      const drawn = () => {
        const d = window.devicePixelRatio || 1;
        const parts = [];
        document.querySelectorAll(SHAPED).forEach((el) => {
          const cs = window.getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
          const b = el.getBoundingClientRect();
          if (b.width < 2 || b.height < 2) return;
          const rad = parseFloat(cs.borderTopLeftRadius) || 0;
          // one pixel of air so an anti-aliased edge is not cut off
          parts.push({ x: (b.left - 1) * d, y: (b.top - 1) * d, w: (b.width + 2) * d, h: (b.height + 2) * d, r: Math.min(rad, b.width / 2, b.height / 2) * d });
        });
        return parts;
      };
      if (bare) app.quickShape = () => { const p = drawn(); shaper.set(p.length ? p : NOTHING); };
      else shaper.clear();  // it may still be wearing the shape of an earlier, bare, run
      if (typeof window !== 'undefined') window.addEventListener('beforeunload', () => shaper.stop());
    } catch (e) { services.logger.warn('quick', 'the window keeps its rectangle', { message: e.message }); }
    const QL = require('./quickLauncher');
    const handed = () => { try { const h = services.store.get(QL.QUICK_CTX, null); return h && Date.now() - h.at < 60000 ? h.ctx : null; } catch (_) { return null; } };
    const show = () => { const c = handed(); if (c) app.state.set({ ctx: c }); app.showQuick(); };
    show();
    services.logger.info('app', `MOE Quick ${services.version}`, plat.info);
    if (cs.addEventListener) cs.addEventListener(QUICK_EVENT, () => { if (!require('./ui/pie').isOpen()) show(); });
    // the host, behind the pie — and if it brings a different selection before the user has touched anything, redraw
    app.reconnect().then(() => { if (require('./ui/pie').untouched()) app.showQuick(); }).catch(() => { /* the pie says what is missing */ });
    return app;
  }
  app.render();
  app.applyDensity();
  app.boot();
  services.logger.info('app', `MOE Motion AI ${services.version} starting${mode === 'kit' ? ' (Motion Kit panel)' : ''}`, plat.info);
  await app.reconnect();
  // v1.0: the main panel opens MOE Quick for the global shortcut and for the "MOE Quick" script (quickLauncher.js)
  if (mode !== 'kit') require('./quickLauncher').attach(app, cs);
  // v0.99 Claude Test Bridge: back on after a reload the bridge itself was asked for (moe_deploy), never otherwise
  if (mode !== 'kit') {
    try {
      const r = services.store.get('bridge-resume', null);
      if (r && r.until > Date.now()) { services.store.set('bridge-resume', null); const b = require('./ui/views/diagnostics').bridgeOf(app); if (b) await b.start(); }
    } catch (e) { services.logger.warn('bridge', 'could not turn the bridge back on', { message: e.message }); }
  }
  return app;
}

module.exports = { start, QUICK_EVENT };
