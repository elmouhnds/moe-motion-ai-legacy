/*
 * MOE Motion AI — read-only host operations: ping and selection context.
 * Never scans the full project: only the active comp and its current selection.
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    ops['host.ping'] = {
        mutates: false,
        run: function () {
            return {
                appName: 'After Effects',
                appVersion: app.version,
                buildNumber: app.buildNumber,
                buildName: app.buildName,
                language: app.isoLanguage,
                os: $.os,
                engineVersion: $.version,
                hostModuleVersion: MOE.version,
                projectOpen: !!app.project,
                projectFile: (app.project && app.project.file) ? app.project.file.fsName : null
            };
        }
    };

    function describeProperty(prop, layer, limits) {
        var info = {
            address: U.addressOf(prop, layer),
            name: prop.name,
            matchName: prop.matchName,
            valueType: U.valueTypeName(prop.propertyValueType),
            isSpatial: prop.isSpatial,
            canVaryOverTime: prop.canVaryOverTime,
            numKeys: prop.numKeys,
            selectedKeys: [],
            canSetExpression: prop.canSetExpression,
            expression: '',
            expressionEnabled: false,
            expressionError: ''
        };
        var sel = prop.selectedKeys || [], i;
        for (i = 0; i < sel.length && i < limits.maxKeys; i++) { info.selectedKeys.push(sel[i]); }
        if (sel.length > limits.maxKeys) { info.selectedKeysTruncated = sel.length; }
        if (prop.numKeys > 0) {
            info.firstKeyTime = prop.keyTime(1);
            info.lastKeyTime = prop.keyTime(prop.numKeys);
        }
        if (prop.canSetExpression) {
            info.expression = U.truncate(prop.expression, limits.maxExpressionChars);
            info.expressionLength = String(prop.expression || '').length;
            info.expressionEnabled = prop.expressionEnabled;
            info.expressionError = prop.expressionError || '';
        }
        return info;
    }

    function listEffects(layer) {
        var out = [], parade = null, i, fx;
        try { parade = layer.property('ADBE Effect Parade'); } catch (e) { parade = null; }
        if (!parade) { return out; }
        for (i = 1; i <= parade.numProperties && i <= 40; i++) {
            fx = parade.property(i);
            out.push({ index: i, name: fx.name, matchName: fx.matchName, enabled: fx.enabled });
        }
        return out;
    }

    ops['context.get'] = {
        mutates: false,
        run: function (args) {
            var limits = {
                maxLayers: (args && args.maxLayers) || 200,
                maxProps: (args && args.maxProps) || 200,
                maxKeys: (args && args.maxKeys) || 500,
                maxExpressionChars: (args && args.maxExpressionChars) || 4000,
                maxCompLayers: (args && args.maxCompLayers) || 300
            };
            var result = { project: null, comp: null, layers: [], properties: [], truncated: false };
            if (!app.project) { return result; }
            result.project = {
                name: app.project.file ? app.project.file.name : 'Untitled Project',
                saved: !app.project.dirty
            };
            try { result.expressionEngine = app.project.expressionEngine; } catch (eEngine) { result.expressionEngine = 'unknown'; }
            try { result.project.bitsPerChannel = app.project.bitsPerChannel; } catch (eBpc) { result.project.bitsPerChannel = null; }
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) { return result; }

            result.comp = {
                id: comp.id,
                name: comp.name,
                width: comp.width,
                height: comp.height,
                pixelAspect: comp.pixelAspect,
                frameRate: comp.frameRate,
                frameDuration: comp.frameDuration,
                duration: comp.duration,
                time: comp.time,
                workAreaStart: comp.workAreaStart,
                workAreaDuration: comp.workAreaDuration,
                numLayers: comp.numLayers,
                displayStartTime: comp.displayStartTime
            };

            var layers = comp.selectedLayers, i, L;
            for (i = 0; i < layers.length; i++) {
                if (i >= limits.maxLayers) { result.truncated = true; break; }
                L = layers[i];
                result.layers.push({
                    id: L.id,
                    index: L.index,
                    name: L.name,
                    type: U.layerType(L),
                    parentIndex: L.parent ? L.parent.index : null,
                    startTime: L.startTime,
                    inPoint: L.inPoint,
                    outPoint: L.outPoint,
                    stretch: L.stretch,
                    locked: L.locked,
                    enabled: L.enabled,
                    threeD: !!L.threeDLayer,
                    selectionOrder: i,
                    width: L.width || 0,
                    height: L.height || 0,
                    effects: listEffects(L)
                });
            }

            /* Lightweight list of every layer in the active comp (names only, capped). */
            result.compLayers = [];
            for (i = 1; i <= comp.numLayers && i <= limits.maxCompLayers; i++) {
                L = comp.layer(i);
                result.compLayers.push({ index: L.index, id: L.id, name: L.name, type: U.layerType(L), inPoint: L.inPoint, outPoint: L.outPoint });
            }

            var props = comp.selectedProperties, p, owner;
            for (i = 0; i < props.length; i++) {
                p = props[i];
                if (p.propertyType !== PropertyType.PROPERTY) { continue; }
                if (result.properties.length >= limits.maxProps) { result.truncated = true; break; }
                owner = p.propertyGroup(p.propertyDepth);
                result.properties.push(describeProperty(p, owner, limits));
            }
            return result;
        }
    };

    ops['keyframes.read'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId), out = [], t, r, prop, keys, k, j, idx;
            for (t = 0; t < args.targets.length; t++) {
                r = U.resolveProperty(comp, args.targets[t].address);
                prop = r.prop;
                keys = [];
                idx = args.targets[t].keys;
                for (j = 0; j < idx.length; j++) {
                    k = idx[j];
                    keys.push({
                        index: k,
                        time: prop.keyTime(k),
                        inInterp: U.interpName(prop.keyInInterpolationType(k)),
                        outInterp: U.interpName(prop.keyOutInterpolationType(k)),
                        easeIn: U.easeToPlain(prop.keyInTemporalEase(k)),
                        easeOut: U.easeToPlain(prop.keyOutTemporalEase(k))
                    });
                }
                out.push({ address: args.targets[t].address, keys: keys });
            }
            return { targets: out };
        }
    };
}($.global));
