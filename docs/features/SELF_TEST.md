# Self-Test inside After Effects (v0.40.0)

**What:** Diagnostics › **Check in After Effects**. One click, then a confirm step, and MOE does this:
1. Makes a temporary comp named `MOE Self-Test hh:mm:ss`.
2. Runs its advanced tools there, the same way you would.
3. Reads what After Effects really computed: `props.values` (values after expressions), `layers.bounds` (comp boxes).
4. Compares those numbers with the same reference maths the unit tests use (`grid/layouts.js`, `grid/effectors.js`).
5. Times the heavy expressions.
6. Undoes every tool through its checkpoint, and checks the undo too.
7. Removes the comp and reopens yours.

The report is plain JSON: **Copy report** and send it. The last report is kept in MOE's store and shown again.

**Why:**
- Every release since v0.33 was tested against a mock of After Effects.
- The self-test turns "unverified in After Effects" into numbers from the real host: positions in px, scales in %, angles in °, colours in /255, milliseconds.

## The checks (`features/selftest/runner.js` `CHECKS`)
| id | What it runs | Pass when |
|---|---|---|
| env | context: AE version, expression engine | JavaScript engine (Legacy ExtendScript is reported as info) |
| commands | `app.findMenuCommandId('Convert Audio to Keyframes')` | the command exists (the Audio effector needs it) |
| grid | Grid Builder 3 × 3 on 9 nulls | every position within 0.6 px of `layouts.placeMorph`; undo leaves the comp as before |
| cloner | 1 null → 12 clones on a radial | 12 items, each within 0.6 px of the 300 px ring; undo removes the copies |
| effector | sphere sweep (scale) at 4 times | every scale within 0.05 % of `effectors.applyAt`, the effector values and path read from AE |
| spring | the same with Spring 3 Hz / decay 5 | the same (the spring window, ≤ 61 samples, is read from AE) |
| target | Target, Everywhere, sweep | every angle within 0.1° |
| noise | Noise Field (size 160, softness 40, speed 60) | every scale within 0.05 % |
| image | a solid with **Gradient Ramp** black → white + Image field | scale = 100 × (1 + x / width) within 2 % (the ramp's own dither) |
| colours | Clone Colours, Cycle | every Fill colour within 0.5 / 255 of the palette |
| points | a solid with an elliptical mask + Points | 4 items on the ellipse's 4 points within 0.6 px |
| text | `addText("Make it move")` centred + Text Cloner (words) | the words' outline matches the title within 3 px; neighbours do not overlap (> 1 px) |
| textArabic | the same with `مرحبا بالعالم`, right to left, right-justified | the same (this is where real glyph bounds matter) |
| trail | a keyframed solid + Clone Trail (4 copies) | every copy's position / scale / rotation / opacity = `trail.js` at 2 times (within 0.05); undo removes copies + null |
| bake | a 3 × 3 grid with a sweeping effector, baked every 5 frames | position / scale / rotation from the keys = the live rig at 5 frames (within 0.01); no expression left; restore = the live values again (within 0.001); the bake time in ms |
| speed | 48 clones, a plain effector vs Spring | info: milliseconds to read all 48 scales |

## Safety
- **Your comps:**
  - only the test comp is made and changed;
  - `selftest.end` removes a comp only if it has that id **and** a name starting with `MOE Self-Test`;
  - then it removes the solid items its layers used that nothing else uses (`AVItem.usedIn`), and reopens the comp that was active.
- **Cleanup:** it runs in `finally`, even when a check fails or throws. A failing check is reported with its message, and the others still run.
- **Confirmation:** the tools run with `approved: true` because you confirmed the self-test itself. They appear in History under one batch.
- **Read-only lookup:** the menu-command check only looks the command up and never runs it.

## Host ops (`host/ops/selftest.jsx`)
- `selftest.begin`: `ItemCollection.addComp` + `openInViewer`.
- `selftest.addText`: `LayerCollection.addText` + TextDocument size / justification / direction.
- `selftest.commands`: `findMenuCommandId`, read-only.
- `selftest.end`: remove the comp + unused solids, reopen the previous comp.

## Tests
`tests/selftest.test.js` (4):
- On the mock all 13 checks pass and Speed is info. The test comp is removed, the user's comp is active again and unchanged, and no project items are left.
- A fault injected in `effectors.applyAt` makes the effector check fail (worst ≈ 10 %), and cleanup still runs.
- A tool that fails makes only its check fail, with its message.
- The Diagnostics card exists.

The panel preview ran the whole self-test from Diagnostics (0 JS errors).

**The point is the run in After Effects:** these mock results only prove the runner. The owner runs it in AE 2025 and sends the report.
