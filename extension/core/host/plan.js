'use strict';
/**
 * One Ctrl+Z per run (v0.94, docs/features/ONE_UNDO.md).
 *
 * After Effects closes an undo group when the script that opened it returns, so a tool whose writes take many panel
 * calls leaves many undo steps. A plan collects the writes and sends them as ONE call — the host op tx.run — which
 * runs them in one undo group: one Ctrl+Z.
 *
 *   const P = plan(host, 'MOE: Lower Third');
 *   const comp = P.add('comps.create', { compId, name });            // a Ref to that step's result
 *   P.add('text.create', { compId: comp.at('compId'), text: 'Hi' });  // refs go into the args of later steps
 *   const out = await P.commit();                                     // one host call
 *   comp.value().compId                                               // the real value, after commit
 *
 * A step may only use what earlier steps returned (refs) — never read the comp in between: read first, then plan.
 * commit() throws when a step fails; what ran before it is still in that one undo step, and the refs of the steps
 * that ran resolve, so the tool can clean up.
 */
class Ref {
  constructor(p, i, path) { this.p = p; this.i = i; this.path = path || []; }
  /** A deeper part of the result: ref.at('items', 0, 'layerId'). */
  at(...keys) { return new Ref(this.p, this.i, this.path.concat(keys.map(String))); }
  /** "$ref:s3.layerId" before commit (the host resolves it); the real value after. */
  toJSON() { return this.p.done ? this.value() : `$ref:s${this.i}${this.path.map((k) => `.${k}`).join('')}`; }
  value() {
    if (!this.p.done) throw Object.assign(new Error('A plan step was read before the plan was committed'), { code: 'PLAN_NOT_COMMITTED' });
    let v = this.p.results[this.i];
    for (const k of this.path) v = v === null || v === undefined ? undefined : v[k];
    return v;
  }
}

function plan(host, label) {
  const steps = [];
  const P = {
    done: false, results: [], failed: null, label,
    /** Queue one registered host op; returns a Ref to its result. */
    add(op, args) {
      if (P.done) throw new Error('This plan was already committed');
      steps.push({ id: `s${steps.length}`, op, args: args || {} });
      return new Ref(P, steps.length - 1);
    },
    get size() { return steps.length; },
    /** Run every queued step in ONE host call (one undo step). */
    async commit() {
      if (P.done) return P.results;
      if (!steps.length) { P.done = true; return P.results; }
      let r;
      // v0.98.2 (owner's report: grid.build "PLAN_NOT_COMMITTED"): when the call itself throws (After Effects error,
      // timeout, a modal dialog) the plan still counts as done — refs read as undefined — so the caller's cleanup runs
      // and the real error is the one reported
      try { r = await host.call('tx.run', { label, steps }); } catch (e) { P.done = true; P.results = []; P.failed = { step: -1, op: 'tx.run', code: e.code || 'HOST_EXCEPTION', message: e.message }; throw e; }
      P.done = true;
      P.results = r.results || [];
      P.failed = r.failed || null;
      if (r.failed) {
        const e = new Error(`${r.failed.message} (step ${r.failed.step + 1} of ${steps.length}: ${r.failed.op})`);
        e.code = r.failed.code; e.step = r.failed.step; e.op = r.failed.op;
        throw e;
      }
      return P.results;
    }
  };
  return P;
}

module.exports = { plan, Ref };
