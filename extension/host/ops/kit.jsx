/*
 * MOE Motion AI - Motion Kit operations (ExtendScript / ES3, ASCII only).
 *   keyframes.setInterp   Linear / Hold / Bezier per key side (one undo step)
 *   layers.trimToKeys     layer In / Out points to its first / last keyframe
 *   layers.restoreTiming  In / Out points back to a snapshot
 *   rigs.find             MOE-tagged expressions and MOE effects on layers (read-only)
 *   rigs.remove           remove them ("Trash"): expressions cleared, MOE effects deleted
 * APIs used (After Effects Scripting Guide): Property.setInterpolationTypeAtKey, keyTime,
 * numKeys, Layer.inPoint / outPoint, PropertyGroup.property / numProperties, Property.expression,
 * PropertyBase.remove.
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;
    var MAX_PROPS = 4000, MAX_DEPTH = 10;

    function snapKey(prop, k) {
        return {
            index: k, time: prop.keyTime(k),
            inInterp: U.interpName(prop.keyInInterpolationType(k)), outInterp: U.interpName(prop.keyOutInterpolationType(k)),
            easeIn: U.easeToPlain(prop.keyInTemporalEase(k)), easeOut: U.easeToPlain(prop.keyOutTemporalEase(k))
        };
    }

    /* args: { compId, label, targets: [{ address, keys: [{ index, inType, outType }] }] } - type: 'LINEAR' | 'BEZIER' | 'HOLD' | null (keep) */
    ops['keyframes.setInterp'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Interpolation', function () {
                var out = [], t, prop, j, it, entry, nIn, nOut;
                for (t = 0; t < args.targets.length; t++) {
                    prop = U.resolveProperty(comp, args.targets[t].address).prop;
                    entry = { address: args.targets[t].address, before: [], after: [], skipped: [] };
                    for (j = 0; j < args.targets[t].keys.length; j++) {
                        it = args.targets[t].keys[j];
                        if (it.index < 1 || it.index > prop.numKeys) { entry.skipped.push({ index: it.index, reason: 'KEY_OUT_OF_RANGE' }); continue; }
                        entry.before.push(snapKey(prop, it.index));
                        nIn = it.inType ? U.interpFromName(it.inType) : prop.keyInInterpolationType(it.index);
                        nOut = it.outType ? U.interpFromName(it.outType) : prop.keyOutInterpolationType(it.index);
                        prop.setInterpolationTypeAtKey(it.index, nIn, nOut);
                        entry.after.push(snapKey(prop, it.index));
                    }
                    out.push(entry);
                }
                return { targets: out };
            });
        }
    };

    /* Walk a layer's properties (bounded) and call fn(prop) for every leaf property. */
    function walk(node, depth, fn, count) {
        var i, p;
        if (depth > MAX_DEPTH) { return; }
        for (i = 1; i <= node.numProperties; i++) {
            if (count.n++ > MAX_PROPS) { return; }
            try { p = node.property(i); } catch (e) { continue; }
            if (!p) { continue; }
            if (p.propertyType === PropertyType.PROPERTY) { fn(p); } else { walk(p, depth + 1, fn, count); }
        }
    }
    function keyRange(L) {
        var lo = Infinity, hi = -Infinity, n = 0;
        walk(L, 0, function (p) {
            var k;
            if (!p.numKeys) { return; }
            for (k = 1; k <= p.numKeys; k++) { lo = Math.min(lo, p.keyTime(k)); hi = Math.max(hi, p.keyTime(k)); n++; }
        }, { n: 0 });
        return { lo: lo, hi: hi, keys: n };
    }

    /* args: { compId, label, layers: [id] } */
    ops['layers.trimToKeys'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Trim to Keys', function () {
                var out = [], i, L, r, before, fd = comp.frameDuration;
                for (i = 0; i < args.layers.length; i++) {
                    L = U.findLayer(comp, { layerId: args.layers[i] });
                    if (L.locked) { out.push({ layerId: L.id, name: L.name, skipped: 'LOCKED' }); continue; }
                    r = keyRange(L);
                    if (!r.keys) { out.push({ layerId: L.id, name: L.name, skipped: 'NO_KEYS' }); continue; }
                    if (r.hi - r.lo < fd / 2) { out.push({ layerId: L.id, name: L.name, skipped: 'ONE_KEY_TIME' }); continue; }
                    before = { inPoint: L.inPoint, outPoint: L.outPoint };
                    /* Order matters: AE rejects an In point after the current Out point (and the reverse). */
                    if (r.lo >= L.outPoint) { L.outPoint = r.hi; L.inPoint = r.lo; } else { L.inPoint = r.lo; L.outPoint = r.hi; }
                    out.push({ layerId: L.id, name: L.name, before: before, after: { inPoint: L.inPoint, outPoint: L.outPoint }, keys: r.keys, range: [r.lo, r.hi] });
                }
                return { layers: out };
            });
        }
    };

    /* args: { compId, layers: [{ layerId, inPoint, outPoint }] } */
    ops['layers.restoreTiming'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Restore Timing', function () {
                var i, L, s;
                for (i = 0; i < args.layers.length; i++) {
                    s = args.layers[i];
                    L = U.findLayer(comp, { layerId: s.layerId });
                    if (s.inPoint >= L.outPoint) { L.outPoint = s.outPoint; L.inPoint = s.inPoint; } else { L.inPoint = s.inPoint; L.outPoint = s.outPoint; }
                }
                return { restored: args.layers.length };
            });
        }
    };

    function isMoeExpr(p) {
        var e;
        try { if (!p.canSetExpression || !p.expression) { return false; } e = String(p.expression); } catch (err) { return false; }
        return /\/\/ MOE/.test(e);
    }
    function scanLayer(L) {
        var res = { layerId: L.id, name: L.name, effects: [], expressions: [] }, parade = L.property('ADBE Effect Parade'), i, fx;
        if (parade) {
            for (i = 1; i <= parade.numProperties; i++) {
                fx = parade.property(i);
                if (fx.name.substring(0, 4) === 'MOE ') { res.effects.push(fx.name); }
            }
        }
        walk(L, 0, function (p) {
            if (isMoeExpr(p)) { res.expressions.push({ address: U.addressOf(p, L), name: p.name, expression: U.truncate(String(p.expression), 200) }); }
        }, { n: 0 });
        return res;
    }

    /* args: { compId, layers: [id] } */
    ops['rigs.find'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId), out = [], i;
            for (i = 0; i < args.layers.length; i++) { out.push(scanLayer(U.findLayer(comp, { layerId: args.layers[i] }))); }
            return { layers: out };
        }
    };

    /* args: { compId, label, layers: [id] } - rescans, then removes only MOE-tagged expressions and MOE-named effects. */
    ops['rigs.remove'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Trash Rigs', function () {
                var out = [], i, L, scan, j, p, parade, fx, removedFx, removedExpr;
                for (i = 0; i < args.layers.length; i++) {
                    L = U.findLayer(comp, { layerId: args.layers[i] });
                    if (L.locked) { out.push({ layerId: L.id, name: L.name, skipped: 'LOCKED' }); continue; }
                    scan = scanLayer(L);
                    removedExpr = 0; removedFx = [];
                    for (j = 0; j < scan.expressions.length; j++) {
                        p = U.resolveProperty(comp, scan.expressions[j].address).prop;
                        if (isMoeExpr(p)) { p.expression = ''; removedExpr++; }
                    }
                    parade = L.property('ADBE Effect Parade');
                    for (j = parade ? parade.numProperties : 0; j >= 1; j--) {
                        fx = parade.property(j);
                        if (fx.name.substring(0, 4) === 'MOE ') { removedFx.push(fx.name); fx.remove(); }
                    }
                    out.push({ layerId: L.id, name: L.name, expressions: removedExpr, effects: removedFx, left: scanLayer(L) });
                }
                return { layers: out };
            });
        }
    };
}($.global));
