# Library pages — space follows content (v0.32.0)

## The brief
After v0.31 (every tab sized by what it holds) the owner asked to continue with the library pages.

## What the analysis found (420 px)
| Page | Problem |
|---|---|
| Every library | the **Inspector sat under the whole library**: on Motion (33 tiles) the settings of the tile you clicked were ~1,100 px down; the sticky bar had to offer a "Settings" jump |
| Motion | **33 tiles at once** — In and Out are the same moves played the other way; 7 **ease** tiles repeated the Motion Control's curve presets; 9 filter chips on two rows |
| Layout & Grid | three different jobs in one wall: lay layers out (9), guides on the comp (3), split-screen cells (3) |
| Compositing | tools whose tile is only an icon took 70 px each, names cut, no word on what they do; one tile alone on the last row |
| Backgrounds | 17 filter chips on **three rows** before the first palette |
| Every grid | a tile alone on the last row (7, 8, 14, 32 tiles); the "Click to inspect · ▶ applies now…" line on every page, forever |
| Shapes & Icons | the icon settings and **Insert** under 96 icons |
| Quick Bar (Customize) | 41 actions as 60 px picture tiles in three columns, a gap at the end of every group |

## What changed
- **Settings where you click.** From 600 px (was 760) the Inspector sits beside the tiles. Narrower, clicking a
  tile opens its settings **right under that tile's row** (click it again, or ✕, to close); the sticky bar's
  *Settings* opens / closes it there. No second big picture inline — the tile is right above. Same in
  **Shapes & Icons** (icons and native shapes).
- **Modes instead of a wall.** Motion: **In · Out · Draw On · Proximity** (12 / 8 / 4 / 2 tiles instead of 33);
  the ease presets are one click away as *Ease ›* (they live in the Motion Control; search still finds them).
  Layout & Grid: **Arrange · Guides · Cells**. Search looks through every mode.
- **Icon-only tools are rows** (Compositing): icon, name and what it does on one line, *setup* in the line.
- **Filters on one line**, *Mine* right after *All* (Backgrounds: 1 row instead of 3).
- **Columns fit the count** (4 → one row of four, 8 → 4 × 2, 32 → 4 × 8); two columns on a docked panel.
- The how-to line under the tiles goes after three applied presets.
- **Quick Bar · Customize**: each action is a one-line row with its ★, two columns at 420 px.

## Honest limits
- Tested on the mock host and the preview (300 / 420 / 700 px), **not inside After Effects**.
- A page's open / closed settings are per session (not saved).
- Text keeps its own page (it already had In / Out and a single preview row); Deliver, Brand, Select and My Tools
  were already sized by their content.
