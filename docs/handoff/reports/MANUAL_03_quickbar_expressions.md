# Manual test — Group 3: Quick Bar actions + Expressions buttons

| | |
|---|---|
| Date | 2026-11-17 |
| After Effects | **26.5.3 (Build 9)** / Diagnostics `26.5.3x9` |
| MOE Motion AI | **0.99.5** (with the Group 1 + 2 fixes deployed) |
| Project | `MOE Manual Test.aep`, comp `MOE Manual Test G2` |
| Code | `features/quick`, `features/expressions` |

**Nothing in this group had to be fixed.** It is the cleanest group so far.

## Tile Test in After Effects — `expressions` section

```
MOE 0.99.5 · After Effects 26.5.3x9 · 37 pass · 0 fail · 0 skip · 20 s
```

All 37 expression tiles ran in After Effects and undid cleanly
(`changed no layer [undo 0 ✓]`): Wiggle · Wiggle X · Wiggle Y · Step Wiggle · Blinker · Flicker · Auto Fade ·
Loop Cycle · Ping-Pong · Loop Offset · Loop In + Out · Time Rotation · Pendulum · Pulse · Float · Inertia Bounce ·
Stop Motion · Bounce Land · Squash & Stretch · Orbit · Swing · Heartbeat · Breathe and the rest.

## Results

| # | Tool | Subject | Verdict | What I saw |
|---|---|---|---|---|
| 1 | Expressions · Wiggle | shape layer, **Position property** selected | **WORKS** | Position went red (expression-driven) and read 938.7,546.0; the expression begins `// MOE Expr: Wiggle` — the tag `docs/features/LINKS.md` requires. |
| 2 | Controls on demand | same | **WORKS** | Effect Controls got **exactly two** sliders — `MOE Wiggle Frequency 2.00` and `MOE Wiggle Amount 30.00` — the preset's own numbers, not form defaults, and nothing else from the technique. |
| 3 | Retune strip | same | **WORKS** | `Wiggle · Frequency 2 · Amount 30 · Rate 2 Hz` — the tool's own params, tunable without re-running by hand. |
| 4 | Expressions library page | — | **WORKS** | Lands on a page headed "Smart expressions, no typing — 37 expressions", filters All / Mine / Random / Periodic / Keys / Auto, and a section headed **`POSITION 11 · fits your selection`** — it really does narrow to what the selected property can take. Each tile has a little waveform drawing of its motion. |
| 5 | One Ctrl+Z | same | **WORKS** | One undo took the expression and both sliders away; Position back to 960,540 in white. |
| 6 | Panel search ("wiggle") | — | **WORKS** | Wiggle · Wiggle X · Wiggle Y · Wiggle Rotation · Wiggle Scale · Step Wiggle · Organic Wiggle · Loop Wiggle, each labelled `Expressions preset · Random` with an APPLY chip, plus Apply Expression / Quick Expression / Trash Rigs. |
| 7 | Quick Bar page | — | **WORKS** | "Edit your Quick Bar" with every everyday button in one place, grouped PROJECT / LAYER / KIT …, a star per button (23 pinned), and `Click = run · Right-click = options`. |
| 8 | Quick Bar action · Flip Horizontal | text layer | **WORKS** | The text mirrored **in place** — it did not jump, so the flip is anchor-aware. One Ctrl+Z put it back. |
| 9 | Quick Bar right-click | Flip Horizontal | **WORKS** | A **solid** pop-over (Glass's rule: the page is glass, what floats over it is solid) with an Axis pair control `Horizontal | Vertical`, a Flip button and a save-as-preset icon — the "opposite actions = one pair control" rule. |

## Observation, not a defect
When the Retune strip at the top of the panel appears or disappears (it goes as soon as you change the selection),
everything under it jumps up by about 80 px. Clicking straight after changing the selection can therefore land on
the row below the one you aimed at — it happened to me once and ran **Pre-compose** instead of Flip Horizontal.
A person watching the panel sees the jump; it is only a hazard for a click already in flight. Worth knowing before
the strip gets any taller.
