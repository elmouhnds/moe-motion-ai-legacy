/*
 * MOE Motion AI — keyframe operations (mutating).
 * Every mutating op: one undo group, explicit addresses, read-back of the result.
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    function snapshotKey(prop, k) {
        return {
            index: k,
            time: prop.keyTime(k),
            inInterp: U.interpName(prop.keyInInterpolationType(k)),
            outInterp: U.interpName(prop.keyOutInterpolationType(k)),
            easeIn: U.easeToPlain(prop.keyInTemporalEase(k)),
            easeOut: U.easeToPlain(prop.keyOutTemporalEase(k))
        };
    }

    function buildEase(dims, speed, influence) {
        var arr = [], i;
        for (i = 0; i < dims; i++) { arr.push(new KeyframeEase(speed, influence)); }
        return arr;
    }

    /*
     * args: { compId, label, targets: [{ address, keys: [int] }],
     *         easeIn: { speed, influence } | null, easeOut: { ... } | null }
     * A null side keeps the existing ease. HOLD sides are preserved.
     */
    ops['keyframes.applyEase'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Smart Ease', function () {
                var results = [], t, r, prop, keys, j, k, dims, inArr, outArr, inT, outT, before;
                for (t = 0; t < args.targets.length; t++) {
                    r = U.resolveProperty(comp, args.targets[t].address);
                    prop = r.prop;
                    dims = U.easeDimensions(prop);
                    keys = args.targets[t].keys;
                    var entry = { address: args.targets[t].address, dims: dims, before: [], after: [], skipped: [] };
                    for (j = 0; j < keys.length; j++) {
                        k = keys[j];
                        if (k < 1 || k > prop.numKeys) { entry.skipped.push({ index: k, reason: 'KEY_OUT_OF_RANGE' }); continue; }
                        before = snapshotKey(prop, k);
                        entry.before.push(before);
                        inT = prop.keyInInterpolationType(k);
                        outT = prop.keyOutInterpolationType(k);
                        /* Temporal ease only takes visible effect on Bezier sides. */
                        var newIn = (args.easeIn && inT !== KeyframeInterpolationType.HOLD) ? KeyframeInterpolationType.BEZIER : inT;
                        var newOut = (args.easeOut && outT !== KeyframeInterpolationType.HOLD) ? KeyframeInterpolationType.BEZIER : outT;
                        if (newIn !== inT || newOut !== outT) { prop.setInterpolationTypeAtKey(k, newIn, newOut); }
                        inArr = (args.easeIn && inT !== KeyframeInterpolationType.HOLD)
                            ? buildEase(dims, args.easeIn.speed, args.easeIn.influence)
                            : prop.keyInTemporalEase(k);
                        outArr = (args.easeOut && outT !== KeyframeInterpolationType.HOLD)
                            ? buildEase(dims, args.easeOut.speed, args.easeOut.influence)
                            : prop.keyOutTemporalEase(k);
                        prop.setTemporalEaseAtKey(k, inArr, outArr);
                        entry.after.push(snapshotKey(prop, k));
                    }
                    results.push(entry);
                }
                return { targets: results };
            });
        }
    };

    /* args: { compId, label, targets: [{ address, keys: [snapshotKey...] }] } */
    ops['keyframes.restoreEase'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Restore Ease', function () {
                var restored = 0, t, r, prop, j, s;
                for (t = 0; t < args.targets.length; t++) {
                    r = U.resolveProperty(comp, args.targets[t].address);
                    prop = r.prop;
                    for (j = 0; j < args.targets[t].keys.length; j++) {
                        s = args.targets[t].keys[j];
                        if (s.index < 1 || s.index > prop.numKeys) { continue; }
                        if (Math.abs(prop.keyTime(s.index) - s.time) > 1e-6) {
                            U.fail('KEY_MOVED', 'A keyframe moved since the checkpoint; restore aborted.');
                        }
                        prop.setInterpolationTypeAtKey(s.index, U.interpFromName(s.inInterp), U.interpFromName(s.outInterp));
                        prop.setTemporalEaseAtKey(s.index, U.easeFromPlain(s.easeIn), U.easeFromPlain(s.easeOut));
                        restored++;
                    }
                }
                return { restored: restored };
            });
        }
    };
}($.global));
