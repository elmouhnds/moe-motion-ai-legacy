'use strict';
/**
 * v0.98.2 Tile Test (docs/features/TILE_TEST.md) — the owner, after the first real After Effects report: "the plugin is
 * full of problems; find a way to test it yourself". Every library tile runs INSIDE After Effects, the way a click
 * runs it, and the report says for each one what really happened:
 *
 *   1. a fresh "MOE Self-Test Tiles" comp (1920 × 1080, 25 fps) with the tile's subject (a card with two Position keys,
 *      the words "MOE Motion", or three cards), the subject selected;
 *   2. the tool run with the tile's OWN args through the executor (status, errors, time);
 *   3. Edit > Undo pressed through After Effects' own menu (by its text, "Undo MOE: …") until the comp and the project
 *      are back to how they were — the number of presses is the real number of Ctrl+Z the run needs;
 *   4. if Undo could not bring it back: the checkpoint restore, and what was still left is named;
 *   5. the comp removed (selftest.end) — whatever happened.
 *
 * One tile = several SHORT host calls, so Stop works between tiles. Nothing touches the user's comps: the test comp is
 * the active one while it runs and the user's comp is reopened at the end.
 */
const SCENE = { width: 1920, height: 1080, fps: 25, duration: 6 };
const CARD = { size: [420, 240], roundness: 36, fill: [1, 0.416, 0.239] };
const MAX_UNDO = 4;

const KEYED = /^(motion\.smartEase|motion\.easeCurve|motion\.pasteEase|motion\.retime|motion\.copyMotion|quick\.reverseKeys|quick\.mirrorKeys|expressions\.quick|kit\.interp|kit\.trimToKeys)$/;
const ON_GRID = /^(grid\.colour|grid\.tracer|grid\.controls|grid\.effector|grid\.update|grid\.items|grid\.remove|grid\.trail|rig\.bake)$/;
const ON_EFFECTOR = /^(grid\.effectorControls|grid\.effectorFreeze|grid\.effectorRemove)$/;

/** What a tool needs in front of it. */
function subjectOf(tile) {
  const id = tile.tool, a = tile.args || {};
  if (ON_EFFECTOR.test(id)) return 'effector';
  if (ON_GRID.test(id)) return 'grid';
  if (KEYED.test(id)) return 'keys';
  if (/^(design\.background|design\.template|grid\.guides|grid\.guidePreset)$/.test(id)) return 'none';
  if (/^text\./.test(id) || /^(quick\.typewriter|brand\.applyFont)$/.test(id) || (id === 'grid.build' && a.splitText && a.splitText !== 'none')) return 'text';
  if (id === 'quick.trimPaths') return 'outline';
  if ((id === 'grid.build' && !a.clones) || /^(layout\.carousel|transform\.align|motion\.stagger|grid\.placeInCells)$/.test(id)) return 'cards';
  return 'card';
}

const findName = async (host, compId, re) => { const d = await host.call('layers.describe', { compId }); const L = d.layers.find((l) => re.test(l.name)); return L ? L.id : null; };

async function subject(services, compId, kind) {
  const { host, executor } = services;
  const W = SCENE.width, H = SCENE.height;
  if (kind === 'none') return [];
  if (kind === 'grid' || kind === 'effector') {
    // a real 3 × 2 grid of cards, built by Grid Builder (and an effector on it) — what the user has before these tools
    const ids = [];
    for (let i = 0; i < 6; i++) ids.push((await host.call('shapes.insert', { compId, name: `ST Card ${i + 1}`, label: 11, groupName: 'Card', primitive: { type: 'rect', size: [200, 200], roundness: 24 }, fill: { color: CARD.fill }, stroke: null, position: [W / 2 + (i % 3 - 1) * 260, H / 2 + (Math.floor(i / 3) - 0.5) * 260] })).layerId);
    await host.call('layers.setSelection', { items: [{ compId, layerIds: ids, mode: 'set' }] });
    const g = await executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 260, spacingY: 260 }, { origin: 'user', approved: true });
    if (g.status !== 'success') throw new Error(`setting up the grid failed: ${(g.errors || []).join('; ') || g.status}`);
    const grid = await findName(host, compId, /^MOE Grid \d+$/);
    await host.call('layers.setSelection', { items: [{ compId, layerIds: [grid], mode: 'set' }] });
    if (kind === 'grid') return [grid];
    const e = await executor.run('grid.effector', { type: 'plain', falloff: 'sphere' }, { origin: 'user', approved: true });
    if (e.status !== 'success') throw new Error(`setting up the effector failed: ${(e.errors || []).join('; ') || e.status}`);
    return [await findName(host, compId, /^MOE Effector \d+$/)];
  }
  if (kind === 'text') {
    const r = await host.call('selftest.addText', { compId, text: 'MOE Motion', name: 'ST Title', fontSize: 140, justification: 'center', color: [1, 1, 1], position: [W / 2, H / 2 + 50] });
    return [r.layerId];
  }
  const card = (name, pos, size, stroke) => host.call('shapes.insert', { compId, name, label: 11, groupName: 'Card', primitive: { type: 'rect', size, roundness: CARD.roundness }, fill: stroke ? null : { color: CARD.fill }, stroke: stroke ? { color: CARD.fill, width: 12 } : null, position: pos });
  if (kind === 'outline') return [(await card('ST Line', [W / 2, H / 2], CARD.size, true)).layerId];
  if (kind === 'cards') {
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await card(`ST Card ${i + 1}`, [W / 2 + (i - 1) * 300, H / 2], [240, 300])).layerId);
    return ids;
  }
  const id = (await card('ST Card', [W / 2, H / 2], CARD.size)).layerId;
  // two Position keys, so the tools that work on keys (ease, retime, copy motion…) have something to act on
  await host.call('keys.write', { compId, label: 'MOE: Tile Test Keys', items: [{ address: { layerId: id, matchNames: ['ADBE Transform Group', 'ADBE Position'] }, keys: [{ t: 0.4, v: [W / 2 - 300, H / 2] }, { t: 1.6, v: [W / 2, H / 2] }] }] });
  return [id];
}

/** Select the subject the way the user would (layers; Position too for the tools that work on keys). */
async function selectSubject(host, compId, kind, ids) {
  if (!ids.length) return;
  if (kind === 'grid') return; // already selected while it was built
  await host.call('layers.setSelection', { items: [{ compId, layerIds: ids, mode: 'set' }] });
  if (kind === 'keys') await host.call('selftest.selectProp', { compId, layerId: ids[0], matchNames: ['ADBE Transform Group', 'ADBE Position'] });
}

const same = (a, b) => a.layers === b.layers && a.items === b.items && a.names.join('\n') === b.names.join('\n');
function leftover(base, now) {
  const was = new Set(base.names), extra = now.names.filter((n) => !was.has(n)), gone = base.names.filter((n) => !now.names.includes(n));
  const parts = [];
  if (extra.length) parts.push(`layers left: ${extra.slice(0, 6).join(', ')}${extra.length > 6 ? ` +${extra.length - 6}` : ''}`);
  if (gone.length) parts.push(`layers missing: ${gone.slice(0, 6).join(', ')}`);
  if (now.items !== base.items) parts.push(`project items ${base.items} → ${now.items}`);
  return parts.join('; ') || 'changed';
}

/**
 * Run tiles in After Effects. tiles: [{ section, id, label, tool, args }].
 * opts: { onProgress(i, total, label), shouldStop() } → report { tiles: [...], totals, ms, stopped }.
 * Each row: { tile, label, tool, status: pass|fail|skip, ms, undo: { presses, back, labels }, detail }.
 */
async function runTiles(services, tiles, opts = {}) {
  const started = Date.now();
  const { host, registry, executor } = services;
  const report = { moe: services.version, startedAt: new Date(started).toISOString(), tiles: [], stopped: false };
  try { const info = await host.call('host.ping', {}); report.ae = { appVersion: info.appVersion, os: info.os }; } catch (e) { report.ae = {}; }
  for (let i = 0; i < tiles.length; i++) {
    if (opts.shouldStop && opts.shouldStop()) { report.stopped = true; break; }
    const tile = tiles[i];
    if (opts.onProgress) opts.onProgress(i, tiles.length, tile.label);
    const row = { tile: `${tile.section}/${tile.id}`, label: tile.label, tool: tile.tool, status: 'fail', ms: 0, detail: '' };
    const tool = registry.get(tile.tool);
    if (!tool) { report.tiles.push(Object.assign(row, { status: 'fail', detail: 'no such tool' })); continue; }
    let begin = null, run = null;
    const s = Date.now();
    try {
      begin = await host.call('selftest.begin', { name: 'MOE Self-Test Tiles', width: SCENE.width, height: SCENE.height, duration: SCENE.duration, frameRate: SCENE.fps });
      const kind = tile.subject || subjectOf(tile);
      const ids = await subject(services, begin.compId, kind);
      await selectSubject(host, begin.compId, kind, ids);
      const base = await host.call('selftest.census', { compId: begin.compId });
      await host.call('selftest.resetUndoLabels', {});
      const args = Object.assign({}, Object.fromEntries(Object.entries(tool.params || {}).filter(([, p]) => p.default !== undefined).map(([k, p]) => [k, p.default])), tile.args || {});
      run = await executor.run(tile.tool, args, { origin: 'user', approved: true, batchId: `tiletest-${started}` });
      row.ms = Date.now() - s;
      row.result = run.status;
      if (run.status === 'needs' || run.status === 'blocked') {
        row.status = 'skip';
        row.detail = `not runnable on the test subject: ${(run.errors || []).join('; ') || run.status}`.slice(0, 400);
      } else if (run.status !== 'success' && run.status !== 'partial') {
        row.detail = ((run.errors || []).join('; ') || (run.verification ? run.verification.checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`).join('; ') : run.status)).slice(0, 600);
      } else {
        // v0.99 (Claude Test Bridge): After Effects renders the result BEFORE Undo, so the reviewer sees the real pixels
        if (opts.render) {
          try {
            const name = `review-${String(tile.id || tile.tool).toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`.slice(0, 80);
            const fr = await host.call('previews.render', { compId: begin.compId, name, start: opts.render.start || 0, duration: Math.min(SCENE.duration, opts.render.duration || 2.4) });
            row.frames = { folder: fr.folder, pattern: fr.pattern, count: fr.frames, fps: SCENE.fps };
          } catch (e) { row.frames = { error: String(e.message || e).slice(0, 200) }; }
        }
        // the owner's rule: one Ctrl+Z takes the whole run back — press Undo the way the user would and count
        const undo = { presses: 0, back: false, labels: [], menu: true };
        let now = await host.call('selftest.census', { compId: begin.compId });
        while (!same(base, now) && undo.presses < MAX_UNDO) {
          const u = await host.call('selftest.undoLast', {});
          if (!u.label) break;
          if (!u.found) { undo.menu = false; undo.labels.push(`${u.label} (not in the Edit menu)`); break; }
          undo.presses++; undo.labels.push(u.label);
          now = await host.call('selftest.census', { compId: begin.compId });
        }
        undo.back = same(base, now);
        row.undo = undo;
        if (undo.back) {
          row.status = undo.presses <= 1 ? 'pass' : 'fail';
          row.detail = undo.presses <= 1 ? `${run.summary || 'done'} · ${undo.presses ? 'one Ctrl+Z took it all back' : 'changed no layer'}` : `needs ${undo.presses} Ctrl+Z (${undo.labels.join(' › ')})`;
        } else if (!undo.menu) {
          row.status = 'pass';
          row.detail = `${run.summary || 'done'} · Undo not checked (this host has no Edit > Undo by name)`;
        } else {
          row.status = 'fail';
          row.detail = `Ctrl+Z did not bring it back after ${undo.presses}: ${leftover(base, now)}`;
        }
      }
    } catch (e) {
      row.ms = row.ms || Date.now() - s;
      row.detail = `threw: ${String(e.message || e)}`.slice(0, 600);
    } finally {
      if (run && run.checkpointId && !(row.undo && row.undo.back)) { try { await executor.restore(run.checkpointId); } catch (_) { /* the comp goes anyway */ } }
      if (begin) { try { await host.call('selftest.end', { compId: begin.compId, previousId: begin.previousId }); } catch (e) { row.detail += ` · cleanup: ${e.message}`; } }
    }
    // v0.99.1: a failed tile and a failed render are in the panel's log too (the Tile Test found them only in the job)
    if (row.status === 'fail') services.logger.warn('tiletest', `${row.tile} failed`, { tool: row.tool, detail: row.detail });
    if (row.frames && row.frames.error) services.logger.warn('tiletest', `${row.tile} render failed`, { detail: row.frames.error });
    report.tiles.push(row);
  }
  report.ms = Date.now() - started;
  report.totals = ['pass', 'fail', 'skip'].reduce((o, k) => Object.assign(o, { [k]: report.tiles.filter((t) => t.status === k).length }), {});
  return report;
}

/** Every library tile (from studio/sections), optionally one section. */
function libraryTiles(sections, sectionId) {
  const out = [];
  for (const s of sections.filter((x) => x.kind === 'library' && (!sectionId || x.id === sectionId))) for (const t of s.tiles || []) if (!t.needsInput) out.push(Object.assign({ section: s.id }, t));
  return out;
}

module.exports = { runTiles, libraryTiles, subjectOf, SCENE };
