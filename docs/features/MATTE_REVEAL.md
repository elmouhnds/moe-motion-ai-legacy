# Matte Reveal (v0.95)

The owner asked for the alpha-matte reveal look of SaaS videos, with several mattes and several styles for revealing shapes and objects. The reference links were three SaaS tutorials: click effects (ripple / pixelated reveal / particles), "premium" SaaS animation (text reveals, card transitions, outlines), and trending SaaS UI moves. Only their titles, descriptions and chapters could be read here, not the videos themselves.

## What it does
Select layers → **Matte Reveal** (tool `reveal.matte`, Motion › *Matte* filter, SaaS kit step "3b · Matte reveals").

For each layer, MOE:
1. makes ONE shape layer `MOE Matte · <layer>` of white cells, right above the layer;
2. parents it to the layer with an identity transform (`setParentWithJump`, which keeps those values), so the cells are drawn in the layer's own space (`sourceRectAtTime`) and the matte **follows the layer** if it moves;
3. sets it as the layer's **Alpha Track Matte** (`Layer.setTrackMatte`, After Effects 23+) and switches its video off;
4. keys the cells (group Scale / Position, rectangle Roundness) from the plan;
5. optionally adds `MOE Matte Soft` (Gaussian Blur) on the matte for a soft edge.

All of it is ONE host call: one Ctrl+Z (docs/features/ONE_UNDO.md). Restore removes the track mattes and the matte layers in one step.

## Styles (`features/reveal/mattePlan.js`, pure)
| Style | Cells | Motion |
|---|---|---|
| Wipe | 1 rotated rectangle | an edge sweeps along any of 8 directions (sides + diagonals) |
| Corner | 1 | grows out of a corner |
| Split | 1 | opens from the middle line (horizontal / vertical) |
| Iris | 1 ellipse (the box's diagonal) | opens from the centre |
| Card | 1 rounded rectangle | grows from a pill into a card (Roundness keyed) |
| Blinds | N bars | each bar wipes in; cascade; optional alternate sides |
| Stripes | N bars | slide in from alternate sides |
| Shutter | N slats | each opens from its own centre |
| Pixels | cols × rows blocks (≤ 200) | pop in by order: in order, reverse, centre, random, diagonal |

Every style has In (reveal) and Out (hide). *Cascade* (0–0.9) overlaps the cells in time inside the Duration. *Stagger* + *Layer order* (screen order, measured) spread several layers.

## Rules
- The plan is the reference. The tool writes its keys, the tile preview draws it (`thumbs.js matte`, a clip of the same cells), and `coverage()` measures the share of the layer that shows. The read-back compares After Effects' own values of every cell, at the first and last written key, with the plan through `coverage()`.
- A layer that already has the user's own track matte is **skipped and named**, never changed. A MOE matte is replaced in the same step. 3D layers are skipped (not supported yet). If nothing is usable, nothing is written.
- Reads first (`layers.rects`: rect, 3D, current matte — changes nothing; `layers.bounds` only for a screen-order stagger), then one plan.
- The matte layer's name starts `MOE Matte`. `shapes.matte` refuses any other name; `layers.remove` uses `onlyNamed: 'MOE Matte'`.

## Tests
- `tests/matte.reveal.test.js` (mock):
  - every style × options, In and Out: 0 % → 100 % (Card ≥ 97 %, its round corners);
  - directions and cascade timing;
  - the tool: one undo step, the alpha matte, the parent, hidden, right above, keys equal to the plan, Restore in one step;
  - the user's matte and 3D layers are skipped; a MOE matte is replaced; nothing usable means nothing written;
  - a read is no undo step; a matte not named MOE is refused.
- Self-Test `matte`: in After Effects, Pixels half-way. The track matte must be the MOE matte, and the share After Effects shows must equal the plan within 3 %; then Restore.
- The mock does not render. That the picture really shows through the matte is for the owner's run in After Effects (and the Self-Test).
