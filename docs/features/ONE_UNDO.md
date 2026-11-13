# One Ctrl+Z per production (v0.94)

The owner's report (v0.93): a product UI piece or a title arrived as loose layers in the user's comp, and Ctrl+Z took it apart one step at a time.

## What was wrong
After Effects closes an undo group when the script that opened it returns. The Scripting Guide says, under `app.endUndoGroup`: "in its absence at the end of a script, the system will close the undo group automatically".

v0.61's `tx.begin` opened one group in one `evalScript` call and expected the following calls to join it. They could not: AE had already closed it. And since `MOE.tx` stayed set, `U.withUndo` in the following calls opened **no** group at all. So every write was its own undo step. The claims "one Ctrl+Z per run" (v0.61) and "per Mix" (v0.75) were wrong. The test mock let a group span calls, which hid the problem.

## The rule now
- **One host call = one undo group.** `U.withUndo` always opens its group (`util.jsx`). `tx.begin` / `tx.end` remain only as no-ops (`deprecated: true`).
- **A tool that wants one Ctrl+Z sends all its writes as ONE call**: the host op `tx.run`. Build it with `core/host/plan.js`:
  ```js
  const P = plan(host, 'MOE: Thing');
  const nul = P.add('layers.createNull', { compId, name: 'MOE X' });
  P.add('effects.ensure', { compId, layers: [{ layer: { layerId: nul.at('layerId') }, items }] });
  await P.commit();            // one host call, one undo group
  const made = nul.value();    // results after commit
  ```
- **Read first, then plan.** A step may only use what earlier steps returned (refs, `"$ref:s<i>.<path>"`). It never reads the comp in between. Reads (`layers.describe`, `props.values`, `expressions.peek`) change nothing and come before the plan. A conflict is refused before anything is written.
- `tx.run` checks every step's op first (registered, not `tx.*`, ≤ 500 steps). It runs the steps in order and stops at the first failure: `failed {step, op, code, message}`. What ran is still that one undo step; the tool removes what it made, as before.
- Writing into a comp made in the same call is allowed only through `MOE.txComps` (`comps.create`). No other comp becomes writable.
- **Measuring** (bounds probe, `text.measure`) makes a temporary probe / comp and removes it inside its own group. That undo step changes nothing. `tools/audit-undo.js` counts it apart.

## Productions in their own comp
Templates (titles, lower thirds, product UI) are built in their own comp `MOE Template N` and placed in the user's comp as **one layer at the playhead** (`container: 'comp'`, the default). `container: 'layers'` keeps the old loose layers.
- First the texts are measured by After Effects (`text.measure`, a temporary comp, removed). This is skipped when the session already measured the same texts.
- Then one plan does the work: `comps.create` → texts → shapes → order → null → parents → values → trim → keys → `comps.place`.
- Restore removes the placed layer and the comp (`comps.removeMoe`: only `MOE …` comps nothing else uses) in one step.

## Where we are (mock, `node tools/audit-undo.js`, 226 library tiles)
| | v0.93 | v0.94 |
|---|---|---|
| One real Ctrl+Z | 45 | **210** |
| More than one | 181 | 16 (Grid Build, 2 each) |
| A write with no undo group | — | 0 |

52 tiles also have one measuring step before, which changes nothing (Templates the first time, Quick Animate moves, Zoom on a layer, Carousel, Click, Depth with stagger, Grid Build).

- **Grid Build is 2 steps: Center Anchor, then the grid.** The grid's expressions need each item's Position after its anchor was centred, and that value only After Effects computes. With *Center anchors* off, it is one step. Copies and anchors are one step together. The rest of the grid (3D switch, null, controls, menus, parenting, every expression, the Build / Morph keys) is the second step. Before, it was 11 steps.
- **Mix / recipes / Tune After are one step per tool they run.** Each tool reads the comp the previous one changed, so they cannot be one host call.
- Restore of the converted tools is one step too.

## Tests
- `tests/oneundo.test.js`: a template is one layer in its own comp at the playhead. Its undo steps are `['MOE: Measure Text', 'MOE: <label>']`; a re-apply is one step; Restore is one step. The own comp equals the layers build. `tx.run` safety: no other comp writable, unknown op refused before anything runs, failure names its step, refs resolve, `PLAN_NOT_COMMITTED`.
- The harness closes any group still open after each call, like After Effects, and records a mutating op that wrote with no group.
- Everything here is mock-tested. **It has not run in After Effects yet.**
