'use strict';
/** Studio sections: every tile points at a registered tool with valid args; every visible tool has a home. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { Registry } = require('../extension/core/registry');
const { registerAll } = require('../extension/features/index');
const { validateArgs, defaults } = require('../extension/core/schema');
const S = require('../extension/app/ui/studio/sections');

const reg = registerAll(new Registry());

test('Studio: every tile is a registered tool with valid preset args', () => {
  for (const sec of S.SECTIONS.filter((x) => x.kind === 'library')) {
    assert.ok(sec.tiles.length > 0, sec.id);
    const ids = new Set();
    for (const t of sec.tiles) {
      assert.ok(!ids.has(t.id), `duplicate tile ${t.id}`); ids.add(t.id);
      const tool = reg.get(t.tool);
      assert.ok(tool, `${sec.id}/${t.id}: unknown tool ${t.tool}`);
      const v = validateArgs(tool.params || {}, Object.assign(defaults(tool.params || {}), t.args));
      // A required layer pick (e.g. Follow Zoom's target) is chosen in the Inspector, not by the tile.
      const layerPicks = Object.values(tool.params || {}).filter((p) => p.type === 'layer' && p.required).map((p) => `${p.label} is required`);
      // "Setup" tiles (look description, reference layer, file) leave required inputs to the Inspector.
      const userInputs = t.needsInput ? Object.values(tool.params || {}).filter((p) => p.required).map((p) => `${p.label} is required`) : [];
      const errs = v.errors.filter((e) => !layerPicks.includes(e) && !userInputs.includes(e));
      assert.deepEqual(errs, [], `${sec.id}/${t.id}`);
      assert.ok(t.thumb && t.thumb.k, `${t.id} needs a thumbnail recipe`);
      for (const tag of t.tags) assert.ok(sec.filters.includes(tag), `${t.id}: filter chip missing for tag ${tag}`);
    }
  }
});

test('Studio: every tool belongs to a section that exists in the sidebar', () => {
  const ids = new Set([...S.SECTIONS.map((x) => x.id), ...S.SECONDARY.map((x) => x.id)]);
  for (const t of reg.list()) assert.ok(ids.has(S.sectionOf(t)), `${t.id} → ${S.sectionOf(t)} has no sidebar entry`);
});

test('Studio: thumbnail recipes draw without throwing (canvas stub)', () => {
  const thumbs = require('../extension/app/ui/studio/thumbs');
  const noop = () => {};
  const grad = { addColorStop: noop };
  const c = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (k === 'createLinearGradient' ? () => grad : noop)), set: (o, k, v) => { o[k] = v; return true; } });
  for (const sec of S.SECTIONS.filter((x) => x.kind === 'library')) for (const t of sec.tiles) for (const time of [0, 0.7, 1.9]) thumbs.draw(c, 120, 74, t.thumb, time);
});
