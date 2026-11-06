'use strict';
/**
 * Relink (v0.62, docs/features/LINKS.md): after a layer that MOE expressions read is renamed (a Grid null, an
 * Effector, a Glass, a Trail source, a followed layer…), write the new name into every MOE-LINK — found by the
 * layer's permanent After Effects id, never by guessing. One undo step; Restore puts the expressions back.
 * The panel runs it by itself when it sees a rename (Settings › Engine › Relink after rename).
 */
const relink = {
  id: 'links.relink', version: '1.0.0', category: 'expressions', group: 'Expressions', name: 'Relink',
  description: 'After you rename a layer that MOE expressions read (a Grid null, an Effector, a Glass, a followed layer), write the new name into those expressions — found by the layer\'s permanent id, so nothing breaks.',
  keywords: ['relink', 'rename', 'broken', 'link', 'expression error', 'repair', 'fix', 'layer missing', 'إعادة ربط'],
  icon: 'link',
  params: {},
  requires: { comp: true },
  permissions: ['modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Repair MOE expressions after a renamed layer (finds the layer by its permanent id).' },
  uses: { hostOps: ['links.scan', 'links.relink', 'expressions.set'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Relink' },
  prepare(args, ctx) { return { ok: true, preview: { summary: `Relink MOE expressions in ${ctx.comp.name}`, items: [] } }; },
  async execute({ ctx, host }) {
    const scan = await host.call('links.scan', { compId: ctx.comp.id });
    if (!scan.renamed.length) return { scan, fixed: [], after: scan };
    const r = await host.call('links.relink', { compId: ctx.comp.id });
    return { scan, fixed: r.fixed, after: r.after };
  },
  verify({ result }) {
    const checks = result.scan.renamed.map((x) => ({ ok: !result.after.renamed.some((y) => y.id === x.id), label: `"${x.from}" → "${x.to}"`, detail: `${x.expressions} expression(s) relinked` }));
    if (!checks.length) checks.push({ ok: true, label: 'Links', detail: `${result.scan.links} link(s), none renamed` });
    for (const m of result.after.missing) checks.push({ ok: true, label: `"${m.name}"`, detail: 'that layer was deleted — its expressions are left as they are' });
    for (const f of result.fixed) if (f.error) checks.push({ ok: false, label: `${f.layerName} › ${f.name}`, detail: f.error });
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) {
    return result.fixed.length ? { compId: ctx.comp.id, items: result.fixed.map((f) => ({ address: f.address, expression: f.before })) } : null;
  },
  async restore({ data, host }) {
    return host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore', revertOnError: false, targets: data.items.map((x) => ({ address: x.address, expression: x.expression, enabled: true })) });
  },
  summarize(result) { return result.fixed.length ? `Relinked ${result.fixed.length} expression(s): ${result.scan.renamed.map((x) => `"${x.from}" → "${x.to}"`).join(', ')}` : 'All MOE links are up to date'; }
};

module.exports = { relink };
