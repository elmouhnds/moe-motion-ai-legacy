# Smart Home (v0.15) — study and design

Why: the owner rejected the v0.14 arrangement ("not smart in distribution and organisation"). The
problem was not the look of one block but the **structure**: Home stacked the same blocks in the same
order whatever was selected (Ease → Anchor/Align → Pinned → "For this selection" → Recent/Favorites →
greeting → Start with → tip), and the same actions appeared in four places (Quick Bar, pinned tools,
"For this selection", Toolbox).

## What the references do
- **After Effects' own Properties panel (2024+)** shows only the properties of what is selected —
  the panel follows the selection.
- **Contextual toolbars** (Adobe panel UX patterns, SAP / Unity design guides): show only the actions
  useful *now*, do not repeat the full toolbar, disable instead of hiding when a layout must stay put,
  avoid layouts that jump around.
- **Motion 4 / Motion Studio**: one Home with the few tools used most + a user-pinned set; everything
  else one click away (Toolbox / library).
- **CEP reality**: AE has no selection-change event; MOE already polls lightly (paused during presses)
  and knows the selection kind (`actions.profile`: keys · text · shape · shapes · layer · layers · none).

## Rules
1. **The selection decides the top of Home.** One *focus* card names what is selected and shows the
   tools that make sense for it — nothing else competes with it.
2. **Stable zones, changing content.** The order of zones never changes: Focus → Your tools (pinned) →
   More (folded) → Recent. Only what is *inside* Focus changes with the selection.
3. **Each action lives in one place on Home.** Curated rows per selection kind, no duplicates between
   rows; the pie keeps its own 8 (muscle memory), the Quick Bar stays the global strip.
4. **Folding is remembered per selection kind.** Open Anchor while working on layers and it stays open
   for layers, without cluttering the keyframe view.
5. **Fixed mode for those who want it**: Home › ⋯ › *Layout: Fixed* gives the v0.14 order back.

## Focus per selection
| Selection | Focus card |
|---|---|
| Keyframes | Ease (value + speed graphs, segments, presets) · Keys (reverse, mirror, clone, stagger, trim) · Loop |
| One layer | Animate in · Animate out · Rig (Excite, Wiggle, Swing, Spin, Orbit, Float) · Anchor + Align |
| Several layers | Cascade in · Arrange (grid, ring, honeycomb, spiral) · Link (null, parent, delay, stare) · Anchor + Align |
| Text | Text in (typewriter, rise, cascade, fade, counter) · Text section / Brand · Anchor + Align |
| Shape(s) | Draw (draw on / erase / travel / both) · Motion (repeat, wiggle, pop, spin) · Arrange (several) · Anchor + Align |
| Nothing | Create (shapes & icons, backgrounds, guides, safe areas, text) · Find (search, Copilot) · Start-with cards for new users |

Blocks that are not in focus (e.g. Anchor + Align while keys are selected) stay one click away under
**More**, folded, with a one-line summary.
