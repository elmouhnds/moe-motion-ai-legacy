/*
 * MOE Motion AI - Quick Bar operations (ExtendScript / ES3). Small one-click helpers.
 *   project.reveal       select the item in the Project panel / open its folder / open a pre-comp
 *   app.purge            app.purge(PurgeTarget.*)
 *   comps.deepDuplicate  duplicate a comp and every nested pre-comp (independent copy)
 *   layers.flip          negate Scale X or Y (value, keys, ease speeds) - running it twice restores
 *   layers.parentToNull  new null at a point; layers parented with the documented compensation (Layer.parent)
 *   layers.unparentFromNull  reverse of the above
 *   layers.precompose    LayerCollection.precompose
 *   position.separate    Separate Dimensions keeping each key's temporal influence; speeds split by direction
 *   props.select         select properties by matchName path on layers
 *   keys.snapshot / keys.rebuild / keys.reverse / keys.mirror
 *   shapes.trim          add (or reuse) a "MOE Trim" Trim Paths operator on a shape layer
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function plain(v) {
        if (v && typeof v === 'object' && v.length !== undefined) { var a = [], i; for (i = 0; i < v.length; i++) { a.push(num(v[i])); } return a; }
        return typeof v === 'boolean' ? (v ? 1 : 0) : num(v);
    }

    /* args: { compId, layerId (optional), mode: 'project'|'folder'|'open' } */
    ops['project.reveal'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId), L = args.layerId ? U.findLayer(comp, { layerId: args.layerId }) : null, item = L && L.source ? L.source : comp, f = null, cmd = 0;
            if (args.mode === 'open') {
                if (!(item instanceof CompItem) || item === comp) { U.fail('NOT_PRECOMP', 'Select a pre-comp layer to open.'); }
                item.openInViewer();
                return { opened: item.name };
            }
            if (args.mode === 'folder') {
                try { f = item.file || null; } catch (eF) { f = null; }
                if (!f && app.project.file) { f = app.project.file; }
                if (!f) { U.fail('NO_FILE', 'No file on disk: save the project or select a footage layer.'); }
                if (typeof Folder === 'undefined') { U.fail('UNSUPPORTED', 'Folder is not available.'); }
                var dir = new Folder(f.parent.fsName);
                if (!dir.exists) { U.fail('MISSING', 'Folder not found: ' + dir.fsName); }
                dir.execute();
                return { folder: dir.fsName, file: f.name };
            }
            item.selected = true;
            try { cmd = app.findMenuCommandId('Reveal Layer Source in Project'); } catch (eC) { cmd = 0; }
            if (L && L.source && cmd) { L.selected = true; app.executeCommand(cmd); }
            return { item: item.name, revealed: true, viaMenu: !!(L && L.source && cmd) };
        }
    };

    /* args: { target: 'image'|'all'|'undo'|'snapshot' } */
    ops['app.purge'] = {
        mutates: false,
        run: function (args) {
            var map = { image: 'IMAGE_CACHES', all: 'ALL_CACHES', undo: 'UNDO_CACHES', snapshot: 'SNAPSHOT_CACHES' };
            if (!map[args.target]) { U.fail('BAD_ARGS', 'Unknown purge target ' + args.target); }
            app.purge(PurgeTarget[map[args.target]]);
            return { purged: args.target };
        }
    };

    function deepDup(comp, suffix, map, created, depth) {
        var d = comp.duplicate(), i, L, src;
        d.name = comp.name + suffix;
        created.push(d.id);
        if (depth > 6) { return d; }
        for (i = 1; i <= d.numLayers; i++) {
            L = d.layer(i);
            src = null;
            try { src = L.source; } catch (e) { src = null; }
            if (src && src instanceof CompItem) {
                if (!map['c' + src.id]) { map['c' + src.id] = deepDup(src, suffix, map, created, depth + 1); }
                L.replaceSource(map['c' + src.id], false);
            }
        }
        return d;
    }

    /* args: { compId, suffix } */
    ops['comps.deepDuplicate'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Duplicate Comp (deep)', function () {
                var created = [], d = deepDup(comp, args.suffix || ' copy', {}, created, 0);
                return { compId: d.id, name: d.name, created: created };
            });
        }
    };

    function scaleProp(L) { return L.property('ADBE Transform Group').property('ADBE Scale'); }

    /* args: { compId, layerIds, axis: 'h'|'v' } */
    ops['layers.flip'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId), d = args.axis === 'v' ? 1 : 0;
            return U.withUndo(args.axis === 'v' ? 'MOE: Flip Vertical' : 'MOE: Flip Horizontal', function () {
                var out = [], i, L, p, k, v, ei, eo;
                for (i = 0; i < args.layerIds.length; i++) {
                    L = U.findLayer(comp, { layerId: args.layerIds[i] });
                    p = scaleProp(L);
                    if (L.locked || (p.expressionEnabled && p.expression)) { out.push({ layerId: L.id, name: L.name, skipped: L.locked ? 'LOCKED' : 'EXPRESSION' }); continue; }
                    if (p.numKeys === 0) { v = plain(p.value); v[d] = -v[d]; p.setValue(v); }
                    for (k = 1; k <= p.numKeys; k++) {
                        ei = p.keyInTemporalEase(k); eo = p.keyOutTemporalEase(k);
                        v = plain(p.keyValue(k)); v[d] = -v[d]; p.setValueAtKey(k, v);
                        ei[d] = new KeyframeEase(-ei[d].speed, ei[d].influence); eo[d] = new KeyframeEase(-eo[d].speed, eo[d].influence);
                        p.setTemporalEaseAtKey(k, ei, eo);
                    }
                    out.push({ layerId: L.id, name: L.name, scale: plain(p.valueAtTime(comp.time, true)), keys: p.numKeys });
                }
                return { layers: out };
            });
        }
    };

    /* args: { compId, layerIds, name, position: [x, y] } - Layer.parent keeps each layer where it is (pick-whip behaviour). */
    ops['layers.parentToNull'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Parent to Null', function () {
                var n = comp.layers.addNull(comp.duration), i, L, out = [], top = comp.numLayers + 1;
                n.name = args.name;
                n.label = 13;
                n.property('ADBE Transform Group').property('ADBE Position').setValue([num(args.position[0]), num(args.position[1])]);
                for (i = 0; i < args.layerIds.length; i++) {
                    L = U.findLayer(comp, { layerId: args.layerIds[i] });
                    if (L.index < top) { top = L.index; }
                    out.push({ layerId: L.id, name: L.name, before: L.parent ? L.parent.id : null });
                    L.parent = n;
                }
                if (top - 1 > 1) { n.moveBefore(comp.layer(top)); }
                return { nullId: n.id, name: n.name, layers: out };
            });
        }
    };

    /* args: { compId, nullId, layers: [{ layerId, before }] } */
    ops['layers.unparentFromNull'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Remove Parent Null', function () {
                var i, L;
                for (i = 0; i < args.layers.length; i++) {
                    L = U.findLayer(comp, { layerId: args.layers[i].layerId });
                    L.parent = args.layers[i].before ? U.findLayer(comp, { layerId: args.layers[i].before }) : null;
                }
                L = U.findLayer(comp, { layerId: args.nullId });
                L.remove();
                return { restored: args.layers.length };
            });
        }
    };

    /* args: { compId, layerIds, name, moveAll } */
    ops['layers.precompose'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Pre-compose', function () {
                var idx = [], i, L;
                for (i = 0; i < args.layerIds.length; i++) { idx.push(U.findLayer(comp, { layerId: args.layerIds[i] }).index); }
                idx.sort(function (a, b) { return a - b; });
                var pc = comp.layers.precompose(idx, args.name, args.moveAll !== false);
                L = comp.layer(idx[0]);
                return { compId: pc.id, name: pc.name, layerId: L.id, layerName: L.name, numLayers: pc.numLayers, size: [pc.width, pc.height] };
            });
        }
    };

    /* args: { compId, layerIds } - keep each key's influence; split speed by the motion direction. */
    ops['position.separate'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Separate X/Y', function () {
                var out = [], i, L, tg, pos, keys, k, n, dims, d, P, prev, next, inDir, outDir, len, e, j;
                for (i = 0; i < args.layerIds.length; i++) {
                    L = U.findLayer(comp, { layerId: args.layerIds[i] });
                    tg = L.property('ADBE Transform Group');
                    pos = tg.property('ADBE Position');
                    if (pos.dimensionsSeparated) { out.push({ layerId: L.id, name: L.name, skipped: 'ALREADY' }); continue; }
                    if (pos.expressionEnabled && pos.expression) { out.push({ layerId: L.id, name: L.name, skipped: 'EXPRESSION' }); continue; }
                    keys = [];
                    for (k = 1; k <= pos.numKeys; k++) {
                        keys.push({ t: pos.keyTime(k), v: plain(pos.keyValue(k)), ei: U.easeToPlain(pos.keyInTemporalEase(k)), eo: U.easeToPlain(pos.keyOutTemporalEase(k)), it: pos.keyInInterpolationType(k), ot: pos.keyOutInterpolationType(k) });
                    }
                    pos.dimensionsSeparated = true;
                    dims = L.threeDLayer ? 3 : 2;
                    n = keys.length;
                    for (d = 0; d < dims; d++) {
                        P = L.property('ADBE Transform Group').property('ADBE Position_' + d);
                        for (k = 1; k <= P.numKeys; k++) {
                            e = keys[k - 1];
                            prev = k > 1 ? keys[k - 2].v : e.v; next = k < n ? keys[k].v : e.v;
                            inDir = 0; outDir = 0;
                            len = 0; for (j = 0; j < dims; j++) { len += Math.pow(e.v[j] - prev[j], 2); } len = Math.sqrt(len);
                            if (len > 0) { inDir = (e.v[d] - prev[d]) / len; }
                            len = 0; for (j = 0; j < dims; j++) { len += Math.pow(next[j] - e.v[j], 2); } len = Math.sqrt(len);
                            if (len > 0) { outDir = (next[d] - e.v[d]) / len; }
                            P.setInterpolationTypeAtKey(k, e.it, e.ot);
                            P.setTemporalEaseAtKey(k, [new KeyframeEase(e.ei[0].speed * inDir, e.ei[0].influence)], [new KeyframeEase(e.eo[0].speed * outDir, e.eo[0].influence)]);
                        }
                    }
                    out.push({ layerId: L.id, name: L.name, keys: n });
                }
                return { layers: out };
            });
        }
    };

    /* args: { compId, items: [{ layerId, matchNames }], clearOthers } */
    ops['props.select'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId), found = 0, missing = 0, i, r;
            for (i = 0; i < args.items.length; i++) {
                try { r = U.resolveProperty(comp, { layerId: args.items[i].layerId, matchNames: args.items[i].matchNames }); r.prop.selected = true; found++; }
                catch (e) { missing++; }
            }
            return { selected: found, missing: missing };
        }
    };

    /* Key values as JSON-safe data (numbers, arrays, Shapes). */
    function ser(v) {
        if (v && typeof v === 'object' && v.vertices !== undefined) { return { shape: { vertices: v.vertices, inTangents: v.inTangents, outTangents: v.outTangents, closed: !!v.closed } }; }
        return plain(v);
    }
    function des(v) {
        if (v && typeof v === 'object' && v.shape) { var s = new Shape(); s.vertices = v.shape.vertices; s.inTangents = v.shape.inTangents; s.outTangents = v.shape.outTangents; s.closed = v.shape.closed; return s; }
        return v;
    }
    function keyable(p) { return p.propertyValueType !== PropertyValueType.TEXT_DOCUMENT && p.propertyValueType !== PropertyValueType.CUSTOM_VALUE && p.propertyValueType !== PropertyValueType.MARKER; }

    function snapKeys(p) {
        var out = [], k;
        for (k = 1; k <= p.numKeys; k++) {
            var s = { t: p.keyTime(k), v: ser(p.keyValue(k)), ei: U.easeToPlain(p.keyInTemporalEase(k)), eo: U.easeToPlain(p.keyOutTemporalEase(k)), it: U.interpName(p.keyInInterpolationType(k)), ot: U.interpName(p.keyOutInterpolationType(k)) };
            if (p.isSpatial) { s.inTan = plain(p.keyInSpatialTangent(k)); s.outTan = plain(p.keyOutSpatialTangent(k)); }
            out.push(s);
        }
        return out;
    }
    function writeKeys(p, list) {
        var j, k, s;
        for (j = 0; j < list.length; j++) { p.setValueAtTime(list[j].t, des(list[j].v)); }
        for (j = 0; j < list.length; j++) {
            s = list[j];
            for (k = 1; k <= p.numKeys; k++) { if (Math.abs(p.keyTime(k) - s.t) < 0.0005) { break; } }
            if (k > p.numKeys) { continue; }
            p.setInterpolationTypeAtKey(k, U.interpFromName(s.it), U.interpFromName(s.ot));
            if (s.it !== 'HOLD' || s.ot !== 'HOLD') { try { p.setTemporalEaseAtKey(k, U.easeFromPlain(s.ei), U.easeFromPlain(s.eo)); } catch (eE) { /* linear */ } }
            if (p.isSpatial && s.inTan) { p.setSpatialTangentsAtKey(k, s.inTan, s.outTan); }
        }
    }
    function removeAll(p, times) {
        var k, j;
        for (k = p.numKeys; k >= 1; k--) {
            if (!times) { p.removeKey(k); continue; }
            for (j = 0; j < times.length; j++) { if (Math.abs(p.keyTime(k) - times[j]) < 0.0005) { p.removeKey(k); break; } }
        }
    }

    /* args: { compId, items: [{ address, keys: [index] | null }] } - reverse in time within the selected span. */
    ops['keys.reverse'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Reverse Keyframes', function () {
                var out = [], i, r, p, all, sel, j, t0, t1, list, s;
                for (i = 0; i < args.items.length; i++) {
                    r = U.resolveProperty(comp, args.items[i].address);
                    p = r.prop;
                    if (p.numKeys < 2) { out.push({ address: args.items[i].address, skipped: 'FEW_KEYS' }); continue; }
                    if (!keyable(p)) { out.push({ address: args.items[i].address, skipped: 'UNSUPPORTED_TYPE' }); continue; }
                    all = snapKeys(p);
                    sel = args.items[i].keys && args.items[i].keys.length > 1 ? args.items[i].keys : null;
                    list = [];
                    t0 = Infinity; t1 = -Infinity;
                    for (j = 0; j < all.length; j++) {
                        if (sel) { var inSel = false, q; for (q = 0; q < sel.length; q++) { if (sel[q] === j + 1) { inSel = true; } } if (!inSel) { continue; } }
                        list.push(all[j]);
                        if (all[j].t < t0) { t0 = all[j].t; } if (all[j].t > t1) { t1 = all[j].t; }
                    }
                    var times = []; for (j = 0; j < list.length; j++) { times.push(list[j].t); }
                    removeAll(p, times);
                    var rev = [];
                    for (j = 0; j < list.length; j++) {
                        s = list[j];
                        rev.push({ t: t0 + t1 - s.t, v: s.v, ei: s.eo, eo: s.ei, it: s.ot, ot: s.it, inTan: s.outTan, outTan: s.inTan });
                    }
                    writeKeys(p, rev);
                    out.push({ address: args.items[i].address, name: p.name, layerName: r.layer.name, reversed: list.length, span: [t0, t1], snapshot: all });
                }
                return { items: out };
            });
        }
    };

    /* args: { compId, items: [{ address, snapshot }] } - rebuild keys exactly (restore). */
    ops['keys.rebuild'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Restore Keyframes', function () {
                var i, r;
                for (i = 0; i < args.items.length; i++) {
                    r = U.resolveProperty(comp, args.items[i].address);
                    removeAll(r.prop, null);
                    writeKeys(r.prop, args.items[i].snapshot);
                }
                return { restored: args.items.length };
            });
        }
    };

    /* args: { compId, at, mode: 'mirror'|'clone', items: [{ address, keys: [index] }] } */
    ops['keys.mirror'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Clone & Mirror Keys', function () {
                var out = [], i, r, p, all, sel, j, list, t0, t1, at = num(args.at), w, s;
                for (i = 0; i < args.items.length; i++) {
                    r = U.resolveProperty(comp, args.items[i].address);
                    p = r.prop;
                    if (!keyable(p)) { out.push({ address: args.items[i].address, skipped: 'UNSUPPORTED_TYPE' }); continue; }
                    all = snapKeys(p);
                    sel = args.items[i].keys;
                    list = []; t0 = Infinity; t1 = -Infinity;
                    for (j = 0; j < sel.length; j++) { s = all[sel[j] - 1]; if (!s) { continue; } list.push(s); if (s.t < t0) { t0 = s.t; } if (s.t > t1) { t1 = s.t; } }
                    if (!list.length) { out.push({ address: args.items[i].address, skipped: 'NO_KEYS' }); continue; }
                    w = [];
                    for (j = 0; j < list.length; j++) {
                        s = list[j];
                        if (args.mode === 'clone') { w.push({ t: at + (s.t - t0), v: s.v, ei: s.ei, eo: s.eo, it: s.it, ot: s.ot, inTan: s.inTan, outTan: s.outTan }); }
                        else { w.push({ t: at + (t1 - s.t), v: s.v, ei: s.eo, eo: s.ei, it: s.ot, ot: s.it, inTan: s.outTan, outTan: s.inTan }); }
                    }
                    var replaced = [];
                    for (j = 0; j < w.length; j++) { for (var k = 1; k <= p.numKeys; k++) { if (Math.abs(p.keyTime(k) - w[j].t) < 0.0005) { replaced.push(all[k - 1]); } } }
                    writeKeys(p, w);
                    var times = []; for (j = 0; j < w.length; j++) { times.push(w[j].t); }
                    out.push({ address: args.items[i].address, name: p.name, layerName: r.layer.name, written: times, replaced: replaced.length, snapshot: all });
                }
                return { items: out };
            });
        }
    };

    /* args: { compId, layerId } -> addresses of a "MOE Trim" Trim Paths operator (created if missing). */
    ops['shapes.trim'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Trim Paths', function () {
                var L = U.findLayer(comp, { layerId: args.layerId }), root = null, i, t = null, created = false;
                try { root = L.property('ADBE Root Vectors Group'); } catch (e) { root = null; }
                if (!root) { U.fail('NOT_SHAPE', '"' + L.name + '" is not a shape layer.'); }
                for (i = 1; i <= root.numProperties; i++) { if (root.property(i).name === 'MOE Trim' && root.property(i).matchName === 'ADBE Vector Filter - Trim') { t = root.property(i); } }
                if (!t) { t = root.addProperty('ADBE Vector Filter - Trim'); t.name = 'MOE Trim'; created = true; }
                var base = ['ADBE Root Vectors Group', 'name:MOE Trim'];
                return {
                    layerId: L.id, name: L.name, created: created,
                    start: { layerId: L.id, matchNames: base.concat(['ADBE Vector Trim Start']) },
                    end: { layerId: L.id, matchNames: base.concat(['ADBE Vector Trim End']) },
                    offset: { layerId: L.id, matchNames: base.concat(['ADBE Vector Trim Offset']) }
                };
            });
        }
    };

    /* args: { compId, layerId } - remove the MOE Trim operator (restore when it was created by MOE). */
    ops['shapes.untrim'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Remove Trim Paths', function () {
                var L = U.findLayer(comp, { layerId: args.layerId }), root = L.property('ADBE Root Vectors Group'), i, n = 0;
                for (i = root.numProperties; i >= 1; i--) { if (root.property(i).name === 'MOE Trim') { root.property(i).remove(); n++; } }
                return { removed: n };
            });
        }
    };
}($.global));
