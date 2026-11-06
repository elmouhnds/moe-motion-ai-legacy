/*
 * MOE Motion AI - run transactions (v0.61, docs/features/ENGINE2.md). ExtendScript / ES3, ASCII only.
 *
 *   tx.begin  { label }  opens ONE undo group for a whole tool run; ops inside it do not open their own
 *   tx.end    {}         closes it (always called by the panel in a finally block)
 *   tx.state  {}         read-only: is a transaction open, and since when
 *
 * A transaction left open by a crashed panel is closed by the next tx.begin, never nested.
 */
(function (G) {
    var MOE = G.MOE, ops = MOE.ops;

    ops['tx.begin'] = {
        mutates: true,
        run: function (args) {
            var stale = null;
            if (MOE.tx) {
                stale = MOE.tx.label;
                MOE.tx = null;
                try { app.endUndoGroup(); } catch (eEnd) { /* nothing open */ }
            }
            var label = String(args.label || 'MOE').substring(0, 120);
            app.beginUndoGroup(label);
            MOE.tx = { label: label, opened: new Date().getTime() };
            return { label: label, closedStale: stale };
        }
    };

    ops['tx.end'] = {
        mutates: true,
        run: function () {
            if (!MOE.tx) { return { closed: false }; }
            var t = MOE.tx;
            MOE.tx = null;
            app.endUndoGroup();
            return { closed: true, label: t.label, ms: new Date().getTime() - t.opened };
        }
    };

    ops['tx.state'] = {
        mutates: false,
        run: function () {
            return { open: !!MOE.tx, label: MOE.tx ? MOE.tx.label : null, ms: MOE.tx ? new Date().getTime() - MOE.tx.opened : 0 };
        }
    };
}($.global));
