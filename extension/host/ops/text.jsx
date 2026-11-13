/*
 * MOE Motion AI - text operations (ExtendScript / ES3).
 *   fonts.list         installed fonts (app.fonts.allFonts, AE 24+)
 *   text.setStyle      font / fill / stroke / direction on text layers (before/after for restore)
 *   text.create        a new text layer for a template (size from sourceRectAtTime; Arabic = RTL + universal composer;
 *                      maxWidth: a smaller font until it fits)
 *   text.applyAnimator build a named Text Animator from a MOE preset spec
 *   text.removeAnimator remove a named animator (checkpoint restore)
 *   text.applyFfx      apply a .ffx preset to given layers (applyPreset acts on the selection)
 *   text.split         v0.37 Text Cloner: one text layer per word (or letter) placed exactly where it was. Each
 *                      piece is measured with sourceRectAtTime on a temporary duplicate (removed in finally)
 *                      set to the paragraph's start justification, then shifted by the source's own
 *                      justification; pieces are duplicates (same font, style, effects, transform) named
 *                      "MOE Word n . <layer>" / "MOE Letter n . <layer>", anchored on their own centre. The source is
 *                      hidden (enabled = false). Arabic is split by words only (letters would disconnect).
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

    /* v0.64 (WAVE4.md): a Wiggly Selector's settings, each found by its English display name (never a guessed index);
       returns which were set and which were not found, so the panel can say so. */
    function setWiggly(w, o) {
        var names = [['mode', 'Mode'], ['maxAmount', 'Max Amount'], ['minAmount', 'Min Amount'], ['wigglesPerSecond', 'Wiggles/Second'],
            ['correlation', 'Correlation'], ['lockDimensions', 'Lock Dimensions'], ['seed', 'Random Seed']], set = [], missing = [], i;
        function find(node, nm) {
            var j, c, r;
            for (j = 1; j <= node.numProperties; j++) {
                c = node.property(j);
                if (c.name === nm && c.propertyType === PropertyType.PROPERTY) { return c; }
                if (c.propertyType !== PropertyType.PROPERTY) { r = find(c, nm); if (r) { return r; } }
            }
            return null;
        }
        for (i = 0; i < names.length; i++) {
            if (o[names[i][0]] === undefined) { continue; }
            var p = find(w, names[i][1]);
            if (p) { p.setValue(o[names[i][0]]); set.push(names[i][1]); } else { missing.push(names[i][1]); }
        }
        return { set: set, missing: missing };
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
                    var wig = null;
                    if (spec.wiggly) {
                        anim.property('ADBE Text Selectors').addProperty('ADBE Text Wiggly Selector');
                        anim = layer.property('ADBE Text Properties').property('ADBE Text Animators').property(idx);
                        sel = anim.property('ADBE Text Selectors').property(1);
                        wig = setWiggly(anim.property('ADBE Text Selectors').property(2), spec.wiggly);
                    }
                    keyProp = sel.property(spec.keys.matchName);
                    for (k = 0; k < spec.keys.list.length; k++) {
                        /* v0.64: on the comp's frame grid, like every MOE key (ENGINE2.md) */
                        keyProp.setValueAtTime(Math.round((startTime + spec.keys.list[k].t) / comp.frameDuration) * comp.frameDuration, spec.keys.list[k].v);
                    }
                    for (k = 1; k <= keyProp.numKeys; k++) {
                        ke = spec.keys.list[k - 1];
                        keyProp.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                        keyProp.setTemporalEaseAtKey(k, [new KeyframeEase(0, ke.inInfl || 33.33)], [new KeyframeEase(0, ke.outInfl || 33.33)]);
                    }
                    out.push({ layerId: layer.id, name: layer.name, animator: args.name, index: idx, replaced: replaced, keys: keyProp.numKeys, firstKey: keyProp.keyTime(1), lastKey: keyProp.keyTime(keyProp.numKeys), props: props.numProperties, wiggly: wig });
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

    /* ---------- v0.37 Text Cloner ---------- */
    function hasArabic(s) { return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s); }
    function dropAnimators(L) {
        var g = null, i;
        try { g = L.property('ADBE Text Properties').property('ADBE Text Animators'); } catch (eG) { g = null; }
        if (!g) { return; }
        for (i = g.numProperties; i >= 1; i--) { g.property(i).remove(); }
    }
    function tokensOf(line, by) {
        var out = [], i = 0, s0, ch;
        while (i < line.length) {
            ch = line.charAt(i);
            if (ch === ' ' || ch === '\t') { i++; continue; }
            if (by === 'letters') { out.push({ s: i, e: i + 1 }); i++; continue; }
            s0 = i;
            while (i < line.length && line.charAt(i) !== ' ' && line.charAt(i) !== '\t') { i++; }
            out.push({ s: s0, e: i });
        }
        return out;
    }
    function measure(M, mp, srcProp, str, just, t) {
        var d = srcProp.value, r;
        d.text = str; d.justification = just;
        mp.setValue(d);
        r = M.sourceRectAtTime(t, false);
        return { left: num(r.left), top: num(r.top), width: num(r.width), height: num(r.height) };
    }
    function keyedOrExpr(p) { return !!(p && (p.numKeys > 0 || (p.canSetExpression && p.expressionEnabled && p.expression))); }

    /* args: { compId, layerId, by: 'words'|'letters', max } -> { pieces, sourceId, sourceEnabled, rtl, by, lines } */
    ops['text.split'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId), L = U.findLayer(comp, { layerId: args.layerId }), t = comp.time;
            var by = args.by === 'letters' ? 'letters' : 'words', sp = textProp(L), tg = L.property('ADBE Transform Group');
            var doc, text, boxed = false, arabic, rtl, J, start, lines, li, total = 0, fs, lead, k, names = ['ADBE Anchor Point', 'ADBE Position', 'ADBE Scale', 'ADBE Rotate Z'];
            if (keyedOrExpr(sp)) { U.fail('ANIMATED_TEXT', 'Source Text of "' + L.name + '" has keyframes or an expression - split works on still text.'); }
            for (k = 0; k < names.length; k++) { if (keyedOrExpr(tg.property(names[k]))) { U.fail('ANIMATED', '"' + L.name + '" has keyframes or expressions on its Transform - remove them first, then animate the pieces.'); } }
            if (tg.property('ADBE Position').dimensionsSeparated) { U.fail('SEPARATED', 'Join the Position dimensions of "' + L.name + '" first.'); }
            if (L.threeDLayer) { U.fail('THREE_D', '"' + L.name + '" is a 3D layer - split works on 2D text.'); }
            doc = sp.value; text = String(doc.text);
            try { boxed = !!doc.boxText; } catch (eB) { boxed = false; }
            if (boxed) { U.fail('BOX_TEXT', 'Paragraph (box) text is not supported yet - convert it to point text (right-click > Convert to Point Text).'); }
            arabic = hasArabic(text);
            if (by === 'letters' && arabic) { U.fail('ARABIC_LETTERS', 'Arabic letters disconnect when split - use Words.'); }
            rtl = arabic;
            try { if (doc.direction === ParagraphDirection.DIRECTION_RIGHT_TO_LEFT) { rtl = true; } } catch (eD) { }
            J = doc.justification;
            start = rtl ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY;
            lines = text.split(/\r\n|\r|\n/);
            for (li = 0; li < lines.length; li++) { total += tokensOf(lines[li], by).length; }
            if (total < 2) { U.fail('TOO_FEW', '"' + L.name + '" has fewer than two ' + by + ' to split.'); }
            if (total > (args.max || 150)) { U.fail('TOO_MANY', '"' + L.name + '" has ' + total + ' ' + by + ' - split at most ' + (args.max || 150) + ' (try Words).'); }
            fs = num(doc.fontSize) || 100; lead = fs * 1.2;
            try { if (!doc.autoLeading && doc.leading > 0) { lead = num(doc.leading); } } catch (eL) { }
            return U.withUndo('MOE: Split Text', function () {
                var M = L.duplicate(), mp, pieces = [], ln, tk, j, full, shift, pw, pr, x, P, pd, a, pos, sc, rot, c0, c1, dx, dy, cs, sn, Ptg, wasOn;
                try {
                    dropAnimators(M);
                    mp = M.property('ADBE Text Properties').property('ADBE Text Document');
                    for (li = 0; li < lines.length; li++) {
                        ln = lines[li]; tk = tokensOf(ln, by);
                        if (!tk.length) { continue; }
                        full = measure(M, mp, sp, ln, start, t);
                        // the measured line starts at the paragraph's start edge; move it to the source's own justification
                        if (J === start) { shift = 0; }
                        else if (J === ParagraphJustification.CENTER_JUSTIFY) { shift = -(full.left + full.width / 2); }
                        else if (J === ParagraphJustification.RIGHT_JUSTIFY) { shift = -(full.left + full.width); }
                        else if (J === ParagraphJustification.LEFT_JUSTIFY) { shift = -full.left; }
                        else { shift = 0; }
                        for (j = 0; j < tk.length; j++) {
                            pw = measure(M, mp, sp, ln.substring(tk[j].s, tk[j].e), start, t);
                            pr = measure(M, mp, sp, ln.substring(0, tk[j].e), start, t);
                            // LTR: the piece ends the prefix (right edge); RTL: it is the prefix's left edge
                            x = rtl ? pr.left : pr.left + pr.width - pw.width;
                            pieces.push({ text: ln.substring(tk[j].s, tk[j].e), line: li, box: [x + shift, li * lead + pw.top, pw.width, pw.height], own: [pw.left, pw.top] });
                        }
                    }
                } finally { M.remove(); }
                a = tg.property('ADBE Anchor Point').value; pos = tg.property('ADBE Position').value; sc = tg.property('ADBE Scale').value;
                rot = num(tg.property('ADBE Rotate Z').value) * Math.PI / 180; cs = Math.cos(rot); sn = Math.sin(rot);
                for (j = 0; j < pieces.length; j++) {
                    P = L.duplicate();
                    dropAnimators(P);
                    pd = sp.value; pd.text = pieces[j].text; pd.justification = start;
                    P.property('ADBE Text Properties').property('ADBE Text Document').setValue(pd);
                    P.name = (by === 'letters' ? 'MOE Letter ' : 'MOE Word ') + (j + 1) + ' \u00B7 ' + L.name;
                    // anchor on the piece's own centre; position = where that centre was in the source
                    c0 = [pieces[j].own[0] + pieces[j].box[2] / 2, pieces[j].own[1] + pieces[j].box[3] / 2];
                    c1 = [pieces[j].box[0] + pieces[j].box[2] / 2, pieces[j].box[1] + pieces[j].box[3] / 2];
                    dx = (c1[0] - num(a[0])) * num(sc[0]) / 100; dy = (c1[1] - num(a[1])) * num(sc[1]) / 100;
                    Ptg = P.property('ADBE Transform Group');
                    Ptg.property('ADBE Anchor Point').setValue(a.length > 2 ? [c0[0], c0[1], num(a[2])] : c0);
                    Ptg.property('ADBE Position').setValue(pos.length > 2 ? [num(pos[0]) + dx * cs - dy * sn, num(pos[1]) + dx * sn + dy * cs, num(pos[2])] : [num(pos[0]) + dx * cs - dy * sn, num(pos[1]) + dx * sn + dy * cs]);
                    pieces[j].layerId = P.id; pieces[j].name = P.name;
                }
                wasOn = L.enabled;
                L.enabled = false;
                return { pieces: pieces, sourceId: L.id, sourceEnabled: wasOn, rtl: rtl, by: by, lines: lines.length };
            });
        }
    };

    /* args: { compId, layerIds, sourceId, sourceEnabled } -> undo text.split: remove the pieces (named), show the source again */
    ops['text.unsplit'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Restore Text', function () {
                var removed = 0, i, L;
                for (i = 0; i < args.layerIds.length; i++) {
                    L = null;
                    try { L = U.findLayer(comp, { layerId: args.layerIds[i] }); } catch (eF) { L = null; }
                    if (L && /^MOE (Word|Letter) \d+ /.test(L.name)) { L.remove(); removed++; }
                }
                L = U.findLayer(comp, { layerId: args.sourceId });
                L.enabled = args.sourceEnabled !== false;
                return { removed: removed, sourceEnabled: L.enabled };
            });
        }
    };

    /*
     * v0.49 (docs/features/TEMPLATES.md): one new text layer for a template, in one Undo group.
     * args: { compId, text, name, fontSize, color [r,g,b] 0..1, font?, bold?, justify ('left'|'right'|'center'), rtl,
     *         position [x,y], label? }
     * -> { layerId, name, size: [w, h] } - size is sourceRectAtTime at the comp's time (After Effects measures it).
     * Arabic: direction right-to-left + the universal composer, as text.setStyle does (CLAUDE.md, Arabic text).
     */
    ops['text.create'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            if (args.text === undefined || String(args.text) === '') { U.fail('BAD_ARGS', 'No text.'); }
            return U.withUndo('MOE: Template Text', function () {
                var L = comp.layers.addText(String(args.text)), sp = L.property('ADBE Text Properties').property('ADBE Text Document'), d = sp.value, r, c;
                d.fontSize = num(args.fontSize) || 48;
                if (args.font) { try { d.font = String(args.font); } catch (eF) { /* font not installed: keep the default */ } }
                if (args.bold) { try { d.fauxBold = true; } catch (eB) { } }
                if (args.color) { c = arr(args.color); d.applyFill = true; d.fillColor = [c[0], c[1], c[2]]; }
                d.justification = args.justify === 'right' ? ParagraphJustification.RIGHT_JUSTIFY : args.justify === 'center' ? ParagraphJustification.CENTER_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY;
                if (args.rtl || hasArabic(String(args.text))) {
                    try { d.composerEngine = ComposerEngine.UNIVERSAL_TYPE_ENGINE; } catch (eC) { }
                    try { d.direction = ParagraphDirection.DIRECTION_RIGHT_TO_LEFT; } catch (eD) { /* AE < 24: direction not scriptable */ }
                }
                sp.setValue(d);
                L.name = String(args.name || 'MOE Text');
                if (args.label !== undefined) { L.label = num(args.label); }
                if (args.position) { L.property('ADBE Transform Group').property('ADBE Position').setValue([num(args.position[0]), num(args.position[1])]); }
                r = L.sourceRectAtTime(comp.time, false);
                /* v0.52: Auto-fit - wider than maxWidth: a smaller font, measured again (the panel's templates.fitSize rule) */
                var fs0 = d.fontSize, k, mw = num(args.maxWidth), want;
                for (k = 0; k < 4 && mw > 0 && num(r.width) > mw; k++) {
                    want = Math.max(Math.round(fs0 * 0.4), Math.floor(d.fontSize * (mw / num(r.width)) * 0.98));
                    if (want >= d.fontSize) { break; }
                    d = sp.value; d.fontSize = want; sp.setValue(d);
                    r = L.sourceRectAtTime(comp.time, false);
                }
                return { layerId: L.id, name: L.name, size: [num(r.width), num(r.height)], fontSize: num(sp.value.fontSize), fitted: sp.value.fontSize < fs0 };
            });
        }
    };

    /*
     * v0.94 text.measure { compId, items: [text.create args] } -> { items: [{ size, fontSize, fitted }] }
     * Measures texts exactly as text.create makes them (same op, auto-fit included) in a temporary comp of the same
     * size, then removes that comp: one undo step that changes nothing. A template measures first, then builds
     * everything in one tx.run - so the build is ONE Ctrl+Z.
     */
    ops['text.measure'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId), list = args.items || [];
            if (list.length > 60) { U.fail('BAD_ARGS', 'Too many texts to measure (max 60).'); }
            return U.withUndo('MOE: Measure Text', function () {
                var tmp = app.project.items.addComp('MOE Measure (temporary)', comp.width, comp.height, comp.pixelAspect, Math.max(comp.duration, 1), comp.frameRate);
                var prev = MOE.txComps, out = [], i, k, a, r;
                MOE.txComps = [tmp];
                try {
                    for (i = 0; i < list.length; i++) {
                        a = {};
                        for (k in list[i]) { if (list[i].hasOwnProperty(k)) { a[k] = list[i][k]; } }
                        a.compId = tmp.id;
                        r = ops['text.create'].run(a);
                        out.push({ size: r.size, fontSize: r.fontSize, fitted: r.fitted });
                    }
                } finally {
                    MOE.txComps = prev || null;
                    tmp.remove();
                }
                return { items: out };
            });
        }
    };
}($.global));
