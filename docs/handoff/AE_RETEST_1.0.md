# Retest MOE Motion AI 1.0.0 in After Effects — side session brief

Owner speaks Egyptian Arabic: report to them in Arabic. Same rules as `MANUAL_TEST_COMPUTER_USE.md` (never the owner's
projects; a scratch project `MOE Manual Test.aep`; screenshots; exact error texts; fixes on a branch, never `main`).

## 0. Version
Quit After Effects → install `MOE-Motion-AI-Setup-1.0.0` → open After Effects → MOE Motion AI › Diagnostics must say
**1.0.0**. Stop if not.

## 1. The pie's search (inside the panel)
1. Select a layer. Hover the panel, hold **Q** → the pie. Release in the centre: it must STAY open with the search box
   focused (no forced choice). Click ✕: it closes, nothing ran (check the timeline + Edit menu's Undo text).
2. Tap Q, type `gauss` → *Gaussian Blur · Effect* → Enter: the effect is on the selected layer, ONE Ctrl+Z removes it.
3. Tap Q, type `gauss`, **Ctrl+Enter** → a new adjustment layer "Gaussian Blur Adjustment" above the selection with the
   effect; one Ctrl+Z removes both.
4. Type a preset name you know from Effects & Presets › Animation Presets (e.g. a Text preset) → Enter on a text layer.
   Then one from your User Presets if any. Report the category path shown.
5. Type `trim` → *Trim Comp to Work Area · Menu* → Enter. Type `pre-comp` → Pre-compose: does After Effects' dialog
   open? List which menu commands appear at all (the list only shows names After Effects answers).
6. Type `anchor`, `fade`, `grid` — MOE's tools and presets must appear in the same list. Arabic: `تلاشي`.

## 2. MOE Quick over After Effects
1. Window › Extensions › **MOE Quick** — a small floating window with the pie: does it open, where, can it be moved,
   does it close after a pick and after ✕?
2. With MOE Motion AI open (docked anywhere), click the TIMELINE (not the panel) and press **Ctrl+Alt+Space**.
   Does MOE Quick open? Settings › Pie menu › "Anywhere in AE" says Listening / Not listening — copy the exact text.
   Try it with the viewer focused, and with another app in front (it must do nothing there).
3. Edit › Keyboard Shortcuts: search "MOE Quick" — can a shortcut be assigned to Window › Extensions › MOE Quick?
   (Answer yes / no with a screenshot — this decides the next step.)
4. Optional: copy `extension/scripts/MOE Quick.jsx` into After Effects' Scripts folder (admin), restart, File › Scripts ›
   MOE Quick: does the window open?

## 3. Tile Test again
Diagnostics › Tile Test, all sections. Report pass / fail / not measured — the undo count rule changed in 1.0
(every press counts now), so compare with 352 / 1 / 220 and explain any tile that now fails on Ctrl+Z.

## 4. Report
`docs/handoff/reports/RETEST_1.0.md` on branch `retest/1.0`: a table per section above (step · what you saw · verdict),
screenshots, exact texts. Fix only what is clearly broken, on that branch, with a test that fails on the old code.
