'use strict';
/**
 * Panel entry (runs in CEP mixed context: DOM + Node in one context).
 * Wires the Node platform and the CSInterface host bridge, then mounts the UI.
 */
const { createServices } = require('../core/services');
const { createApp } = require('./ui/shell');
const theme = require('./ui/theme');

async function start({ cs, root, platform, mount, ui }) {
  const plat = platform || require('../core/platform/node').createNodePlatform();
  const services = createServices({ platform: plat, evalScript: (script, cb) => cs.evalScript(script, cb), rootPath: root });
  // Appearance: follow AE's interface brightness unless the user picked a theme.
  if (cs.getHostEnvironment) {
    theme.readHost(cs);
    cs.addEventListener('com.adobe.csxs.events.ThemeColorChanged', () => { theme.readHost(cs); theme.apply(services.settings.get().ui); });
  }
  if (ui) services.settings.update({ ui }); // preview / tests: appearance overrides
  theme.apply(services.settings.get().ui);
  const app = createApp(mount || document.getElementById('app'), services, { cs });
  app.render();
  app.applyDensity();
  app.boot();
  services.logger.info('app', `MOE Motion AI ${services.version} starting`, plat.info);
  await app.reconnect();
  return app;
}

module.exports = { start };
