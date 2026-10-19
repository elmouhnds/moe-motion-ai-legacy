'use strict';
/**
 * Panel entry (runs in CEP mixed context: DOM + Node in one context).
 * Wires the Node platform and the CSInterface host bridge, then mounts the UI.
 */
const { createServices } = require('../core/services');
const { createApp } = require('./ui/shell');

/** Match AE's interface brightness: light token set when AE panels are light. */
function syncTheme(cs) {
  try {
    const c = cs.getHostEnvironment().appSkinInfo.panelBackgroundColor.color;
    const lum = (0.2126 * c.red + 0.7152 * c.green + 0.0722 * c.blue) / 255;
    document.documentElement.setAttribute('data-theme', lum > 0.5 ? 'light' : 'dark');
    if (lum <= 0.5) document.documentElement.style.setProperty('--bg', `rgb(${Math.round(c.red)}, ${Math.round(c.green)}, ${Math.round(c.blue)})`);
  } catch (e) { /* keep defaults */ }
}

async function start({ cs, root, platform, mount }) {
  const plat = platform || require('../core/platform/node').createNodePlatform();
  const services = createServices({ platform: plat, evalScript: (script, cb) => cs.evalScript(script, cb), rootPath: root });
  if (cs.getHostEnvironment) {
    syncTheme(cs);
    cs.addEventListener('com.adobe.csxs.events.ThemeColorChanged', () => syncTheme(cs));
  }
  const app = createApp(mount || document.getElementById('app'), services, { cs });
  app.render();
  app.applyDensity();
  services.logger.info('app', `MOE Motion AI ${services.version} starting`, plat.info);
  await app.reconnect();
  return app;
}

module.exports = { start };
