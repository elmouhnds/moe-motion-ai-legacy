# Final panel layout (v0.21.0)

The product owner asked to pick the two smartest layouts among the six, develop both, compare them and choose the final style. **Decision: Classic is the final layout; MOE ★ stays as an optional alternative.** Hub, Command Bar and Workspace are retired from the menus (a user who had picked one keeps it).

Comparison page (screenshots, numbers, decision): published as an artifact; the numbers below are the same.

## Step 1 — measure all six (420 px docked panel, same comp)

| Layout | Controls above content | Room for tools | Note | Result |
|---|---|---|---|---|
| Classic | 168 px | 652 px | AE words, groups, ▾ | **final** |
| MOE ★ | 199 px | 621 px | object menus + tabs | alternative |
| Sidebar (v0.15) | 96 px | 724 px | icons only — 3 % of buttons named | old |
| Hub | 192 px | 628 px | two tab rows + strip | retired |
| Command Bar | 250 px | 570 px | least room for tools | retired |
| Workspace | 215 px | 568 px | + 77 px bottom bar | retired |

Sidebar has the most room but almost no names — the complaint the redesign started from. Classic and MOE ★ were the two finalists.

## Step 2 — develop both
- **Classic**: ▾ next to every tab (or right-click the tab) opens a two-column quick menu with every action and preset of that tab — reach anything in two clicks without leaving where you are. `Ctrl 1…6` switch tabs, `Ctrl K` search, `Esc` closes menus.
- **MOE ★**: rebuilt on top of Classic — the same tabs and twirl-down groups (the old cards and banners are gone) plus its row of menus by object (Keys · Layer · Text · Shape · Comp …), with the one for the selection lit.

## Step 3 — the same 12 everyday tasks, clicked for real
Playwright in the preview, same start (comp *HERO_Title*, keys selected, 420 px). For each task the script tried every route and kept the shortest that actually worked; clicks count only named, visible buttons.

| Task | Classic | MOE ★ |
|---|---|---|
| Easy Ease · Reverse keys · Loop · Slide In · Pre-compose | 1 each | 1 each |
| Wiggle · Align centres · Parent to Null · Ring · Screen Key · 12-column guides | 2 each | 2 each |
| Add a Background | 2 | 3 |
| **Total** | **19** | **20** |

## Why Classic
1. Same speed (19 vs 20 clicks; everything in one or two).
2. 31 px more room for the graphs and presets (one row fewer).
3. Familiar: tab names are AE's menus, groups twirl like Effect Controls, search works like Effects & Presets, ≡ like every AE panel.
4. MOE ★'s strength — menus by object — now lives in Classic as the tab ▾ menu, without a permanent extra row. At 340 px MOE ★ needs four rows of controls and its menu names get cramped.

## Code
- `app/ui/layoutAE.js`: `tabItems(app, tab)` (every action / preset ref of a tab, deduplicated), `tabMenu` (state `aeTabMenu`), tab = `div.ae-tab` > tab button (`oncontextmenu` opens the menu) + `.ae-tabmenu-btn` ▾.
- `app/ui/layouts.js`: `LAYOUTS` entries `hub` / `bar` / `workspace` carry `retired: true` (hidden in Settings, ≡ › Panel layout and the preview switcher, still rendered if selected). `moe` = Classic `build()` + `menusRow` on top.
- `app/ui/shell.js`: `Ctrl 1…6` (Classic and MOE ★), Esc closes `aeMenu` / `aeTabMenu` / `layMenu`.
