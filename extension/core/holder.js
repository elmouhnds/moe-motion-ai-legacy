'use strict';
/**
 * One holder per run (v0.99.7, the owner's rule).
 *
 * A tool that builds more than one layer must leave the user ONE thing that holds the whole set: it carries the
 * run's controls in Effect Controls, and — wherever parenting is correct — it is the parent, so moving or scaling
 * it moves the whole set. Before this, every tool wrote that by hand: `fxTool.js` and `clickFxTool.js` carried the
 * same controller block almost character for character, Glass and Thick Glass had no holder at all, and the controls
 * nulls that did exist were not parents, so moving one moved nothing.
 *
 * THREE SHAPES, picked by what the tool builds — not one rule for everything:
 *   'comp'   a production the user treats as one object (a template, a UI piece). Built with comps.create /
 *            comps.place; this module does not build it, it only names and fills its controls.
 *   'parent' parts that belong to a set and must travel together (Glass, Click VFX, a grid). The holder is the
 *            parent. Use `nullArgs` so the null is created AT IDENTITY, or the parts jump (see below).
 *   'linked' parts that must stay in the user's own layer's space — a track matte must not drift away from what it
 *            mattes (Matte FX, Matte Reveal, Trail). The holder owns the controls only; the parts are parented to
 *            the source and read the holder through expressions.
 *
 * AFTER EFFECTS FACTS THIS ENCODES (read in the host ops, not assumed):
 *  - `layers.setParent` uses setParentWithJump: NO compensation. A child keeps its own transform values, so if the
 *    parent's transform is not identity the child jumps by the parent's offset.
 *  - `comp.layers.addNull` leaves the anchor at [0, 0] while the position is set elsewhere, so a null is NOT at
 *    identity unless the anchor is set to the same point. `nullArgs` always sets both (what grid/tools.js:288 does
 *    by hand; carousel/tools.js:54 takes the other valid route and rewrites its children in the null's space).
 *  - `layers.createAdjustment` adds a comp-sized solid, whose anchor is its own centre and whose position is the
 *    comp centre — the two cancel, so a full-frame adjustment layer IS already at identity and can be a parent as
 *    it is. That is why Glass can use its own `MOE Glass N` layer as the holder instead of growing a second null.
 *
 * CONTROLS ON DEMAND (CLAUDE.md v0.87): a control may declare `when(args)`. `needed()` drops the ones this run does
 * not use, so Effect Controls carries only what the chosen settings actually drive. It is the same question the
 * Inspector and the Tune After strip already answer with a parameter's `showIf`.
 */

/** Expression Control match names and the parameter each one exposes (AE Scripting Guide). */
const CONTROL = {
  slider: { matchName: 'ADBE Slider Control', param: 'Slider' },
  color: { matchName: 'ADBE Color Control', param: 'Color' },
  checkbox: { matchName: 'ADBE Checkbox Control', param: 'Checkbox' },
  angle: { matchName: 'ADBE Angle Control', param: 'Angle' },
  point: { matchName: 'ADBE Point Control', param: 'Point' },
  layer: { matchName: 'ADBE Layer Control', param: 'Layer' }
};

/** `{ kind }`, or the older `{ color: true }` shorthand; a slider when neither is given. */
const kindOf = (c) => (c && c.kind) || (c && c.color ? 'color' : 'slider');
const specOf = (c) => CONTROL[kindOf(c)] || CONTROL.slider;

/**
 * The controls this run really uses. A control with no `when` is always kept. `when` may be a boolean or a function
 * of the run's args; a `when` that throws keeps the control, because losing a control the tool then writes to would
 * break the run, while an extra control only costs a line in Effect Controls.
 */
function needed(controls, args) {
  return (controls || []).filter((c) => {
    if (!c || c.when === undefined || c.when === null) return true;
    if (typeof c.when !== 'function') return !!c.when;
    try { return !!c.when(args || {}); } catch (e) { return true; }
  });
}

/** `effects.ensure` items for a holder's controls, in the order given. */
function items(controls) {
  return (controls || []).map((c) => {
    const s = specOf(c);
    return { key: c.key, matchName: s.matchName, before: [], params: [{ id: s.param, value: c.value, names: [s.param] }] };
  });
}

/**
 * The expression that reads one control off the holder.
 * Same comp -> `thisComp`; from inside a pre-comp the holder lives in -> `comp("<name>")` (never a layer index).
 * The host adds the permanent link id when this is written through `expressions.set` (docs/features/LINKS.md).
 */
function read(holderName, control, opts) {
  const s = specOf(control);
  const layer = opts && opts.fromComp
    ? `comp(${JSON.stringify(String(opts.fromComp))}).layer(${JSON.stringify(String(holderName))})`
    : `thisComp.layer(${JSON.stringify(String(holderName))})`;
  return `${layer}.effect(${JSON.stringify(String(control.key))})(${JSON.stringify(s.param)})`;
}

/**
 * Args for `layers.createNull` that put the null AT IDENTITY (anchor = position), so parts parented to it keep
 * exactly where they are. Pass `at` as the point the user should see as the set's handle.
 */
function nullArgs(o) {
  const at = (o.at || [0, 0]).map(Number);
  const a = { compId: o.compId, name: o.name, position: at, anchor: at };
  if (o.label !== undefined) a.label = o.label;
  if (o.threeD) { a.threeD = true; a.position = [at[0], at[1], Number(at[2]) || 0]; a.anchor = a.position; }
  if (o.undoLabel) a.undoLabel = o.undoLabel;
  return a;
}

/**
 * Queue a holder null plus its controls on an open plan. Returns what the tool needs to link to it.
 *   const H = holder.make(T, { compId, name: `${name} Controls`, at: centre, controls, args, label: 9 });
 *   H.layerId                       // a Ref, for parenting or ordering
 *   H.read(control)                 // the expression source for one control
 */
function make(T, o) {
  const controls = needed(o.controls, o.args);
  const ref = T.add('layers.createNull', nullArgs(o));
  const layerId = ref.at('layerId');
  if (controls.length) {
    T.add('effects.ensure', {
      compId: o.compId,
      label: o.label2 || `MOE: ${o.name}`,
      layers: [{ layer: { layerId }, items: items(controls) }]
    });
  }
  return {
    ref, layerId, name: o.name, controls,
    read: (c, opts) => read(o.name, c, opts),
    /** Make this holder the parent of the parts. Only correct when the holder is at identity. */
    parent(ids, label) {
      const list = (ids || []).filter(Boolean);
      if (!list.length) return null;
      return T.add('layers.setParent', { compId: o.compId, label: label || o.label2 || `MOE: ${o.name}`, items: list.map((id) => ({ layerId: id, parentId: layerId })) });
    }
  };
}

module.exports = { CONTROL, kindOf, needed, items, read, nullArgs, make };
