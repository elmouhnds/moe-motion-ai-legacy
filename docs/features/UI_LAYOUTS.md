# Panel layouts (v0.16) — three proposals you can switch between

Why: after the v0.15 Smart Home the product owner asked for a deep study of the big After Effects
tools (Motion 4 / Motion Studio, MoBar, KBar, Motion Tools Pro, Duik, AE's own Properties panel and
Quick Apply) and three proposals for arranging MOE's 64 tools, 80 quick actions and ~140 presets.
Research notes: `research_notes/تنظيم واجهات إضافات افتر افكتس/`; report: `reports/تنظيم واجهات إضافات افتر افكتس.md`.
Then: "a live preview of each proposal, properly organised" — so the proposals are real layouts of
the same panel, not mock-ups.

## What the research says (short)
- **Fixed beats adaptive** when items move: users learn positions (Findlater & McGrenere 2004).
  Adaptive areas help only when they **copy** items and the originals stay put (split menus, Sears &
  Shneiderman 1994: 17–58 % faster; Gajos et al. 2006).
- The successful AE tools cap the always-visible area (KBar / Motion Mini / MTP: ≤ 4 bars) and put
  everything else one click away by **object** (MoBar) or by **screen** (Motion 4).
- AE 2024+ itself follows the selection (Properties panel) and adds Quick Apply (26.2) — search is
  first-class.

## The rule all three share
Every tool has **one home** in each layout. Context areas (the strip, the highlighted menu, the
context bar) only **copy** actions for what is selected — they never move a tool. Every section of
the panel is reachable in every layout (`tests/layouts.test.js`).

## 1 · Hub (Motion 4 style)
- **Screens** in a top tab row: Home · Ease · Toolbox · Library · Design · Finish.
- **Home** never changes: Ease graphs, Anchor + Align, your pinned tools, Recent.
- A slim **For this** strip copies six actions for the selection (the pie's set).
- Library / Design / Finish have their own sub-tabs; the last one opened is remembered.

## 2 · Command Bar (MoBar + KBar style)
- One row of **menus by object**: Keys · Layer · Text · Shape · Comp · Design · Layout · Finish · AI.
  The one that fits the selection is **highlighted** (nothing moves). Menus on the right half open
  towards the left; Esc closes.
- Up to three named **bars** you edit (Animate · Rig · Layer by default, store `cmd-bars`).
- Below: **Ease** (graphs + anchor + align) and **Toolbox** as panels; a section opened from a menu
  appears as a third tab.

## 3 · Workspace (AE Properties style, made stable)
- A **context bar** with the 8 actions for the selection (hide with ×, bring back from the header).
- Four **task tabs** with a fixed order: **Animate** (ease, anchor + align, motion rigs, keyframes,
  then Motion presets · Text · Expressions), **Design**, **Layout**, **Finish**. A card opens its
  section inside the tab; the crumb goes back.
- **Your bar** at the bottom: pinned tools, F4 (repeat last), ★ to edit pins.

## ★ MOE — the recommendation (v0.17)
Asked "show me your proposal", this is the one to make the default. It keeps the strongest part of
each proposal and drops what costs height or moves:

| Row | Taken from | Why |
|---|---|---|
| **Menus by object** — Keys · Layer · Text · Shape · Comp · Design · Layout · Finish · AI, the one for the selection lit | Command Bar (MoBar) | Context **without moving anything**: one orange word instead of a strip that changes. Every quick action is one click + one click away, grouped by what it acts on. |
| **Your bar** — the Quick Bar, one fitted row, +N for the rest | Hub (KBar / Motion Mini) | One user-owned bar beats three: the references cap visible bars, and the panel is docked. |
| **Four task tabs** — Animate · Design · Layout · Finish, cards + crumb | Workspace | Fixed order = positions you learn (Findlater & McGrenere); libraries open in place. |

Dropped on purpose: the Hub's *For this* strip and the Workspace's context bar (the lit menu does
their job — two context areas would repeat the same actions), the Command Bar's extra bars and the
Workspace's bottom bar (height). F4 sits next to the title after a run; Ctrl K, the pie and F4 work
everywhere. Three rows above the content at any width from 340 px.

## Where to switch
- **Settings › Appearance › Panel layout**: Current · Hub · Command Bar · Workspace · **MOE ★** (`ui.layout`).
- The web preview has a **Layout** switch and links `#p1` (Hub), `#p2` (Command Bar),
  `#p3` (Workspace), `#moe` (the recommendation — the preview opens on it), `#current`.

## Fitting a docked panel (340–640 px)
Crowded tab rows keep the icon only (or only the open tab's icon); menus share one row; context
actions wrap to two lines, or become 4 small tiles per row below 400 px; the Hub strip becomes a
3-column grid. Checked in the preview at 340 / 420 / 640 px with the three demo comps: no row
overflows, no button leaves the panel.

## Code
`app/ui/layouts.js` (`build(app, s, layout, body)` → `{ top, title, content, bottom, overlay }`),
`shell.renderLayout`, CSS block "v0.16 layouts" in `css/app.css`. Rendering only — every button
runs the same tools / actions as the current layout (`actions.resolve` + `ready()`).
