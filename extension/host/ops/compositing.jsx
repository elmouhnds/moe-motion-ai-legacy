/*
 * MOE Motion AI - compositing host operations (ExtendScript / ES3).
 *
 *  pixels.sample   Reads pixel statistics with the expression-only sampleImage():
 *                  a temporary null + Color Control probe whose expression maps
 *                  `time` to (cell, sample time). Property.valueAtTime() waits for
 *                  sampleImage (Scripting Guide, AE 13.6+). The probe is removed
 *                  in a finally block. Net project change: none.
 *  effects.ensure  Adds or updates named MOE effects on layers and sets params,
 *                  all in one undo group; rolls back its own changes on failure.
 *  effects.restore Removes effects created by ensure / restores previous params.
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

    function probeExpression(layerIndex, cols, rows, times, postEffect, fd) {
        var t = [], i;
        for (i = 0; i < times.length; i++) { t.push(num(times[i])); }
        return [
            'var L = thisComp.layer(' + layerIndex + ');',
            'var C = ' + cols + ', R = ' + rows + ', T = [' + t.join(',') + '];',
            'var n = C * R;',
            'var k = Math.round(time / ' + fd + ');',
            'var ti = Math.floor(k / n); if (ti > T.length - 1) { ti = T.length - 1; } if (ti < 0) { ti = 0; }',
            'var ci = k - ti * n; if (ci < 0) { ci = 0; }',
            'var cw = L.width / C, ch = L.height / R;',
            'var x = (ci % C + 0.5) * cw, y = (Math.floor(ci / C) + 0.5) * ch;',
            'L.sampleImage([x, y], [cw / 2, ch / 2], ' + (postEffect ? 'true' : 'false') + ', T[ti]);'
        ].join('\n');
    }

    /* args: { compId, layer: { layerId }, cols, rows, times: [sec], postEffect, bypass: [effect names] }
       bypass: effects temporarily disabled while sampling (restored in finally). */
    ops['pixels.sample'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            var cols = Math.max(1, Math.min(12, Math.round(num(args.cols) || 4)));
            var rows = Math.max(1, Math.min(12, Math.round(num(args.rows) || 4)));
            var times = args.times && args.times.length ? args.times : [comp.time];
            if (times.length > 8) { U.fail('BAD_ARGS', 'At most 8 sample times.'); }
            /* v0.99.5: same as layers.bounds - the temporary probe must not change the user's selection. */
            return U.withUndo('MOE: Analyze (temporary)', function () { return U.keepSelection(comp, function () {
                var target = U.findLayer(comp, args.layer);
                if (!target.width || !target.height) { U.fail('NOT_SAMPLEABLE', 'This layer has no pixels to sample.'); }
                var before = comp.numLayers, probe = null, out = null, fd = comp.frameDuration, disabled = [], bi, bq, bfx;
                var tParade = target.property('ADBE Effect Parade');
                if (args.bypass && tParade) {
                    for (bq = 1; bq <= tParade.numProperties; bq++) {
                        bfx = tParade.property(bq);
                        for (bi = 0; bi < args.bypass.length; bi++) {
                            if (bfx.name === args.bypass[bi] && bfx.enabled) { bfx.enabled = false; disabled.push(bfx.name); }
                        }
                    }
                }
                try {
                    probe = comp.layers.addNull(comp.duration);
                    probe.name = 'MOE Probe (temporary)';
                    var parade = probe.property('ADBE Effect Parade');
                    var fxIndex = parade.addProperty('ADBE Color Control').propertyIndex;
                    var color = probe.property('ADBE Effect Parade').property(fxIndex).property('ADBE Color Control-0001');
                    color.expression = probeExpression(target.index, cols, rows, times, !!args.postEffect, fd);
                    if (color.expressionError) { U.fail('SAMPLE_FAILED', 'Pixel sampling failed: ' + color.expressionError); }
                    var n = cols * rows, samples = [], ti, ci, v, cells;
                    for (ti = 0; ti < times.length; ti++) {
                        cells = [];
                        for (ci = 0; ci < n; ci++) {
                            v = color.valueAtTime((ti * n + ci) * fd, false);
                            cells.push([num(v[0]), num(v[1]), num(v[2]), num(v[3])]);
                        }
                        samples.push({ t: num(times[ti]), cells: cells });
                    }
                    out = { layerId: target.id, name: target.name, width: target.width, height: target.height, cols: cols, rows: rows, samples: samples };
                } finally {
                    if (probe) { try { probe.remove(); } catch (eRemove) { /* reported via layer count */ } }
                    if (disabled.length) {
                        tParade = target.property('ADBE Effect Parade');
                        for (bq = 1; bq <= tParade.numProperties; bq++) {
                            bfx = tParade.property(bq);
                            for (bi = 0; bi < disabled.length; bi++) { if (bfx.name === disabled[bi]) { bfx.enabled = true; } }
                        }
                    }
                }
                out.bypassed = disabled;
                out.layerCountBefore = before;
                out.layerCountAfter = comp.numLayers;
                try { out.bitsPerChannel = app.project.bitsPerChannel; } catch (eBpc) { out.bitsPerChannel = null; }
                return out;
            }); });
        }
    };

    function pad4(n) { var s = String(n); while (s.length < 4) { s = '0' + s; } return s; }

    function typeName(p) {
        try { return U.valueTypeName(p.propertyValueType); } catch (e) { return 'NO_VALUE'; }
    }

    function describeParams(fx) {
        var list = [], i, p;
        for (i = 1; i <= fx.numProperties; i++) {
            p = fx.property(i);
            list.push(i + ':' + p.name + ' (' + p.matchName + ', ' + typeName(p) + ')');
        }
        return list.join('; ');
    }

    /*
     * Resolve a logical parameter. spec: { id, names: [], suffix: N, nth: { type, n } }
     * Returns { prop, index, method } or null.
     */
    /* expectParams: one count, or the list of counts known on the After Effects versions MOE runs on */
    function countOk(want, n) { var i; if (want instanceof Array) { for (i = 0; i < want.length; i++) { if (want[i] === n) { return true; } } return false; } return want === n; }

    function apos(s) { return String(s).replace(/[\u2018\u2019\u02BC]/g, "'"); }

    function resolveParam(fx, effectMatchName, spec, strict) {
        var i, j, p, count;
        if (spec.names) {
            for (i = 1; i <= fx.numProperties; i++) {
                p = fx.property(i);
                for (j = 0; j < spec.names.length; j++) {
                    /* v0.99.1: After Effects 26.5 spells "Use Composition\u2019s" with a typographic apostrophe */
                    if (p.name === spec.names[j] || apos(p.name) === apos(spec.names[j])) { return { prop: p, index: i, method: 'name' }; }
                }
            }
        }
        if (strict) { return null; }
        if (spec.suffix) {
            var mn = effectMatchName + '-' + pad4(spec.suffix);
            for (i = 1; i <= fx.numProperties; i++) {
                p = fx.property(i);
                if (p.matchName === mn) { return { prop: p, index: i, method: 'matchName' }; }
            }
        }
        if (spec.nth) {
            count = 0;
            for (i = 1; i <= fx.numProperties; i++) {
                p = fx.property(i);
                if (typeName(p) === spec.nth.type) {
                    count++;
                    if (count === spec.nth.n) { return { prop: p, index: i, method: 'structure' }; }
                }
            }
        }
        return null;
    }

    function findEffect(parade, key, matchName) {
        var i, fx;
        for (i = 1; i <= parade.numProperties; i++) {
            fx = parade.property(i);
            if (fx.name === key && fx.matchName === matchName) { return fx; }
        }
        return null;
    }

    function plain(v) {
        if (Object.prototype.toString.call(v) === '[object Array]' || (v && typeof v === 'object' && v.length !== undefined)) {
            var a = [], i;
            for (i = 0; i < v.length; i++) { a.push(num(v[i])); }
            return a;
        }
        return typeof v === 'boolean' ? (v ? 1 : 0) : num(v);
    }

    /*
     * args: { compId, label, layers: [{ layer: { layerId }, items: [
     *   { key, matchName, before: [keys], expectParams, params: [{ id, value, layerRef, names, suffix, nth }] } ] }] }
     */
    ops['effects.ensure'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Effects', function () {
                var undoLog = [], results = [], li, ii, layer, parade, item, fx, created, pi, spec, r, resolved, res, entry;
                try {
                    for (li = 0; li < args.layers.length; li++) {
                        layer = U.findLayer(comp, args.layers[li].layer);
                        if (layer.locked) { U.fail('LAYER_LOCKED', 'Layer "' + layer.name + '" is locked.'); }
                        var layerOut = { layerId: layer.id, name: layer.name, items: [] };
                        for (ii = 0; ii < args.layers[li].items.length; ii++) {
                            item = args.layers[li].items[ii];
                            parade = layer.property('ADBE Effect Parade');
                            if (!parade) { U.fail('NO_EFFECTS', 'Layer "' + layer.name + '" cannot hold effects.'); }
                            fx = findEffect(parade, item.key, item.matchName);
                            created = false;
                            if (!fx) {
                                if (!parade.canAddProperty(item.matchName)) {
                                    U.fail('EFFECT_UNAVAILABLE', 'Effect not available in this After Effects: ' + item.matchName);
                                }
                                var newIndex = parade.addProperty(item.matchName).propertyIndex;
                                fx = layer.property('ADBE Effect Parade').property(newIndex);
                                fx.name = item.key;
                                created = true;
                                undoLog.push({ kind: 'created', layer: layer, key: item.key, matchName: item.matchName });
                            }
                            resolved = [];
                            var missing = [];
                            /* Fallbacks (match-name convention / order) are only trusted when the
                               effect has exactly the parameter layout we expect. */
                            var strict = !!(item.expectParams && !countOk(item.expectParams, fx.numProperties));
                            for (pi = 0; pi < item.params.length; pi++) {
                                spec = item.params[pi];
                                r = resolveParam(fx, item.matchName, spec, strict);
                                if (!r) { missing.push(spec.id); } else { resolved.push({ spec: spec, r: r }); }
                            }
                            if (missing.length) {
                                U.fail('PARAM_UNRESOLVED', 'Cannot map parameter(s) ' + missing.join(', ') + ' of ' + item.matchName +
                                    (strict ? ' (expected ' + item.expectParams + ' parameters, found ' + fx.numProperties + ')' : '') + '. Parameters found: ' + describeParams(fx));
                            }
                            entry = { key: item.key, matchName: item.matchName, created: created, params: [] };
                            for (pi = 0; pi < resolved.length; pi++) {
                                res = resolved[pi];
                                var beforeVal = plain(res.r.prop.value);
                                if (!created) { undoLog.push({ kind: 'param', layer: layer, key: item.key, matchName: item.matchName, index: res.r.index, value: beforeVal }); }
                                /* layerRef: a layer parameter (e.g. CC Glass Bump Map) takes the layer's current index. */
                                var want = res.spec.layerRef !== undefined && res.spec.layerRef !== null ? U.findLayer(comp, { layerId: res.spec.layerRef }).index : res.spec.value, deferred = false;
                                if (item.matchName === 'ADBE Dropdown Control') {
                                    /* v0.98.1 (owner's After Effects: "Value 6 out of range 1 to 3"): a new Dropdown Menu Control
                                       has 3 items. Its list is set first when the spec carries it (item.menu,
                                       Property.setPropertyParameters); otherwise a value outside the current list waits
                                       for the effects.setMenu that sets list and value together (deferred). */
                                    if (item.menu && item.menu.length && typeof res.r.prop.setPropertyParameters === 'function') {
                                        /* v0.99.1 (Tile Test on After Effects 26.5: "null is not an object (step 2: effects.ensure)"):
                                           setPropertyParameters invalidates the old references - use the property it
                                           RETURNS, reach the effect through its parentProperty, and give the effect its
                                           name back if After Effects reset it (expressions read it by name). */
                                        res.r.prop = res.r.prop.setPropertyParameters(item.menu);
                                        fx = res.r.prop.parentProperty;
                                        if (fx && fx.name !== item.key) { fx.name = item.key; }
                                    }
                                    try { res.r.prop.setValue(want); } catch (eMenu) { res.r.prop.setValue(1); deferred = true; }
                                } else {
                                    res.r.prop.setValue(want);
                                }
                                entry.params.push({ id: res.spec.id, index: res.r.index, name: res.r.prop.name, matchName: res.r.prop.matchName, resolvedBy: res.r.method, before: beforeVal, after: plain(res.r.prop.value), deferred: deferred });
                            }
                            /* Ordering: move before the earliest listed MOE effect present. */
                            if (item.before && item.before.length) {
                                parade = layer.property('ADBE Effect Parade');
                                fx = findEffect(parade, item.key, item.matchName);
                                var target = 0, bi, other;
                                for (bi = 0; bi < item.before.length; bi++) {
                                    for (var q = 1; q <= parade.numProperties; q++) {
                                        other = parade.property(q);
                                        if (other.name === item.before[bi] && (target === 0 || q < target)) { target = q; }
                                    }
                                }
                                if (target && fx.propertyIndex > target) { fx.moveTo(target); }
                            }
                            fx = findEffect(layer.property('ADBE Effect Parade'), item.key, item.matchName);
                            entry.index = fx.propertyIndex;
                            layerOut.items.push(entry);
                        }
                        results.push(layerOut);
                    }
                } catch (e) {
                    /* Roll back this call's own changes, newest first. */
                    var u, ufx, k;
                    for (k = undoLog.length - 1; k >= 0; k--) {
                        u = undoLog[k];
                        try {
                            ufx = findEffect(u.layer.property('ADBE Effect Parade'), u.key, u.matchName);
                            if (!ufx) { continue; }
                            if (u.kind === 'created') { ufx.remove(); } else { ufx.property(u.index).setValue(u.value); }
                        } catch (eRollback) { /* best effort; outer undo group still allows Edit > Undo */ }
                    }
                    throw e;
                }
                return { layers: results };
            });
        }
    };

    /* args: { compId, label, layers: [{ layer: { layerId }, items: [{ key, matchName, created, params: [{ index, before }] }] }] } */
    ops['effects.restore'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Restore Effects', function () {
                var removed = 0, restored = 0, li, ii, pi, layer, item, fx;
                for (li = 0; li < args.layers.length; li++) {
                    layer = U.findLayer(comp, args.layers[li].layer);
                    for (ii = args.layers[li].items.length - 1; ii >= 0; ii--) {
                        item = args.layers[li].items[ii];
                        fx = findEffect(layer.property('ADBE Effect Parade'), item.key, item.matchName);
                        if (!fx) { continue; }
                        if (item.created) { fx.remove(); removed++; continue; }
                        for (pi = 0; pi < item.params.length; pi++) {
                            fx.property(item.params[pi].index).setValue(item.params[pi].before);
                            restored++;
                        }
                    }
                }
                return { removed: removed, restored: restored };
            });
        }
    };
}($.global));
