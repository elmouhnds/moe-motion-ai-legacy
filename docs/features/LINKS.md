# Rename-safe links (v0.62.0)

**Source:** the owner's AE study, defect **S1 (high)**. In SaaS Kit, renaming the controller null breaks every expression that reads it ("layer named … is missing"). MOE had the same weakness in 11 places:

- the Grid null (item positions and colours);
- Effectors;
- Glass and Thick Glass (the glass and its sources);
- the Clone Trail source and null;
- the Proximity null;
- the followed layer in Follow Zoom.

## How it works

1. **The permanent id beside the name.** When the host writes a MOE expression (tagged `// MOE`), every `thisComp.layer("Name")` becomes `thisComp.layer(/*MOE-LINK:<id>*/"Name")`.
   - `<id>` is the layer's own After Effects id (`Layer.id`). It never changes when the layer is renamed or moved in the stack.
   - Nothing is added to any layer: no marker and no comment.
   - The expression still finds the layer by name, so it costs nothing extra on every frame.
   - The user's own expressions (no `// MOE` tag) are written exactly as given.
   - One place does this (`U.linkCode` in `expressions.set`), so every current and future MOE expression is covered.
2. **`links.scan`** (read-only) lists every MOE-LINK in the comp:
   - which ones point at a layer whose name changed;
   - which ones point at a layer that was deleted.
3. **`links.relink`** writes the current name into every renamed link, in **one undo step** ("MOE: Relink").
   - A link to a deleted layer is reported and left as it is, never guessed.
   - Links on a locked layer are not touched.
4. **The panel does it by itself.**
   - Between two reads of the same comp, a layer id whose name changed is a rename. The panel scans, and if MOE expressions read that layer it runs Relink and shows a toast: *Relinked 16 expression(s): "MOE Grid 1" → "Hero Grid" — Ctrl+Z undoes it*.
   - With the panel closed, the expressions break as they would in After Effects, and are relinked as soon as the panel is open again.
   - Off with the setting `engine.autoRelink = false`.
5. **The Relink tool** (Expressions) runs the same repair by hand. Restore puts the expressions back.

## Checks

`tests/links.test.js` (7):

- **A Grid null renamed** to a name with quotes:
  - the break is seen;
  - Relink fixes all 16 expressions in one undo step;
  - every item's value is identical to before the rename;
  - Restore puts the expressions back;
  - `grid.update` still works on the renamed grid.
- **A deleted layer** is reported as missing, and nothing is written when nothing was renamed.
- **The user's own expressions** are untouched; MOE's are linked.
- **The rename watch:** only the same layer id in the same comp counts.
- **Every tile and tool (318):** no MOE expression names a layer without its id. Grid, Glass, Thick Glass and Proximity link in the generic run; Effectors and Follow Zoom on their own setups.

AE Self-Test: *Rename a Grid null: Relink keeps every item where it was*.

- It renames the null of a real 3 × 3 grid (through `selftest.rename`, which is allowed only on the self-test comp).
- It confirms the items show expression errors, as After Effects does after a rename.
- It runs Relink and reads every position back to within 0.01 px, then restores.

## Limits

Expressions written by MOE before v0.62 have no ids, so Relink cannot place them. Rebuilding the rig (Grid › Update, applying Glass again) gives it ids.
