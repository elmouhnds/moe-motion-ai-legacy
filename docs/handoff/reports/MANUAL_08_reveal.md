# Manual test — Group 8: Reveal (Wipe · Matte Reveal · Matte FX · Reveal Composer)

| | |
|---|---|
| Date | 2026-11-17 |
| After Effects | **26.5.3 (Build 9)** / Diagnostics `26.5.3x9` |
| MOE Motion AI | **0.99.5** |
| Project | `MOE Manual Test.aep`, comp `MOE Manual Test G6`, a 1000 × 400 orange solid |
| Code | `features/reveal` (`mattePlan`, `matteTool`, `fxPlan`, `fxTool`, `grammar`) |

**The biggest thing in this group is not a reveal tool. It is that the Tile Test's undo check has been blaming the
tools for something After Effects does, and that is the check `CLAUDE.md` makes the proof before anything may be
called fixed.** It is fixed here, and the question raised in `MANUAL_06_design.md` and `MANUAL_07_cloner_grid.md` is
answered with measurements rather than argument.

## 1. The undo check was wrong — the whole 126-failure figure is not evidence

### What I measured
`animate/mtDiag` is one tile with fixed arguments. Run inside a batch of 58 it **passed**; run on its own, minutes
later, the same tile **failed** with *"Ctrl+Z did not bring it back after 1"*. Nothing about the tile changed.

So I instrumented the press itself. `selftest.undoLast` finds Edit › Undo by its menu text and runs
`app.executeCommand`. I made it report what the press actually did:

```
FAIL animate/fx-inkBleed — probe {"layersBefore":3,"layersAfter":3,"itemsBefore":104,"itemsAfter":104}
```

**The command was found, it was executed, and After Effects changed nothing at all.** Not a wrong undo — no undo.
Then I pressed again, four times inside one host call: no change. Then four times in four separate host calls: no
change. It is a stable refusal, not a race.

### Why it mattered so much
The runner counted that as a press. Having "pressed once" with the census still different, it reported the tool as
leaving things behind. Every one of these is that:

```
FAIL templates/tpl-lowerThird  — layers left: MOE Template 1
FAIL backgrounds/bg-tomato     — layers left: MOE Background
FAIL zoom/punch                — layers left: MOE Zoom
FAIL animate/mtWipe            — layers left: MOE Matte · ST Card
```

I ran those four on their own and all four reported `Edit menu matched "Undo"` and **changed nothing**. By hand, one
Ctrl+Z took each one back — which is exactly what `MANUAL_06_design.md` saw with a template and could not reconcile.
**Reading 2 of that report was the right one.** My hand test was not missing anything; the runner was.

### The fix
A press that changes nothing did not happen, so it is no longer counted as a Ctrl+Z, and the tile is no longer
blamed. The runner says the rule could not be measured — the same honest wording it already used when the host has no
Edit › Undo by name — and the report counts them:

```
MOE 0.99.5 · After Effects 26.5.3x9 · 58 pass · 0 fail · 0 skip · 58 undo not measured · 91 s
```

`selftest.undoLast` returns whether the press changed anything (layers, project items and layer names — the same
signature the census compares, so a rename counts too). `tileRunner` stops on a refused press, marks the row
`undo.stuck`, and `report.totals.undoUnchecked` makes it visible instead of silent.

**What this does not say.** It does not say every tool undoes cleanly. A press that *lands* and still leaves
something is still a failure, unchanged — the `zoom/*` rows that read "after 2" and `layout/*` rows that read
"after 3 / 4" are presses that did land, and they are still real. It says only that *"did not bring it back"* is not
evidence when the press never happened. The 126 figure in Diagnostics must be re-measured before it is used to judge
anything.

### The test mock was hiding it
The mock had no Edit › Undo at all, so in 600+ tests the runner's undo branch never ran once. The mock now has a real
Edit › Undo (found only by its own menu text, restoring the layer and project-item lists) and `env.undo.refuse` to
reproduce After Effects ignoring it. With the mock's undo switched on it immediately found something else real:

```
layout/cloneGlobe: needs 2 Ctrl+Z (MOE: Grid › MOE: Measure (temporary))
```

That measurement group is in `main` since v0.4.0 (`layout.jsx` `layers.bounds`) — **not** from this session's work; I
checked. It is a genuine second undo step on every tool that measures, and it is the likely explanation of the
"needs 2 / 3 / 4 Ctrl+Z" family. It is **not fixed here**: a temporary measurement that leaves no undo step means
putting the measurement inside the tool's own plan, which is engine work and wants its own measurement and tests.
The mock's undo is **opt-in** (`env.undo.menu = true`) and says why in its own comment: it restores layers and items,
not keys, so a test that measures keys must not use it.

## 2. The tools, by hand

| # | Tool | Verdict | What I saw |
|---|---|---|---|
| 1 | **Wipe › Wipe In →** (`quick.wipe`) | **WORKS** | One click ran it — no Apply step. The card was gone at frame 0 and wiped in. The Retune strip appeared with Duration 0.8 · Soft edge 60 · Stagger. **One Ctrl+Z** brought the card back whole. |
| 2 | **Matte Reveal › Iris Reveal** (`reveal.matte`) | **WORKS** | The tile opens an Inspector with a `WILL DO` card that is exactly right: *one shape layer "MOE Matte · \<layer\>" per layer, set as its Alpha Track Matte and parented to it (hidden — the matte, not a picture)* · *keys on the matte's cells (Iris)* · and a warning that a layer with its own track matte is skipped. It built `MOE Matte · G8 Card`, set Track Matte on the card, and the read-back reported **shows 0 % → 100 % (plan 0 % → 100 %)**. **One Ctrl+Z** removed the matte layer and put Track Matte back to *No Mat*. |
| 3 | **Matte FX › Ink Bleed** (`reveal.fx`) | **WRONG RESULT** (one setting) | Structurally right: pre-comps `MOE FX 1 Map` and `MOE FX 1 Matte`, the card on an alpha track matte, everything parented, and **one** controller null `MOE FX 1 Controls` carrying only the sliders this style uses — Softness 16, Noise 75, Noise Size 240, Boil % 100, Warp 28 — which is Controls-on-demand honoured. But **Edge softness does nothing** (§3). |
| 4 | **Reveal Composer** | **WORKS** | The Inspector's compose mode reads *"3,888 combinations — Shuffle keeps the locked axes"* with Shuffle and the four axis chips. I locked **Shape**, pressed Shuffle: Shape stayed **Iris** while Material went Soft light → **Liquid**, Motion Smooth → **Impact**, Palette → **Aurora**. Running it built `MOE FX 2 Controls` with the Liquid material's own numbers (Softness 10, Noise 45, Noise Size 200, Warp 80) — the grammar reaches After Effects correctly. |

Naming note: the timeline's **Source Name** column shows `Null 172` for the controller. Switching the column to
**Layer Name** shows `MOE FX 1 Controls`. Same trap as Group 5's Parent Null — not a defect.

## 3. Edge softness does nothing (Matte FX and Reveal Composer)

The one real defect of this group.

**Measured.** Same shape, same material (`soft`, whose noise mix is 0, so the matte is a clean ramp and softness is
the only thing shaping its edge), same everything but the number. Each run confirmed `PASS` with its own render, and
the feather measured on the **alpha** channel of After Effects' own render:

| Edge softness | Alpha width | Partly transparent pixels across the front |
|---|---|---|
| 0 | 358 px | **4** |
| 50 | 358 px | **4** |
| 100 | 358 px | **4** |

Four pixels is antialiasing. At 100 the whole card should be fading.

**Where it is lost.** In Effect Controls after an Ink Bleed (whose plan asks for 16):

- `MOE FX 1 Controls` → **Softness slider = 16.00** — the number arrives at the controller.
- `MOE FX 1 Matte` → `MOE FX Wipe` → Gradient Wipe → **Transition Softness = 0 %**, driven by its `// MOE FX`
  expression — the number does not arrive at the effect.
- The same controller's **Warp** reaches `MOE FX Liquid → Amount = 28.0` correctly, so the controller link itself
  works. Softness is the target that loses it.
- `Transition Completion` reads 100 % as it should.

**The unit is not the cause, and must not be changed.** I tried writing the softness as a plain percentage and After
Effects refused it outright:

```
After Effects error: Unable to call "setValue" because of parameter 1.
Value 16 out of range 0 to 1. [compositing.jsx line 250]
```

So the 0–1 in `fxTool WIPE_UNIT` is right and `CLAUDE.md`'s note stands. I reverted that attempt. The loss is
between the controller slider and the effect — the `Softness` entry of `controlsFor()` is the one control in that
list with an `expr: '$ / 100'` divisor on a property that is already 0–1, and that is where whoever picks this up
should start. **I have not guessed a fix**: the next step is reading what that expression evaluates to in After
Effects, not changing it by eye.

Every Matte FX preset and every Reveal Composer combination is affected, including the ones whose whole identity is a
soft front — `soft` (30), `smoke` (40), `cloudIris` (30), `lightBloom` (25). They all render a hard edge today.

## 4. Smaller things

- **`moe_try_tool` returns frames I cannot look at.** Its whole purpose in `CLAUDE.md` is *"use `moe_try_tool` to LOOK
  at the rendered frames and judge it as a motion designer"*, and it renders `.tif`, which comes back as
  *".tif cannot be shown as an image"*. I had to convert every frame with ffmpeg to see anything. A PNG option would
  make the bridge do what it is for.
- **The library search only filters when you press Enter.** Typing `iris` leaves the full grid showing, which reads
  as "no results for this" rather than "not searched yet".
- **A reveal tile at rest can look like a broken tile.** `Iris Close` and `Cloud Iris` show a black square until the
  pointer rests on them, because the first frame of a reveal is an empty frame. It is correct and it looks wrong.
- **`glass.thick` fails for real** (Group 9's territory, found in the log while here):
  `Value 12 out of range 0 to 0.5 [compositing.jsx line 244] (step 9 of 12: effects.ensure)`.

## 5. Also fixed: the Retune strip offered settings that do nothing

Seen on screen: after an **Iris Reveal**, the Tune After strip offered **Bars 6 · Columns 8 · Corner radius 24 px** —
Blinds', Pixels' and Card's settings, on an iris — while **Duration** and **Soft edge**, which an iris does use, were
pushed out of the three slots. `retune/plan.js tunables()` took the first three numbers of the tool and ignored each
parameter's `showIf`, which the Inspector has always honoured.

It now takes the run's own arguments and leaves out what the Inspector would hide, with settings behind *Advanced*
last. Verified in After Effects: the strip for an Iris Reveal now reads **Duration 0.9 s · Soft edge 0 px ·
Stagger 0 s**.

## 6. Numbers

| | |
|---|---|
| Reveal tiles in After Effects | **58 pass · 0 fail · 0 skip** (58 undo not measured) |
| Before the undo-check fix | 56 pass · 2 fail — both false |
| `npm run check` | **645 pass · 0 fail · 1 skipped** |

New tests, each of which fails on the old code:

- `tests/tiletest.test.js` — a real Edit › Undo is counted; an Undo After Effects refuses is reported as not
  measured, not as a failed undo.
- `tests/tuneafter.test.js` — the strip only offers numbers that apply to the run that was made.
