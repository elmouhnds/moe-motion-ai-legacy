# Engine 2 (v0.61.0)

**Source:** the owner's four AE study reports (strategic, defects, strengths, technical; 6 November 2026). They measured AppleFX Lite and SaaS Kit inside After Effects 25.6.6. Engine 2 changes **how every MOE tool runs**, not any one tool. All 80 tools get these rules through the executor and the host.

## 1. One Ctrl+Z per run

| Before | After |
|---|---|
| Every host op opened its own AE undo group. One run of Click on Layer (measure, cursor, keys) took up to 4 Ctrl+Z presses; **51 of 80 tools** were like that. | The executor opens **one undo group for the whole run**, named after the tool (`tx.begin "MOE: Click on Layer"`), and closes it in `finally`, even when the tool throws. Host ops inside it join it (`U.withUndo` checks `MOE.tx`). Restore is one step too (`MOE: Restore …`). |

- **Read-only tools** (`read` permission) open no group, so looking at the project never adds to its undo history.
- **A crashed panel** can leave a transaction open. The next `tx.begin` closes it first; groups never nest.
- **Proof in After Effects:** the Self-Test check *One Ctrl+Z undoes a whole run* runs Click on Layer, then triggers Edit › "Undo MOE: Click on Layer" once by its menu name, and reads back that the cursor layer and every key are gone.
  - `selftest.undoOnce` only accepts MOE's own labels, and only on the self-test comp.
  - If this AE names the menu item differently, the check says so ("info") instead of guessing.

## 2. Keys on the frame grid

`keys.write` rounds every key time to the comp's frame (`comp.frameDuration`). The study measured AppleFX keys at 0.36 s at 30 fps (off the grid) and SaaS Kit keys snapped (on it).

- **Merge rule:** keys that land on one frame merge. The first and last keys of a list always survive, because they hold the rest values; otherwise the key nearest that frame wins.
  - Example: a 22 Hz Jitter at 24 fps has two peaks inside one frame, so they merge, as they would by hand.
- **The pure twin** `core/framegrid.js` (`snap`, `snapKeys`, `onGrid`) gives the same answer for tests and for tools.
- **Tools that read the layer's own value under each key** (Shake, Click on Layer) snap first, then read, so the value is the one on that frame.
  - Click on Layer plans in whole frames from the start (`clickPlan` with `fd`).
  - Zoom reads back at the key as written.
- **Opt out:** `subframe: true` on the call or on one item.

## 3. Few round trips

`props.values` takes a time per item. A tool collects every value it needs and reads them in one call.

| 60 selected layers | Before | After |
|---|---|---|
| Quick Animate (rise + fade + blur + screen stagger) | 127 host calls | **8** |
| Quick Animate (pop in) | 125 | **6** |
| Shake | 65 | **6** |

The number no longer grows with the layer count; `tests/engine2.test.js` checks that 3 and 60 layers cost the same.

- **The scan:** `node tools/scan-roundtrips.js` runs every tool on 3 and 30 layers. Only Grid Builder still grows, with one `layers.clone` per selected *source* (each makes many copies in one call).

## 4. Locked layers

`core/lockpolicy.js` is ONE rule for the executor and the panel's button:

- **Not passed to a tool:** a tool that writes (`modify.*`) never receives a locked layer, nor a selected property on one.
- **Named in the result:** the skipped layers appear in the summary ("skips locked …") and in a **Locked** check.
- **All locked:** when every selected layer is locked, the button is off and says why (`"Logo" is locked — unlock to change it`). The executor refuses with the same words.
- **Reference-only tools:** a tool that only looks at the selected layer (Zoom target, Follow, Cursor click points) declares `ui.lockedOk`.

Before this, Trim Paths, the 26 Expression presets, Parent to Null, Precompose and Separate X/Y changed locked layers. This is the study's defect A1 (AppleFX edits a locked layer silently).

## The test matrix (the study's §13.5)

| Test | What it runs | Rule |
|---|---|---|
| `tests/fpsmatrix.test.js` | All 243 library tiles + 75 tools at 25, 24, 30 and 60 fps | Same result at every frame rate, no undo group left open (318 cases) |
| `tests/lockedmatrix.test.js` | The same 318 cases on **locked** layers | A full snapshot of each locked layer (keys, values, expressions, effects, shape, name, parent) is identical before and after |
| `tests/engine2.test.js` | Engine 2's own behaviour | One undo group per run and per Restore; closed on failure; stale transactions closed; read-only tools add nothing; keys on the grid at 24/30/60; the merge rule; few round trips at 60 layers; button = executor for locked layers; `undoOnce` safety |

## Settings

`engine.oneUndo: false` (a hidden setting) goes back to one undo group per host op, if an After Effects build ever misbehaves with a run-long group. The Self-Test is what would tell.
