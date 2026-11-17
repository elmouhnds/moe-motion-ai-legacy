# Manual test — Group 6: Design (Templates · Product UI · Shapes & Icons · Backgrounds)

| | |
|---|---|
| Date | 2026-11-17 |
| After Effects | **26.5.3 (Build 9)** / Diagnostics `26.5.3x9` |
| MOE Motion AI | **0.99.5** (with the Group 1–4 fixes deployed) |
| Project | `MOE Manual Test.aep`, comp `MOE Manual Test G6` |
| Code | `features/design` |

## Tile Test in After Effects — the numbers

| Section | Result |
|---|---|
| `templates` (12 tiles) | **0 pass · 12 fail** |
| `productui` (21 tiles) | **3 pass · 18 fail** |
| `backgrounds` (52 tiles) | **51 pass · 1 fail** |

Every one of those failures is the same check — *"Ctrl+Z did not bring it back"* — never an error while running:

```
FAIL templates/tpl-lowerThird (design.template) — Ctrl+Z did not bring it back after 1:
     layers left: MOE Template 1; project items 96 → 98 [undo 1 ✗]
FAIL productui/cfx-ripple (interact.clickFx) — ... layers left: MOE Click 1 Controls,
     MOE Click 1 Ring, MOE Click 1 Flash; project items 96 → 97 [undo 2 ✗]
FAIL productui/ui-click (interact.click) — ... layers left: MOE Cursor 1 [undo 2 ✗]
FAIL backgrounds/bg-tomato (design.background) — ... layers left: MOE Background;
     project items 96 → 97 [undo 1 ✗]
```

## What the tools themselves do — by hand

| # | Tool | Verdict | What I saw |
|---|---|---|---|
| 1 | Templates › Lower Third | **WORKS** | One click built it as **one layer** `MOE Template 1` in my comp, holding its own comp. Inside: the null `MOE Template 1` with `· Title`, `· Subtitle` and `· Accent Bar` parented to it — exactly the structure `docs/features/TEMPLATES.md` describes. Scrubbed to 1.5 s and the text reveals behind a mask with the accent bar — it reads as a real lower third, not a placeholder. |
| 2 | Templates › one Ctrl+Z | **WORKS by hand** | Edit read `Undo MOE: Lower Third`; **one** Ctrl+Z took the layer away and the `MOE Template 1` comp was gone from the Project panel. The next undo in the stack was my own `New Composition`. |
| 3 | Templates tile previews | **WORKS** | Real drawings of each plan (Lower Third shows "Dana Ahmed", Title Card "The Big Launch"), and they play under the mouse. |
| 4 | Product UI | **WORKS (look)** | 21 pieces — Click on Layer, UI Reveal, Button Click, Toggle Switch, Search Bar, Task Done, Notification, Progress Bar, Chat Message, Stat Card — with previews that animate the way the piece is used. They look premium, not dated. |
| 5 | Shapes & Icons | **WORKS (look)** | "1,899 icons and 22 native shapes, editable in AE" — a clean icon grid, consistent stroke weight, nothing cut or mismatched. |
| 6 | Backgrounds | **WORKS** | 51 of 52 tiles ran and undid cleanly in After Effects. |

## The one thing to settle first — the undo check disagrees with the panel

The Tile Test says **no template can be undone**; doing exactly that by hand, **one Ctrl+Z undid it completely**,
comp and all (checked in the Project panel, not just the timeline). The two cannot both be right, and this matters
more than any single tool, because `CLAUDE.md` makes the Tile Test the proof before anything is called fixed:

> *Before telling the owner a fix works in After Effects, the Tile Test (Diagnostics) is the proof.*

Two readings, and I could not separate them from the outside:
1. these tools really do leave something behind, but only in the Self-Test comp the runner builds (so my hand test
   in a normal comp missed it); or
2. the runner's undo check (`tileRunner.js` presses Edit › Undo by its menu text until its census matches) cannot
   follow a tool that creates a **project item** — a comp or a solid — and reports a false failure.

Reading 2 is suggested by `backgrounds`: **51 of 52 identical-engine tiles pass**, and the one that fails
(`bg-tomato`) is the first background run, i.e. the one that creates the shared solid; the other 51 reuse it.
The same shape appears in `productui`: the three passes are the tiles that add no project item.

This is a measurement question, so I have not "fixed" anything here. It needs the owner's call on which side to
trust, and it should be settled before the 126-failure figure in Diagnostics is used to judge the product.

## Not tested in this group
Applying a Background by hand (the section sits below a long page and my scroll did not reach it), and the
Shapes & Icons insert path — only the libraries' look was judged.
