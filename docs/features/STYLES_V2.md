# The three styles, studied again (v0.25): Bento · Glass · MOE

The owner kept three styles (Classic, Apple and the old Sidebar are retired from the lists; a user who had one
keeps it) and asked to study them again with all their tools, plan them properly and upgrade each one.
**Bento is the default.** Choose in Settings › Panel style, ≡ › Panel layout, or the preview toolbar.

## What every style holds (the same tools in each)
| | Count | Where it comes from |
|---|---|---|
| Registered tools | 66 | `features/index.js` (+ `brand.fromSource` in v0.25) |
| Tabs × groups | 6 × 28 | `layoutAE.TABS` (Keys · Animate · Layer · Design · Effect · Comp) |
| Actions + presets placed in groups | 96 | refs / tile ids of the groups (tiers: primary · standard · minor) |
| Quick actions | 80 (25 on the default Quick Bar) | `quickbar.ACTIONS`, `bar.DEFAULT_BAR` |
| Menus by object | 9 | `layouts.MENUS` (Keys · Layer · Text · Shape · Comp · Design · Layout · Finish · AI) |
| Library presets | 139 | `studio/sections.js` (motion, text, shapes, backgrounds, layout, zoom, looks, compositing…) |

Every group keeps ONE place per style (tests in `tests/layouts.test.js`): Bento shows all 28 on one page,
Glass spreads them over four spaces, MOE keeps the six AE tabs.

## Bento (default) — one page, size = importance
- **Strengths**: the main tool for the selection is on top with no click (ease graph / Align / Anchor); tile size says
  importance; 18 clicks for the ten everyday tasks with the least scrolling (543 px) of the new styles.
- **Weak spots found**: long page; the accent glow was fixed to orange; the index did not show where you were.
- **v0.25 upgrades**: *Pin to NOW* (right-click any tile, up to 4, they sit first in NOW); *fold a section* by its
  title (remembered) to shorten the page; the index **follows your scroll**; glows follow the accent colour.
- **Next**: drag tiles inside NOW; a compact density for 300 px panels; "show only what fits the selection" filter.

## Glass — four spaces by stage of work
- **Strengths**: the most striking look; Motion · Arrange · Look · Deliver match how a job progresses; the Now card.
- **Weak spots found**: the colour field was fixed to orange; backdrop blur may cost frames inside AE; the Now card
  takes height on every space; no keyboard way between spaces.
- **v0.25 upgrades**: the field follows the accent colour; **Settings › Glass blur** on / off; the Now card **folds**
  to one line (its two primary actions stay); **Ctrl+1…4** switch spaces (shown on the capsule).
- **Next**: per-space recent strip in the capsule; reduce motion of the field when AE renders.

## MOE — AE tabs with every shortcut in a sidebar
- **Strengths**: After Effects words (Keys · Animate · Layer · Design · Effect · Comp) with twirl-down groups; Ctrl+1…6.
- **Asked by the owner**: put **all shortcuts in a sidebar** instead of the two rows on top.
- **v0.25 upgrades**: a **sidebar** with the 9 menus by object (the one for the selection lit; opens beside the
  sidebar) and **the whole Quick Bar** (no "+N"); **⇔** shows names (remembered); right-click a shortcut for its
  options; *Customize* opens the Quick Bar editor. The top keeps only the tabs and search — two rows freed.
- **Next**: drag to reorder shortcuts in the sidebar; pin a group of the current tab to the sidebar.

## For all three
- **Brand from website / PDF** (docs/features/BRAND_IMPORT.md) — Brand › *From website / PDF*.
- Same search (Ctrl K), ≡ panel menu, pie (Q), F4, Copilot, Recent memory and tiers in every style.
