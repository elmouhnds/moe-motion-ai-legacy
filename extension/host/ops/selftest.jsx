/*
 * MOE Motion AI - Self-Test operations (ExtendScript / ES3, ASCII only). v0.40, docs/features/SELF_TEST.md
 * The self-test runs MOE's own tools in a temporary composition and removes it afterwards:
 *   selftest.begin     ItemCollection.addComp + CompItem.openInViewer (the test comp becomes the active comp);
 *                      returns the comp that was active before
 *   selftest.addText   LayerCollection.addText + TextDocument (fontSize, justification, direction) on the test comp
 *   selftest.commands  app.findMenuCommandId for a list of menu names (read-only)
 *   selftest.end       removes the test comp (only a comp named "MOE Self-Test ..." with that id), then the solid
 *                      items its layers used that nothing else uses (AVItem.usedIn), and reopens the comp that was
 *                      active before
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;
    var PREFIX = 'MOE Self-Test';

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function itemById(id) {
        var i, it;
        for (i = 1; i <= app.project.numItems; i++) { it = app.project.item(i); if (it.id === id) { return it; } }
        return null;
    }

    /* args: { name, width, height, duration, frameRate } -> { compId, previousId, name } */
    ops['selftest.begin'] = {
        mutates: true,
        run: function (args) {
            var prev = app.project.activeItem, prevId = (prev && prev instanceof CompItem) ? prev.id : null;
            var name = String(args.name || PREFIX);
            if (name.substring(0, PREFIX.length) !== PREFIX) { U.fail('BAD_ARGS', 'The test comp name must start with "' + PREFIX + '".'); }
            return U.withUndo('MOE: Self-Test', function () {
                var c = app.project.items.addComp(name, Math.round(num(args.width) || 1920), Math.round(num(args.height) || 1080), 1, num(args.duration) || 10, num(args.frameRate) || 25);
                c.openInViewer();
                return { compId: c.id, previousId: prevId, name: c.name };
            });
        }
    };

    /* args: { compId, text, name, fontSize, justification: 'left'|'center'|'right', rtl, position } -> { layerId } */
    ops['selftest.addText'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Self-Test Text', function () {
                var L = comp.layers.addText(String(args.text)), sp = L.property('ADBE Text Properties').property('ADBE Text Document'), d = sp.value;
                d.fontSize = num(args.fontSize) || 80;
                d.justification = args.justification === 'right' ? ParagraphJustification.RIGHT_JUSTIFY : args.justification === 'center' ? ParagraphJustification.CENTER_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY;
                if (args.rtl) { try { d.direction = ParagraphDirection.DIRECTION_RIGHT_TO_LEFT; } catch (eD) { } }
                if (args.color) { d.applyFill = true; d.fillColor = [num(args.color[0]), num(args.color[1]), num(args.color[2])]; }
                sp.setValue(d);
                if (args.name) { L.name = String(args.name); }
                if (args.position) { L.property('ADBE Transform Group').property('ADBE Position').setValue([num(args.position[0]), num(args.position[1])]); }
                return { layerId: L.id, name: L.name };
            });
        }
    };

    /* args: { names: [...] } -> { commands: [{ name, id }] } */
    /* v0.61 (ENGINE2.md): one Edit > Undo of a MOE run, by its menu name "Undo <label>". Refused unless the label is
       MOE's own ("MOE: ...") and the active comp is the self-test's own comp, so it can never undo the user's work.
       args: { label } -> { found, id } */
    ops['selftest.undoOnce'] = {
        mutates: true,
        run: function (args) {
            var label = String(args.label || ''), comp = app.project.activeItem, id = 0;
            if (label.substring(0, 5) !== 'MOE: ') { U.fail('BAD_ARGS', 'Only a MOE undo step can be undone here.'); }
            if (!(comp instanceof CompItem) || String(comp.name).substring(0, 13) !== 'MOE Self-Test') { U.fail('NOT_SELFTEST', 'Undo is only run on the self-test comp.'); }
            try { id = app.findMenuCommandId('Undo ' + label); } catch (eF) { id = 0; }
            if (!id) { return { found: false, id: 0 }; }
            app.executeCommand(id);
            return { found: true, id: num(id) };
        }
    };

    /* v0.98.2 tile test: read-only counts of the self-test comp and the project, to prove Ctrl+Z brought it back.
       args: { compId } -> { layers, items, names, undoLabels } */
    ops['selftest.census'] = {
        mutates: false,
        run: function (args) {
            var c = itemById(args.compId), names = [], i;
            if (!c || !(c instanceof CompItem) || String(c.name).substring(0, PREFIX.length) !== PREFIX) { U.fail('NOT_SELFTEST', 'Only the self-test comp is counted.'); }
            for (i = 1; i <= c.numLayers; i++) { names.push(String(c.layer(i).name)); }
            return { layers: c.numLayers, items: app.project.numItems, names: names, undoLabels: (MOE.undoLabels || []).slice(0) };
        }
    };

    /* v0.98.2 tile test: Edit > Undo of the newest MOE group (found by its menu text, never a numeric id), only in the
       self-test comp. args: {} -> { found, label } */
    ops['selftest.undoLast'] = {
        mutates: true,
        run: function () {
            var comp = app.project.activeItem, label, id = 0;
            if (!(comp instanceof CompItem) || String(comp.name).substring(0, PREFIX.length) !== PREFIX) { U.fail('NOT_SELFTEST', 'Undo is only run on the self-test comp.'); }
            if (!(MOE.undoLabels instanceof Array) || !MOE.undoLabels.length) { return { found: false, label: '' }; }
            label = MOE.undoLabels.pop();
            /* v0.99.1 (Tile Test on After Effects 26.5: "Undo MOE: ..." is not found by name): Edit > Undo is found
               by its text - first "Undo <label>", then plain "Undo" (app.findMenuCommandId) - never by a numeric id */
            var tried = ['Undo ' + label, 'Undo'], t, how = '';
            for (t = 0; t < tried.length && !id; t++) {
                try { id = app.findMenuCommandId(tried[t]); } catch (eF) { id = 0; }
                if (id) { how = tried[t]; }
            }
            if (!id) { return { found: false, label: label, tried: tried }; }
            app.executeCommand(id);
            return { found: true, label: label, menu: how };
        }
    };

    /* v0.98.2 tile test: select one property of a layer of the self-test comp (PropertyBase.selected, read/write in
       the Scripting Guide), as a user clicks its name. args: { compId, layerId, matchNames: [] } -> { selected } */
    ops['selftest.selectProp'] = {
        mutates: false,
        run: function (args) {
            var c = itemById(args.compId), L, p, i;
            if (!c || !(c instanceof CompItem) || String(c.name).substring(0, PREFIX.length) !== PREFIX) { U.fail('NOT_SELFTEST', 'Only the self-test comp.'); }
            L = U.findLayer(c, { layerId: args.layerId });
            p = L;
            for (i = 0; i < args.matchNames.length; i++) { p = p.property(args.matchNames[i]); if (!p) { U.fail('NO_PROPERTY', 'No ' + args.matchNames[i]); } }
            L.selected = true;
            p.selected = true;
            /* and its keyframes (Property.setSelectedAtKey), as a click on the property name in the timeline does */
            for (i = 1; i <= p.numKeys; i++) { p.setSelectedAtKey(i, true); }
            return { selected: !!p.selected, name: p.name, keys: p.numKeys };
        }
    };

    /* v0.98.2 tile test: forget the labels before a tile (so Undo only ever goes back over that tile's own groups). */
    ops['selftest.resetUndoLabels'] = {
        mutates: false,
        run: function () { MOE.undoLabels = []; return { ok: true }; }
    };

    /* v0.62 (LINKS.md): rename a layer of the self-test comp (to prove a renamed grid relinks). args: { layerId, name } */
    ops['selftest.rename'] = {
        mutates: true,
        run: function (args) {
            var comp = app.project.activeItem, k, L = null;
            if (!(comp instanceof CompItem) || String(comp.name).substring(0, 13) !== 'MOE Self-Test') { U.fail('NOT_SELFTEST', 'Rename is only run on the self-test comp.'); }
            for (k = 1; k <= comp.numLayers; k++) { if (String(comp.layer(k).id) === String(args.layerId)) { L = comp.layer(k); } }
            if (!L) { U.fail('NOT_FOUND', 'Layer not found.'); }
            return U.withUndo('MOE: Self-Test Rename', function () { var from = L.name; L.name = String(args.name); return { from: from, to: L.name }; });
        }
    };

    ops['selftest.commands'] = {
        mutates: false,
        run: function (args) {
            var out = [], i, id;
            for (i = 0; i < args.names.length; i++) {
                id = 0;
                try { id = app.findMenuCommandId(String(args.names[i])); } catch (eC) { id = 0; }
                out.push({ name: args.names[i], id: num(id) });
            }
            return { commands: out };
        }
    };

    /* args: { compId, previousId } -> { removed, solidsRemoved, reopened } */
    ops['selftest.end'] = {
        mutates: true,
        run: function (args) {
            var c = itemById(args.compId), solids = [], seen = {}, i, L, s, removed = null, gone = 0, reopened = false, prev;
            return U.withUndo('MOE: Self-Test Cleanup', function () {
                if (c && c instanceof CompItem && String(c.name).substring(0, PREFIX.length) === PREFIX) {
                    for (i = 1; i <= c.numLayers; i++) {
                        L = c.layer(i);
                        try { s = L.source; } catch (eS) { s = null; }
                        if (s && s.mainSource && s.mainSource instanceof SolidSource && !seen[s.id]) { seen[s.id] = true; solids.push(s); }
                    }
                    removed = c.name;
                    c.remove();
                    for (i = 0; i < solids.length; i++) {
                        try { if (solids[i].usedIn && solids[i].usedIn.length === 0) { solids[i].remove(); gone++; } } catch (eR) { }
                    }
                }
                if (args.previousId) {
                    prev = itemById(args.previousId);
                    if (prev && prev instanceof CompItem) { try { prev.openInViewer(); reopened = true; } catch (eO) { reopened = false; } }
                }
                return { removed: removed, solidsRemoved: gone, reopened: reopened };
            });
        }
    };
    /* v0.96 Rendered previews (docs/features/RENDERED_PREVIEWS.md). Renders a "MOE Self-Test ..." comp - and only such a
     * comp - to a JPEG sequence through After Effects' own Render Queue (RenderQueue.items.add, RenderQueueItem
     * timeSpanStart / timeSpanDuration, OutputModule.setSettings({ Format }), OutputModule.file, RenderQueue.render),
     * into <user data>/MOE Motion AI/previews/<name>/ only (Folder.userData). Items of the user's own render queue that
     * are queued are switched off while it renders and switched back on in finally; MOE's item is removed.
     * args: { compId, name ([a-z0-9-], max 80), start, duration } -> { folder, frames, pattern } */
    /* v0.99.1 (Tile Test on After Effects 26.5: "Invalid Value for key: <Format>. Property is read-only"): the format
       comes from an output-module TEMPLATE there (OutputModule.templates / applyTemplate, Scripting Guide); setSettings
       Format is tried first for older versions. JPEG, then PNG, then TIFF - whichever template exists. */
    function pickFormat(om) {
        var t, i, k, order = [[/JPEG/i, 'jpg'], [/PNG/i, 'png'], [/TIFF/i, 'tif']];
        try { om.setSettings({ 'Format': 'JPEG Sequence' }); return { ext: 'jpg', how: 'Format: JPEG Sequence' }; } catch (eS) { /* read-only on 26.x */ }
        t = om.templates || [];
        for (k = 0; k < order.length; k++) {
            for (i = 0; i < t.length; i++) {
                if (order[k][0].test(String(t[i]))) { om.applyTemplate(t[i]); return { ext: order[k][1], how: 'template: ' + t[i] }; }
            }
        }
        U.fail('NO_FORMAT', 'No JPEG / PNG / TIFF output module template in this After Effects. Templates: ' + t.join(', '));
    }

    ops['previews.render'] = {
        mutates: true,
        run: function (args) {
            var c = itemById(args.compId), name = String(args.name || ''), root, dir, rq, item = null, paused = [], i, it, om, files, k, fmt = null;
            if (!c || !(c instanceof CompItem) || String(c.name).substring(0, PREFIX.length) !== PREFIX) { U.fail('BAD_ARGS', 'Only a "' + PREFIX + '" comp is rendered as a preview.'); }
            if (!/^[a-z0-9-]{1,80}$/.test(name)) { U.fail('BAD_ARGS', 'A preview name is 1 to 80 of a-z, 0-9 and -.'); }
            root = new Folder(Folder.userData.fsName + '/MOE Motion AI/previews');
            if (!root.exists) { root.create(); }
            dir = new Folder(root.fsName + '/' + name);
            if (!dir.exists) { dir.create(); }
            files = dir.getFiles(name + '_*.*');
            for (k = 0; k < files.length; k++) { try { files[k].remove(); } catch (eF) { /* in use */ } }
            rq = app.project.renderQueue;
            try {
                for (i = 1; i <= rq.numItems; i++) {
                    it = rq.item(i);
                    if (it.status === RQItemStatus.QUEUED) { it.render = false; paused.push(it); }
                }
                item = rq.items.add(c);
                item.timeSpanStart = Math.max(0, num(args.start));
                item.timeSpanDuration = Math.max(c.frameDuration, Math.min(num(args.duration) || 2, c.duration - item.timeSpanStart));
                om = item.outputModule(1);
                fmt = pickFormat(om);
                om.file = new File(dir.fsName + '/' + name + '_[#####].' + fmt.ext);
                rq.render();
            } finally {
                if (item) { try { item.remove(); } catch (eR) { /* already gone */ } }
                for (i = 0; i < paused.length; i++) { try { paused[i].render = true; } catch (eP) { /* removed by the user */ } }
            }
            files = dir.getFiles(name + '_*.' + fmt.ext);
            return { folder: dir.fsName, frames: files.length, pattern: name + '_[#####].' + fmt.ext, format: fmt.how, paused: paused.length };
        }
    };
}($.global));
