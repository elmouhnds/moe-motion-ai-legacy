/*
 * MOE Motion AI - transform & curve operations (ExtendScript / ES3, ASCII only).
 *   keyframes.setEase    per-key, per-side, per-dimension temporal ease (speed + influence)
 *   layers.moveAnchor    put the anchor at a point of the layer's content box; the layer does not move
 *   layers.restoreAnchor anchor + position back to a snapshot
 *   layers.nudge         shift Position (static, keyframed, separated; parented 2D) by a comp-space delta
 *   layers.restorePosition position back to a snapshot
 *   layers.clone         duplicate one layer N times with per-copy transform ("MOE Clone N - name")
 *   layers.unclone       remove those copies and put the source back
 * APIs used (After Effects Scripting Guide): Property.setTemporalEaseAtKey, KeyframeEase,
 * setInterpolationTypeAtKey, keyValue, setValueAtKey, setValue, AVLayer.sourceRectAtTime,
 * Layer.duplicate, Property.dimensionsSeparated, Property.valueAtTime, Layer.autoOrient; probe
 * expressions use the documented layer space transforms toWorld / fromWorld.
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

    /* ---------- position helpers (static, keyframed or separated; 2D or 3D) ---------- */
    function posParts(tr) {
        var pos = tr.property('ADBE Position'), parts, z;
        if (pos.dimensionsSeparated) {
            parts = [{ prop: tr.property('ADBE Position_0'), dim: 0 }, { prop: tr.property('ADBE Position_1'), dim: 1 }];
            z = tr.property('ADBE Position_2');
            if (z) { parts.push({ prop: z, dim: 2 }); }
            return parts;
        }
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
        return { separated: parts.length > 1, parts: out };
    }
    /* d = [dx, dy] or [dx, dy, dz] */
    function shifted(v, dim, d) {
        var a, i;
        if (dim >= 0) { return num(v) + num(d[dim]); }
        a = plain(v);
        for (i = 0; i < a.length && i < d.length; i++) { a[i] += num(d[i]); }
        return a;
    }
    function shiftProp(p, dim, d) {
        var k;
        if (p.numKeys > 0) { for (k = 1; k <= p.numKeys; k++) { p.setValueAtKey(k, shifted(p.keyValue(k), dim, d)); } } else { p.setValue(shifted(p.value, dim, d)); }
    }
    function shiftPos(tr, d) {
        var parts = posParts(tr), i;
        for (i = 0; i < parts.length; i++) { shiftProp(parts[i].prop, parts[i].dim, d); }
    }
    function restoreSnap(p, s) {
        var k;
        if (s.keys) {
            if (p.numKeys !== s.keys.length) { U.fail('CHANGED', 'Keyframes changed since the checkpoint.'); }
            for (k = 1; k <= p.numKeys; k++) { p.setValueAtKey(k, s.keys[k - 1]); }
        } else { p.setValue(s.value); }
    }
    function restorePos(tr, snap) {
        var parts = posParts(tr), i;
        if ((parts.length > 1) !== !!snap.separated) { U.fail('CHANGED', 'Position was separated or joined since the checkpoint.'); }
        for (i = 0; i < parts.length; i++) { restoreSnap(parts[i].prop, snap.parts[i]); }
    }
    function posAt(tr, t) {
        var parts = posParts(tr), out, i;
        if (parts.length === 1) { return plain(parts[0].prop.valueAtTime(t, false)); }
        out = [];
        for (i = 0; i < parts.length; i++) { out.push(num(parts[i].prop.valueAtTime(t, false))); }
        return out;
    }
    function rotZ(tr) { return tr.property('ADBE Rotate Z'); }
    function val0(tr, mn) { var p = tr.property(mn); return p ? num(p.value) : 0; }
    function moving(p) { return !!(p && (p.numKeys > 0 || (p.canSetExpression && p.expressionEnabled && p.expression))); }
    function at(p, t, fb) { return p ? plain(p.valueAtTime(t, false)) : fb; }

    /* 2D layer matrix (no translation): v_parent = R(rot) * S(scale) * v_local. */
    function lin2(tr, t, v) {
        var s = at(tr.property('ADBE Scale'), t, [100, 100]), r = num(at(rotZ(tr), t, 0)) * Math.PI / 180;
        var x = num(v[0]) * s[0] / 100, y = num(v[1]) * s[1] / 100;
        return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
    }
    function inv2(tr, t, v) {
        var s = at(tr.property('ADBE Scale'), t, [100, 100]), r = -num(at(rotZ(tr), t, 0)) * Math.PI / 180;
        var x = num(v[0]) * Math.cos(r) - num(v[1]) * Math.sin(r), y = num(v[0]) * Math.sin(r) + num(v[1]) * Math.cos(r);
        return [s[0] ? x * 100 / s[0] : 0, s[1] ? y * 100 / s[1] : 0];
    }
    function rotated3D(L, tr, t) {
        var o;
        if (!L.threeDLayer) { return false; }
        o = at(tr.property('ADBE Orientation'), t, [0, 0, 0]);
        return num(at(tr.property('ADBE Rotate X'), t, 0)) !== 0 || num(at(tr.property('ADBE Rotate Y'), t, 0)) !== 0 || o[0] !== 0 || o[1] !== 0 || o[2] !== 0;
    }
    function autoOriented(L) {
        try { return typeof AutoOrientType !== 'undefined' && L.autoOrient !== AutoOrientType.NO_AUTO_ORIENT; } catch (e) { return false; }
    }
    /* A comp-space vector expressed in the layer's parent space (2D parents); null if a parent is 3D-rotated. */
    function compToParentVec(L, t, v) {
        var chain = [], P = L.parent, i, q = [num(v[0]), num(v[1])];
        while (P) { chain.unshift(P); P = P.parent; }
        for (i = 0; i < chain.length; i++) {
            if (rotated3D(chain[i], chain[i].property('ADBE Transform Group'), t)) { return null; }
            q = inv2(chain[i].property('ADBE Transform Group'), t, q);
        }
        return q;
    }
    /* A comp-space point in the layer's parent space (2D parents). */
    function compToParentPt(L, t, c) {
        var chain = [], P = L.parent, i, q = [num(c[0]), num(c[1])], tr, a, p, d;
        while (P) { chain.unshift(P); P = P.parent; }
        for (i = 0; i < chain.length; i++) {
            tr = chain[i].property('ADBE Transform Group');
            if (rotated3D(chain[i], tr, t)) { return null; }
            a = at(tr.property('ADBE Anchor Point'), t, [0, 0]);
            p = at(tr.property('ADBE Position'), t, [0, 0]);
            if (tr.property('ADBE Position').dimensionsSeparated) { p = [num(at(tr.property('ADBE Position_0'), t, 0)), num(at(tr.property('ADBE Position_1'), t, 0))]; }
            d = inv2(tr, t, [q[0] - p[0], q[1] - p[1]]);
            q = [d[0] + a[0], d[1] + a[1]];
        }
        return q;
    }

    /*
     * Probe (3D-rotated / auto-oriented layers): AE's own toWorld / fromWorld give the parent-space
     * change of position that keeps the layer still when its anchor goes from a0 to a1.
     * Temporary null + 3D Point Control, read with valueAtTime(), removed in finally; the layer
     * selection is put back (adding a layer changes it).
     */
    function probeDelta(comp, L, t, a0, a1) {
        var probe = null, sel = [], i, v, fx, idx, before = comp.numLayers;
        for (i = 0; i < comp.selectedLayers.length; i++) { sel.push(comp.selectedLayers[i]); }
        try {
            probe = comp.layers.addNull(comp.duration);
            probe.name = 'MOE Probe (temporary)';
            idx = probe.property('ADBE Effect Parade').addProperty('ADBE Point3D Control').propertyIndex;
            fx = probe.property('ADBE Effect Parade').property(idx).property(1);
            fx.expression = [
                'var L = thisComp.layer(' + L.index + ');',
                'var w0 = L.toWorld([' + a0.join(',') + ']), w1 = L.toWorld([' + a1.join(',') + ']);',
                'var d = L.hasParent ? sub(L.parent.fromWorld(w1), L.parent.fromWorld(w0)) : sub(w1, w0);',
                '[d[0], d[1], d.length > 2 ? d[2] : 0];'
            ].join('\n');
            if (fx.expressionError) { U.fail('PROBE_FAILED', String(fx.expressionError)); }
            v = plain(fx.valueAtTime(t, false));
        } finally {
            if (probe) { try { probe.remove(); } catch (eRemove) { /* checked below */ } }
            for (i = 0; i < sel.length; i++) { try { sel[i].selected = true; } catch (eSel) { /* layer gone */ } }
        }
        if (comp.numLayers !== before) { U.fail('PROBE_LEFT', 'The temporary probe layer could not be removed.'); }
        return v;
    }

    /* Content box: sourceRectAtTime, or the bounds of the layer's masks (vertices + tangent handles). */
    function maskBounds(L, t) {
        var masks = L.property('ADBE Mask Parade'), i, j, sh, v, pts, l = Infinity, tp = Infinity, r = -Infinity, b = -Infinity;
        if (!masks || masks.numProperties === 0) { return null; }
        for (i = 1; i <= masks.numProperties; i++) {
            sh = masks.property(i).property('ADBE Mask Shape').valueAtTime(t, false);
            for (j = 0; j < sh.vertices.length; j++) {
                v = sh.vertices[j];
                pts = [v, [v[0] + sh.inTangents[j][0], v[1] + sh.inTangents[j][1]], [v[0] + sh.outTangents[j][0], v[1] + sh.outTangents[j][1]]];
                for (var q = 0; q < 3; q++) { l = Math.min(l, pts[q][0]); r = Math.max(r, pts[q][0]); tp = Math.min(tp, pts[q][1]); b = Math.max(b, pts[q][1]); }
            }
        }
        if (l === Infinity) { return null; }
        return { left: l, top: tp, width: r - l, height: b - tp };
    }

    /*
     * args: { compId, label, layers: [id], fx: 0..1, fy: 0..1, masks: bool, place: bool, compSize: [w, h] }
     * Puts the anchor at a point of the content box without moving the layer:
     *   - every Position key (joined, separated, 3D) shifts by the same parent-space delta;
     *   - a keyframed anchor shifts on every key;
     *   - scale / rotation / parenting are taken from the playhead (exact everywhere when they are
     *     static; when they animate the layer is exact at the playhead and the result says so);
     *   - 3D-rotated or auto-oriented layers are measured with AE's own toWorld / fromWorld.
     * place: also move the layer so that point sits on the same point of the comp (Alt-click).
     */
    ops['layers.moveAnchor'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Move Anchor', function () {
                var out = [], i, L, tr, ap, rect, a0, a1, da, dp, before, notes, probe, t = comp.time, p0, target, shift;
                for (i = 0; i < args.layers.length; i++) {
                    L = U.findLayer(comp, { layerId: args.layers[i] });
                    tr = L.property('ADBE Transform Group');
                    ap = tr ? tr.property('ADBE Anchor Point') : null;
                    if (L.locked) { out.push({ layerId: L.id, name: L.name, skipped: 'LOCKED' }); continue; }
                    if (!ap) { out.push({ layerId: L.id, name: L.name, skipped: 'NO_ANCHOR' }); continue; }
                    rect = args.masks ? maskBounds(L, t) : null;
                    if (!rect) { rect = L.sourceRectAtTime(t, false); }
                    if (!(rect.width > 0 || rect.height > 0)) { out.push({ layerId: L.id, name: L.name, skipped: 'NO_BOUNDS' }); continue; }
                    notes = [];
                    if (args.masks && !maskBounds(L, t)) { notes.push('no masks - used the layer content'); }
                    a0 = plain(ap.valueAtTime(t, false));
                    a1 = [rect.left + rect.width * num(args.fx), rect.top + rect.height * num(args.fy)];
                    if (a0.length > 2) { a1.push(a0[2]); }
                    da = [a1[0] - a0[0], a1[1] - a0[1], 0];
                    probe = rotated3D(L, tr, t) || autoOriented(L);
                    if (probe) { dp = probeDelta(comp, L, t, a0, a1); notes.push('measured in 3D'); } else { dp = lin2(tr, t, da); dp.push(0); }
                    if (moving(tr.property('ADBE Scale')) || moving(rotZ(tr)) || (probe && (moving(tr.property('ADBE Rotate X')) || moving(tr.property('ADBE Rotate Y')) || moving(tr.property('ADBE Orientation'))))) { notes.push('scale / rotation animate: exact at the playhead'); }
                    before = { anchor: snapProp(ap), pos: snapPos(tr) };
                    shiftProp(ap, -1, da);
                    shiftPos(tr, dp);
                    if (args.place) {
                        target = compToParentPt(L, t, [num(args.compSize[0]) * num(args.fx), num(args.compSize[1]) * num(args.fy)]);
                        if (target) {
                            p0 = posAt(tr, t);
                            shift = [target[0] - p0[0], target[1] - p0[1], 0];
                            shiftPos(tr, shift);
                            dp = [dp[0] + shift[0], dp[1] + shift[1], dp[2]];
                            notes.push('placed in the comp');
                        } else { notes.push('not placed: a parent is 3D-rotated'); }
                    }
                    out.push({ layerId: L.id, name: L.name, target: a1, delta: dp, notes: notes, before: before, after: { anchor: snapProp(ap), pos: snapPos(tr) }, anchorAt: plain(ap.valueAtTime(t, false)) });
                }
                return { layers: out, time: t };
            });
        }
    };

    /* args: { compId, layers: [{ layerId, anchor: snap, pos: snap }] } */
    ops['layers.restoreAnchor'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Restore Anchor', function () {
                var i, L, tr, a;
                for (i = 0; i < args.layers.length; i++) {
                    L = U.findLayer(comp, { layerId: args.layers[i].layerId });
                    tr = L.property('ADBE Transform Group');
                    a = args.layers[i].anchor;
                    if (a && (a.keys || a.value !== undefined)) { restoreSnap(tr.property('ADBE Anchor Point'), a); } else { tr.property('ADBE Anchor Point').setValue(a); }
                    restorePos(tr, args.layers[i].pos);
                }
                return { restored: args.layers.length };
            });
        }
    };

    /*
     * args: { compId, label, items: [{ layerId, delta: [dx, dy] }] } - delta in comp space.
     * Parented layers: the delta is turned into the parent's space (2D parents, values at the playhead).
     * Every Position key moves, so the whole animation moves.
     */
    ops['layers.nudge'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Align', function () {
                var out = [], i, it, L, tr, before, d, t = comp.time;
                for (i = 0; i < args.items.length; i++) {
                    it = args.items[i];
                    L = U.findLayer(comp, { layerId: it.layerId });
                    if (L.locked) { out.push({ layerId: L.id, name: L.name, skipped: 'LOCKED' }); continue; }
                    d = [num(it.delta[0]), num(it.delta[1])];
                    if (L.parent) {
                        d = compToParentVec(L, t, d);
                        if (!d) { out.push({ layerId: L.id, name: L.name, skipped: 'PARENT_3D' }); continue; }
                    }
                    tr = L.property('ADBE Transform Group');
                    before = snapPos(tr);
                    shiftPos(tr, [d[0], d[1], 0]);
                    out.push({ layerId: L.id, name: L.name, delta: d, parented: !!L.parent, before: before, after: snapPos(tr) });
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
            /* args.plain (v0.33 Cloner): exact copies - keyframes and transforms kept, the grid places them */
            var plainCopies = args.plain === true;
            if (!plainCopies && animated(str)) { U.fail('ANIMATED', 'Clone works on a layer without Position, Rotation, Scale or Opacity keyframes - clone first, then animate.'); }
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
                    if (plainCopies) { created.push({ layerId: d.id, name: d.name, position: getPos(tr), rotation: num(rotZ(tr).value) }); continue; }
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

    /* v0.63 (docs/features/PROGRESS.md): copies of several sources in ONE round trip and one undo group.
       args: { compId, label, plain, sources: [{ layerId, count }] } -> { results: [layers.clone result per source] } */
    ops['layers.cloneMany'] = {
        mutates: true,
        run: function (args) {
            var label = args.label || 'MOE: Clone';
            return U.withUndo(label, function () {
                var out = [], i, saved = G.MOE.tx;
                if (!saved) { G.MOE.tx = { label: label, opened: new Date().getTime(), inner: true }; } /* the clones join this one group */
                try {
                    for (i = 0; i < args.sources.length; i++) {
                        out.push(ops['layers.clone'].run({ compId: args.compId, label: label, layerId: args.sources[i].layerId, plain: args.plain === true, items: new Array(Math.max(0, Math.floor(args.sources[i].count))) }));
                    }
                } finally {
                    if (!saved) { G.MOE.tx = null; }
                }
                return { results: out };
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
