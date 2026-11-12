# Tune After (v0.79)

Owner picked ideas 12 · 13 · 14 · 15 · 16: *the numbers stay adjustable after Apply; copy a whole motion; variations; retime; stagger by dragging.*

| Piece | Where | Rule |
|---|---|---|
| Tune strip | `app/ui/retune.js`, rendered by the shell under the header in every style | restore the run's checkpoint + run again, one undo group; same selection only |
| Variations | `retune/plan.variations` | from the tool's own params; valid args; the tool's real preview (a library tile of that tool with the new numbers) |
| Stagger by drag | the strip, `staggerBars` | picture updates live; one commit |
| Retime Keys | `motion.retime` | `plan.scale`: frame grid, influence kept, speed ÷ factor; refuses when two keys would share a frame |
| Copy / Paste Motion | `motion.copyMotion` (read) → `motion.pasteMotion` | Transform keys + ease + paths + expressions; at the playhead; Position offset per layer; other dimensions skipped and reported |

Buttons: Timing › Keyframes & Loops › **Motion** row (Copy · Paste · Retime); also in Ctrl+K and the Quick Bar catalogue.

## Not verified
Mock + browser preview only. The Self-Test's new **Retime** check reads the result from After Effects.
