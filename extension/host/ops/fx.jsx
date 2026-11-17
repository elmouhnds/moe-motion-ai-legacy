/*
 * MOE Motion AI - rig / look building operations (ExtendScript / ES3).
 *   layers.createAdjustment  named adjustment layer (solid + adjustmentLayer = true)
 *   layers.createSolid       named solid layer
 *   layers.duplicateLinked   duplicate a layer, strip effects/matte/transform animation, parent it to
 *                            the source with an identity transform (follows the source's motion; content
 *                            keyframes are duplicated so they stay in sync)
 *   layers.setAttrs          whitelisted layer attributes (enabled, blendingMode, label, guide, 3D, shy,
 *                            comment, name) with before values
 *   layers.setMatte          AVLayer.setTrackMatte / removeTrackMatte (AE 23.0+)
 *   layers.move              moveBefore / moveAfter
 *   masks.ellipse            add an elliptical mask (spotlight)
 *   keys.write / keys.remove keyframes with interpolation + temporal ease (+ linear spatial tangents)
 *   shapes.cursor            cursor shape layer (arrow / hand) + click ring
 *   effects.setMenu          Dropdown Menu Control items (Property.setPropertyParameters, AE 17.0.1+)
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function plain(v) {
        if (v && typeof v === 'object' && v.length !== undefined) { var a = [], i; for (i = 0; i < v.length; i++) { a.push(num(v[i])); } return a; }
        return typeof v === 'boolean' ? (v ? 1 : 0) : num(v);
    }
    function compOf(args) { return args.any ? U.compAny(args.compId) : U.compById(args.compId); }

    function place(comp, L, args) {
        if (args.above) { L.moveBefore(U.findLayer(comp, { layerId: args.above })); }
        else if (args.below) { L.moveAfter(U.findLayer(comp, { layerId: args.below })); }
        else if (args.bottom) { L.moveToEnd(); }
        if (args.inPoint !== undefined && args.inPoint !== null) { L.inPoint = num(args.inPoint); }
        if (args.outPoint !== undefined && args.outPoint !== null) { L.outPoint = num(args.outPoint); }
        if (U.isLabel(args.label)) { L.label = args.label; }
        if (args.comment) { L.comment = String(args.comment); }
    }

    /* args: { compId, name, above, below, inPoint, outPoint, label, comment } */
    ops['layers.createAdjustment'] = {
        mutates: true,
        run: function (args) {
            var comp = compOf(args);
            return U.withUndo('MOE: Adjustment Layer', function () {
                var L = comp.layers.addSolid([1, 1, 1], args.name, comp.width, comp.height, comp.pixelAspect, comp.duration);
                L.adjustmentLayer = true;
                L.name = args.name;
                place(comp, L, args);
                return { layerId: L.id, index: L.index, name: L.name };
            });
        }
    };

    /* args: { compId, name, color, above, below, bottom, inPoint, outPoint, label, comment } */
    ops['layers.createSolid'] = {
        mutates: true,
        run: function (args) {
            var comp = compOf(args);
            return U.withUndo('MOE: Solid', function () {
                var c = args.color || [0, 0, 0];
                var L = comp.layers.addSolid([num(c[0]), num(c[1]), num(c[2])], args.name, comp.width, comp.height, comp.pixelAspect, comp.duration);
                L.name = args.name;
                place(comp, L, args);
                return { layerId: L.id, index: L.index, name: L.name };
            });
        }
    };

    function clearAnim(p) {
        var k;
        if (!p) { return; }
        if (p.canSetExpression && p.expression) { p.expression = ''; }
        for (k = p.numKeys; k >= 1; k--) { p.removeKey(k); }
    }

    function identity(L) {
        var tg = L.property('ADBE Transform Group'), pos = tg.property('ADBE Position'), names = ['ADBE Anchor Point', 'ADBE Scale', 'ADBE Rotate Z', 'ADBE Rotate X', 'ADBE Rotate Y', 'ADBE Orientation', 'ADBE Opacity'], i, p, z = L.threeDLayer;
        if (pos.dimensionsSeparated) {
            clearAnim(tg.property('ADBE Position_0'));
            clearAnim(tg.property('ADBE Position_1'));
            if (z) { clearAnim(tg.property('ADBE Position_2')); }
            pos.dimensionsSeparated = false;
            pos = L.property('ADBE Transform Group').property('ADBE Position');
        }
        clearAnim(pos);
        pos.setValue(z ? [0, 0, 0] : [0, 0]);
        for (i = 0; i < names.length; i++) {
            /* v0.99.1 (Tile Test, After Effects 26.5: "the property or a parent property is hidden"): a 2D layer keeps
               X / Y Rotation and Orientation hidden - writing them throws. Only a 3D layer gets them. */
            if (!z && (names[i] === 'ADBE Rotate X' || names[i] === 'ADBE Rotate Y' || names[i] === 'ADBE Orientation')) { continue; }
            p = L.property('ADBE Transform Group').property(names[i]);
            if (!p) { continue; }
            clearAnim(p);
            if (names[i] === 'ADBE Anchor Point') { p.setValue(z ? [0, 0, 0] : [0, 0]); }
            else if (names[i] === 'ADBE Scale') { p.setValue(z ? [100, 100, 100] : [100, 100]); }
            else if (names[i] === 'ADBE Opacity') { p.setValue(100); }
            else if (names[i] === 'ADBE Orientation') { p.setValue([0, 0, 0]); }
            else { p.setValue(0); }
        }
    }

    /* args: { compId, sourceId, name, place: 'above'|'below', stripEffects, label, comment } */
    ops['layers.duplicateLinked'] = {
        mutates: true,
        run: function (args) {
            var comp = compOf(args);
            return U.withUndo('MOE: Linked Copy', function () {
                var src = U.findLayer(comp, { layerId: args.sourceId }), d, parade, k;
                d = src.duplicate();
                d.name = args.name;
                if (args.place === 'below') { d.moveAfter(src); } else { d.moveBefore(src); }
                if (args.stripEffects !== false) {
                    parade = d.property('ADBE Effect Parade');
                    for (k = parade.numProperties; k >= 1; k--) { parade.property(k).remove(); }
                }
                try { if (d.hasTrackMatte) { d.removeTrackMatte(); } } catch (eM) { /* AE < 23 */ }
                d.enabled = true;
                d.locked = false;
                identity(d);
                d.setParentWithJump(src);
                if (U.isLabel(args.label)) { d.label = args.label; }
                if (args.comment) { d.comment = String(args.comment); }
                return { layerId: d.id, index: d.index, name: d.name, parentId: src.id };
            });
        }
    };

    var BLEND = { normal: 'NORMAL', add: 'ADD', screen: 'SCREEN', overlay: 'OVERLAY', softLight: 'SOFT_LIGHT', multiply: 'MULTIPLY', lighten: 'LIGHTEN', difference: 'DIFFERENCE' };
    function blendName(v) { var k; for (k in BLEND) { if (BLEND.hasOwnProperty(k) && BlendingMode[BLEND[k]] === v) { return k; } } return String(v); }

    /* args: { compId, label, items: [{ layerId, enabled, blendingMode, label, guideLayer, threeDLayer, shy, comment, name }] } */
    ops['layers.setAttrs'] = {
        mutates: true,
        run: function (args) {
            var comp = compOf(args);
            return U.withUndo(args.label || 'MOE: Layer Settings', function () {
                var out = [], i, it, L, before, keys = ['enabled', 'label', 'guideLayer', 'threeDLayer', 'shy', 'comment', 'name'], j;
                for (i = 0; i < args.items.length; i++) {
                    it = args.items[i];
                    L = U.findLayer(comp, { layerId: it.layerId });
                    before = {};
                    for (j = 0; j < keys.length; j++) {
                        if (it[keys[j]] !== undefined) { before[keys[j]] = L[keys[j]]; L[keys[j]] = it[keys[j]]; }
                    }
                    if (it.blendingMode !== undefined) {
                        if (!BLEND[it.blendingMode]) { U.fail('BAD_ARGS', 'Unknown blending mode ' + it.blendingMode); }
                        before.blendingMode = blendName(L.blendingMode);
                        L.blendingMode = BlendingMode[BLEND[it.blendingMode]];
                    }
                    out.push({ layerId: L.id, name: L.name, before: before });
                }
                return { layers: out };
            });
        }
    };

    var MATTE = { alpha: 'ALPHA', alphaInverted: 'ALPHA_INVERTED', luma: 'LUMA', lumaInverted: 'LUMA_INVERTED' };

    /* args: { compId, items: [{ layerId, matteId (null = remove), type }] } */
    ops['layers.setMatte'] = {
        mutates: true,
        run: function (args) {
            var comp = compOf(args);
            return U.withUndo('MOE: Track Matte', function () {
                var out = [], i, it, L, before;
                for (i = 0; i < args.items.length; i++) {
                    it = args.items[i];
                    L = U.findLayer(comp, { layerId: it.layerId });
                    if (typeof L.setTrackMatte !== 'function') { U.fail('UNSUPPORTED', 'Track mattes by layer need After Effects 23.0 or later.'); }
                    before = L.trackMatteLayer ? L.trackMatteLayer.id : null;
                    if (it.matteId) { L.setTrackMatte(U.findLayer(comp, { layerId: it.matteId }), TrackMatteType[MATTE[it.type || 'alpha']]); }
                    else { L.removeTrackMatte(); }
                    out.push({ layerId: L.id, name: L.name, before: before, after: L.trackMatteLayer ? L.trackMatteLayer.id : null });
                }
                return { layers: out };
            });
        }
    };

    /* args: { compId, items: [{ layerId, before: id } | { layerId, after: id }] } */
    ops['layers.move'] = {
        mutates: true,
        run: function (args) {
            var comp = compOf(args);
            return U.withUndo('MOE: Arrange', function () {
                var i, it, L;
                for (i = 0; i < args.items.length; i++) {
                    it = args.items[i];
                    L = U.findLayer(comp, { layerId: it.layerId });
                    if (it.before) { L.moveBefore(U.findLayer(comp, { layerId: it.before })); } else if (it.after) { L.moveAfter(U.findLayer(comp, { layerId: it.after })); }
                }
                return { moved: args.items.length };
            });
        }
    };

    function ellipseShape(cx, cy, rx, ry) {
        var k = 0.5522847498, s = new Shape();
        s.vertices = [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]];
        s.inTangents = [[-rx * k, 0], [0, -ry * k], [rx * k, 0], [0, ry * k]];
        s.outTangents = [[rx * k, 0], [0, ry * k], [-rx * k, 0], [0, -ry * k]];
        s.closed = true;
        return s;
    }

    /* args: { compId, layerId, name, center: [x, y] (layer space), size: [w, h], feather, inverted, mode: 'add'|'subtract' } */
    ops['masks.ellipse'] = {
        mutates: true,
        run: function (args) {
            var comp = compOf(args);
            return U.withUndo('MOE: Mask', function () {
                var L = U.findLayer(comp, { layerId: args.layerId });
                var m = L.property('ADBE Mask Parade').addProperty('ADBE Mask Atom');
                var idx = m.propertyIndex;
                m = L.property('ADBE Mask Parade').property(idx);
                m.name = args.name || 'MOE Mask';
                m.maskMode = args.mode === 'subtract' ? MaskMode.SUBTRACT : MaskMode.ADD;
                m.inverted = !!args.inverted;
                m.property('ADBE Mask Shape').setValue(ellipseShape(num(args.center[0]), num(args.center[1]), num(args.size[0]) / 2, num(args.size[1]) / 2));
                m.property('ADBE Mask Feather').setValue([num(args.feather), num(args.feather)]);
                return { layerId: L.id, maskIndex: idx, name: m.name, address: { layerId: L.id, matchNames: ['ADBE Mask Parade', 'name:' + m.name, 'ADBE Mask Shape'] } };
            });
        }
    };

    function interpOf(n) { return n === 'linear' ? KeyframeInterpolationType.LINEAR : (n === 'hold' ? KeyframeInterpolationType.HOLD : KeyframeInterpolationType.BEZIER); }
    function easeList(dims, e) { var a = [], i; for (i = 0; i < dims; i++) { a.push(new KeyframeEase(num(e.speed), Math.max(0.1, Math.min(100, num(e.influence) || 33.33)))); } return a; }
    function keyIndexAt(p, t) { var k; for (k = 1; k <= p.numKeys; k++) { if (Math.abs(p.keyTime(k) - t) < 0.0005) { return k; } } return 0; }

    /* v0.61 (docs/features/ENGINE2.md): every generated key lands on the comp's frame grid. Keys that meet on one
       frame merge: the first and last keys of a list win (they hold the rest values), otherwise the one nearest
       to that frame. Returns the snapped list and how many keys moved. */
    function snapKeys(keys, fd) {
        var out = [], moved = 0, i, f, c, last, t, n;
        for (i = 0; i < keys.length; i++) {
            t = num(keys[i].t);
            n = Math.round(Math.round(t / fd) * fd * 1000000) / 1000000;
            if (Math.abs(n - t) > 0.000001) { moved++; }
            c = {};
            for (f in keys[i]) { if (keys[i].hasOwnProperty(f)) { c[f] = keys[i][f]; } }
            c.t = n;
            c.__d = Math.abs(t - n);
            c.__end = (i === 0 || i === keys.length - 1);
            last = out.length ? out[out.length - 1] : null;
            if (last && Math.abs(last.t - n) < fd / 2) {
                if ((c.__end && !last.__end) || (!last.__end && c.__d < last.__d)) { out[out.length - 1] = c; }
            } else {
                out.push(c);
            }
        }
        return { keys: out, moved: moved, merged: keys.length - out.length };
    }

    /* args: { compId, any, label, subframe, items: [{ address, keys: [{ t, v, interp, easeIn, easeOut }], spatialLinear, subframe }] } */
    ops['keys.write'] = {
        mutates: true,
        run: function (args) {
            var comp = compOf(args);
            return U.withUndo(args.label || 'MOE: Keyframes', function () {
                var out = [], i, j, r, p, it, key, k, dims, zero, written, sn, grid = { moved: 0, merged: 0 };
                for (i = 0; i < args.items.length; i++) {
                    it = args.items[i];
                    if (!args.subframe && !it.subframe) {
                        sn = snapKeys(it.keys, comp.frameDuration);
                        grid.moved += sn.moved;
                        grid.merged += sn.merged;
                        it = { address: it.address, keys: sn.keys, spatialLinear: it.spatialLinear };
                    }
                    r = U.resolveProperty(comp, it.address);
                    p = r.prop;
                    if (r.layer.locked) { U.fail('LAYER_LOCKED', 'Layer "' + r.layer.name + '" is locked.'); }
                    var replaced = [];
                    for (j = 0; j < it.keys.length; j++) {
                        k = keyIndexAt(p, num(it.keys[j].t));
                        if (k) { replaced.push({ t: num(it.keys[j].t), v: plain(p.keyValue(k)) }); }
                        p.setValueAtTime(num(it.keys[j].t), it.keys[j].v);
                    }
                    dims = U.easeDimensions(p);
                    written = [];
                    for (j = 0; j < it.keys.length; j++) {
                        key = it.keys[j];
                        k = keyIndexAt(p, num(key.t));
                        if (!k) { continue; }
                        p.setInterpolationTypeAtKey(k, interpOf(key.interp), interpOf(key.interp));
                        if (key.interp !== 'linear' && key.interp !== 'hold') {
                            p.setTemporalEaseAtKey(k, easeList(dims, key.easeIn || { speed: 0, influence: 33.33 }), easeList(dims, key.easeOut || { speed: 0, influence: 33.33 }));
                        }
                        if (p.isSpatial && it.spatialLinear) {
                            zero = plain(p.keyValue(k));
                            for (var z = 0; z < zero.length; z++) { zero[z] = 0; }
                            p.setSpatialTangentsAtKey(k, zero, zero);
                        }
                        written.push({ t: num(key.t), index: k, value: plain(p.keyValue(k)) });
                    }
                    out.push({ address: it.address, name: p.name, layerName: r.layer.name, numKeys: p.numKeys, written: written, replaced: replaced });
                }
                return { items: out, grid: grid, frameDuration: comp.frameDuration };
            });
        }
    };

    /* args: { compId, address } -> { keys: [{ t, v }] } (read-only) */
    ops['keys.list'] = {
        mutates: false,
        run: function (args) {
            var comp = compOf(args), r = U.resolveProperty(comp, args.address), out = [], k;
            for (k = 1; k <= r.prop.numKeys && k <= 500; k++) { out.push({ t: r.prop.keyTime(k), v: plain(r.prop.keyValue(k)) }); }
            return { name: r.prop.name, layerName: r.layer.name, parented: !!r.layer.parent, keys: out };
        }
    };

    /* args: { compId, path, name, fit: 'fit'|'fill'|'none', atTime } - import a file and add it to the comp. */
    ops['footage.importToComp'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId), f = new File(args.path);
            if (!f.exists) { U.fail('FILE_MISSING', 'File not found: ' + args.path); }
            return U.withUndo('MOE: Import Generated', function () {
                var io = new ImportOptions(f), item, L, k = 1, tg;
                if (!io.canImportAs(ImportAsType.FOOTAGE)) { U.fail('CANNOT_IMPORT', 'After Effects cannot import ' + f.name); }
                io.importAs = ImportAsType.FOOTAGE;
                item = app.project.importFile(io);
                L = comp.layers.add(item);
                if (args.name) { L.name = args.name; }
                if (args.atTime !== undefined && args.atTime !== null) { L.startTime = num(args.atTime); }
                if (args.fit === 'fit' || args.fit === 'fill') {
                    k = args.fit === 'fit' ? Math.min(comp.width / item.width, comp.height / item.height) : Math.max(comp.width / item.width, comp.height / item.height);
                    tg = L.property('ADBE Transform Group');
                    tg.property('ADBE Scale').setValue([k * 100, k * 100]);
                    tg.property('ADBE Position').setValue([comp.width / 2, comp.height / 2]);
                }
                L.selected = true;
                return { layerId: L.id, name: L.name, itemId: item.id, width: item.width, height: item.height, duration: item.duration || 0, scale: k * 100 };
            });
        }
    };

    /* args: { compId, layerId, itemId } - remove an imported layer and its project item. */
    ops['footage.remove'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Remove Imported', function () {
                try { U.findLayer(comp, { layerId: args.layerId }).remove(); } catch (eL) { /* already gone */ }
                try { app.project.itemByID(args.itemId).remove(); } catch (eI) { /* already gone */ }
                return { removed: true };
            });
        }
    };

    /* args: { compId, items: [{ address, times: [t], restore: [{ t, v }] }] } */
    ops['keys.remove'] = {
        mutates: true,
        run: function (args) {
            var comp = compOf(args);
            return U.withUndo('MOE: Remove Keyframes', function () {
                var removed = 0, i, j, r, k, it;
                for (i = 0; i < args.items.length; i++) {
                    it = args.items[i];
                    try { r = U.resolveProperty(comp, it.address); } catch (eGone) { continue; }
                    for (j = 0; j < it.times.length; j++) {
                        k = keyIndexAt(r.prop, num(it.times[j]));
                        if (k) { r.prop.removeKey(k); removed++; }
                    }
                    for (j = 0; it.restore && j < it.restore.length; j++) { r.prop.setValueAtTime(num(it.restore[j].t), it.restore[j].v); }
                }
                return { removed: removed };
            });
        }
    };

    var CURSORS = {
        arrow: [[0, 0], [0, 26], [6.5, 20], [11, 30], [15, 28.2], [10.6, 18.6], [19, 18.6]],
        hand: [[-2.5, 0], [2.5, 0], [3.2, 1.5], [3.2, 12], [6.5, 10.8], [9.5, 12.3], [12.4, 11.6], [15.4, 13.4], [17.6, 13.6], [18.6, 15.6], [18.6, 24], [15.6, 31], [3.5, 31], [-3, 22.5], [-7.4, 15.6], [-6.2, 13.4], [-3.2, 14.2], [-3.2, 1.5]]
    };

    function polyShape(pts, k) {
        var s = new Shape(), v = [], z = [], i;
        for (i = 0; i < pts.length; i++) { v.push([pts[i][0] * k, pts[i][1] * k]); z.push([0, 0]); }
        s.vertices = v; s.inTangents = z; s.outTangents = z; s.closed = true;
        return s;
    }

    /* args: { compId, name, kind, color, outline, size, position, inPoint, outPoint, label } */
    ops['shapes.cursor'] = {
        mutates: true,
        run: function (args) {
            var comp = compOf(args);
            if (!CURSORS[args.kind || 'arrow']) { U.fail('BAD_ARGS', 'Unknown cursor ' + args.kind); }
            return U.withUndo('MOE: Cursor', function () {
                var L = comp.layers.addShape(), root, g, gi, c, k = num(args.size || 32) / 30, ring, ri, col = args.color || [1, 1, 1], out = args.outline || [0, 0, 0];
                L.name = args.name || 'MOE Cursor';
                if (U.isLabel(args.label)) { L.label = args.label; }
                /* Click ring first (drawn below the pointer). */
                root = L.property('ADBE Root Vectors Group');
                ring = root.addProperty('ADBE Vector Group');
                ring.name = 'Click Ring';
                ri = ring.propertyIndex;
                c = L.property('ADBE Root Vectors Group').property(ri).property('ADBE Vectors Group');
                c.addProperty('ADBE Vector Shape - Ellipse');
                c = L.property('ADBE Root Vectors Group').property(ri).property('ADBE Vectors Group');
                c.property(1).property('ADBE Vector Ellipse Size').setValue([44 * k, 44 * k]);
                c.addProperty('ADBE Vector Graphic - Stroke');
                c = L.property('ADBE Root Vectors Group').property(ri).property('ADBE Vectors Group');
                c.property(2).property('ADBE Vector Stroke Color').setValue([num(col[0]), num(col[1]), num(col[2]), 1]);
                c.property(2).property('ADBE Vector Stroke Width').setValue(3 * k);
                L.property('ADBE Root Vectors Group').property(ri).property('ADBE Vector Transform Group').property('ADBE Vector Group Opacity').setValue(0);
                /* Pointer. */
                g = L.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
                g.name = 'Pointer';
                gi = g.propertyIndex;
                c = L.property('ADBE Root Vectors Group').property(gi).property('ADBE Vectors Group');
                c.addProperty('ADBE Vector Shape - Group');
                c = L.property('ADBE Root Vectors Group').property(gi).property('ADBE Vectors Group');
                c.property(1).property('ADBE Vector Shape').setValue(polyShape(CURSORS[args.kind || 'arrow'], k));
                c.addProperty('ADBE Vector Graphic - Stroke');
                c = L.property('ADBE Root Vectors Group').property(gi).property('ADBE Vectors Group');
                c.property(2).property('ADBE Vector Stroke Color').setValue([num(out[0]), num(out[1]), num(out[2]), 1]);
                c.property(2).property('ADBE Vector Stroke Width').setValue(1.6 * k);
                c.addProperty('ADBE Vector Graphic - Fill');
                c = L.property('ADBE Root Vectors Group').property(gi).property('ADBE Vectors Group');
                c.property(3).property('ADBE Vector Fill Color').setValue([num(col[0]), num(col[1]), num(col[2]), 1]);
                var tg = L.property('ADBE Transform Group');
                tg.property('ADBE Anchor Point').setValue([0, 0]);
                if (args.position) { tg.property('ADBE Position').setValue([num(args.position[0]), num(args.position[1])]); }
                if (args.inPoint !== undefined) { L.inPoint = num(args.inPoint); }
                if (args.outPoint !== undefined) { L.outPoint = num(args.outPoint); }
                return {
                    layerId: L.id, name: L.name,
                    addresses: {
                        position: { layerId: L.id, matchNames: ['ADBE Transform Group', 'ADBE Position'] },
                        scale: { layerId: L.id, matchNames: ['ADBE Transform Group', 'ADBE Scale'] },
                        opacity: { layerId: L.id, matchNames: ['ADBE Transform Group', 'ADBE Opacity'] },
                        ringScale: { layerId: L.id, matchNames: ['ADBE Root Vectors Group', 'name:Click Ring', 'ADBE Vector Transform Group', 'ADBE Vector Scale'] },
                        ringOpacity: { layerId: L.id, matchNames: ['ADBE Root Vectors Group', 'name:Click Ring', 'ADBE Vector Transform Group', 'ADBE Vector Group Opacity'] }
                    }
                };
            });
        }
    };

    /* args: { compId, layerId, effectKey, items: [string], value } */
    ops['effects.setMenu'] = {
        mutates: true,
        run: function (args) {
            var comp = compOf(args);
            return U.withUndo('MOE: Menu', function () {
                var L = U.findLayer(comp, { layerId: args.layerId }), parade = L.property('ADBE Effect Parade'), fx = null, i, p;
                for (i = 1; i <= parade.numProperties; i++) { if (parade.property(i).name === args.effectKey) { fx = parade.property(i); } }
                if (!fx) { U.fail('EFFECT_NOT_FOUND', 'Effect not found: ' + args.effectKey); }
                p = fx.property(1);
                if (typeof p.setPropertyParameters !== 'function') { U.fail('UNSUPPORTED', 'Dropdown menus need After Effects 17.0.1 or later.'); }
                /* v0.99.5: setting the list invalidates the references into the effect, and on After Effects 26.5.3
                   the way back through parentProperty is gone too - so remember WHERE the effect is first. Its index
                   does not move. Without this the effect kept After Effects' own "Dropdown Menu Control" name and
                   everything that reads it by name (expressions, read-backs) stopped finding it. */
                var fxAt = fx.propertyIndex;
                p = p.setPropertyParameters(args.items);
                /* v0.99.1: the effect keeps its MOE name (expressions read it by name) even if After Effects resets it */
                fx = (p.parentProperty && p.parentProperty.propertyIndex === fxAt) ? p.parentProperty : L.property('ADBE Effect Parade').property(fxAt);
                if (!fx) { U.fail('EFFECT_LOST', 'The menu control "' + args.effectKey + '" could not be found again after its list was set.'); }
                if (fx.name !== args.effectKey) { fx.name = args.effectKey; }
                if (args.value) { p.setValue(args.value); }
                return { layerId: L.id, effect: args.effectKey, items: args.items.length, value: plain(p.value) };
            });
        }
    };
}($.global));
