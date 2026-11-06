# Progress + Stop (v0.63.0)

**Source:** the owner's AE study, defect **S4** (no progress for long runs) and the KPI "anything over ~2 s shows progress and can be stopped". Built into the executor, so **every tool** has it, not one at a time.

- **Steps.** Every After Effects call a run makes is a step with a plain name. The names come from the call:
  - Measuring;
  - Reading;
  - Writing keys;
  - Writing expressions;
  - Setting effects;
  - Making copies;
  - Drawing;
  - Adding layers;
  - Arranging layers;
  - Baking.

  The executor emits `{ type: 'step', step, label, ms }`.
- **The activity strip.** A run that takes longer than half a second shows a strip at the foot of the panel:
  - the tool, the current step and its number, and the time;
  - a moving line;
  - **Stop**.

  Fast runs never flash it, and with *reduced motion* the line stands still.
- **Stop is honoured before the next step.** One After Effects call cannot be cut in half, so the run stops between steps.
  - What the run already made stays as **one undo step**, the run's transaction from Engine 2.
  - The panel says exactly that: *Grid Builder stopped after 3 step(s) — Ctrl+Z removes what was made*.
  - Stopped before the first write, it says *stopped before it changed anything*.
  - History records the run as `stopped`.
  - A Stop belongs to the run it was pressed in; the next run starts clean.

## One call instead of many

Grid Builder made one clone call per selected source. Now `layers.cloneMany` copies every source in one call and one undo group. 30 sources cost the same 20 calls as 3 sources. `node tools/scan-roundtrips.js` now reports no tool whose calls grow with the selection.

## Checks

`tests/progress.test.js` (3):

- the step names of a 5-step tool;
- Stop at step 2: step 3 never runs, one write stays, the undo group is closed, history says `stopped`, and the next run succeeds;
- Stop before the first write.
