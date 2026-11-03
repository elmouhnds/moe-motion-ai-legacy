# Find Fast (v0.44.0)

**The owner's rule:** an important tool is never buried behind a link, and no two tools share a name — but Home must not get crowded either. Distance = how often it is used.

## What was buried

A scan of every registered tool against every button on Home (all tabs, groups, rows, the Motion Kit, the MOE menus):

| Tool | Before | Now |
|---|---|---|
| **Select** (types, same as, all / invert / none, history) | one text link at the end of *Transform*; *Finish* menu in MOE | its own **Select** group, first in the Layer tab and the *Arrange* stage; its own first menu in MOE |
| **Text animators** (27 presets) | only on the Text page (Home had Typewriter + Counter) | **In** and **Out** rows of the everyday Arabic-safe presets + *Remove Text Animation*, one click |
| One-click buttons in **Ctrl+K** | not listed (only tools, which open a form) | every button is a one-click result; Arabic queries use the assistant's words (*حدد كل التكستات* → Select Text Layers) |
| Libraries (Animate, Expressions, Backgrounds, Looks, Layout, Zoom, Key & Color) | a shelf on Home + *All N* | unchanged — a library keeps its full list on its page |

Deliberately not moved out: rare or deep tools (Proximity, Tool Factory, Brand from website, the expression editor, grid controls — those appear in the *Your grid* panel when a grid is selected).

## Select, out front

```
SELECT
  TYPE   Text · Shapes · Solids · Nulls · Pre-Comps · Footage · Adjustment · Cam & Light
  SAME   Type · Source · Label · Name            (like the selected layer)
  COMP   All · Invert · None · Back
  → Search · labels · other comps · project      (the Select page)
```

Every button is a Quick action running `select.layers` (new: `by` = same / all / invert / none; `type` = footage = images + videos, cameraLight) or `select.step` (Back / Forward through the Selector's history — After Effects does not undo selections). So they show in Recent, repeat with F4, go on the Quick Bar and are found by Ctrl+K. *Same* without a selected layer, or *Same Source* on a layer without a source, is refused with a message and changes nothing.

## Names that looked alike

A test now compares every visible name (Quick actions, library tiles, tool names; words sorted, *centre* = *center*, *colour* = *color*): two different tools — or two different presets of one tool — may not share one.

| Before | Problem | Now |
|---|---|---|
| *Center Anchor* + *Anchor → Centre* | the same job twice (the old one did not keep keys / 3D) | merged into **Anchor → Centre** (saved bars, pins and Alt+3 migrate); the old tool is *Proximity · Anchor at Content Centre* |
| *Select Same* | not the Select page — it selects a **property** | **Same Property** |
| *Clone Keys* | next to the Cloner (*Clone Ring*, *Clone Grid*) | **Copy Keys** (Keys row: Reverse · Mirror · Copy) |
| *Repeat (radial clone)* / tool *Clone* | next to *Repeat · F4* and the Cloner | **Ring Copies** / tool **Static Copies** |
| *Look Near* · *Look from Words* · *Looks & Glass* | three meanings of "look" | **Face Near** (effector) · **Grade from Words** (beside Grade) · Looks & Glass |
| *Reveal* (project) · *Reveal* (effector) | same word, different jobs | **Reveal in Project** · Reveal |
| text preset *Typewriter* · Quick *Typewriter* | two different tools | preset **Type On** · Typewriter |

## Found by this release's audits (fixed)

- `text.animate`'s default Duration 0 (= preset) was below its own minimum 0.1, so every caller without a duration was refused — the new text buttons, and the Assistant / Copilot. Minimum is 0 now.
- A failed button said only "failed"; it now names the failed checks.
- *Your grid* scrolled itself into view whenever the host answered after Build Grid — seconds later with a slow host, moving the page under the pointer; its smooth scroll was also cut off by renders. Now one instant scroll, within 4 s of the build's start, only if nothing was pressed since.

## Checks

- `tests/findfast.test.js` (8): the Select buttons on the mock (type, footage, cameras & lights, same label, invert, all, none, Back; refusals); placement (first group, first stage group, own MOE menu, no link left in Transform); text rows are real Arabic-safe In / Out presets; **nothing important is buried** (pages with buttons on Home, key tools with a Home button); **no shared names**; Ctrl+K finds buttons in English and Arabic; a failure names its reason; the text buttons run with the preset duration.
- `node tools/audit-arrange.js` (84 screens incl. the new menu): 0 family / group / hole / cut.
