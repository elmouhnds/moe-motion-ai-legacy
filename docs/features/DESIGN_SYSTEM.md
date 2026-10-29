# MOE design system (v0.23)

The product owner asked for a complete pass on the look: icons, button style, screens, colours,
and placing tools by importance (button size, position, consistent dimensions). This page is the
rulebook; `css/tokens.css` holds the numbers and `tests/design.system.test.js` guards them.

## What was measured before (v0.22, six Classic tabs, every group open, 420 px)
| | Before | Rule now |
|---|---|---|
| Button heights | 10 different (13 · 15 · 20 · 22 · 24 · 26 · 28 · 32 · 50 · 75) | 3 control sizes **24 · 28 · 32** + the tile card |
| Icon sizes | 8 different (9 · 11 · 14 · 16 · 18 · 24 · 26) | **12 · 14 · 16 · 20** (+ 28 inside tile thumbnails) |
| Corner radius | 4 (0 · 3 · 4 · 6) | **6** controls · **8** tiles, menus, cards · pill |
| Font sizes | 6 (10.5 · 11 · 11.5 · 12 · 12.5) | **11** meta · **12** body · **13** group titles · **15** page title |
| Every tool the same size | Easy Ease looked like Purge Cache | **three importance tiers** (below) |
| Motion Rigs | dark 5-column icon-over-text tiles, unlike every other action | same row button as every action |
| Links | full-width boxed rows that look like inputs | quiet text rows with › |
| Generic icons | hand-drawn in three files, mixed metaphors | **Lucide** (ISC, already bundled) for generic UI; MOE-drawn icons only for motion ideas Lucide has no word for |

## Tokens (css/tokens.css)
- Sizes: `--h-s 24px` (compact, Quick Bar, chips), `--h-m 28px` (standard buttons, inputs, tabs), `--h-l 32px` (primary actions, group headers).
- Icons: `--ic-xs 12px`, `--ic-s 14px`, `--ic 16px`, `--ic-l 20px`. Stroke 1.5 px for every icon (MOE 16-grid at 1.5, Lucide 24-grid at 2.25 → the same 1.5 px on screen).
- Radius: `--r 6px`, `--r-lg 8px`, `--r-pill 999px`.
- Type: `--fs-sm 11px`, `--fs 12px`, `--fs-lg 13px`, `--fs-xl 15px`.
- Surfaces: `--bg` (AE panel grey, unchanged) · `--bg-raised` (buttons) · `--bg-elev` (hover, menus) · `--bg-sunken` (inputs, wells). Elevation: `--shadow-1` (resting raised controls), `--shadow-2` (menus, popovers).
- Colours keep matching After Effects (dark #232323, light, midnight) and the 8 accents; `tools/check-contrast.js` still checks every theme × accent.

## Importance tiers (where a tool sits and how big it is)
Every action group in Classic lists its tools in three tiers (data in `layoutAE.js`: `hero`, `refs`, `minor`):
1. **Primary** — the one or two things most people open the group for (Easy Ease, Reverse, Loop Cycle,
   Pre-compose, Center Anchor, Parent to Null, Duplicate Comp …): first row, **32 px**, icon in the accent colour, label semi-bold.
2. **Standard** — everything else you use often: **28 px** row buttons, two columns (one at very narrow widths).
3. **Minor** — rare or housekeeping (Trim to Keys, Select Same, Reveal Folder, Purge Cache …): last, **24 px** compact chips.

Tiers are fixed (nothing moves on its own). What *you* use shows up in ▸ Recent; your group order is yours (drag).

## Components
- **Button** (`.ae-act`): 28 px, radius 6, raised surface, 1 px line, icon 16 + label 12. `.ae-act.l` 32 px primary · `.ae-chip` 24 px minor. Not ready → 50 % opacity and the reason in the tooltip (unchanged behaviour).
- **Tile**: radius 8, 76 px card, thumbnail + 11 px label; animate tiles without artwork draw their motion (no ✦ placeholders).
- **Link** (`.ae-link`): text row with ›, no box; hover shows the line.
- **Group header**: 32 px, title 13 / 600, *for selection* pill, More link; the ⠿ grip appears on hover / focus only.
- **Tabs**: 28 px, active = text colour + 2 px accent underline; the ▾ quick-menu button is quiet until hovered / open.
- **Menus**: radius 8, `--bg-elev`, `--shadow-2`, items 28 px.
- No hover / active style changes size or position (UI rule since v0.6.2).
