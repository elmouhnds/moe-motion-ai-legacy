# Smart Arrange (v0.43.0)

**The owner's rule:** tools an artist uses one after the other sit next to each other. Flip Horizontal is right beside Flip Vertical — never two rows apart — and nothing from another group lands in between. Checked everywhere, in every style, at every panel width.

## What was wrong

- **Bento** packed its tiles with `grid-auto-flow: dense`: any gap was filled with whatever tile fitted. *Parent chain* jumped from *Parent & Link* into the *Transform* group, and Flip H / Flip V ended up on different rows. Bento also ignored the declared pair (Flip = one control in Classic).
- **Classic / Glass / MOE** rows are wrapping grids: at some widths a pair broke over two lines.
- **Data:** the MOE *Layer* menu had Flip H without Flip V and Distribute H without V; the Quick Bar had Flip H alone; Reverse and Mirror keys were split by Stagger; Glass's NOW strip had Loop Cycle and Ping-Pong apart.

## How it works now

`app/ui/arrange.js` (pure, tested) knows the **families**: Flip · Align · Distribute · Anchor · Easy / Linear / Hold · Curves · Reverse / Mirror / Clone keys · Loop · Fade In / Out · Pop · Trim (Draw On / Erase / Travel / Both) · Parent · Project · Text · Guides · Zoom · Clean up (Bake / Trash).

- `group(refs)` keeps a family together at the place of its first member (stable, nothing else moves).
- `runs(refs)` cuts a list into runs; a run is drawn as one box (`.fam`) that moves to the next line as a whole and, when the panel is too narrow for it on one line, wraps inside its own box (2 + 2) — words are never cut.
- `pack(items, cols)` places Bento tiles: order kept, a family never split over two rows, **every row filled** (the tiles of a short row grow) — no holes, so nothing can drift in from another group. Spans for 4 and 2 columns (`--s4` / `--s2`); the grid has no dense flow any more.

### Per style

| Where | Now |
|---|---|
| Bento | A declared pair is **one tile**: the family's icon and name on top, the two halves as words (*Flip — Horizontal · Vertical*). Families together, rows full, tiles stay under their own caption. NOW sits by family too (Fade In next to Fade Out). Long names take two lines (three at 400–560 px) instead of an ellipsis. |
| Classic · Glass · MOE groups | Primary and standard rows flow; a family is one unbreakable box. Reverse / Mirror / Clone became a labelled **Keys** row (like Loop); Parent Null and Parent chain are both primary. A labelled row of three stays on one line; four become 2 + 2 when narrow. |
| MOE menus | Families together (Anchor, Align, Distribute, Parent, Flip …), boxed; Layer gained Flip V and Distribute V. |
| Glass NOW | The eight best actions sit by family. The **pie** keeps its fixed positions (direction is the memory). |
| Quick Bar (new installs) | Alt+1…0 unchanged; after them Mirror and Ping-Pong come first (next to Reverse and Loop), the moves together, Flip H + Flip V, then layers, text, project. Saved bars are not changed. |

## Nothing moves while you aim

The *Next* row in Bento's and Glass's NOW used to appear above the tiles after a run, disappear after a tool with no follow-up, and change height with its number of buttons — the tiles under the mouse moved. It is now one line of fixed height (like Recent), **below** the tiles, shown once anything has run; after a tool with no usual follow-up it reads *Last: <tool> · Repeat · F4*. Below 400 px a labelled row puts its label above the buttons.

## Checks

- `tests/arrange.test.js` (5): the engine (group / runs / splits; `pack` on 400 random lists for 1–6 columns: order kept, every row full, a run on one row, tiles never shrink; the owner's Transform example); **every button list of the UI data** (Classic / Glass / MOE groups by tier, tile groups and modes, MOE menus, Kit groups, Quick Bar) keeps its families together and never spreads one family over two importance tiers; opposites come whole (Flip, Distribute); Bento has no dense flow and renders pairs.
- `node tools/audit-arrange.js` — the panel **on screen** in Chromium: Bento, every Glass space, every MOE tab, every MOE menu and the Motion Kit at 340 / 420 / 600 / 900 px (80 screens), every group opened. Rules: *family* (members next to each other on one row, or inside one box), *group* (a Bento tile under its own caption), *hole* (every Bento row full), *cut* (a label shorter than its text), JS errors. Result v0.43: **0 / 0 / 0 / 0 / 0**.

## Rules for new tools

A new tool that belongs to a family goes into `FAMILIES`; a new opposite pair is declared as a group `pairs` entry and in `FAMILIES`. Run `node tools/audit-arrange.js` after any layout change.
