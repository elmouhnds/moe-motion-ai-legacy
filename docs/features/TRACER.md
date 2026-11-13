# Tracer (v0.91)

React 3 study, item 7 of 8: "connect repeated layers with dynamic lines or grids — the tracer updates with effectors".

## What it does
Select a MOE Grid (its null or an item) → **Tracer** draws lines between its items on ONE shape layer,
`MOE Tracer · <grid name>`. The lines follow the items: the grid's own controls, effectors and springs all move them.

| Lines | |
|---|---|
| In order | one line through the items in the grid order (optionally closed) |
| Rows | one line along each row |
| Grid | rows and columns |
| Zig-zag | one line that snakes row by row |
| Hub | from the item nearest the middle to every other item |

Width, colour, opacity; *Behind the items* (default) puts the layer under them in the timeline.

## How it is built
- **Plan** (`features/grid/tracer.js`, pure): rows and columns are found from the items' measured positions (within 2 px),
  so it works for any layout, any order and a honeycomb offset. Limits: 200 lines, 600 points.
- **Layer**: `shapes.insert` — one group, one path per line, a round stroke, at the comp's origin so its space is the comp's.
- **Expression** per path (After Effects expression reference, `createPath`): each point is
  `thisLayer.fromComp(L.toComp(L.anchorPoint))` of `thisComp.layer("item")`, tagged `// MOE Tracer · <grid>` and written
  through `expressions.set`, so every item carries its permanent id (rename-safe, LINKS.md).
- **Read-back**: `props.values` now returns a path as its points (`layout.jsx plain`), and the tool checks every path has
  a point per item.
- Run it again and it replaces the grid's own tracer. Restore removes the layer.

## Tests (`tests/tracer.test.js`, 4) — mock only
The plan on a 3 × 3 (all five kinds), a shuffled order, a honeycomb, an incomplete row, the limits · on a real mock grid in
all five kinds: every point equals its item's comp position at 3 times while a Wave effector moves the items · replace,
closed line, duplicate names and no grid refused before anything is made · tiles and link ids.
The mock gained `createPath` for this.

## Honest limits
- **Not run in After Effects.** `createPath` and `fromComp` are documented expression methods, but their speed with many
  items is unknown — every path re-reads its items each frame.
- Which items a line joins is fixed when the tracer is made. Change Columns, the order or the number of items → run it again.
- Item names must be unique in the comp (the lines find items by name) — refused with the name otherwise.
- Straight lines only; a 3D grid (Globe) is traced flat, as seen from the front, not through a camera.
- Restore after a re-run removes the new tracer and does not bring the old one back (said on the card before you click).
- React 3's Snake / Zig-Zag choice on its Grid is covered by *In order* (with the grid's Snake order) and *Zig-zag*.
