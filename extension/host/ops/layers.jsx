/*
 * MOE Motion AI - layer timing operations (mutating).
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    /*
     * args: { compId, label, layers: [{ layerId, layerIndex, startTime }] }
     * Moves each layer (with its keyframes) by setting Layer.startTime.
     * Locked layers are skipped and reported, never unlocked silently.
     */
    ops['layers.setStartTimes'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Layer Timing', function () {
                var out = [], i, ref, layer;
                for (i = 0; i < args.layers.length; i++) {
                    ref = args.layers[i];
                    layer = U.findLayer(comp, ref);
                    if (layer.locked) {
                        out.push({ layerId: layer.id, name: layer.name, skipped: 'LOCKED', before: layer.startTime, after: layer.startTime });
                        continue;
                    }
                    var before = layer.startTime;
                    layer.startTime = ref.startTime;
                    out.push({ layerId: layer.id, name: layer.name, before: before, after: layer.startTime });
                }
                return { layers: out };
            });
        }
    };
}($.global));
