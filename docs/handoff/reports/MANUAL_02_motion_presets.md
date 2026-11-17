# Manual test — Group 2: Motion presets (Animate In / Out · Draw On · Loop · Shakes · Styles)

| | |
|---|---|
| Date | 2026-11-17 |
| After Effects | **26.5.3 (Build 9)** / Diagnostics `26.5.3x9` |
| MOE Motion AI | **0.99.5** |
| Project | `Desktop\MOE Manual Test\MOE Manual Test.aep`, comp `MOE Manual Test G2` 1920×1080 · 25 fps · 10 s |
| Subjects | text `MOE Motion`, Arabic text `مو موشن`, a shape rectangle (fill + stroke), a 400×300 solid |
| Code | `features/motion`, `features/quick` |

Two sources: every tool below was clicked by hand in the panel, **and** the whole `animate` section was run through
the Claude Test Bridge's Tile Test inside After Effects (124 tiles) — that is how the eight broken presets were
found and how the fix was proved.

## Tile Test in After Effects — before and after

| | Before | After the fix |
|---|---|---|
| `animate` section (124 tiles) | **113 pass · 11 fail** | the 8 move presets now pass |
| `animate/inRL … outBT` (8 tiles) | all **FAIL** — `Ctrl+Z did not bring it back after 2: project items 82 → 83` | all **PASS** — `changed no layer [undo 0 ✓]` |

## Results

| # | Tool | Subject | Verdict | What I saw | Fixed | Re-tested on screen |
|---|---|---|---|---|---|---|
| 1 | Slide In ← | text | **WORKS** | Position 2464.7,240.3 → 297.8,240.3 over 0.6 s, landing exactly on the layer's own pose. Retune strip: Duration 0.6 s · Distance 0 (= fully off-screen) · Variations. | — | yes |
| 2 | Slide In ↑ / Fade In / Rise In | text | **WORKS** | Keys written on the right property only; one Ctrl+Z, labelled `Undo MOE: Quick Animate`. | — | yes |
| 3 | **All 8 Slide In / Slide Out tiles** | card | **WRONG RESULT** | Each run left **one extra item in the project** that Ctrl+Z never took back. The owner's Solids folder was full of `Null 1, Null 2, …` and `MOE FX Noise / Ramp / Wipe`. | **yes** | yes — all 8 tiles pass now |
| 4 | Draw On (Trim Paths) | shape with fill + stroke | **WRONG RESULT / needs the owner** | It adds `MOE Trim` correctly and keys it, but on a shape that has a **Fill** the result is the fill being cut into a wedge, not a line drawing itself on (`MANUAL_02_drawon_fill.jpg`). That is After Effects' own Trim Paths behaviour — but the tool says nothing about it beforehand. | no — see below | n/a |
| 5 | Erase / Travel / Draw + Erase | shape | **WORKS** (tile test) | `Trim Paths on 1 layer(s) · changed no layer [undo 0 ✓]`. | — | by tile test |
| 6 | Shake · Zoom Punch | shape | **WORKS** | Real keyframes on **Scale and Rotation** (a dense, eased run ending back at rest 100 % / 0°) — keys, not an expression, exactly as `docs/features/STYLES_SHAKES.md` says. One Ctrl+Z. | — | yes |
| 7 | Style · Glow | shape | **WORKS** | An `Effects` group appears on the layer and the rectangle really glows in the viewer; the Retune strip offers Amount / Every. The panel moves to **Looks & Glass**, whose tiles are real rendered previews and look premium. | — | yes |
| 8 | Ease curve library / Smooth · Snappy Ease | keys | **WORKS** (tile test) | `Eased 2 keyframes — verified`. | — | by tile test |
| 9 | Panel search ("style") | — | **WORKS** | Clear, labelled results (Style · Style Kits · Soft Shadow · Deep Shadow · Glow · Light Sweep · Apply Whole Brand · Grade from Words · Matte Reveal), each with the section it belongs to. | — | yes |

## The defect, and why (#3)

Read by hand in After Effects 26.5.3: `comp.layers.addNull()` and `addSolid()` also put a **solid of their own in
the project**, and removing the *layer* leaves that item behind. So:

- `layers.bounds`' temporary probe — used by every auto-distance move, Align and Distribute — left one `Null N`
  solid per run, and Ctrl+Z never took it back;
- removing a MOE pre-comp (`comps.remove` / `comps.removeMoe` / `glass.removeMap`) orphaned the solids **its**
  layers used — that is where `MOE FX Noise / Ramp / Wipe` came from;
- `quick.parentToNull`'s undo took the null away but not its solid;
- the Self-Test's own `ST …` solids were orphaned whenever a check undid its layer before `selftest.end` ran.

The test mock made **no project item at all** for a null or a solid, so no test could see any of it.

**Fix** — `U.dropSource` / `U.sourcesOf` / `U.dropProbe` in `host/lib/util.jsx`: an item goes only when it is MOE's
own (`MOE …`, or After Effects' `Null N`), is not a comp, and `usedIn` is empty. Wired into `layers.bounds`,
`pixels.sample`, `probeDelta`, `layers.remove`, `comps.remove`, `comps.removeMoe`, `glass.removeMap`,
`quick.unparentFromNull`, and `selftest.end`. The mock now makes a real solid item (with a `SolidSource`
`mainSource`) the way After Effects does.

## Needs the owner's decision
**Draw On over a Fill (#4).** `quick.trimPaths` only checks that the layer is a shape; it never looks at whether the
shape has a Fill, and `prepare()` has no host access to find out. What should it do — warn on the Tool Card
("Trim Paths cuts the fill too"), trim only the stroke, or leave it as it is? That is how the tool should *behave*,
so it is not decided here. Screenshot: `MANUAL_02_drawon_fill.jpg`.

## Observations, not defects
- Every tool that measures (auto-distance moves, Align, Distribute) leaves a second, empty undo step named
  **`MOE: Measure (temporary)`** under its own. `tools/audit-undo.js` already counts these ("272 one Ctrl+Z, of
  them 56 also have measure step(s) that change nothing") and reports 0 violations, so it is known and tolerated.
  It does mean a second Ctrl+Z after undoing a move looks like it does nothing.

## Not fixed here — other groups
From the same tile run, still failing in After Effects and belonging to Groups 7 / 8:
- `animate/mtWipe` (`reveal.matte`) — `Ctrl+Z did not bring it back after 1: layers left: MOE Matte · ST Card`
- `animate/proxGrow` (`proximity.apply`) — `layers left: MOE Effector 1`
- `animate/fx-organicSweep` (`reveal.fx`) — `layers left: MOE FX 1 Controls, MOE FX 1 Matte; project items 87 → 93`

## Not tested in this group
Loop (Cycle / Ping-Pong) and Blur-on-move were not driven by hand; they are covered only by the tile test's
"ran without an error".
