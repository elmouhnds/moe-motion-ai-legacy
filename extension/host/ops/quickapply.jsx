/*
 * MOE Motion AI - Quick Apply (v1.0, docs/features/QUICK_APPLY.md). ExtendScript / ES3, ASCII only.
 * The centre of the pie searches After Effects' own catalogue, as the owner asked ("like FX Console"):
 *   catalog.effects   read-only: app.effects (Scripting Guide, Application.effects: displayName, matchName, category)
 *   catalog.presets   read-only: the .ffx animation presets under After Effects' own Presets folder
 *                     (Folder.appPackage + "/Presets") and the user's "User Presets" folders under
 *                     Documents/Adobe/After Effects <version>/ - bounded (depth 5, 5000 files)
 *   catalog.commands  read-only: app.findMenuCommandId for a list of menu names; only names this After Effects knows
 *                     come back (never an invented id)
 *   quick.applyEffect { compId, layerIds[], matchName, target: 'layers'|'adjustment' } one undo group
 *   quick.applyPreset { compId, layerIds[], path } AVLayer.applyPreset(File) - After Effects applies a preset to the
 *                     SELECTED layers of the comp (Scripting Guide), so the op checks that the selection is exactly
 *                     the layers the panel names. The path must be a .ffx inside one of the catalogue roots.
 *   quick.runCommand  { name } finds the id by NAME again and runs app.executeCommand - never a numeric id from the panel
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;
    var MAX_FILES = 5000, MAX_DEPTH = 5;

    function lower(s) { return String(s || '').toLowerCase(); }
    function slash(s) { return String(s || '').replace(/\\/g, '/'); }

    function presetRoots() {
        var out = [], f, docs, kids, i, up;
        try { f = new Folder(Folder.appPackage.fsName + '/Presets'); if (f.exists) { out.push({ label: 'Presets', folder: f }); } } catch (eA) { /* no app package */ }
        try {
            docs = new Folder(Folder.myDocuments.fsName + '/Adobe');
            if (docs.exists) {
                kids = docs.getFiles('After Effects*');
                for (i = 0; i < kids.length; i++) {
                    if (kids[i] instanceof Folder) {
                        up = new Folder(kids[i].fsName + '/User Presets');
                        if (up.exists) { out.push({ label: 'User Presets', folder: up }); }
                    }
                }
            }
        } catch (eD) { /* no documents folder */ }
        return out;
    }

    function scan(folder, rel, depth, out) {
        var items, i, it, nm;
        if (depth > MAX_DEPTH || out.length >= MAX_FILES) { return; }
        try { items = folder.getFiles(); } catch (eG) { return; }
        for (i = 0; i < items.length && out.length < MAX_FILES; i++) {
            it = items[i];
            nm = decodeURI(it.name);
            if (it instanceof Folder) { scan(it, rel ? rel + '/' + nm : nm, depth + 1, out); }
            else if (/\.ffx$/i.test(nm)) { out.push({ n: nm.replace(/\.ffx$/i, ''), c: rel, p: it.fsName }); }
        }
    }

    function insideRoots(path) {
        var roots = presetRoots(), p = lower(slash(path)), i, r;
        for (i = 0; i < roots.length; i++) {
            r = lower(slash(roots[i].folder.fsName));
            if (p.substring(0, r.length + 1) === r + '/') { return true; }
        }
        return false;
    }

    ops['catalog.effects'] = {
        mutates: false,
        run: function () {
            var fx = app.effects, out = [], i, e;
            for (i = 0; i < fx.length; i++) {
                e = fx[i];
                if (!e || !e.displayName || !e.matchName) { continue; }
                out.push({ n: String(e.displayName), m: String(e.matchName), c: String(e.category || '') });
            }
            return { effects: out, appVersion: String(app.version) };
        }
    };

    ops['catalog.presets'] = {
        mutates: false,
        run: function () {
            var roots = presetRoots(), out = [], i, before;
            for (i = 0; i < roots.length; i++) {
                before = out.length;
                scan(roots[i].folder, roots[i].label, 0, out);
                roots[i] = { label: roots[i].label, path: roots[i].folder.fsName, count: out.length - before };
            }
            return { presets: out, roots: roots, truncated: out.length >= MAX_FILES };
        }
    };

    ops['catalog.commands'] = {
        mutates: false,
        run: function (args) {
            var names = args.names || [], out = [], i, id;
            if (names.length > 300) { U.fail('BAD_ARGS', 'At most 300 names.'); }
            for (i = 0; i < names.length; i++) {
                id = 0;
                try { id = app.findMenuCommandId(String(names[i])); } catch (eC) { id = 0; }
                if (id) { out.push({ name: String(names[i]) }); }
            }
            return { commands: out };
        }
    };

    function knownEffect(matchName) {
        var fx = app.effects, i;
        for (i = 0; i < fx.length; i++) { if (fx[i] && fx[i].matchName === matchName) { return fx[i]; } }
        return null;
    }

    ops['quick.applyEffect'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId), mn = String(args.matchName || ''), info = knownEffect(mn), ids = args.layerIds || [];
            var target = args.target === 'adjustment' ? 'adjustment' : 'layers', added = [], skipped = [], i, L, parade, fx, adj, top = null;
            if (!info) { U.fail('UNKNOWN_EFFECT', 'This After Effects has no effect "' + mn + '".'); }
            if (target === 'layers' && !ids.length) { U.fail('NO_LAYERS', 'Select a layer (or use Ctrl+Enter for a new adjustment layer).'); }
            return U.withUndo('MOE: ' + String(info.displayName), function () {
                if (target === 'adjustment') {
                    for (i = 0; i < ids.length; i++) { L = U.findLayer(comp, { layerId: ids[i] }); if (!top || L.index < top.index) { top = L; } }
                    adj = comp.layers.addSolid([1, 1, 1], String(info.displayName) + ' Adjustment', comp.width, comp.height, comp.pixelAspect, comp.duration);
                    adj.adjustmentLayer = true;
                    if (top) { adj.moveBefore(top); }
                    fx = adj.property('ADBE Effect Parade').addProperty(mn);
                    added.push({ layerId: adj.id, name: String(adj.name), effect: String(fx.name), count: adj.property('ADBE Effect Parade').numProperties, made: true });
                } else {
                    for (i = 0; i < ids.length; i++) {
                        L = U.findLayer(comp, { layerId: ids[i] });
                        parade = L.property('ADBE Effect Parade');
                        if (L.locked) { skipped.push(String(L.name) + ' is locked'); continue; }
                        if (!parade || !parade.canAddProperty(mn)) { skipped.push(String(L.name) + ' cannot take ' + String(info.displayName)); continue; }
                        fx = parade.addProperty(mn);
                        added.push({ layerId: L.id, name: String(L.name), effect: String(fx.name), count: parade.numProperties });
                    }
                }
                return { effect: String(info.displayName), matchName: mn, target: target, added: added, skipped: skipped };
            });
        }
    };

    ops['quick.applyPreset'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId), path = String(args.path || ''), f = new File(path), ids = args.layerIds || [], sel = comp.selectedLayers, i, k, found, before = [];
            if (!/\.ffx$/i.test(path) || !f.exists) { U.fail('NO_PRESET', 'Animation preset not found: ' + path); }
            if (!insideRoots(f.fsName)) { U.fail('NOT_ALLOWED', 'Only presets from After Effects own Presets or User Presets folders.'); }
            if (!ids.length || !sel.length) { U.fail('NO_LAYERS', 'Select the layers the preset goes on.'); }
            /* applyPreset works on the comp's SELECTED layers: refuse if the selection changed since the panel read it */
            if (sel.length !== ids.length) { U.fail('SELECTION_CHANGED', 'The selection changed - try again.'); }
            for (i = 0; i < ids.length; i++) {
                found = false;
                for (k = 0; k < sel.length; k++) { if (sel[k].id === ids[i]) { found = true; } }
                if (!found) { U.fail('SELECTION_CHANGED', 'The selection changed - try again.'); }
            }
            for (k = 0; k < sel.length; k++) { before.push({ layerId: sel[k].id, effects: sel[k].property('ADBE Effect Parade') ? sel[k].property('ADBE Effect Parade').numProperties : 0 }); }
            return U.withUndo('MOE: ' + decodeURI(f.name).replace(/\.ffx$/i, ''), function () {
                sel[0].applyPreset(f);
                return { preset: decodeURI(f.name).replace(/\.ffx$/i, ''), layers: before, layersAfter: comp.numLayers };
            });
        }
    };

    ops['quick.runCommand'] = {
        mutates: true,
        run: function (args) {
            var name = String(args.name || ''), id = 0;
            try { id = app.findMenuCommandId(name); } catch (eF) { id = 0; }
            if (!id) { U.fail('NO_COMMAND', 'After Effects has no menu command "' + name + '".'); }
            if (/^(Undo|Redo)/.test(name)) { U.fail('NOT_ALLOWED', 'Undo / Redo are not run from Quick Apply.'); }
            return U.withUndo('MOE: ' + name, function () { app.executeCommand(id); return { ran: name }; });
        }
    };
}($.global));
