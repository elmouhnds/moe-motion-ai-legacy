/*
 * MOE Motion AI - Thick Glass host operations (ExtendScript / ES3).
 *
 *  glass.map        Builds the live height map of a Thick Glass: a new comp "MOE Glass N Map"
 *                   (same size / rate / duration as the active comp) that holds a copy of each
 *                   source layer (Layer.copyToComp), painted white (Fill) and linked back to the
 *                   source by expressions - transform through toComp (parents and animation
 *                   included), and every shape / mask / text / time-remap value by property index.
 *                   The comp is then added to the active comp as a hidden layer above the sources.
 *                   Effects that read another layer (CC Glass "Bump Map") use that layer's source
 *                   only - no effects, masks or transforms - so the map must be a comp in comp space.
 *  glass.removeMap  Removes "MOE Glass N Map" layers and their comps (only when nothing else uses them).
 *
 * Scripting Guide: ItemCollection.addComp, Layer.copyToComp, LayerCollection.add(AVItem),
 * CompItem.usedIn, Item.remove, Property.expression / expressionError.
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    var MAP_NAME = /^MOE Glass \d+ Map$/;
    /* Top-level groups whose values shape the alpha; linked leaf by leaf. */
    var LINKED_GROUPS = ['ADBE Root Vectors Group', 'ADBE Mask Parade', 'ADBE Text Properties', 'ADBE Time Remapping'];
    var MAX_LINKS = 400;

    function isIn(list, v) { var i; for (i = 0; i < list.length; i++) { if (list[i] === v) { return true; } } return false; }

    function linkable(p) {
        var t;
        try { t = p.propertyValueType; } catch (e) { return false; }
        if (t === PropertyValueType.NO_VALUE || t === PropertyValueType.COLOR || t === PropertyValueType.CUSTOM_VALUE ||
            t === PropertyValueType.MARKER || t === PropertyValueType.LAYER_INDEX || t === PropertyValueType.MASK_INDEX) { return false; }
        return !!p.canSetExpression;
    }

    /* Walk a group; leaves get the link to the same index path on the source, other expressions are cleared. */
    function linkTree(node, path, out, depth) {
        var i, p, here;
        if (depth > 14) { return; }
        if (node.propertyType === PropertyType.PROPERTY) {
            if (linkable(node) && out.count < MAX_LINKS) {
                node.expression = '// MOE Glass\n' + path + ';';
                out.count++;
                if (node.expressionError) { out.errors.push(node.name + ': ' + node.expressionError); }
            } else if (node.canSetExpression && node.expression) {
                node.expression = '';
                if (out.count >= MAX_LINKS) { out.capped = true; }
            }
            return;
        }
        for (i = 1; i <= node.numProperties; i++) {
            p = node.property(i);
            here = path + '(' + i + ')';
            linkTree(p, here, out, depth + 1);
        }
    }

    function clearOther(node, depth) {
        var i;
        if (depth > 14) { return; }
        if (node.propertyType === PropertyType.PROPERTY) {
            if (node.canSetExpression && node.expression) { node.expression = ''; }
            return;
        }
        for (i = 1; i <= node.numProperties; i++) { clearOther(node.property(i), depth + 1); }
    }

    function setExpr(prop, code, errors, label) {
        prop.expression = code;
        if (prop.expressionError) { errors.push(label + ': ' + prop.expressionError); }
    }

    /*
     * args: { compId, name, above: layerId, label, comment,
     *         items: [{ sourceId, base: 'comp("Main").layer("Src")',
     *                   transform: { anchor, position, scale, rotation, opacity } }] }
     */
    ops['glass.map'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            if (!MAP_NAME.test(String(args.name))) { U.fail('BAD_NAME', 'Map name must be "MOE Glass N Map".'); }
            if (!args.items || !args.items.length) { U.fail('NO_SOURCES', 'No source layers for the glass map.'); }
            return U.withUndo(args.label || 'MOE: Thick Glass Map', function () {
                var map = null, holder = null, copies = [], i, it, src, c, before, tg, parade, k, fill, fi, out, g, mn, gi;
                try {
                    map = app.project.items.addComp(args.name, comp.width, comp.height, comp.pixelAspect, comp.duration, comp.frameRate);
                    for (i = 0; i < args.items.length; i++) {
                        it = args.items[i];
                        src = U.findLayer(comp, { layerId: it.sourceId });
                        if (src.threeDLayer) { U.fail('THREE_D', '"' + src.name + '" is a 3D layer - Thick Glass works on 2D layers.'); }
                        before = map.numLayers;
                        src.copyToComp(map);
                        if (map.numLayers !== before + 1) { U.fail('COPY_FAILED', 'Could not copy "' + src.name + '" into the glass map.'); }
                        c = map.layer(1);
                        try { c.parent = null; } catch (eParent) { /* copy had no parent */ }
                        try { if (c.hasTrackMatte) { c.removeTrackMatte(); } } catch (eMatte) { /* AE < 23 */ }
                        c.enabled = true;
                        c.locked = false;
                        c.shy = false;
                        parade = c.property('ADBE Effect Parade');
                        for (k = parade.numProperties; k >= 1; k--) { parade.property(k).remove(); }
                        tg = c.property('ADBE Transform Group');
                        if (tg.property('ADBE Position').dimensionsSeparated) { tg.property('ADBE Position').dimensionsSeparated = false; }
                        clearOther(tg, 1);
                        out = { count: 0, errors: [], capped: false };
                        setExpr(tg.property('ADBE Anchor Point'), it.transform.anchor, out.errors, 'Anchor Point');
                        setExpr(tg.property('ADBE Position'), it.transform.position, out.errors, 'Position');
                        setExpr(tg.property('ADBE Scale'), it.transform.scale, out.errors, 'Scale');
                        setExpr(tg.property('ADBE Rotate Z'), it.transform.rotation, out.errors, 'Rotation');
                        setExpr(tg.property('ADBE Opacity'), it.transform.opacity, out.errors, 'Opacity');
                        for (gi = 0; gi < LINKED_GROUPS.length; gi++) {
                            mn = LINKED_GROUPS[gi];
                            if (mn === 'ADBE Time Remapping' && !c.timeRemapEnabled) { continue; }
                            g = null;
                            try { g = c.property(mn); } catch (eGroup) { g = null; }
                            if (g) { linkTree(g, it.base + '("' + mn + '")', out, 1); }
                        }
                        /* Anything else (layer styles, material options...) must not keep stale expressions. */
                        for (k = 1; k <= c.numProperties; k++) {
                            g = c.property(k);
                            if (!g || isIn(LINKED_GROUPS, g.matchName) || g.matchName === 'ADBE Transform Group' || g.matchName === 'ADBE Effect Parade') { continue; }
                            clearOther(g, 1);
                        }
                        /* White fill: the map's luminance and alpha both equal the shape. */
                        fill = c.property('ADBE Effect Parade').addProperty('ADBE Fill');
                        fill.name = 'MOE Glass Map Fill';
                        for (fi = 1; fi <= fill.numProperties; fi++) {
                            if (fill.property(fi).name === 'Color') { fill.property(fi).setValue([1, 1, 1, 1]); }
                        }
                        copies.push({ sourceId: src.id, sourceName: src.name, copyId: c.id, links: out.count, capped: out.capped, errors: out.errors });
                    }
                    holder = comp.layers.add(map);
                    holder.name = args.name;
                    if (args.above) { holder.moveBefore(U.findLayer(comp, { layerId: args.above })); }
                    holder.enabled = false;
                    if (U.isLabel(args.label)) { holder.label = args.label; }
                    if (args.comment) { holder.comment = String(args.comment); }
                } catch (e) {
                    try { if (holder) { holder.remove(); } } catch (eH) { /* best effort */ }
                    try { if (map) { map.remove(); } } catch (eM) { /* best effort */ }
                    throw e;
                }
                return { mapCompId: map.id, mapLayerId: holder.id, name: holder.name, enabled: holder.enabled, size: [map.width, map.height], copies: copies };
            });
        }
    };

    /* args: { compId, mapLayerIds: [] } */
    ops['glass.removeMap'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Remove Glass Map', function () {
                var removed = [], comps = 0, i, L, item;
                for (i = 0; i < args.mapLayerIds.length; i++) {
                    L = null;
                    try { L = U.findLayer(comp, { layerId: args.mapLayerIds[i] }); } catch (eFind) { L = null; }
                    if (!L || !MAP_NAME.test(L.name)) { continue; }
                    item = L.source;
                    removed.push(L.name);
                    L.remove();
                    if (item && item instanceof CompItem && MAP_NAME.test(item.name) && item.usedIn.length === 0) { item.remove(); comps++; }
                }
                return { removed: removed, compsRemoved: comps };
            });
        }
    };
}($.global));
