# Tile Test — every tile, inside After Effects (v0.98.2)

**Why:** the owner's first real After Effects reports (v0.98.0, v0.98.1) showed that 600+ tests on the mock had missed
real failures: a 3-item dropdown, nested undo groups ("Undo group mismatch, will attempt to fix"), a cleanup that
crashed on its own error. The mock proves logic, not After Effects. The Tile Test runs **every library tile inside After
Effects** and reports what really happened, so a single click on the owner's machine replaces guessing.

**Where:** Diagnostics › *Test every tile in After Effects* — All libraries or one; Stop between tiles; Copy report
(failed tiles first).

## What one tile does (`features/selftest/tileRunner.js`)
1. `selftest.begin` — a fresh `MOE Self-Test Tiles` comp (1920 × 1080, 25 fps, 6 s).
2. The tile's subject (`subjectOf`): a card with two Position keys · the words "MOE Motion" · an outline · three cards ·
   a ready 3 × 2 grid (built by Grid Builder) · that grid plus an effector. Tools that work on keys get Position and its
   keys selected (`selftest.selectProp`: `PropertyBase.selected`, `Property.setSelectedAtKey`).
3. The tool runs with the tile's own args through the executor, exactly as a click.
4. **Ctrl+Z is pressed for real**: `selftest.undoLast` runs Edit › Undo of the newest MOE group, found by its menu text
   (`app.findMenuCommandId('Undo ' + label)`, never a numeric id); `selftest.census` (read-only) compares the comp's
   layers and the project's item count with how they were before. The number of presses is the real number of Ctrl+Z.
5. If Undo could not bring it back, the checkpoint restore runs and what was left is named; `selftest.end` removes the
   comp whatever happened.

Status: **pass** (worked, one Ctrl+Z) · **fail** (an error, or more than one Ctrl+Z, or Undo left something) · **skip**
(the tool needs something the test cannot make: a sound layer, a green screen, a path, a property on a grid item).

## Undo labels
`U.withUndo` keeps the labels of the groups MOE opened (`MOE.undoLabels`, newest last, 50 max). Only the outermost call
opens a group (`MOE.undoDepth`) — see CLAUDE.md "One undo group at a time".

## On the mock
`tests/tiletest.test.js` runs the runner on the mock (subjects, selection, classification, cleanup). The mock has no
Edit › Undo by name, so the Undo count reads "not checked" there; in After Effects it is real. 340 tiles pass on the
mock, 10 skip (need input), 3 fail for want of input (sound ×2, green screen) — **mock results, not After Effects**.
