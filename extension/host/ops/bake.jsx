/*
 * MOE Motion AI - Bake operations (ExtendScript / ES3, ASCII only). v0.42, docs/features/BAKE.md
 * Bake turns live expressions into keyframes over a time range (what Animation > Keyframe Assistant >
 * Convert Expression to Keyframes does for one property), for every property of a MOE rig at once.
 *   bake.scan     read-only: the properties with a live expression on the given layers (optionally only those
 *                 whose expression starts with a tag), with what bake needs to know about each
 *   bake.sample   read-only: Property.valueAtTime(t, false) for many times (the values after expressions)
 *   bake.write    for each property: saves its expression and keyframes, removes them, writes the sampled values
 *                 with Property.setValuesAtTimes (or setValue when the value never changes), then sets each new
 *                 key LINEAR (HOLD where linear is not valid) and straight spatial tangents
 *   bake.restore  puts the saved expression and keyframes back
 * APIs: Property.expression / expressionEnabled / canSetExpression / valueAtTime / setValuesAtTimes /
 * setValue / setValueAtTime / removeKey / numKeys / keyTime / keyValue / key(In|Out)InterpolationType /
 * key(In|Out)TemporalEase / key(In|Out)SpatialTangent / setInterpolationTypeAtKey / setTemporalEaseAtKey /
 * setSpatialTangentsAtKey / isInterpolationTypeValid / isSpatial / dimensionsSeparated (AE Scripting Guide).
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;
    var MAX_SAMPLES = 20000, MAX_OLD_KEYS = 1000;

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function plain(v) {
        if (v && typeof v === 'object' && v.length !== undefined) { var a = [], i; for (i = 0; i < v.length; i++) { a.push(num(v[i])); } return a; }
        return typeof v === 'boolean' ? (v ? 1 : 0) : num(v);
    }
    function interpName(t) { return t === KeyframeInterpolationType.HOLD ? 'hold' : (t === KeyframeInterpolationType.LINEAR ? 'linear' : 'bezier'); }
    function interpOf(n) { return n === 'hold' ? KeyframeInterpolationType.HOLD : (n === 'linear' ? KeyframeInterpolationType.LINEAR : KeyframeInterpolationType.BEZIER); }
    function easeOut(list) { var a = [], i; for (i = 0; i < list.length; i++) { a.push({ speed: num(list[i].speed), influence: num(list[i].influence) }); } return a; }
    function easeIn(list) { var a = [], i; for (i = 0; i < list.length; i++) { a.push(new KeyframeEase(num(list[i].speed), Math.max(0.1, Math.min(100, num(list[i].influence) || 16.67)))); } return a; }
    function keyAt(p, t) { var k; for (k = 1; k <= p.numKeys; k++) { if (Math.abs(p.keyTime(k) - t) < 0.0005) { return k; } } return 0; }

    var BAKEABLE = { OneD: 1, TwoD: 1, ThreeD: 1, TwoD_SPATIAL: 1, ThreeD_SPATIAL: 1, COLOR: 1 };
    function holdOnly(p) { try { return !p.isInterpolationTypeValid(KeyframeInterpolationType.LINEAR); } catch (e) { return false; } }
    function separated(p) { try { return p.matchName === 'ADBE Position' && p.dimensionsSeparated; } catch (e) { return false; } }

    function scanGroup(group, layer, tag, out, depth) {
        var i, p, ex, vt, reason;
        if (depth > 10) { return; }
        for (i = 1; i <= group.numProperties; i++) {
            p = group.property(i);
            if (p.propertyType === PropertyType.PROPERTY) {
                if (!p.canSetExpression || !p.expressionEnabled) { continue; }
                ex = String(p.expression || '');
                if (ex === '' || (tag && ex.substring(0, tag.length) !== tag)) { continue; }
                vt = U.valueTypeName(p.propertyValueType);
                reason = '';
                if (!BAKEABLE[vt]) { reason = 'TYPE'; }
                else if (separated(p)) { reason = 'SEPARATED'; }
                else if (layer.locked) { reason = 'LOCKED'; }
                else if (p.numKeys > MAX_OLD_KEYS) { reason = 'TOO_MANY_KEYS'; }
                out.push({ address: U.addressOf(p, layer), layerName: layer.name, name: p.name, valueType: vt, keyed: p.numKeys, hold: holdOnly(p), spatial: !!p.isSpatial, tag: ex.split('\n')[0].substring(0, 60), reason: reason });
            } else { scanGroup(p, layer, tag, out, depth + 1); }
        }
    }

    /* args: { compId, layerIds, tag ('' = any expression) } -> { props: [...] } */
    ops['bake.scan'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId), out = [], i, L, want = {};
            for (i = 0; i < args.layerIds.length; i++) { want[args.layerIds[i]] = true; }
            for (i = 1; i <= comp.numLayers; i++) {
                L = comp.layer(i);
                if (want[L.id]) { scanGroup(L, L, String(args.tag || ''), out, 0); }
            }
            return { props: out, workArea: { start: comp.workAreaStart, duration: comp.workAreaDuration }, duration: comp.duration, frameDuration: comp.frameDuration };
        }
    };

    /* args: { compId, times: [t], items: [{ address }] } -> { items: [{ values, error }] } (read-only) */
    ops['bake.sample'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId), out = [], i, j, r, vals;
            if (args.times.length * args.items.length > MAX_SAMPLES) { U.fail('BAD_ARGS', 'Too many samples in one call (' + args.times.length * args.items.length + ' > ' + MAX_SAMPLES + ').'); }
            for (i = 0; i < args.items.length; i++) {
                vals = [];
                try {
                    r = U.resolveProperty(comp, args.items[i].address);
                    for (j = 0; j < args.times.length; j++) { vals.push(plain(r.prop.valueAtTime(num(args.times[j]), false))); }
                    out.push({ values: vals, error: String(r.prop.expressionError || '') });
                } catch (e) { out.push({ values: null, error: String(e.message || e) }); }
            }
            return { items: out };
        }
    };

    /* v0.99.7: the value UNDER the expression, not the one the expression produces.
       Property.value on a property that has an expression returns the EVALUATED value, so saving it meant Restore
       wrote the computed result back underneath the restored expression - and an expression that builds on `value`
       then applied its own offset a second time. Measured on a swept grid: the number under item 1's Position was
       [620, 300] and the expression gave [-150, -120]; Restore put [-150, -120] underneath and the item landed at
       [-920, -540], which is the same offset applied twice. valueAtTime(t, true) is the pre-expression value, and
       for a property with no expression it is the same number as before. */
    function preValue(p, t) {
        try { return plain(p.valueAtTime(num(t), true)); } catch (ePre) { return plain(p.value); }
    }

    function saveState(p, t) {
        var keys = [], k, o;
        for (k = 1; k <= p.numKeys; k++) {
            o = { t: p.keyTime(k), v: plain(p.keyValue(k)), inI: interpName(p.keyInInterpolationType(k)), outI: interpName(p.keyOutInterpolationType(k)) };
            try { o.easeIn = easeOut(p.keyInTemporalEase(k)); o.easeOut = easeOut(p.keyOutTemporalEase(k)); } catch (eE) { /* no ease on this key */ }
            if (p.isSpatial) { try { o.inTan = plain(p.keyInSpatialTangent(k)); o.outTan = plain(p.keyOutSpatialTangent(k)); } catch (eT) { /* no tangents */ } }
            keys.push(o);
        }
        return { expression: String(p.expression || ''), expressionEnabled: !!p.expressionEnabled, value: preValue(p, t), keys: keys };
    }

    function clearKeys(p) { var k; for (k = p.numKeys; k >= 1; k--) { p.removeKey(k); } }

    function putBack(p, b) {
        var j, k, o;
        clearKeys(p);
        if (b.keys && b.keys.length) {
            for (j = 0; j < b.keys.length; j++) { p.setValueAtTime(num(b.keys[j].t), b.keys[j].v); }
            for (j = 0; j < b.keys.length; j++) {
                o = b.keys[j];
                k = keyAt(p, num(o.t));
                if (!k) { continue; }
                p.setInterpolationTypeAtKey(k, interpOf(o.inI), interpOf(o.outI));
                if (o.easeIn && o.easeOut && o.easeIn.length) { try { p.setTemporalEaseAtKey(k, easeIn(o.easeIn), easeIn(o.easeOut)); } catch (eE) { /* ease kept as AE made it */ } }
                if (p.isSpatial && o.inTan && o.outTan) { try { p.setSpatialTangentsAtKey(k, o.inTan, o.outTan); } catch (eT) { /* tangents kept */ } }
            }
        } else {
            p.setValue(b.value);
        }
        p.expression = b.expression;
        if (b.expression) { p.expressionEnabled = b.expressionEnabled; }
    }

    function zeroOf(v) { var z = [], i; for (i = 0; i < v.length; i++) { z.push(0); } return z; }

    /* args: { compId, label, items: [{ address, times: [t], values: [v], hold, constant }] }
       constant: true -> values[0] becomes a static value (no keys). */
    ops['bake.write'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Bake', function () {
                var out = [], i, k, it, r, p, before, interp, z;
                for (i = 0; i < args.items.length; i++) {
                    it = args.items[i];
                    try { r = U.resolveProperty(comp, it.address); } catch (eGone) { out.push({ address: it.address, skipped: 'GONE' }); continue; }
                    p = r.prop;
                    if (r.layer.locked) { out.push({ address: it.address, skipped: 'LOCKED' }); continue; }
                    before = saveState(p, comp.time);
                    try {
                        clearKeys(p);
                        p.expression = '';
                        if (it.constant) {
                            p.setValue(it.values[0]);
                        } else {
                            p.setValuesAtTimes(it.times, it.values);
                            interp = it.hold ? KeyframeInterpolationType.HOLD : KeyframeInterpolationType.LINEAR;
                            for (k = 1; k <= p.numKeys; k++) {
                                p.setInterpolationTypeAtKey(k, interp, interp);
                                if (p.isSpatial && !it.hold) { z = zeroOf(plain(p.keyValue(k))); p.setSpatialTangentsAtKey(k, z, z); }
                            }
                        }
                        out.push({ address: it.address, before: before, numKeys: p.numKeys, expression: String(p.expression || ''), value: it.constant ? plain(p.value) : null });
                    } catch (e) {
                        try { putBack(p, before); } catch (eBack) { /* reported below */ }
                        out.push({ address: it.address, skipped: 'ERROR', error: String(e.message || e) });
                    }
                }
                return { items: out };
            });
        }
    };

    /* args: { compId, items: [{ address, before }] } - undo of bake.write */
    ops['bake.restore'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Restore Bake', function () {
                var out = [], i, r;
                for (i = 0; i < args.items.length; i++) {
                    try { r = U.resolveProperty(comp, args.items[i].address); } catch (eGone) { out.push({ ok: false, error: 'GONE' }); continue; }
                    putBack(r.prop, args.items[i].before);
                    /* v0.99.7: the VALUE has to come back too, not just the expression. A plain value has no
                       expression, so the old check passed whatever number was put back - and a wrong number under
                       a restored expression is exactly how a baked grid came back in the wrong place. */
                    var b = args.items[i].before, sameExpr = String(r.prop.expression || '') === b.expression, sameVal = true;
                    if (!(b.keys && b.keys.length)) {
                        var now = preValue(r.prop, comp.time), want = b.value, q;
                        if (now && now.length !== undefined && want && want.length !== undefined) {
                            sameVal = now.length === want.length;
                            for (q = 0; sameVal && q < now.length; q++) { if (Math.abs(num(now[q]) - num(want[q])) > 0.001) { sameVal = false; } }
                        } else { sameVal = Math.abs(num(now) - num(want)) <= 0.001; }
                    }
                    out.push({ ok: sameExpr && sameVal, expressionBack: sameExpr, valueBack: sameVal, numKeys: r.prop.numKeys });
                }
                return { items: out };
            });
        }
    };
}($.global));
