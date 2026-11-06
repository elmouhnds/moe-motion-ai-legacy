/*
 * MOE Motion AI - host entry point (ExtendScript / ES3).
 *
 * Loaded by the panel with:  $.global.MOE_ROOT = "<extension path>"; $.evalFile(".../host/index.jsx")
 * The panel only ever calls MOE_dispatch(opName, argsJson). Only ops registered
 * in MOE.ops can run - there is no generic "eval this code" entry point.
 */
(function (G) {
    var root = G.MOE_ROOT;
    if (!root) { throw new Error('MOE_ROOT is not set'); }

    G.MOE = G.MOE || {};
    G.MOE.version = '0.59.0';
    G.MOE.ops = {};

    var files = [
        'lib/json.jsx',
        'lib/util.jsx',
        'ops/context.jsx',
        'ops/keyframes.jsx',
        'ops/layers.jsx',
        'ops/expressions.jsx',
        'ops/compositing.jsx',
        'ops/text.jsx',
        'ops/studio.jsx',
        'ops/layout.jsx',
        'ops/fx.jsx',
        'ops/quick.jsx',
        'ops/design.jsx',
        'ops/transform.jsx',
        'ops/kit.jsx',
        'ops/glass.jsx',
        'ops/selftest.jsx',
        'ops/bake.jsx'
    ];
    for (var i = 0; i < files.length; i++) {
        var f = new File(root + '/host/' + files[i]);
        if (!f.exists) { throw new Error('MOE host file missing: ' + f.fsName); }
        try {
            $.evalFile(f);
        } catch (eFile) {
            /* Name the file so a load failure inside After Effects is diagnosable from the panel. */
            throw new Error('host/' + files[i] + ' line ' + (eFile.line || '?') + ': ' + (eFile.message || eFile));
        }
    }

    G.MOE_dispatch = function (opName, argsJson) {
        var MOE = G.MOE, started = new Date().getTime(), envelope;
        try {
            if (!MOE.ops.hasOwnProperty(opName)) {
                MOE.util.fail('UNKNOWN_OP', 'Unknown host operation: ' + opName);
            }
            var args = argsJson ? MOE.json.parse(argsJson) : {};
            var data = MOE.ops[opName].run(args);
            envelope = { ok: true, op: opName, data: data };
        } catch (e) {
            envelope = {
                ok: false,
                op: opName,
                error: {
                    code: e.moeCode || 'HOST_EXCEPTION',
                    message: String(e.message || e),
                    line: e.line || null
                }
            };
        }
        envelope.ms = new Date().getTime() - started;
        return MOE.json.stringify(envelope);
    };

    return 'MOE_HOST_READY ' + G.MOE.version;
}($.global));
