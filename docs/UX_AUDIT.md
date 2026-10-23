# UX audit — every button, v0.6.5 (2026-10-23)

**Where it ran:** the panel preview in Chromium with the mock AE host (`npm run preview`), *not* After Effects.
**How:** `node tools/audit-ui.js` clicks every visible button, tab, chip, tile and `role=button` from a known
starting state (real mouse clicks at the element's centre), double-clicks every tile (= apply), and also
clicks the controls that only appear after a click (Inspector forms, "All tools" lists, dialogs, sheets,
search results). Views with empty states were also run with data (`brand@seed`, `history@runs`,
`favorites@pins`). A layout pass checks 340 / 420 / 600 / 900 px. `node tools/audit-summary.js` writes
`dev/audit/audit.md` (not committed).

## Results

| | |
|---|---|
| Interactions | **2,495** across 19 views + 3 data variants (Shapes & Icons: 644, sampling 3 revealed icons per category) |
| JavaScript errors | **0** |
| Controls covered by something else / unreachable | **0** |
| Controls without an accessible name | **0** |
| Text clipped without a tooltip | **0** |
| Horizontal overflow at 340–900 px | **0 px** |
| Keyboard shortcuts (Ctrl K, /, Ctrl Space, ?, Ctrl 1–9, Esc) | all work |

### Bugs found and fixed in v0.6.5

1. **Search results ignored mouse clicks.** Hovering a result redrew the whole list, so the row under the
   pointer was replaced between mouse-down and mouse-up (the v0.6.2 bug class, in the search palette).
   Hover now only moves the highlight. Test: `tests/ui-stability.test.js`.
2. **Thumbnails could rest on a random or empty frame.** The first paint of every animated preview drew a
   random moment and ran *after* the still frame, so in "Calm" motion Text **OUT** cards were blank and some
   tiles froze mid-move. First paint is now the still frame. Test added.
3. **Text previews ignored Settings › Motion.** All 27 cards animated forever on their own loop (load on AE's
   CEP process). They now use the shared loop: Calm animates only the card under the mouse, 30 fps max,
   nothing off-screen.
4. **Quick Bar failures looked like success.** Errors from Quick Bar buttons were shown as neutral notices;
   now red (error) / amber (blocked) / green (done).
5. **Search "Go to…" was out of date** (old names "Motion workspace", "Comp"; Animate, Layout & Grid, Looks,
   Zoom, Shapes, Backgrounds, Deliver, Quick, Home missing). Now generated from the sidebar. Test added.
6. **Quick Bar overflow was hard to reach.** At 420 px 11 of 26 buttons are off to the right and were only
   reachable with the 4 px scrollbar; the mouse wheel now scrolls the bar sideways.
7. **Tools banner promised "every tool in one list"** — it does not list them. Copy corrected.
8. Preview fixture: layers lacked the Transform properties every AE layer has, so 60+ preview runs failed
   for a reason that cannot happen in AE. Fixed (dev only).

### Not bugs, but they cost time

- **32 tile runs failed on purpose** with a clear message: Trim needs shape layers, "On a Path" needs a
  path layer, "Follow Layer" needs a target, "2 × 2" with 9 layers has too few cells, Cursor needs Position
  keys, Open Folder needs a saved project. The user only learns this **after** clicking.
- **Apply is far away.** Distance from the top of the section to the Apply button:

  | Section | 420 px (docked panel) | 600 px | 900 px (visible height 720) |
  |---|---|---|---|
  | Animate | 2,902 px (4 screens) | 1,860 px | 701 px |
  | Expressions | 2,560 px | 1,631 px | 610 px |
  | Backgrounds | 2,695 px | 1,723 px | 831 px (below the fold) |
  | Layout & Grid | 1,751 px | 1,245 px | 786 px (below the fold) |
  | Shapes & Icons | 2,211 px | 1,591 px | 791 px (below the fold) |

- At 420 px only **8 of 37** Animate tiles are on screen; section banners take ~125 px (17 % of the panel).
- Small targets: segmented options 18 px tall, switches 28 × 16, colour swatches 16 × 16 (< 24 px).
- "Reset bar" when the bar is already default, and the two file pickers, give no visible feedback.

## Recommendations (ranked by time saved) — all shipped in v0.7.0

1. **Sticky action bar in every library** — "Slide In ← · 4 layers · [Apply] [★]" pinned to the bottom,
   like Deliver's "Create 3 comps". Apply becomes 1 click from any scroll position at any width.
2. **Show readiness on tiles before the click.** Dim tiles the current selection cannot run, reason on
   hover ("needs shape layers"); for tiles that need one input (path layer, follow target) double-click opens
   the Inspector on that field instead of failing.
3. **Search everything, run with Enter** — presets/tiles (Pop In, Wiggle, Ring, 12 Columns, palettes),
   not only the 52 tools; Enter applies the highlighted preset to the selection.
4. **Repeat last** (button in the context strip + shortcut): apply the same preset to the next selection.
5. **Visible one-click apply** — a small ▶ on the hovered tile (double-click is hidden knowledge).
6. **Group the sidebar** (15 sections + 3 utilities, icon-only under 600 px): *Animate* (Animate, Text,
   Expressions) · *Design* (Shapes & Icons, Backgrounds, Looks & Glass, Brand) · *Layout* (Layout & Grid,
   Zoom & Focus, Deliver) · *Finish* (Compositing) · *Utilities* (Quick, Select, Tools); let users hide /
   reorder sections.
7. **One pattern everywhere** — Text and Compositing use their own layouts; move them to the
   library + Inspector + action bar pattern.
8. **Banners once** — show a section banner on the first visit, then a one-line title.
9. **Compact density** — 3–4 tile columns and smaller thumbnails in narrow panels.
10. **Quick = the bar's editor** — the Quick section duplicates the Quick Bar; make it the place to edit the bar.
11. **24 px minimum** for segmented options, switches and swatches.
12. **Home for returning users** — Recent and Favorites first; the hero only on the first day.

## Re-run on v0.7.0 (after the recommendations shipped)

| | v0.6.5 | v0.7.0 |
|---|---|---|
| Interactions | 2,495 | 2,451 |
| JavaScript errors | 0 | 0 |
| Unreachable controls | 0 | 0 |
| Tile / button runs that failed | 99 (32 after the fixture fix) | 12 — all conditions only the host can see (no Position keys for the cursor, no screen colour found, project not saved); everything predictable is now explained on the tile before the click |
| Apply distance in Animate at 420 px | 2,902 px | 0 (sticky bar) |
| Animate tiles on the first screen at 420 px | 8 | 15 |

Found while building v0.7.0 and fixed: thumbnails went blank after the first re-render (since v0.6.2) because the in-place update stripped a kept canvas's width/height; hovered thumbnails froze mid-move.
