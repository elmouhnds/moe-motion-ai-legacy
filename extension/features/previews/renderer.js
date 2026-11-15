'use strict';
/**
 * Rendered previews (v0.96, docs/features/RENDERED_PREVIEWS.md — the owner: "every effect gets a real preview that
 * After Effects rendered, small, the size of the panel").
 *
 * For each library tile: a fresh "MOE Self-Test Preview" comp (480 × 270, 15 fps), a dark backdrop and the subject the
 * tool works on (a card, the words "MOE Motion", or three cards), the tool run with the tile's OWN args through the
 * executor exactly as a click would, the comp rendered by After Effects' Render Queue to a JPEG sequence in
 * <data>/previews/<key>/ (host op previews.render), the tool restored (its pre-comps go) and the comp removed.
 * One tile = several SHORT host calls, so Stop works between tiles; a tile that fails is skipped and named.
 *
 * The index (store doc "previews") remembers, per tile, the signature of what was rendered (tool, version, args,
 * RENDER_VERSION) — a tile whose tool or args changed is rendered again, never shown stale.
 */
const RENDER_VERSION = 1;
const SCENE = { width: 480, height: 270, fps: 15 };
const BG = [0.055, 0.063, 0.078];
const CARD = { size: [210, 118], roundness: 18, fill: [1, 0.416, 0.239] }; // MOE accent

/** What each tool needs in front of it. Tools not listed are not rendered yet (said so, never faked). */
const SUBJECT = {
  'quick.animate': 'card', 'quick.wipe': 'card', 'reveal.matte': 'card', 'reveal.fx': 'card', 'quick.depth': 'card', 'quick.shake': 'card',
  'design.style': 'card', 'interact.click': 'card', 'quick.trimPaths': 'outline', 'text.animate': 'text',
  'design.background': 'none', 'design.template': 'none', 'layout.carousel': 'cards', 'interact.clickFx': 'card'
};

function hash(s) { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) >>> 0; return x.toString(36); }
const keyOf = (tile) => `${tile.tool}-${tile.id}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').slice(0, 80);
const sigOf = (tool, tile) => hash(JSON.stringify([tool.id, tool.version, tile.args || {}, RENDER_VERSION]));
const durationOf = (tile) => Math.min(5, Math.max(2.4, ((tile.args && tile.args.duration) || 1) + 1.4));

/** The tiles that can be rendered, and why the others cannot. */
function plan(tiles, registry) {
  const ok = [], skip = [];
  for (const t of tiles) {
    const tool = registry.get(t.tool);
    if (!tool) skip.push({ tile: t, why: 'no such tool' });
    else if (!SUBJECT[t.tool]) skip.push({ tile: t, why: 'not rendered yet (no preview scene for this tool)' });
    else ok.push({ tile: t, tool, key: keyOf(t), sig: sigOf(tool, t) });
  }
  return { ok, skip };
}

async function subject(host, compId, kind) {
  const W = SCENE.width, H = SCENE.height;
  if (kind === 'none') return [];
  if (kind === 'text') {
    const r = await host.call('selftest.addText', { compId, text: 'MOE Motion', name: 'ST Title', fontSize: 64, justification: 'center', color: [1, 1, 1], position: [W / 2, H / 2 + 22] });
    return [r.layerId];
  }
  const card = (name, pos, size) => host.call('shapes.insert', { compId, name, label: 11, groupName: 'Card', primitive: { type: 'rect', size, roundness: CARD.roundness }, fill: { color: CARD.fill }, stroke: null, position: pos });
  if (kind === 'outline') {
    const r = await host.call('shapes.insert', { compId, name: 'ST Line', label: 11, groupName: 'Card', primitive: { type: 'rect', size: CARD.size, roundness: CARD.roundness }, fill: null, stroke: { color: CARD.fill, width: 6 }, position: [W / 2, H / 2] });
    return [r.layerId];
  }
  if (kind === 'cards') {
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await card(`ST Card ${i + 1}`, [W / 2 + (i - 1) * 130, H / 2], [110, 140])).layerId);
    return ids;
  }
  return [(await card('ST Card', [W / 2, H / 2], CARD.size)).layerId];
}

/**
 * Render the given tiles. opts: { onProgress(i, total, label), shouldStop() } → { rendered, failed, skipped, ms }.
 * Writes the index entry of every rendered tile as soon as it is done (a Stop keeps what is finished).
 */
async function renderTiles(services, tiles, opts = {}) {
  const started = Date.now();
  const { host, registry, executor, store } = services;
  const p = plan(tiles, registry);
  const out = { rendered: [], failed: [], skipped: p.skip.map((s) => ({ id: s.tile.id, label: s.tile.label, why: s.why })), ms: 0, stopped: false };
  const index = Object.assign({ v: RENDER_VERSION, items: {} }, store.get('previews', null) || {});
  for (let i = 0; i < p.ok.length; i++) {
    if (opts.shouldStop && opts.shouldStop()) { out.stopped = true; break; }
    const { tile, key, sig } = p.ok[i];
    if (opts.onProgress) opts.onProgress(i, p.ok.length, tile.label);
    if (!opts.force && index.items[key] && index.items[key].sig === sig && index.items[key].frames > 0) { out.rendered.push({ id: tile.id, key, cached: true }); continue; }
    const D = durationOf(tile);
    let begin = null, run = null;
    try {
      begin = await host.call('selftest.begin', { name: 'MOE Self-Test Preview', width: SCENE.width, height: SCENE.height, duration: D, frameRate: SCENE.fps });
      await host.call('layers.createSolid', { compId: begin.compId, name: 'ST Backdrop', color: BG });
      const ids = await subject(host, begin.compId, SUBJECT[tile.tool]);
      await host.call('layers.setSelection', { items: [{ compId: begin.compId, layerIds: ids, mode: 'set' }] });
      run = await executor.run(tile.tool, Object.assign({}, tile.args || {}), { origin: 'user', approved: true, batchId: `previews-${started}` });
      if (run.status !== 'success' && run.status !== 'partial') throw new Error((run.errors || []).join('; ') || run.status);
      const r = await host.call('previews.render', { compId: begin.compId, name: key, start: 0, duration: D });
      if (!r.frames) throw new Error('After Effects rendered no frames');
      index.items[key] = { sig, folder: r.folder, pattern: r.pattern, frames: r.frames, fps: SCENE.fps, w: SCENE.width, h: SCENE.height, dir: (tile.args && tile.args.dir) || 'in', at: new Date().toISOString() };
      store.set('previews', index);
      out.rendered.push({ id: tile.id, key, frames: r.frames });
    } catch (e) {
      out.failed.push({ id: tile.id, label: tile.label, why: String(e.message || e).slice(0, 300) });
      // v0.99.3 (side session: 208 render failures left no line in diagnostics.jsonl): every failed render is logged
      services.logger.warn('previews', `${tile.tool} ${tile.id}: render failed`, { code: e.code || 'RENDER_FAILED', message: String(e.message || e).slice(0, 300) });
    } finally {
      if (run && run.checkpointId) { try { await executor.restore(run.checkpointId); } catch (_) { /* the comp goes anyway */ } }
      if (begin) { try { await host.call('selftest.end', { compId: begin.compId, previousId: begin.previousId }); } catch (_) { /* reported by the next call */ } }
    }
  }
  out.ms = Date.now() - started;
  services.logger.info('previews', `rendered ${out.rendered.filter((x) => !x.cached).length} · cached ${out.rendered.filter((x) => x.cached).length} · failed ${out.failed.length} · skipped ${out.skipped.length}${out.stopped ? ' · stopped' : ''}`, { ms: out.ms });
  if (out.failed.length) services.logger.warn('previews', `${out.failed.length} preview render(s) failed`, { code: 'RENDER_FAILED', first: out.failed[0].why });
  return out;
}

module.exports = { renderTiles, plan, keyOf, sigOf, SUBJECT, SCENE, RENDER_VERSION };
