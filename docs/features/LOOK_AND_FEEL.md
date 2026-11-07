# Look & Feel (v0.68)

Owner: *improve the Backgrounds interface and how it is used — look, function and speed; give Glass the frosted
glass touch; better interface design overall.*

## Background Composer (`app/ui/studio/bgComposer.js`, section `composer: 'background'`)
One instrument instead of a wall of 36 animated tiles and a hidden Inspector:
- **Stage** — the real background (`bgDraw.bgFrame`: the same plan and motion maths as the expressions in After Effects)
  at the comp's own size, with the palette name, size, loop length and its colours (click one: copy the hex). Its
  canvas key carries the look, so a new look gets a new canvas (a reused one kept drawing the old look).
- **Style · Motion · Colours** — always visible under the stage (Linear / Radial / Mesh / Flat; the point motions; the
  colour motions). Flat disables the motions and says why.
- **Palettes** — light colour strips (CSS, no canvas each: only the stage animates). A plain palette swaps **only the
  colours** — your style and motion stay (`nextArgs`, tested); a designed look (Product, your own presets, marked ✦)
  takes all of it. Double-click applies.
- **Colorize selection · Save as client · Fine-tune** (angle, spread, grain, loop, movement — `renderTool` bare with
  `hide` + `noBody`, so nothing is shown twice). The library's sticky bar is the one Apply.
- Filters stay one line: they scroll sideways and fade at the edge instead of cutting a chip.

## Frosted Glass (`css/styles.css`, Glass only)
1. Light behind the glass: soft accent / violet / blue orbs (`.app.layout-glass::before`, blurred, drifting over 32 s;
   still when the system asks for reduced motion).
2. Frosted surfaces — groups, NOW, the dock, the Motion Control, cards, the Layer Reader rows, the composer controls:
   `backdrop-filter: blur(22px) saturate(165%)`, a bright rim on top, a faint fractal grain like real frost.
3. Tiles inside the cards are glass too; menus, toasts and hover cards are frosted; the sticky Apply bar is frosted so
   the page under it never reads as clutter.
4. Appearance › frost off (`data-glass-blur="off"`) removes every blur and stops the drifting light.
`backdrop-filter` stays out of `app.css` (costly in CEP — tested); Glass is the only place it is used.

## Everywhere
- MOE (Classic) shows no section banners (the rule was already "no banners in Classic"); composer pages explain
  themselves with their stage in every style.
- Only CSS that Chromium 99 (CEP 12) has: no `color-mix()`, `:has()` or container queries (tested).

## Tests
`tests/lookfeel.test.js` (3).
