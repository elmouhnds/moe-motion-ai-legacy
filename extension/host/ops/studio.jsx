/*
 * MOE Motion AI — studio operations (ExtendScript / ES3).
 *   props.colorTargets  find fill/stroke colour properties inside shape layers
 *   props.setValues     set values on addressed properties (before/after; at current time if keyframed)
 *   layers.createNull   named null (effectors)
 *   layers.centerAnchor centre anchor point on content without visual jump
 *   layers.restoreTransform restore anchor/position values
 *   layers.list         lightweight layer list for a scope (selection tools)
 *   layers.setSelection replace/add/remove selection per comp
 *   layers.setSwitch    solo / enabled / locked / shy / label on layers
 *   labels.get          label names + colours (preferences, with documented defaults)
 *   effects.find        installed effects matching a query (app.effects)
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function plain(v) {
        if (v && typeof v === 'object' && v.length !== undefined) { var a = [], i; for (i = 0; i < v.length; i++) { a.push(num(v[i])); } return a; }
        return typeof v === 'boolean' ? (v ? 1 : 0) : num(v);
    }

    function walkColors(group, layer, mode, out, depth) {
        var i, p, mn;
        if (depth > 12) { return; }
        for (i = 1; i <= group.numProperties; i++) {
            p = group.property(i);
            mn = p.matchName;
            if (mn === 'ADBE Vector Graphic - Fill' && mode !== 'stroke') {
                out.push(U.addressOf(p.property('ADBE Vector Fill Color'), layer));
            } else if (mn === 'ADBE Vector Graphic - Stroke' && mode !== 'fill') {
                out.push(U.addressOf(p.property('ADBE Vector Stroke Color'), layer));
            } else if (p.propertyType !== PropertyType.PROPERTY) {
                walkColors(p, layer, mode, out, depth + 1);
            }
        }
    }

    /* args: { compId, layers: [layerId], mode: fill|stroke|both } */
    ops['props.colorTargets'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId), out = [], i, layer, list, contents;
            for (i = 0; i < args.layers.length; i++) {
                layer = U.findLayer(comp, { layerId: args.layers[i] });
                list = [];
                contents = null;
                try { contents = layer.property('ADBE Root Vectors Group'); } catch (e) { contents = null; }
                if (contents) { walkColors(contents, layer, args.mode || 'fill', list, 0); }
                out.push({ layerId: layer.id, name: layer.name, addresses: list });
            }
            return { layers: out };
        }
    };

    /* args: { compId, label, items: [{ address, value }] } */
    ops['props.setValues'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Set Values', function () {
                var out = [], i, r, p, before, atTime;
                for (i = 0; i < args.items.length; i++) {
                    r = U.resolveProperty(comp, args.items[i].address);
                    p = r.prop;
                    if (r.layer.locked) { out.push({ address: args.items[i].address, skipped: 'LOCKED' }); continue; }
                    atTime = p.numKeys > 0;
                    before = plain(atTime ? p.valueAtTime(comp.time, true) : p.value);
                    if (atTime) { p.setValueAtTime(comp.time, args.items[i].value); } else { p.setValue(args.items[i].value); }
                    out.push({ address: args.items[i].address, name: p.name, layerName: r.layer.name, atTime: atTime ? comp.time : null, before: before, after: plain(atTime ? p.valueAtTime(comp.time, true) : p.value) });
                }
                return { items: out };
            });
        }
    };

    /* args: { compId, name, position: [x, y], label, anchor: [x, y], threeD, guide } */
    ops['layers.createNull'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.undoLabel || 'MOE: New Null', function () {
                var n = comp.layers.addNull(comp.duration), tg;
                n.name = args.name;
                if (args.label !== undefined) { n.label = args.label; }
                if (args.threeD) { n.threeDLayer = true; }
                tg = n.property('ADBE Transform Group');
                if (args.anchor) { tg.property('ADBE Anchor Point').setValue(args.threeD ? [num(args.anchor[0]), num(args.anchor[1]), 0] : [num(args.anchor[0]), num(args.anchor[1])]); }
                if (args.position) { tg.property('ADBE Position').setValue(args.threeD ? [num(args.position[0]), num(args.position[1]), num(args.position[2])] : [num(args.position[0]), num(args.position[1])]); }
                return { layerId: n.id, index: n.index, name: n.name };
            });
        }
    };

    /* args: { compId, layers: [layerId] } */
    ops['layers.centerAnchor'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Center Anchor', function () {
                var out = [], i, layer, tr, ap, pos, sc, rot, rect, a0, a1, dx, dy, c, s, rad;
                for (i = 0; i < args.layers.length; i++) {
                    layer = U.findLayer(comp, { layerId: args.layers[i] });
                    tr = layer.property('ADBE Transform Group');
                    ap = tr.property('ADBE Anchor Point');
                    pos = tr.property('ADBE Position');
                    if (layer.locked || ap.numKeys > 0 || pos.numKeys > 0 || pos.dimensionsSeparated) {
                        out.push({ layerId: layer.id, name: layer.name, skipped: layer.locked ? 'LOCKED' : 'KEYFRAMED' });
                        continue;
                    }
                    rect = layer.sourceRectAtTime(comp.time, false);
                    a0 = plain(ap.value);
                    a1 = [rect.left + rect.width / 2, rect.top + rect.height / 2];
                    sc = plain(tr.property('ADBE Scale').value);
                    rot = num(tr.property('ADBE Rotate Z').value);
                    dx = (a1[0] - a0[0]) * sc[0] / 100;
                    dy = (a1[1] - a0[1]) * sc[1] / 100;
                    rad = rot * Math.PI / 180; c = Math.cos(rad); s = Math.sin(rad);
                    var p0 = plain(pos.value);
                    var p1 = [p0[0] + dx * c - dy * s, p0[1] + dx * s + dy * c];
                    if (p0.length > 2) { p1.push(p0[2]); a1.push(a0[2] || 0); }
                    ap.setValue(a1);
                    pos.setValue(p1);
                    out.push({ layerId: layer.id, name: layer.name, before: { anchor: a0, position: p0 }, after: { anchor: plain(ap.value), position: plain(pos.value) } });
                }
                return { layers: out };
            });
        }
    };

    /* args: { compId, layers: [{ layerId, anchor, position }] } */
    ops['layers.restoreTransform'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Restore Anchor', function () {
                var i, layer, tr;
                for (i = 0; i < args.layers.length; i++) {
                    layer = U.findLayer(comp, { layerId: args.layers[i].layerId });
                    tr = layer.property('ADBE Transform Group');
                    tr.property('ADBE Anchor Point').setValue(args.layers[i].anchor);
                    tr.property('ADBE Position').setValue(args.layers[i].position);
                }
                return { restored: args.layers.length };
            });
        }
    };

    /* args: { compId, items: [{ address }] } -> current expressions (read-only) */
    ops['expressions.peek'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId), out = [], i, r;
            for (i = 0; i < args.items.length; i++) {
                try {
                    r = U.resolveProperty(comp, args.items[i].address);
                    out.push({ found: true, expression: r.prop.canSetExpression ? String(r.prop.expression || '') : '', canSet: r.prop.canSetExpression });
                } catch (e) { out.push({ found: false, expression: '', error: String(e.message) }); }
            }
            return { items: out };
        }
    };

    /* args: { compId, layerIds, onlyNamed } — removes layers MOE created (name prefix guard). */
    ops['layers.remove'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Remove Layer', function () {
                var removed = [], i, L;
                for (i = 0; i < args.layerIds.length; i++) {
                    L = U.findLayer(comp, { layerId: args.layerIds[i] });
                    if (args.onlyNamed && L.name.substring(0, args.onlyNamed.length) !== args.onlyNamed) { continue; }
                    removed.push(L.name);
                    L.remove();
                }
                return { removed: removed };
            });
        }
    };

    function scanTagged(group, layer, tag, out, depth) {
        var i, p;
        if (depth > 10) { return; }
        for (i = 1; i <= group.numProperties; i++) {
            p = group.property(i);
            if (p.propertyType === PropertyType.PROPERTY) {
                if (p.canSetExpression && String(p.expression || '').substring(0, tag.length) === tag) { out.push(U.addressOf(p, layer)); }
            } else { scanTagged(p, layer, tag, out, depth + 1); }
        }
    }

    /* args: { compId, layerIds (null = all), tag } -> tagged expressions + MOE Prox effects */
    ops['proximity.scan'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId), exprs = [], fx = [], i, j, L, parade, want = null;
            if (args.layerIds) { want = {}; for (i = 0; i < args.layerIds.length; i++) { want[args.layerIds[i]] = true; } }
            for (i = 1; i <= comp.numLayers; i++) {
                L = comp.layer(i);
                if (want && !want[L.id]) { continue; }
                scanTagged(L, L, args.tag, exprs, 0);
                parade = null;
                try { parade = L.property('ADBE Effect Parade'); } catch (e) { parade = null; }
                if (parade) {
                    for (j = 1; j <= parade.numProperties; j++) {
                        if (parade.property(j).name.substring(0, 9) === 'MOE Prox ') { fx.push({ layerId: L.id, key: parade.property(j).name, matchName: parade.property(j).matchName }); }
                    }
                }
            }
            return { expressions: exprs, effects: fx };
        }
    };

    /* ---------- selection tools (Moe Selector) ---------- */

    function hasExpressions(group, depth) {
        var i, p;
        if (depth > 10) { return false; }
        for (i = 1; i <= group.numProperties; i++) {
            p = group.property(i);
            if (p.propertyType === PropertyType.PROPERTY) {
                if (p.canSetExpression && p.expressionEnabled && p.expression !== '') { return true; }
            } else if (hasExpressions(p, depth + 1)) { return true; }
        }
        return false;
    }

    function describeLayer(L, comp, deep) {
        var o = {
            compId: comp.id, id: L.id, index: L.index, name: L.name, type: U.layerType(L),
            label: L.label, selected: L.selected, enabled: L.enabled, locked: L.locked, shy: L.shy, solo: L.solo,
            comment: L.comment || '', inPoint: L.inPoint, outPoint: L.outPoint,
            threeD: !!L.threeDLayer, guide: !!L.guideLayer, motionBlur: !!L.motionBlur,
            sourceName: '', ext: '', sourceId: null, footage: '', hasVideo: false, hasAudio: false, effects: []
        };
        try {
            if (L.source) {
                o.sourceName = L.source.name;
                o.sourceId = L.source.id;
                o.hasVideo = !!L.source.hasVideo;
                o.hasAudio = !!L.source.hasAudio;
                if (L.source instanceof CompItem) { o.footage = 'precomp'; }
                else if (L.source.mainSource) {
                    if (L.source.mainSource instanceof SolidSource) { o.footage = 'solid'; }
                    else if (L.source.mainSource instanceof FileSource) {
                        o.footage = L.source.mainSource.isStill ? 'image' : (L.source.hasVideo ? 'video' : 'audio');
                        if (L.source.file) { var nm = L.source.file.name; var dot = nm.lastIndexOf('.'); o.ext = dot >= 0 ? nm.substring(dot + 1).toLowerCase() : ''; }
                    }
                }
            }
        } catch (eSrc) { /* no source */ }
        try {
            var parade = L.property('ADBE Effect Parade'), i;
            if (parade) { for (i = 1; i <= parade.numProperties && i <= 30; i++) { o.effects.push(parade.property(i).matchName); } }
        } catch (eFx) { /* none */ }
        if (deep) { try { o.expressions = hasExpressions(L, 0); } catch (eEx) { o.expressions = false; } }
        return o;
    }

    function scopeComps(scope) {
        var comps = [], i, it;
        if (!app.project) { return comps; }
        if (scope === 'project') {
            for (i = 1; i <= app.project.numItems; i++) { it = app.project.item(i); if (it instanceof CompItem) { comps.push(it); } }
        } else if (scope === 'selectedComps') {
            for (i = 0; i < app.project.selection.length; i++) { it = app.project.selection[i]; if (it instanceof CompItem) { comps.push(it); } }
        } else if (app.project.activeItem instanceof CompItem) {
            comps.push(app.project.activeItem);
        }
        return comps;
    }

    /* args: { scope: active|selectedComps|project, deep, maxLayers } */
    ops['layers.list'] = {
        mutates: false,
        run: function (args) {
            var comps = scopeComps(args.scope), out = [], c, i, comp, max = args.maxLayers || 5000, truncated = false;
            for (c = 0; c < comps.length; c++) {
                comp = comps[c];
                for (i = 1; i <= comp.numLayers; i++) {
                    if (out.length >= max) { truncated = true; break; }
                    out.push(describeLayer(comp.layer(i), comp, !!args.deep));
                }
            }
            var names = [];
            for (c = 0; c < comps.length; c++) { names.push({ id: comps[c].id, name: comps[c].name, time: comps[c].time }); }
            return { comps: names, layers: out, truncated: truncated };
        }
    };

    function compById(id) {
        var i, it;
        for (i = 1; i <= app.project.numItems; i++) { it = app.project.item(i); if (it.id === id && it instanceof CompItem) { return it; } }
        U.fail('COMP_NOT_FOUND', 'Composition not found.');
    }

    /* args: { items: [{ compId, layerIds: [], mode: replace|add|remove }] } */
    ops['layers.setSelection'] = {
        mutates: false,
        run: function (args) {
            var out = [], i, j, comp, it, set, L, count;
            for (i = 0; i < args.items.length; i++) {
                it = args.items[i];
                comp = compById(it.compId);
                set = {};
                for (j = 0; j < it.layerIds.length; j++) { set[it.layerIds[j]] = true; }
                count = 0;
                for (j = 1; j <= comp.numLayers; j++) {
                    L = comp.layer(j);
                    if (it.mode === 'add') { if (set[L.id]) { L.selected = true; } }
                    else if (it.mode === 'remove') { if (set[L.id]) { L.selected = false; } }
                    else { L.selected = !!set[L.id]; }
                    if (L.selected) { count++; }
                }
                out.push({ compId: comp.id, selected: count });
            }
            return { comps: out };
        }
    };

    /* args: { label, items: [{ compId, layerIds }], prop: solo|enabled|locked|shy|label, value (bool|int|'toggle') } */
    ops['layers.setSwitch'] = {
        mutates: true,
        run: function (args) {
            var allowed = { solo: 1, enabled: 1, locked: 1, shy: 1, label: 1 };
            if (!allowed[args.prop]) { U.fail('BAD_ARGS', 'Unsupported layer switch: ' + args.prop); }
            return U.withUndo(args.label || ('MOE: ' + args.prop), function () {
                var out = [], i, j, comp, L, set, before;
                for (i = 0; i < args.items.length; i++) {
                    comp = compById(args.items[i].compId);
                    set = {};
                    for (j = 0; j < args.items[i].layerIds.length; j++) { set[args.items[i].layerIds[j]] = true; }
                    for (j = 1; j <= comp.numLayers; j++) {
                        L = comp.layer(j);
                        if (!set[L.id]) { continue; }
                        before = L[args.prop];
                        if (args.prop === 'solo' && !(L instanceof AVLayer)) { out.push({ id: L.id, name: L.name, skipped: 'NO_SOLO' }); continue; }
                        L[args.prop] = args.value === 'toggle' ? !before : args.value;
                        out.push({ compId: comp.id, id: L.id, name: L.name, before: before, after: L[args.prop] });
                    }
                }
                return { layers: out };
            });
        }
    };

    /* Label names from preferences (as Moe Selector v5 does); colours fall back to AE defaults. */
    ops['labels.get'] = {
        mutates: false,
        run: function () {
            var names = [], i, n, fromPrefs = false;
            for (i = 1; i <= 16; i++) {
                n = null;
                try {
                    n = app.preferences.getPrefAsString('Label Preference Text Section 5', 'Label Text ID 2 # ' + i, PREFType.PREF_Type_MACHINE_INDEPENDENT);
                    if (n) { fromPrefs = true; }
                } catch (e) { n = null; }
                names.push(n || null);
            }
            return { names: names, fromPrefs: fromPrefs };
        }
    };

    /* args: { query } — installed effects whose display or match name contains the query (case-insensitive). */
    ops['effects.find'] = {
        mutates: false,
        run: function (args) {
            var out = [], i, e, q = String(args.query || '').toLowerCase();
            if (!app.effects) { return { effects: [] }; }
            for (i = 0; i < app.effects.length; i++) {
                e = app.effects[i];
                if (String(e.displayName).toLowerCase().lastIndexOf(q) >= 0 || String(e.matchName).toLowerCase().lastIndexOf(q) >= 0) {
                    out.push({ displayName: e.displayName, matchName: e.matchName, category: e.category });
                }
            }
            return { effects: out };
        }
    };
}($.global));
