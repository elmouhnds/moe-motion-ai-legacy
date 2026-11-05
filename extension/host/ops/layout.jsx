/*
 * MOE Motion AI - layout operations (ExtendScript / ES3).
 *   layers.bounds     comp-space bounding boxes of layers at given times. Uses the documented
 *                     probe pattern: temporary null + Point Controls whose expressions call
 *                     sourceRectAtTime() and toComp(); values read with valueAtTime(). Removed in finally.
 *   transform.remap   uniform affine p' = s-p + d on top-level layers' Position (all keys, tangents,
 *                     ease speeds) and Scale - keeps every keyframe and its timing.
 *   transform.restore restore values/eases/tangents captured by remap.
 *   layers.setParent  setParentWithJump (no compensation) - used with identity rig nulls.
 *   adapt.apply       duplicate (or reuse) a comp, resize it and apply a per-layer plan (direct remap or
 *                     rig null), recursively for full-frame pre-comps. One undo group.
 *   comps.remove      remove comps MOE created (name guard).
 *   comp.restoreSize  restore width/height of a comp.
 *   guides.set        add / remove composition guides (CompItem.addGuide / removeGuide).
 *   audio.amplitude   v0.36: AE's own Animation > Keyframe Assistant > Convert Audio to Keyframes on one
 *                     layer (app.findMenuCommandId + app.executeCommand, Application object, AE Scripting
 *                     Guide). AE adds an "Audio Amplitude" null with Left / Right / Both Channels sliders;
 *                     it is renamed "MOE Audio . <layer>", moved to the bottom and the loudest Both
 *                     Channels key is returned. Reused when it already exists.
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function plain(v) {
        if (v && typeof v === 'object' && v.length !== undefined) { var a = [], i; for (i = 0; i < v.length; i++) { a.push(num(v[i])); } return a; }
        return typeof v === 'boolean' ? (v ? 1 : 0) : num(v);
    }

    /* Any comp by id (used for comps MOE itself created, and read-only measurement). */
    function compAny(id) {
        var item = null;
        if (!app.project) { U.fail('NO_PROJECT', 'No project is open.'); }
        try { item = app.project.itemByID(id); } catch (e) { item = null; }
        if (!item || !(item instanceof CompItem)) { U.fail('COMP_NOT_FOUND', 'Composition not found (it may have been deleted).'); }
        return item;
    }
    U.compAny = compAny;

    function boundsExpr(index, times, fd, wantMax) {
        var t = [], i;
        for (i = 0; i < times.length; i++) { t.push(num(times[i])); }
        var pick = wantMax ? 'Math.max' : 'Math.min';
        return [
            'var L = thisComp.layer(' + index + ');',
            'var T = [' + t.join(',') + '];',
            'var k = Math.round(time / ' + fd + '); if (k < 0) { k = 0; } if (k > T.length - 1) { k = T.length - 1; }',
            'var tt = T[k];',
            'var r = L.sourceRectAtTime(tt, false);',
            'var a = L.toComp([r.left, r.top], tt), b = L.toComp([r.left + r.width, r.top], tt), c = L.toComp([r.left, r.top + r.height], tt), d = L.toComp([r.left + r.width, r.top + r.height], tt);',
            '[' + pick + '(a[0], b[0], c[0], d[0]), ' + pick + '(a[1], b[1], c[1], d[1])];'
        ].join('\n');
    }

    /* args: { compId, layerIds: [id], times: [sec] (max 12), any: bool } -> boxes [l, t, r, b] per time */
    ops['layers.bounds'] = {
        mutates: true,
        run: function (args) {
            var comp = args.any ? compAny(args.compId) : U.compById(args.compId);
            var times = args.times && args.times.length ? args.times : [comp.time];
            if (times.length > 12) { U.fail('BAD_ARGS', 'At most 12 sample times.'); }
            if (args.layerIds.length > 300) { U.fail('BAD_ARGS', 'At most 300 layers per measurement.'); }
            return U.withUndo('MOE: Measure (temporary)', function () {
                var before = comp.numLayers, probe = null, out = [], fd = comp.frameDuration, i, ti, L, lo, hi, a, b, boxes, err;
                try {
                    probe = comp.layers.addNull(comp.duration);
                    probe.name = 'MOE Probe (temporary)';
                    var i1 = probe.property('ADBE Effect Parade').addProperty('ADBE Point Control').propertyIndex;
                    var i2 = probe.property('ADBE Effect Parade').addProperty('ADBE Point Control').propertyIndex;
                    for (i = 0; i < args.layerIds.length; i++) {
                        L = U.findLayer(comp, { layerId: args.layerIds[i] });
                        lo = probe.property('ADBE Effect Parade').property(i1).property(1);
                        hi = probe.property('ADBE Effect Parade').property(i2).property(1);
                        lo.expression = boundsExpr(L.index, times, fd, false);
                        hi.expression = boundsExpr(L.index, times, fd, true);
                        err = String(lo.expressionError || hi.expressionError || '');
                        if (err) { out.push({ layerId: L.id, name: L.name, error: err, boxes: [] }); continue; }
                        boxes = [];
                        for (ti = 0; ti < times.length; ti++) {
                            a = lo.valueAtTime(ti * fd, false);
                            b = hi.valueAtTime(ti * fd, false);
                            boxes.push([num(a[0]), num(a[1]), num(b[0]), num(b[1])]);
                        }
                        out.push({ layerId: L.id, name: L.name, boxes: boxes });
                    }
                } finally {
                    if (probe) { try { probe.remove(); } catch (eRemove) { /* reported via layer count */ } }
                }
                return { compId: comp.id, times: times, layers: out, layerCountBefore: before, layerCountAfter: comp.numLayers };
            });
        }
    };

    function hasExpr(p) { return !!(p && p.canSetExpression && p.expressionEnabled && p.expression); }

    /* args: { compId, any } -> every layer of the comp with structure facts (read-only). */
    ops['layers.describe'] = {
        mutates: false,
        run: function (args) {
            var comp = args.any ? compAny(args.compId) : U.compById(args.compId), out = [], i, L, tg, pos, src, txt;
            if (comp.numLayers > 500) { U.fail('TOO_MANY_LAYERS', 'This composition has more than 500 layers.'); }
            for (i = 1; i <= comp.numLayers; i++) {
                L = comp.layer(i);
                tg = L.property('ADBE Transform Group');
                pos = tg ? tg.property('ADBE Position') : null;
                src = null;
                try { if (L.source && L.source instanceof CompItem) { src = { id: L.source.id, name: L.source.name, width: L.source.width, height: L.source.height, numLayers: L.source.numLayers }; } } catch (eS) { src = null; }
                txt = null;
                try { txt = U.truncate(L.property('ADBE Text Properties').property('ADBE Text Document').value.text, 80); } catch (eT) { txt = null; }
                out.push({
                    id: L.id, index: L.index, name: L.name, type: U.layerType(L), parentId: L.parent ? L.parent.id : null,
                    threeD: !!L.threeDLayer, enabled: L.enabled, locked: L.locked, guide: !!L.guideLayer,
                    hasVideo: L.hasVideo !== false, hasAudio: !!L.hasAudio, inPoint: L.inPoint, outPoint: L.outPoint, startTime: L.startTime,
                    posExpr: hasExpr(pos) || !!(pos && pos.dimensionsSeparated && (hasExpr(tg.property('ADBE Position_0')) || hasExpr(tg.property('ADBE Position_1')))),
                    scaleExpr: tg ? hasExpr(tg.property('ADBE Scale')) : false,
                    animated: !!(pos && (pos.numKeys > 0 || (pos.dimensionsSeparated && (tg.property('ADBE Position_0').numKeys + tg.property('ADBE Position_1').numKeys) > 0))),
                    precomp: src, text: txt,
                    transform: tg ? { anchor: plain(tg.property('ADBE Anchor Point').value), position: pos && !pos.dimensionsSeparated ? plain(pos.value) : null, scale: plain(tg.property('ADBE Scale').value), rotation: num(tg.property('ADBE Rotate Z').value) } : null
                });
            }
            return { compId: comp.id, name: comp.name, width: comp.width, height: comp.height, duration: comp.duration, time: comp.time, frameDuration: comp.frameDuration, layers: out };
        }
    };

    /* ---------- key snapshots ---------- */

    function easeArr(arr, k) {
        var out = [], i;
        for (i = 0; i < arr.length; i++) { out.push(new KeyframeEase(arr[i].speed * k, arr[i].influence)); }
        return out;
    }

    function snapProp(prop) {
        var s = { matchName: prop.matchName, value: plain(prop.value), keys: [] }, k;
        for (k = 1; k <= prop.numKeys; k++) {
            var key = { t: prop.keyTime(k), v: plain(prop.keyValue(k)), easeIn: U.easeToPlain(prop.keyInTemporalEase(k)), easeOut: U.easeToPlain(prop.keyOutTemporalEase(k)) };
            if (prop.isSpatial) { key.inTan = plain(prop.keyInSpatialTangent(k)); key.outTan = plain(prop.keyOutSpatialTangent(k)); }
            s.keys.push(key);
        }
        return s;
    }

    function restoreProp(prop, s) {
        var k, key;
        if (!s.keys.length) { prop.setValue(s.value); return; }
        for (k = 1; k <= prop.numKeys && k <= s.keys.length; k++) {
            key = s.keys[k - 1];
            prop.setValueAtKey(k, key.v);
            if (prop.isSpatial && key.inTan) { prop.setSpatialTangentsAtKey(k, key.inTan, key.outTan); }
            prop.setTemporalEaseAtKey(k, U.easeFromPlain(key.easeIn), U.easeFromPlain(key.easeOut));
        }
    }

    /* Map one property: f(value) for value and every key; tangents xtk; ease speeds xek. */
    function mapProp(prop, f, tk, ek) {
        var k, ei, eo, ti, to, i;
        if (prop.numKeys === 0) { prop.setValue(f(plain(prop.value))); return; }
        for (k = 1; k <= prop.numKeys; k++) {
            ei = prop.keyInTemporalEase(k);
            eo = prop.keyOutTemporalEase(k);
            if (prop.isSpatial) { ti = plain(prop.keyInSpatialTangent(k)); to = plain(prop.keyOutSpatialTangent(k)); }
            prop.setValueAtKey(k, f(plain(prop.keyValue(k))));
            if (prop.isSpatial) {
                for (i = 0; i < ti.length; i++) { ti[i] = ti[i] * tk; to[i] = to[i] * tk; }
                prop.setSpatialTangentsAtKey(k, ti, to);
            }
            if (ek !== 1) { prop.setTemporalEaseAtKey(k, easeArr(ei, ek), easeArr(eo, ek)); }
        }
    }

    function transformOf(L) { return L.property('ADBE Transform Group'); }

    /* Remap one layer; returns { skipped } or { before: [snapshots] }. */
    function remapLayer(L, s, d) {
        var tg = transformOf(L), pos = tg.property('ADBE Position'), sc = tg.property('ADBE Scale'), before = [], i;
        if (L.parent) { return { skipped: 'PARENTED' }; }
        if ((pos.expressionEnabled && pos.expression) || (sc.expressionEnabled && sc.expression)) { return { skipped: 'EXPRESSION' }; }
        if (pos.dimensionsSeparated) {
            var xs = tg.property('ADBE Position_0'), ys = tg.property('ADBE Position_1');
            if ((xs.expressionEnabled && xs.expression) || (ys.expressionEnabled && ys.expression)) { return { skipped: 'EXPRESSION' }; }
            before.push(snapProp(xs)); before.push(snapProp(ys));
            mapProp(xs, function (v) { return v * s + num(d[0]); }, s, s);
            mapProp(ys, function (v) { return v * s + num(d[1]); }, s, s);
        } else {
            before.push(snapProp(pos));
            mapProp(pos, function (v) { var o = [v[0] * s + num(d[0]), v[1] * s + num(d[1])]; for (i = 2; i < v.length; i++) { o.push(v[i]); } return o; }, s, s);
        }
        before.push(snapProp(sc));
        mapProp(sc, function (v) { var o = [v[0] * s, v[1] * s]; for (i = 2; i < v.length; i++) { o.push(v[i]); } return o; }, 1, s);
        return { before: before };
    }

    function restoreLayer(L, snaps) {
        var tg = transformOf(L), i, p;
        for (i = 0; i < snaps.length; i++) {
            p = tg.property(snaps[i].matchName);
            if (p) { restoreProp(p, snaps[i]); }
        }
    }

    function posNow(L, t) {
        var tg = transformOf(L), pos = tg.property('ADBE Position');
        if (pos.dimensionsSeparated) { return [num(tg.property('ADBE Position_0').valueAtTime(t, true)), num(tg.property('ADBE Position_1').valueAtTime(t, true))]; }
        return plain(pos.valueAtTime(t, true));
    }

    /* args: { compId, label, any, items: [{ layerId, s, d: [dx, dy] }] } */
    ops['transform.remap'] = {
        mutates: true,
        run: function (args) {
            var comp = args.any ? compAny(args.compId) : U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Remap Layers', function () {
                var out = [], i, L, r, it;
                for (i = 0; i < args.items.length; i++) {
                    it = args.items[i];
                    L = U.findLayer(comp, { layerId: it.layerId });
                    if (L.locked) { out.push({ layerId: L.id, name: L.name, skipped: 'LOCKED' }); continue; }
                    r = remapLayer(L, num(it.s), it.d);
                    out.push({ layerId: L.id, name: L.name, skipped: r.skipped || null, before: r.before || null, position: posNow(L, comp.time), scale: plain(transformOf(L).property('ADBE Scale').valueAtTime(comp.time, true)) });
                }
                return { compId: comp.id, layers: out };
            });
        }
    };

    /* args: { compId, any, layers: [{ layerId, before: [snapshots] }] } */
    ops['transform.restore'] = {
        mutates: true,
        run: function (args) {
            var comp = args.any ? compAny(args.compId) : U.compById(args.compId);
            return U.withUndo('MOE: Restore Transform', function () {
                var i;
                for (i = 0; i < args.layers.length; i++) { restoreLayer(U.findLayer(comp, { layerId: args.layers[i].layerId }), args.layers[i].before); }
                return { restored: args.layers.length };
            });
        }
    };

    /* args: { compId, any, label, items: [{ layerId, parentId (null = none) }] } - no compensation (setParentWithJump). */
    ops['layers.setParent'] = {
        mutates: true,
        run: function (args) {
            var comp = args.any ? compAny(args.compId) : U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Parent', function () {
                var out = [], i, L, P;
                for (i = 0; i < args.items.length; i++) {
                    L = U.findLayer(comp, { layerId: args.items[i].layerId });
                    P = args.items[i].parentId ? U.findLayer(comp, { layerId: args.items[i].parentId }) : null;
                    var before = L.parent ? L.parent.id : null;
                    L.setParentWithJump(P);
                    out.push({ layerId: L.id, name: L.name, before: before, after: L.parent ? L.parent.id : null });
                }
                return { layers: out };
            });
        }
    };

    /* ---------- adapt ---------- */

    function makeRig(comp, name, s, d, label) {
        var n = comp.layers.addNull(comp.duration), tg;
        n.name = name;
        n.label = label || 11;
        n.inPoint = 0;
        n.outPoint = comp.duration;
        tg = transformOf(n);
        tg.property('ADBE Anchor Point').setValue([0, 0]);
        tg.property('ADBE Position').setValue([num(d[0]), num(d[1])]);
        tg.property('ADBE Scale').setValue([s * 100, s * 100]);
        return n;
    }

    function layerByIndexMap(src, dst, id) {
        var i;
        for (i = 1; i <= src.numLayers; i++) { if (src.layer(i).id === id) { return dst.layer(i); } }
        return null;
    }

    /*
     * Apply a plan to comp `target` (a duplicate or the original). plan: {
     *   layers: [{ layerId (in source), s, d, method: 'direct'|'rig'|'none', rig: 'name' }],
     *   nested: [{ layerId, plan, name, width, height }] }
     */
    function applyPlan(source, target, plan, report) {
        var i, it, L, r, rigs = {}, rigKey, rec;
        for (i = 0; i < plan.layers.length; i++) {
            it = plan.layers[i];
            L = source === target ? U.findLayer(target, { layerId: it.layerId }) : layerByIndexMap(source, target, it.layerId);
            if (!L) { report.layers.push({ sourceId: it.layerId, skipped: 'NOT_FOUND' }); continue; }
            rec = { sourceId: it.layerId, layerId: L.id, name: L.name, method: it.method, s: num(it.s), d: [num(it.d[0]), num(it.d[1])] };
            if (it.method === 'none') { rec.skipped = 'KEPT'; report.layers.push(rec); continue; }
            if (L.locked) { rec.skipped = 'LOCKED'; report.layers.push(rec); continue; }
            if (it.method === 'direct') {
                r = remapLayer(L, num(it.s), it.d);
                if (!r.skipped) { rec.before = r.before; report.layers.push(rec); continue; }
                if (r.skipped !== 'EXPRESSION') { rec.skipped = r.skipped; report.layers.push(rec); continue; }
                rec.method = 'rig';
                rec.fallback = 'expression on Position/Scale';
            }
            if (L.parent) { rec.skipped = 'PARENTED'; report.layers.push(rec); continue; }
            rigKey = (it.rig || 'Layout') + '|' + num(it.s).toFixed(5) + '|' + num(it.d[0]).toFixed(2) + '|' + num(it.d[1]).toFixed(2);
            if (!rigs[rigKey]) {
                rigs[rigKey] = makeRig(target, 'MOE Adapt \u2022 ' + (it.rig || 'Layout'), num(it.s), it.d, 11);
                report.rigs.push({ layerId: rigs[rigKey].id, name: rigs[rigKey].name, s: num(it.s), d: [num(it.d[0]), num(it.d[1])] });
            }
            L.setParentWithJump(rigs[rigKey]);
            rec.rigId = rigs[rigKey].id;
            report.layers.push(rec);
        }
    }

    function adaptComp(source, args, report, depth) {
        var target, w = Math.round(num(args.width)), h = Math.round(num(args.height)), i, n, srcLayer, dstLayer, sub, subReport;
        if (w < 4 || h < 4 || w > 30000 || h > 30000) { U.fail('BAD_ARGS', 'Size must be between 4 and 30000 px.'); }
        if (args.mode === 'copy') {
            target = source.duplicate();
            target.name = args.name || (source.name + ' ' + w + 'x' + h);
            report.created.push(target.id);
        } else {
            target = source;
            report.sizeBefore = [source.width, source.height];
        }
        target.width = w;
        target.height = h;
        report.compId = target.id;
        report.name = target.name;
        report.size = [target.width, target.height];
        applyPlan(source, target, args.plan, report);
        /* Nested full-frame pre-comps: adapt a duplicate of the source comp and swap it in. */
        for (i = 0; args.nested && i < args.nested.length; i++) {
            n = args.nested[i];
            if (depth >= 3) { report.notes.push('Nested depth limit reached at ' + n.name); continue; }
            srcLayer = U.findLayer(source, { layerId: n.layerId });
            dstLayer = args.mode === 'copy' ? layerByIndexMap(source, target, n.layerId) : srcLayer;
            if (!srcLayer.source || !(srcLayer.source instanceof CompItem)) { report.notes.push(n.name + ' is not a pre-comp'); continue; }
            subReport = { created: [], layers: [], rigs: [], nested: [], notes: [] };
            sub = adaptComp(srcLayer.source, { mode: 'copy', name: n.name, width: n.width, height: n.height, plan: n.plan, nested: n.nested }, subReport, depth + 1);
            dstLayer.replaceSource(sub, false);
            if (n.recenter) {
                transformOf(dstLayer).property('ADBE Anchor Point').setValue([sub.width / 2, sub.height / 2]);
                transformOf(dstLayer).property('ADBE Position').setValue([target.width / 2, target.height / 2]);
            }
            report.created = report.created.concat(subReport.created);
            report.nested.push({ layerId: dstLayer.id, name: dstLayer.name, compId: sub.id, compName: sub.name, layers: subReport.layers, rigs: subReport.rigs });
        }
        return target;
    }

    /* args: { compId, mode: 'copy'|'inplace', name, width, height, open, plan, nested } */
    ops['adapt.apply'] = {
        mutates: true,
        run: function (args) {
            var source = U.compById(args.compId);
            return U.withUndo('MOE: Adapt Layout', function () {
                var report = { created: [], layers: [], rigs: [], nested: [], notes: [], sourceId: source.id };
                var created = [];
                try {
                    var target = adaptComp(source, args, report, 0);
                    created = report.created;
                    if (args.open && args.mode === 'copy') { try { target.openInViewer(); report.opened = true; } catch (eOpen) { report.opened = false; } }
                } catch (e) {
                    /* Copies are disposable: remove what this call created before failing. */
                    var k, it;
                    for (k = report.created.length - 1; k >= 0; k--) { try { it = app.project.itemByID(report.created[k]); it.remove(); } catch (eRm) { /* best effort */ } }
                    throw e;
                }
                report.created = created;
                return report;
            });
        }
    };

    /* args: { ids: [compId], nameContains } - removes comps created by MOE (guarded by name). */
    ops['comps.remove'] = {
        mutates: true,
        run: function (args) {
            return U.withUndo('MOE: Remove Adapted Comps', function () {
                var removed = [], i, c;
                for (i = args.ids.length - 1; i >= 0; i--) {
                    try { c = compAny(args.ids[i]); } catch (e) { continue; }
                    if (args.nameContains && String(c.name).search(args.nameContains) < 0 && c.name !== args.nameContains) { continue; }
                    removed.push(c.name);
                    c.remove();
                }
                return { removed: removed };
            });
        }
    };

    /* args: { compId, width, height, layers: [{ layerId, before }], unparent: [{ layerId, parentId }], rigs: [id] } - undo of in-place adapt. */
    ops['adapt.restoreInPlace'] = {
        mutates: true,
        run: function (args) {
            var comp = compAny(args.compId);
            return U.withUndo('MOE: Restore Layout', function () {
                var i, L;
                for (i = 0; i < args.unparent.length; i++) {
                    L = U.findLayer(comp, { layerId: args.unparent[i].layerId });
                    L.setParentWithJump(args.unparent[i].parentId ? U.findLayer(comp, { layerId: args.unparent[i].parentId }) : null);
                }
                for (i = 0; i < args.rigs.length; i++) {
                    try { L = U.findLayer(comp, { layerId: args.rigs[i] }); if (L.name.substring(0, 9) === 'MOE Adapt') { L.remove(); } } catch (eRig) { /* already gone */ }
                }
                for (i = 0; i < args.layers.length; i++) { restoreLayer(U.findLayer(comp, { layerId: args.layers[i].layerId }), args.layers[i].before); }
                comp.width = args.width;
                comp.height = args.height;
                return { restored: true, size: [comp.width, comp.height] };
            });
        }
    };

    /* ---------- grid helpers ---------- */

    function escq(t) { return String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

    function findShapePath(group, chain, depth) {
        var i, p, r;
        if (depth > 8) { return null; }
        for (i = 1; i <= group.numProperties; i++) {
            p = group.property(i);
            if (p.matchName === 'ADBE Vector Shape - Group') { return { chain: chain + '.content("' + escq(p.name) + '").path', prop: p.property('ADBE Vector Shape') }; }
            if (p.matchName === 'ADBE Vector Group') {
                r = findShapePath(p.property('ADBE Vectors Group'), chain + '.content("' + escq(p.name) + '")', depth + 1);
                if (r) { return r; }
            }
        }
        return null;
    }

    /* args: { compId, layerId } -> { access: 'PL.mask("Mask 1").maskPath' | 'PL.content(..).path', closed, kind, points (vertex count, v0.37) } */
    ops['paths.find'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId), L = U.findLayer(comp, { layerId: args.layerId }), masks, r, root;
            masks = L.property('ADBE Mask Parade');
            if (masks && masks.numProperties > 0) {
                return { kind: 'mask', access: 'PL.mask("' + escq(masks.property(1).name) + '").maskPath', closed: !!masks.property(1).property('ADBE Mask Shape').value.closed, points: masks.property(1).property('ADBE Mask Shape').value.vertices.length, name: L.name };
            }
            root = null;
            try { root = L.property('ADBE Root Vectors Group'); } catch (e) { root = null; }
            if (root) {
                r = findShapePath(root, 'PL', 0);
                if (r) { return { kind: 'shape', access: r.chain, closed: !!r.prop.value.closed, points: r.prop.value.vertices.length, name: L.name }; }
            }
            U.fail('NO_PATH', 'Layer "' + L.name + '" has no mask or shape path. Draw a path with the Pen tool first.');
        }
    };

    /* args: { compId, time, items: [{ address }] } -> values after expressions */
    ops['props.values'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId), out = [], i, r, t = args.time === undefined ? comp.time : num(args.time);
            for (i = 0; i < args.items.length; i++) {
                try { r = U.resolveProperty(comp, args.items[i].address); out.push({ value: plain(r.prop.valueAtTime(t, false)), error: String(r.prop.expressionError || ''), numKeys: r.prop.numKeys || 0 }); }
                catch (e) { out.push({ value: null, error: String(e.message) }); }
            }
            return { time: t, items: out };
        }
    };

    /* args: { compId, label, time, items: [{ address }] } - freeze: value at time becomes static, expression removed. */
    ops['props.bake'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Freeze', function () {
                var out = [], i, r, v, t = args.time === undefined ? comp.time : num(args.time), before;
                for (i = 0; i < args.items.length; i++) {
                    r = U.resolveProperty(comp, args.items[i].address);
                    if (r.prop.numKeys > 0) { out.push({ address: args.items[i].address, skipped: 'KEYFRAMED' }); continue; }
                    v = r.prop.valueAtTime(t, false);
                    before = { value: plain(r.prop.value), expression: String(r.prop.expression || ''), expressionEnabled: !!r.prop.expressionEnabled };
                    r.prop.expression = '';
                    r.prop.setValue(v);
                    out.push({ address: args.items[i].address, before: before, after: plain(r.prop.value) });
                }
                return { items: out };
            });
        }
    };

    /* args: { compId, items: [{ address, value, expression, expressionEnabled }] } - undo of props.bake */
    ops['props.unbake'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Restore', function () {
                var i, r;
                for (i = 0; i < args.items.length; i++) {
                    r = U.resolveProperty(comp, args.items[i].address);
                    r.prop.setValue(args.items[i].value);
                    r.prop.expression = args.items[i].expression;
                    if (args.items[i].expression) { r.prop.expressionEnabled = args.items[i].expressionEnabled; }
                }
                return { restored: args.items.length };
            });
        }
    };

    /* ---------- guides ---------- */

    function sameGuide(g, o, p) { return g.orientationType === o && Math.abs(num(g.position) - num(p)) < 0.01; }

    /* args: { compId, add: [{ o: 0|1, pos }], remove: [{ o, pos }] }  (0 = horizontal, 1 = vertical) */
    ops['guides.set'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            if (typeof comp.addGuide !== 'function') { U.fail('UNSUPPORTED', 'Composition guides need After Effects 16.1 or later.'); }
            return U.withUndo('MOE: Layout Guides', function () {
                var added = [], removed = 0, i, j, g, cleared = [];
                if (args.clearAll) {
                    for (j = comp.guides.length - 1; j >= 0; j--) { g = comp.guides[j]; cleared.unshift({ o: g.orientationType, pos: num(g.position) }); comp.removeGuide(j); }
                }
                for (i = 0; args.remove && i < args.remove.length; i++) {
                    for (j = comp.guides.length - 1; j >= 0; j--) {
                        g = comp.guides[j];
                        if (sameGuide(g, args.remove[i].o, args.remove[i].pos)) { comp.removeGuide(j); removed++; break; }
                    }
                }
                var skipped = 0, dup;
                for (i = 0; args.add && i < args.add.length; i++) {
                    /* v0.53: skipSame - a guide already at that place is not added twice (a preset pressed again) */
                    dup = false;
                    if (args.skipSame) { for (j = 0; j < comp.guides.length; j++) { if (sameGuide(comp.guides[j], args.add[i].o, args.add[i].pos)) { dup = true; break; } } }
                    if (dup) { skipped++; continue; }
                    comp.addGuide(args.add[i].o, num(args.add[i].pos));
                    added.push({ o: args.add[i].o, pos: num(args.add[i].pos) });
                }
                return { added: added, removed: removed, cleared: cleared, skipped: skipped, total: comp.guides.length };
            });
        }
    };

    /* args: { compId, layerId, name } -> { layerId, index, max, keys, created } */
    function amplitudeOf(A) {
        var fx = null, sl = null, mx = 0, i;
        try { fx = A.property('ADBE Effect Parade').property('Both Channels'); } catch (eF) { fx = null; }
        if (!fx) { return null; }
        sl = fx.property(1);
        if (sl.numKeys > 0) { for (i = 1; i <= sl.numKeys; i++) { mx = Math.max(mx, num(sl.keyValue(i))); } } else { mx = num(sl.value); }
        return { max: mx, keys: sl.numKeys };
    }
    ops['audio.amplitude'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId), L = U.findLayer(comp, { layerId: args.layerId }), i, A, before = {}, sel = [], cmd = 0, made = null, amp;
            if (!L.hasAudio) { U.fail('NO_AUDIO', L.name + ' has no audio.'); }
            for (i = 1; i <= comp.numLayers; i++) {
                if (comp.layer(i).name === args.name) { amp = amplitudeOf(comp.layer(i)); if (amp) { return { layerId: comp.layer(i).id, index: comp.layer(i).index, max: amp.max, keys: amp.keys, created: false }; } }
            }
            try { cmd = app.findMenuCommandId('Convert Audio to Keyframes'); } catch (eC) { cmd = 0; }
            if (!cmd) { U.fail('NO_COMMAND', 'Convert Audio to Keyframes is not available - run Animation > Keyframe Assistant > Convert Audio to Keyframes on the sound layer, then try again.'); }
            return U.withUndo('MOE: Audio to Keyframes', function () {
                for (i = 1; i <= comp.numLayers; i++) { before[comp.layer(i).id] = true; if (comp.layer(i).selected) { sel.push(comp.layer(i)); } comp.layer(i).selected = false; }
                L.selected = true;
                try { app.executeCommand(cmd); } finally {
                    L.selected = false;
                    for (i = 0; i < sel.length; i++) { sel[i].selected = true; }
                }
                for (i = 1; i <= comp.numLayers; i++) { if (!before[comp.layer(i).id]) { made = comp.layer(i); break; } }
                if (!made) { U.fail('NOT_CREATED', 'After Effects did not add an Audio Amplitude layer.'); }
                amp = amplitudeOf(made);
                if (!amp) { made.remove(); U.fail('NOT_CREATED', 'The new layer has no Both Channels slider - removed.'); }
                made.name = args.name;
                made.moveToEnd();
                return { layerId: made.id, index: made.index, max: amp.max, keys: amp.keys, created: true };
            });
        }
    };
}($.global));
