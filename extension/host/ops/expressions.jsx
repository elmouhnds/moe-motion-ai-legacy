/*
 * MOE Motion AI - expression operations.
 * Validation uses the real After Effects expression engine: the expression is
 * set, Property.expressionError is read, then the original is restored.
 */
(function (G) {
    var MOE = G.MOE, U = MOE.util, ops = MOE.ops;

    function state(prop) {
        return {
            expression: String(prop.expression || ''),
            expressionEnabled: !!prop.expressionEnabled,
            expressionError: String(prop.expressionError || '')
        };
    }

    function setExpr(prop, code, enabled, comp) {
        prop.expression = comp ? U.linkCode(comp, code) : code; /* v0.62: MOE-LINK ids (LINKS.md) */
        if (code !== '') { prop.expressionEnabled = enabled; }
    }

    /* args: { compId, label, targets: [{ address, expression, enabled }], revertOnError } */
    ops['expressions.set'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo(args.label || 'MOE: Apply Expression', function () {
                var out = [], i, r, prop, before, after, reverted;
                for (i = 0; i < args.targets.length; i++) {
                    r = U.resolveProperty(comp, args.targets[i].address);
                    prop = r.prop;
                    if (!prop.canSetExpression) {
                        out.push({ address: args.targets[i].address, skipped: 'CANNOT_SET_EXPRESSION' });
                        continue;
                    }
                    before = state(prop);
                    setExpr(prop, args.targets[i].expression, args.targets[i].enabled !== false, comp);
                    after = state(prop);
                    reverted = false;
                    if (after.expressionError && args.revertOnError) {
                        prop.expression = before.expression;
                        prop.expressionEnabled = before.expressionEnabled;
                        reverted = true;
                    }
                    out.push({
                        address: args.targets[i].address,
                        name: prop.name,
                        layerName: r.layer.name,
                        before: before,
                        after: after,
                        finalState: state(prop),
                        reverted: reverted
                    });
                }
                return { targets: out };
            });
        }
    };

    /* args: { compId, targets: [{ address }], expression } -> engine errors, no net change */
    ops['expressions.validate'] = {
        mutates: true,
        run: function (args) {
            var comp = U.compById(args.compId);
            return U.withUndo('MOE: Validate Expression', function () {
                var out = [], i, r, prop, before, err, restoredOk;
                for (i = 0; i < args.targets.length; i++) {
                    r = U.resolveProperty(comp, args.targets[i].address);
                    prop = r.prop;
                    if (!prop.canSetExpression) {
                        out.push({ address: args.targets[i].address, skipped: 'CANNOT_SET_EXPRESSION' });
                        continue;
                    }
                    before = state(prop);
                    setExpr(prop, args.expression, true);
                    err = String(prop.expressionError || '');
                    prop.expression = before.expression;
                    prop.expressionEnabled = before.expressionEnabled;
                    restoredOk = String(prop.expression || '') === before.expression;
                    out.push({ address: args.targets[i].address, name: prop.name, layerName: r.layer.name, error: err, restored: restoredOk });
                }
                return { targets: out };
            });
        }
    };
}($.global));
