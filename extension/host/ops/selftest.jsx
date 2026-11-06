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
}($.global));
