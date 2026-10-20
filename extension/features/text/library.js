'use strict';
/** Text animation library: built-in presets + imported .ffx files (copied into the data folder). */
const { PRESETS } = require('./presets');
const ffx = require('./ffx');

function createTextLibrary({ store, fsa }) {
  const imported = () => store.get('text-presets', []);
  const dir = fsa.join(fsa.dataDir, 'presets');
  return {
    all: () => [...PRESETS, ...imported()],
    get(id) { return this.all().find((p) => p.id === id) || null; },
    /** Import an .ffx from bytes; returns the library entry (preview parsed locally). */
    importFfx(fileName, bytes) {
      let parsed;
      try { parsed = ffx.parse(bytes); } catch (e) { return { ok: false, errors: [e.message] }; }
      const id = `ffx_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const name = String(fileName).replace(/\.ffx$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 50) || 'Imported preset';
      const preview = ffx.toPreset(parsed, { id, name });
      const path = fsa.join(dir, `${id}.ffx`);
      fsa.writeBytes(path, bytes);
      const entry = Object.assign(preview || { id, name, group: 'Imported', kind: /out/i.test(name) ? 'out' : 'in', props: {}, previewOnly: true, arabicSafe: false },
        { source: 'ffx', path, fileName, animators: parsed.animators.length, warnings: parsed.warnings });
      store.update('text-presets', [], (all) => [...all, entry]);
      return { ok: true, preset: entry };
    },
    remove(id) {
      const p = imported().find((x) => x.id === id);
      if (p && p.path) { try { fsa.remove(p.path); } catch (e) { /* ignore */ } }
      store.update('text-presets', [], (all) => all.filter((x) => x.id !== id));
    }
  };
}

module.exports = { createTextLibrary };
