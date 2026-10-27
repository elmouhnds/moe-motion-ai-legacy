/*
 * MOE Motion AI - transform & curve operations (ExtendScript / ES3, ASCII only).
 *   keyframes.setEase    per-key, per-side, per-dimension temporal ease (speed + influence)
 *   layers.moveAnchor    put the anchor at a point of the layer's content box; the layer does not move
 *   layers.restoreAnchor anchor + position back to a snapshot
 *   layers.nudge         shift Position (static, keyframed or separated) by a comp-space delta
 *   layers.restorePosition position back to a snapshot
 *   layers.clone         duplicate one layer N times with per-copy transform ("MOE Clone N - name")
 *   layers.unclone       remove those copies and put the source back
 * APIs used (After Effects Scripting Guide): Property.setTemporalEaseAtKey, KeyframeEase,
 * setInterpolationTypeAtKey, keyValue, setValueAtKey, setValue, AVLayer.sourceRectAtTime,
 * Layer.duplicate, Property.dimensionsSeparated.
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function plain(v) {
        if (v && typeof v === 'object' && v.length !== undefined) { var a = [], i; for (i = 0; i < v.length; i++) { a.push(num(v[i])); } return a; }
        return num(v);
    }
    function snapshotKey(prop, k) {
        return {
            index: k,
            time: prop.keyTime(k),
            inInterp: U.interpName(prop.keyInInterpolationType(k)),
            outInterp: U.interpName(prop.keyOutInterpolationType(k)),
            easeIn: U.easeToPlain(prop.keyInTemporalEase(k)),
            easeOut: U.easeToPlain(prop.keyOutTemporalEase(k))
        };
    }
    function easeArray(list, dims) {
        var arr = [], i;
        if (!list || list.length !== dims) { U.fail('BAD_ARGS', 'Ease needs ' + dims + ' value(s) for this property.'); }
        for (i = 0; i < list.length; i++) { arr.push(new KeyframeEase(num(list[i].speed), num(list[i].influence))); }
        return arr;
    }

    /*
     * args: { compId, label, targets: [{ address, keys: [{ index, easeIn: [{speed, influence}] | null, easeOut: [...] | null }] }] }
     * A null side keeps the current ease. Sides that are HOLD are left alone (reported).
     */
    ops['keyframes.setEase'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Ease Curve', function () {
                var results = [], t, r, prop, dims, j, it, k, inT, outT, inArr, outArr, newIn, newOut, entry;
                for (t = 0; t < args.targets.length; t++) {
                    r = U.resolveProperty(comp, args.targets[t].address);
                    prop = r.prop;
                    dims = U.easeDimensions(prop);
                    entry = { address: args.targets[t].address, dims: dims, before: [], after: [], skipped: [] };
                    for (j = 0; j < args.targets[t].keys.length; j++) {
                        it = args.targets[t].keys[j];
                        k = it.index;
                        if (k < 1 || k > prop.numKeys) { entry.skipped.push({ index: k, reason: 'KEY_OUT_OF_RANGE' }); continue; }
                        entry.before.push(snapshotKey(prop, k));
                        inT = prop.keyInInterpolationType(k);
                        outT = prop.keyOutInterpolationType(k);
                        if (it.easeIn && inT === KeyframeInterpolationType.HOLD) { entry.skipped.push({ index: k, reason: 'HOLD_IN' }); it.easeIn = null; }
                        if (it.easeOut && outT === KeyframeInterpolationType.HOLD) { entry.skipped.push({ index: k, reason: 'HOLD_OUT' }); it.easeOut = null; }
                        newIn = it.easeIn ? KeyframeInterpolationType.BEZIER : inT;
                        newOut = it.easeOut ? KeyframeInterpolationType.BEZIER : outT;
                        if (newIn !== inT || newOut !== outT) { prop.setInterpolationTypeAtKey(k, newIn, newOut); }
                        inArr = it.easeIn ? easeArray(it.easeIn, dims) : prop.keyInTemporalEase(k);
                        outArr = it.easeOut ? easeArray(it.easeOut, dims) : prop.keyOutTemporalEase(k);
                        prop.setTemporalEaseAtKey(k, inArr, outArr);
                        entry.after.push(snapshotKey(prop, k));
                    }
                    results.push(entry);
                }
                return { targets: results };
            });
        }
    };

    /* ---------- position helpers (static, keyframed or separated) ---------- */
    function posParts(tr) {
        var pos = tr.property('ADBE Position');
        if (pos.dimensionsSeparated) { return [{ prop: tr.property('ADBE Position_0'), dim: 0 }, { prop: tr.property('ADBE Position_1'), dim: 1 }]; }
        return [{ prop: pos, dim: -1 }];
    }
    function snapProp(prop) {
        var keys = [], k;
        if (prop.numKeys > 0) { for (k = 1; k <= prop.numKeys; k++) { keys.push(plain(prop.keyValue(k))); } return { keys: keys }; }
        return { value: plain(prop.value) };
    }
    function snapPos(tr) {
        var parts = posParts(tr), out = [], i;
        for (i = 0; i < parts.length; i++) { out.push(snapProp(parts[i].prop)); }
        return { separated: parts.length === 2, parts: out };
    }
    function shifted(v, dim, dx, dy) {
        var a;
        if (dim === 0) { return num(v) + dx; }
        if (dim === 1) { return num(v) + dy; }
        a = plain(v); a[0] += dx; a[1] += dy;
        return a;
    }
    function shiftPos(tr, dx, dy) {
        var parts = posParts(tr), i, p, k;
        for (i = 0; i < parts.length; i++) {
            p = parts[i].prop;
            if (p.numKeys > 0) { for (k = 1; k <= p.numKeys; k++) { p.setValueAtKey(k, shifted(p.keyValue(k), parts[i].dim, dx, dy)); } } else { p.setValue(shifted(p.value, parts[i].dim, dx, dy)); }
        }
    }
    function restorePos(tr, snap) {
        var parts = posParts(tr), i, p, s, k;
        if ((parts.length === 2) !== !!snap.separated) { U.fail('CHANGED', 'Position was separated or joined since the checkpoint.'); }
        for (i = 0; i < parts.length; i++) {
            p = parts[i].prop; s = snap.parts[i];
            if (s.keys) {
                if (p.numKeys !== s.keys.length) { U.fail('CHANGED', 'Position keyframes changed since the checkpoint.'); }
                for (k = 1; k <= p.numKeys; k++) { p.setValueAtKey(k, s.keys[k - 1]); }
            } else { p.setValue(s.value); }
        }
    }
    function rotZ(tr) { return tr.property('ADBE Rotate Z'); }
    function val0(tr, mn) { var p = tr.property(mn); return p ? num(p.value) : 0; }

    /*
     * args: { compId, label, layers: [id], fx: 0..1, fy: 0..1 } - fraction of the content box (sourceRectAtTime).
     * Keeps the layer in place: Position moves by the anchor change in parent space (scale + Z rotation).
     */
    ops['layers.moveAnchor'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Move Anchor', function () {
                var out = [], i, L, tr, ap, sc, rot, rect, a0, a1, lx, ly, rad, c, s, dx, dy, before, reason, o;
                for (i = 0; i < args.layers.length; i++) {
                    L = U.findLayer(comp, { layerId: args.layers[i] });
                    tr = L.property('ADBE Transform Group');
                    ap = tr.property('ADBE Anchor Point');
                    sc = tr.property('ADBE Scale');
                    rot = rotZ(tr);
                    reason = '';
                    if (L.locked) { reason = 'LOCKED'; } else if (ap.numKeys > 0) { reason = 'ANCHOR_KEYFRAMED'; } else if (sc.numKeys > 0 || rot.numKeys > 0) { reason = 'SCALE_OR_ROTATION_ANIMATED'; }
                    if (!reason && L.threeDLayer) {
                        o = tr.property('ADBE Orientation') ? plain(tr.property('ADBE Orientation').value) : [0, 0, 0];
                        if (val0(tr, 'ADBE Rotate X') !== 0 || val0(tr, 'ADBE Rotate Y') !== 0 || o[0] !== 0 || o[1] !== 0 || o[2] !== 0) { reason = 'ROTATED_3D'; }
                    }
                    if (!reason) {
                        rect = L.sourceRectAtTime(comp.time, false);
                        if (!(rect.width > 0 || rect.height > 0)) { reason = 'NO_BOUNDS'; }
                    }
                    if (reason) { out.push({ layerId: L.id, name: L.name, skipped: reason }); continue; }
                    a0 = plain(ap.value);
                    a1 = [rect.left + rect.width * num(args.fx), rect.top + rect.height * num(args.fy)];
                    if (a0.length > 2) { a1.push(a0[2]); }
                    lx = (a1[0] - a0[0]) * plain(sc.value)[0] / 100;
                    ly = (a1[1] - a0[1]) * plain(sc.value)[1] / 100;
                    rad = num(rot.value) * Math.PI / 180; c = Math.cos(rad); s = Math.sin(rad);
                    dx = lx * c - ly * s; dy = lx * s + ly * c;
                    before = { anchor: a0, pos: snapPos(tr) };
                    ap.setValue(a1);
                    shiftPos(tr, dx, dy);
                    out.push({ layerId: L.id, name: L.name, target: a1, delta: [dx, dy], before: before, after: { anchor: plain(ap.value), pos: snapPos(tr) } });
                }
                return { layers: out };
            });
        }
    };

    /* args: { compId, layers: [{ layerId, anchor, pos }] } */
    ops['layers.restoreAnchor'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Restore Anchor', function () {
                var i, L, tr;
                for (i = 0; i < args.layers.length; i++) {
                    L = U.findLayer(comp, { layerId: args.layers[i].layerId });
                    tr = L.property('ADBE Transform Group');
                    tr.property('ADBE Anchor Point').setValue(args.layers[i].anchor);
                    restorePos(tr, args.layers[i].pos);
                }
                return { restored: args.layers.length };
            });
        }
    };

    /* args: { compId, label, items: [{ layerId, delta: [dx, dy] }] } - unparented layers only (comp space = position space). */
    ops['layers.nudge'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Align', function () {
                var out = [], i, it, L, tr, before;
                for (i = 0; i < args.items.length; i++) {
                    it = args.items[i];
                    L = U.findLayer(comp, { layerId: it.layerId });
                    if (L.locked) { out.push({ layerId: L.id, name: L.name, skipped: 'LOCKED' }); continue; }
                    if (L.parent) { out.push({ layerId: L.id, name: L.name, skipped: 'PARENTED' }); continue; }
                    tr = L.property('ADBE Transform Group');
                    before = snapPos(tr);
                    shiftPos(tr, num(it.delta[0]), num(it.delta[1]));
                    out.push({ layerId: L.id, name: L.name, delta: [num(it.delta[0]), num(it.delta[1])], before: before, after: snapPos(tr) });
                }
                return { layers: out };
            });
        }
    };

    /* args: { compId, layers: [{ layerId, pos }] } */
    ops['layers.restorePosition'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Restore Position', function () {
                var i;
                for (i = 0; i < args.layers.length; i++) { restorePos(U.findLayer(comp, { layerId: args.layers[i].layerId }).property('ADBE Transform Group'), args.layers[i].pos); }
                return { restored: args.layers.length };
            });
        }
    };

    function setPos(tr, xy) {
        var pos = tr.property('ADBE Position'), v;
        if (pos.dimensionsSeparated) { tr.property('ADBE Position_0').setValue(xy[0]); tr.property('ADBE Position_1').setValue(xy[1]); return; }
        v = plain(pos.value);
        v[0] = xy[0]; v[1] = xy[1];
        pos.setValue(v);
    }
    function getPos(tr) {
        var pos = tr.property('ADBE Position');
        if (pos.dimensionsSeparated) { return [num(tr.property('ADBE Position_0').value), num(tr.property('ADBE Position_1').value)]; }
        return plain(pos.value);
    }
    function animated(tr) {
        var pos = tr.property('ADBE Position');
        if (pos.dimensionsSeparated) { if (tr.property('ADBE Position_0').numKeys > 0 || tr.property('ADBE Position_1').numKeys > 0) { return true; } } else if (pos.numKeys > 0) { return true; }
        return rotZ(tr).numKeys > 0 || tr.property('ADBE Scale').numKeys > 0 || tr.property('ADBE Opacity').numKeys > 0;
    }

    /*
     * args: { compId, label, layerId, items: [{ position: [x, y], rotation, scale (multiplier), opacity }],
     *         source: { position: [x, y], rotation } | null }
     * Copies are named "MOE Clone N - <source name>" so they can be found and removed.
     */
    ops['layers.clone'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            var src = U.findLayer(comp, { layerId: args.layerId });
            var str = src.property('ADBE Transform Group');
            if (src.locked) { U.fail('LOCKED', 'The layer is locked.'); }
            if (animated(str)) { U.fail('ANIMATED', 'Clone works on a layer without Position, Rotation, Scale or Opacity keyframes - clone first, then animate.'); }
            if (args.items.length > 200) { U.fail('BAD_ARGS', 'At most 200 copies.'); }
            return U.withUndo(args.label || 'MOE: Clone', function () {
                var created = [], i, it, d, tr, s0, before;
                before = { position: getPos(str), rotation: num(rotZ(str).value) };
                s0 = plain(str.property('ADBE Scale').value);
                var prev = src;
                for (i = 0; i < args.items.length; i++) {
                    it = args.items[i];
                    d = src.duplicate();
                    d.name = 'MOE Clone ' + (i + 1) + ' \u00b7 ' + src.name;
                    d.moveAfter(prev);
                    prev = d;
                    tr = d.property('ADBE Transform Group');
                    setPos(tr, it.position);
                    if (it.rotation !== undefined) { rotZ(tr).setValue(num(it.rotation)); }
                    if (it.scale !== undefined) { tr.property('ADBE Scale').setValue(s0.length > 2 ? [s0[0] * it.scale, s0[1] * it.scale, s0[2]] : [s0[0] * it.scale, s0[1] * it.scale]); }
                    if (it.opacity !== undefined) { tr.property('ADBE Opacity').setValue(num(it.opacity)); }
                    created.push({ layerId: d.id, name: d.name, position: getPos(tr), rotation: num(rotZ(tr).value) });
                }
                if (args.source) {
                    setPos(str, args.source.position);
                    if (args.source.rotation !== undefined) { rotZ(str).setValue(num(args.source.rotation)); }
                }
                return { sourceId: src.id, sourceName: src.name, before: before, after: { position: getPos(str), rotation: num(rotZ(str).value) }, created: created };
            });
        }
    };

    /* args: { compId, sourceId, before: { position, rotation }, layerIds: [id] } */
    ops['layers.unclone'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Remove Clones', function () {
                var removed = 0, i, L, tr;
                for (i = 0; i < args.layerIds.length; i++) {
                    try { L = U.findLayer(comp, { layerId: args.layerIds[i] }); } catch (eMissing) { continue; }
                    if (L.name.substring(0, 10) !== 'MOE Clone ') { continue; }
                    L.remove();
                    removed++;
                }
                tr = U.findLayer(comp, { layerId: args.sourceId }).property('ADBE Transform Group');
                setPos(tr, args.before.position);
                rotZ(tr).setValue(num(args.before.rotation));
                return { removed: removed };
            });
        }
    };
}($.global));
