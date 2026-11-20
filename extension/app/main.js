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
  app.render();
  app.applyDensity();
  app.boot();
  services.logger.info('app', `MOE Motion AI ${services.version} starting${mode === 'kit' ? ' (Motion Kit panel)' : ''}`, plat.info);
  await app.reconnect();
  // v1.0 MOE Quick: the window IS the pie; a second "open" while it is up shows the pie again (CSXS event from the panels)
  if (mode === 'quick') {
    await app.showQuick();
    if (cs.addEventListener) cs.addEventListener(QUICK_EVENT, () => { if (!require('./ui/pie').isOpen()) app.showQuick(); });
    return app;
  }
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
