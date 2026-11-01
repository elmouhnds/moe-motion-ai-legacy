# Space follows content — every tab (v0.31.0)

## The brief
After v0.30 the owner asked to continue with the same approach for **everything else in the plugin**:
analyse every remaining tool, give each the space its content needs, merge what does the same job, and order
by function and the sequence of the work.

## What the analysis found (420 px, MOE, every group open)
| Where | Problem | Cost |
|---|---|---|
| Top of every tab | the full Motion Control graph (~690 px) even with no keys selected, even on Design / Effect / Comp | a whole screen before the tab's own tools |
| Every tab | an empty **Recent** row with a hint | ~70 px × 6 tabs |
| Animate | **Animate In** and **Animate Out**: the same six moves played the other way, as two groups of big tiles | ~370 px |
| Animate | **Draw On**: four tiles in a three-column grid → one tile alone on a row | one empty row |
| Animate | **Motion Rigs**: Excite = the Inertia expression, Jump = Bounce Land (both "with sliders"), Delay and Stare also in Parent & Link | 5 buttons, 4 of them copies |
| Keys | **Keyframe Assistant** repeated Easy / Linear / Hold (in the Motion Control row); **Loops** a separate group of 4; **Curve Library** a copy of the ⊞ chip in the Motion Control | 3 groups |
| Layer | **Center Anchor** = the centre dot of the anchor grid; Flip H / Flip V two full buttons; **Select & Clean up** = one Trash button + one link | 1 group, 3 buttons |
| Effect | **Keying**: one tile in a row of three; **Color Correction**: 3 + 1; tool tiles whose picture is only an icon (70 px each); **Stylize**: one Vignette button + a link to Looks (already in Design) | 2 extra groups, half-empty rows |
| Comp | **Deliver**: one link as a group; **Quick Bar & My Tools**: two rare links as a group | 2 groups |

## What changed — 25 groups → 15
| Tab | Before | After |
|---|---|---|
| Keys | Keyframe Assistant · Loops · Curve Library | **Keyframes & Loops** — Reverse and Stagger first, Mirror / Clone, a *Loop* line (Cycle · Ping-Pong · Offset · In + Out), Trim keys / Select Same as chips |
| Animate | Animate In · Animate Out · Draw On · Text · Motion Rigs · Expressions | **Animate In / Out** (one switch *In · Out · Draw On* above one strip; a shape selection opens on Draw On; your choice is kept) · Text Animators · **Expressions** with a **Sliders** switch (numbers on Slider Controls — what Excite and Jump did) |
| Layer | Transform · Parent & Link · Arrange · Select & Clean up | **Transform** (Pre-compose, Separate XY, **Flip ↔ │ ↕** as one control, the Select page) · Parent & Link (Null, chain, Delay, Stare) · Arrange (+ Repeat) |
| Design | Shapes · Backgrounds · Looks · Brand | unchanged (already sized by content) |
| Effect | Keying · Color Correction · Camera & Zoom · Stylize | **Key & Color** as buttons in the job's order (Screen Key first, then Analyze, Match, Grade, Look from Words) · Camera & Zoom (+ Vignette) |
| Comp | Guides · Deliver · Project · Quick Bar & My Tools | Guides & Safe Areas · **Deliver & Project** (Every format at once first, Dup Comp, Reveal, Open Pre-comp; Open Folder / Purge / Trash MOE rigs as chips). Customize Quick Bar and My tools are in the ≡ menu |

And for all tabs:
- **Motion Control follows the selection**: keys selected → the full graph with the rail; layers only →
  the compact strip (curve · Copy / Paste ease · anchor · align, ~200 px instead of ~690). Open or fold it
  yourself: remembered per kind of selection. Nothing selected → no block (unchanged).
- **Recent shows only when it holds something.**
- **Tile grids take as many columns as fit the count** — 4 tiles in one row of four, 6 in 3 × 2, 9 in 3 × 3;
  on a wide panel 6 in one row; on a docked panel two columns. No tile sits alone on a row.
- Small groups on a docked panel hide the "for selection" badge so the group name is readable.

The stages (Bento, Glass) follow the same groups: Animate = Animate In / Out → Keyframes & Loops → Text →
(more) Expressions; Arrange = Transform → Parent & Link → Arrange → (more) Guides; Finish = Key & Color →
Camera & Zoom; Deliver = Deliver & Project.

## Nothing was lost
Every tool is still one click away (tested: every ref resolves, and no tool appears twice in the tabs):
Easy / Linear / Hold, the anchor, align and the curve library are in the Motion Control; Excite / Jump are
Inertia / Bounce Land with *Sliders* on (and stay in the Quick Bar catalogue and the docked Motion Kit);
the Select page is a link in Transform; My tools is in the ≡ menu and Ctrl+K.

## Honest limits
- Tested on the mock host and the preview (Bento, Glass, MOE at 300 / 420 / 700 px), **not inside After Effects**.
- A saved group order (drag) that named a merged group simply ignores the old id; the merged group keeps its default place.
