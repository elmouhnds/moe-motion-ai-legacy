'use strict';
/**
 * Carousel 3D (v0.63, docs/features/WIPE_CAROUSEL.md): the selected cards on a 3D ring around one null that turns a
 * card at a time — hold, turn, hold — with the cards at the back fading. Everything is native: a 3D null with Y
 * Rotation keys, the cards made 3D and parented to it at their ring positions, Opacity keys for depth. The radius is
 * the smallest that keeps neighbours apart (After Effects measures the widest card). Restore puts every card back.
 */
const P = require('./plan');
const { plan: PLAN1 } = require('../../core/host/plan'); // v0.94 one Ctrl+Z per run
const ADDR = (id, mn) => ({ layerId: id, matchNames: ['ADBE Transform Group', mn] });

const carousel = {
  id: 'layout.carousel', version: '1.0.0', category: 'layout', group: 'Layout · Arrange', name: 'Carousel 3D',
  description: 'Put the selected cards on a 3D ring that turns one card at a time — hold, turn, hold — with the back cards fading. A 3D null with keys (no expressions); the ring is just wide enough that cards never overlap.',
  keywords: ['carousel', '3d', 'ring', 'rotate', 'cards', 'gallery', 'slider', 'product', 'showcase', 'كاروسيل', 'دوار'],
  icon: 'refresh',
  params: {
    turn: { type: 'number', label: 'Turn', min: 0.1, max: 5, step: 0.05, default: 0.7, unit: 's', description: 'Time for one card to come to the front' },
    hold: { type: 'number', label: 'Hold', min: 0, max: 20, step: 0.1, default: 1.2, unit: 's', description: 'How long each card stays in front' },
    steps: { type: 'integer', label: 'Turns', min: 0, max: 200, default: 0, description: '0 = one full loop (one turn per card)' },
    gap: { type: 'number', label: 'Gap', min: 0, max: 2000, step: 5, default: 60, unit: 'px', description: 'Space between neighbouring cards' },
    depth: { type: 'number', label: 'Depth fade', min: 0, max: 100, step: 1, default: 60, unit: '%', description: 'How much the back cards fade' },
    tilt: { type: 'number', label: 'Tilt', min: -45, max: 45, step: 1, default: 0, unit: '°', advanced: true, description: 'Lean the ring toward the camera (X Rotation of the null)' },
    reverse: { type: 'boolean', label: 'Turn the other way', default: false, advanced: true }
  },
  requires: { comp: true, minLayers: 3 },
  permissions: ['modify.layers', 'modify.keyframes'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Arrange 3–24 selected layers on a 3D carousel that steps one card at a time (turn / hold seconds, depth fade %).' },
  uses: { hostOps: ['layers.describe', 'layers.bounds', 'layers.createNull', 'layers.setAttrs', 'layers.setParent', 'props.setValues', 'keys.write', 'keys.remove', 'layers.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Build Carousel' },
  prepare(args, ctx) {
    const l = (ctx.layers || []).filter((x) => !['camera', 'light', 'audio'].includes(x.type) && !/^MOE Carousel/.test(x.name));
    if (l.length < P.LIMITS.cards[0]) return { ok: false, error: `Select at least ${P.LIMITS.cards[0]} cards` };
    if (l.length > P.LIMITS.cards[1]) return { ok: false, error: `At most ${P.LIMITS.cards[1]} cards on one ring` };
    return { ok: true, cards: l, preview: { summary: `${l.length} cards on a ring · turn ${args.turn}s · hold ${args.hold}s`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, cards = prepared.cards, n = cards.length, fd = comp.frameDuration || 1 / 25;
    const desc = await host.call('layers.describe', { compId: comp.id });
    const parented = cards.filter((c) => (desc.layers.find((x) => x.id === c.id) || {}).parentId);
    if (parented.length) throw new Error(`${parented.map((c) => c.name).join(', ')} ${parented.length > 1 ? 'are' : 'is'} parented — unparent first (the ring becomes their parent)`);
    // After Effects measures the cards: the widest sets the radius, their centre sets where the ring stands
    const m = await host.call('layers.bounds', { compId: comp.id, layerIds: cards.map((c) => c.id), times: [comp.time] });
    const boxes = m.layers.map((x) => x.boxes[0]).filter(Boolean);
    const maxW = Math.max(10, ...boxes.map((b) => b[2] - b[0]));
    const cx = boxes.reduce((s, b) => s + (b[0] + b[2]) / 2, 0) / boxes.length, cy = boxes.reduce((s, b) => s + (b[1] + b[3]) / 2, 0) / boxes.length;
    const R = P.radius(n, maxW, args.gap), ring = P.ring(n, R);
    const used = new Set((desc.layers || []).map((l) => l.name));
    let k = 1; while (used.has(`MOE Carousel ${k}`)) k++;
    // v0.94 (docs/features/ONE_UNDO.md): the null, the 3D switch, parenting, the ring and the keys in ONE host call
    const T = PLAN1(host, 'MOE: Carousel');
    const nulRef = T.add('layers.createNull', { compId: comp.id, name: `MOE Carousel ${k}`, position: [cx, cy], threeD: true, undoLabel: 'MOE: Carousel' });
    const flat = cards.filter((c) => !c.threeD);
    const made3DRef = flat.length ? T.add('layers.setAttrs', { compId: comp.id, label: 'MOE: Carousel', items: flat.map((c) => ({ layerId: c.id, threeDLayer: true })) }) : null;
    const parRef = T.add('layers.setParent', { compId: comp.id, label: 'MOE: Carousel', items: cards.map((c) => ({ layerId: c.id, parentId: nulRef.at('layerId') })) });
    // the ring, in the null's own space (its anchor is the ring's centre)
    const setRef = T.add('props.setValues', { compId: comp.id, label: 'MOE: Carousel', items: cards.flatMap((c, i) => [
      { address: ADDR(c.id, 'ADBE Position'), value: ring[i].position },
      { address: ADDR(c.id, 'ADBE Rotate Y'), value: ring[i].rotY }
    ]).concat(args.tilt ? [{ address: ADDR(nulRef.at('layerId'), 'ADBE Rotate X'), value: -args.tilt }] : []) });
    const turnKeys = P.steps(n, { time: comp.time, turn: args.turn, hold: args.hold, steps: args.steps, reverse: args.reverse, fd });
    const items = [{ address: ADDR(nulRef.at('layerId'), 'ADBE Rotate Y'), keys: turnKeys }];
    if (args.depth > 0) {
      // each card's opacity at every key time, from its angle on the ring at that moment (native keys, eased alike)
      cards.forEach((c, i) => items.push({ address: ADDR(c.id, 'ADBE Opacity'), keys: turnKeys.map((t) => Object.assign({ t: t.t, v: Math.round(P.depth(ring[i].theta, t.v, args.depth) * 100) / 100 }, P.EASE)) }));
    }
    const keysRef = T.add('keys.write', { compId: comp.id, label: 'MOE: Carousel', items });
    try {
      await T.commit();
    } catch (e) {
      // nothing half-made stays: unparenting first (with jump), then the null goes — still the same undo step for the rest
      const nv = nulRef.value(), pv = parRef.value();
      if (pv) await host.call('layers.setParent', { compId: comp.id, label: 'MOE: Carousel', items: pv.layers.map((x) => ({ layerId: x.layerId, parentId: x.before })) }).catch(() => {});
      if (nv && nv.layerId) await host.call('layers.remove', { compId: comp.id, layerIds: [nv.layerId], onlyNamed: 'MOE Carousel' }).catch(() => {});
      throw e;
    }
    const nul = nulRef.value(), made3D = made3DRef ? made3DRef.value() : null, par = parRef.value(), set = setRef.value(), keys = keysRef.value();

    return { nullId: nul.layerId, name: `MOE Carousel ${k}`, R, maxW, n, made3D, par, set, keys, turnKeys };
  },
  verify({ result }) {
    const c = [{ ok: true, label: result.name, detail: `${result.n} cards · radius ${Math.round(result.R)} px (widest card ${Math.round(result.maxW)} px)` }];
    const bad = result.set.items.filter((x) => x.skipped);
    c.push({ ok: !bad.length, label: 'Ring', detail: bad.length ? `${bad.length} value(s) not set` : `${result.n} cards placed and facing out` });
    const rot = result.keys.items[0];
    c.push({ ok: rot.written.length === result.turnKeys.length, label: `${result.name} › Y Rotation`, detail: `${rot.written.length} keys, last ${rot.written[rot.written.length - 1].value}° at ${rot.written[rot.written.length - 1].t.toFixed(2)} s` });
    if (result.keys.items.length > 1) c.push({ ok: result.keys.items.slice(1).every((it) => it.written.length >= 2), label: 'Depth fade', detail: `${result.keys.items.length - 1} cards keyed` });
    return { ok: c.every((x) => x.ok), checks: c };
  },
  checkpoint({ result, ctx }) {
    return {
      compId: ctx.comp.id, nullId: result.nullId,
      // in reverse: values back (in the null's space), unparent with jump (back to their world place), 2D again, keys off
      values: result.set.items.filter((x) => !x.skipped && x.address.layerId !== result.nullId).map((x) => ({ address: x.address, value: x.before })),
      parents: result.par.layers.map((x) => ({ layerId: x.layerId, parentId: x.before })),
      flat: result.made3D ? result.made3D.layers.map((x) => x.layerId) : [],
      keys: result.keys.items.slice(1).map((it) => ({ address: it.address, times: it.written.map((w) => w.t), restore: it.replaced }))
    };
  },
  async restore({ data, host }) {
    const T = PLAN1(host, 'MOE: Restore');
    if (data.keys.length) T.add('keys.remove', { compId: data.compId, items: data.keys });
    T.add('props.setValues', { compId: data.compId, label: 'MOE: Restore', items: data.values });
    T.add('layers.setParent', { compId: data.compId, label: 'MOE: Restore', items: data.parents });
    if (data.flat.length) T.add('layers.setAttrs', { compId: data.compId, label: 'MOE: Restore', items: data.flat.map((id) => ({ layerId: id, threeDLayer: false })) });
    const r = T.add('layers.remove', { compId: data.compId, layerIds: [data.nullId], onlyNamed: 'MOE Carousel' });
    await T.commit();
    return r.value();
  },
  summarize(result) { return `${result.name}: ${result.n} cards, radius ${Math.round(result.R)} px`; }
};

module.exports = { carousel };
