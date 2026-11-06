/*
 * MOE Motion AI - rename-safe links (v0.62, docs/features/LINKS.md). ExtendScript / ES3, ASCII only.
 *
 * MOE expressions name the layers they read with the layer's permanent After Effects id beside the name:
 *     thisComp.layer(MOE-LINK comment with the id, then "Name")
 *
 *   links.scan    {compId, any}  read-only: every MOE-LINK in the comp, and which point at a layer renamed since
 *   links.relink  {compId}       writes the current name into every renamed link; returns the expressions before
 *                                (for Restore). A link whose id is gone (layer deleted) is reported, never guessed.
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;
    var LINK = /thisComp\.layer\(\/\*MOE-LINK:(\d+)\*\/"((?:[^"\\]|\\.)*)"\)/g;

    function layerById(comp, id) {
        var k;
        for (k = 1; k <= comp.numLayers; k++) { if (String(comp.layer(k).id) === String(id)) { return comp.layer(k); } }
        return null;
    }
    function escName(n) { return String(n).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
    function unesc(raw) { return String(raw).replace(/\\(["\\])/g, '$1'); }

    /* every property of the comp whose expression carries a MOE-LINK: [{ layer, prop, path }] */
    function linked(comp) {
        var out = [], k, L;
        function walk(node, L, path) {
            var i, p;
            for (i = 1; i <= node.numProperties; i++) {
                p = node.property(i);
                if (!p) { continue; }
                if (p.propertyType === PropertyType.PROPERTY) {
                    if (p.canSetExpression && p.expression && /MOE-LINK:/.test(String(p.expression))) { out.push({ layer: L, prop: p, path: path.concat([i]) }); }
                } else {
                    walk(p, L, path.concat([i]));
                }
            }
        }
        for (k = 1; k <= comp.numLayers; k++) { L = comp.layer(k); walk(L, L, []); }
        return out;
    }

    function check(comp, list) {
        var renamed = {}, missing = {}, n = 0, j, code, m, L, key;
        for (j = 0; j < list.length; j++) {
            code = String(list[j].prop.expression);
            LINK.lastIndex = 0;
            m = LINK.exec(code);
            while (m) {
                n++;
                L = layerById(comp, m[1]);
                if (!L) { missing[m[1]] = unesc(m[2]); }
                else if (L.name !== unesc(m[2])) {
                    key = m[1];
                    if (!renamed[key]) { renamed[key] = { id: Number(m[1]), from: unesc(m[2]), to: L.name, expressions: 0 }; }
                    renamed[key].expressions++;
                }
                m = LINK.exec(code);
            }
        }
        var r = [], x, miss = [];
        for (x in renamed) { if (renamed.hasOwnProperty(x)) { r.push(renamed[x]); } }
        for (x in missing) { if (missing.hasOwnProperty(x)) { miss.push({ id: Number(x), name: missing[x] }); } }
        return { links: n, expressions: list.length, renamed: r, missing: miss };
    }

    ops['links.scan'] = {
        mutates: false,
        run: function (args) {
            var comp = U.compById(args.compId);
            return check(comp, linked(comp));
        }
    };

    ops['links.relink'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Relink', function () {
                var list = linked(comp), fixed = [], j, code, next, L;
                for (j = 0; j < list.length; j++) {
                    L = list[j].layer;
                    if (L.locked) { continue; }
                    code = String(list[j].prop.expression);
                    next = code.replace(LINK, function (m, id, raw) {
                        var T = layerById(comp, id);
                        return T && T.name !== unesc(raw) ? 'thisComp.layer(/*MOE-LINK:' + id + '*/"' + escName(T.name) + '")' : m;
                    });
                    if (next !== code) {
                        list[j].prop.expression = next;
                        fixed.push({ address: U.addressOf(list[j].prop, L), layerName: L.name, name: list[j].prop.name, before: code, error: String(list[j].prop.expressionError || '') });
                    }
                }
                return { fixed: fixed, after: check(comp, linked(comp)) };
            });
        }
    };
}($.global));
