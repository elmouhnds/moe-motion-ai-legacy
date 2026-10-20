/*
 * MOE Motion AI — host utilities (ExtendScript / ES3).
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
        return s.length > max ? s.substring(0, max) + '…' : s;
    };

    U.withUndo = function (label, fn) {
        app.beginUndoGroup(label);
        try { return fn(); } finally { app.endUndoGroup(); }
    };
}($.global));
