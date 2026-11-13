'use strict';
/**
 * Composition root: wires platform, host bridge, storage and features
 * into one services object. The UI receives only this object.
 */

const { Registry } = require('./registry');
const { createHostBridge } = require('./host/bridge');
const { createStore } = require('./storage');
const { createLogger } = require('./logger');
const { createSettings } = require('./settings');
const { createExecutor } = require('./executor');
const { createCostMonitor } = require('./ai/cost');
const { createClaudeClient } = require('./ai/client');
const planner = require('./ai/planner');
const assistant = require('./ai/assistant');
const { registerAll } = require('../features/index');
const recipes = require('../features/toolfactory/recipes');
const { createBrandStore } = require('../features/brand/brands');
const { createTextLibrary } = require('../features/text/library');
const { createSelector } = require('../features/select/service');

const VERSION = '0.93.0';

function createServices({ platform, evalScript, rootPath, hostTimeoutMs }) {
  const store = createStore(platform.fs);
  const logger = createLogger({ sink: (e) => { if (e.level !== 'info') store.append('diagnostics', e); } });
  const settings = createSettings(store);
  const registry = registerAll(new Registry());
  const host = createHostBridge({ evalScript, rootPath, logger, timeoutMs: hostTimeoutMs });
  const cost = createCostMonitor({ store, getSettings: settings.get });
  const ai = createClaudeClient({ http: platform.http, secrets: platform.secrets, cost, logger, getSettings: settings.get });

  const services = { version: VERSION, platform, store, logger, settings, registry, host, cost, ai };
  services.brands = createBrandStore(store);
  services.textLibrary = createTextLibrary({ store, fsa: platform.fs });
  services.selector = createSelector({ host, logger });
  services.executor = createExecutor({ registry, host, store, logger, getSettings: settings.get, services });
  services.recipes = recipes.createRecipeService({ store, registry, executor: services.executor });
  services.copilot = {
    plan: (request, ctx) => planner.createPlan({ ai, registry, request, ctx: Object.assign({}, ctx, {
      brands: services.brands.summary(),
      textPresets: services.textLibrary.all().map((p) => `${p.id} (${p.kind}, ${p.name}${p.arabicSafe ? ', arabic-safe' : ''})`)
    }) }),
    validate: (plan, ctx) => planner.validatePlan({ plan, registry, executor: services.executor, ctx }),
    run: (plan, onStep) => planner.runPlan({ plan, executor: services.executor, onStep }),
    rollback: (results) => planner.rollbackPlan({ results, executor: services.executor })
  };
  // v0.28: the floating assistant — answers questions and/or plans tool steps (same validation and approval as the Copilot)
  services.assistant = {
    ask: (request, ctx, history, format) => assistant.ask({ ai, registry, request, history, format, ctx: Object.assign({}, ctx, {
      brands: services.brands.summary(),
      textPresets: services.textLibrary.all().map((p) => `${p.id} (${p.kind}, ${p.name}${p.arabicSafe ? ', arabic-safe' : ''})`)
    }) }),
    validate: (plan, ctx) => planner.validatePlan({ plan, registry, executor: services.executor, ctx })
  };
  services.factory = {
    draft: (description) => recipes.draftRecipe({ ai, registry, description, catalogText: planner.catalogText })
  };
  services.favorites = {
    list: () => store.get('favorites', []),
    toggle: (id) => store.update('favorites', [], (f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
  };
  services.updater = require('./updater').createUpdater({ http: platform.http, system: platform.system || null, getSettings: settings.get, current: VERSION, logger, root: rootPath });
  services.presets = {
    list: (toolId) => store.get('presets', []).filter((p) => !toolId || p.toolId === toolId),
    save: (toolId, name, args, meta = {}) => store.update('presets', [], (all) => [...all, { id: meta.id || `pre_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, toolId, name, args, tile: meta.tile || null }]),
    exportPack: (opts) => require('./presetPacks').exportPack(store.get('presets', []), opts),
    importPack(text) {
      const r = require('./presetPacks').parsePack(text, services.registry);
      if (r.presets.length) store.update('presets', [], (all) => [...all, ...r.presets.map((p, i) => Object.assign({ id: `pre_${Date.now().toString(36)}${i}` }, p))]);
      return { ok: r.ok, imported: r.presets.length, skipped: r.skipped };
    },
    remove: (id) => store.update('presets', [], (all) => all.filter((p) => p.id !== id))
  };
  return services;
}

module.exports = { createServices, VERSION };
