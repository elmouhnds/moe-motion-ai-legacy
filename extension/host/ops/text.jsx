/*
 * MOE Motion AI - text operations (ExtendScript / ES3).
 *   fonts.list         installed fonts (app.fonts.allFonts, AE 24+)
 *   text.setStyle      font / fill / stroke / direction on text layers (before/after for restore)
 *   text.applyAnimator build a named Text Animator from a MOE preset spec
 *   text.removeAnimator remove a named animator (checkpoint restore)
 *   text.applyFfx      apply a .ffx preset to given layers (applyPreset acts on the selection)
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function arr(v) { var a = [], i; for (i = 0; i < v.length; i++) { a.push(num(v[i])); } return a; }

    function textProp(layer) {
        var tp = null;
        try { tp = layer.property('ADBE Text Properties').property('ADBE Text Document'); } catch (e) { tp = null; }
        if (!tp) { U.fail('NOT_TEXT', 'Layer "' + layer.name + '" is not a text layer.'); }
        return tp;
    }

    ops['fonts.list'] = {
        mutates: false,
        run: function (args) {
            var out = [], max = (args && args.max) || 6000, g, f, grp, font, scripts, s, arabic;
            if (!app.fonts || !app.fonts.allFonts) { return { fonts: [], unsupported: true }; }
            var all = app.fonts.allFonts;
            for (g = 0; g < all.length && out.length < max; g++) {
                grp = all[g];
                for (f = 0; f < grp.length && out.length < max; f++) {
                    font = grp[f];
                    arabic = false;
                    try {
                        scripts = font.writingScripts || [];
                        for (s = 0; s < scripts.length; s++) { if (scripts[s] === CTScript.CT_ARABIC_SCRIPT) { arabic = true; } }
                    } catch (eS) { arabic = false; }
                    out.push({ ps: font.postScriptName, family: font.familyName, style: font.styleName, arabic: arabic });
                }
            }
            return { fonts: out, truncated: out.length >= max };
        }
    };

    function readStyle(doc) {
        var s = { font: doc.font, applyFill: !!doc.applyFill, applyStroke: !!doc.applyStroke, fillColor: null, strokeColor: null, direction: null };
        try { if (doc.applyFill) { s.fillColor = arr(doc.fillColor); } } catch (e1) { s.fillColor = null; }
        try { if (doc.applyStroke) { s.strokeColor = arr(doc.strokeColor); } } catch (e2) { s.strokeColor = null; }
        try { s.direction = doc.direction === ParagraphDirection.DIRECTION_RIGHT_TO_LEFT ? 'rtl' : (doc.direction === ParagraphDirection.DIRECTION_LEFT_TO_RIGHT ? 'ltr' : null); } catch (e3) { s.direction = null; }
        return s;
    }

    /*
     * args: { compId, label, items: [{ layerId, font, fillColor, strokeColor, applyFill, applyStroke, direction ('rtl'|'ltr'), universal }] }
     * Missing fields are left untouched. Keyframed Source Text is set at the comp's current time.
     */
    ops['text.setStyle'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Text Style', function () {
                var out = [], i, it, layer, tp, doc, before, atTime;
                for (i = 0; i < args.items.length; i++) {
                    it = args.items[i];
                    layer = U.findLayer(comp, { layerId: it.layerId });
                    if (layer.locked) { out.push({ layerId: layer.id, name: layer.name, skipped: 'LOCKED' }); continue; }
                    tp = textProp(layer);
                    atTime = tp.numKeys > 0;
                    doc = atTime ? tp.valueAtTime(comp.time, true) : tp.value;
                    before = readStyle(doc);
                    if (it.font) {
                        if (app.fonts && app.fonts.getFontsByPostScriptName) {
                            var found = app.fonts.getFontsByPostScriptName(it.font);
                            if (!found || !found.length) { U.fail('FONT_MISSING', 'Font not installed: ' + it.font); }
                        }
                        doc.font = it.font;
                    }
                    if (it.applyFill === false) { doc.applyFill = false; }
                    if (it.fillColor) { doc.fillColor = [num(it.fillColor[0]), num(it.fillColor[1]), num(it.fillColor[2])]; }
                    if (it.applyStroke === false) { doc.applyStroke = false; }
                    if (it.strokeColor) { doc.applyStroke = true; doc.strokeColor = [num(it.strokeColor[0]), num(it.strokeColor[1]), num(it.strokeColor[2])]; }
                    if (it.direction) {
                        try {
                            if (it.universal) { doc.composerEngine = ComposerEngine.UNIVERSAL_TYPE_ENGINE; }
                            doc.direction = it.direction === 'rtl' ? ParagraphDirection.DIRECTION_RIGHT_TO_LEFT : ParagraphDirection.DIRECTION_LEFT_TO_RIGHT;
                        } catch (eDir) { /* AE < 24: direction not scriptable */ }
                    }
                    if (atTime) { tp.setValueAtTime(comp.time, doc); } else { tp.setValue(doc); }
                    var check = atTime ? tp.valueAtTime(comp.time, true) : tp.value;
                    out.push({ layerId: layer.id, name: layer.name, atTime: atTime ? comp.time : null, text: U.truncate(check.text, 200), before: before, after: readStyle(check) });
                }
                return { layers: out };
            });
        }
    };

    function setAdvanced(selector, adv) {
        var a = selector.property('ADBE Text Range Advanced');
        var map = [
            ['units', 'ADBE Text Range Units'], ['basedOn', 'ADBE Text Range Type2'], ['mode', 'ADBE Text Selector Mode'],
            ['amount', 'ADBE Text Selector Max Amount'], ['shape', 'ADBE Text Range Shape'], ['smoothness', 'ADBE Text Selector Smoothness'],
            ['easeHigh', 'ADBE Text Levels Max Ease'], ['easeLow', 'ADBE Text Levels Min Ease'], ['randomize', 'ADBE Text Randomize Order']
        ], i;
        for (i = 0; i < map.length; i++) {
            if (adv[map[i][0]] !== undefined && adv[map[i][0]] !== null) { a.property(map[i][1]).setValue(adv[map[i][0]]); }
        }
    }

    function findAnimator(animators, name) {
        var i;
        for (i = 1; i <= animators.numProperties; i++) { if (animators.property(i).name === name) { return animators.property(i); } }
        return null;
    }

    /*
     * args: { compId, label, layers: [{ layerId, startTime }], name, spec: {
     *   selector: { start, end, advanced: {...} },
     *   props: [{ matchName, value }],
     *   keys: { matchName: 'ADBE Text Percent Offset', list: [{ t, v, inInfl, outInfl }] }  // t relative to startTime
     * } }
     */
    ops['text.applyAnimator'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Text Animation', function () {
                var out = [], li, layer, animators, anim, idx, sel, k, i, p, replaced, spec = args.spec, keyProp, ke;
                for (li = 0; li < args.layers.length; li++) {
                    var startTime = num(args.layers[li].startTime);
                    layer = U.findLayer(comp, { layerId: args.layers[li].layerId });
                    if (layer.locked) { out.push({ layerId: layer.id, name: layer.name, skipped: 'LOCKED' }); continue; }
                    textProp(layer);
                    animators = layer.property('ADBE Text Properties').property('ADBE Text Animators');
                    replaced = false;
                    anim = findAnimator(animators, args.name);
                    if (anim) { anim.remove(); replaced = true; animators = layer.property('ADBE Text Properties').property('ADBE Text Animators'); }
                    idx = animators.addProperty('ADBE Text Animator').propertyIndex;
                    anim = layer.property('ADBE Text Properties').property('ADBE Text Animators').property(idx);
                    anim.name = args.name;
                    var props = anim.property('ADBE Text Animator Properties');
                    for (i = 0; i < spec.props.length; i++) {
                        p = props.addProperty(spec.props[i].matchName);
                        anim = layer.property('ADBE Text Properties').property('ADBE Text Animators').property(idx);
                        props = anim.property('ADBE Text Animator Properties');
                        props.property(spec.props[i].matchName).setValue(spec.props[i].value);
                    }
                    anim.property('ADBE Text Selectors').addProperty('ADBE Text Selector');
                    anim = layer.property('ADBE Text Properties').property('ADBE Text Animators').property(idx);
                    sel = anim.property('ADBE Text Selectors').property(1);
                    if (spec.selector.start !== undefined) { sel.property('ADBE Text Percent Start').setValue(spec.selector.start); }
                    if (spec.selector.end !== undefined) { sel.property('ADBE Text Percent End').setValue(spec.selector.end); }
                    setAdvanced(sel, spec.selector.advanced || {});
                    keyProp = sel.property(spec.keys.matchName);
                    for (k = 0; k < spec.keys.list.length; k++) {
                        keyProp.setValueAtTime(startTime + spec.keys.list[k].t, spec.keys.list[k].v);
                    }
                    for (k = 1; k <= keyProp.numKeys; k++) {
                        ke = spec.keys.list[k - 1];
                        keyProp.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                        keyProp.setTemporalEaseAtKey(k, [new KeyframeEase(0, ke.inInfl || 33.33)], [new KeyframeEase(0, ke.outInfl || 33.33)]);
                    }
                    out.push({ layerId: layer.id, name: layer.name, animator: args.name, index: idx, replaced: replaced, keys: keyProp.numKeys, firstKey: keyProp.keyTime(1), lastKey: keyProp.keyTime(keyProp.numKeys), props: props.numProperties });
                }
                return { layers: out };
            });
        }
    };

    /* args: { compId, items: [{ layerId, name }] } */
    ops['text.removeAnimator'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Remove Text Animation', function () {
                var removed = 0, i, layer, a;
                for (i = 0; i < args.items.length; i++) {
                    layer = U.findLayer(comp, { layerId: args.items[i].layerId });
                    a = findAnimator(layer.property('ADBE Text Properties').property('ADBE Text Animators'), args.items[i].name);
                    if (a) { a.remove(); removed++; }
                }
                return { removed: removed };
            });
        }
    };

    /* args: { compId, layers: [layerId], path } - selection is set to exactly these layers, then restored. */
    ops['text.applyFfx'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            var f = new File(args.path);
            if (!f.exists) { U.fail('FILE_MISSING', 'Preset file not found: ' + args.path); }
            return U.withUndo('MOE: Apply Preset', function () {
                var prev = comp.selectedLayers, i, wanted = {}, L, applied = [];
                for (i = 0; i < args.layers.length; i++) { wanted[args.layers[i]] = true; }
                for (i = 1; i <= comp.numLayers; i++) { L = comp.layer(i); L.selected = !!wanted[L.id]; if (L.selected) { applied.push(L.name); } }
                try {
                    comp.layer(1).applyPreset(f);
                } finally {
                    for (i = 1; i <= comp.numLayers; i++) { comp.layer(i).selected = false; }
                    for (i = 0; i < prev.length; i++) { try { prev[i].selected = true; } catch (eSel) { /* layer gone */ } }
                }
                return { applied: applied, time: comp.time };
            });
        }
    };
}($.global));
