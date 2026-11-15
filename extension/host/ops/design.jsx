/*
 * MOE Motion AI - design ops (ExtendScript / ES3).
 *
 *   shapes.insert   one shape layer with one named group: either Bezier paths (icons / SVG)
 *                   or a native parametric primitive (Rectangle / Ellipse / Polystar), plus
 *                   stroke and/or fill. Reads everything back. On any failure the layer it
 *                   created is removed before the error is reported.
 *
 * Match names used (After Effects Scripting Guide > Shape layer match names):
 *   ADBE Root Vectors Group, ADBE Vector Group, ADBE Vectors Group, ADBE Vector Transform Group,
 *   ADBE Vector Shape - Group / ADBE Vector Shape, ADBE Vector Shape - Rect (Size, Position, Roundness),
 *   ADBE Vector Shape - Ellipse (Size, Position), ADBE Vector Shape - Star (Type, Points, Position,
 *   Rotation, Inner/Outer Radius, Inner/Outer Roundess - AE's own spelling),
 *   ADBE Vector Graphic - Stroke (Color, Opacity, Width, Line Cap, Line Join),
 *   ADBE Vector Graphic - Fill (Color, Opacity, Fill Rule).
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function rgba(c, a) { c = c || [1, 1, 1]; return [num(c[0]), num(c[1]), num(c[2]), a === undefined ? 1 : num(a)]; }
    function plain(v) {
        if (v && typeof v === 'object' && v.length !== undefined) { var a = [], i; for (i = 0; i < v.length; i++) { a.push(Math.round(num(v[i]) * 10000) / 10000); } return a; }
        return num(v);
    }

    function makeShape(p) {
        var s = new Shape(), i, v = [], ti = [], to = [];
        for (i = 0; i < p.v.length; i++) {
            v.push([num(p.v[i][0]), num(p.v[i][1])]);
            ti.push(p.i && p.i[i] ? [num(p.i[i][0]), num(p.i[i][1])] : [0, 0]);
            to.push(p.o && p.o[i] ? [num(p.o[i][0]), num(p.o[i][1])] : [0, 0]);
        }
        s.vertices = v; s.inTangents = ti; s.outTangents = to; s.closed = !!p.c;
        return s;
    }

    /* Set a property by match name; collect what is missing instead of guessing. */
    function setProp(group, matchName, value, missing) {
        var p = null;
        try { p = group.property(matchName); } catch (e) { p = null; }
        if (!p) { missing.push(matchName); return null; }
        p.setValue(value);
        return p;
    }

    var PRIMS = { rect: 'ADBE Vector Shape - Rect', ellipse: 'ADBE Vector Shape - Ellipse', star: 'ADBE Vector Shape - Star', polygon: 'ADBE Vector Shape - Star' };

    /* args: { compId, name, label, groupName, paths: [{ v, i, o, c }] | primitive: { type, size:[w,h], roundness,
               points, outer, inner, outerRound, innerRound, rotation },
               stroke: { color, width, opacity, cap, join } | null, fill: { color, opacity, rule } | null,
               position: [x, y] (default comp centre), inPoint, outPoint } */
    ops['shapes.insert'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            var hasPaths = args.paths && args.paths.length;
            if (!hasPaths && !args.primitive) { U.fail('BAD_ARGS', 'Nothing to draw.'); }
            if (hasPaths && args.paths.length > 200) { U.fail('BAD_ARGS', 'Too many paths (max 200).'); }
            if (args.primitive && !PRIMS[args.primitive.type]) { U.fail('BAD_ARGS', 'Unknown primitive ' + args.primitive.type); }
            if (!args.stroke && !args.fill) { U.fail('BAD_ARGS', 'Choose a stroke, a fill or both.'); }
            return U.withUndo('MOE: Insert Shape', function () {
                var L = comp.layers.addShape(), gi, i, c, item, missing = [], ok = false, pr = args.primitive;
                /* Re-acquire the group contents after every addProperty (earlier references can go stale). */
                var contents = function () { return L.property('ADBE Root Vectors Group').property(gi).property('ADBE Vectors Group'); };
                try {
                    L.name = args.name || 'MOE Shape';
                    if (U.isLabel(args.label)) { L.label = args.label; }
                    gi = L.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group').propertyIndex;
                    L.property('ADBE Root Vectors Group').property(gi).name = args.groupName || 'Shape';
                    if (hasPaths) {
                        for (i = 0; i < args.paths.length; i++) {
                            item = contents().addProperty('ADBE Vector Shape - Group').propertyIndex;
                            contents().property(item).property('ADBE Vector Shape').setValue(makeShape(args.paths[i]));
                        }
                    } else {
                        item = contents().addProperty(PRIMS[pr.type]).propertyIndex;
                        c = contents().property(item);
                        if (pr.type === 'rect') {
                            setProp(c, 'ADBE Vector Rect Size', [num(pr.size[0]), num(pr.size[1])], missing);
                            setProp(contents().property(item), 'ADBE Vector Rect Roundness', num(pr.roundness), missing);
                        } else if (pr.type === 'ellipse') {
                            setProp(c, 'ADBE Vector Ellipse Size', [num(pr.size[0]), num(pr.size[1])], missing);
                        } else {
                            setProp(c, 'ADBE Vector Star Type', pr.type === 'star' ? 1 : 2, missing);
                            c = contents().property(item);
                            setProp(c, 'ADBE Vector Star Points', Math.max(3, Math.round(num(pr.points) || 5)), missing);
                            setProp(c, 'ADBE Vector Star Outer Radius', num(pr.outer) || 100, missing);
                            setProp(c, 'ADBE Vector Star Outer Roundess', num(pr.outerRound), missing);
                            setProp(c, 'ADBE Vector Star Rotation', num(pr.rotation), missing);
                            if (pr.type === 'star') {
                                setProp(c, 'ADBE Vector Star Inner Radius', num(pr.inner) || 50, missing);
                                setProp(c, 'ADBE Vector Star Inner Roundess', num(pr.innerRound), missing);
                            }
                        }
                    }
                    /* Stroke before fill = stroke drawn on top. */
                    if (args.stroke) {
                        item = contents().addProperty('ADBE Vector Graphic - Stroke').propertyIndex;
                        c = contents().property(item);
                        setProp(c, 'ADBE Vector Stroke Color', rgba(args.stroke.color), missing);
                        setProp(c, 'ADBE Vector Stroke Width', num(args.stroke.width) || 1, missing);
                        if (args.stroke.opacity !== undefined) { setProp(c, 'ADBE Vector Stroke Opacity', num(args.stroke.opacity), missing); }
                        if (args.stroke.cap) { setProp(c, 'ADBE Vector Stroke Line Cap', num(args.stroke.cap), missing); }
                        if (args.stroke.join) { setProp(c, 'ADBE Vector Stroke Line Join', num(args.stroke.join), missing); }
                    }
                    if (args.fill) {
                        item = contents().addProperty('ADBE Vector Graphic - Fill').propertyIndex;
                        c = contents().property(item);
                        setProp(c, 'ADBE Vector Fill Color', rgba(args.fill.color), missing);
                        if (args.fill.opacity !== undefined) { setProp(c, 'ADBE Vector Fill Opacity', num(args.fill.opacity), missing); }
                        if (args.fill.rule) { setProp(c, 'ADBE Vector Fill Rule', num(args.fill.rule), missing); }
                    }
                    if (missing.length) { U.fail('PROPERTY_MISSING', 'Shape properties not found: ' + missing.join(', ')); }
                    var tg = L.property('ADBE Transform Group');
                    tg.property('ADBE Anchor Point').setValue([0, 0]);
                    tg.property('ADBE Position').setValue(args.position ? [num(args.position[0]), num(args.position[1])] : [comp.width / 2, comp.height / 2]);
                    if (args.inPoint !== undefined && args.inPoint !== null) { L.inPoint = num(args.inPoint); }
                    if (args.outPoint !== undefined && args.outPoint !== null) { L.outPoint = num(args.outPoint); }
                    ok = true;
                } finally {
                    if (!ok) { try { L.remove(); } catch (eRm) { /* already gone */ } }
                }
                /* Read back what is now in the project. */
                var back = { layerId: L.id, index: L.index, name: L.name, group: L.property('ADBE Root Vectors Group').property(gi).name, paths: 0, primitive: null, stroke: null, fill: null };
                var cc = contents(), p, mn;
                for (i = 1; i <= cc.numProperties; i++) {
                    p = cc.property(i); mn = p.matchName;
                    if (mn === 'ADBE Vector Shape - Group') { back.paths++; }
                    else if (mn === PRIMS.rect || mn === PRIMS.ellipse || mn === PRIMS.star) { back.primitive = mn; }
                    else if (mn === 'ADBE Vector Graphic - Stroke') { back.stroke = { color: plain(p.property('ADBE Vector Stroke Color').value), width: plain(p.property('ADBE Vector Stroke Width').value) }; }
                    else if (mn === 'ADBE Vector Graphic - Fill') { back.fill = { color: plain(p.property('ADBE Vector Fill Color').value) }; }
                }
                back.position = plain(L.property('ADBE Transform Group').property('ADBE Position').value);
                back.addresses = {
                    position: { layerId: L.id, matchNames: ['ADBE Transform Group', 'ADBE Position'] },
                    scale: { layerId: L.id, matchNames: ['ADBE Transform Group', 'ADBE Scale'] },
                    rotation: { layerId: L.id, matchNames: ['ADBE Transform Group', 'ADBE Rotate Z'] },
                    opacity: { layerId: L.id, matchNames: ['ADBE Transform Group', 'ADBE Opacity'] }
                };
                return back;
            });
        }
    };
    /* v0.95 Matte Reveal (docs/features/MATTE_REVEAL.md).
     * layers.rects: read-only. For each layer: its content box in its own layer space (AVLayer.sourceRectAtTime,
     * extents false), 3D switch, its current track matte layer (AE 23+: Layer.trackMatteLayer), in / out points.
     * args: { compId, layerIds: [id] (max 300), time } -> { layers: [{ layerId, name, rect: [l, t, w, h], threeD,
     *          matte: { layerId, name } | null, inPoint, outPoint }] } */
    ops['layers.rects'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId), out = [], i, L, r, m, t;
            if (!args.layerIds || args.layerIds.length > 300) { U.fail('BAD_ARGS', 'Give 1 to 300 layers.'); }
            t = args.time !== undefined && args.time !== null ? num(args.time) : comp.time;
            for (i = 0; i < args.layerIds.length; i++) {
                L = U.findLayer(comp, { layerId: args.layerIds[i] });
                r = null;
                try { r = L.sourceRectAtTime(t, false); } catch (e) { r = null; }
                m = null;
                try { if (L.trackMatteLayer) { m = { layerId: L.trackMatteLayer.id, name: L.trackMatteLayer.name }; } } catch (e2) { m = null; }
                out.push({ layerId: L.id, name: L.name, rect: r ? [num(r.left), num(r.top), num(r.width), num(r.height)] : null,
                    threeD: !!L.threeDLayer, matte: m, inPoint: L.inPoint, outPoint: L.outPoint });
            }
            return { layers: out };
        }
    };

    /* shapes.matte: ONE shape layer of white cells (one group per cell: rectangle or ellipse + fill), placed right above
     * the target, given the target's in / out points, its own transform at identity and parented to the target with
     * setParentWithJump (which keeps those values) - so every cell's group Position is a point of the target's layer
     * space and the matte follows the target. Setting it as a track matte is layers.setMatte (a separate step of the
     * same plan). On any failure the new layer is removed.
     * args: { compId, targetId, name (starts "MOE Matte"), label, cells: [{ name, kind: rect|ellipse, size: [w, h],
     *          roundness, anchor: [x, y], position: [x, y], rotation, scale: [sx, sy] }] (max 200) }
     * -> { layerId, name, index, cells, parentId } */
    ops['shapes.matte'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId), T = U.findLayer(comp, { layerId: args.targetId });
            if (!args.name || String(args.name).substring(0, 9) !== 'MOE Matte') { U.fail('BAD_ARGS', 'A matte layer is named "MOE Matte ...".'); }
            if (!args.cells || !args.cells.length || args.cells.length > 200) { U.fail('BAD_ARGS', 'Give 1 to 200 cells.'); }
            return U.withUndo('MOE: Matte', function () {
                var L = comp.layers.addShape(), ok = false, missing = [], i, c, gi, item, tg, cell, root;
                var contents = function () { return L.property('ADBE Root Vectors Group').property(gi).property('ADBE Vectors Group'); };
                try {
                    L.name = args.name;
                    if (U.isLabel(args.label)) { L.label = args.label; }
                    for (i = 0; i < args.cells.length; i++) {
                        cell = args.cells[i];
                        root = L.property('ADBE Root Vectors Group');
                        gi = root.addProperty('ADBE Vector Group').propertyIndex;
                        L.property('ADBE Root Vectors Group').property(gi).name = cell.name || ('Cell ' + (i + 1));
                        if (cell.kind === 'ellipse') {
                            item = contents().addProperty('ADBE Vector Shape - Ellipse').propertyIndex;
                            setProp(contents().property(item), 'ADBE Vector Ellipse Size', [num(cell.size[0]), num(cell.size[1])], missing);
                        } else {
                            item = contents().addProperty('ADBE Vector Shape - Rect').propertyIndex;
                            setProp(contents().property(item), 'ADBE Vector Rect Size', [num(cell.size[0]), num(cell.size[1])], missing);
                            setProp(contents().property(item), 'ADBE Vector Rect Roundness', num(cell.roundness), missing);
                        }
                        item = contents().addProperty('ADBE Vector Graphic - Fill').propertyIndex;
                        setProp(contents().property(item), 'ADBE Vector Fill Color', [1, 1, 1, 1], missing);
                        tg = L.property('ADBE Root Vectors Group').property(gi).property('ADBE Vector Transform Group');
                        setProp(tg, 'ADBE Vector Anchor', [num(cell.anchor[0]), num(cell.anchor[1])], missing);
                        setProp(tg, 'ADBE Vector Position', [num(cell.position[0]), num(cell.position[1])], missing);
                        setProp(tg, 'ADBE Vector Scale', cell.scale ? [num(cell.scale[0]), num(cell.scale[1])] : [100, 100], missing);
                        setProp(tg, 'ADBE Vector Rotation', num(cell.rotation), missing);
                    }
                    if (missing.length) { U.fail('PROPERTY_MISSING', 'Shape properties not found: ' + missing.join(', ')); }
                    c = L.property('ADBE Transform Group');
                    c.property('ADBE Anchor Point').setValue([0, 0]);
                    c.property('ADBE Position').setValue([0, 0]);
                    L.inPoint = T.inPoint;
                    L.outPoint = T.outPoint;
                    L.moveBefore(T);
                    L.setParentWithJump(T);
                    ok = true;
                } finally {
                    if (!ok) { try { L.remove(); } catch (eRm) { /* already gone */ } }
                }
                return { layerId: L.id, name: L.name, index: L.index, cells: args.cells.length, parentId: L.parent ? L.parent.id : null };
            });
        }
    };
}($.global));
