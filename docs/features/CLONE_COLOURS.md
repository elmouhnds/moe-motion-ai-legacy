# Clone Colours (v0.34.0) — a colour for every clone, effectors that tint

## Why
The owner's direction since v0.33: advanced tools for professional results (after aescripts mCloner Pro).
After cloning and effectors, the next thing a MoGraph-style cloner needs is **colour per clone**, and
**effectors that change colour**, not only position / scale / rotation / opacity. Cinema 4D does this with the
Cloner's colour fields and the Plain effector's colour; MOE does it with live controls in After Effects.

## What it does
### `grid.colour` — Clone Colours
Select a MOE Grid (its null or an item) and pick a mode and a MOE palette:
- **Cycle**: Colour 1, 2, 3, 4, 1, 2… in the grid's order.
- **Gradient**: from Colour 1 on the first item to Colour 4 on the last (three blends between four stops).
- **Random**: each item picks one of the four (Seed).

The grid null gets **Colour Mode**, **Colour 1–4** (Color Controls, the palette's four accents — change them in
Effect Controls and every item follows live) and **Colour Seed**. Every item gets one **MOE Clone Colour** Fill
effect whose Color is an expression reading them by the item's own slot. Run it again to change mode or palette:
updated in place, never duplicated. Restore removes the Fills and the grid's colour controls.
Tiles (Layout & Grid › Clone, Layer › Arrange · Clone · Effectors › Clone): **Colour Cycle · Colour Gradient · Colour Random**.

### Effectors get Colour + Colour Mix
Every MOE Effector now has **Colour** and **Colour Mix** (0–100 %). The items its falloff reaches blend toward
that colour by *falloff weight × Colour Mix* (Sphere, Linear, Box, Everywhere, Invert and Strength all count, same
maths as the moves). Effectors made in v0.33 have no colour controls and are simply left out of the colour.
New tiles in Effectors: **Tint** (a white sphere that sweeps across) and **Shrink** (sphere, −70 % scale).

## How it is built
- `features/grid/effectors.js`: `paletteColour(mode, pal, i, n, seed)` and `colourWithEffectors(base, effs, cx, cy)`
  are the reference; `colourCode(i, n, grid)` writes the same maths as the Fill colour expression (tag
  `// MOE Clone Colour`). Random uses the `hs` sine hash (like the Random effector).
- `features/grid/colourTool.js`: grid controls via `effects.ensure` (Color Controls + menu), one Fill per item,
  expressions, read-back against the reference; checkpoint = effect checkpoint + previous expressions.
- `features/grid/effectorTool.js`: Colour / Colour Mix controls (`X.KIND.color`), an effector with only a colour
  is valid.

## Tests (`tests/clone.colour.test.js`, 4)
Mock-evaluated Fill colours equal the reference for Cycle, Gradient and Random, and follow a live change of
Colour 1; a Tint effector (sphere with a soft edge, and a linear sweep at three times) tints exactly by the
reference; running twice keeps one Fill per item; restore removes Fills and controls; refused without a grid.

## Honest limits
- Tested on the mock host and the preview, **not inside After Effects**.
- Fill recolours the whole layer (all of a shape's or text's colours become one) — the right look for clones;
  for multi-colour artwork, keep Clone Colours off.
- The colour reads the item's position from AE (`toComp`), so it follows hand nudges too; the mock is 2D.
