/*
 * MOE Motion AI - host utilities (ExtendScript / ES3).
 * Addressing: a property is identified by { layerId, layerIndex, indices[], matchNames[] }.
 * We resolve by index (fast) and verify every level by matchName so a stale
 * address can never silently hit a different property.
 */
(function (G) {
    var MOE = G.MOE = G.MOE || {};
    var U = MOE.util = {};

    U.fail = function (code, message) {
        var e = new Error(message);
        e.moeCode = code;
        throw e;
    };

    U.activeComp = function () {
        if (!app.project) { U.fail('NO_PROJECT', 'No project is open.'); }
        var item = app.project.activeItem;
        if (!item || !(item instanceof CompItem)) {
            U.fail('NO_COMP', 'No active composition. Open a composition in the Timeline.');
        }
        return item;
    };

    U.compById = function (id) {
        /* v0.94: inside ONE tx.run, a comp that this same batch created (comps.create) may be written too - nothing else */
        var j;
        if (MOE.txComps && id !== undefined && id !== null) {
            for (j = 0; j < MOE.txComps.length; j++) { if (MOE.txComps[j].id === id) { return MOE.txComps[j]; } }
        }
        var comp = U.activeComp();
        if (id !== undefined && id !== null && comp.id !== id) {
            U.fail('COMP_CHANGED', 'The active composition changed since the context was read.');
        }
        return comp;
    };

    U.layerType = function (layer) {
        if (typeof TextLayer !== 'undefined' && layer instanceof TextLayer) { return 'text'; }
        if (typeof ShapeLayer !== 'undefined' && layer instanceof ShapeLayer) { return 'shape'; }
        if (typeof CameraLayer !== 'undefined' && layer instanceof CameraLayer) { return 'camera'; }
        if (typeof LightLayer !== 'undefined' && layer instanceof LightLayer) { return 'light'; }
        if (layer.nullLayer) { return 'null'; }
        if (layer.adjustmentLayer) { return 'adjustment'; }
        if (layer.source && layer.source.mainSource && layer.source.mainSource instanceof SolidSource) { return 'solid'; }
        return 'av';
    };

    U.findLayer = function (comp, ref) {
        var layer = null, i;
        if (ref.layerId !== undefined && ref.layerId !== null) {
            for (i = 1; i <= comp.numLayers; i++) {
                if (comp.layer(i).id === ref.layerId) { layer = comp.layer(i); break; }
            }
        } else if (ref.layerIndex) {
            if (ref.layerIndex >= 1 && ref.layerIndex <= comp.numLayers) { layer = comp.layer(ref.layerIndex); }
        }
        if (!layer) { U.fail('LAYER_NOT_FOUND', 'Layer not found (it may have been deleted).'); }
        return layer;
    };

    U.addressOf = function (prop, layer) {
        var indices = [], matchNames = [], p = prop;
        while (p && p.propertyDepth > 0) {
            indices.unshift(p.propertyIndex);
            matchNames.unshift(p.matchName);
            p = p.parentProperty;
        }
        return { layerId: layer.id, layerIndex: layer.index, indices: indices, matchNames: matchNames };
    };

    /* Addresses may omit indices (resolve by matchName) and may use "name:<display name>"
       entries to pick a named child (e.g. a specific MOE effect among several of one type). */
    function childByName(node, nm) {
        var j;
        for (j = 1; j <= node.numProperties; j++) { if (node.property(j).name === nm) { return node.property(j); } }
        return null;
    }

    U.resolveProperty = function (comp, addr) {
        var layer = U.findLayer(comp, addr), node = layer, i, next, mn, idx;
        for (i = 0; i < addr.matchNames.length; i++) {
            next = null;
            mn = addr.matchNames[i];
            idx = addr.indices ? addr.indices[i] : null;
            if (mn.substring(0, 5) === 'name:') {
                next = childByName(node, mn.substring(5));
                if (next) { node = next; continue; }
                U.fail('PROPERTY_NOT_FOUND', 'Property not found: ' + addr.matchNames.join(' > '));
            }
            if (idx) { try { next = node.property(idx); } catch (e1) { next = null; } }
            if (!next || next.matchName !== mn) {
                try { next = node.property(mn); } catch (e2) { next = null; }
            }
            if (!next) {
                U.fail('PROPERTY_NOT_FOUND', 'Property not found: ' + addr.matchNames.join(' > '));
            }
            node = next;
        }
        return { layer: layer, prop: node };
    };

    U.valueTypeName = function (t) {
        var V = PropertyValueType;
        if (t === V.OneD) { return 'OneD'; }
        if (t === V.TwoD) { return 'TwoD'; }
        if (t === V.ThreeD) { return 'ThreeD'; }
        if (t === V.TwoD_SPATIAL) { return 'TwoD_SPATIAL'; }
        if (t === V.ThreeD_SPATIAL) { return 'ThreeD_SPATIAL'; }
        if (t === V.COLOR) { return 'COLOR'; }
        if (t === V.SHAPE) { return 'SHAPE'; }
        if (t === V.TEXT_DOCUMENT) { return 'TEXT_DOCUMENT'; }
        if (t === V.MARKER) { return 'MARKER'; }
        if (t === V.LAYER_INDEX) { return 'LAYER_INDEX'; }
        if (t === V.MASK_INDEX) { return 'MASK_INDEX'; }
        if (t === V.CUSTOM_VALUE) { return 'CUSTOM_VALUE'; }
        if (t === V.NO_VALUE) { return 'NO_VALUE'; }
        return 'UNKNOWN';
    };

    /* Number of KeyframeEase objects setTemporalEaseAtKey expects (Scripting Guide). */
    U.easeDimensions = function (prop) {
        var t = prop.propertyValueType;
        if (t === PropertyValueType.TwoD) { return 2; }
        if (t === PropertyValueType.ThreeD) { return 3; }
        return 1;
    };

    U.interpName = function (t) {
        if (t === KeyframeInterpolationType.LINEAR) { return 'LINEAR'; }
        if (t === KeyframeInterpolationType.BEZIER) { return 'BEZIER'; }
        if (t === KeyframeInterpolationType.HOLD) { return 'HOLD'; }
        return 'UNKNOWN';
    };

    U.interpFromName = function (n) {
        if (n === 'LINEAR') { return KeyframeInterpolationType.LINEAR; }
        if (n === 'HOLD') { return KeyframeInterpolationType.HOLD; }
        return KeyframeInterpolationType.BEZIER;
    };

    U.easeToPlain = function (arr) {
        var out = [], i;
        for (i = 0; i < arr.length; i++) { out.push({ speed: arr[i].speed, influence: arr[i].influence }); }
        return out;
    };

    U.easeFromPlain = function (arr) {
        var out = [], i;
        for (i = 0; i < arr.length; i++) { out.push(new KeyframeEase(arr[i].speed, arr[i].influence)); }
        return out;
    };

    U.truncate = function (s, max) {
        s = String(s || '');
        return s.length > max ? s.substring(0, max) + '\u2026' : s;
    };

    /* v0.62 (docs/features/LINKS.md): a MOE expression (tagged "// MOE") that names a layer gets that layer's permanent
       After Effects id beside the name, as a MOE-LINK comment inside the layer() call. The expression still finds the
       layer by name (fast); links.relink uses the id to write the new name after a rename. Nothing is added to layers. */
    U.linkCode = function (comp, code) {
        code = String(code || '');
        if (!/\/\/ MOE/.test(code) || !/thisComp\.layer\("/.test(code)) { return code; }
        return code.replace(/thisComp\.layer\("((?:[^"\\]|\\.)*)"\)/g, function (m, raw) {
            var name = raw.replace(/\\(["\\])/g, '$1'), k;
            for (k = 1; k <= comp.numLayers; k++) {
                if (comp.layer(k).name === name) { return 'thisComp.layer(/*MOE-LINK:' + comp.layer(k).id + '*/"' + raw + '")'; }
            }
            return m;
        });
    };

    /* v0.61 (docs/features/ENGINE2.md): inside a run's transaction (tx.begin ... tx.end) every op joins the run's
       one undo group, so one Ctrl+Z undoes the whole run. Outside a transaction each op is its own group. */
    /*
     * One undo group per host call. v0.94: After Effects closes an undo group when the script that opened it returns
     * ("in its absence at the end of a script, the system will close the undo group automatically" - Scripting Guide,
     * app.endUndoGroup), so a group can never span two panel calls. The v0.61 tx.begin skipped this group, which left
     * every action of the later calls as its own undo step. Groups nest (inner names are ignored), so tx.run's
     * single group holds every op it runs.
     * v0.98.2 (owner's After Effects 26.5: "Undo group mismatch, will attempt to fix"): the "groups nest" assumption
     * above was never verified. Only the OUTERMOST call opens and closes a group now (MOE.undoDepth); an op run
     * inside tx.run writes into tx.run's group and never calls begin/end itself.
     */
    /* v0.99.1 (Tile Test, After Effects 26.5: 'Unable to set "label". MOE: Carousel is not an integer'): Layer.label is
       a label colour 0..16; anything else is ignored, never written. */
    U.isLabel = function (v) { return typeof v === 'number' && v >= 0 && v <= 16 && Math.floor(v) === v; };

    /* v0.99.5 (read in After Effects 26.5.3 by hand: Layer > New > Null Object with three layers selected left
       ONLY the new null selected): adding a layer SELECTS it and deselects every other layer, and removing that
       layer leaves nothing selected. A tool that adds a TEMPORARY probe layer therefore destroys the user's
       selection - Align & Distribute left 0 layers selected, so its own "next step" (Distribute) was dead.
       Wrap such a measurement in U.keepSelection: it remembers which layers were selected and puts them back.
       Layer.selected is read/write (After Effects Scripting Guide, Layer object). */
    U.keepSelection = function (comp, fn) {
        var before = [], i;
        try {
            for (i = 1; i <= comp.numLayers; i++) { if (comp.layer(i).selected) { before.push(comp.layer(i)); } }
        } catch (eRead) { before = []; }
        try { return fn(); } finally {
            try {
                for (i = 1; i <= comp.numLayers; i++) { comp.layer(i).selected = false; }
                for (i = 0; i < before.length; i++) { before[i].selected = true; }
            } catch (eSet) { /* a layer the run removed cannot be reselected; the rest are */ }
        }
    };

    /* v0.99.5 (manual test, After Effects 26.5.3): comp.layers.addNull() also puts a SOLID of its own in the
       project ("Null 1", "Null 2", ...), and removing the layer leaves that solid behind - the owner's Solids
       folder filled up with them, and the tile test saw "project items 82 -> 83" on every auto-distance move.
       A temporary probe has to take its source with it. AVItem.usedIn lists the comps still using an item
       (After Effects Scripting Guide), so the source is only removed when nothing is left using it. */
    /* Returns the name of the item it removed, or '' - NEVER the item, which is invalid once it is gone
       (v0.99.5: reading src.name after src.remove() threw "Object is invalid" and killed every grid restore). */
    U.dropSource = function (src) {
        if (!src) { return ''; }
        var name = '';
        try { name = String(src.name || ''); } catch (eName) { return ''; }
        /* Only items MOE itself made: its own "MOE ..." solids and the "Null N" solid After Effects makes for a
           null. Never anything else of the user's, and never one another layer still uses. */
        if (name.substring(0, 4) !== 'MOE ' && !/^Null \d+$/.test(name)) { return ''; }
        try {
            if (src instanceof CompItem) { return ''; }
            if (src.usedIn && src.usedIn.length === 0) { src.remove(); return name; }
        } catch (eItem) { /* leave it rather than risk the user's project */ }
        return '';
    };

    /* The sources a comp's layers use, read BEFORE the comp is removed (afterwards its layers are gone). */
    U.sourcesOf = function (c) {
        var out = [], i, src;
        try {
            for (i = 1; i <= c.numLayers; i++) {
                src = null;
                try { src = c.layer(i).source; } catch (eS) { src = null; }
                if (src) { out.push(src); }
            }
        } catch (eC) { /* best effort */ }
        return out;
    };

    U.dropProbe = function (probe) {
        var src = null;
        if (!probe) { return; }
        try { src = probe.source; } catch (eSrc) { src = null; }
        try { probe.remove(); } catch (eRemove) { /* the caller checks the layer count */ }
        U.dropSource(src);
    };

    U.withUndo = function (label, fn) {
        var outer = !(MOE.undoDepth > 0);
        if (outer) {
            app.beginUndoGroup(label); MOE.undoDepth = 0;
            /* v0.98.2: the labels of the groups MOE opened (newest last) - the tile test presses Edit > Undo <label> */
            if (!(MOE.undoLabels instanceof Array)) { MOE.undoLabels = []; }
            MOE.undoLabels.push(String(label)); if (MOE.undoLabels.length > 50) { MOE.undoLabels.shift(); }
        }
        MOE.undoDepth += 1;
        try { return fn(); } finally {
            MOE.undoDepth -= 1;
            if (outer) { MOE.undoDepth = 0; app.endUndoGroup(); }
        }
    };
}($.global));
