/*
 * MOE Motion AI - one Ctrl+Z per run (v0.94, docs/features/ONE_UNDO.md). ExtendScript / ES3, ASCII only.
 *
 * After Effects closes an undo group when the script that opened it returns, so everything a run writes must
 * happen in ONE panel call to be one Ctrl+Z. tx.run is that call:
 *
 *   tx.run   { label, steps: [{ id, op, args }] }   runs registered ops in order inside one undo group.
 *            A string "$ref:<id>.<path>" anywhere in a step's args is replaced by that path of an earlier step's
 *            result (e.g. "$ref:s0.compId", "$ref:s3.layerId", "$ref:s5.end"). A comp created by comps.create in the
 *            same batch may be written by the later steps (U.compById). Returns { ok, results, failed } - a failure
 *            stops the batch and reports the step; what ran before it stays in the same undo step.
 *   tx.begin / tx.end   (v0.61) kept so an older panel does not break; they no longer open anything.
 *   tx.state            read-only.
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;
    var MAX_STEPS = 500;

    function resolve(v, results) {
        var i, out, k, parts, cur;
        if (typeof v === 'string' && v.substring(0, 5) === '$ref:') {
            parts = v.substring(5).split('.');
            if (!results.hasOwnProperty(parts[0])) { U.fail('BAD_REF', 'Unknown step in ' + v); }
            cur = results[parts[0]];
            for (i = 1; i < parts.length; i++) {
                if (cur === null || cur === undefined) { U.fail('BAD_REF', 'Nothing at ' + v); }
                cur = cur[parts[i]];
            }
            return cur;
        }
        if (v instanceof Array) { out = []; for (i = 0; i < v.length; i++) { out.push(resolve(v[i], results)); } return out; }
        if (v && typeof v === 'object') { out = {}; for (k in v) { if (v.hasOwnProperty(k)) { out[k] = resolve(v[k], results); } } return out; }
        return v;
    }

    ops['tx.run'] = {
        mutates: true,
        run: function (args) {
            var steps = args.steps, results = {}, out = [], failed = null, i, s, r, prev;
            if (!(steps instanceof Array) || !steps.length) { U.fail('BAD_ARGS', 'No steps.'); }
            if (steps.length > MAX_STEPS) { U.fail('BAD_ARGS', 'Too many steps (max ' + MAX_STEPS + ').'); }
            for (i = 0; i < steps.length; i++) {
                s = steps[i];
                if (!s || typeof s.op !== 'string' || !ops.hasOwnProperty(s.op) || s.op.substring(0, 3) === 'tx.') {
                    U.fail('UNKNOWN_OP', 'Step ' + (i + 1) + ': not an operation a batch can run: ' + (s && s.op));
                }
            }
            prev = MOE.txComps;
            MOE.txComps = [];
            /* v0.98.2: the one group of the whole batch, through U.withUndo (depth-counted: ops inside never open their own) */
            return U.withUndo(String(args.label || 'MOE').substring(0, 120), function () {
            try {
                for (i = 0; i < steps.length; i++) {
                    s = steps[i];
                    try { r = ops[s.op].run(resolve(s.args || {}, results)); }
                    catch (e) {
                        /* v0.99.5: an ExtendScript error knows where it happened - say so, or a failure like
                           "null is not an object" cannot be found again (CLAUDE.md: never hide the real error). */
                        failed = { step: i, op: s.op, code: e.moeCode || 'HOST_EXCEPTION', message: String(e.message || e) };
                        try { if (e.line) { failed.line = Number(e.line); } } catch (eLine) { /* not an engine error */ }
                        try { if (e.fileName) { failed.file = String(e.fileName).split('/').pop(); } } catch (eFile) { /* no file */ }
                        if (failed.line) { failed.message += ' [' + (failed.file || 'host') + ' line ' + failed.line + ']'; }
                        break;
                    }
                    results[s.id !== undefined && s.id !== null ? String(s.id) : String(i)] = r;
                    out.push(r);
                }
            } finally {
                MOE.txComps = prev || null;
            }
            return { ok: !failed, results: out, failed: failed };
            });
        }
    };

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function moeName(s) { return String(s || '').substring(0, 4) === 'MOE '; }

    /*
     * v0.94 a production's own comp. comps.create makes a comp with the active comp's size, pixel aspect, frame rate and
     * duration (inside tx.run the later steps may build in it); comps.place adds a MOE comp to the active comp as one
     * layer; comps.removeMoe deletes MOE comps that no comp uses any more (Restore).
     */
    ops['comps.create'] = {
        mutates: true,
        run: function (args) {
            var base = U.compById(args.compId), name = String(args.name || 'MOE Comp').substring(0, 240);
            if (!moeName(name)) { U.fail('BAD_ARGS', 'A comp MOE makes is named MOE ...'); }
            return U.withUndo('MOE: New Comp', function () {
                var cw = args.width ? Math.round(num(args.width)) : base.width, ch = args.height ? Math.round(num(args.height)) : base.height, c;
                if (cw < 4 || ch < 4 || cw > 30000 || ch > 30000) { U.fail('BAD_ARGS', 'A comp is 4 to 30000 px wide and high.'); }
                c = app.project.items.addComp(name, cw, ch, base.pixelAspect, args.duration ? Math.max(num(args.duration), base.frameDuration) : base.duration, base.frameRate);
                if (MOE.txComps) { MOE.txComps.push(c); }
                return { compId: c.id, name: c.name, width: c.width, height: c.height, duration: c.duration, frameRate: c.frameRate };
            });
        }
    };

    ops['comps.place'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId), src = null;
            try { src = app.project.itemByID(args.sourceId); } catch (eS) { src = null; }
            if (!src || !(src instanceof CompItem) || !moeName(src.name)) { U.fail('COMP_NOT_FOUND', 'Only a comp MOE made can be placed.'); }
            if (src.id === comp.id) { U.fail('BAD_ARGS', 'A comp cannot contain itself.'); }
            return U.withUndo('MOE: Place Comp', function () {
                var L = comp.layers.add(src);
                L.name = String(args.name || src.name);
                if (args.startTime !== undefined && args.startTime !== null) { L.startTime = num(args.startTime); }
                if (args.label !== undefined) { L.label = num(args.label); }
                return { layerId: L.id, index: L.index, name: L.name, startTime: L.startTime, sourceId: src.id };
            });
        }
    };

    ops['comps.removeMoe'] = {
        mutates: true,
        run: function (args) {
            var prefix = String(args.onlyNamed || '');
            if (!moeName(prefix)) { U.fail('BAD_ARGS', 'onlyNamed must start with MOE '); }
            return U.withUndo('MOE: Remove Comp', function () {
                var removed = [], kept = [], i, j, it, srcs;
                for (i = 0; i < (args.ids || []).length; i++) {
                    it = null;
                    try { it = app.project.itemByID(args.ids[i]); } catch (eI) { it = null; }
                    if (!it) { continue; }
                    if (!(it instanceof CompItem) || it.name.substring(0, prefix.length) !== prefix) { kept.push({ name: it.name, why: 'not MOE' }); continue; }
                    if (it.usedIn.length) { kept.push({ name: it.name, why: 'used in ' + it.usedIn.length + ' comp(s)' }); continue; }
                    removed.push(it.name);
                    /* v0.99.5: the solids ITS layers used stay in the project when the comp goes - the owner's
                       Solids folder filled with "MOE FX Noise / Ramp / Wipe". Take MOE's own ones with it when
                       nothing else uses them (U.dropSource checks the name and usedIn). */
                    srcs = U.sourcesOf(it);
                    it.remove();
                    for (j = 0; j < srcs.length; j++) { U.dropSource(srcs[j]); }
                }
                return { removed: removed, kept: kept };
            });
        }
    };

    /* v0.61 - kept for an older panel only: a group cannot outlive its script, so these open nothing now */
    ops['tx.begin'] = { mutates: false, run: function (args) { return { label: String(args.label || 'MOE'), deprecated: true }; } };
    ops['tx.end'] = { mutates: false, run: function () { return { closed: false, deprecated: true }; } };
    ops['tx.state'] = { mutates: false, run: function () { return { open: false, deprecated: true }; } };
}($.global));
