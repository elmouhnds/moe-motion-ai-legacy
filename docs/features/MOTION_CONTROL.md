# Motion Control (v0.30.0) — one block for how it moves and where it sits

## The brief
The owner: the anchor point is a tiny cube and align is a row of small buttons — merge them, in a way that
fits each style, **inside the speed / value graph control**. A tool's space should follow its content: how
big it really is, where it can be merged, how its place can be used. That part should also **copy the ease of
keyframes and paste it** (like aescripts *Ease Copy*). And order our tools **by what they do and the sequence
of the work**, not by their names.

## Space follows content
| Part | What it really is | Space it gets |
|---|---|---|
| Speed / value graph | a working surface you drag | grows with the panel (value + speed side by side when wide) |
| Anchor point | 9 dots + Masks | a 3×3 of 24 px dots in a rail beside the graph |
| Align | 2 rows of 5 icons + Sel / Key / Comp + gap | under the anchor in the same rail |
| Ease tools | Easy / Linear / Hold · Copy / Paste / Flip | one icon row under the graph |
| Curve presets | small curve faces | one chip row |

Narrow panel (< 400 px): the rail drops under the graph and anchor + align sit side by side. **Folded**
(click the title): the compact strip — the curve, what it was read from, Copy / Paste ease — and anchor +
align in one row, so a docked panel keeps every placement tool for ~90 px of height.

## Where it lives (one place per style)
- **Bento**: NOW, first thing, for any selection (nothing selected → no block; NOW is then about creating).
- **Glass**: the Now card, under its header.
- **MOE**: on top of every tab, above the groups.
- **Docked Motion Kit** panel: the same block, then the tools.
The separate *Ease*, *Align* and *Anchor Point* groups are gone from the tabs and the stages (tested).

## Ease Copy
- **Copy** reads the ease of the selected keys **segment by segment** (the graph already reads them from AE)
  and keeps it normalised (curve shape: influence and slope), so it fits any property and any distance /
  duration — like Ease Copy. With no keys selected, Copy takes the curve on the graph.
- **Paste** (`motion.pasteEase`): segment *n* of the target keys gets curve *n* of the copy; a shorter copy
  repeats (one copied segment = the same ease everywhere); a copied **hold** segment is left as it is. *In /
  Both / Out* applies (ease in only, both, ease out only). Speed is recomputed from each target segment's own
  move (tested: 0.1 / 0.25 × 100 px/s = 40 px/s), exactly like the Ease Curve tool — same engine, same verify
  by read-back, same History › Restore.
- The copy is kept in the panel settings (both panels share it), so you can copy in the main panel and
  paste in the docked Motion Kit.

## Ordered by the work: Next
After a tool runs, NOW (Bento), the Now card (Glass) and the top of the tab (MOE) show **Next** — the steps
that usually follow it in a motion designer's job, one click each:

| After | Next |
|---|---|
| Animate in / out | Out Expo (shape the ease) · Stagger · Fade Out · Pre-compose |
| Draw On | Out Expo · Stagger · Erase · Wiggle |
| Ease (Easy / curve / paste) | Stagger · Loop Cycle · Mirror · Reverse |
| Stagger | Fade Out · Pre-compose · Parent Null · Delay |
| Anchor | Pop In · Spin In · Pendulum · Pulse |
| Align | Distribute · Parent Null · Cascade In · Grid |
| Grid | Cascade In · Stagger · Pre-compose · Punch-in |
| Parent to Null | Float · Delay · Pop In · Pre-compose |
| Typewriter | Fade Out · Apply brand · Counter · Stagger |

Fixed lists (memory), at most four, every ref checked by tests (`workflow.NEXT`).

## Honest limits
- Tested on the AE mock and the preview, not inside After Effects (TEST_REPORT 173–175).
- Ease Copy copies the curve **shape** (normalised), not absolute speeds: the same feel on a short and a
  long move. A Position overshoot is limited to 0 speed exactly like the Ease Curve tool (reported).
- The copy holds up to 24 segments.
