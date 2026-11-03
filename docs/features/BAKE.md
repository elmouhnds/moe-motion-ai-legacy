# Bake to Keyframes (v0.42.0)

**What:** one click turns a MOE rig's live expressions into plain keyframes over the work area (or the whole comp): the Grid / Cloner items with their Effectors, Spring, Target, fields and clone colours, the copies of a Clone Trail, or any MOE expression on a layer. The scene renders lighter, needs no MOE expressions and opens on any machine. Restore brings everything back.

**When:** the motion is final and the comp is getting heavy (many clones × Spring / Image field), before handing the project to someone without MOE, or before you want to hand-edit a few keys of the result.

**Where:** Motion Kit › *Clean up* › **Bake** (Alt-click = one key per sampled frame; right-click for the options). Keys tab › *Keyframes & Loops* › **Bake keys**. Ctrl+K: "bake", "convert expression", Arabic «بيك», «حول لكي فريمز», «من غير اكسبريشن».

## What gets baked

| Selected | Baked |
|---|---|
| `MOE Grid N` null | every MOE expression on its items (Position, Scale, Rotation, Opacity, the `MOE Clone Colour` Fill) |
| `MOE Trail N` null | the four expressions of each of its copies (found by the tag `// MOE Trail · MOE Trail N`) |
| any other layer | its own MOE expressions (tagged `// MOE …`); with **Bake: Every expression** also your own expressions on that layer |

The effector nulls, the grid null and the trail null stay (they no longer drive anything after a bake; Restore needs nothing from them).

## Options

- **Range** — Work area (default) or Whole comp. Outside the range the value holds its first / last key.
- **Sample every** — 1–10 frames (default 1). The expression is read on those frames; the last frame of the range is always read.
- **Keys** — *Only what is needed* (default): keys are LINEAR, and a sample becomes a key only where a straight line from the previous key would miss a sample by more than the tolerance (0.005 px / % / °; colour 0.0005). A value that never changes becomes a plain value (no keys). *One per sample*: a key on every sampled frame.
- **Bake** — *MOE rigs* (default) or *Every expression* on the selected layers.

Checkboxes and menus get HOLD keys (only where the value changes); spatial keys get straight tangents, so the path between keys is the straight line the plan assumed.

## How it works (and why it is safe)

1. `bake.scan` (read-only) lists the live expressions on the target layers and why any is skipped: not a number / point / colour (text, shapes, markers), Position with separate dimensions, a locked layer, more than 1,000 keys under the expression.
2. `bake.sample` (read-only) reads every property at every sampled frame **before anything changes**, so rigs that read each other are all still live. An expression error stops the bake here — nothing has changed.
3. `features/bake/plan.js` decides the keys (pure, tested). Limits: 120,000 values read and 40,000 keys written per bake; above that the bake refuses before writing and tells you which *Sample every* fits.
4. `bake.write`, in pieces of ≤ 4,000 keys, each in one undo group: saves the property's expression and its own keys (time, value, interpolation, ease, spatial tangents), removes them, writes the samples with `Property.setValuesAtTimes` and sets each key's interpolation. A property that fails is put back at once.
5. Read-back: up to 12 of the sampled frames are re-read from the keys and compared with the samples (the check reports the worst difference in units of the tolerance).
6. Restore (`bake.restore`): removes the baked keys and puts back each saved expression and the keys that were under it — e.g. the source's keys a trail copy carries.

## Self-Test

`bake` in Diagnostics › Check in After Effects: a 3 × 3 grid with a sweeping effector is baked every 5 frames; After Effects' values at 5 frames must equal the live ones (≤ 0.01), the expressions must be gone, the restore must bring the live values back (≤ 0.001), and the bake time in ms is reported.

## Tests

`tests/bake.test.js` (7): the plan maths (frame times, smart keys on a line / still + curve / constant / hold, chunks, the "every" hint); a swept, coloured 6-item grid baked from its null = the live rig at every frame (transform within 0.005, colour within 0.0005), smart keys fewer than half the samples, restore = the same expressions, live again; one key per sample every 2 frames over the whole comp; a trail baked from its null with the keys under the copies restored and the source untouched; MOE rigs vs every expression; refusals before any change (nothing to bake, too many values, an expression error); the UI placement and Arabic words. **Mock, not After Effects** — the Self-Test's bake check covers it in AE.

## Not done / limits

- Time remapping, 3D cameras and text / shape paths are not baked (not a number, point or colour).
- Between sampled frames with *Sample every* > 1 the keys are straight lines; the expression could have curved there.
- Speed in After Effects depends on how heavy the expressions are (Spring and Image fields read many samples per value); the Self-Test reports the bake time.
